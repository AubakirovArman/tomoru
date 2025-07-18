import { prisma } from './prisma';

export async function checkQuickReply(botId: number, userMessage: string): Promise<string | null> {
  try {
    console.log('checkQuickReply called with botId:', botId, 'userMessage:', userMessage);
    
    // Нормализуем сообщение пользователя
    const normalizedMessage = normalizeText(userMessage);
    console.log('Normalized message:', normalizedMessage);
    
    // Получаем все быстрые ответы для данного бота
    const quickReplies = await prisma.quickReplies.findMany({
      where: {
        botId: botId
      }
    });
    
    console.log('Found quick replies for bot:', quickReplies.length);

    // Проверяем каждый быстрый ответ
    for (const quickReply of quickReplies) {
      console.log('Checking quick reply:', quickReply.question, 'variations:', quickReply.variations);
      
      // Проверяем основной вопрос
      const normalizedQuestion = normalizeText(quickReply.question);
      console.log('Comparing normalized question:', normalizedQuestion, 'with message:', normalizedMessage);
      
      if (normalizedQuestion === normalizedMessage) {
        console.log('Exact match found for question!');
        return quickReply.answer;
      }
      
      // Проверяем вариации
      for (const variation of quickReply.variations) {
        const normalizedVariation = normalizeText(variation);
        console.log('Comparing variation:', normalizedVariation, 'with message:', normalizedMessage);
        
        if (normalizedVariation === normalizedMessage) {
          console.log('Exact match found for variation!');
          return quickReply.answer;
        }
      }
      
      // Проверяем частичное совпадение (если больше 70% слов совпадают)
      if (isPartialMatch(normalizedMessage, quickReply.question) ||
          quickReply.variations.some((variation: string) => isPartialMatch(normalizedMessage, variation))) {
        console.log('Partial match found!');
        return quickReply.answer;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking quick reply:', error);
    return null;
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isPartialMatch(userMessage: string, quickReplyText: string): boolean {
  const userWords = userMessage.split(' ').filter((word: string) => word.length > 2);
  const quickReplyWords = quickReplyText.toLowerCase().split(' ').filter((word: string) => word.length > 2);
  
  if (userWords.length === 0 || quickReplyWords.length === 0) {
    return false;
  }
  
  const matchingWords = userWords.filter((word: string) => quickReplyWords.includes(word));
  const matchPercentage = matchingWords.length / userWords.length;
  
  return matchPercentage >= 0.7;
}