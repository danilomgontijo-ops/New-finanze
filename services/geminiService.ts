
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category } from "../types";

export const GeminiService = {
  // Analyze finances using high-reasoning Thinking Mode
  analyzeFinances: async (transactions: Transaction[], categories: Category[], futureContext?: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "API Key não configurada nas variáveis de ambiente.";
    }

    // Initialize GoogleGenAI right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const recentTransactions = transactions.slice(-100).map(t => ({
      date: t.date.split('T')[0],
      amount: t.amount,
      type: t.type,
      category: categories.find(c => c.id === t.categoryId)?.name || 'Unknown',
      description: t.description,
      tags: t.tags || []
    }));

    const prompt = `
      Atue como um Chief Financial Officer (CFO) pessoal e estrategista econômico.
      Analise o dataset financeiro fornecido e o contexto futuro.

      DADOS (Últimos 100 lançamentos):
      ${JSON.stringify(recentTransactions)}

      CONTEXTO E COMPROMISSOS FUTUROS:
      ${futureContext || "Não informado."}

      REGRA CRÍTICA - CONTEXTO DA ENTIDADE "NATHY":
      - Qualquer transação categorizada como "Nathy", ou contendo "(Parte Nathy)", ou "(Minha Parte)" refere-se a um SEGUNDO USUÁRIO (Cônjuge/Sócio) com fluxo de caixa próprio.
      - NÃO trate gastos da categoria "Nathy" como despesas supérfluas do usuário principal que devem ser cortadas. Trate-os como divisão de custos ou fluxo de caixa paralelo.
      - Ao analisar "Despesas", foque nas despesas REAIS do usuário principal (excluindo a parte da Nathy se for apenas um repasse).
      - Se houver lançamentos de "Dividir", entenda que o custo real do usuário é apenas a metade (ou a "Minha Parte").

      SUA TAREFA (Pense profundamente antes de responder):
      1. Identifique padrões de consumo que fogem à regra 50/30/20 (Considerando apenas a parte do usuário principal).
      2. Avalie o custo de oportunidade: Se o excedente for investido à taxa Selic atual, qual a projeção de patrimônio em 1 e 5 anos?
      3. Projete o fluxo de caixa para os próximos 3 meses baseado na recorrência detectada.
      4. Sugira realocações de orçamento de categorias "Desejos" para "Investimentos" com base no perfil de gastos.
      5. Identifique possíveis anomalias ou gastos duplicados/esquecidos.

      IMPORTANTE:
      Diferencie o que são investimentos (ativos que geram renda) de despesas (custos de vida).
      
      FORMATO:
      Use Markdown rico. Inclua uma seção "Insights Estratégicos" e outra "Plano de Ação Imediato".
    `;

    try {
      // Using gemini-3-pro-preview with thinking budget for deep financial reasoning
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 16384 } // Reduced slightly to save tokens
        }
      });
      
      return response.text || "O modelo não retornou uma análise. Tente novamente em alguns instantes.";
    } catch (error: any) {
      console.error("Gemini Strategic Analysis Error:", error);
      
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
          return "⚠️ Limite de uso da IA atingido (Quota Exceeded). Por favor, aguarde alguns minutos e tente novamente.";
      }
      
      return "Ocorreu um erro ao processar a análise profunda. Verifique sua conexão e tente novamente.";
    }
  },

  // Parse invoice file (PDF/Image) using OCR capabilities
  parseInvoice: async (fileBase64: string, mimeType: string): Promise<any[]> => {
    if (!process.env.API_KEY) {
      throw new Error("API Key not configured");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Extraia transações de fatura de cartão: data (YYYY-MM-DD), descrição e valor.
      Ignore pagamentos da fatura anterior. Retorne apenas JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: fileBase64 } }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              },
              required: ["date", "description", "amount"]
            }
          }
        }
      });
      
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Gemini OCR Error:", error);
      throw error;
    }
  },

 // Fetch historical PTAX
  fetchHistoricalForex: async (date: string, currency: string = 'USD'): Promise<number | null> => {
    if (!process.env.API_KEY) return null;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `PTAX venda BCB em ${date}. Apenas número decimal (ponto).`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
      });

      const text = response.text || "";
      const match = text.match(/(\d+[.,]\d+)/);
      if (match) {
        const rate = parseFloat(match[0].replace(',', '.'));
        return isNaN(rate) ? null : rate;
      }
      return null;
    } catch (error) {
      console.error("Gemini Forex Error:", error);
      return null;
    }
  },

  fetchRealTimePrices: async (tickers: string[]): Promise<{ prices: any[], sources: { uri: string, title: string }[] }> => {
    if (!process.env.API_KEY) throw new Error("API Key not configured");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Calcule valores atuais de ativos brasileiros.

      ATIVOS:
      ${tickers.join('\n')}

      REGRAS CRÍTICAS DE RENDA FIXA (CDB/LCI/LCA):
      - A entrada será: "Nome | Rentabilidade: X% (CDI ou IPCA+) | Data Base: YYYY-MM-DD"
      - A taxa fornecida (ex: 120% CDI, 13% pré, IPCA+6%) é SEMPRE uma taxa ANUAL (a.a.).
      - NÃO busque preço de mercado para estes ativos privados.
      - CALCULE o Fator de Acumulação:
        1. Busque o CDI acumulado ou IPCA acumulado desde a "Data Base" até hoje.
        2. Aplique a taxa anual sobre este acumulado (ex: CDI Acumulado * 1.20).
        3. Se for Taxa Pré (ex: 13%), calcule: (1 + 0.13)^(dias_uteis/252).
        4. O resultado deve ser o FATOR multiplicador (ex: 1.15 para 15% de lucro).
      
      REGRAS PARA TESOURO E AÇÕES:
      - TESOURO: Preço unitário de venda/resgate atual.
      - AÇÕES/FIIs: Cotação atual.

      SAÍDA ESPERADA: 
      NomeDoAtivo: ValorNumérico (Preço ou Fator)
    `;

    const processResponse = (response: any) => {
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      const prices: any[] = [];
      const lines = (response.text || "").split('\n').filter(line => line.trim());
      
      lines.forEach((line: string) => {
        const match = line.match(/^(.+?):\s*([\d.,]+)/);
        if (match) {
          let priceStr = match[2].replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
          const price = parseFloat(priceStr);
          
          const returnedTicker = match[1].trim();
          const originalTicker = tickers.find(t => t.toUpperCase().includes(returnedTicker.toUpperCase()) || returnedTicker.toUpperCase().includes(t.split('|')[0].trim().toUpperCase()));
          
          const tickerId = originalTicker ? (originalTicker.split('|')[0].trim().toUpperCase()) : returnedTicker.toUpperCase();

          if (!isNaN(price)) {
            prices.push({ ticker: tickerId, currentPrice: price });
          }
        }
      });

      return { prices, sources };
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
      });
      return processResponse(response);
    } catch (error: any) {
      console.error("Gemini Prices Error:", error);
      return { prices: [], sources: [] };
    }
  },

  findDividends: async (tickers: string[], startDate: Date, endDate: Date): Promise<{ dividends: any[], sources: { uri: string, title: string }[] }> => {
    if (!process.env.API_KEY) throw new Error("API Key not configured");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let startStr = "";
    let endStr = "";
    try {
      if (startDate && !isNaN(startDate.getTime())) {
        startStr = startDate.toISOString().split('T')[0];
      } else {
        startStr = new Date().toISOString().split('T')[0];
      }
      if (endDate && !isNaN(endDate.getTime())) {
        endStr = endDate.toISOString().split('T')[0];
      } else {
        endStr = new Date().toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("[GeminiService] Error formatting date strings", e);
      startStr = new Date().toISOString().split('T')[0];
      endStr = new Date().toISOString().split('T')[0];
    }

    const prompt = `
      Proventos (DIVIDEND/JCP/RENDIMENTO) para: ${tickers.join(', ')}.
      Data pagamento entre ${startStr} e ${endStr}.

      JSON array: [{ticker, type, paymentDate: YYYY-MM-DD, amount: number, currency, ptax: number (1 se BRL)}]
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      let jsonText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
      let dividends: any[] = [];
      try {
        dividends = JSON.parse(jsonText);
      } catch (e) {
        console.warn("Dividends JSON parse error:", e);
      }

      return { dividends, sources };
    } catch (error) {
      console.error("Gemini Dividends Error:", error);
      return { dividends: [], sources: [] };
    }
  },

  findCorporateEvents: async (assets: { ticker: string, firstDate: string }[]): Promise<{ events: any[], sources: { uri: string, title: string }[] }> => {
    if (!process.env.API_KEY) throw new Error("API Key not configured");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const assetListStr = assets.map(a => `${a.ticker} (a partir de ${a.firstDate})`).join(', ');

    const prompt = `
      Busque eventos corporativos de desdobramento (split), grupamento (reverse split/merge) e bonificações (bonus) para os seguintes ativos:
      ${assetListStr}
      
      LIMITAÇÃO TEMPORAL:
      Só retorne eventos que ocorreram DEPOIS ou NO MESMO MÊS da data inicial informada para cada ativo. Ignore eventos anteriores.
      
      IMPORTANTE:
      - Fator de desdobramento (SPLIT): Se for 1 para 4, o fator é 4.
      - Fator de grupamento (MERGE): Se for 10 para 1, o fator é 10.
      - Fator de bonificação (BONUS): Retorne a porcentagem em decimal. Exemplo: Bonificação de 10% = fator 0.10. Bonificação de 5% = fator 0.05.

      Retorne APENAS um array JSON no seguinte formato:
      [
        {
          "ticker": "PETR4",
          "date": "YYYY-MM-DD",
          "event": "SPLIT" ou "MERGE" ou "BONUS",
          "factor": numero (ex: 4 para desdobramento 1:4, 10 para grupamento 10:1, 0.10 para bonificação de 10%)
        }
      ]
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      let jsonText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
      let events: any[] = [];
      try {
        events = JSON.parse(jsonText);
      } catch (e) {
        console.warn("Corporate Events JSON parse error:", e);
      }

      return { events, sources };
    } catch (error) {
      console.error("Gemini Corporate Events Error:", error);
      return { events: [], sources: [] };
    }
  }
};
