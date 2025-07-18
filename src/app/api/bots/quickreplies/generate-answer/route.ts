import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface JWTPayload {
  userId: number;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { question, botId } = await request.json();

    if (!question || !botId) {
      return NextResponse.json({ error: 'Question and bot ID are required' }, { status: 400 });
    }

    // Получаем бота с его настройками
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId: decoded.userId
      }
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Формируем системный промпт на основе настроек бота
    let systemPrompt = 'Ты полезный AI-ассистент.';
    
    if (bot.specialization) {
      systemPrompt += ` Твоя специализация: ${bot.specialization}.`;
    }
    
    if (bot.personality) {
      systemPrompt += ` Твоя личность: ${bot.personality}.`;
    }
    
    if (bot.instructions) {
      systemPrompt += ` Дополнительные инструкции: ${bot.instructions}.`;
    }

    systemPrompt += ' Отвечай кратко, информативно и в соответствии с твоими настройками.';

    // Генерируем ответ с помощью OpenAI, используя настройки бота
    const completion = await openai.chat.completions.create({
      model: bot.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: bot.temperature || 0.7,
      top_p: bot.topP || 1,
      max_tokens: 1000
    });

    const answer = completion.choices[0]?.message?.content;
    if (!answer) {
      return NextResponse.json({ error: 'Failed to generate answer' }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Error generating answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}