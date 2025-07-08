import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BOT_FATHER_INSTRUCTIONS = `
Ты — AI-конструктор "Бот-Отец". Твоя задача — шаг за шагом собрать информацию о компании пользователя, чтобы на основе этих данных создать конфигурацию AI-ассистента.

🎯 Цель:
Создать конфигурацию AI-бота, который сможет самостоятельно представлять бизнес, помогать клиентам и отвечать на вопросы. Ты собираешь данные через диалог и в конце используешь функцию create_bot_config.

📌 Как работать:
- Задавай ТОЛЬКО один вопрос за раз и жди ответ.
- Спрашивай просто, без технических терминов.
- Не переходи к следующему вопросу, пока не получен ответ.
- Если пользователь загрузил файл — учти его как основу для базы знаний.
- В конце обязательно спроси: **"Есть ли у вас файл, который бот должен использовать как базу знаний?"**

🧠 Что нужно узнать:
1. Как называется компания и чем она занимается?
2. Кто будет основными пользователями бота? (клиенты, сотрудники, партнёры и т.д.)
3. Зачем вам бот? Какие задачи он должен решать?
4. Как бот должен общаться? (формально, дружелюбно, профессионально и т.д.)
5. Какие услуги или продукты вы предоставляете?
6. Что именно должен уметь делать бот? (например: показывать цены, записывать на консультацию, отвечать на вопросы)
7. Есть ли какие-то особые требования или пожелания?
8. Хотите ли добавить примеры фраз, с которыми будет работать бот?
9. Есть ли документ или файл, который использовать как базу знаний?

💬 Стиль общения:
- Дружелюбный, простой и профессиональный.
- Используй "Вы".
- Объясняй непонятное понятным языком.
- Если нужно — переформулируй.

📄 Финальный результат:
Когда все ответы получены, ОБЯЗАТЕЛЬНО используй функцию create_bot_config с собранными данными. Не пиши JSON в тексте - используй только функцию!

**ВАЖНО**: После сбора всей информации вызови функцию create_bot_config с параметрами:
- name: название бота
- description: краткое описание (1-2 предложения)
- instructions: подробная инструкция на английском языке
- personality: тип личности (дружелюбный/профессиональный/формальный)
- specialization: область специализации
`;

// Кэшируем ID ассистента
let cachedAssistantId: string | null = null;

const CREATE_BOT_CONFIG_FUNCTION = {
  type: "function" as const,
  function: {
    name: "create_bot_config",
    description: "Создает конфигурацию для нового AI-бота на основе собранной информации",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Название бота"
        },
        description: {
          type: "string",
          description: "Краткое описание бота (1-2 предложения)"
        },
        instructions: {
          type: "string",
          description: "Подробная инструкция для бота на английском языке"
        },
        personality: {
          type: "string",
          description: "Тип личности бота (дружелюбный/профессиональный/формальный)"
        },
        specialization: {
          type: "string",
          description: "Область специализации бота"
        }
      },
      required: ["name", "description", "instructions", "personality", "specialization"]
    }
  }
};

export async function getBotFatherAssistant() {
  // Если есть кэшированный ID, пытаемся получить ассистента
  if (cachedAssistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(cachedAssistantId);
      
      // Проверяем, нужно ли обновить инструкции
      if (assistant.instructions !== BOT_FATHER_INSTRUCTIONS) {
        console.log('Updating assistant instructions');
        const updatedAssistant = await openai.beta.assistants.update(cachedAssistantId, {
          instructions: BOT_FATHER_INSTRUCTIONS,
          tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
        });
        return updatedAssistant;
      }
      
      return assistant;
    } catch (error) {
      console.log('Cached assistant not found, creating new one');
      cachedAssistantId = null;
    }
  }

  // Пытаемся найти существующего ассистента
  try {
    const assistants = await openai.beta.assistants.list();
    const existingAssistant = assistants.data.find(a => a.name === 'Bot Father');
    
    if (existingAssistant) {
      cachedAssistantId = existingAssistant.id;
      
      // Проверяем и обновляем инструкции если нужно
      if (existingAssistant.instructions !== BOT_FATHER_INSTRUCTIONS) {
        console.log('Updating existing assistant instructions');
        const updatedAssistant = await openai.beta.assistants.update(existingAssistant.id, {
          instructions: BOT_FATHER_INSTRUCTIONS,
          tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
        });
        return updatedAssistant;
      }
      
      return existingAssistant;
    }
  } catch (error) {
    console.error('Error listing assistants:', error);
  }

  // Создаем нового ассистента
  try {
    const assistant = await openai.beta.assistants.create({
      name: 'Bot Father',
      instructions: BOT_FATHER_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
    });
    
    cachedAssistantId = assistant.id;
    return assistant;
  } catch (error) {
    console.error('Error creating assistant:', error);
    throw error;
  }
}

export { openai };