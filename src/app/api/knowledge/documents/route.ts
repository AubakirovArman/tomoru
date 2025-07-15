import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Локальное хранилище для документов (временное решение)
let localDocuments: { [knowledgeBaseId: string]: any[] } = {};

// Функция для получения пользователя из токена
function getUserFromToken(request: NextRequest): { userId: number } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return { userId: decoded.userId };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

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
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

   // Пытаемся получить файлы из vector store
     try {
       if (!dbKnowledgeBase.vectorStoreId) {
         throw new Error('No vector store ID available');
       }
       const vectorStoreFiles = await (openai as any).vectorStores.files.list(dbKnowledgeBase.vectorStoreId);

      const documents: Document[] = await Promise.all(
        vectorStoreFiles.data.map(async (file: any) => {
          try {
            const fileDetails = await openai.files.retrieve(file.id);
            return {
              id: file.id,
              name: fileDetails.filename,
              type: fileDetails.filename.split('.').pop() || 'unknown',
              size: `${Math.round((fileDetails.bytes / 1024) * 100) / 100} KB`,
              uploadDate: new Date(fileDetails.created_at * 1000).toLocaleDateString('ru-RU'),
              status:
                file.status === 'completed'
                  ? 'processed'
                  : file.status === 'failed'
                  ? 'failed'
                  : 'processing'
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
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const knowledgeBaseId = formData.get('knowledgeBaseId') as string;

    if (!file || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: txt, md, pdf, docx' },
        { status: 400 }
      );
    }

    let document: Document;

    try {
      const uploadedFile = await openai.files.create({
        file: file,
        purpose: 'assistants'
      });

      if (dbKnowledgeBase.vectorStoreId) {
        await openai.vectorStores.files.create(dbKnowledgeBase.vectorStoreId, {
          file_id: uploadedFile.id
        });
      } else {
        throw new Error('No vector store ID available');
      }

      document = {
        id: uploadedFile.id,
        name: file.name,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round((file.size / 1024) * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processing'
      };
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, saving locally:', vectorStoreError);

      const localId = `doc_${Date.now()}`;
      document = {
        id: localId,
        name: file.name,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round((file.size / 1024) * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processed'
      };

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
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!fileId || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File ID and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    try {
      if (dbKnowledgeBase.vectorStoreId) {
        await openai.vectorStores.files.delete(fileId, {
          vector_store_id: dbKnowledgeBase.vectorStoreId
        });
        await openai.files.delete(fileId);
      } else {
        throw new Error('No vector store ID available');
      }
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, removing from local storage:', vectorStoreError);
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
