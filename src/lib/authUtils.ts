/**
 * Утилиты для работы с авторизацией
 */

/**
 * Проверяет ответ API на ошибки авторизации и перенаправляет на страницу входа при необходимости
 * @param response - Response объект от fetch
 * @param router - Next.js router для навигации (опционально)
 * @returns true если нужно прервать выполнение, false если можно продолжать
 */
export const handleAuthError = (response: Response, router?: any): boolean => {
  if (response.status === 401) {
    // Токен недействителен, очищаем localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Перенаправляем на страницу входа
    if (router) {
      router.push('/');
    } else {
      window.location.href = '/';
    }
    
    return true; // Прерываем выполнение
  }
  
  return false; // Продолжаем выполнение
};

/**
 * Получает токен из localStorage
 * @returns токен или null если отсутствует
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Создает заголовки для авторизованных запросов
 * @param additionalHeaders - дополнительные заголовки
 * @returns объект с заголовками
 */
export const createAuthHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const token = getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    ...additionalHeaders
  };
};

/**
 * Проверяет, авторизован ли пользователь
 * @returns true если токен существует
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};