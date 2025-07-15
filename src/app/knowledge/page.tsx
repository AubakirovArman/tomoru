'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newKB, setNewKB] = useState({
    name: '',
    description: '',
    category: 'general' as 'technical' | 'business' | 'general' | 'ai'
  });
  const router = useRouter();

  // Загрузка баз знаний
  const fetchKnowledgeBases = async () => {
    try {
      const response = await fetch('/api/knowledge');
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(data.knowledgeBases || []);
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка документов для выбранной базы знаний
  const fetchDocuments = async (knowledgeBaseId: string) => {
    try {
      const response = await fetch(`/api/knowledge/documents?knowledgeBaseId=${knowledgeBaseId}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
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
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newKB),
      });
      
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(prev => [...prev, data.knowledgeBase]);
        setNewKB({ name: '', description: '', category: 'general' });
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Error creating knowledge base:', error);
    }
  };

  // Просмотр базы знаний
  const handleViewKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    if (kb.id) {
      fetchDocuments(kb.id);
    }
  };

  // Загрузка файла
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedKB?.id) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('knowledgeBaseId', selectedKB.id);
      
      const response = await fetch('/api/knowledge/documents', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => [...prev, data.document]);
        // Обновляем счетчик документов в базе знаний
        setSelectedKB(prev => prev ? { ...prev, documents: prev.documents + 1 } : null);
        setKnowledgeBases(prev => 
          prev.map(kb => 
            kb.id === selectedKB.id 
              ? { ...kb, documents: kb.documents + 1 }
              : kb
          )
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка загрузки файла');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Удаление документа
  const handleDeleteDocument = async (document: Document) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;
    
    try {
      const response = await fetch(
        `/api/knowledge/documents?fileId=${document.id}&knowledgeBaseId=${selectedKB?.id}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== document.id));
        // Обновляем счетчик документов
        setSelectedKB(prev => prev ? { ...prev, documents: prev.documents - 1 } : null);
        setKnowledgeBases(prev => 
          prev.map(kb => 
            kb.id === selectedKB?.id 
              ? { ...kb, documents: kb.documents - 1 }
              : kb
          )
        );
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Ошибка удаления документа');
    }
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return '📕';
      case 'txt': return '📝';
      case 'md': return '📋';
      case 'doc':
      case 'docx': return '📃';
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
                  <div className="flex space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.txt,.md,.doc,.docx"
                      className="hidden"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                    >
                      <span>📤</span>
                      <span>{uploading ? 'Загрузка...' : 'Загрузить документ'}</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">{getFileIcon(doc.type)}</div>
                        <div>
                          <h4 className="font-medium text-gray-800">{doc.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Размер: {doc.size}</span>
                            <span>Загружен: {doc.uploadDate}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              doc.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {doc.status === 'processed' ? 'Обработан' : 'В обработке'}
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
                        <button 
                          onClick={() => handleDeleteDocument(doc)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
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