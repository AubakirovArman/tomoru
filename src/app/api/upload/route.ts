import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Функция для конвертации CSV в TXT
async function convertCsvToTxt(file: File): Promise<File> {
  const text = await file.text();
  const lines = text.split('\n');
  
  // Преобразуем CSV в читаемый текстовый формат
  const convertedLines = lines.map(line => {
    if (line.trim()) {
      const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
      return columns.join(' | ');
    }
    return line;
  });
  
  const convertedText = convertedLines.join('\n');
  const blob = new Blob([convertedText], { type: 'text/plain' });
  
  // Создаем новый файл с расширением .txt
  const newFileName = file.name.replace(/\.csv$/i, '.txt');
  return new File([blob], newFileName, { type: 'text/plain' });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    let file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Проверяем размер файла (OpenAI лимит: 512MB)
    const maxFileSize = 512 * 1024 * 1024; // 512MB в байтах
    if (file.size > maxFileSize) {
      return NextResponse.json({ 
        error: `File size exceeds the limit. Maximum allowed size is 512MB, but your file is ${Math.round(file.size / 1024 / 1024)}MB.` 
      }, { status: 413 });
    }

    // Проверяем, является ли файл CSV, и конвертируем его в TXT
    if (file.name.toLowerCase().endsWith('.csv')) {
      file = await convertCsvToTxt(file);
      
      // Проверяем размер после конвертации
      if (file.size > maxFileSize) {
        return NextResponse.json({ 
          error: `Converted file size exceeds the limit. Maximum allowed size is 512MB, but your converted file is ${Math.round(file.size / 1024 / 1024)}MB.` 
        }, { status: 413 });
      }
    }

    // Загружаем файл в OpenAI
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadedFile = await openai.files.create({
      file: new File([fileBuffer], file.name, { type: file.type }),
      purpose: 'assistants'
    });

    return NextResponse.json({
      fileId: uploadedFile.id,
      filename: file.name,
      size: file.size
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const botId = searchParams.get('botId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Если указан botId, удаляем файл из векторной базы ассистента
    if (botId) {
      try {
        const bot = await prisma.bot.findFirst({
          where: {
            id: parseInt(botId),
            userId: decoded.userId
          }
        });

        if (bot && bot.openaiId) {
          const assistant = await openai.beta.assistants.retrieve(bot.openaiId);
          const existingVectorStores = assistant.tool_resources?.file_search?.vector_store_ids || [];
          
          if (existingVectorStores.length > 0) {
            const botVectorStoreId = existingVectorStores[0];
            
            // Удаляем файл из векторной базы ассистента
            try {
              await openai.vectorStores.files.delete(fileId, {
                 vector_store_id: botVectorStoreId
               });
            } catch (vectorError) {
              console.error('Error removing file from bot vector store:', vectorError);
            }
            
            // Проверяем, остались ли файлы в векторной базе
            const remainingFiles = await openai.vectorStores.files.list(botVectorStoreId);
            
            // Если файлов не осталось, удаляем file_search tool и векторную базу
            if (remainingFiles.data.length === 0) {
              let tools: any[] = assistant.tools || [];
              tools = tools.filter(t => t.type !== 'file_search');
              
              await openai.beta.assistants.update(bot.openaiId, {
                tools,
                tool_resources: {
                  file_search: { vector_store_ids: [] }
                }
              });
              
              // Удаляем пустую векторную базу
              try {
                await openai.vectorStores.delete(botVectorStoreId);
              } catch (deleteError) {
                console.error('Error deleting empty vector store:', deleteError);
              }
            }
          }
        }
      } catch (botError) {
        console.error('Error processing bot file deletion:', botError);
      }
    }

    // Удаляем файл из OpenAI
    await openai.files.delete(fileId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}