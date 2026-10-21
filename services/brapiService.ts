
const BASE_URL = '/api/brapi/quote';
// Using the raw CSV source which is more reliable than scraping the HTML view
const TESOURO_CSV_URL = '/api/tesouro';

/**
 * Helper resiliente para requisições de APIs externas / proxies.
 * Valida o content-type e evita erros do tipo:
 * SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
 */
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("json") && !contentType.includes("text/plain")) {
      return null;
    }
    const text = await response.text();
    if (!text || text.trim().startsWith("<")) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const COIN_MAP: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'MATIC': 'matic-network',
    'DOT': 'polkadot',
    'LTC': 'litecoin',
    'LINK': 'chainlink',
    'ATOM': 'cosmos',
    'XLM': 'stellar',
    'BCH': 'bitcoin-cash',
    'ALGO': 'algorand',
    'NEAR': 'near',
    'UNI': 'uniswap',
    'AVAX': 'avalanche-2',
    'DAI': 'dai',
    'TRX': 'tron',
    'WBTC': 'wrapped-bitcoin',
    'ETC': 'ethereum-classic',
    'FIL': 'filecoin',
    'XMR': 'monero',
    'APT': 'aptos',
    'HBAR': 'hedera-hashgraph',
    'VET': 'vechain',
    'AAVE': 'aave',
    'PEPE': 'pepe',
    'SHIB': 'shiba-inu'
};

