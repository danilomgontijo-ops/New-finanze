import express from "express";
import { createServer as createViteServer } from "vite";

const BRAPI_TOKEN = 'npLFUVc2MqrSRoZQQ3BKJD';
const COINGECKO_API_KEY = 'CG-7dVoRyc9vAEQfsQyuMdTQqNd';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

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
  app.get("/api/tesouro", async (req, res) => {
    try {
        const TESOURO_CSV_URL = 'https://raw.githubusercontent.com/ghostnetrn/bot-tesouro-direto/refs/heads/main/rendimento_resgatar.csv';
        const response = await fetch(TESOURO_CSV_URL);
        if (!response.ok) throw new Error('Falha ao buscar CSV do Tesouro');
        const text = await response.text();
        res.send(text);
    } catch (error) {
        console.error("Tesouro proxy error:", error);
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

            const text = await response.text();

            if (!response.ok) {
              // console.warn(`BCB CDI returned error/warning ${response.status}. Serving generated CDI database.`);
              return res.json(generateSgsCdiHistory());
            }

            // Try to parse as JSON
            const data = JSON.parse(text);
            return res.json(data);
        } catch (fetchErr) {
            console.warn("BCB SGS fetch or parse error. serving generated/fallback CDI database.", fetchErr);
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


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
