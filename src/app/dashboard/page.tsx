'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '../../components/ChatWindow';

interface User {
  id: string;
  email: string;
  name?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  // Remove logout from here as it's in nav

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="glass p-8 mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Добро пожаловать в TOMORU AI!
        </h1>
        <p className="text-text-secondary">
          Привет, {user.name || user.email}! Готов помочь вам сегодня.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Stats and Info */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              📊 Быстрая статистика
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">Сообщений:</span>
                <span className="font-semibold text-foreground">127</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Каналов:</span>
                <span className="font-semibold text-foreground">5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Ботов:</span>
                <span className="font-semibold text-foreground">3</span>
              </div>
            </div>
          </div>

          <div className="glass p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              🚀 Возможности TOMORU AI
            </h2>
            <ul className="space-y-2 text-text-secondary">
              <li>• Интеллектуальное общение</li>
              <li>• Анализ данных</li>
              <li>• Автоматизация задач</li>
              <li>• Управление знаниями</li>
              <li>• Интеграция с ботами</li>
            </ul>
          </div>
        </div>

        {/* Right Column - Chat */}
        <div className="lg:col-span-2 glass p-8">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}