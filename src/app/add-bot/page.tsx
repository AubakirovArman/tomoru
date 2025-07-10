'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

interface BotConfig {
  name: string;
  description: string;
  instructions: string;
  personality: string;
  specialization: string;
  files: string[];
}

export default function AddBotPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [allUploadedFiles, setAllUploadedFiles] = useState<UploadedFile[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Проверка аутентификации
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Инициализация чата с ботом-отцом
    const initChat = async () => {
      const welcomeMessage: Message = {
        id: 1,
        text: 'Привет! Я Бот-Отец 🤖👨‍💻\n\nЯ помогу тебе создать идеального AI ассистента! Давай начнем с простого вопроса:\n\n🎯 **Какую основную задачу должен решать твой бот?**\n\nНапример:\n• Помощь клиентам в поддержке\n• Анализ данных и отчеты\n• Обучение и консультации\n• Автоматизация процессов\n• Что-то еще?',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setLoading(false);
    };

    initChat();
  }, [router]);

  useEffect(() => {
    // Автоскролл к последнему сообщению
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          const uploadedFile: UploadedFile = {
            id: result.fileId,
            name: result.filename,
            size: result.size
          };
          setUploadedFiles(prev => [...prev, uploadedFile]);
          // Добавляем в allUploadedFiles только если файла там еще нет
          setAllUploadedFiles(prev => {
            const exists = prev.some(f => f.id === uploadedFile.id);
            return exists ? prev : [...prev, uploadedFile];
          });
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setAllUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const sendMessage = async () => {
    if (!inputText.trim() && uploadedFiles.length === 0) return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    // Очищаем только текущие файлы для ввода, allUploadedFiles сохраняем
    setUploadedFiles([]);
    setIsTyping(true);

    try {
      const response = await fetch('/api/bot-creator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: inputText,
          threadId,
          files: uploadedFiles.map(f => f.id)
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result);
        
        const botMessage: Message = {
          id: Date.now() + 1,
          text: result.response,
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
        setThreadId(result.threadId);

        // Проверяем, создал ли бот конфигурацию
        console.log('Checking for botConfig:', result.botConfig);
        if (result.botConfig) {
          console.log('Setting bot config:', result.botConfig);
          setBotConfig(result.botConfig);
        } else {
          console.log('No botConfig in response');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: 'Извините, произошла ошибка. Попробуйте еще раз.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsTyping(false);
  };

  const createBot = async () => {
    if (!botConfig) return;

    setIsCreatingBot(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bot-creator', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          botConfig,
          files: allUploadedFiles.map(f => f.id)
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Bot created successfully:', result);
        
        // Показываем уведомление об успехе
        alert(`✅ Бот "${botConfig.name}" успешно создан!\n\nВы будете перенаправлены на страницу управления ботами.`);
        
        // Перенаправляем на страницу каналов
        router.push('/channels');
      } else {
        const errorText = await response.text();
        console.error('Failed to create bot:', errorText);
        alert(`❌ Ошибка при создании бота:\n\n${errorText}`);
      }
    } catch (error) {
      console.error('Error creating bot:', error);
      alert(`❌ Произошла ошибка при создании бота:\n\n${error instanceof Error ? error.message : String(error)}`);
    }
    setIsCreatingBot(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Инициализация Бота-Отца...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 Создание бота</h1>
            <p className="text-gray-600">Общайтесь с Ботом-Отцом для создания идеального ассистента</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg h-[700px] w-full flex flex-col mb-6">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-lg">
              <h3 className="text-lg font-semibold flex items-center">
                <span className="mr-2">👨‍💻</span>
                Бот-Отец
              </h3>
              <p className="text-purple-100 text-sm">Специалист по созданию AI ассистентов</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.text}</div>
                    {message.files && message.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.files.map((file) => (
                          <div key={file.id} className="text-xs bg-white bg-opacity-20 rounded px-2 py-1">
                            📎 {file.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs mt-2 ${
                      message.isUser ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 max-w-md lg:max-w-2xl px-4 py-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-500">Бот-Отец думает...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center space-x-2">
                      <span className="text-sm text-blue-800">📎 {file.name}</span>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex space-x-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Опишите вашего бота... (Enter для отправки)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[40px] max-h-[120px]"
                  disabled={isTyping}
                  rows={1}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  className="hidden"
                  accept=".txt,.pdf,.doc,.docx,.md,.csv"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isTyping}
                >
                  📎
                </button>
                <button
                  onClick={sendMessage}
                  disabled={isTyping || (!inputText.trim() && uploadedFiles.length === 0)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  📤
                </button>
              </div>
            </div>
          </div>

          {/* Bot Configuration Preview */}
          {botConfig && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">🎉 Конфигурация бота готова!</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Название:</h3>
                  <p className="text-gray-900">{botConfig.name}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Специализация:</h3>
                  <p className="text-gray-900">{botConfig.specialization}</p>
                </div>
                <div className="md:col-span-2">
                  <h3 className="font-medium text-gray-700 mb-2">Описание:</h3>
                  <p className="text-gray-900">{botConfig.description}</p>
                </div>
                <div className="md:col-span-2">
                  <h3 className="font-medium text-gray-700 mb-2">Личность:</h3>
                  <p className="text-gray-900">{botConfig.personality}</p>
                </div>
                {allUploadedFiles.length > 0 && (
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-gray-700 mb-2">Прикрепленные файлы ({allUploadedFiles.length}):</h3>
                    <div className="flex flex-wrap gap-2">
                      {allUploadedFiles.map((file) => (
                        <div key={file.id} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center space-x-2">
                          <span className="text-sm text-green-800">📎 {file.name}</span>
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={createBot}
                  disabled={isCreatingBot}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isCreatingBot ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Создание...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Создать бота</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setBotConfig(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg transition-colors"
                >
                  Изменить конфигурацию
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}