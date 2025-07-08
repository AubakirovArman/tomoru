import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Инструкции для Бота-Отца
const BOT_FATHER_INSTRUCTIONS = `
Ты - Бот-Отец, эксперт по созданию профессиональных AI ассистентов. Твоя задача:

1. АНАЛИЗ ФАЙЛОВ И ИНФОРМАЦИИ:
   - Внимательно изучай все прикрепленные файлы
   - Извлекай ключевую информацию о компании, продуктах, услугах
   - Анализируй стиль общения, ценности, особенности бизнеса
   - Выявляй специфические термины, процессы, методологии

2. СБОР ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИИ:
   - Задавай конкретные вопросы о целях бота
   - Уточняй целевую аудиторию и сценарии использования
   - Выясняй требования к стилю общения и тону
   - Определяй ключевые функции и возможности

3. СОЗДАНИЕ ДЕТАЛЬНОГО ПРОМПТА:
   - Пиши максимально конкретные и детальные инструкции
   - Включай специфическую информацию о компании
   - Добавляй примеры ответов и поведения
   - Указывай ограничения и правила работы
   - Включай контекст о продуктах/услугах

4. ФОРМИРОВАНИЕ БАЗЫ ЗНАНИЙ:
   - Суммируй всю информацию из файлов
   - Создавай структурированную базу знаний
   - Включай FAQ, описания услуг, контакты
   - Добавляй примеры кейсов и решений

5. JSON КОНФИГУРАЦИЯ (создавай только после полного анализа):
{
  "name": "Конкретное название бота",
  "description": "Детальное описание функций и возможностей",
  "instructions": "ОЧЕНЬ ПОДРОБНЫЕ инструкции с конкретными примерами, правилами, контекстом компании, стилем общения, ограничениями и сценариями использования",
  "personality": "Детальное описание характера, тона, стиля общения с примерами",
  "specialization": "Конкретная область специализации",
  "knowledge_base": "Структурированная информация о компании, услугах, процессах"
}

Требования к качеству:
- Инструкции должны быть настолько детальными, чтобы бот мог работать автономно
- Включай конкретные примеры ответов и поведения
- Указывай что делать в различных ситуациях
- Добавляй информацию о компании, продуктах, ценах
- Создавай промпт длиной минимум 500-1000 слов

Общайся профессионально, используй эмодзи, задавай конкретные вопросы.
`;

export async function POST(request: NextRequest) {
  try {
    const { message, threadId, files } = await request.json();

    let thread;
    if (threadId) {
      thread = await openai.beta.threads.retrieve(threadId);
    } else {
      thread = await openai.beta.threads.create();
    }

    // Добавляем сообщение пользователя
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message,
      ...(files && files.length > 0 && {
        attachments: files.map((fileId: string) => ({
          file_id: fileId,
          tools: [{ type: 'file_search' }]
        }))
      })
    });

    // Создаем или получаем ассистента
    let assistant;
    try {
      // Пытаемся найти существующего ассистента
      const assistants = await openai.beta.assistants.list();
      assistant = assistants.data.find(a => a.name === 'Bot Father');
      
      if (!assistant) {
        // Создаем нового ассистента
        assistant = await openai.beta.assistants.create({
          name: 'Bot Father',
          instructions: BOT_FATHER_INSTRUCTIONS,
          model: 'gpt-4-turbo-preview'
        });
      }
    } catch (error) {
      console.error('Error with assistant:', error);
      return NextResponse.json(
        { error: 'Failed to create or retrieve assistant' },
        { status: 500 }
      );
    }

    // Запускаем ассистента
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });

    // Ждем завершения
    let runStatus = run;
    
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
       await new Promise(resolve => setTimeout(resolve, 1000));
       try {
         const runs = await openai.beta.threads.runs.list(thread.id);
         const currentRun = runs.data.find(r => r.id === run.id);
         if (currentRun) {
           runStatus = currentRun;
         } else {
           break;
         }
       } catch (error) {
         console.error('Error retrieving run status:', error);
         break;
       }
     }

    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data.find((msg: any) => msg.role === 'assistant');
      
      let response = '';
      if (lastMessage?.content[0]?.type === 'text') {
        response = lastMessage.content[0].text.value;
      } else {
        response = 'Извините, произошла ошибка.';
      }
      let botConfig = null;

      // Проверяем, есть ли JSON конфигурация в ответе
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          botConfig = JSON.parse(jsonMatch[0]);
          response = response.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }

      return NextResponse.json({
        response,
        threadId: thread.id,
        botConfig
      });
    }

    return NextResponse.json({
      response: 'Извините, произошла ошибка при обработке запроса.',
      threadId: thread.id
    });

  } catch (error) {
    console.error('Error in bot-creator API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { botConfig, files } = await request.json();

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

    // Создаем нового ассистента в OpenAI
    const assistant = await openai.beta.assistants.create({
      name: botConfig.name,
      instructions: botConfig.instructions,
      model: 'gpt-4-turbo-preview',
      tools: [{ type: 'file_search' }],
      ...(files && files.length > 0 && {
        tool_resources: {
          file_search: {
            vector_store_ids: files
          }
        }
      })
    });

    // Сохраняем бота в базе данных
    const savedBot = await prisma.bot.create({
      data: {
        name: botConfig.name,
        description: botConfig.description,
        instructions: botConfig.instructions,
        personality: botConfig.personality,
        specialization: botConfig.specialization,
        openaiId: assistant.id,
        userId: decoded.userId
      }
    });

    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      botId: savedBot.id,
      botConfig
    });

  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    );
  }
}