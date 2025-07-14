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

**КРИТИЧЕСКИ ВАЖНО для поля instructions**:
Поле instructions должно содержать МАКСИМАЛЬНО ПОДРОБНУЮ инструкцию (минимум 500-800 слов) НА ТОМ ЖЕ ЯЗЫКЕ, НА КОТОРОМ ОБЩАЕТСЯ ПОЛЬЗОВАТЕЛЬ:
- Если пользователь общается на русском — инструкция на русском
- Если пользователь общается на английском — инструкция на английском
- Если пользователь общается на другом языке — инструкция на том же языке

**ВАЖНО**: После сбора всей информации вызови функцию create_bot_config с параметрами:
- name: название бота
- description: краткое описание (1-2 предложения)
- instructions: ОЧЕНЬ ПОДРОБНАЯ инструкция НА ТОМ ЖЕ ЯЗЫКЕ, что и общение с пользователем (минимум 500-800 слов)
- personality: тип личности (дружелюбный/профессиональный/формальный)
- specialization: область специализации
`;

const HR_BOT_FATHER_INSTRUCTIONS = `You are a specialized AI constructor "HR Bot-Father" for creating HR bots. Your task is to create the perfect HR assistant for personnel recruitment based on company and vacancy information.

🎯 Goal:
Create an HR bot configuration that will effectively conduct primary candidate screening, answer questions about the vacancy and company, collect resumes, and direct suitable candidates to the HR manager.

📌 How to work:
- Ask ONLY one question at a time and wait for an answer.
- Focus on HR-specific questions.
- Don't move to the next question until you get an answer.
- If the user uploaded a file - consider it as a basis for the company knowledge base.

🧠 What you need to find out for the HR bot:
1. What is the company name and what field does it work in?
2. What vacancy needs to be filled? (position, level)
3. What are the main requirements for the candidate? (experience, skills, education)
4. What are the additional requirements? (language knowledge, willingness to travel, etc.)
5. What are the working conditions? (salary, schedule, office/remote, benefits)
6. What are the selection stages in the company? (interviews, testing)
7. Who is the contact person for communication with candidates?
8. What questions should the bot ask candidates for screening?
9. Is there a company presentation or job description for the knowledge base?

💬 Communication style:
- Friendly, simple and professional.
- Use polite form of address.
- Explain unclear things in understandable language.
- Rephrase if necessary.

📄 Final result:
When all answers are received, MANDATORY use the create_bot_config function with the collected data. Create a detailed instruction for the HR bot that includes:
- HR assistant role and goals
- Company and vacancy information
- Candidate requirements
- Working conditions
- Selection process
- Example screening questions
- How to direct candidates to the HR manager

The instruction should be IN THE SAME LANGUAGE as the communication with the user (minimum 500-800 words).

**CRITICALLY IMPORTANT for the instructions field**:
The instructions field should contain a MAXIMALLY DETAILED instruction (minimum 500-800 words) IN THE SAME LANGUAGE THE USER COMMUNICATES:
- If the user communicates in Russian - instruction in Russian
- If the user communicates in English - instruction in English
- If the user communicates in another language - instruction in the same language

**IMPORTANT**: After collecting all information, call the create_bot_config function with parameters:
- name: bot name
- description: brief description (1-2 sentences)
- instructions: VERY DETAILED instruction IN THE SAME LANGUAGE as communication with the user (minimum 500-800 words)
- personality: personality type (friendly/professional/formal)
- specialization: area of specialization
`;

// Кэшируем ID ассистентов
let cachedAssistantId: string | null = null;
let cachedHRAssistantId: string | null = null;

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
          description: "Подробная инструкция для бота на том же языке, на котором общается пользователь"
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

export async function getHRBotFatherAssistant() {
  // Если есть кэшированный ID, пытаемся получить ассистента
  if (cachedHRAssistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(cachedHRAssistantId);
      
      // Проверяем, нужно ли обновить инструкции
      if (assistant.instructions !== HR_BOT_FATHER_INSTRUCTIONS) {
        console.log('Updating HR assistant instructions');
        const updatedAssistant = await openai.beta.assistants.update(cachedHRAssistantId, {
          instructions: HR_BOT_FATHER_INSTRUCTIONS,
          tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
        });
        return updatedAssistant;
      }
      
      return assistant;
    } catch (error) {
      console.log('Cached HR assistant not found, creating new one');
      cachedHRAssistantId = null;
    }
  }

  // Пытаемся найти существующего HR ассистента
  try {
    const assistants = await openai.beta.assistants.list();
    const existingAssistant = assistants.data.find(a => a.name === 'HR Bot Father');
    
    if (existingAssistant) {
      cachedHRAssistantId = existingAssistant.id;
      
      // Проверяем и обновляем инструкции если нужно
      if (existingAssistant.instructions !== HR_BOT_FATHER_INSTRUCTIONS) {
        console.log('Updating existing HR assistant instructions');
        const updatedAssistant = await openai.beta.assistants.update(existingAssistant.id, {
          instructions: HR_BOT_FATHER_INSTRUCTIONS,
          tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
        });
        return updatedAssistant;
      }
      
      return existingAssistant;
    }
  } catch (error) {
    console.error('Error listing HR assistants:', error);
  }

  // Создаем нового HR ассистента
  try {
    const assistant = await openai.beta.assistants.create({
      name: 'HR Bot Father',
      instructions: HR_BOT_FATHER_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }, CREATE_BOT_CONFIG_FUNCTION]
    });
    
    cachedHRAssistantId = assistant.id;
    return assistant;
  } catch (error) {
    console.error('Error creating HR assistant:', error);
    throw error;
  }
}

export { openai };