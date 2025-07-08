import { NextRequest, NextResponse } from 'next/server';
import { getBotFatherAssistant, openai } from '@/lib/assistant';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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

    // Получаем ассистента "Бот-Отец"
    let assistant;
    try {
      assistant = await getBotFatherAssistant();
    } catch (error) {
      console.error('Error with assistant:', error);
      return NextResponse.json(
        { error: 'Failed to get assistant' },
        { status: 500 }
      );
    }

    // Запускаем ассистента
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });

    // Ждем завершения
    let runStatus = run;
    
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued' || runStatus.status === 'requires_action') {
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

    if (runStatus.status === 'completed' || runStatus.status === 'requires_action') {
      // Проверяем, требуется ли выполнение функций
      if (runStatus.required_action?.type === 'submit_tool_outputs') {
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          if (toolCall.type === 'function' && toolCall.function.name === 'create_bot_config') {
            try {
              const botConfig = JSON.parse(toolCall.function.arguments);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ success: true, config_received: true })
              });
              
              // Отправляем результаты функций
              await openai.beta.threads.runs.submitToolOutputs(
                runStatus.id,
                {
                  thread_id: thread.id,
                  tool_outputs: toolOutputs
                }
              );
              
              // Ждем завершения после отправки результатов
              let finalRunStatus = runStatus;
              while (finalRunStatus.status === 'in_progress' || finalRunStatus.status === 'queued') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                  const runs = await openai.beta.threads.runs.list(thread.id);
                  const currentRun = runs.data.find(r => r.id === runStatus.id);
                  if (currentRun) {
                    finalRunStatus = currentRun;
                  } else {
                    break;
                  }
                } catch (error) {
                  console.error('Error retrieving final run status:', error);
                  break;
                }
              }
              
              // Получаем финальное сообщение
              const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
              const lastMessage = messages.data.find((msg: any) => msg.role === 'assistant');
              
              let response = '';
              if (lastMessage?.content[0]?.type === 'text') {
                response = lastMessage.content[0].text.value;
              } else {
                response = 'Конфигурация бота создана успешно!';
              }
              
              return NextResponse.json({
                response,
                threadId: thread.id,
                botConfig
              });
            } catch (error) {
              console.error('Error parsing bot config from function call:', error);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ success: false, error: 'Invalid config format' })
              });
            }
          }
        }
      }
      
      // Обычное сообщение без вызова функций
      const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
      const lastMessage = messages.data.find((msg: any) => msg.role === 'assistant');
      
      let response = '';
      if (lastMessage?.content[0]?.type === 'text') {
        response = lastMessage.content[0].text.value;
      } else {
        response = 'Извините, произошла ошибка.';
      }

      return NextResponse.json({
        response,
        threadId: thread.id,
        botConfig: null
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
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }]
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