export const BrapiService = {
  isCrypto: (ticker: string): boolean => {
      const clean = ticker.trim().toUpperCase().replace(/BRL$/, '');
      return !!COIN_MAP[clean] || ticker.toUpperCase().includes('CRIPT');
  },

  isTesouro: (ticker: string): boolean => {
      if (!ticker) return false;
      const clean = ticker.trim().toUpperCase();
      return clean.startsWith('TD:') ||
        clean.startsWith('TESOURO') ||
        clean.startsWith('NTN') ||
        clean.startsWith('LFT') ||
        clean.startsWith('LTN') ||
        clean.includes('TESOURO') ||
        /^TD[_\-:]/i.test(ticker.trim()) ||
        /^(IPCA|PRE|SELIC|RENDA|EDUCA|IGPM)\+?\s*20\d{2}/i.test(clean);
  },

  normalizeTesouroTicker: (ticker: string): string => {
      if (!ticker) return '';
      const clean = ticker.toUpperCase()
        .replace(/^TD:/, '')
        .replace(/^TESOURO[\s_:-]*/, '')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '');

      let type = '';
      if (clean.includes('PREFIXADO') || clean.includes('PRE')) type = 'PRE';
      else if (clean.includes('IPCA') || clean.includes('IPC')) type = 'IPCA';
      else if (clean.includes('SELIC') || clean.includes('LFT')) type = 'SELIC';
      else if (clean.includes('RENDA')) type = 'RENDA';
      else if (clean.includes('EDUCA')) type = 'EDUCA';
      else if (clean.includes('IGPM')) type = 'IGPM';

      const yearMatch = clean.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : '';
      const hasJuros = clean.includes('JUROS') || clean.includes('COMJUROS') || clean.includes('SEM');

      return (type || clean) + year + (hasJuros ? 'JUROS' : '');
  },

  fetchTesouroPrice: async (ticker: string): Promise<{ ticker: string, currentPrice: number, changePercent?: number, longName?: string } | null> => {
      try {
        const allBonds = await BrapiService.fetchTesouroDireto();
        if (!allBonds || allBonds.length === 0) return null;

        const cleanInput = ticker.trim().toUpperCase();
        const normalizedTarget = BrapiService.normalizeTesouroTicker(cleanInput);

        // 1. Tenta match exato pelo ticker
        const exactMatch = allBonds.find(b => b.ticker.toUpperCase() === cleanInput);
        if (exactMatch) {
          return {
            ticker,
            currentPrice: exactMatch.currentPrice,
            longName: exactMatch.longName,
            changePercent: 0
          };
        }

        // 2. Tenta match pela chave normalizada
        const normMatch = allBonds.find(b => {
          const itemNorm = BrapiService.normalizeTesouroTicker(b.ticker);
          return itemNorm === normalizedTarget;
        });

        if (normMatch) {
          return {
            ticker,
            currentPrice: normMatch.currentPrice,
            longName: normMatch.longName,
            changePercent: 0
          };
        }

        return null;
      } catch (e) {
        console.error(`Erro ao buscar cotação Tesouro de ${ticker}:`, e);
        return null;
      }
  },

  fetchPricesBatch: async (tickers: string[], onProgress?: (currentTicker: string) => void): Promise<{ ticker: string, currentPrice: number, changePercent?: number, longName?: string }[]> => {
    const results: { ticker: string, currentPrice: number, changePercent?: number, longName?: string }[] = [];
    
    // Filter valid tickers
    const validTickers = tickers.map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
    
    if (validTickers.length === 0) return [];

    // Separa Tesouro e Cripto para evitar chamadas indevidas à Brapi
    const tesouroTickers = validTickers.filter(t => BrapiService.isTesouro(t));
    const cryptoTickers = validTickers.filter(t => !BrapiService.isTesouro(t) && BrapiService.isCrypto(t));
    const regularTickers = validTickers.filter(t => !BrapiService.isTesouro(t) && !BrapiService.isCrypto(t));

    // Resolve Tesouro Direto com fallback integrado
    if (tesouroTickers.length > 0) {
      try {
        const tdPrices = await BrapiService.fetchTesouroDireto();
        tesouroTickers.forEach(t => {
          const targetNorm = BrapiService.normalizeTesouroTicker(t);
          const match = tdPrices.find(p => p.ticker.toUpperCase() === t || BrapiService.normalizeTesouroTicker(p.ticker) === targetNorm);
          if (match) {
            results.push({
              ticker: t,
              currentPrice: match.currentPrice,
              changePercent: 0,
              longName: match.longName
            });
          }
        });
      } catch (e) {
        console.error("Erro ao buscar títulos do Tesouro no lote:", e);
      }
    }

    // Resolve Crypto com CoinGecko
    if (cryptoTickers.length > 0) {
      try {
        const cPrices = await BrapiService.fetchCryptoPrices(cryptoTickers);
        cPrices.forEach(cp => results.push(cp));
      } catch (e) {
        console.error("Erro ao buscar cryptos no lote:", e);
      }
    }

    if (regularTickers.length === 0) return results;

    // No plano gratuito da Brapi, cada requisição permite 1 ativo por vez.
    // Consultamos os ativos individualmente em paralelo utilizando safeFetchJson.
    const individualPromises = regularTickers.map(async (ticker) => {
      try {
        if (onProgress) onProgress(ticker);
        const data = await safeFetchJson<{ results?: any[] }>(`${BASE_URL}/${encodeURIComponent(ticker)}`);
        if (data?.results && Array.isArray(data.results)) {
          data.results.forEach((result: any) => {
            if (result.regularMarketPrice !== undefined && result.regularMarketPrice !== null) {
              results.push({
                ticker: result.symbol || ticker,
                currentPrice: result.regularMarketPrice,
                changePercent: result.regularMarketChangePercent || 0,
                longName: result.shortName || result.longName
              });
            }
          });
        }
      } catch (e) {
        console.warn(`Aviso ao obter cotação de ${ticker}:`, e);
      }
    });

    await Promise.all(individualPromises);
    return results;
  },

  fetchHistory: async (ticker: string, adjusted: boolean = true): Promise<any> => {
      try {
          return await safeFetchJson(`/api/brapi/history/${encodeURIComponent(ticker)}?adjusted=${adjusted}`);
      } catch (e) {
          return null;
      }
  },

  fetchCryptoPrices: async (tickers: string[]): Promise<{ ticker: string, currentPrice: number, changePercent: number }[]> => {
    if (tickers.length === 0) return [];

    const idToTickerMap: Record<string, string> = {};
    const ids: string[] = [];

    tickers.forEach(t => {
        let clean = t.trim().toUpperCase();
        // Remove BRL suffix if present (e.g. BTCBRL -> BTC)
        if (clean.endsWith('BRL')) {
            clean = clean.replace(/BRL$/, '');
        }
        
        const coingeckoId = COIN_MAP[clean] || clean.toLowerCase();
        
        if (!ids.includes(coingeckoId)) {
            ids.push(coingeckoId);
        }
        idToTickerMap[coingeckoId] = t;
    });

    if (ids.length === 0) return [];

    try {
        const idsParam = ids.join(',');
        const url = `/api/coingecko/simple/price?ids=${encodeURIComponent(idsParam)}`;
        
        const data = await safeFetchJson<Record<string, { brl: number; brl_24h_change?: number }>>(url);
        if (data) {
          const results: { ticker: string, currentPrice: number, changePercent: number }[] = [];

          tickers.forEach(t => {
              let clean = t.trim().toUpperCase();
              if (clean.endsWith('BRL')) clean = clean.replace(/BRL$/, '');
              const id = COIN_MAP[clean] || clean.toLowerCase();
              
              if (data[id]) {
                  results.push({
                      ticker: t,
                      currentPrice: data[id].brl,
                      changePercent: data[id].brl_24h_change || 0
                  });
              }
          });

          return results;
        }
    } catch (e) {
        console.warn("Aviso ao buscar crypto do CoinGecko:", e);
    }
    return [];
  },

  fetchTesouroDireto: async (): Promise<{ ticker: string, currentPrice: number, taxa: number, longName: string, vencimento: string }[]> => {
    try {
      // Fetch diretamente do CSV (Fonte de Dados)
      const response = await fetch(TESOURO_CSV_URL);
      if (!response.ok) return [];
      const text = await response.text();
      if (!text || text.trim().startsWith('<')) return [];
      
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      const results: { ticker: string, currentPrice: number, taxa: number, longName: string, vencimento: string }[] = [];

      // Função Auxiliar para criar a chave de comparação (Ex: IPCA2032, PRE2029, IPCA2032JUROS)
      const generateBondKey = (name: string, maturity: string = '') => {
          const fullText = `${name} ${maturity}`.toUpperCase()
              .replace(/[\u0300-\u036f]/g, "") // Remove acentos
              .replace(/[^A-Z0-9]/g, " ");

          let type = '';
          let year = '';
          // Detecção precisa de Juros Semestrais
          const hasJuros = fullText.includes('JUROS') || fullText.includes('COMJUROS');

          // Detecta Ano (4 dígitos como 2026-2099)
          const yearMatch = fullText.match(/20\d{2}/);
          if (yearMatch) year = yearMatch[0];

          // Detecta Tipo
          if (fullText.includes('PREFIXADO') || fullText.includes('PRE')) type = 'PRE';
          else if (fullText.includes('IPCA') || fullText.includes('IPC')) type = 'IPCA';
          else if (fullText.includes('SELIC') || fullText.includes('LFT')) type = 'SELIC';
          else if (fullText.includes('RENDA')) type = 'RENDA';
          else if (fullText.includes('EDUCA')) type = 'EDUCA';
          else if (fullText.includes('IGPM')) type = 'IGPM';

          return `${type}${year}${hasJuros ? 'JUROS' : ''}`;
      };

      // Função de Parsing de Taxa (ex: "IPCA + 7.72%" -> 7.72, "13.95%" -> 13.95)
      const parseBrRate = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const str = val.toString().trim();
          const numMatch = str.match(/[\d]+([.,]\d+)?/);
          if (!numMatch) return 0;
          const rawNum = numMatch[0].replace(',', '.');
          return parseFloat(rawNum) || 0;
      };

      // Função de Parsing de Número Brasileiro de Preço (ex: "R$ 3.077,06" -> 3077.06)
      const parseBrPrice = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          
          const str = val.toString().trim();
          const cleanStr = str.replace(/[R$\s%]/g, '');
          
          if (cleanStr.includes('.') && cleanStr.includes(',')) {
              return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
          }
          if (cleanStr.includes(',')) {
              return parseFloat(cleanStr.replace(',', '.'));
          }
          return parseFloat(cleanStr);
      };

      // Ignora header se presente
      const startIdx = lines[0].toLowerCase().includes('título') ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(';'); // O CSV usa ponto e vírgula
          
          if (cols.length >= 4) {
              const name = cols[0].trim();
              const rateRaw = cols[1];
              const priceRaw = cols[2];
              const maturity = cols[3].trim();

              const price = parseBrPrice(priceRaw);
              const rate = parseBrRate(rateRaw);

              if (name && price > 0) {
                  const bondKey = generateBondKey(name, maturity); 
                  const systemTicker = `TD:${bondKey}`;
                  const yearMatch = `${name} ${maturity}`.match(/20\d{2}/);
                  const yearStr = yearMatch ? yearMatch[0] : '';
                  const displayName = name.includes(yearStr) ? name : `${name} ${yearStr}`.trim();

                  // Chave padrão: TD:IPCA2032
                  results.push({
                      ticker: systemTicker, 
                      currentPrice: price,
                      taxa: rate,
                      longName: displayName, 
                      vencimento: maturity
                  });
                  
                  // Chave sem prefixo: IPCA2032
                  results.push({
                      ticker: bondKey,
                      currentPrice: price,
                      taxa: rate,
                      longName: displayName, 
                      vencimento: maturity
                  });

                  // Variações com símbolo '+' para IPCA (ex: TD:IPCA+2032 e IPCA+2032)
                  if (bondKey.startsWith('IPCA')) {
                      const plusKey = bondKey.replace('IPCA', 'IPCA+');
                      results.push({
                          ticker: `TD:${plusKey}`,
                          currentPrice: price,
                          taxa: rate,
                          longName: displayName,
                          vencimento: maturity
                      });
                      results.push({
                          ticker: plusKey,
                          currentPrice: price,
                          taxa: rate,
                          longName: displayName,
                          vencimento: maturity
                      });
                  }
              }
          }
      }

      return results;
    } catch (e) {
      console.warn("Aviso fetchTesouroDireto:", e);
      return [];
    }
  },

  fetchPtaxForDate: async (dateStr: string): Promise<{ compra: number, venda: number } | null> => {
      try {
          const [year, month, day] = dateStr.split('-');
          const formattedDate = `${month}-${day}-${year}`;
          
          const urlCompraRaw = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=100&$format=json&$select=cotacaoCompra`;
          const urlVendaRaw = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=100&$format=json&$select=cotacaoVenda`;

          const [dataCompra, dataVenda] = await Promise.all([
              safeFetchJson<{ value?: { cotacaoCompra: number }[] }>(`/api/bcb/ptax?url=${encodeURIComponent(urlCompraRaw)}`),
              safeFetchJson<{ value?: { cotacaoVenda: number }[] }>(`/api/bcb/ptax?url=${encodeURIComponent(urlVendaRaw)}`)
          ]);

          if (dataCompra?.value && dataCompra.value.length > 0 && dataVenda?.value && dataVenda.value.length > 0) {
              const lastCompra = dataCompra.value[dataCompra.value.length - 1].cotacaoCompra;
              const lastVenda = dataVenda.value[dataVenda.value.length - 1].cotacaoVenda;
              return { compra: lastCompra, venda: lastVenda };
          }
          return null;
      } catch (e) {
          console.warn("Aviso fetchPtaxForDate BCB:", e);
          return null;
      }
  },

  fetchPtax: async (): Promise<number | null> => {
      try {
          const formatBcbDate = (d: Date) => {
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${mm}-${dd}-${d.getFullYear()}`;
          };
          const today = new Date();
          const startDateObj = new Date();
          startDateObj.setDate(today.getDate() - 5);
          const startDate = formatBcbDate(startDateObj);
          const endDateUS = formatBcbDate(today);

          const urlRaw = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${startDate}'&@dataFinalCotacao='${endDateUS}'&$top=1&$format=json&$select=cotacaoVenda,dataHoraCotacao&$orderby=dataHoraCotacao desc`;
          const url = `/api/bcb/ptax?url=${encodeURIComponent(urlRaw)}`;

          const data = await safeFetchJson<{ value?: { cotacaoVenda: number }[] }>(url);
          if (data?.value && data.value.length > 0) {
              return data.value[0].cotacaoVenda;
          }
          return null;
      } catch (e) {
          console.warn("Aviso fetchPtax BCB:", e);
          return null;
      }
  },

  fetchIbovHistory: async (): Promise<{ date: string, value: number }[]> => {
      try {
          const data = await safeFetchJson<any>('/api/yahoo/ibov?range=10y');
          if (!data) return [];

          const result = data?.chart?.result?.[0];
          const timestamps: number[] = result?.timestamp || [];
          const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
          if (timestamps.length === 0) return [];

          const list: { date: string, value: number }[] = [];
          timestamps.forEach((ts, i) => {
              const close = closes[i];
              if (close === null || close === undefined) return;
              list.push({
                  date: new Date(ts * 1000).toISOString().split('T')[0],
                  value: close,
              });
          });
          return list;
      } catch (e) {
          console.warn("Aviso fetchIbovHistory Yahoo:", e);
          return [];
      }
  },

  fetchIpcaHistory: async (): Promise<{ date: string, value: number }[]> => {
      try {
          // BCB SGS Serie 433 (IPCA mensal)
          const response = await fetch('/api/bcb/ipca');
          if (!response.ok) return [];
          const contentType = response.headers.get("content-type");
          if (contentType && !contentType.includes("json")) {
              console.warn("Resposta IPCA não é JSON:", contentType);
              return [];
          }
          const text = await response.text();
          if (!text || text.trim().startsWith("<")) {
              console.warn("Resposta IPCA é HTML/vazia");
              return [];
          }
          const data = JSON.parse(text);
          if (!Array.isArray(data)) return [];
          return data.map((d: any) => {
             // data is in DD/MM/YYYY
             const parts = d.data.split('/');
             return {
                 date: `${parts[2]}-${parts[1]}-${parts[0]}`,
                 value: parseFloat(d.valor)
             };
          });
      } catch (e) {
          console.warn("Erro fetchIpcaHistory BCB:", e);
          return [];
      }
  },

  fetchCdiHistory: async (): Promise<{ date: string, value: number }[]> => {
      const generateFallbackCdiData = (): { date: string, value: number }[] => {
          const list: { date: string, value: number }[] = [];
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
                      date: `${yyyy}-${mm}-${dd}`,
                      value: dailyRate
                  });
              }
              current.setDate(current.getDate() + 1);
          }
          return list;
      };

      try {
          // Série 12: Taxa de juros - CDI - % a.d.
          // Usando busca por período (dataInicial e dataFinal) que é mais robusta que /ultimos/
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const yyyy = today.getFullYear();
          const endDate = `${dd}/${mm}/${yyyy}`;
          
          // O BCB limita a janela de consulta em 10 anos para séries diárias
          const tenYearsAgo = new Date();
          tenYearsAgo.setFullYear(today.getFullYear() - 10);
          const startDd = String(tenYearsAgo.getDate()).padStart(2, '0');
          const startMm = String(tenYearsAgo.getMonth() + 1).padStart(2, '0');
          const startYyyy = tenYearsAgo.getFullYear();
          const startDate = `${startDd}/${startMm}/${startYyyy}`;
          
          const rawUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`;
          const url = `/api/bcb/cdi?url=${encodeURIComponent(rawUrl)}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              console.warn("Erro na resposta do proxy CDI, usando série integrada:", errorData);
              return generateFallbackCdiData();
          }
          
          const data = await response.json();
          
          if (!Array.isArray(data)) {
              console.warn("Dados do CDI não são um array, usando série integrada:", data);
              return generateFallbackCdiData();
          }

          // Converte para formato { date: 'YYYY-MM-DD', value: number }
          return data.map((item: any) => {
              const [d, m, y] = item.data.split('/');
              return {
                  date: `${y}-${m}-${d}`,
                  value: parseFloat(item.valor)
              };
          });
      } catch (e) {
          console.warn("Retornando série CDI integrada devido à indisponibilidade do BCB:");
          return generateFallbackCdiData();
      }
  },

  fetchDividends: async (ticker: string): Promise<any[]> => {
    try {
      const response = await fetch(`${BASE_URL}/${ticker.toUpperCase()}?dividends=true`);

      const data = await safeFetchJson<any>(`${BASE_URL}/${ticker.toUpperCase()}?dividends=true`);
      if (!data) return [];

      if (data.error && data.code === 'FEATURE_NOT_AVAILABLE') {
          const planError: any = new Error(`O plano atual da Brapi não suporta dividendos para o ativo ${ticker}.`);
          planError.code = 'FEATURE_NOT_AVAILABLE';
          throw planError;
      }

      if (data.results && data.results[0] && data.results[0].dividendsData) {
        const dividends = data.results[0].dividendsData;
        const cashDividends = dividends.cashDividends || [];
        
        return cashDividends.map((div: any) => ({
          ticker: ticker.toUpperCase(),
          type: div.label === 'DIVIDENDO' ? 'DIVIDEND' : (div.label === 'JCP' ? 'JCP' : 'RENDIMENTO'),
          paymentDate: div.paymentDate ? div.paymentDate.split('T')[0] : (div.lastDatePrior ? div.lastDatePrior.split('T')[0] : (div.approvedOn ? div.approvedOn.split('T')[0] : '')),
          dataCom: div.lastDatePrior ? div.lastDatePrior.split('T')[0] : (div.approvedOn ? div.approvedOn.split('T')[0] : null),
          amount: div.rate,
          currency: 'BRL',
          ptax: 1
        }));
      }
    } catch (e: any) {
      if (e.code === 'FEATURE_NOT_AVAILABLE') {
          throw e;
      }
      console.warn(`Aviso ao buscar proventos Brapi para ${ticker}:`, e);
    }
    return [];
  }
};
