import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Получаем ботов пользователя
    const bots = await prisma.bot.findMany({
      where: { userId: decoded.userId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            messages: true
          }
        }
      },
       orderBy: {
         name: 'asc'
       }
     });

    // Получаем Telegram пользователей, которые общались с ботами пользователя
    const telegramUsers = await prisma.telegramUser.findMany({
      where: {
        messages: {
          some: {
            bot: {
              userId: decoded.userId
            }
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        telegramId: true,
        _count: {
          select: {
            messages: {
              where: {
                bot: {
                  userId: decoded.userId
                }
              }
            }
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Получаем статистику сообщений
    const messageStats = await prisma.message.groupBy({
      by: ['messageType'],
      where: {
        bot: {
          userId: decoded.userId
        }
      },
      _count: {
        id: true
      }
    });

    const stats = {
      total: messageStats.reduce((sum: number, stat: any) => sum + stat._count.id, 0),
      byType: messageStats.reduce((acc: any, stat: any) => {
        acc[stat.messageType.toLowerCase()] = stat._count.id;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      bots,
      telegramUsers,
      stats
    });
  } catch (error) {
    console.error('Error fetching message filters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}