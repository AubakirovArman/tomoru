'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface Message {
  id: number;
  content: string;
  messageType: 'USER' | 'BOT' | 'SYSTEM';
  createdAt: string;
  bot: {
    id: number;
    name: string;
  };
  telegramUser?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    telegramId: string;
  };
  threadId?: string;
}

interface Bot {
  id: number;
  name: string;
  _count: {
    messages: number;
  };
}

interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  telegramId: string;
  _count: {
    messages: number;
  };
}

interface MessageStats {
  total: number;
  byType: {
    user?: number;
    bot?: number;
    system?: number;
  };
}

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [stats, setStats] = useState<MessageStats>({ total: 0, byType: {} });
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    loadFilters();
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadMessages();
    }
  }, [selectedBot, selectedUser, currentPage]);

  const loadFilters = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages/filters', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBots(data.bots);
        setTelegramUsers(data.telegramUsers);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (selectedBot !== 'all') {
        params.append('botId', selectedBot);
      }
      if (selectedUser !== 'all') {
        params.append('telegramUserId', selectedUser);
      }

      const response = await fetch(`/api/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (message.telegramUser && (
                           message.telegramUser.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (message.telegramUser.username && message.telegramUser.username.toLowerCase().includes(searchTerm.toLowerCase()))
                         ));
    return matchesSearch;
  });

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'BOT': return '🤖';
      case 'USER': return '👤';
      case 'SYSTEM': return '⚙️';
      default: return '💬';
    }
  };

  const getMessageBgColor = (type: string) => {
    switch (type) {
      case 'BOT': return 'bg-blue-50 border-blue-200';
      case 'USER': return 'bg-green-50 border-green-200';
      case 'SYSTEM': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getSenderName = (message: Message) => {
    if (message.messageType === 'BOT') {
      return message.bot.name;
    } else if (message.messageType === 'USER' && message.telegramUser) {
      const { firstName, lastName, username } = message.telegramUser;
      return `${firstName}${lastName ? ' ' + lastName : ''}${username ? ' (@' + username + ')' : ''}`;
    } else if (message.messageType === 'SYSTEM') {
      return 'Система';
    }
    return 'Неизвестно';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка сообщений...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">💬 Сообщения</h1>
            <p className="text-gray-600">История всех сообщений и взаимодействий</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Поиск сообщений
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по содержимому..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🤖 Бот
                </label>
                <select
                  value={selectedBot}
                  onChange={(e) => setSelectedBot(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все боты</option>
                  {bots.map(bot => (
                    <option key={bot.id} value={bot.id.toString()}>
                      {bot.name} ({bot._count.messages})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👤 Пользователь
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все пользователи</option>
                  {telegramUsers.map(user => (
                    <option key={user.id} value={user.id.toString()}>
                      {user.firstName}{user.lastName ? ' ' + user.lastName : ''}
                      {user.username ? ' (@' + user.username + ')' : ''}
                      ({user._count.messages})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedBot('all');
                    setSelectedUser('all');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                >
                  🔄 Сбросить
                </button>
              </div>
            </div>
          </div>

          {/* Messages List */}
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Сообщения не найдены</h3>
                <p className="text-gray-600">Попробуйте изменить фильтры поиска</p>
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div key={message.id} className={`bg-white rounded-lg shadow-sm border-l-4 ${getMessageBgColor(message.messageType)} p-6`}>
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getMessageIcon(message.messageType)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-800">{getSenderName(message)}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {message.bot.name}
                          </span>
                          {message.telegramUser && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                              TG: {message.telegramUser.telegramId}
                            </span>
                          )}
                          {message.threadId && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">
                              Thread: {message.threadId.slice(-8)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Предыдущая
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Следующая →
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статистика сообщений</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Всего сообщений</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.byType.bot || 0}
                </div>
                <div className="text-sm text-gray-600">От ботов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.byType.user || 0}
                </div>
                <div className="text-sm text-gray-600">От пользователей</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.byType.system || 0}
                </div>
                <div className="text-sm text-gray-600">Системных</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}