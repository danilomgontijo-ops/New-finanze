import { Transaction, Category, SubCategory, CreditCard, UserSettings, AssetPrice } from "../types";

export interface FinancialAssistantPayload {
  question: string;
  financialSummary: {
    period: string;
    metrics: {
      totalIncome: number;
      totalExpense: number;
      balance: number;
      monthlyBudgetLimit: number;
      savingsRate: number;
    };
    categoryBreakdown: {
      name: string;
      amount: number;
      type: string;
      percentageOfExpense: number;
    }[];
    nathySummary: {
      totalNathyExpenses: number;
      userNetExpenses: number;
      sharedTransactionsCount: number;
    };
    creditCards: {
      name: string;
      limit: number;
      closingDay: number;
      dueDay: number;
      estimatedCurrentBill: number;
    }[];
    investments: {
      totalInvested: number;
      estimatedValue: number;
      assets: {
        ticker: string;
        quantity: number;
        avgPrice: number;
        currentPrice?: number;
        totalValue: number;
        category?: string;
      }[];
    };
    recentTransactionsSample: {
      date: string;
      description: string;
      amount: number;
      type: string;
      category: string;
      subCategory?: string;
      paymentMethod?: string;
      isShared?: boolean;
    }[];
  };
  history?: { role: 'user' | 'model'; text: string }[];
}

async function safePostJson<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed: any = null;

  if (text && text.trim().length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON (e.g. HTML error page or proxy error)
      if (text.includes('<!doctype html>') || text.includes('<html')) {
        throw new Error(`O servidor retornou uma resposta inesperada (HTML). Verifique se o servidor está ativo ou tente novamente.`);
      }
    }
  }

  if (!response.ok) {
    const errorMsg = parsed?.error || (parsed && typeof parsed === 'string' ? parsed : null) || `Erro HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return parsed as T;
}

export const GeminiService = {
  // Pergunta para a IA analisar os dados cadastrados (FinanZe AI Advisor)
  askFinances: async (payload: FinancialAssistantPayload): Promise<string> => {
    try {
      const data = await safePostJson<{ answer?: string }>('/api/gemini/ask-finances', payload);
      return data?.answer || "Sem resposta da IA.";
    } catch (error: any) {
      console.warn("[GeminiService] Aviso ao consultar IA:", error?.message || error);
      return "O serviço de IA está temporariamente indisponível. Suas informações financeiras e relatórios continuam funcionando normalmente.";
    }
  },

  // Análise financeira abrangente (CFO)
  analyzeFinances: async (transactions: Transaction[], categories: Category[], futureContext?: string): Promise<string> => {
    try {
      const data = await safePostJson<{ analysis?: string }>('/api/gemini/analyze', { transactions, categories, futureContext });
      return data?.analysis || "Análise concluída.";
    } catch (error: any) {
      console.warn("[GeminiService] Aviso ao analisar finanças:", error?.message || error);
      return "Ocorreu uma indisponibilidade temporária na IA. Consulte os dados e gráficos completos diretamente nas abas de Relatórios e Análises.";
    }
  },

  // Busca de dividendos e proventos com Google Search Grounding
  findDividends: async (tickers: string[], startDate: Date, endDate: Date): Promise<{ dividends: any[], sources: { uri: string, title: string }[], quotaExceeded?: boolean }> => {
    try {
      const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
      const endStr = endDate ? endDate.toISOString().split('T')[0] : '';

      const data = await safePostJson<{ dividends?: any[], sources?: { uri: string, title: string }[], quotaExceeded?: boolean }>(
        '/api/gemini/dividends',
        { tickers, startDate: startStr, endDate: endStr }
      );
      return { 
        dividends: data?.dividends || [], 
        sources: data?.sources || [], 
        quotaExceeded: !!data?.quotaExceeded 
      };
    } catch (error: any) {
      console.warn("[GeminiService] Proventos via IA temporariamente indisponíveis (fallback ativo):", error?.message || error);
      return { dividends: [], sources: [], quotaExceeded: true };
    }
  },

  // Eventos Corporativos (Split, Merge, Bonus)
  findCorporateEvents: async (assets: { ticker: string, firstDate: string }[]): Promise<{ events: any[], sources: { uri: string, title: string }[], quotaExceeded?: boolean }> => {
    try {
      const data = await safePostJson<{ events?: any[], sources?: { uri: string, title: string }[], quotaExceeded?: boolean }>(
        '/api/gemini/corporate-events',
        { assets }
      );
      return { 
        events: data?.events || [], 
        sources: data?.sources || [], 
        quotaExceeded: !!data?.quotaExceeded 
      };
    } catch (error: any) {
      console.warn("[GeminiService] Eventos corporativos via IA indisponíveis no momento:", error?.message || error);
      return { events: [], sources: [], quotaExceeded: true };
    }
  },

  // Cotações e Fatores de Ativos em Tempo Real
  fetchRealTimePrices: async (tickers: string[]): Promise<{ prices: any[], sources: { uri: string, title: string }[], quotaExceeded?: boolean }> => {
    try {
      const data = await safePostJson<{ prices?: any[], sources?: { uri: string, title: string }[], quotaExceeded?: boolean }>(
        '/api/gemini/prices',
        { tickers }
      );
      return { 
        prices: data?.prices || [], 
        sources: data?.sources || [], 
        quotaExceeded: !!data?.quotaExceeded 
      };
    } catch (error: any) {
      console.warn("[GeminiService] Cotações via IA indisponíveis no momento:", error?.message || error);
      return { prices: [], sources: [], quotaExceeded: true };
    }
  },

  // Cotação Histórica PTAX Forex
  fetchHistoricalForex: async (dateStr: string, currency: string = 'USD'): Promise<number> => {
    try {
      const data = await safePostJson<{ rate?: number }>(
        '/api/gemini/historical-forex',
        { date: dateStr, currency }
      );
      return Number(data?.rate) || 0;
    } catch (error: any) {
      console.warn("[GeminiService] Erro ao buscar forex histórico:", error?.message || error);
      return 0;
    }
  },

  // Leitura e parse de faturas/extratos
  parseInvoice: async (base64: string, mimeType: string): Promise<any[]> => {
    try {
      const data = await safePostJson<{ transactions?: any[] }>(
        '/api/gemini/parse-invoice',
        { base64, mimeType }
      );
      return data?.transactions || [];
    } catch (error: any) {
      console.warn("[GeminiService] Falha ao processar fatura com IA:", error?.message || error);
      throw error;
    }
  }
};
