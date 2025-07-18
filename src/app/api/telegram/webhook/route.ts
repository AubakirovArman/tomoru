import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';
import { checkQuickReply } from '@/lib/quickReplies';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    voice?: {
      file_id: string;
      mime_type?: string;
    };
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
    
    const { message } = update;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    let userMessage: string | null = message?.text || null;

    if (!userMessage && message?.voice) {
      try {
        const getFileResp = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.voice.file_id}`
        );
        if (getFileResp.ok) {
          const fileData = await getFileResp.json();
          const filePath = fileData.result.file_path;
          const fileResp = await fetch(
            `https://api.telegram.org/file/bot${botToken}/${filePath}`
          );
          if (fileResp.ok) {
            const buffer = await fileResp.arrayBuffer();
            const file = new File([
              buffer
            ], filePath.split('/').pop() || 'voice.ogg', {
              type: message.voice.mime_type || 'audio/ogg'
            });
            const transcription = await openai.audio.transcriptions.create({
              file,
              model: 'whisper-1'
            });
            userMessage = transcription.text;
          }
        }
      } catch (e) {
        console.error('Voice transcription error:', e);
      }
    }

    if (!userMessage) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    
    // Создаем или обновляем Telegram пользователя
    const telegramUser = await prisma.telegramUser.upsert({
      where: {
        telegramId: BigInt(message.from.id)
      },
      update: {
        username: message.from.username || null,
        firstName: message.from.first_name,
        lastName: message.from.last_name || null
      },
      create: {
        telegramId: BigInt(message.from.id),
        username: message.from.username || null,
        firstName: message.from.first_name,
        lastName: message.from.last_name || null
      }
    });
    
    // Проверяем быстрые ответы перед обращением к OpenAI
    const quickReplyAnswer = await checkQuickReply(bot.id, userMessage);
    
    if (quickReplyAnswer) {
      // Отправляем быстрый ответ
      const sentMessage = await sendTelegramMessage(botToken, chatId, quickReplyAnswer);
      
      // Сохраняем сообщения в базу данных
      await prisma.message.create({
        data: {
          content: userMessage,
          messageType: 'USER',
          botId: bot.id,
          telegramUserId: telegramUser.id,
          telegramMessageId: BigInt(message.message_id),
          threadId: null
        }
      });
      
      if (sentMessage) {
        await prisma.message.create({
          data: {
            content: quickReplyAnswer,
            messageType: 'BOT',
            botId: bot.id,
            telegramUserId: telegramUser.id,
            telegramMessageId: BigInt(sentMessage.message_id),
            threadId: null
          }
        });
      }
      
      return NextResponse.json({ ok: true });
    }
    
    // Получаем ассистента OpenAI
    if (!bot.openaiId) {
      await sendTelegramMessage(botToken, chatId, 'Бот не настроен правильно. Обратитесь к администратору.');
      return NextResponse.json({ ok: true });
    }
    
    try {
      // Создаем thread для пользователя (можно кэшировать по chatId)
      const thread = await openai.beta.threads.create();
      
      // Сохраняем сообщение пользователя в базу данных
      await prisma.message.create({
        data: {
          content: userMessage,
          messageType: 'USER',
          botId: bot.id,
          telegramUserId: telegramUser.id,
          telegramMessageId: BigInt(message.message_id),
          threadId: thread.id
        }
      });
      
      // Добавляем сообщение пользователя с инструкцией отвечать на том же языке
      const messageWithLanguageInstruction = `${userMessage}

[IMPORTANT INSTRUCTION: Always respond in the same language as the user's message above. If the user writes in Russian - respond in Russian, if in English - respond in English, if in another language - respond in that same language.]`;
      
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: messageWithLanguageInstruction
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
          
          // Отправляем ответ в Telegram
          const sentMessage = await sendTelegramMessage(botToken, chatId, responseText);
          
          // Сохраняем ответ бота в базу данных
          if (sentMessage) {
            await prisma.message.create({
              data: {
                content: responseText,
                messageType: 'BOT',
                botId: bot.id,
                telegramUserId: telegramUser.id,
                telegramMessageId: BigInt(sentMessage.message_id),
                threadId: thread.id
              }
            });
          }
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
        text: text
        // Removed parse_mode to avoid Markdown parsing errors
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send Telegram message:', errorText);
      return null;
    }
    
    const result = await response.json();
    return result.result; // Возвращаем информацию об отправленном сообщении
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}