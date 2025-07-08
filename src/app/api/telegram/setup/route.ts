import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { botId, telegramBotToken, webhookUrl } = await request.json();

    if (!botId || !telegramBotToken || !webhookUrl) {
      return NextResponse.json({ 
        error: 'Bot ID, Telegram bot token and webhook URL are required' 
      }, { status: 400 });
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

    // Проверяем валидность Telegram токена
    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`);
    if (!telegramResponse.ok) {
      return NextResponse.json({ 
        error: 'Invalid Telegram bot token' 
      }, { status: 400 });
    }

    const telegramBot = await telegramResponse.json();
    if (!telegramBot.ok) {
      return NextResponse.json({ 
        error: 'Invalid Telegram bot token' 
      }, { status: 400 });
    }

    // Устанавливаем веб-хук в Telegram
    const webhookResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: `${webhookUrl}?token=${telegramBotToken}`
      })
    });

    if (!webhookResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to set webhook' 
      }, { status: 500 });
    }

    // Обновляем бота в базе данных
    const updatedBot = await prisma.bot.update({
      where: { id: botId },
      data: {
        telegramBotToken,
        telegramWebhookUrl: webhookUrl,
        telegramEnabled: true
      } as any
    });

    return NextResponse.json({ 
      success: true, 
      bot: updatedBot,
      telegramBot: telegramBot.result
    });

  } catch (error) {
    console.error('Telegram setup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { botId } = await request.json();

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
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

    // Удаляем веб-хук из Telegram
    if ((bot as any).telegramBotToken) {
      await fetch(`https://api.telegram.org/bot${(bot as any).telegramBotToken}/deleteWebhook`, {
        method: 'POST'
      });
    }

    // Обновляем бота в базе данных
    const updatedBot = await prisma.bot.update({
      where: { id: botId },
      data: {
        telegramBotToken: null,
        telegramWebhookUrl: null,
        telegramEnabled: false
      } as any
    });

    return NextResponse.json({ 
      success: true, 
      bot: updatedBot
    });

  } catch (error) {
    console.error('Telegram disable error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}