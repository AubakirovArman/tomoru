import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Assistant id is required' }, { status: 400 });
  }

  try {
    const assistant = await openai.beta.assistants.retrieve(id);
    let files: { id: string; filename: string; bytes: number }[] = [];
    
    // Получаем файлы из vector stores согласно документации
    const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
    
    for (const vectorStoreId of vectorStoreIds) {
      try {
        const vectorStoreFiles = await openai.vectorStores.files.list(vectorStoreId);
        
        if (vectorStoreFiles && vectorStoreFiles.data) {
          for (const vectorFile of vectorStoreFiles.data) {
            try {
              const file = await openai.files.retrieve(vectorFile.id);
              files.push({
                id: file.id,
                filename: file.filename || 'unknown',
                bytes: file.bytes || 0
              });
            } catch (fileError) {
              console.error(`Error retrieving file ${vectorFile.id}:`, fileError);
            }
          }
        }
      } catch (vectorError) {
        console.error(`Error retrieving files from vector store ${vectorStoreId}:`, vectorError);
      }
    }
    
    return NextResponse.json({ assistant, files });
  } catch (error) {
    console.error('Error retrieving assistant:', error);
    return NextResponse.json({ error: 'Failed to retrieve assistant' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { assistantId, data, files } = await request.json();

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant id is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверяем, принадлежит ли ассистент пользователю
    const bot = await prisma.bot.findFirst({ where: { openaiId: assistantId, userId: decoded.userId } });
    if (!bot) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Создаем vector store и прикрепляем файлы согласно документации
    if (files && files.length > 0) {
      try {
        // Логируем доступные методы для отладки
        console.log('OpenAI beta object:', Object.keys(openai.beta));
        console.log('OpenAI object keys:', Object.keys(openai));
        
        // Создаем vector store через основной API
        const vectorStore = await openai.vectorStores.create({
             name: `Files for ${data.name || 'Assistant'}`,
             file_ids: files
           });
        
        console.log('Created vector store:', vectorStore.id);
        
        // Добавляем file_search tool и настраиваем tool_resources
        data.tools = [
          ...(data.tools || []),
          { type: 'file_search' }
        ];
        
        data.tool_resources = {
          file_search: {
            vector_store_ids: [vectorStore.id]
          }
        };
      } catch (vectorError) {
        console.error('Error creating vector store:', vectorError);
        // Fallback: добавляем только file_search tool без файлов
        data.tools = [
          ...(data.tools || []),
          { type: 'file_search' }
        ];
      }
    }

    const assistant = await openai.beta.assistants.update(assistantId, data);
    return NextResponse.json({ assistant });
  } catch (error) {
    console.error('Error updating assistant:', error);
    return NextResponse.json({ error: 'Failed to update assistant' }, { status: 500 });
  }
}
