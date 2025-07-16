import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { promises as fs } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Локальное хранилище из route.ts
import { localDocuments } from '../route';

// Функция для получения пользователя из токена
function getUserFromToken(request: NextRequest): { userId: number } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as any;
    return { userId: decoded.userId };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId,
      },
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    const docs = localDocuments[knowledgeBaseId] || [];
    const doc = docs.find((d) => d.id === params.fileId);

    if (doc) {
      try {
        const data = await fs.readFile(doc.filePath);
        return new NextResponse(data, {
          status: 200,
          headers: {
            'Content-Type': doc.type ? `application/${doc.type}` : 'application/octet-stream',
            'Content-Disposition': `inline; filename="${doc.name}"`,
          },
        });
      } catch (e) {
        console.error('Error reading local file:', e);
      }
    }

    try {
      if (!dbKnowledgeBase.vectorStoreId) {
        throw new Error('No vector store ID available');
      }

      const fileRes: any = await openai.files.retrieveContent(params.fileId);
      const arrayBuffer = await fileRes.arrayBuffer();

      return new NextResponse(Buffer.from(arrayBuffer), {
        status: 200,
        headers: {
          'Content-Type': fileRes.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${params.fileId}"`,
        },
      });
    } catch (vectorStoreError) {
      console.log(
        'Vector stores API not available and local file missing:',
        vectorStoreError
      );
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching document content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document content' },
      { status: 500 }
    );
  }
}
