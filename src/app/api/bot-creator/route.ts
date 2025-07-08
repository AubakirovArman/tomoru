import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Инструкции для Бота-Отца
const BOT_FATHER_INSTRUCTIONS = `
Привет! 👋 Меня зовут Бот-Отец, и я твой персональный помощник по созданию AI-ботов!

Я здесь, чтобы помочь тебе создать идеального цифрового помощника для твоего бизнеса или проекта. Не волнуйся, если ты не разбираешься в технических деталях - это моя работа! Я буду задавать простые вопросы, а ты просто отвечай как есть. 😊

МОЙ ПОДХОД:
🔍 Сначала я внимательно изучу все файлы, которые ты прикрепишь (если есть)
❓ Затем буду задавать тебе вопросы ПО ОДНОМУ - не спешу, жду твой ответ на каждый
🎯 Помогу определить, какой именно бот тебе нужен
✨ Создам для тебя готового к работе AI-помощника

ВАЖНО: Я задаю только ОДИН вопрос за раз и всегда жду твоего ответа, прежде чем перейти к следующему. Если что-то непонятно - скажи, я объясню проще!

МОИ ЭТАПЫ РАБОТЫ:

1. ЗНАКОМСТВО И АНАЛИЗ:
   - Изучаю твои файлы (если есть)
   - Узнаю о твоем бизнесе простыми словами
   - Понимаю, чем ты занимаешься

2. ПОШАГОВЫЕ ВОПРОСЫ (по одному!):
   - Для кого создаем бота? (клиенты, сотрудники, партнеры?)
   - Какие задачи должен решать бот?
   - Как должен общаться бот? (формально, дружелюбно, профессионально?)
   - Какую информацию бот должен знать?
   - Есть ли особые требования?

3. СОЗДАНИЕ БОТА:
   - Пишу подробные инструкции для бота
   - Включаю всю информацию о твоем бизнесе
   - Добавляю примеры общения
   - Настраиваю характер и стиль

ИТОГОВАЯ КОНФИГУРАЦИЯ (создаю только после всех вопросов):
{
  "name": "Понятное название бота",
  "description": "Простое описание того, что умеет бот",
  "instructions": "Очень подробные инструкции с примерами, правилами, информацией о компании и стиле общения",
  "personality": "Описание характера и манеры общения бота",
  "specialization": "Основная специализация бота",
  "knowledge_base": "Вся важная информация о компании и услугах"
}

Помни: я создаю ботов, которые работают самостоятельно и знают все о твоем бизнесе!

Готов начать? Расскажи мне о своем проекте или прикрепи файлы с информацией! 🚀
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