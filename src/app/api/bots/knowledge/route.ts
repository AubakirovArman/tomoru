import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET - получить базы знаний для бота
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: parseInt(botId),
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Получаем связанные базы знаний
    const botKnowledgeBases = await prisma.botKnowledgeBase.findMany({
      where: {
        botId: parseInt(botId)
      },
      include: {
        knowledgeBase: true
      }
    });

    const knowledgeBases = botKnowledgeBases.map((bkb: any) => bkb.knowledgeBase);

    return NextResponse.json({
      knowledgeBases
    });
  } catch (error) {
    console.error('Error fetching bot knowledge bases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - добавить базу знаний к боту
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { botId, knowledgeBaseId } = await request.json();
    
    console.log('POST /api/bots/knowledge - Received data:', { botId, knowledgeBaseId, userId: decoded.userId });

    if (!botId || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Bot ID and Knowledge Base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: parseInt(botId),
        userId: decoded.userId
      }
    });
    
    console.log('Bot found:', bot ? 'Yes' : 'No', bot?.id);

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Проверяем, что база знаний принадлежит пользователю
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: decoded.userId
      }
    });
    
    console.log('Knowledge base found:', knowledgeBase ? 'Yes' : 'No', knowledgeBase?.id);

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'База знаний не найдена' },
        { status: 404 }
      );
    }

    // Проверяем, не привязана ли уже база знаний к боту
    const existingLink = await prisma.botKnowledgeBase.findFirst({
      where: {
        botId: parseInt(botId),
        knowledgeBaseId: parseInt(knowledgeBaseId)
      }
    });
    
    console.log('Existing link found:', existingLink ? 'Yes' : 'No');

    if (existingLink) {
      return NextResponse.json(
        { error: 'База знаний уже привязана к боту' },
        { status: 400 }
      );
    }

    // Создаем связь
    console.log('Creating link with data:', { botId: parseInt(botId), knowledgeBaseId: parseInt(knowledgeBaseId) });
    const relation = await prisma.botKnowledgeBase.create({
      data: {
        botId: parseInt(botId),
        knowledgeBaseId: parseInt(knowledgeBaseId)
      }
    });

    console.log('Link created successfully:', relation);

    // Копируем файлы из базы знаний в векторную базу ассистента
    if (bot.openaiId && knowledgeBase.vectorStoreId) {
      try {
        const assistant = await openai.beta.assistants.retrieve(bot.openaiId);
        
        // Получаем существующие vector stores ассистента
        const existingVectorStores = assistant.tool_resources?.file_search?.vector_store_ids || [];
        let botVectorStoreId = existingVectorStores[0] || null;
        
        // Если у ассистента нет векторной базы, создаем новую
        if (!botVectorStoreId) {
          const vectorStore = await openai.vectorStores.create({
            name: `Bot ${bot.name} Vector Store`
          });
          botVectorStoreId = vectorStore.id;
        }
        
        // Получаем файлы из базы знаний
        const knowledgeBaseFiles = await openai.vectorStores.files.list(knowledgeBase.vectorStoreId);
        
        // Копируем файлы в векторную базу ассистента
        for (const file of knowledgeBaseFiles.data) {
          try {
            // Проверяем, не существует ли уже файл в векторной базе ассистента
            const existingFiles = await openai.vectorStores.files.list(botVectorStoreId);
            const fileExists = existingFiles.data.some(f => f.id === file.id);
            
            if (!fileExists) {
              await openai.vectorStores.files.create(botVectorStoreId, {
                file_id: file.id
              });
            }
          } catch (fileError) {
            console.error(`Error copying file ${file.id} to bot vector store:`, fileError);
          }
        }
        
        // Обновляем ассистента с новой векторной базой
        let tools: any[] = assistant.tools || [];
        if (!tools.some(t => t.type === 'file_search')) {
          tools.push({ type: 'file_search' });
        }

        await openai.beta.assistants.update(bot.openaiId, {
          tools,
          tool_resources: {
            file_search: { vector_store_ids: [botVectorStoreId] }
          }
        });
      } catch (assistantError) {
        console.error(
          'Error copying knowledge base files to assistant:',
          assistantError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge base linked to bot successfully'
    });
  } catch (error) {
    console.error('Error linking knowledge base to bot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удалить базу знаний из бота
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!botId || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Bot ID and Knowledge Base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: parseInt(botId),
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Удаляем связь
    const deletedRelation = await prisma.botKnowledgeBase.deleteMany({
      where: {
        botId: parseInt(botId),
        knowledgeBaseId: parseInt(knowledgeBaseId)
      }
    });

    if (deletedRelation.count === 0) {
      return NextResponse.json(
        { error: 'Relation not found' },
        { status: 404 }
      );
    }

    // Получаем информацию о базе знаний
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: decoded.userId,
      },
    });

    // Удаляем файлы базы знаний из векторной базы ассистента
    if (bot.openaiId && knowledgeBase?.vectorStoreId) {
      try {
        const assistant = await openai.beta.assistants.retrieve(bot.openaiId);
        const existingVectorStores = assistant.tool_resources?.file_search?.vector_store_ids || [];
        
        if (existingVectorStores.length > 0) {
          const botVectorStoreId = existingVectorStores[0];
          
          // Получаем файлы из базы знаний, которую отвязываем
          const knowledgeBaseFiles = await openai.vectorStores.files.list(knowledgeBase.vectorStoreId);
          
          // Удаляем эти файлы из векторной базы ассистента
          for (const file of knowledgeBaseFiles.data) {
            try {
              await openai.vectorStores.files.delete(file.id, {
                 vector_store_id: botVectorStoreId
               });
            } catch (fileError) {
              console.error(`Error removing file ${file.id} from bot vector store:`, fileError);
            }
          }
          
          // Проверяем, остались ли файлы в векторной базе ассистента
          const remainingFiles = await openai.vectorStores.files.list(botVectorStoreId);
          
          let tools: any[] = assistant.tools || [];
          let toolResources = assistant.tool_resources || {};
          
          // Если файлов не осталось, удаляем file_search tool и векторную базу
          if (remainingFiles.data.length === 0) {
            tools = tools.filter(t => t.type !== 'file_search');
            toolResources = {
              ...toolResources,
              file_search: { vector_store_ids: [] }
            };
            
            // Удаляем пустую векторную базу
            try {
              await openai.vectorStores.delete(botVectorStoreId);
            } catch (deleteError) {
              console.error('Error deleting empty vector store:', deleteError);
            }
          } else {
            // Если файлы остались, оставляем векторную базу
            toolResources = {
              ...toolResources,
              file_search: { vector_store_ids: [botVectorStoreId] }
            };
          }
          
          await openai.beta.assistants.update(bot.openaiId, {
            tools,
            tool_resources: toolResources
          });
        }
      } catch (assistantError) {
        console.error(
          'Error removing knowledge base files from assistant:',
          assistantError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge base unlinked from bot'
    });
  } catch (error) {
    console.error('Error unlinking knowledge base from bot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}