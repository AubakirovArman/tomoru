import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { botId, message } = await request.json();
    
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    let userId;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Находим бота
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId: userId
      }
    });
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    if (!bot.openaiId) {
      return NextResponse.json({ error: 'Bot not configured with OpenAI' }, { status: 400 });
    }
    
    try {
      // Создаем thread для разговора
      const thread = await openai.beta.threads.create();
      
      // Добавляем сообщение пользователя с инструкцией отвечать на том же языке
      const messageWithLanguageInstruction = `${message}

[IMPORTANT INSTRUCTION: Always respond in the same language as the user's message above. If the user writes in Russian - respond in Russian, if in English - respond in English, if in another language - respond in that same language.]`;
      
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: messageWithLanguageInstruction
      });
      
      // Создаем run для выполнения
      const runResponse = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: bot.openaiId,
      });
      
      // Ждем завершения выполнения
      let runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, {
        thread_id: thread.id
      });
      
      while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, {
          thread_id: thread.id
        });
      }
      
      if (runStatus.status === 'completed') {
        // Получаем ответ ассистента
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data[0];
        
        if (assistantMessage.content[0].type === 'text') {
          const responseText = assistantMessage.content[0].text.value;
          return NextResponse.json({ response: responseText });
        }
      }
      
      return NextResponse.json({ response: 'Извините, не удалось получить ответ от ассистента.' });
      
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      return NextResponse.json({ response: 'Извините, произошла ошибка при обработке вашего запроса.' });
    }
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}