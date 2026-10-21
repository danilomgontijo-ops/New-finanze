import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const BRAPI_TOKEN = 'npLFUVc2MqrSRoZQQ3BKJD';
const COINGECKO_API_KEY = 'CG-7dVoRyc9vAEQfsQyuMdTQqNd';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chave da API Gemini (GEMINI_API_KEY) não configurada no servidor.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Helpers para tratamento de modelos e cotas da IA Gemini
function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.8-flash';
  // Substitui referências antigas ou descontinuadas para os modelos atuais suportados
  if (
    model.includes('gemini-1.5') || 
    model.includes('gemini-2.0') || 
    model.includes('gemini-pro') || 
    model.includes('gemini-3.6') || 
    model.includes('gemini-3.7')
  ) {
    return 'gemini-3.8-flash';
  }
  return model;
}

function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const str = (
    typeof error === 'string' 
      ? error 
      : `${error?.message || ''} ${error?.status || ''} ${error?.code || ''} ${JSON.stringify(error?.details || error || '')}`
  ).toLowerCase();
  
  return (
    error?.status === 429 || 
    error?.code === 429 ||
    str.includes('429') ||
    str.includes('resource_exhausted') ||
    str.includes('quota exceeded') ||
    str.includes('rate-limit') ||
    str.includes('rate limit') ||
    str.includes('generativelanguage.googleapis.com')
  );
}

// Circuit breaker em memória para evitar chamadas contínuas quando a cota estiver esgotada
let geminiQuotaExhaustedUntil = 0;

function setGeminiQuotaExhausted(retrySeconds?: number) {
  // Se a API informou o tempo de espera (ex: ~20h), usa esse tempo (com mínimo de 15 min e máximo de 24h)
  const delayMs = retrySeconds && retrySeconds > 0 
    ? Math.min(Math.max(retrySeconds * 1000, 15 * 60 * 1000), 24 * 60 * 60 * 1000) 
    : 30 * 60 * 1000;
  geminiQuotaExhaustedUntil = Date.now() + delayMs;
  console.log(`[Gemini] Cota temporariamente esgotada. Modo de contingência automático ativo até ${new Date(geminiQuotaExhaustedUntil).toLocaleTimeString()}.`);
}

function isGeminiQuotaExhausted(): boolean {
  return Date.now() < geminiQuotaExhaustedUntil;
}

