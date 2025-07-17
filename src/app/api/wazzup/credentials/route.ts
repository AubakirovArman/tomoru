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

    const { botId, apiKey, channelId } = await request.json();

    if (!botId || !apiKey || !channelId) {
      return NextResponse.json({ error: 'botId, apiKey and channelId are required' }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: decoded.userId }
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const updatedBot = await prisma.bot.update({
      where: { id: botId },
      data: { wazzupApiKey: apiKey, wazzupChannelId: channelId }
    });

    return NextResponse.json({ success: true, bot: updatedBot });
  } catch (error) {
    console.error('Wazzup credentials error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
