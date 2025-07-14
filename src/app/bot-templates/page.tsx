'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';

interface BotTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  features: string[];
  setupData?: {
    required: string[];
    optional?: string[];
  };
  examplePrompt?: string;
  useCase: string;
  color: string;
}

const botTemplates: BotTemplate[] = [
  {
    id: 'hr-recruiter',
    name: 'Бот для найма персонала',
    description: 'Виртуальный рекрутер для первичного отбора кандидатов. Проводит интервью, рассказывает о компании и вакансии, собирает информацию о кандидате.',
    icon: '🧑‍💼',
    category: 'HR',
    features: [
      'Первичный скрининг кандидатов',
      'Структурированное интервью',
      'Презентация вакансии и компании',
      'Ответы на FAQ кандидатов',
      'Сбор данных о кандидате',
      'Профессиональный тон общения'
    ],
    setupData: {
      required: [
        'Описание вакансии (должность, обязанности, требования)',
        'Информация о компании (миссия, культура, условия)',
        'Ключевые вопросы для скрининга (3-5 вопросов)',
        'FAQ кандидатов с ответами',
        'Тон общения (профессиональный/неформальный)'
      ],
      optional: [
        'Интеграция базы знаний (PDF документы)',
        'Системный промпт для специфики компании'
      ]
    },
    examplePrompt: 'Вы – виртуальный HR-ассистент компании. Проведите первичное интервью с кандидатом: поприветствуйте, представьте вакансию, задайте ключевые вопросы об опыте, ответьте на вопросы кандидата и объясните следующие шаги.',
    useCase: 'Идеально для HR-отделов и рекрутинговых агентств',
    color: 'from-blue-500 to-purple-600'
  },
  {
    id: 'complaint-handler',
    name: 'Бот для обработки жалоб клиентов',
    description: 'Принимает и обрабатывает жалобы клиентов, классифицирует проблемы и направляет к соответствующим специалистам.',
    icon: '📝',
    category: 'Клиентский сервис',
    features: [
      'Прием жалоб 24/7',
      'Классификация проблем',
      'Эскалация к специалистам',
      'Отслеживание статуса'
    ],
    useCase: 'Для компаний с высоким объемом обращений клиентов',
    color: 'from-red-500 to-red-600'
  },
  {
    id: 'tech-support',
    name: 'Бот для технической поддержки',
    description: 'Решает технические вопросы пользователей, предоставляет инструкции и помогает с диагностикой проблем.',
    icon: '🔧',
    category: 'Техподдержка',
    features: [
      'Диагностика проблем',
      'Пошаговые инструкции',
      'База знаний',
      'Удаленная помощь'
    ],
    useCase: 'Для IT-компаний и сервисных центров',
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'sales-manager',
    name: 'Бот-менеджер по продажам',
    description: 'Ведет потенциальных клиентов через воронку продаж, отвечает на вопросы о продуктах и помогает с оформлением заказов.',
    icon: '💼',
    category: 'Продажи',
    features: [
      'Квалификация лидов',
      'Презентация продуктов',
      'Расчет стоимости',
      'Оформление заказов'
    ],
    useCase: 'Для увеличения конверсии и автоматизации продаж',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'marketing-assistant',
    name: 'Бот-ассистент маркетолог',
    description: 'Помогает с созданием маркетинговых кампаний, анализирует данные и предлагает стратегии продвижения.',
    icon: '📊',
    category: 'Маркетинг',
    features: [
      'Анализ аудитории',
      'Создание контента',
      'Планирование кампаний',
      'Аналитика результатов'
    ],
    useCase: 'Для маркетинговых команд и агентств',
    color: 'from-orange-500 to-orange-600'
  }
];

export default function BotTemplates() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const router = useRouter();

  const categories = ['Все', ...Array.from(new Set(botTemplates.map(bot => bot.category)))];
  
  const filteredBots = selectedCategory === 'Все' 
    ? botTemplates 
    : botTemplates.filter(bot => bot.category === selectedCategory);

  const handleCreateBot = (template: BotTemplate) => {
    // Перенаправляем на страницу создания бота с предзаполненными данными
    router.push(`/add-bot?template=${template.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🤖 Магазин шаблонов ботов
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Выберите готовый шаблон бота для вашего бизнеса. Каждый шаблон настроен для конкретных задач и готов к использованию.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Bot Templates Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBots.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${template.color} p-6 text-white`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{template.icon}</span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      {template.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{template.name}</h3>
                  <p className="text-white/90 text-sm">{template.description}</p>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Основные функции:</h4>
                    <ul className="space-y-2">
                      {template.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {template.setupData && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Необходимые данные:</h4>
                      <div className="text-sm text-gray-600">
                        <div className="mb-2">
                          <span className="font-medium">Обязательно:</span>
                          <ul className="ml-4 mt-1">
                            {template.setupData.required.map((item, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-red-500 mr-1">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {template.setupData.optional && (
                          <div>
                            <span className="font-medium">Опционально:</span>
                            <ul className="ml-4 mt-1">
                              {template.setupData.optional.map((item, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-500 mr-1">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {template.examplePrompt && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Пример промпта:</h4>
                      <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 italic">
                        "{template.examplePrompt}"
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <p className="text-sm text-gray-500 italic">{template.useCase}</p>
                  </div>

                  <button
                    onClick={() => handleCreateBot(template)}
                    className={`w-full bg-gradient-to-r ${template.color} text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg transition-all duration-300 group-hover:scale-105`}
                  >
                    Создать бота
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Не нашли подходящий шаблон?
              </h2>
              <p className="text-gray-600 mb-6">
                Создайте собственного бота с нуля или свяжитесь с нами для разработки индивидуального решения.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/add-bot')}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Создать с нуля
                </button>
                <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  Связаться с нами
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}