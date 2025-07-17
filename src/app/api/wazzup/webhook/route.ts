import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/assistant';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const channelId = payload.channelId;
    const text: string | undefined = payload.text;
    const contactId = payload.contactId || payload.phone;

    if (!channelId || !text || !contactId) {
      return NextResponse.json({ ok: true });
    }

    const bot = await prisma.bot.findFirst({ where: { wazzupChannelId: channelId } });

    if (!bot || !bot.openaiId || !bot.wazzupApiKey) {
      return NextResponse.json({ ok: true });
    }

    const whatsappUser = await prisma.whatsAppUser.upsert({
      where: { whatsappId: String(contactId) },
      update: {},
      create: { whatsappId: String(contactId), pushName: null }
    });

    const thread = await openai.beta.threads.create();
    await prisma.message.create({
      data: {
        content: text,
        messageType: 'USER',
        botId: bot.id,
        whatsappUserId: whatsappUser.id,
        threadId: thread.id
      }
    });

    const messageWithLanguageInstruction = `${text}\n\n[IMPORTANT INSTRUCTION: Always respond in the same language as the user's message above. If the user writes in Russian - respond in Russian, if in English - respond in English, if in another language - respond in that same language.]`;

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: messageWithLanguageInstruction
    });

    const runResponse = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: bot.openaiId
    });

    let runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(runResponse.id, { thread_id: thread.id });
    }

    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data[0];
      if (assistantMessage.content[0].type === 'text') {
        const responseText = assistantMessage.content[0].text.value;
        await fetch('https://api.wazzup24.com/v3/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bot.wazzupApiKey}`
          },
          body: JSON.stringify({
            channelId: bot.wazzupChannelId,
            phone: contactId,
            text: responseText
          })
        });
        await prisma.message.create({
          data: {
            content: responseText,
            messageType: 'BOT',
            botId: bot.id,
            whatsappUserId: whatsappUser.id,
            threadId: thread.id
          }
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Wazzup webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
