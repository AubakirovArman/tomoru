import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    // Проверяем, является ли файл CSV, и конвертируем его в TXT
    if (file.name.toLowerCase().endsWith('.csv')) {
      file = await convertCsvToTxt(file);
    }

  // Загружаем файл в OpenAI
  const uploadedFile = await openai.files.create({
    file: { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
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