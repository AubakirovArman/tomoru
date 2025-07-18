'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'business' | 'general' | 'ai';
  status: 'ready' | 'training' | 'active';
  documents: number;
  accuracy: number;
  usage: number;
  size: string;
  lastUpdated: string;
  vectorStoreId?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
}

export default function Knowledge() {
  const [loading, setLoading] = useState(true);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKB, setNewKB] = useState({
    name: '',
    description: '',
    category: 'general' as 'technical' | 'business' | 'general' | 'ai'
  });
  const router = useRouter();

  // Загрузка баз знаний
  const fetchKnowledgeBases = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/knowledge', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(data.knowledgeBases || []);
      } else if (response.status === 401) {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    fetchKnowledgeBases();
  }, [router]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return '⚙️';
      case 'business': return '💼';
      case 'ai': return '🤖';
      case 'general': return '📚';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'training': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return 'bg-purple-100 text-purple-800';
      case 'business': return 'bg-orange-100 text-orange-800';
      case 'ai': return 'bg-indigo-100 text-indigo-800';
      case 'general': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Создание новой базы знаний
  const handleCreateKB = async () => {
    if (!newKB.name.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newKB),
      });
      
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(prev => [...prev, data.knowledgeBase]);
        setNewKB({ name: '', description: '', category: 'general' });
        setShowCreateModal(false);
      } else if (response.status === 401) {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error creating knowledge base:', error);
    }
  };

  const handleDeleteKB = async (kb: KnowledgeBase) => {
    if (!confirm('Вы уверены, что хотите удалить эту базу знаний?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/knowledge?id=${kb.id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setKnowledgeBases(prev => prev.filter(item => item.id !== kb.id));
      } else if (response.status === 401) {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      alert('Ошибка удаления базы знаний');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка баз знаний...</p>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📚 Базы знаний</h1>
              <p className="text-gray-600">Управление знаниями и документацией для AI</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Создать базу знаний</span>
            </button>
          </div>

          <div className="space-y-8">
            {/* Knowledge Bases Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          База знаний
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Категория
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Статус
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Документы
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Точность
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Размер
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Обновлена
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {knowledgeBases.map((kb) => (
                        <tr key={kb.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="text-xl mr-3">{getCategoryIcon(kb.category)}</div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{kb.name}</div>
                                <div className="text-sm text-gray-500">{kb.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(kb.category)}`}>
                              {kb.category === 'technical' ? 'Техническая' :
                               kb.category === 'business' ? 'Бизнес' :
                               kb.category === 'ai' ? 'AI' : 'Общая'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(kb.status)}`}>
                              {kb.status === 'ready' ? 'Готова' :
                               kb.status === 'training' ? 'Обучение' : 'Активна'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              📄 {kb.documents}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              📊 {kb.accuracy}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {kb.size}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {kb.lastUpdated}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => router.push(`/knowledge/${kb.id}`)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                                title="Открыть"
                              >
                                📂
                              </button>
                              <button
                                onClick={() => handleDeleteKB(kb)}
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
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статистика баз знаний</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{knowledgeBases.length}</div>
                  <div className="text-sm text-gray-600">Всего баз</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {knowledgeBases.reduce((sum, kb) => sum + kb.documents, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Документов</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(knowledgeBases.reduce((sum, kb) => sum + kb.accuracy, 0) / knowledgeBases.length)}%
                  </div>
                  <div className="text-sm text-gray-600">Средняя точность</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {knowledgeBases.reduce((sum, kb) => sum + kb.usage, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Использований</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Knowledge Base Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Создать базу знаний</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название базы знаний
                </label>
                <input
                  type="text"
                  value={newKB.name}
                  onChange={(e) => setNewKB(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Введите название..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={newKB.description}
                  onChange={(e) => setNewKB(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Описание базы знаний..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Категория
                </label>
                <select
                  value={newKB.category}
                  onChange={(e) => setNewKB(prev => ({ ...prev, category: e.target.value as 'technical' | 'business' | 'general' | 'ai' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">📚 Общая</option>
                  <option value="technical">⚙️ Техническая</option>
                  <option value="business">💼 Бизнес</option>
                  <option value="ai">🤖 AI</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateKB}
                disabled={!newKB.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}