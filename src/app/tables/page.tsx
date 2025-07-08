'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface Table {
  id: number;
  name: string;
  description: string;
  rows: number;
  columns: number;
  lastModified: string;
  type: 'data' | 'analysis' | 'report';
  status: 'active' | 'processing' | 'completed';
  size: string;
}

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export default function Tables() {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTable, setNewTable] = useState({
    name: '',
    description: '',
    type: 'data' as 'data' | 'analysis' | 'report'
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Симуляция загрузки таблиц
    const mockTables: Table[] = [
      {
        id: 1,
        name: 'Пользователи системы',
        description: 'Данные всех зарегистрированных пользователей',
        rows: 1247,
        columns: 8,
        lastModified: '2 часа назад',
        type: 'data',
        status: 'active',
        size: '2.3 MB'
      },
      {
        id: 2,
        name: 'Анализ активности',
        description: 'Статистика использования функций AI',
        rows: 892,
        columns: 12,
        lastModified: '1 день назад',
        type: 'analysis',
        status: 'completed',
        size: '1.8 MB'
      },
      {
        id: 3,
        name: 'Отчет по сообщениям',
        description: 'Ежемесячный отчет по обработанным сообщениям',
        rows: 5634,
        columns: 6,
        lastModified: '3 дня назад',
        type: 'report',
        status: 'completed',
        size: '4.1 MB'
      },
      {
        id: 4,
        name: 'Обучающие данные',
        description: 'Датасет для обучения новых моделей',
        rows: 15000,
        columns: 20,
        lastModified: '1 неделя назад',
        type: 'data',
        status: 'processing',
        size: '12.7 MB'
      }
    ];

    setTables(mockTables);
    setLoading(false);
  }, [router]);

  const getTableIcon = (type: string) => {
    switch (type) {
      case 'data': return '📊';
      case 'analysis': return '📈';
      case 'report': return '📋';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'data': return 'bg-purple-100 text-purple-800';
      case 'analysis': return 'bg-orange-100 text-orange-800';
      case 'report': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewTable = (table: Table) => {
    setSelectedTable(table);
    
    // Симуляция загрузки данных таблицы
    const mockData: TableData = {
      headers: ['ID', 'Имя', 'Email', 'Дата регистрации', 'Статус', 'Сообщений', 'Последний вход'],
      rows: [
        [1, 'Иван Петров', 'ivan@example.com', '2024-01-15', 'Активен', 127, '2024-01-08 14:30'],
        [2, 'Мария Сидорова', 'maria@example.com', '2024-01-10', 'Активен', 89, '2024-01-08 12:15'],
        [3, 'Алексей Козлов', 'alex@example.com', '2024-01-05', 'Неактивен', 45, '2024-01-06 09:20'],
        [4, 'Елена Волкова', 'elena@example.com', '2024-01-20', 'Активен', 203, '2024-01-08 16:45'],
        [5, 'Дмитрий Новиков', 'dmitry@example.com', '2024-01-12', 'Активен', 156, '2024-01-08 11:30']
      ]
    };
    
    setTableData(mockData);
  };

  const handleCreateTable = () => {
    if (!newTable.name.trim()) return;

    const table: Table = {
      id: Date.now(),
      name: newTable.name,
      description: newTable.description,
      rows: 0,
      columns: 0,
      lastModified: 'Только что',
      type: newTable.type,
      status: 'active',
      size: '0 KB'
    };

    setTables(prev => [table, ...prev]);
    setNewTable({ name: '', description: '', type: 'data' });
    setShowCreateModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка таблиц...</p>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Таблицы</h1>
              <p className="text-gray-600">Управление данными и аналитическими таблицами</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Создать таблицу</span>
            </button>
          </div>

          {selectedTable && tableData ? (
            // Table View
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">{selectedTable.name}</h2>
                  <p className="text-gray-600">{selectedTable.description}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    setTableData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {tableData.headers.map((header, index) => (
                        <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tableData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                <span>Показано {tableData.rows.length} из {selectedTable.rows} записей</span>
                <div className="space-x-2">
                  <button className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded transition-colors">
                    Экспорт
                  </button>
                  <button className="bg-green-50 hover:bg-green-100 text-green-600 px-3 py-1 rounded transition-colors">
                    Редактировать
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Tables Grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {tables.map((table) => (
                <div key={table.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{getTableIcon(table.type)}</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{table.name}</h3>
                        <div className="flex space-x-2 mt-1">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(table.type)}`}>
                            {table.type === 'data' ? 'Данные' : 
                             table.type === 'analysis' ? 'Анализ' : 'Отчет'}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(table.status)}`}>
                            {table.status === 'active' ? 'Активна' : 
                             table.status === 'processing' ? 'Обработка' : 'Завершена'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{table.description}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Строк:</span>
                      <span className="font-medium">{table.rows.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Столбцов:</span>
                      <span className="font-medium">{table.columns}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Размер:</span>
                      <span className="font-medium">{table.size}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Изменена:</span>
                      <span className="font-medium">{table.lastModified}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleViewTable(table)}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded text-sm transition-colors"
                    >
                      Открыть
                    </button>
                    <button className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors">
                      📥
                    </button>
                    <button className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors">
                      ⚙️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статистика таблиц</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tables.length}</div>
                <div className="text-sm text-gray-600">Всего таблиц</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tables.reduce((sum, t) => sum + t.rows, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Всего строк</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {tables.filter(t => t.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">Активных</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {tables.filter(t => t.type === 'analysis').length}
                </div>
                <div className="text-sm text-gray-600">Аналитических</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Создать новую таблицу</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название таблицы
                </label>
                <input
                  type="text"
                  value={newTable.name}
                  onChange={(e) => setNewTable(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Введите название..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={newTable.description}
                  onChange={(e) => setNewTable(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Описание таблицы..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип таблицы
                </label>
                <select
                  value={newTable.type}
                  onChange={(e) => setNewTable(prev => ({ ...prev, type: e.target.value as 'data' | 'analysis' | 'report' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="data">📊 Данные</option>
                  <option value="analysis">📈 Анализ</option>
                  <option value="report">📋 Отчет</option>
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
                onClick={handleCreateTable}
                disabled={!newTable.name.trim()}
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