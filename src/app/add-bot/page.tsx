'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
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
      const template = searchParams.get('template');
      let welcomeMessage: Message;

      if (template === 'hr-recruiter') {
        welcomeMessage = {
          id: 1,
          text: 'Привет! Я специализированный HR Бот-Отец 🧑‍💼👨‍💻\n\nЯ помогу тебе создать идеального HR-бота для найма персонала! У меня есть готовый шаблон, но давай его настроим под твою компанию.\n\n🏢 **Расскажи о своей компании:**\n\n• Как называется компания?\n• В какой сфере работаете?\n• Какую вакансию нужно закрыть?\n• Какие основные требования к кандидату?\n\nЭта информация поможет мне создать персонализированного HR-ассистента для твоей компании.',
          isUser: false,
          timestamp: new Date()
        };
      } else {
        welcomeMessage = {
          id: 1,
          text: 'Привет! Я Бот-Отец 🤖👨‍💻\n\nЯ помогу тебе создать идеального AI ассистента! Давай начнем с простого вопроса:\n\n🎯 **Какую основную задачу должен решать твой бот?**\n\nНапример:\n• Помощь клиентам в поддержке\n• Анализ данных и отчеты\n• Обучение и консультации\n• Автоматизация процессов\n• Что-то еще?',
          isUser: false,
          timestamp: new Date()
        };
      }
      
      setMessages([welcomeMessage]);
      setLoading(false);
    };

    initChat();
  }, [router, searchParams]);

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

  const removeFile = async (fileId: string) => {
    try {
      // Удаляем файл с сервера
      const response = await fetch(`/api/upload?fileId=${fileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Удаляем файл из локального состояния только после успешного удаления с сервера
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
        setAllUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        console.error('Failed to delete file from server');
        alert('Ошибка при удалении файла');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Ошибка при удалении файла');
    }
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
          files: uploadedFiles.map(f => f.id),
          template: searchParams.get('template')
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Navigation />
      
      <div className="flex flex-col flex-1 h-screen bg-white/50 rounded-2xl shadow-inner shadow-gray-300/50 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-4xl lg:max-w-6xl mx-auto w-full flex flex-col h-full">
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">🤖 Создание бота</h1>
            <p className="text-gray-600 text-sm sm:text-base">Общайтесь с Ботом-Отцом для создания идеального ассистента</p>
          </div>

          <div className="bg-[#F9FAFB] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex-1 flex flex-col backdrop-blur-sm border border-white/20 overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-emerald-100 to-emerald-200 text-gray-900 p-4 sm:p-6 rounded-t-2xl border-b border-emerald-200/30">
              <h3 className="text-lg font-semibold flex items-center">
                {searchParams.get('template') === 'hr-recruiter' ? (
                  <>
                    <span className="mr-2">🧑‍💼</span>
                    HR Бот-Отец
                  </>
                ) : (
                  <>
                    <span className="mr-2">👨‍💻</span>
                    Бот-Отец
                  </>
                )}
              </h3>
              <p className="text-emerald-700 text-sm opacity-90">
                {searchParams.get('template') === 'hr-recruiter' 
                  ? 'Специалист по созданию HR-ботов для найма персонала'
                  : 'Специалист по созданию AI ассистентов'
                }
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto scroll-smooth">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                      className={`max-w-[85%] sm:max-w-md lg:max-w-3xl px-4 sm:px-6 py-3 sm:py-4 rounded-2xl transition-all duration-300 ease-out animate-fade-in ${
                        message.isUser
                          ? 'bg-[#A8F9C0] text-emerald-900 shadow-sm'
                          : 'bg-white text-gray-800 shadow-sm border border-gray-100'
                      }`}
                    >
                    <div className="whitespace-pre-wrap text-base leading-relaxed">{message.text}</div>
                    {message.files && message.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.files.map((file) => (
                          <div key={file.id} className="text-xs bg-white bg-opacity-20 rounded px-2 py-1">
                            📎 {file.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs mt-3 opacity-70 ${
                      message.isUser ? 'text-emerald-700' : 'text-gray-500'
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
                <div className="flex justify-start animate-slide-up">
                  <div className="bg-white text-gray-800 max-w-[85%] sm:max-w-md lg:max-w-3xl px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {searchParams.get('template') === 'hr-recruiter' 
                          ? 'HR Бот-Отец печатает...'
                          : 'Бот-Отец печатает...'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200/50 p-4 sm:p-6 bg-white/50 rounded-b-2xl">
              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3 animate-fade-in">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center space-x-2 transition-all duration-200">
                      <span className="text-sm text-emerald-800">📎 {file.name}</span>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-emerald-600 hover:text-emerald-800 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex space-x-2 sm:space-x-3 items-end">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Опишите вашего бота... (Enter для отправки)"
                  className="flex-1 border border-gray-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 resize-none min-h-[44px] sm:min-h-[52px] max-h-[120px] sm:max-h-[150px] bg-white shadow-sm transition-all duration-200"
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
                    className="bg-white text-gray-600 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl hover:bg-gray-50 transition-all duration-200 shadow-sm border border-gray-200 hover:shadow-md"
                    disabled={isTyping}
                  >
                    📎
                  </button>
                <button
                    onClick={sendMessage}
                    disabled={isTyping || (!inputText.trim() && uploadedFiles.length === 0)}
                    className="bg-[#A8F9C0] text-emerald-900 px-4 sm:px-5 py-2 sm:py-3 rounded-2xl hover:bg-emerald-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    📤
                  </button>
              </div>
            </div>
          </div>

        </div>
        
        {/* Bot Configuration Preview */}
        {botConfig && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-4 min-h-[80vh] max-h-[90vh] overflow-y-auto max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">🎉 Конфигурация бота готова!</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 text-lg">📝 Название:</h3>
                  <p className="text-gray-900 text-base">{botConfig.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 text-lg">🎯 Специализация:</h3>
                  <p className="text-gray-900 text-base">{botConfig.specialization}</p>
                </div>
                <div className="lg:col-span-2 bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 text-lg">📋 Описание:</h3>
                  <p className="text-gray-900 text-base leading-relaxed">{botConfig.description}</p>
                </div>
                <div className="lg:col-span-2 bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 text-lg">🤖 Личность:</h3>
                  <p className="text-gray-900 text-base leading-relaxed">{botConfig.personality}</p>
                </div>
                {allUploadedFiles.length > 0 && (
                  <div className="lg:col-span-2 bg-yellow-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 text-lg">📎 Прикрепленные файлы ({allUploadedFiles.length}):</h3>
                    <div className="flex flex-wrap gap-3">
                      {allUploadedFiles.map((file) => (
                        <div key={file.id} className="bg-white border border-yellow-200 rounded-lg px-4 py-3 flex items-center space-x-3 shadow-sm">
                          <span className="text-base text-yellow-800">📎 {file.name}</span>
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-yellow-600 hover:text-yellow-800 text-lg font-bold"
                            title="Удалить файл"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={createBot}
                  disabled={isCreatingBot}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-lg font-medium min-w-[200px]"
                >
                  {isCreatingBot ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-4 rounded-lg transition-colors text-lg font-medium min-w-[200px]"
                >
                  Изменить конфигурацию
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}