import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { botId, webhookUrl } = await request.json();
    if (!botId || !webhookUrl) {
      return NextResponse.json({ error: 'botId and webhookUrl are required' }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: decoded.userId }
    });

    if (!bot || !bot.wazzupApiKey) {
      return NextResponse.json({ error: 'Bot not found or missing Wazzup API key' }, { status: 404 });
    }

    const resp = await fetch('https://api.wazzup24.com/v3/webhooks', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bot.wazzupApiKey}`
      },
      body: JSON.stringify({
        webhooksUri: webhookUrl,
        subscriptions: { messagesAndStatuses: true }
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Wazzup webhook setup failed:', resp.status, text);
      return NextResponse.json({ error: 'Failed to set webhook' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wazzup setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
