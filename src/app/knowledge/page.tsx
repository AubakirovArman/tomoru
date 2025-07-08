'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  category: 'technical' | 'business' | 'general' | 'ai';
  documents: number;
  size: string;
  lastUpdated: string;
  status: 'active' | 'training' | 'ready';
  accuracy: number;
  usage: number;
}

interface Document {
  id: number;
  title: string;
  type: 'pdf' | 'txt' | 'md' | 'doc';
  size: string;
  uploadDate: string;
  processed: boolean;
}

export default function Knowledge() {
  const [loading, setLoading] = useState(true);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKB, setNewKB] = useState({
    name: '',
    description: '',
    category: 'general' as 'technical' | 'business' | 'general' | 'ai'
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Симуляция загрузки баз знаний
    const mockKnowledgeBases: KnowledgeBase[] = [
      {
        id: 1,
        name: 'Техническая документация',
        description: 'Руководства по API, SDK и техническим процессам',
        category: 'technical',
        documents: 127,
        size: '45.2 MB',
        lastUpdated: '2 часа назад',
        status: 'ready',
        accuracy: 94,
        usage: 1247
      },
      {
        id: 2,
        name: 'Бизнес-процессы',
        description: 'Описание рабочих процессов и политик компании',
        category: 'business',
        documents: 89,
        size: '23.8 MB',
        lastUpdated: '1 день назад',
        status: 'active',
        accuracy: 87,
        usage: 892
      },
      {
        id: 3,
        name: 'AI и машинное обучение',
        description: 'Исследования, статьи и документация по AI',
        category: 'ai',
        documents: 234,
        size: '78.5 MB',
        lastUpdated: '3 дня назад',
        status: 'training',
        accuracy: 91,
        usage: 567
      },
      {
        id: 4,
        name: 'Общие знания',
        description: 'Справочная информация и FAQ',
        category: 'general',
        documents: 156,
        size: '34.1 MB',
        lastUpdated: '1 неделя назад',
        status: 'ready',
        accuracy: 89,
        usage: 1456
      }
    ];

    setKnowledgeBases(mockKnowledgeBases);
    setLoading(false);
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

  const handleViewKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    
    // Симуляция загрузки документов
    const mockDocuments: Document[] = [
      {
        id: 1,
        title: 'API Reference Guide',
        type: 'pdf',
        size: '2.3 MB',
        uploadDate: '2024-01-05',
        processed: true
      },
      {
        id: 2,
        title: 'Getting Started Tutorial',
        type: 'md',
        size: '156 KB',
        uploadDate: '2024-01-03',
        processed: true
      },
      {
        id: 3,
        title: 'Advanced Configuration',
        type: 'txt',
        size: '89 KB',
        uploadDate: '2024-01-01',
        processed: false
      },
      {
        id: 4,
        title: 'Troubleshooting Guide',
        type: 'doc',
        size: '1.1 MB',
        uploadDate: '2023-12-28',
        processed: true
      }
    ];
    
    setDocuments(mockDocuments);
  };

  const handleCreateKB = () => {
    if (!newKB.name.trim()) return;

    const kb: KnowledgeBase = {
      id: Date.now(),
      name: newKB.name,
      description: newKB.description,
      category: newKB.category,
      documents: 0,
      size: '0 KB',
      lastUpdated: 'Только что',
      status: 'active',
      accuracy: 0,
      usage: 0
    };

    setKnowledgeBases(prev => [kb, ...prev]);
    setNewKB({ name: '', description: '', category: 'general' });
    setShowCreateModal(false);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'txt': return '📝';
      case 'md': return '📋';
      case 'doc': return '📃';
      default: return '📄';
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

          {selectedKB ? (
            // Knowledge Base Detail View
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">{selectedKB.name}</h2>
                    <p className="text-gray-600 mb-4">{selectedKB.description}</p>
                    <div className="flex space-x-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(selectedKB.category)}`}>
                        {getCategoryIcon(selectedKB.category)} {selectedKB.category === 'technical' ? 'Техническая' : 
                         selectedKB.category === 'business' ? 'Бизнес' : 
                         selectedKB.category === 'ai' ? 'AI' : 'Общая'}
                      </span>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedKB.status)}`}>
                        {selectedKB.status === 'ready' ? 'Готова' : 
                         selectedKB.status === 'training' ? 'Обучение' : 'Активна'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedKB(null);
                      setDocuments([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedKB.documents}</div>
                    <div className="text-sm text-gray-600">Документов</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedKB.accuracy}%</div>
                    <div className="text-sm text-gray-600">Точность</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{selectedKB.usage}</div>
                    <div className="text-sm text-gray-600">Использований</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{selectedKB.size}</div>
                    <div className="text-sm text-gray-600">Размер</div>
                  </div>
                </div>
              </div>

              {/* Documents List */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">📄 Документы</h3>
                  <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
                    <span>📤</span>
                    <span>Загрузить документ</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">{getFileIcon(doc.type)}</div>
                        <div>
                          <h4 className="font-medium text-gray-800">{doc.title}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Размер: {doc.size}</span>
                            <span>Загружен: {doc.uploadDate}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              doc.processed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {doc.processed ? 'Обработан' : 'В обработке'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 transition-colors">
                          👁️
                        </button>
                        <button className="text-green-600 hover:text-green-800 transition-colors">
                          📥
                        </button>
                        <button className="text-red-600 hover:text-red-800 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Knowledge Bases Grid
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getCategoryIcon(kb.category)}</div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{kb.name}</h3>
                          <div className="flex space-x-2 mt-1">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(kb.category)}`}>
                              {kb.category === 'technical' ? 'Техническая' : 
                               kb.category === 'business' ? 'Бизнес' : 
                               kb.category === 'ai' ? 'AI' : 'Общая'}
                            </span>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(kb.status)}`}>
                              {kb.status === 'ready' ? 'Готова' : 
                               kb.status === 'training' ? 'Обучение' : 'Активна'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">{kb.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Документов:</span>
                        <span className="font-medium">{kb.documents}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Точность:</span>
                        <span className="font-medium">{kb.accuracy}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Использований:</span>
                        <span className="font-medium">{kb.usage}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Размер:</span>
                        <span className="font-medium">{kb.size}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Обновлена:</span>
                        <span className="font-medium">{kb.lastUpdated}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleViewKB(kb)}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded text-sm transition-colors"
                      >
                        Открыть
                      </button>
                      <button className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors">
                        📤
                      </button>
                      <button className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors">
                        ⚙️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
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
          )}
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