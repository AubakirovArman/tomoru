import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const telegramUserId = searchParams.get('telegramUserId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Базовые условия фильтрации
    const where: any = {
      bot: {
        userId: decoded.userId // Только боты текущего пользователя
      }
    };

    // Фильтр по боту
    if (botId) {
      where.botId = parseInt(botId);
    }

    // Фильтр по Telegram пользователю
    if (telegramUserId) {
      where.telegramUserId = parseInt(telegramUserId);
    }

    // Получаем сообщения с пагинацией
    const messages = await prisma.message.findMany({
      where,
      include: {
        bot: {
          select: {
            id: true,
            name: true
          }
        },
        telegramUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            telegramId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Получаем общее количество сообщений для пагинации
    const total = await prisma.message.count({ where });

    // Преобразуем BigInt в строки для JSON сериализации
    const serializedMessages = messages.map(message => ({
      ...message,
      telegramUserId: message.telegramUserId ? Number(message.telegramUserId) : null,
      telegramMessageId: message.telegramMessageId ? message.telegramMessageId.toString() : null,
      telegramUser: message.telegramUser ? {
        ...message.telegramUser,
        telegramId: message.telegramUser.telegramId.toString()
      } : null
    }));

    return NextResponse.json({
      messages: serializedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { content, messageType, botId, telegramUserId, telegramMessageId, threadId } = await request.json();

    // Проверяем, что бот принадлежит текущему пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Создаем сообщение
    const message = await prisma.message.create({
      data: {
        content,
        messageType,
        botId,
        telegramUserId,
        telegramMessageId: telegramMessageId ? BigInt(telegramMessageId) : null,
        threadId
      },
      include: {
        bot: {
          select: {
            id: true,
            name: true
          }
        },
        telegramUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            telegramId: true
          }
        }
      }
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}