import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
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

    // Получаем ботов пользователя
    const bots = await prisma.bot.findMany({
      where: {
        userId: decoded.userId
      },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ bots });

  } catch (error) {
    console.error('Error fetching bots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { botId, botConfig } = await request.json();

    // Проверяем аутентификацию
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

    // Обновляем бота (только если он принадлежит пользователю)
    const updatedBot = await prisma.bot.update({
      where: {
        id: botId,
        userId: decoded.userId // Проверяем владельца
      },
      data: {
        name: botConfig.name,
        description: botConfig.description,
        instructions: botConfig.instructions,
        personality: botConfig.personality,
        specialization: botConfig.specialization,
        model: botConfig.model || 'gpt-4o',
        temperature: botConfig.temperature || 0.7,
        topP: botConfig.topP || 1.0
      }
    });

    return NextResponse.json({ bot: updatedBot });

  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('id');

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Проверяем аутентификацию
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

    // Получаем бота для проверки владельца и получения openaiId
    const bot = await prisma.bot.findUnique({
      where: {
        id: parseInt(botId),
        userId: decoded.userId // Проверяем владельца
      }
    });

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Удаляем OpenAI assistant, если он существует
    if (bot.openaiId) {
      try {
        await openai.beta.assistants.delete(bot.openaiId);
        console.log(`Deleted OpenAI assistant: ${bot.openaiId}`);
      } catch (openaiError) {
        console.error('Error deleting OpenAI assistant:', openaiError);
        // Продолжаем удаление бота даже если не удалось удалить assistant
      }
    }

    // Удаляем бота из базы данных
    await prisma.bot.delete({
      where: {
        id: parseInt(botId)
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}