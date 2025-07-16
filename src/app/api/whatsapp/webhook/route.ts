import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

let whatsappClient: Client | null = null;

function initClient() {
  if (whatsappClient) return;

  whatsappClient = new Client({
    authStrategy: new LocalAuth(),
  });

  whatsappClient.on('qr', (qr: string) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan QR code to log in to WhatsApp');
  });

  whatsappClient.on('ready', () => {
    console.log('WhatsApp client is ready');
  });

  whatsappClient.on('message', handleMessage);

  whatsappClient.initialize();
}

async function handleMessage(message: Message) {
  if (!whatsappClient) return;

  const botIdEnv = process.env.WHATSAPP_BOT_ID;
  if (!botIdEnv) {
    console.error('WHATSAPP_BOT_ID env variable not set');
    return;
  }
  const botId = parseInt(botIdEnv);
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot || !bot.openaiId) return;

  const contact = await message.getContact();
  const whatsappId = contact.id._serialized;
  const pushName = contact.pushname || null;

  const whatsappUser = await prisma.whatsAppUser.upsert({
    where: { whatsappId },
    update: { pushName },
    create: { whatsappId, pushName },
  });

  let userMessage: string | null = message.body || null;

  if (!userMessage && message.hasMedia && (message.type === 'ptt' || message.type === 'audio')) {
    try {
      const media = await message.downloadMedia();
      if (media) {
        const buffer = Buffer.from(media.data, 'base64');
        const file = new File([buffer], 'voice.ogg', { type: media.mimetype || 'audio/ogg' });
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
        });
        userMessage = transcription.text;
      }
    } catch (e) {
      console.error('Voice transcription error:', e);
    }
  }

  if (!userMessage) return;

  try {
    const thread = await openai.beta.threads.create();
    await prisma.message.create({
      data: {
        content: userMessage,
        messageType: 'USER',
        botId: bot.id,
        whatsappUserId: whatsappUser.id,
        whatsappMessageId: message.id._serialized,
        threadId: thread.id,
      },
    });

    const messageWithLanguageInstruction = `${userMessage}\n\n[IMPORTANT INSTRUCTION: Always respond in the same language as the user's message above. If the user writes in Russian - respond in Russian, if in English - respond in English, if in another language - respond in that same language.]`;

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: messageWithLanguageInstruction,
    });

    const runResponse = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: bot.openaiId,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
    }

    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data[0];
      if (assistantMessage.content[0].type === 'text') {
        const responseText = (assistantMessage.content[0] as any).text.value;
        const sent = await whatsappClient.sendMessage(message.from, responseText);
        await prisma.message.create({
          data: {
            content: responseText,
            messageType: 'BOT',
            botId: bot.id,
            whatsappUserId: whatsappUser.id,
            whatsappMessageId: sent.id._serialized,
            threadId: thread.id,
          },
        });
      }
    } else {
      await whatsappClient.sendMessage(message.from, 'Произошла ошибка при обработке запроса.');
    }
  } catch (error) {
    console.error('OpenAI error:', error);
    await whatsappClient.sendMessage(message.from, 'Произошла ошибка при обработке запроса.');
  }
}

export async function GET() {
  initClient();
  return NextResponse.json({ status: 'WhatsApp client initialized' });
}
