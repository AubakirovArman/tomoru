import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    
    // Получаем токен бота из URL параметров
    const url = new URL(request.url);
    const botToken = url.searchParams.get('token');
    
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token required' }, { status: 400 });
    }
    
    // Найти бота по токену
    const bot = await prisma.bot.findFirst({
      where: {
        telegramBotToken: botToken,
        telegramEnabled: true,
      },
    });
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    // Обрабатываем только текстовые сообщения
    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }
    
    const { message } = update;
    const userMessage = message.text;
    const chatId = message.chat.id;
    
    // Получаем ассистента OpenAI
    if (!bot.openaiId) {
      await sendTelegramMessage(botToken, chatId, 'Бот не настроен правильно. Обратитесь к администратору.');
      return NextResponse.json({ ok: true });
    }
    
    try {
      // Создаем thread для пользователя (можно кэшировать по chatId)
      const thread = await openai.beta.threads.create();
      
      // Добавляем сообщение пользователя
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userMessage || ''
      });
      
      // Создаем run для выполнения
      const runResponse = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: bot.openaiId!,
      });
      
      // Ждем завершения выполнения
      let runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, {
        thread_id: thread.id
      });
      
      while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, {
          thread_id: thread.id
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (runStatus.status === 'completed') {
        // Получаем ответ ассистента
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data[0];
        
        if (assistantMessage.content[0].type === 'text') {
          const responseText = assistantMessage.content[0].text.value;
          await sendTelegramMessage(botToken, chatId, responseText);
        }
      } else {
        await sendTelegramMessage(botToken, chatId, 'Произошла ошибка при обработке запроса.');
      }
      
    } catch (error) {
      console.error('OpenAI error:', error);
      await sendTelegramMessage(botToken, chatId, 'Произошла ошибка при обработке запроса.');
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}