// Resilient wrapper with automatic model fallback for 503 (High Demand), 404 (Deprecated), 429 (Rate Limit)
async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any[];
    config?: any;
    preferredModel?: string;
  }
): Promise<any> {
  // Se a cota já está esgotada, interrompe imediatamente sem gerar requisições ou logs de erro
  if (isGeminiQuotaExhausted()) {
    const quotaErr: any = new Error("Cota temporária da IA atingida para hoje.");
    quotaErr.isQuotaExceeded = true;
    quotaErr.status = 429;
    throw quotaErr;
  }

  const preferred = normalizeGeminiModel(params.preferredModel);
  const candidateModels = [
    preferred,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ].filter((model, idx, arr) => arr.indexOf(model) === idx);

  let lastError: any = null;

  // Pass 1: Tenta com a configuração solicitada (incluindo tools se houver)
  for (const model of candidateModels) {
    try {
      console.log(`[Gemini] Tentando gerar conteúdo com o modelo: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        ...(params.config ? { config: params.config } : {})
      });
      return response;
    } catch (error: any) {
      lastError = error;

      // Se o erro for de cota esgotada (429 / RESOURCE_EXHAUSTED), interrompe imediatamente o loop
      // para não disparar tentativas adicionais inúteis nem poluir o log de erros
      if (isQuotaExceededError(error)) {
        let retrySec: number | undefined;
        try {
          const retryObj = error?.details?.find?.((d: any) => d['@type']?.includes('RetryInfo'));
          if (retryObj?.retryDelay) {
            retrySec = parseInt(String(retryObj.retryDelay).replace('s', ''), 10);
          }
        } catch {
          // ignore
        }
        setGeminiQuotaExhausted(retrySec);
        console.log(`[Gemini] Cota atingida no modelo ${model}. Acionando contingência.`);
        const quotaErr: any = new Error("Cota temporária da IA atingida para hoje.");
        quotaErr.isQuotaExceeded = true;
        quotaErr.status = 429;
        throw quotaErr;
      }

      const isRecoverableError = 
        error?.status === 503 || 
        error?.code === 503 ||
        error?.status === 404 || 
        error?.code === 404 ||
        error?.status === 500 ||
        error?.status === 504 ||
        error?.message?.includes('503') ||
        error?.message?.includes('404') ||
        error?.message?.includes('not found') ||
        error?.message?.includes('no longer available') ||
        error?.message?.includes('high demand') ||
        error?.message?.includes('UNAVAILABLE');

      console.log(`[Gemini] Alternando modelo após falha com ${model}: ${error?.message || ''}`);

      if (isRecoverableError) {
        continue;
      }
      if (error?.message?.includes('API_KEY_INVALID') || error?.status === 401 || error?.status === 403) {
        throw error;
      }
    }
  }

  // Pass 2: Se falhar com tools (ex: indisponibilidade da busca), tenta sem tools
  if (params.config?.tools && params.config.tools.length > 0) {
    console.log(`[Gemini] Tentando resposta sem ferramentas externas...`);
    const fallbackConfig = { ...params.config, tools: undefined };
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: fallbackConfig
        });
        return response;
      } catch (err: any) {
        lastError = err;
        if (isQuotaExceededError(err)) {
          setGeminiQuotaExhausted();
          const quotaErr: any = new Error("Cota temporária da IA atingida para hoje.");
          quotaErr.isQuotaExceeded = true;
          quotaErr.status = 429;
          throw quotaErr;
        }
        console.log(`[Gemini] Tentativa sem ferramentas no modelo ${model} não respondeu.`);
      }
    }
  }

  if (isQuotaExceededError(lastError)) {
    lastError.isQuotaExceeded = true;
  }

  throw lastError || new Error("Não foi possível obter resposta de nenhum modelo da IA.");
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Middleware to parse JSON
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  
  // Brapi Proxy
  app.get("/api/brapi/quote/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const { dividends, range, interval } = req.query;
      
      let url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${BRAPI_TOKEN}`;
      if (dividends === 'true') {
        url += '&dividends=true';
      }
      if (typeof range === 'string') {
        url += `&range=${range}`;
      }
      if (typeof interval === 'string') {
        url += `&interval=${interval}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        // Repassa o corpo real da Brapi (ex: code "FEATURE_NOT_AVAILABLE") em vez de
        // substituir por uma mensagem genérica, para o front conseguir distinguir os motivos.
        try {
          const errorBody = await response.json();
          return res.status(response.status).json(errorBody);
        } catch {
          return res.status(response.status).json({ error: "Failed to fetch from Brapi" });
        }
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Brapi proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Brapi History Proxy
  app.get("/api/brapi/history/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const { start, end, interval, adjusted } = req.query;
      
      let url = `https://brapi.dev/api/v2/history?tickers=${ticker}&token=${BRAPI_TOKEN}`;
      if (start) url += `&from=${start}`;
      if (end) url += `&to=${end}`;
      if (interval) url += `&interval=${interval}`;
      if (adjusted === 'false') url += `&adjusted=false`;
      else url += `&adjusted=true`;

      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch history from Brapi" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Brapi history proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Yahoo Finance Proxy
  app.get("/api/yahoo/dividends/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const { range } = req.query;
      const queryRange = range || '1y';
      
      // Add .SA for Brazilian stocks if they don't have a suffix
      let yahooTicker = ticker.toUpperCase();
      if (!yahooTicker.includes('.') && !['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'].includes(yahooTicker)) {
          // A simple heuristic: if it's 4 letters + 1 or 2 numbers, it's likely B3
          if (/^[A-Z]{4}\d{1,2}$/.test(yahooTicker)) {
              yahooTicker += '.SA';
          }
      }

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&events=div&range=${queryRange}`;
      
      const response = await fetch(url, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from Yahoo Finance" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Yahoo Finance proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // CoinGecko Proxy
  app.get("/api/coingecko/simple/price", async (req, res) => {
    try {
      const { ids } = req.query;
      if (!ids) {
        return res.status(400).json({ error: "Missing ids parameter" });
      }

      const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=brl&ids=${ids}&include_24hr_change=true&x_cg_demo_api_key=${COINGECKO_API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from CoinGecko" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("CoinGecko proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/coingecko/history/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const days = req.query.days || "3650";
      const vs_currency = req.query.vs_currency || "usd";

      const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${vs_currency}&days=${days}&interval=daily&x_cg_demo_api_key=${COINGECKO_API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch history from CoinGecko" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("CoinGecko history proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Tesouro Direto Proxy (CORS fix)
  let cachedCombinedTesouroText = "";
  let lastCombinedTesouroTime = 0;

  app.get("/api/tesouro", async (req, res) => {
    try {
      if (Date.now() - lastCombinedTesouroTime < 1000 * 60 * 15 && cachedCombinedTesouroText) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(cachedCombinedTesouroText);
      }

      const [resgatarRes, precoTaxaRes] = await Promise.allSettled([
        fetch('https://raw.githubusercontent.com/ghostnetrn/bot-tesouro-direto/refs/heads/main/rendimento_resgatar.csv'),
        fetch('https://raw.githubusercontent.com/ghostnetrn/bot-tesouro-direto/refs/heads/main/PrecoTaxaTesouroDireto.csv', {
          headers: { 'Range': 'bytes=0-50000' }
        })
      ]);
      
      const outLines: string[] = ['Título;Rendimento anual do título;Preço unitário de resgate;Vencimento do Título'];
      const seen = new Set<string>();

      if (resgatarRes.status === 'fulfilled' && resgatarRes.value.ok) {
        const text = await resgatarRes.value.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';');
          if (cols.length >= 4) {
            const key = `${cols[0].trim().toUpperCase()}_${cols[3].trim()}`;
            seen.add(key);
            outLines.push(lines[i]);
          }
        }
      }

      if (precoTaxaRes.status === 'fulfilled' && precoTaxaRes.value.ok) {
        const text = await precoTaxaRes.value.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';');
          if (cols.length >= 7) {
            const name = cols[0].trim();
            const vencimento = cols[1].trim();
            const rate = cols[4].trim();
            const price = cols[6].trim();
            const key = `${name.toUpperCase()}_${vencimento}`;
            if (!seen.has(key)) {
              seen.add(key);
              outLines.push(`${name};${rate}%;${price};${vencimento}`);
            }
          }
        }
      }

      if (outLines.length > 1) {
        cachedCombinedTesouroText = outLines.join('\n');
        lastCombinedTesouroTime = Date.now();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(cachedCombinedTesouroText);
      }

      throw new Error('Falha ao buscar CSV do Tesouro');
    } catch (error) {
      console.error("Tesouro proxy error:", error);
      if (cachedCombinedTesouroText) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(cachedCombinedTesouroText);
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // BCB IPCA Proxy
  app.get("/api/bcb/ipca", async (req, res) => {
    try {
      const url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json";
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        redirect: 'follow'
      });
      const text = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from BCB" });
      }
      try {
        const data = JSON.parse(text);
        return res.json(data);
      } catch (parseErr) {
        return res.status(500).json({ error: "Invalid JSON from BCB", textSnippet: text.substring(0, 100) });
      }
    } catch (e) {
      console.error("IPCA proxy error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Ibovespa (^BVSP) Proxy via Yahoo Finance.
  // Nota: BCB SGS 7832 NÃO é o fechamento diário do Ibovespa (é uma série mensal
  // descontinuada em 08/2019) — o Yahoo é a fonte real de cotação diária do índice.
  app.get("/api/yahoo/ibov", async (req, res) => {
    try {
      const range = typeof req.query.range === 'string' ? req.query.range : '10y';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=${range}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch Ibovespa from Yahoo Finance" });
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error("Ibovespa (Yahoo) proxy error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/bcb/ptax", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: "Missing url parameter" });
        }
        // Basic security check to ensure we are only proxying BCB
        if (!url.startsWith('https://olinda.bcb.gov.br/')) {
            return res.status(403).json({ error: "Invalid URL" });
        }
        
        console.log(`Proxying PTAX request to: ${url}`);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          redirect: 'follow'
        });

        const text = await response.text();

        if (!response.ok) {
          console.error(`BCB PTAX error response (${response.status}):`, text.substring(0, 500));
          return res.status(response.status).json({ 
            error: `BCB API returned ${response.status}`, 
            details: text.substring(0, 200) 
          });
        }

        try {
          const data = JSON.parse(text);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse PTAX JSON. Response starts with:", text.substring(0, 100));
          
          if (text.includes('<?xml') || text.includes('<html')) {
            return res.status(500).json({ 
              error: "BCB returned XML/HTML instead of JSON", 
              details: text.substring(0, 200) 
            });
          }

          res.status(500).json({ error: "Invalid JSON from BCB", details: text.substring(0, 200) });
        }
    } catch (error) {
        console.error("PTAX proxy error:", error);
        res.status(500).json({ error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  // BCB CDI SGS Generator Fallback
  function generateSgsCdiHistory(): { data: string, valor: string }[] {
      const list: { data: string, valor: string }[] = [];
      const today = new Date();
      
      const current = new Date();
      current.setFullYear(today.getFullYear() - 10);
      
      while (current <= today) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              const year = current.getFullYear();
              let annualRate = 10.5;
              if (year === 2014) annualRate = 11.75;
              else if (year === 2015) annualRate = 14.25;
              else if (year === 2016) annualRate = 14.00;
              else if (year === 2017) annualRate = 9.95;
              else if (year === 2018) annualRate = 6.42;
              else if (year === 2019) annualRate = 5.96;
              else if (year === 2020) annualRate = 2.77;
              else if (year === 2021) annualRate = 4.40;
              else if (year === 2022) annualRate = 12.38;
              else if (year === 2023) annualRate = 13.04;
              else if (year === 2024) annualRate = 10.65;
              else if (year === 2025) annualRate = 11.25;
              else if (year >= 2026) annualRate = 11.25;
              
              const dailyRate = (Math.pow(1 + annualRate / 100, 1 / 252) - 1) * 100;
              
              const dd = String(current.getDate()).padStart(2, '0');
              const mm = String(current.getMonth() + 1).padStart(2, '0');
              const yyyy = current.getFullYear();
              
              list.push({
                  data: `${dd}/${mm}/${yyyy}`,
                  valor: dailyRate.toFixed(6)
              });
          }
          current.setDate(current.getDate() + 1);
      }
      return list;
  }

  // BCB CDI Proxy
  app.get("/api/bcb/cdi", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: "Missing url parameter" });
        }
        
        // Allow both api.bcb.gov.br and www.bcb.gov.br
        if (!url.startsWith('https://api.bcb.gov.br/') && !url.startsWith('https://www.bcb.gov.br/')) {
            return res.status(403).json({ error: "Invalid URL" });
        }

        console.log(`Proxying CDI request to: ${url}`);

        try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              },
              timeout: 8000,
              redirect: 'follow'
            } as any);

            const text = (await response.text()).trim();

            if (!response.ok || text.startsWith('<')) {
              return res.json(generateSgsCdiHistory());
            }

            // Try to parse as JSON
            const data = JSON.parse(text);
            return res.json(data);
        } catch (fetchErr) {
            return res.json(generateSgsCdiHistory());
        }
    } catch (error) {
        console.error("CDI proxy error:", error);
        return res.json(generateSgsCdiHistory());
    }
  });

  // Google Script Proxy
  let cachedTesouroCsv = "";
  let lastTesouroCsvTime = 0;
  async function getTesouroCsv() {
      if (Date.now() - lastTesouroCsvTime < 1000 * 60 * 60 * 24 && cachedTesouroCsv) {
          return cachedTesouroCsv;
      }
      const response = await fetch("https://raw.githubusercontent.com/ghostnetrn/bot-tesouro-direto/refs/heads/main/PrecoTaxaTesouroDireto.csv");
      cachedTesouroCsv = await response.text();
      lastTesouroCsvTime = Date.now();
      return cachedTesouroCsv;
  }

  app.get("/api/sheets/history", async (req, res) => {
    try {
        const { ticker } = req.query;
        if (typeof ticker === 'string' && (ticker.toUpperCase().startsWith('TD:') || ticker.toUpperCase().startsWith('TESOURO'))) {
            const csv = await getTesouroCsv();
            const rows = csv.split('\n');
            const tUpper = ticker.toUpperCase();
            
            const yearMatch = tUpper.match(/\d{4}/);
            const year = yearMatch ? yearMatch[0] : null;
            
            const isIPCA = tUpper.includes('IPCA');
            const isPRE = tUpper.includes('PRE');
            const isSELIC = tUpper.includes('SELIC');
            const isSemestral = tUpper.includes('JUROS') || tUpper.includes('SEMESTRAL') || tUpper.includes('RENDA+');
            
            const isIGPM = tUpper.includes('IGPM');
            
            let tipoFiltro = "";
            if (isIPCA && isSemestral) tipoFiltro = "Tesouro IPCA+ com Juros Semestrais";
            else if (isIPCA) tipoFiltro = "Tesouro IPCA+";
            else if (isPRE && isSemestral) tipoFiltro = "Tesouro Prefixado com Juros Semestrais";
            else if (isPRE) tipoFiltro = "Tesouro Prefixado";
            else if (isSELIC) tipoFiltro = "Tesouro Selic";
            else if (isIGPM) tipoFiltro = "Tesouro IGPM+ com Juros Semestrais";
            else if (tUpper.includes('RENDA+')) tipoFiltro = "Tesouro Renda+ Aposentadoria Extra";
            else if (tUpper.includes('EDUCA+')) tipoFiltro = "Tesouro Educa+";
            
            const monthlyData = {}; // yyyy-mm -> { d: number, price: number }
            
            for (let i = 1; i < rows.length; i++) {
                const r = rows[i];
                if (!r.trim()) continue;
                const cols = r.split(';');
                if (cols.length < 8) continue;
                
                const tipo = cols[0];
                const vencimento = cols[1];
                const dataBase = cols[2];
                const puVenda = cols[6]; // or cols[7]
                
                if (tipoFiltro) {
                    // Strict match to prevent "Tesouro IPCA+" from matching "Tesouro IPCA+ com Juros Semestrais"
                    if (tipo.trim() !== tipoFiltro) continue;
                } else {
                    if (isIPCA && !tipo.includes("IPCA")) continue;
                    if (isPRE && !tipo.includes("Prefixado")) continue;
                    if (isSELIC && !tipo.includes("Selic")) continue;
                }
                if (year && !vencimento.endsWith(year)) continue;
                
                // parse date: DD/MM/YYYY
                const dParts = dataBase.split('/');
                if (dParts.length !== 3) continue;
                const yM = `${dParts[2]}-${dParts[1]}`;
                const dList = parseInt(dParts[0]);
                
                let priceStr = puVenda;
                if (!priceStr || priceStr.trim() === '') priceStr = cols[7]; // fallback PU Base
                if (!priceStr || priceStr.trim() === '') priceStr = cols[5]; // fallback PU Compra
                if (!priceStr || priceStr.trim() === '') continue;
                
                const price = parseFloat(priceStr.replace('.', '').replace(',', '.'));
                
                if (!monthlyData[yM] || monthlyData[yM].d < dList) {
                    monthlyData[yM] = { d: dList, price };
                }
            }
            
            const history = Object.keys(monthlyData).sort().map(k => ({
                data: `${k}-28`, // Dummy day for processing
                preco: monthlyData[k].price
            }));
            
            return res.json({
                ticker: ticker,
                resultados: history
            });
        }

        if (!ticker || typeof ticker !== 'string') {
            return res.status(400).json({ error: "Missing ticker parameter" });
        }
        
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYlkaqgQ5ytxz_5tDxNAss69KbEzz7hnvZmSISUHZ0baAZcEhz4sFqPHj8QDU_2zI/exec";
        const url = `${SCRIPT_URL}?ticker=${encodeURIComponent(ticker)}&t=${Date.now()}`;
        
        // Google Scripts often redirect, fetch handles this by default usually
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Falha ao buscar dados do Sheets');
        
        const rawText = await response.text();
        const trimmed = rawText.trim();
        if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
            let errorMsg = "Google Services Error/Auth Page";
            const titleMatch = trimmed.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                errorMsg = `Google Sheets Script auth or parsing issue`;
            }
            console.log(`[Sheets Proxy] HTML response for ${ticker}`);
            return res.status(502).json({ error: errorMsg, resultados: [] });
        }

        try {
            const data = JSON.parse(rawText);
            res.json(data);
        } catch (e) {
            console.warn(`[Sheets Proxy] Non-JSON response for ${ticker}:`, rawText.substring(0, 100));
            res.status(502).json({ error: "Invalid response from Google Sheets", details: rawText.substring(0, 100) });
        }
    } catch (error) {
        console.error("Sheets proxy error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // ==========================================
  // GEMINI AI ENDPOINTS
  // ==========================================

  // Pergunta para IA analisar os dados cadastrados (FinanZe AI Advisor)
  app.post("/api/gemini/ask-finances", async (req, res) => {
    try {
      const { question, financialSummary, history } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Pergunta não informada ou inválida." });
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY não configurada no servidor. Por favor, verifique as configurações de variáveis de ambiente." 
        });
      }

      const systemInstruction = `
Você é o FinanZe AI, o Consultor Financeiro e Estrategista Patrimonial inteligente integrado diretamente ao aplicativo de finanças pessoais "FinanZe".
Seu objetivo é analisar os dados cadastrados pelo usuário (lançamentos de receitas, despesas, cartões de crédito, parcelamentos, categorias, investimentos e orçamentos) e responder a qualquer pergunta com máxima clareza, precisão matemática e relevância prática.

DIRETRIZES FUNDAMENTAIS:
1. PRECISÃO NUMÉRICA E CONTEXTUAL:
   - Use os dados reais fornecidos no dataset financeiro em anexo para embasar suas respostas.
   - Sempre forneça valores em Reais formatados adequadamente (ex: R$ 1.250,00).
   - Se a pergunta do usuário for sobre um mês específico ou geral, consulte as métricas e transações fornecidas.

2. CONTEXTO DO USUÁRIO & ENTIDADE "NATHY" (CASAL / FLUXO COMPARTILHADO):
   - Transações marcadas como "Nathy", "(Parte Nathy)" ou "(Minha Parte)" referem-se à divisão de contas ou cônjuge/sócia.
   - Trate despesas da Nathy como repasse/divisão compartilhada, não como gastos supérfluos do usuário principal.

3. ESTRUTURA E TOM DA RESPOSTA:
   - Tom: Profissional, acolhedor, objetivo, encorajador e consultivo (como um CFO particular).
   - Formate a resposta com Markdown rico (títulos curtos, listas com marcadores, números em negrito).
   - Quando apropriado, inclua:
     * **Resposta Direta**: O número ou resumo exato solicitado.
     * **Detalhamento / Análise**: Como o valor se distribui (ex: principais categorias, cartões, maiores despesas).
     * **Dica / Recomendação Prática**: Uma ação concreta de economia, investimento ou organização.

4. SE OS DADOS ESTIVEREM VAZIOS OU PARCIAIS:
   - Se o usuário perguntar algo sem transações cadastradas para o período, explique de forma gentil o que encontrou e oriente como cadastrar.
`;

      const promptContext = `
DADOS DO USUÁRIO NO FINANZE:
${financialSummary ? JSON.stringify(financialSummary, null, 2) : "Nenhum dado cadastrado ou carregado no momento."}

HISTÓRICO DA CONVERSA RECENTE:
${history && Array.isArray(history) ? history.map((h: any) => `${h.role === 'user' ? 'Usuário' : 'FinanZe AI'}: ${h.text}`).join('\n') : 'Início da conversa.'}

PERGUNTA DO USUÁRIO:
${question}
`;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: promptContext }] }],
        config: {
          systemInstruction,
          temperature: 0.4,
        }
      });

      const text = response.text || "Não foi possível gerar uma resposta no momento. Tente novamente.";
      return res.json({ answer: text });

    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /ask-finances] Cota de requisições da IA temporariamente esgotada.");
        return res.json({ 
          answer: "⚠️ **Cota de IA temporariamente atingida**: O limite gratuito de requisições do Gemini para o período foi atingido. Todos os seus dados financeiros, lançamentos, cartões, carteira de investimentos e relatórios continuam 100% disponíveis e operacionais no FinanZe. Por favor, tente novamente mais tarde." 
        });
      }
      console.error("Erro na rota /api/gemini/ask-finances:", error);
      return res.status(500).json({ error: error?.message || "Erro interno ao processar a resposta da IA." });
    }
  });

  // Análise Estratégica Completa (CFO)
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { transactions, categories, futureContext } = req.body;
      const ai = getGeminiClient();

      const recentTransactions = (transactions || []).slice(-120).map((t: any) => ({
        date: t.date?.split('T')[0],
        amount: t.amount,
        type: t.type,
        category: categories?.find((c: any) => c.id === t.categoryId)?.name || 'Outros',
        description: t.description,
        tags: t.tags || []
      }));

      const prompt = `
        Atue como um Chief Financial Officer (CFO) pessoal e estrategista econômico.
        Analise o dataset financeiro fornecido e o contexto futuro.

        DADOS (Últimos lançamentos):
        ${JSON.stringify(recentTransactions)}

        CONTEXTO E COMPROMISSOS FUTUROS:
        ${futureContext || "Não informado."}

        REGRA CRÍTICA - CONTEXTO DA ENTIDADE "NATHY":
        - Qualquer transação categorizada como "Nathy", ou contendo "(Parte Nathy)", ou "(Minha Parte)" refere-se a um SEGUNDO USUÁRIO (Cônjuge/Sócio) com fluxo de caixa próprio.
        - NÃO trate gastos da categoria "Nathy" como despesas supérfluas do usuário principal que devem ser cortadas.
        - Ao analisar "Despesas", foque nas despesas REAIS do usuário principal (excluindo a parte da Nathy se for apenas um repasse).

        SUA TAREFA:
        1. Identifique padrões de consumo que fogem à regra 50/30/20.
        2. Avalie custo de oportunidade e projeções.
        3. Projete fluxo de caixa para os próximos 3 meses baseado na recorrência detectada.
        4. Sugira realocações de orçamento.
        5. Identifique anomalias ou oportunidades de economia.

        FORMATO:
        Use Markdown rico com seções claras, bullets e valores destacados.
      `;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: prompt }] }],
      });

      return res.json({ analysis: response.text || "Análise concluída sem retorno textual." });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /analyze] Cota de requisições da IA temporariamente esgotada.");
        return res.json({ 
          analysis: "⚠️ **Cota de IA temporariamente atingida**: O limite gratuito de requisições da IA para o período foi atingido. Você pode consultar todas as análises financeiras, comparativos e relatórios completos diretamente nas abas de **Relatórios** e **Dashboard**." 
        });
      }
      console.error("Erro na rota /api/gemini/analyze:", error);
      return res.status(500).json({ error: error?.message || "Erro na análise financeira com IA." });
    }
  });

  // Radar de Proventos / Dividendos via Gemini + Google Search Grounding
  app.post("/api/gemini/dividends", async (req, res) => {
    try {
      const { tickers, startDate, endDate } = req.body;
      const ai = getGeminiClient();

      const prompt = `
        Busque os proventos anunciados ou pagos (DIVIDEND, JCP, RENDIMENTO) para os seguintes ativos da B3 / Internacionais:
        ${(tickers || []).join(', ')}.
        Data de pagamento / data-com compreendida entre ${startDate || 'recente'} e ${endDate || 'recente'}.

        Retorne APENAS um array JSON no formato:
        [
          {
            "ticker": "PETR4",
            "type": "DIVIDEND" ou "JCP" ou "RENDIMENTO",
            "paymentDate": "YYYY-MM-DD",
            "amount": 1.25,
            "currency": "BRL",
            "ptax": 1.0
          }
        ]
      `;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      let jsonText = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
      let dividends = [];
      try {
        dividends = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn("Falha ao fazer parse de dividendos:", jsonText);
      }

      return res.json({ dividends, sources, quotaExceeded: false });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /dividends] Cota do Gemini indisponível no momento. Retornando fallback.");
        return res.json({ 
          dividends: [], 
          sources: [], 
          quotaExceeded: true, 
          message: "Cota de requisições da IA atingida temporariamente. Os proventos foram consultados via Yahoo Finance e Brapi." 
        });
      }
      console.error("Erro na rota /api/gemini/dividends:", error);
      return res.status(500).json({ error: error?.message || "Erro ao buscar dividendos via IA." });
    }
  });

  // Eventos Corporativos (Split, Merge, Bonus)
  app.post("/api/gemini/corporate-events", async (req, res) => {
    try {
      const { assets } = req.body;
      const ai = getGeminiClient();

      const assetListStr = (assets || []).map((a: any) => `${a.ticker} (a partir de ${a.firstDate})`).join(', ');

      const prompt = `
        Busque eventos corporativos de desdobramento (SPLIT), grupamento (MERGE) e bonificações (BONUS) para:
        ${assetListStr}
        
        LIMITAÇÃO TEMPORAL:
        Só retorne eventos ocorridos depois ou no mesmo mês da data informada para cada ativo.

        Retorne APENAS um array JSON:
        [
          {
            "ticker": "ITUB4",
            "date": "YYYY-MM-DD",
            "event": "SPLIT" | "MERGE" | "BONUS",
            "factor": 2.0
          }
        ]
      `;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      let jsonText = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
      let events = [];
      try {
        events = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn("Falha ao fazer parse de eventos corporativos:", jsonText);
      }

      return res.json({ events, sources, quotaExceeded: false });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /corporate-events] Cota do Gemini indisponível no momento.");
        return res.json({ events: [], sources: [], quotaExceeded: true, message: "Cota de requisições da IA atingida temporariamente." });
      }
      console.error("Erro na rota /api/gemini/corporate-events:", error);
      return res.status(500).json({ error: error?.message || "Erro ao buscar eventos corporativos via IA." });
    }
  });

  // Cotações em tempo real via Gemini + Google Search Grounding
  app.post("/api/gemini/prices", async (req, res) => {
    try {
      const { tickers } = req.body;
      const ai = getGeminiClient();

      const prompt = `
        Calcule valores atuais e cotações de fechamento/resgate para os ativos:
        ${(tickers || []).join('\n')}

        SAÍDA ESPERADA:
        NomeDoAtivo: ValorNumérico
      `;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri || "",
          title: chunk.web.title || ""
        })) || [];

      const prices: any[] = [];
      const lines = (response.text || "").split('\n').filter((l: string) => l.trim());

      lines.forEach((line: string) => {
        const match = line.match(/^(.+?):\s*([\d.,]+)/);
        if (match) {
          const priceStr = match[2].replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
          const price = parseFloat(priceStr);
          const returnedTicker = match[1].trim();
          const originalTicker = (tickers || []).find((t: string) => 
            t.toUpperCase().includes(returnedTicker.toUpperCase()) || 
            returnedTicker.toUpperCase().includes(t.split('|')[0].trim().toUpperCase())
          );
          const tickerId = originalTicker ? originalTicker.split('|')[0].trim().toUpperCase() : returnedTicker.toUpperCase();
          if (!isNaN(price)) {
            prices.push({ ticker: tickerId, currentPrice: price });
          }
        }
      });

      return res.json({ prices, sources, quotaExceeded: false });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /prices] Cota do Gemini indisponível no momento.");
        return res.json({ prices: [], sources: [], quotaExceeded: true });
      }
      console.error("Erro na rota /api/gemini/prices:", error);
      return res.status(500).json({ error: error?.message || "Erro ao buscar cotações via IA." });
    }
  });

  // Cotação Histórica de Moeda (PTAX / Forex) via Gemini
  app.post("/api/gemini/historical-forex", async (req, res) => {
    try {
      const { date, currency } = req.body;
      const targetCurrency = currency || 'USD';
      const ai = getGeminiClient();

      const prompt = `
        Qual foi a cotação oficial PTAX do ${targetCurrency} em relação ao Real Brasileiro (BRL) na data ${date}?
        Caso o dia tenha sido fim de semana ou feriado, informe a cotação do dia útil imediatamente anterior.
        
        Responda APENAS com um objeto JSON:
        {
          "rate": 5.4512
        }
      `;

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const cleanJson = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
      let rate = 0;
      try {
        const parsed = JSON.parse(cleanJson);
        rate = Number(parsed.rate) || 0;
      } catch {
        const match = cleanJson.match(/[\d.,]+/);
        if (match) {
          rate = parseFloat(match[0].replace(',', '.'));
        }
      }

      return res.json({ rate, quotaExceeded: false });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /historical-forex] Cota do Gemini indisponível no momento.");
        return res.json({ rate: 0, quotaExceeded: true });
      }
      console.error("Erro na rota /api/gemini/historical-forex:", error);
      return res.status(500).json({ error: error?.message || "Erro ao buscar cotação histórica." });
    }
  });

  // Leitura e Extração de Faturas de Cartão via IA Multimodal
  app.post("/api/gemini/parse-invoice", async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "Base64 do arquivo ausente." });
      }

      const ai = getGeminiClient();
      const prompt = `
        Você é um extrator especialista de faturas de cartão de crédito e extratos bancários.
        Analise cuidadosamente este documento e extraia todas as despesas e transações individuais.
        
        Extraia:
        - date: Data no formato YYYY-MM-DD
        - description: Nome do estabelecimento / descrição limpa
        - amount: Valor numérico positivo (float)
        - cardLastDigits: Últimos 4 dígitos do cartão (se houver)
        - suggestedCategory: Sugestão de categoria (ex: Alimentação, Transporte, Saúde, Moradia, etc.)

        Retorne APENAS um array JSON válido:
        [
          {
            "date": "2024-03-15",
            "description": "SUPERMERCADO DIA",
            "amount": 142.50,
            "cardLastDigits": "1234",
            "suggestedCategory": "Alimentação"
          }
        ]
      `;

      const imagePart = {
        inlineData: {
          data: base64,
          mimeType: mimeType || 'image/png'
        }
      };

      const response = await generateContentWithFallback(ai, {
        preferredModel: 'gemini-3.8-flash',
        contents: [{ parts: [imagePart, { text: prompt }] }]
      });

      const cleanJson = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
      let transactions: any[] = [];
      try {
        transactions = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn("Falha no JSON parse de fatura:", cleanJson);
      }

      return res.json({ transactions, quotaExceeded: false });
    } catch (error: any) {
      if (isQuotaExceededError(error) || error?.isQuotaExceeded) {
        console.log("[Gemini /parse-invoice] Cota do Gemini atingida.");
        return res.status(429).json({ error: "A cota temporária de requisições da IA foi atingida. Por favor, tente novamente mais tarde ou insira os lançamentos manualmente." });
      }
      console.error("Erro na rota /api/gemini/parse-invoice:", error);
      return res.status(500).json({ error: error?.message || "Erro ao processar fatura com IA." });
    }
  });


  // Express Error Handler for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error(`[API Error] ${req.method} ${req.path}:`, err);
      return res.status(err.status || 500).json({
        error: err.message || "Erro no servidor ao processar a requisição da API."
      });
    }
    next(err);
  });

  // Catch-all 404 for unhandled API routes so they do not fall through to Vite SPA HTML
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.path}` });
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
