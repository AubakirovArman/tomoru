import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'business' | 'general' | 'ai';
  status: 'ready' | 'training' | 'active';
  documents: number;
  accuracy: number;
  usage: number;
  size: string;
  lastUpdated: string;
  vectorStoreId?: string;
}

// Локальное хранилище для баз знаний (временное решение)
let localKnowledgeBases: KnowledgeBase[] = [];

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

// GET - получить все базы знаний
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
    const id = searchParams.get('id');

    if (id) {
      // Проверяем, принадлежит ли база знаний пользователю
      const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
        where: {
          id: parseInt(id),
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
        if (!openai.vectorStores || !dbKnowledgeBase.vectorStoreId) {
          throw new Error('Vector stores API not available');
        }
        const store = await (openai as any).vectorStores.retrieve(dbKnowledgeBase.vectorStoreId);

        const knowledgeBase: KnowledgeBase = {
          id: dbKnowledgeBase.id.toString(),
          name: dbKnowledgeBase.name,
          description: dbKnowledgeBase.description || 'No description',
          category: 'general',
          status: store.status === 'completed' ? 'ready' : 'training',
          documents: store.file_counts?.total || 0,
          accuracy: 95,
          usage: 0,
          size: `${Math.round((store.usage_bytes || 0) / 1024 / 1024 * 100) / 100} MB`,
          lastUpdated: dbKnowledgeBase.updatedAt.toLocaleDateString('ru-RU'),
          vectorStoreId: store.id
        };

        return NextResponse.json({ knowledgeBase });
      } catch (vectorStoreError) {
        console.log('Vector stores API not available, using database info:', vectorStoreError);

        const knowledgeBase: KnowledgeBase = {
          id: dbKnowledgeBase.id.toString(),
          name: dbKnowledgeBase.name,
          description: dbKnowledgeBase.description || 'No description',
          category: 'general',
          status: 'ready',
          documents: 0,
          accuracy: 95,
          usage: 0,
          size: '0 MB',
          lastUpdated: dbKnowledgeBase.updatedAt.toLocaleDateString('ru-RU'),
          vectorStoreId: dbKnowledgeBase.vectorStoreId
        };
        return NextResponse.json({ knowledgeBase });
      }
    }

    // Получаем базы знаний пользователя из базы данных
    const dbKnowledgeBases = await prisma.KnowledgeBase.findMany({
      where: {
        userId: user.userId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Пытаемся получить дополнительную информацию из OpenAI vector stores
    const knowledgeBases: KnowledgeBase[] = [];
    
    for (const dbKb of dbKnowledgeBases) {
      try {
        if (openai.vectorStores && dbKb.vectorStoreId) {
          const store = await (openai as any).vectorStores.retrieve(dbKb.vectorStoreId);
          
          knowledgeBases.push({
            id: dbKb.id.toString(),
            name: dbKb.name,
            description: dbKb.description || 'No description',
            category: 'general',
            status: store.status === 'completed' ? 'ready' : 'training',
            documents: store.file_counts?.total || 0,
            accuracy: 95,
            usage: 0,
            size: `${Math.round((store.usage_bytes || 0) / 1024 / 1024 * 100) / 100} MB`,
            lastUpdated: dbKb.updatedAt.toLocaleDateString('ru-RU'),
            vectorStoreId: store.id
          });
        } else {
          throw new Error('Vector stores API not available');
        }
      } catch (vectorStoreError) {
        // Если не удается получить данные из OpenAI, используем данные из БД
        knowledgeBases.push({
          id: dbKb.id.toString(),
          name: dbKb.name,
          description: dbKb.description || 'No description',
          category: 'general',
          status: 'ready',
          documents: 0,
          accuracy: 95,
          usage: 0,
          size: '0 MB',
          lastUpdated: dbKb.updatedAt.toLocaleDateString('ru-RU'),
          vectorStoreId: dbKb.vectorStoreId
        });
      }
    }
    
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge bases' },
      { status: 500 }
    );
  }
}

// POST - создать новую базу знаний
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, description, category } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    let vectorStoreId: string | null = null;

    // Пытаемся создать vector store в OpenAI
    try {
      if (openai.vectorStores) {
        const vectorStore = await (openai as any).vectorStores.create({
          name,
          metadata: {
            description: description || 'No description',
            category: category || 'general'
          }
        });
        vectorStoreId = vectorStore.id;
      }
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, creating without OpenAI integration:', vectorStoreError);
    }

    // Сохраняем в базе данных
    const newKnowledgeBase = await prisma.KnowledgeBase.create({
      data: {
        name,
        description: description || null,
        vectorStoreId,
        userId: user.userId
      }
    });

    const knowledgeBase: KnowledgeBase = {
       id: newKnowledgeBase.id.toString(),
       name: newKnowledgeBase.name,
       description: newKnowledgeBase.description || 'No description',
       category: 'general',
       status: 'ready',
       documents: 0,
       accuracy: 95,
       usage: 0,
       size: '0 MB',
       lastUpdated: newKnowledgeBase.updatedAt.toLocaleDateString('ru-RU'),
       vectorStoreId: newKnowledgeBase.vectorStoreId
     };

    return NextResponse.json({ knowledgeBase });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base' },
      { status: 500 }
    );
  }
}

// DELETE - удалить базу знаний
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(id),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    // Пытаемся удалить vector store из OpenAI
    if (dbKnowledgeBase.vectorStoreId) {
      try {
        if (openai.vectorStores) {
          await (openai as any).vectorStores.delete(dbKnowledgeBase.vectorStoreId);
        }
      } catch (vectorStoreError) {
        console.log('Vector stores API not available or vector store already deleted:', vectorStoreError);
      }
    }

    // Удаляем из базы данных
    await prisma.KnowledgeBase.delete({
      where: {
        id: parseInt(id)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base' },
      { status: 500 }
    );
  }
}