'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navigation from '../../../components/Navigation';

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

export default function KnowledgeDetail() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kbId = Array.isArray(params.id) ? params.id[0] : params.id;

  const fetchKnowledgeBase = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/knowledge?id=${kbId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledgeBase(data.knowledgeBase);
      } else if (res.status === 401) {
        router.push('/');
        return;
      }
    } catch (err) {
      console.error('Error fetching knowledge base:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/knowledge/documents?knowledgeBaseId=${kbId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else if (response.status === 401) {
        router.push('/');
        return;
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
    if (!kbId) {
      router.push('/knowledge');
      return;
    }

    Promise.all([fetchKnowledgeBase(), fetchDocuments()]).finally(() => setLoading(false));
  }, [router, kbId]);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !kbId) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('knowledgeBaseId', kbId as string);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/knowledge/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => [...prev, data.document]);
        setKnowledgeBase(prev => prev ? { ...prev, documents: prev.documents + 1 } : null);
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

  const handleUrlUpload = async () => {
    if (!urlInput || !kbId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('url', urlInput);
      formData.append('knowledgeBaseId', kbId as string);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/knowledge/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => [...prev, data.document]);
        setKnowledgeBase(prev => prev ? { ...prev, documents: prev.documents + 1 } : null);
        setUrlInput('');
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка загрузки ссылки');
      }
    } catch (error) {
      console.error('Error uploading url:', error);
      alert('Ошибка загрузки ссылки');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/knowledge/documents?fileId=${document.id}&knowledgeBaseId=${kbId}`,
        { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== document.id));
        setKnowledgeBase(prev => prev ? { ...prev, documents: prev.documents - 1 } : null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Ошибка удаления документа');
    }
  };

  const handleViewDocument = async (document: Document) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `/api/knowledge/documents/${document.id}?knowledgeBaseId=${kbId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else if (res.status === 401) {
        router.push('/');
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка просмотра файла');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Ошибка просмотра файла');
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `/api/knowledge/documents/${document.id}?knowledgeBaseId=${kbId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = document.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else if (res.status === 401) {
        router.push('/');
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка скачивания файла');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Ошибка скачивания файла');
    }
  };

  const handleDeleteKnowledgeBase = async () => {
    if (!kbId || !confirm('Удалить эту базу знаний?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/knowledge?id=${kbId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        router.push('/knowledge');
      }
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      alert('Ошибка удаления базы знаний');
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
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-600">База знаний не найдена</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">{knowledgeBase.name}</h2>
                <p className="text-gray-600 mb-4">{knowledgeBase.description}</p>
                <div className="flex space-x-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(knowledgeBase.category)}`}>
                    {getCategoryIcon(knowledgeBase.category)} {knowledgeBase.category === 'technical' ? 'Техническая' :
                     knowledgeBase.category === 'business' ? 'Бизнес' :
                     knowledgeBase.category === 'ai' ? 'AI' : 'Общая'}
                  </span>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(knowledgeBase.status)}`}>
                    {knowledgeBase.status === 'ready' ? 'Готова' :
                     knowledgeBase.status === 'training' ? 'Обучение' : 'Активна'}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteKnowledgeBase}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  🗑️
                </button>
                <button
                  onClick={() => router.push('/knowledge')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{knowledgeBase.documents}</div>
                <div className="text-sm text-gray-600">Документов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{knowledgeBase.accuracy}%</div>
                <div className="text-sm text-gray-600">Точность</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{knowledgeBase.usage}</div>
                <div className="text-sm text-gray-600">Использований</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{knowledgeBase.size}</div>
                <div className="text-sm text-gray-600">Размер</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">📄 Документы</h3>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.txt,.md,.doc,.docx,.csv,.xls,.xlsx"
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
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="URL"
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={handleUrlUpload}
                      disabled={uploading || !urlInput}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      🔗
                    </button>
                  </div>
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
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            doc.status === 'processed'
                              ? 'bg-green-100 text-green-800'
                              : doc.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {doc.status === 'processed'
                            ? 'Обработан'
                            : doc.status === 'failed'
                            ? 'Ошибка'
                            : 'В обработке'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="text-green-600 hover:text-green-800 transition-colors"
                    >
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
      </div>
    </div>
  );
}
