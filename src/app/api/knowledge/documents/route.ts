import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Локальное хранилище для документов. Здесь сохраняем метаданные
// и путь к локально сохранённому файлу, чтобы можно было
// просматривать и скачивать файл независимо от OpenAI
export let localDocuments: {
  [knowledgeBaseId: string]: (Document & { filePath: string })[]
} = {};

// Функция для получения пользователя из токена
function getUserFromToken(request: NextRequest): { userId: number } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return { userId: decoded.userId };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
}

// Простейшая функция конвертации HTML в Markdown
function htmlToMarkdown(html: string): string {
  return html
    .replace(/\r?\n|\r/g, ' ')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>(?=\s*)/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function arrayToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const header = rows[0].map((c) => c.trim());
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows.slice(1)) {
    lines.push(`| ${row.map((c) => c.trim()).join(' | ')} |`);
  }
  return lines.join('\n');
}

function csvToMarkdown(csv: string): string {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(','));
  return arrayToMarkdownTable(rows);
}

async function excelBufferToMarkdown(buffer: Buffer): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-'));
  const filePath = path.join(tmpDir, 'file.xlsx');
  await fs.writeFile(filePath, buffer);
  try {
    const { stdout: sheetXml } = await execFileAsync('unzip', [
      '-p',
      filePath,
      'xl/worksheets/sheet1.xml',
    ]);
    let sharedStrings: string[] = [];
    try {
      const { stdout: sharedXml } = await execFileAsync('unzip', [
        '-p',
        filePath,
        'xl/sharedStrings.xml',
      ]);
      const matches = sharedXml.match(/<t[^>]*>(.*?)<\/t>/g) || [];
      sharedStrings = matches.map((m) => m.replace(/<[^>]+>/g, ''));
    } catch {}

    const rowMatches = sheetXml.match(/<row[^>]*>.*?<\/row>/gs) || [];
    const rows: string[][] = [];
    for (const r of rowMatches) {
      const cells = r.match(/<c[^>]*>.*?<\/c>/gs) || [];
      const row: string[] = [];
      for (const c of cells) {
        let v = '';
        const vMatch = c.match(/<v[^>]*>(.*?)<\/v>/);
        if (vMatch) {
          v = vMatch[1];
          if (c.includes('t="s"')) {
            v = sharedStrings[parseInt(v, 10)] || '';
          }
        } else {
          const tMatch = c.match(/<t[^>]*>(.*?)<\/t>/);
          if (tMatch) v = tMatch[1];
        }
        row.push(v);
      }
      rows.push(row);
    }
    return arrayToMarkdownTable(rows);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// GET - получить документы базы знаний
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    const documents = [...(localDocuments[knowledgeBaseId] || [])];

    try {
      if (openai.vectorStores && dbKnowledgeBase.vectorStoreId) {
        const remoteList = await (openai as any).vectorStores.files.list(
          dbKnowledgeBase.vectorStoreId
        );
        for (const fileRef of remoteList.data || []) {
          const fileId = fileRef.file_id || fileRef.id;
          if (!documents.find((d) => d.id === fileId)) {
            try {
              const meta = await openai.files.retrieve(fileId);
              documents.push({
                id: meta.id,
                name: meta.filename,
                type: path.extname(meta.filename).replace('.', '') || 'unknown',
                size: `${Math.round((meta.bytes / 1024) * 100) / 100} KB`,
                uploadDate: new Date(meta.created_at * 1000).toLocaleDateString(
                  'ru-RU'
                ),
                status: 'processed',
              });
            } catch (e) {
              console.error('Error retrieving remote file metadata:', e);
            }
          }
        }
      }
    } catch (e) {
      console.log('Vector stores API not available:', e);
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST - загрузить документ в базу знаний
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const knowledgeBaseId = formData.get('knowledgeBaseId') as string;
    const url = formData.get('url');
    let file = formData.get('file') as File | null;

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    if (url && typeof url === 'string' && url.length > 0) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch URL');
        }

        const urlPath = new URL(url).pathname;
        const ext = path.extname(urlPath).toLowerCase();

        if (['.pdf', '.txt', '.md', '.doc', '.docx'].includes(ext)) {
          const arrayBuffer = await response.arrayBuffer();
          const contentType =
            response.headers.get('content-type') ||
            (ext === '.pdf'
              ? 'application/pdf'
              : ext === '.txt'
              ? 'text/plain'
              : ext === '.md'
              ? 'text/markdown'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          file = new File([arrayBuffer], path.basename(urlPath), { type: contentType });
        } else if (ext === '.csv') {
          const text = await response.text();
          const markdown = csvToMarkdown(text);
          file = new File([
            markdown,
          ], path.basename(urlPath).replace(ext, '.md'), { type: 'text/markdown' });
        } else if (ext === '.xls' || ext === '.xlsx') {
          const buffer = Buffer.from(await response.arrayBuffer());
          const markdown = await excelBufferToMarkdown(buffer);
          file = new File([
            markdown,
          ], path.basename(urlPath).replace(ext, '.md'), { type: 'text/markdown' });
        } else {
          const html = await response.text();
          const markdown = htmlToMarkdown(html);
          file = new File([markdown], 'document.md', { type: 'text/markdown' });
        }
      } catch (e) {
        console.error('Error processing URL:', e);
        return NextResponse.json(
          { error: 'Failed to download or convert URL' },
          { status: 400 }
        );
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: txt, md, pdf, doc, docx' },
        { status: 400 }
      );
    }

    const fileName = file.name;
    let document: Document;
    let fileId: string | null = null;

    try {
      const uploadedFile = await openai.files.create({
        file: file,
        purpose: 'assistants'
      });

      if (dbKnowledgeBase.vectorStoreId) {
        await openai.vectorStores.files.create(dbKnowledgeBase.vectorStoreId, {
          file_id: uploadedFile.id
        });
      } else {
        throw new Error('No vector store ID available');
      }

      fileId = uploadedFile.id;
      document = {
        id: uploadedFile.id,
        name: fileName,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round((file.size / 1024) * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processing'
      };
    } catch (vectorStoreError) {
      console.log('Vector stores API not available, saving locally:', vectorStoreError);

      const localId = `doc_${Date.now()}`;
      fileId = localId;
      document = {
        id: localId,
        name: fileName,
        type: file.type.split('/')[1] || 'unknown',
        size: `${Math.round((file.size / 1024) * 100) / 100} KB`,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        status: 'processed'
      };
    }

    // Сохраняем файл локально для последующего просмотра и скачивания
    const uploadsDir = path.join(process.cwd(), 'uploads', knowledgeBaseId);
    await fs.mkdir(uploadsDir, { recursive: true });
    const localFileName = `${fileId}_${fileName}`;
    const filePath = path.join(uploadsDir, localFileName);
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    if (!localDocuments[knowledgeBaseId]) {
      localDocuments[knowledgeBaseId] = [];
    }
    localDocuments[knowledgeBaseId].push({
      ...document,
      filePath
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// DELETE - удалить документ из базы знаний
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!fileId || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File ID and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Проверяем, принадлежит ли база знаний пользователю
    const dbKnowledgeBase = await prisma.KnowledgeBase.findFirst({
      where: {
        id: parseInt(knowledgeBaseId),
        userId: user.userId
      }
    });

    if (!dbKnowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    try {
      if (dbKnowledgeBase.vectorStoreId) {
        await openai.vectorStores.files.delete(fileId, {
          vector_store_id: dbKnowledgeBase.vectorStoreId
        });
        await openai.files.delete(fileId);
      } else {
        throw new Error('No vector store ID available');
      }
    } catch (vectorStoreError) {
      console.log('Vector stores API not available or file only stored locally:', vectorStoreError);
    }

    if (localDocuments[knowledgeBaseId]) {
      const remaining = [] as (Document & { filePath: string })[];
      for (const doc of localDocuments[knowledgeBaseId]) {
        if (doc.id === fileId) {
          try {
            await fs.unlink(doc.filePath);
          } catch (e) {
            console.error('Error deleting local file:', e);
          }
        } else {
          remaining.push(doc);
        }
      }
      localDocuments[knowledgeBaseId] = remaining;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
