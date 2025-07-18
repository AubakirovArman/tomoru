'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart2, MessageSquare, Tv, Table, BookOpen, Bot, PlusCircle } from 'lucide-react';
import { LogOut } from 'lucide-react';

const Navigation = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Главная', icon: Home },
    { href: '/statistics', label: 'Статистика', icon: BarChart2 },
    { href: '/messages', label: 'Сообщения', icon: MessageSquare },
    { href: '/channels', label: 'Каналы', icon: Tv },
    { href: '/tables', label: 'Таблицы', icon: Table },
    { href: '/knowledge', label: 'Базы знаний', icon: BookOpen },
    { href: '/bot-templates', label: 'Шаблоны ботов', icon: Bot },
    { href: '/add-bot', label: 'Добавить бота', icon: PlusCircle },
  ];

  return (
    <nav className="fixed left-0 top-0 h-screen w-64 glass flex flex-col p-4 overflow-y-auto">
      <div className="flex items-center mb-8">
        <Link href="/dashboard" className="text-2xl font-bold text-foreground">
          TOMORU AI
        </Link>
      </div>

      <div className="flex flex-col space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname === item.href ? 'bg-accent-primary text-foreground shadow-md' : 'text-foreground hover:bg-accent-secondary hover:text-foreground'}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          onClick={() => { /* Add logout logic here */ }}
          className="button flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Выйти</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;