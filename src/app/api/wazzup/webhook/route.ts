import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('Wazzup webhook received:', JSON.stringify(payload, null, 2));
    
    if (payload.test) {
      // Wazzup sends a test request when setting up webhooks
      console.log('Wazzup test webhook received');
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(payload.messages)) {
      console.log('Processing messages array:', payload.messages.length, 'messages');
      const channelId = payload.messages[0]?.channelId;
      console.log('Looking for bot with channelId:', channelId);
      
      const bot = await prisma.bot.findFirst({ where: { wazzupChannelId: channelId } });
      console.log('Found bot:', bot ? `ID: ${bot.id}, Name: ${bot.name}` : 'Not found');
      
      if (!bot || !bot.openaiId || !bot.wazzupApiKey) {
        console.log('Bot validation failed:', {
          botExists: !!bot,
          hasOpenaiId: !!bot?.openaiId,
          hasWazzupApiKey: !!bot?.wazzupApiKey
        });
        return NextResponse.json({ ok: true });
      }
      
      for (const message of payload.messages) {
        console.log('Processing message:', message);
        await handleMessage(message, bot);
      }
      return NextResponse.json({ ok: true });
    }

    console.log('Processing single message with channelId:', payload.channelId);
    const bot = await prisma.bot.findFirst({ where: { wazzupChannelId: payload.channelId } });
    console.log('Found bot for single message:', bot ? `ID: ${bot.id}, Name: ${bot.name}` : 'Not found');

    if (!bot || !bot.openaiId || !bot.wazzupApiKey) {
      console.log('Bot validation failed for single message:', {
        botExists: !!bot,
        hasOpenaiId: !!bot?.openaiId,
        hasWazzupApiKey: !!bot?.wazzupApiKey
      });
      return NextResponse.json({ ok: true });
    }

    await handleMessage(payload, bot);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Wazzup webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleMessage(payload: any, bot: any) {
  console.log('handleMessage called with payload:', payload);
  const channelId = payload.channelId;
  let text: string | undefined = payload.text;
  const contactId = payload.contactId || payload.phone || payload.chatId;

  if (payload.isEcho) {
    console.log('Ignoring echo message');
    return;
  }
  
  console.log('Message details:', {
    channelId,
    text,
    contactId,
    type: payload.type
  });

  if (!channelId || !contactId) {
    console.log('Missing channelId or contactId, skipping message');
    return;
  }

  if (!text && (payload.type === 'audio' || payload.type === 'voice' || payload.contentUri)) {
    const voiceUrl: string | undefined = payload.contentUri || payload.downloadUrl || payload.voiceUrl;
    if (voiceUrl) {
      try {
        const resp = await fetch(voiceUrl, { headers: { Authorization: `Bearer ${bot.wazzupApiKey}` } });
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          const file = new File([buffer], 'voice.ogg', { type: 'audio/ogg' });
          const transcription = await openai.audio.transcriptions.create({ file, model: 'whisper-1' });
          text = transcription.text;
        }
      } catch (e) {
        console.error('Voice transcription error:', e);
      }
    }
  }

  if (!text) {
    console.log('No text content found, skipping message');
    return;
  }
  
  console.log('Processing text message:', text);

  console.log('Creating/finding WhatsApp user for contactId:', contactId);
  const whatsappUser = await prisma.whatsAppUser.upsert({
    where: { whatsappId: String(contactId) },
    update: {},
    create: { whatsappId: String(contactId), pushName: null }
  });
  console.log('WhatsApp user:', whatsappUser.id);

  console.log('Creating OpenAI thread...');
  const thread = await openai.beta.threads.create();
  console.log('Thread created:', thread.id);
  
  console.log('Saving user message to database...');
  await prisma.message.create({
    data: {
      content: text,
      messageType: 'USER',
      botId: bot.id,
      whatsappUserId: whatsappUser.id,
      threadId: thread.id
    }
  });
  console.log('User message saved');

  const messageWithLanguageInstruction = `${text}\n\n[IMPORTANT INSTRUCTION: Always respond in the same language as the user's message above. If the user writes in Russian - respond in Russian, if in English - respond in English, if in another language - respond in that same language.]`;

  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: messageWithLanguageInstruction
  });

  console.log('Creating OpenAI run with assistant:', bot.openaiId);
  const runResponse = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: bot.openaiId
  });
  console.log('Run created:', runResponse.id);

  let runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
  while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
  }

  if (runStatus.status === 'completed') {
    console.log('Run completed, getting assistant response...');
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data[0];
    if (assistantMessage.content[0].type === 'text') {
      const responseText = assistantMessage.content[0].text.value;
      console.log('Assistant response:', responseText);
      
      console.log('Sending response to Wazzup24...');
      const wazzupResponse = await fetch('https://api.wazzup24.com/v3/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bot.wazzupApiKey}`
        },
        body: JSON.stringify({
          channelId: bot.wazzupChannelId,
          chatId: contactId,
          chatType: 'whatsapp',
          text: responseText
        })
      });
      
      if (wazzupResponse.ok) {
        console.log('Message sent to Wazzup24 successfully');
      } else {
        console.error('Failed to send message to Wazzup24:', wazzupResponse.status, await wazzupResponse.text());
      }
      
      console.log('Saving bot response to database...');
       await prisma.message.create({
         data: {
           content: responseText,
           messageType: 'BOT',
           botId: bot.id,
           whatsappUserId: whatsappUser.id,
           threadId: thread.id
         }
       });
       console.log('Bot response saved');
    }
  } else {
    console.log('Run failed with status:', runStatus.status);
  }
}
