import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface JWTPayload {
  userId: number;
  email: string;
}

// GET - Получить быстрые ответы для бота
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: parseInt(botId),
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const quickReplies = await prisma.quickReply.findMany({
      where: {
        botId: parseInt(botId)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ quickReplies });
  } catch (error) {
    console.error('Error fetching quick replies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Создать новый быстрый ответ
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { botId, question, variations, answer } = await request.json();

    if (!botId || !question || !answer) {
      return NextResponse.json({ error: 'Bot ID, question, and answer are required' }, { status: 400 });
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        botId,
        question,
        variations: variations || [],
        answer
      }
    });

    return NextResponse.json({ quickReply });
  } catch (error) {
    console.error('Error creating quick reply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Удалить быстрый ответ
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { searchParams } = new URL(request.url);
    const quickReplyId = searchParams.get('id');

    if (!quickReplyId) {
      return NextResponse.json({ error: 'Quick reply ID is required' }, { status: 400 });
    }

    // Проверяем, что быстрый ответ принадлежит боту пользователя
    const quickReply = await prisma.quickReply.findFirst({
      where: {
        id: parseInt(quickReplyId)
      },
      include: {
        bot: true
      }
    });

    if (!quickReply || quickReply.bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 });
    }

    await prisma.quickReply.delete({
      where: {
        id: parseInt(quickReplyId)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quick reply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}