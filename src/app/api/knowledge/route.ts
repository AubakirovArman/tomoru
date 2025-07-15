import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

// GET - получить все базы знаний
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      try {
        if (!openai.beta?.vectorStores) {
          throw new Error('Vector stores API not available');
        }
        const store = await openai.beta.vectorStores.retrieve(id);

        const knowledgeBase: KnowledgeBase = {
          id: store.id,
          name: store.name || 'Unnamed Knowledge Base',
          description: store.metadata?.description || 'No description',
          category: (store.metadata?.category as any) || 'general',
          status: store.status === 'completed' ? 'ready' : 'training',
          documents: store.file_counts?.total || 0,
          accuracy: 95,
          usage: 0,
          size: `${Math.round((store.usage_bytes || 0) / 1024 / 1024 * 100) / 100} MB`,
          lastUpdated: new Date(store.created_at * 1000).toLocaleDateString('ru-RU'),
          vectorStoreId: store.id
        };

        return NextResponse.json({ knowledgeBase });
      } catch (vectorStoreError) {
        console.log('Vector stores API not available, using local storage:', vectorStoreError);

        const kb = localKnowledgeBases.find(kb => kb.id === id);
        if (!kb) {
          return NextResponse.json(
            { error: 'Knowledge base not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ knowledgeBase: kb });
      }
    }

    // Пытаемся получить vector stores из OpenAI
    try {
      if (!openai.beta?.vectorStores) {
        throw new Error('Vector stores API not available');
      }
      const vectorStores = await openai.beta.vectorStores.list();
      
      const knowledgeBases: KnowledgeBase[] = vectorStores.data.map((store: any) => ({
        id: store.id,
        name: store.name || 'Unnamed Knowledge Base',
        description: store.metadata?.description || 'No description',
        category: (store.metadata?.category as any) || 'general',
        status: store.status === 'completed' ? 'ready' : 'training',
        documents: store.file_counts?.total || 0,
        accuracy: 95,
        usage: 0,
        size: `${Math.round((store.usage_bytes || 0) / 1024 / 1024 * 100) / 100} MB`,
        lastUpdated: new Date(store.created_at * 1000).toLocaleDateString('ru-RU'),
        vectorStoreId: store.id
      }));
      
      return NextResponse.json({ knowledgeBases });
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, using local storage:', vectorStoreError);
      // Возвращаем локально сохраненные базы знаний
      return NextResponse.json({ knowledgeBases: localKnowledgeBases });
    }
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
    const { name, description, category } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    let knowledgeBase: KnowledgeBase;

    // Пытаемся создать vector store в OpenAI
    try {
      if (!openai.beta?.vectorStores) {
        throw new Error('Vector stores API not available');
      }
      const vectorStore = await openai.beta.vectorStores.create({
        name,
        metadata: {
          description: description || 'No description',
          category: category || 'general'
        }
      });
      
      knowledgeBase = {
        id: vectorStore.id,
        name: vectorStore.name || name,
        description: description || 'No description',
        category: category || 'general',
        status: 'ready',
        documents: 0,
        accuracy: 95,
        usage: 0,
        size: '0 MB',
        lastUpdated: new Date().toLocaleDateString('ru-RU'),
        vectorStoreId: vectorStore.id
      };
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, creating local knowledge base:', vectorStoreError);
      
      // Создаем локальную базу знаний
      const localId = `kb_${Date.now()}`;
      knowledgeBase = {
        id: localId,
        name,
        description: description || 'No description',
        category: category || 'general',
        status: 'ready',
        documents: 0,
        accuracy: 95,
        usage: 0,
        size: '0 MB',
        lastUpdated: new Date().toLocaleDateString('ru-RU'),
        vectorStoreId: localId
      };
      
      // Сохраняем в локальном хранилище
      localKnowledgeBases.push(knowledgeBase);
    }

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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Пытаемся удалить vector store из OpenAI
    try {
      if (!openai.beta?.vectorStores) {
        throw new Error('Vector stores API not available');
      }
      await openai.beta.vectorStores.del(id);
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, removing from local storage:', vectorStoreError);
      // Удаляем из локального хранилища
      localKnowledgeBases = localKnowledgeBases.filter(kb => kb.id !== id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base' },
      { status: 500 }
    );
  }
}