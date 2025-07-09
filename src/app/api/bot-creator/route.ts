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
      
      // Проверяем активные запуски и ждем их завершения
      const runs = await openai.beta.threads.runs.list(thread.id);
      const activeRun = runs.data.find(run => 
        run.status === 'in_progress' || 
        run.status === 'queued' || 
        run.status === 'requires_action'
      );
      
      if (activeRun) {
        // Ждем завершения активного запуска
        let runStatus = activeRun;
        while (
          runStatus.status === 'in_progress' || 
          runStatus.status === 'queued' || 
          runStatus.status === 'requires_action'
        ) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            runStatus = await openai.beta.threads.runs.retrieve(activeRun.id, { thread_id: thread.id });
          } catch (error) {
            console.error('Error retrieving run status:', error);
            break;
          }
        }
      }
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
    
    // Ждем завершения или запроса на выполнение функций
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

    if (runStatus.status === 'completed' || runStatus.status === 'requires_action') {
      console.log('Run status:', runStatus.status);
      
      // Проверяем, требуется ли выполнение функций
      if (runStatus.required_action?.type === 'submit_tool_outputs') {
        console.log('Tool outputs required');
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        console.log('Tool calls:', toolCalls.length);
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          console.log('Processing tool call:', toolCall.function.name);
          if (toolCall.type === 'function' && toolCall.function.name === 'create_bot_config') {
            try {
              console.log('Bot config arguments:', toolCall.function.arguments);
              const botConfig = JSON.parse(toolCall.function.arguments);
              console.log('Parsed bot config:', botConfig);
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ success: true, config_received: true })
              });
              
              // Отправляем результаты функций
              console.log('Submitting tool outputs...');
              await openai.beta.threads.runs.submitToolOutputs(
                runStatus.id,
                {
                  thread_id: thread.id,
                  tool_outputs: toolOutputs
                }
              );
              
              // Ждем завершения после отправки результатов
              let finalRunStatus = runStatus;
              while (
                finalRunStatus.status === 'in_progress' ||
                finalRunStatus.status === 'queued'
              ) {
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
              
              console.log('Final run status:', finalRunStatus.status);
              
              // Получаем финальное сообщение
              const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
              const lastMessage = messages.data.find((msg: any) => msg.role === 'assistant');
              
              let response = '';
              if (lastMessage?.content[0]?.type === 'text') {
                response = lastMessage.content[0].text.value;
              } else {
                response = 'Конфигурация бота создана успешно!';
              }
              
              console.log('Returning bot config to frontend:', botConfig);
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
    console.log('Creating bot with config:', botConfig);

    // Проверяем аутентификацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Unauthorized request - missing or invalid auth header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('Invalid token provided');
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', decoded.userId);

    // Создаем нового ассистента в OpenAI
    console.log('Creating OpenAI assistant...');
    const assistantConfig: any = {
      name: botConfig.name,
      instructions: botConfig.instructions,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }]
    };

    // Если есть файлы, создаем vector store и прикрепляем их к ассистенту
    if (files && files.length > 0) {
      try {
        console.log('Creating vector store for files:', files);
        
        // Создаем vector store через основной API
        const vectorStore = await openai.vectorStores.create({
          name: `Files for ${botConfig.name || 'Assistant'}`,
          file_ids: files
        });
        
        console.log('Created vector store:', vectorStore.id);
        
        // Настраиваем tool_resources для file_search
        assistantConfig.tool_resources = {
          file_search: {
            vector_store_ids: [vectorStore.id]
          }
        };
      } catch (vectorError) {
        console.error('Error creating vector store:', vectorError);
        // Fallback: создаем ассистента без файлов
        console.log('Creating assistant without files due to vector store error');
      }
    }

    const assistant = await openai.beta.assistants.create(assistantConfig);
    console.log('OpenAI assistant created:', assistant.id);

    // Сохраняем бота в базе данных
    console.log('Saving bot to database...');
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
    console.log('Bot saved to database:', savedBot.id);

    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      botId: savedBot.id,
      botConfig
    });

  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: `Failed to create bot: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}