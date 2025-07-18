'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { handleAuthError, createAuthHeaders } from '@/lib/authUtils';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface Bot {
  id: number;
  name: string;
  description: string;
  instructions: string;
  personality: string;
  specialization: string;
  openaiId: string | null;
}

interface ChatWindowProps {
  bot?: Bot;
  onClose?: () => void;
}

const ChatWindow = ({ bot, onClose }: ChatWindowProps) => {
  // Значения по умолчанию для бота
  const defaultBot: Bot = {
    id: 0,
    name: 'TOMORU AI',
    description: 'Ваш персональный AI-ассистент.',
    instructions: 'Помогаю пользователям с различными задачами.',
    personality: 'Дружелюбный и полезный',
    specialization: 'Общий помощник',
    openaiId: null
  };
  
  const currentBot = bot || defaultBot;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: `Привет! Я ${currentBot.name}. ${currentBot.description} Чем могу помочь?`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Отправляем сообщение боту через API
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: createAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          botId: currentBot.id,
          message: userMessage.text,
          conversationHistory: messages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text
          }))
        })
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const aiResponse: Message = {
          id: Date.now() + 1,
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiResponse]);
      } else {
        const aiResponse: Message = {
          id: Date.now() + 1,
          text: 'Извините, произошла ошибка при обработке вашего сообщения.',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiResponse]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const aiResponse: Message = {
        id: Date.now() + 1,
        text: 'Извините, произошла ошибка при отправке сообщения.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="glass rounded-xl shadow-lg h-[600px] w-full max-w-4xl flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="bg-accent-secondary text-foreground p-6 rounded-t-xl flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">💬 Чат с {currentBot.name}</h3>
          <p className="text-text-secondary text-sm">Онлайн • {currentBot.specialization}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-foreground hover:text-accent-deep text-xl font-bold transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background scroll-smooth">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-xl shadow-sm ${message.isUser ? 'bg-accent-secondary text-foreground' : 'bg-white text-foreground'}`}
            >
              <div className="whitespace-pre-wrap text-sm">{message.text}</div>
              <p className={`text-xs mt-1 text-text-secondary`}>
                {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-foreground max-w-md lg:max-w-2xl px-4 py-3 rounded-xl shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm text-text-secondary">{currentBot.name} печатает...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-white">
        <div className="flex space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Напишите сообщение... (Enter для отправки)"
            className="flex-1 border border-border rounded-lg px-4 py-3 text-foreground placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-deep focus:border-transparent resize-none min-h-[48px] max-h-[120px] bg-white"
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
            className="button text-foreground hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;