'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface Bot {
  id: number;
  name: string;
  description: string;
  instructions: string;
  personality: string;
  specialization: string;
  openaiId: string | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    instructions: '',
    personality: '',
    specialization: '',
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    top_p: 1,
    response_format: 'text',
    code_interpreter: false,
    retrieval: false
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    fetchBots();
  }, [router]);

  const fetchBots = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bots', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

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

  const handleEditBot = async (bot: Bot) => {
    setEditingBot(bot);
    setEditForm(prev => ({
      ...prev,
      name: bot.name,
      description: bot.description,
      instructions: bot.instructions,
      personality: bot.personality,
      specialization: bot.specialization
    }));
    setShowEditModal(true);

    if (bot.openaiId) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/assistant?id=${bot.openaiId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUpdateBot = async () => {
    if (!editingBot) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          botId: editingBot.id,
          botConfig: editForm
        })
      });

      if (editingBot.openaiId) {
        await fetch('/api/assistant', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
              {/* Bots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {bots.map((bot) => (
                  <div key={bot.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getSpecializationIcon(bot.specialization)}</div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{bot.name}</h3>
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {bot.specialization}
                          </span>
                        </div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{bot.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Создан:</span>
                        <span className="font-medium">
                          {new Date(bot.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Обновлен:</span>
                        <span className="font-medium">
                          {new Date(bot.updatedAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Личность:</p>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded line-clamp-2">
                        {bot.personality}
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditBot(bot)}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded text-sm transition-colors"
                      >
                        Редактировать
                      </button>
                      <button 
                        onClick={() => handleDeleteBot(bot.id)}
                        className="px-3 py-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Редактировать бота</h2>
            
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map(f => (
                    <div key={f.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                      <span className="text-sm text-gray-700">📎 {f.name}</span>
                      <button onClick={() => removeFile(f.id)} className="text-red-500 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
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
                  className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200"
                >
                  Добавить файл
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
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
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}