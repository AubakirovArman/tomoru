'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Статистика</h1>
            <p className="text-gray-600">Аналитика и метрики вашего использования TOMORU AI</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  💬
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Всего сообщений</p>
                  <p className="text-2xl font-bold text-gray-900">1,247</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  🤖
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Активных ботов</p>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  📺
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Каналов</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                  ⏱️
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Время онлайн</p>
                  <p className="text-2xl font-bold text-gray-900">24ч</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">📈 Активность по дням</h2>
              <div className="h-64 flex items-end justify-between space-x-2">
                {[40, 65, 45, 80, 55, 70, 85].map((height, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div 
                      className="bg-blue-500 rounded-t w-8 transition-all hover:bg-blue-600"
                      style={{ height: `${height}%` }}
                    ></div>
                    <span className="text-xs text-gray-500 mt-2">
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">🎯 Топ функций</h2>
              <div className="space-y-4">
                {[
                  { name: 'Чат с AI', usage: 85, color: 'bg-blue-500' },
                  { name: 'Анализ данных', usage: 72, color: 'bg-green-500' },
                  { name: 'Генерация текста', usage: 68, color: 'bg-purple-500' },
                  { name: 'Переводы', usage: 45, color: 'bg-orange-500' },
                  { name: 'Код-ревью', usage: 38, color: 'bg-red-500' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-24 text-sm text-gray-600">{item.name}</div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${item.color} h-2 rounded-full transition-all`}
                          style={{ width: `${item.usage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-12 text-sm text-gray-500">{item.usage}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">🕒 Последняя активность</h2>
            <div className="space-y-4">
              {[
                { action: 'Создан новый бот "Помощник по коду"', time: '2 минуты назад', icon: '🤖' },
                { action: 'Обновлена база знаний "JavaScript"', time: '15 минут назад', icon: '📚' },
                { action: 'Добавлен новый канал "Разработка"', time: '1 час назад', icon: '📺' },
                { action: 'Экспорт данных в таблицу Excel', time: '2 часа назад', icon: '📋' },
                { action: 'Анализ 500 сообщений завершен', time: '3 часа назад', icon: '📊' },
              ].map((activity, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl mr-3">{activity.icon}</div>
                  <div className="flex-1">
                    <p className="text-gray-800">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}