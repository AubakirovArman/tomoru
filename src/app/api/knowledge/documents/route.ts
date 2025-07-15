import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Локальное хранилище для документов (временное решение)
let localDocuments: { [knowledgeBaseId: string]: any[] } = {};

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
}

// GET - получить документы базы знаний
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // Пытаемся получить файлы из vector store
     try {
       const vectorStoreFiles = await (openai as any).beta.vectorStores.files.list(knowledgeBaseId);
      
      const documents: Document[] = await Promise.all(
        vectorStoreFiles.data.map(async (file: any) => {
          try {
            const fileDetails = await openai.files.retrieve(file.id);
            return {
              id: file.id,
              name: fileDetails.filename,
              type: fileDetails.filename.split('.').pop() || 'unknown',
              size: `${Math.round(fileDetails.bytes / 1024 * 100) / 100} KB`,
              uploadDate: new Date(fileDetails.created_at * 1000).toLocaleDateString('ru-RU'),
              status: file.status === 'completed' ? 'processed' : 'processing'
            };
          } catch (error) {
            console.error('Error fetching file details:', error);
            return {
              id: file.id,
              name: 'Unknown file',
              type: 'unknown',
              size: '0 KB',
              uploadDate: new Date().toLocaleDateString('ru-RU'),
              status: 'error'
            };
          }
        })
      );

      return NextResponse.json({ documents });
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, using local storage:', vectorStoreError);
      // Возвращаем локально сохраненные документы
      const documents = localDocuments[knowledgeBaseId] || [];
      return NextResponse.json({ documents });
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST - загрузить документ в базу знаний
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const knowledgeBaseId = formData.get('knowledgeBaseId') as string;

    if (!file || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем тип файла
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: txt, md, pdf, docx' },
        { status: 400 }
      );
    }

    let document: Document;

    // Пытаемся загрузить файл в OpenAI
    try {
      const uploadedFile = await openai.files.create({
        file: file,
        purpose: 'assistants'
      });

      // Добавляем файл в vector store
       await (openai as any).beta.vectorStores.files.create(knowledgeBaseId, {
         file_id: uploadedFile.id
       });
      
      document = {
        id: uploadedFile.id,
        name: file.name,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round(file.size / 1024 * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processing'
      };
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, saving locally:', vectorStoreError);
      
      // Создаем локальный документ
      const localId = `doc_${Date.now()}`;
      document = {
        id: localId,
        name: file.name,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round(file.size / 1024 * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processed'
      };
      
      // Сохраняем в локальном хранилище
      if (!localDocuments[knowledgeBaseId]) {
        localDocuments[knowledgeBaseId] = [];
      }
      localDocuments[knowledgeBaseId].push(document);
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// DELETE - удалить документ из базы знаний
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!fileId || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File ID and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Пытаемся удалить файл из vector store
     try {
       await (openai as any).beta.vectorStores.files.del(knowledgeBaseId, fileId);
       await (openai as any).files.del(fileId);
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, removing from local storage:', vectorStoreError);
      // Удаляем из локального хранилища
      if (localDocuments[knowledgeBaseId]) {
        localDocuments[knowledgeBaseId] = localDocuments[knowledgeBaseId].filter(
          doc => doc.id !== fileId
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}