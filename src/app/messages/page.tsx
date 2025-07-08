'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  type: 'user' | 'ai' | 'system';
  channel: string;
}

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Симуляция загрузки сообщений
    const mockMessages: Message[] = [
      {
        id: 1,
        sender: 'TOMORU AI',
        content: 'Добро пожаловать! Как дела? Чем могу помочь?',
        timestamp: '2024-01-08 14:30',
        type: 'ai',
        channel: 'general'
      },
      {
        id: 2,
        sender: 'Пользователь',
        content: 'Привет! Можешь помочь с анализом данных?',
        timestamp: '2024-01-08 14:32',
        type: 'user',
        channel: 'general'
      },
      {
        id: 3,
        sender: 'TOMORU AI',
        content: 'Конечно! Загрузите ваши данные, и я помогу с анализом.',
        timestamp: '2024-01-08 14:33',
        type: 'ai',
        channel: 'general'
      },
      {
        id: 4,
        sender: 'Система',
        content: 'Новый бот "Код-ревьюер" добавлен в канал разработки',
        timestamp: '2024-01-08 13:15',
        type: 'system',
        channel: 'development'
      },
      {
        id: 5,
        sender: 'Code Bot',
        content: 'Найдена потенциальная ошибка в функции calculateTotal()',
        timestamp: '2024-01-08 13:20',
        type: 'ai',
        channel: 'development'
      },
      {
        id: 6,
        sender: 'Пользователь',
        content: 'Спасибо за анализ! Исправлю это.',
        timestamp: '2024-01-08 13:25',
        type: 'user',
        channel: 'development'
      }
    ];

    setMessages(mockMessages);
    setLoading(false);
  }, [router]);

  const filteredMessages = messages.filter(message => {
    const matchesChannel = selectedChannel === 'all' || message.channel === selectedChannel;
    const matchesSearch = message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.sender.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'ai': return '🤖';
      case 'user': return '👤';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };

  const getMessageBgColor = (type: string) => {
    switch (type) {
      case 'ai': return 'bg-blue-50 border-blue-200';
      case 'user': return 'bg-green-50 border-green-200';
      case 'system': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
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
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Поиск сообщений
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по содержимому или отправителю..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📺 Канал
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все каналы</option>
                  <option value="general">Общий</option>
                  <option value="development">Разработка</option>
                  <option value="support">Поддержка</option>
                </select>
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
                <div key={message.id} className={`bg-white rounded-lg shadow-sm border-l-4 ${getMessageBgColor(message.type)} p-6`}>
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getMessageIcon(message.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-800">{message.sender}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            #{message.channel}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{message.timestamp}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Stats */}
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статистика сообщений</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{messages.length}</div>
                <div className="text-sm text-gray-600">Всего сообщений</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {messages.filter(m => m.type === 'ai').length}
                </div>
                <div className="text-sm text-gray-600">От AI</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {messages.filter(m => m.type === 'user').length}
                </div>
                <div className="text-sm text-gray-600">От пользователей</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {messages.filter(m => m.type === 'system').length}
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