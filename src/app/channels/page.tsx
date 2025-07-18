'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import ChatWindow from '../../components/ChatWindow';
import { handleAuthError, createAuthHeaders, isAuthenticated } from '../../lib/authUtils';

interface Bot {
  id: number;
  name: string;
  description: string;
  instructions: string;
  personality: string;
  specialization: string;
  openaiId: string | null;
  telegramBotToken: string | null;
  telegramWebhookUrl: string | null;
  telegramEnabled: boolean;
  wazzupApiKey: string | null;
  wazzupChannelId: string | null;
  createdAt: string;
  updatedAt: string;
  knowledgeBases?: {
    knowledgeBase: KnowledgeBase;
  }[];
}

interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  vectorStoreId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

export default function Channels() {
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<Bot[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chattingBot, setChattingBot] = useState<Bot | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'ai' | 'integrations'>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [botKnowledgeBases, setBotKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    instructions: '',
    personality: '',
    specialization: '',
    model: 'gpt-4o',
    temperature: 0.7,
    top_p: 1,
    response_format: 'text',
    code_interpreter: false,
    retrieval: false
  });
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/');
      return;
    }

    fetchBots();
  }, [router]);

  const fetchBots = async () => {
    try {
      const response = await fetch('/api/bots', {
        headers: createAuthHeaders()
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setBots(data.bots);
      } else {
        console.error('Failed to fetch bots');
      }
    } catch (error) {
      console.error('Error fetching bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableKnowledgeBases = async () => {
    try {
      const response = await fetch('/api/knowledge', {
        headers: createAuthHeaders()
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAvailableKnowledgeBases(data.knowledgeBases || []);
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const fetchBotKnowledgeBases = async (botId: number) => {
    setLoadingKnowledge(true);
    try {
      const response = await fetch(`/api/bots/knowledge?botId=${botId}`, {
        headers: createAuthHeaders()
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setBotKnowledgeBases(data.knowledgeBases || []);
      }
    } catch (error) {
      console.error('Error fetching bot knowledge bases:', error);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const handleLinkKnowledgeBase = async (knowledgeBaseId: number) => {
    if (!editingBot) return;

    try {
      const response = await fetch('/api/bots/knowledge', {
        method: 'POST',
        headers: createAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          botId: editingBot.id,
          knowledgeBaseId
        })
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        await fetchBotKnowledgeBases(editingBot.id);
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error linking knowledge base:', error);
      alert('Произошла ошибка при привязке базы знаний');
    }
  };

  const handleUnlinkKnowledgeBase = async (knowledgeBaseId: number) => {
    if (!editingBot) return;

    try {
      const response = await fetch(`/api/bots/knowledge?botId=${editingBot.id}&knowledgeBaseId=${knowledgeBaseId}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        await fetchBotKnowledgeBases(editingBot.id);
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error unlinking knowledge base:', error);
      alert('Произошла ошибка при отвязке базы знаний');
    }
  };

  const handleEditBot = async (bot: Bot) => {
    setEditingBot(bot);
    setActiveTab('basic');
    setEditForm(prev => ({
      ...prev,
      name: bot.name,
      description: bot.description,
      instructions: bot.instructions,
      personality: bot.personality,
      specialization: bot.specialization
    }));
    setShowEditModal(true);
    
    // Автоматически заполняем URL вебхука для Wazzup
    setTimeout(() => {
      const webhookInput = document.getElementById('wazzupWebhookUrl') as HTMLInputElement;
      if (webhookInput && !webhookInput.value) {
        webhookInput.value = `${window.location.origin}/api/wazzup/webhook`;
      }
    }, 100);
    
    // Загружаем доступные базы знаний и базы знаний бота
    await fetchAvailableKnowledgeBases();
    await fetchBotKnowledgeBases(bot.id);

    if (bot.openaiId) {
      try {
        const res = await fetch(`/api/assistant?id=${bot.openaiId}`, {
          headers: createAuthHeaders()
        });
        
        if (handleAuthError(res, router)) {
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          const a = data.assistant;
          setEditForm(prev => ({
            ...prev,
            model: a.model,
            temperature: a.temperature ?? prev.temperature,
            top_p: a.top_p ?? prev.top_p,
            response_format: a.response_format?.type || prev.response_format,
            code_interpreter: a.tools?.some((t: any) => t.type === 'code_interpreter') || false,
            retrieval: a.tools?.some((t: any) => t.type === 'retrieval') || false
          }));
          if (data.files) {
            setUploadedFiles(data.files.map((f: any) => ({ id: f.id, name: f.filename, size: f.bytes })));
          }
        }
      } catch (e) {
        console.error('Error loading assistant', e);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: createAuthHeaders(),
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          setUploadedFiles(prev => [...prev, { id: result.fileId, name: result.filename, size: result.size }]);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const removeFile = async (fileId: string) => {
    try {
      // Удаляем файл с сервера, передавая botId для удаления из векторной базы ассистента
      const botIdParam = editingBot?.id ? `&botId=${editingBot.id}` : '';
      const response = await fetch(`/api/upload?fileId=${fileId}${botIdParam}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });

      if (response.ok) {
        // Удаляем файл из локального состояния только после успешного удаления с сервера
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        console.error('Failed to delete file from server');
        alert('Ошибка при удалении файла');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Ошибка при удалении файла');
    }
  };

  const handleUpdateBot = async () => {
    if (!editingBot) return;

    try {
      const response = await fetch('/api/bots', {
        method: 'PUT',
        headers: createAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          botId: editingBot.id,
          botConfig: editForm
        })
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (editingBot.openaiId) {
        const assistantResponse = await fetch('/api/assistant', {
          method: 'PUT',
          headers: createAuthHeaders({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            assistantId: editingBot.openaiId,
            data: {
              name: editForm.name,
              description: editForm.description,
              instructions: editForm.instructions,
              model: editForm.model,
              temperature: editForm.temperature,
              top_p: editForm.top_p,
              response_format: { type: editForm.response_format },
              tools: [
                ...(editForm.code_interpreter ? [{ type: 'code_interpreter' }] : []),
                ...(editForm.retrieval ? [{ type: 'retrieval' }] : []),
                { type: 'file_search' }
              ]
            },
            files: uploadedFiles.map(f => f.id)
          })
        });
        
        if (handleAuthError(assistantResponse, router)) {
          return;
        }
      }

      if (response.ok) {
        await fetchBots(); // Обновляем список
        setShowEditModal(false);
        setEditingBot(null);
      } else {
        console.error('Failed to update bot');
      }
    } catch (error) {
      console.error('Error updating bot:', error);
    }
  };

  const handleSetupTelegram = async (botId: number) => {
    const tokenInput = document.getElementById('telegramToken') as HTMLInputElement;
    const telegramBotToken = tokenInput?.value;
    
    if (!telegramBotToken) {
      alert('Введите токен Telegram бота');
      return;
    }
    
    try {
      const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      
      const response = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: createAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          botId,
          telegramBotToken,
          webhookUrl
        })
      });
      
      if (handleAuthError(response, router)) {
        return;
      }
      
      if (response.ok) {
        await fetchBots(); // Обновляем список
        alert('Telegram бот успешно подключен!');
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error setting up Telegram:', error);
      alert('Произошла ошибка при подключении');
    }
  };
  
  const handleDisableTelegram = async (botId: number) => {
    if (!confirm('Вы уверены, что хотите отключить Telegram бота?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/telegram/setup', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ botId })
      });
      
      if (response.ok) {
        await fetchBots(); // Обновляем список
        alert('Telegram бот отключен');
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error disabling Telegram:', error);
      alert('Произошла ошибка при отключении');
    }
  };

  const handleSaveWazzup = async (botId: number) => {
    const apiKeyInput = document.getElementById('wazzupApiKey') as HTMLInputElement;
    const channelIdInput = document.getElementById('wazzupChannelId') as HTMLInputElement;
    const apiKey = apiKeyInput?.value;
    const channelId = channelIdInput?.value;

    if (!apiKey || !channelId) {
      alert('Введите API ключ и ID канала Wazzup24');
      return;
    }

    try {
      const response = await fetch('/api/wazzup/credentials', {
        method: 'POST',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ botId, apiKey, channelId })
      });

      if (handleAuthError(response, router)) {
        return;
      }

      if (response.ok) {
        await fetchBots();
        alert('Данные Wazzup24 сохранены');
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving Wazzup credentials:', error);
      alert('Произошла ошибка при сохранении');
    }
  };
  const handleSendWazzupWebhook = async (botId: number) => {
    const urlInput = document.getElementById("wazzupWebhookUrl") as HTMLInputElement;
    const webhookUrl = urlInput?.value;
    if (!webhookUrl) {
      alert("Введите URL веб-хука");
      return;
    }
    try {
      const response = await fetch("/api/wazzup/setup", {
        method: "POST",
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ botId, webhookUrl })
      });
      if (handleAuthError(response, router)) {
        return;
      }
      if (response.ok) {
        alert("Webhook Wazzup24 установлен");
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error("Error setting Wazzup webhook:", error);
      alert("Произошла ошибка при установке веб-хука");
    }
  };

  const handleDeleteBot = async (botId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого бота?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/bots?id=${botId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchBots(); // Обновляем список
      } else {
        console.error('Failed to delete bot');
      }
    } catch (error) {
      console.error('Error deleting bot:', error);
    }
  };

  const handleOpenChat = (bot: Bot) => {
    setChattingBot(bot);
    setShowChatModal(true);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
    setChattingBot(null);
  };

  const getSpecializationIcon = (specialization: string) => {
    const spec = specialization.toLowerCase();
    if (spec.includes('поддержка') || spec.includes('support')) return '🎧';
    if (spec.includes('анализ') || spec.includes('данные')) return '📊';
    if (spec.includes('обучение') || spec.includes('консультации')) return '🎓';
    if (spec.includes('автоматизация')) return '⚙️';
    if (spec.includes('переводчик')) return '🌐';
    return '🤖';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка ботов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 Мои боты</h1>
              <p className="text-gray-600">Управление вашими AI ассистентами</p>
            </div>
            <button
              onClick={() => router.push('/add-bot')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Создать бота</span>
            </button>
          </div>

          {bots.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">У вас пока нет ботов</h2>
              <p className="text-gray-600 mb-6">Создайте своего первого AI ассистента с помощью Бота-Отца</p>
              <button
                onClick={() => router.push('/add-bot')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Создать первого бота
              </button>
            </div>
          ) : (
            <>
              {/* Bots Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бот</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Специализация</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Базы знаний</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Обновлен</th>
                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bots.map((bot) => (
                        <tr key={bot.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-2xl mr-3">{getSpecializationIcon(bot.specialization)}</div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{bot.name}</div>
                                <div className="text-sm text-gray-500 max-w-xs truncate">{bot.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 max-w-[120px] text-center leading-tight">
                              {bot.specialization}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                              <span className="text-sm text-gray-900">Активен</span>
                            </div>
                            <div className="flex items-center mt-1 space-x-2">
                              {bot.telegramEnabled && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  📱 Telegram
                                </span>
                              )}
                              {bot.wazzupApiKey && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  💬 Wazzup
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              🧠 {bot.knowledgeBases?.length || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(bot.updatedAt).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-1">
                              <button 
                                onClick={() => handleOpenChat(bot)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                                title="Открыть чат"
                              >
                                💬
                              </button>
                              <button 
                                onClick={() => handleEditBot(bot)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                                title="Редактировать"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => handleDeleteBot(bot.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                                title="Удалить"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статистика ботов</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{bots.length}</div>
                    <div className="text-sm text-gray-600">Всего ботов</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{bots.length}</div>
                    <div className="text-sm text-gray-600">Активных</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {new Set(bots.map(b => b.specialization)).size}
                    </div>
                    <div className="text-sm text-gray-600">Специализаций</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {bots.filter(b => b.openaiId).length}
                    </div>
                    <div className="text-sm text-gray-600">В OpenAI</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Bot Modal */}
      {showEditModal && editingBot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Редактировать бота</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBot(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'basic'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📝 Основная информация
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'ai'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🤖 Настройки ИИ
                </button>
                <button
                  onClick={() => setActiveTab('integrations')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'integrations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🔗 Интеграции
                </button>
              </nav>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Описание
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Специализация
                    </label>
                    <input
                      type="text"
                      value={editForm.specialization}
                      onChange={(e) => setEditForm(prev => ({ ...prev, specialization: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Личность
                    </label>
                    <textarea
                      value={editForm.personality}
                      onChange={(e) => setEditForm(prev => ({ ...prev, personality: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Инструкции
                    </label>
                    <textarea
                      value={editForm.instructions}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructions: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* AI Settings Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Модель</label>
                      <select
                        value={editForm.model}
                        onChange={(e) => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4-turbo-preview">gpt-4-turbo-preview</option>
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Температура</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={editForm.temperature}
                        onChange={(e) => setEditForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Top P</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={editForm.top_p}
                        onChange={(e) => setEditForm(prev => ({ ...prev, top_p: parseFloat(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Формат ответа</label>
                      <select
                        value={editForm.response_format}
                        onChange={(e) => setEditForm(prev => ({ ...prev, response_format: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="text">text</option>
                        <option value="json_object">json_object</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editForm.code_interpreter}
                        onChange={(e) => setEditForm(prev => ({ ...prev, code_interpreter: e.target.checked }))}
                      />
                      <span className="text-sm">Code Interpreter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editForm.retrieval}
                        onChange={(e) => setEditForm(prev => ({ ...prev, retrieval: e.target.checked }))}
                      />
                      <span className="text-sm">Retrieval</span>
                    </label>
                  </div>

                  {/* File Upload Section */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Загруженные файлы:</h4>
                      {uploadedFiles.map(f => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-sm text-gray-700">📎 {f.name}</span>
                          <button onClick={() => removeFile(f.id)} className="text-red-500 text-sm">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
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
                      className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 w-full"
                    >
                      📁 Добавить файл
                    </button>
                  </div>

                  {/* Knowledge Bases Section */}
                  <div className="border-t pt-4 mt-6">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">🧠 Базы знаний</h4>
                    
                    {loadingKnowledge ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <div className="text-sm text-gray-600">Загрузка...</div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Привязанные базы знаний */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Привязанные базы знаний</h4>
                          {botKnowledgeBases.length > 0 ? (
                            <div className="space-y-2">
                              {botKnowledgeBases.map((kb) => (
                                <div key={kb.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div>
                                    <div className="text-sm font-medium text-green-800">{kb.name}</div>
                                    <div className="text-xs text-green-600">{kb.description || 'Без описания'}</div>
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkKnowledgeBase(kb.id)}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs"
                                  >
                                    Отвязать
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                              Нет привязанных баз знаний
                            </div>
                          )}
                        </div>

                        {/* Доступные базы знаний */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Доступные базы знаний</h4>
                          {availableKnowledgeBases.filter(kb => !botKnowledgeBases.some(bkb => bkb.id === kb.id)).length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {availableKnowledgeBases
                                .filter(kb => !botKnowledgeBases.some(bkb => bkb.id === kb.id))
                                .map((kb) => (
                                <div key={kb.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div>
                                    <div className="text-sm font-medium text-blue-800">{kb.name}</div>
                                    <div className="text-xs text-blue-600">{kb.description || 'Без описания'}</div>
                                  </div>
                                  <button
                                    onClick={() => handleLinkKnowledgeBase(kb.id)}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs"
                                  >
                                    Привязать
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                              {availableKnowledgeBases.length === 0 
                                ? 'У вас нет баз знаний. Создайте их в разделе "Базы знаний"'
                                : 'Все доступные базы знаний уже привязаны к этому боту'
                              }
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                          💡 Привязанные базы знаний позволяют боту использовать дополнительную информацию для более точных ответов
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Telegram Integration Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-3">📱 Telegram</h4>
                    
                    {editingBot.telegramEnabled ? (
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-green-800">Telegram бот подключен</div>
                          <div className="text-xs text-green-600">Бот активен и готов к работе</div>
                        </div>
                        <button
                          onClick={() => handleDisableTelegram(editingBot.id)}
                          className="w-full bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-sm"
                        >
                          Отключить
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-xs text-gray-600 mb-2">
                          Подключите Telegram бота для автоматических ответов
                        </div>
                        
                        <input
                          type="text"
                          placeholder="Токен Telegram бота"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="telegramToken"
                        />
                        
                        <button
                          onClick={() => handleSetupTelegram(editingBot.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                        >
                          Подключить Telegram
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Wazzup24 Integration Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-3">💬 Wazzup24</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        id="wazzupApiKey"
                        defaultValue={editingBot?.wazzupApiKey || ''}
                        placeholder="API ключ"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        id="wazzupChannelId"
                        defaultValue={editingBot?.wazzupChannelId || ''}
                        placeholder="ID канала"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleSaveWazzup(editingBot!.id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Сохранить Wazzup24
                      </button>
                      <input
                        type="text"
                        id="wazzupWebhookUrl"
                        placeholder="URL веб-хука"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleSendWazzupWebhook(editingBot!.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Отправить веб-хук
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="flex space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBot(null);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateBot}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && chattingBot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl h-[80vh]">
            <ChatWindow bot={chattingBot} onClose={handleCloseChat} />
          </div>
        </div>
      )}
    </div>
  );
}