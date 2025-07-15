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
    const botKnowledgeBases = await prisma.BotKnowledgeBase.findMany({
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
        id: botId,
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
    const existingLink = await prisma.BotKnowledgeBase.findFirst({
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
    const relation = await prisma.BotKnowledgeBase.create({
      data: {
        botId: parseInt(botId),
        knowledgeBaseId: parseInt(knowledgeBaseId)
      }
    });

    console.log('Link created successfully:', relation);

    // Привязываем vector store к ассистенту в OpenAI
    if (bot.openaiId && knowledgeBase.vectorStoreId) {
      try {
        const assistant = await openai.beta.assistants.retrieve(bot.openaiId);

        const existingVectorStores =
          assistant.tool_resources?.file_search?.vector_store_ids || [];

        const updatedVectorStores = Array.from(
          new Set([...existingVectorStores, knowledgeBase.vectorStoreId])
        );

        let tools: any[] = assistant.tools || [];
        if (!tools.some(t => t.type === 'file_search')) {
          tools.push({ type: 'file_search' });
        }

        await openai.beta.assistants.update(bot.openaiId, {
          tools,
          tool_resources: {
            file_search: { vector_store_ids: updatedVectorStores }
          }
        });
      } catch (assistantError) {
        console.error(
          'Error attaching knowledge base to assistant:',
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
    const deletedRelation = await prisma.BotKnowledgeBase.deleteMany({
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

    // Отвязываем vector store от ассистента в OpenAI
    if (bot.openaiId && knowledgeBase?.vectorStoreId) {
      try {
        const assistant = await openai.beta.assistants.retrieve(bot.openaiId);

        const existingVectorStores =
          assistant.tool_resources?.file_search?.vector_store_ids || [];

        const updatedVectorStores = existingVectorStores.filter(
          (id: string) => id !== knowledgeBase.vectorStoreId
        );

        let tools: any[] = assistant.tools || [];
        if (updatedVectorStores.length === 0) {
          tools = tools.filter(t => t.type !== 'file_search');
        }

        await openai.beta.assistants.update(bot.openaiId, {
          tools,
          tool_resources: {
            file_search: { vector_store_ids: updatedVectorStores },
          },
        });
      } catch (assistantError) {
        console.error(
          'Error detaching knowledge base from assistant:',
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