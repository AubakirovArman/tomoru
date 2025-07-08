import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Assistant id is required' }, { status: 400 });
  }

  try {
    const assistant = await openai.beta.assistants.retrieve(id);
    let files: { id: string; filename: string; bytes: number }[] = [];
    const vectorIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
    for (const vsId of vectorIds) {
      const list = await openai.beta.vectorStores.files.list(vsId);
      for (const f of list.data) {
        files.push({ id: f.id, filename: f.filename, bytes: f.bytes });
      }
    }
    return NextResponse.json({ assistant, files });
  } catch (error) {
    console.error('Error retrieving assistant:', error);
    return NextResponse.json({ error: 'Failed to retrieve assistant' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { assistantId, data, files } = await request.json();

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant id is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверяем, принадлежит ли ассистент пользователю
    const bot = await prisma.bot.findFirst({ where: { openaiId: assistantId, userId: decoded.userId } });
    if (!bot) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let vectorStoreId: string | undefined;
    if (files && files.length > 0) {
      const store = await openai.beta.vectorStores.create({ file_ids: files });
      vectorStoreId = store.id;
      data.tools = [
        ...(data.tools || []),
        { type: 'file_search' }
      ];
      data.tool_resources = { file_search: { vector_store_ids: [vectorStoreId] } };
    }

    const assistant = await openai.beta.assistants.update(assistantId, data);
    return NextResponse.json({ assistant });
  } catch (error) {
    console.error('Error updating assistant:', error);
    return NextResponse.json({ error: 'Failed to update assistant' }, { status: 500 });
  }
}
