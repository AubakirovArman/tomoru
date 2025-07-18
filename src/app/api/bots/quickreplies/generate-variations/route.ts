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

    // Генерируем вариации вопроса с помощью OpenAI
    const prompt = `Создай около 50 различных вариаций следующего вопроса на русском языке. Вариации должны быть разнообразными по формулировке, но сохранять тот же смысл. Включи:
- Формальные и неформальные варианты
- Короткие и развернутые формулировки
- Разные способы задать тот же вопрос
- Синонимы и перефразировки

Основной вопрос: "${question}"

Верни только список вариаций, каждую с новой строки, без нумерации и дополнительного текста:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Ты помощник для создания вариаций вопросов. Создавай разнообразные, естественные формулировки на русском языке.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    const generatedText = completion.choices[0]?.message?.content;
    if (!generatedText) {
      return NextResponse.json({ error: 'Failed to generate variations' }, { status: 500 });
    }

    // Разбиваем текст на отдельные вариации
    const variations = generatedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+\./)) // Убираем пустые строки и нумерацию
      .slice(0, 50); // Ограничиваем до 50 вариаций

    return NextResponse.json({ variations });
  } catch (error) {
    console.error('Error generating variations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}