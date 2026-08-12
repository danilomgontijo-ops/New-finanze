
const BASE_URL = '/api/brapi/quote';
// Using the raw CSV source which is more reliable than scraping the HTML view
const TESOURO_CSV_URL = '/api/tesouro';

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

  fetchPricesBatch: async (tickers: string[], onProgress?: (currentTicker: string) => void): Promise<{ ticker: string, currentPrice: number, changePercent?: number, longName?: string }[]> => {
    const results: { ticker: string, currentPrice: number, changePercent?: number, longName?: string }[] = [];
    
    // Filter valid tickers
    const validTickers = tickers.map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
    
    if (validTickers.length === 0) return [];

    // Processa em chunks de 20 para otimizar
    const chunkSize = 20;
    const chunks = [];
    for (let i = 0; i < validTickers.length; i += chunkSize) {
      chunks.push(validTickers.slice(i, i + chunkSize).join(','));
    }

    // Paraleliza as requisições com Promise.all para maior velocidade
    await Promise.all(chunks.map(async (chunkString) => {
      try {
        if (onProgress && chunkString) onProgress(chunkString.split(',')[0]);

        const response = await fetch(`${BASE_URL}/${chunkString}`);
        
        // Fallback: If batch fails, try individual fetch for this chunk
        if (!response.ok) {
            console.warn(`Batch failed for ${chunkString}, trying individual fallback...`);
            const individualTickers = chunkString.split(',');
            for (const ticker of individualTickers) {
                try {
                    const res = await fetch(`${BASE_URL}/${ticker}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.results) {
                             data.results.forEach((result: any) => {
                                if (result.regularMarketPrice) {
                                  results.push({
                                    ticker: result.symbol,
                                    currentPrice: result.regularMarketPrice,
                                    changePercent: result.regularMarketChangePercent || 0,
                                    longName: result.shortName || result.longName
                                  });
                                }
                              });
                        }
                    }
                } catch (e) { console.error(`Error fetching individual ${ticker}`, e); }
            }
            return;
        }

        const data = await response.json();
        if (data.results) {
          data.results.forEach((result: any) => {
            if (result.regularMarketPrice) {
              results.push({
                ticker: result.symbol,
                currentPrice: result.regularMarketPrice,
                changePercent: result.regularMarketChangePercent || 0,
                longName: result.shortName || result.longName
              });
            }
          });
        }
      } catch (e) {
        console.error("Erro Brapi Batch:", e);
      }
    }));
    
    return results;
  },

  fetchHistory: async (ticker: string, adjusted: boolean = true): Promise<any> => {
      try {
          const response = await fetch(`/api/brapi/history/${ticker}?adjusted=${adjusted}`);
          if (!response.ok) return null;
          return await response.json();
      } catch (e) {
          const msg = typeof e === 'string' ? e : (e instanceof Error ? e.message : String(e));
          if (!(msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('load failed'))) {
              console.error(`Error fetching history for ${ticker}:`, e);
          }
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
        // Map ID back to original ticker request
        // Note: If multiple tickers map to same ID (e.g. BTC and BTCBRL), the last one wins for this map,
        // but we can iterate the tickers later to match results.
        idToTickerMap[coingeckoId] = t;
    });

    if (ids.length === 0) return [];

    try {
        const idsParam = ids.join(',');
        // Include 24hr change for percentage calculation
        const url = `/api/coingecko/simple/price?ids=${idsParam}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // Response format: { "bitcoin": { "brl": 350000, "brl_24h_change": 2.5 }, ... }
          
          const results: { ticker: string, currentPrice: number, changePercent: number }[] = [];

          // We need to map results back to ALL original requested tickers
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
        console.error("Error fetching crypto from CoinGecko", e);
    }
    return [];
  },

  fetchTesouroDireto: async (): Promise<{ ticker: string, currentPrice: number, taxa: number, longName: string, vencimento: string }[]> => {
    try {
      // Fetch diretamente do CSV (Fonte de Dados)
      const response = await fetch(TESOURO_CSV_URL);
      if (!response.ok) throw new Error('Falha ao buscar CSV do Tesouro');
      const text = await response.text();
      
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      const results: { ticker: string, currentPrice: number, taxa: number, longName: string, vencimento: string }[] = [];

      // Função Auxiliar para criar a chave de comparação (Ex: PRE2027, IPCA2035JUROS)
      const generateBondKey = (name: string) => {
          const clean = name.toUpperCase()
              .replace(/[\u0300-\u036f]/g, "") // Remove acentos
              .replace(/[^A-Z0-9]/g, ""); // Remove espaços e símbolos

          let type = '';
          let year = '';
          // Detecção precisa de Juros Semestrais
          const hasJuros = clean.includes('JUROS') || clean.includes('COMJUROS') || clean.includes('SEM');

          // Detecta Ano (4 dígitos no final ou meio)
          const yearMatch = clean.match(/20\d{2}/);
          if (yearMatch) year = yearMatch[0];

          // Detecta Tipo
          if (clean.includes('PREFIXADO') || clean.includes('PRE')) type = 'PRE';
          else if (clean.includes('IPCA') || clean.includes('IPC')) type = 'IPCA';
          else if (clean.includes('SELIC') || clean.includes('LFT')) type = 'SELIC';
          else if (clean.includes('RENDA') || clean.includes('RENDA+')) type = 'RENDA';
          else if (clean.includes('EDUCA') || clean.includes('EDUCA+')) type = 'EDUCA';

          return `${type}${year}${hasJuros ? 'JUROS' : ''}`;
      };

      // Função de Parsing de Número Brasileiro (1.000,00 -> 1000.00)
      const parseBrNumber = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          
          const str = val.toString().trim();
          const cleanStr = str.replace(/[R$\s%]/g, '');
          
          // Se tiver ponto e vírgula (ex: 1.234,56), remove ponto e troca vírgula por ponto
          if (cleanStr.includes('.') && cleanStr.includes(',')) {
              return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
          }
          // Se tiver só vírgula (ex: 1234,56), troca por ponto
          if (cleanStr.includes(',')) {
              return parseFloat(cleanStr.replace(',', '.'));
          }
          return parseFloat(cleanStr);
      };

      // Ignora header se presente
      const startIdx = lines[0].toLowerCase().includes('título') ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(';'); // O CSV do Github usa ponto e vírgula
          
          if (cols.length >= 4) {
              const name = cols[0].trim();
              const rateRaw = cols[1];
              const priceRaw = cols[2];
              const maturity = cols[3];

              const price = parseBrNumber(priceRaw);
              const rate = parseBrNumber(rateRaw);

              if (name && price > 0) {
                  const bondKey = generateBondKey(name); 
                  const systemTicker = `TD:${bondKey}`;

                  results.push({
                      ticker: systemTicker, 
                      currentPrice: price,
                      taxa: rate,
                      longName: name, 
                      vencimento: maturity
                  });
                  
                  results.push({
                      ticker: bondKey,
                      currentPrice: price,
                      taxa: rate,
                      longName: name,
                      vencimento: maturity
                  });
              }
          }
      }

      return results;
    } catch (e) {
      console.error("Erro fetchTesouroDireto:", e);
      return [];
    }
  },

  fetchPtaxForDate: async (dateStr: string): Promise<{ compra: number, venda: number } | null> => {
      try {
          // dateStr is expected to be YYYY-MM-DD
          const [year, month, day] = dateStr.split('-');
          const formattedDate = `${month}-${day}-${year}`;
          
          const urlCompraRaw = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=100&$format=json&$select=cotacaoCompra`;
          const urlVendaRaw = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=100&$format=json&$select=cotacaoVenda`;

          const [resCompra, resVenda] = await Promise.all([
              fetch(`/api/bcb/ptax?url=${encodeURIComponent(urlCompraRaw)}`),
              fetch(`/api/bcb/ptax?url=${encodeURIComponent(urlVendaRaw)}`)
          ]);

          if (!resCompra.ok || !resVenda.ok) return null;

          const dataCompra = await resCompra.json();
          const dataVenda = await resVenda.json();

          if (dataCompra.value && dataCompra.value.length > 0 && dataVenda.value && dataVenda.value.length > 0) {
              // The API might return multiple values for the day (bulletins), usually the last one is the final PTAX
              const lastCompra = dataCompra.value[dataCompra.value.length - 1].cotacaoCompra;
              const lastVenda = dataVenda.value[dataVenda.value.length - 1].cotacaoVenda;
              return { compra: lastCompra, venda: lastVenda };
          }
          return null;
      } catch (e) {
          console.error("Erro fetchPtaxForDate BCB:", e);
          return null;
      }
  },

  fetchPtax: async (): Promise<number | null> => {
      try {
          // Formato MM-DD-YYYY com zero-padding, igual ao usado em fetchPtaxForDate (exigido pela API OData do BCB)
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

          const response = await fetch(url);
          if (!response.ok) return null;
          
          const data = await response.json();
          if (data.value && data.value.length > 0) {
              return data.value[0].cotacaoVenda;
          }
          return null;
      } catch (e) {
          console.error("Erro fetchPtax BCB:", e);
          return null;
      }
  },

  
  
  fetchIbovHistory: async (): Promise<{ date: string, value: number }[]> => {
      // Cotação diária real do Ibovespa (^BVSP) via Yahoo Finance.
      // BCB SGS 7832 NÃO serve para isso: é uma série mensal descontinuada em 08/2019,
      // não o índice de fechamento diário.
      try {
          const response = await fetch('/api/yahoo/ibov?range=10y');
          if (!response.ok) {
              console.warn("Erro ao buscar histórico do Ibovespa (Yahoo indisponível)");
              return [];
          }

          const data = await response.json();
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
          console.warn("Erro fetchIbovHistory Yahoo:", e);
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

      // Se a resposta não for ok, tenta ler o JSON para ver se é erro de plano.
      // O throw aqui precisa escapar deste bloco (não pode ser recapturado por um catch
      // interno), senão o chamador nunca sabe que o motivo foi restrição de plano.
      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch {
          // corpo não é JSON, segue sem detalhe
        }
        if (errorData?.code === 'FEATURE_NOT_AVAILABLE') {
          const planError: any = new Error(`O plano atual da Brapi não suporta dividendos para o ativo ${ticker}.`);
          planError.code = 'FEATURE_NOT_AVAILABLE';
          throw planError;
        }
        return [];
      }

      const data = await response.json();
      if (data.error && data.code === 'FEATURE_NOT_AVAILABLE') {
          const planError: any = new Error(`O plano atual da Brapi não suporta dividendos para o ativo ${ticker}.`);
          planError.code = 'FEATURE_NOT_AVAILABLE';
          throw planError;
      }

      if (data.results && data.results[0] && data.results[0].dividendsData) {
        const dividends = data.results[0].dividendsData;
        // Brapi returns cashDividends and stockDividends
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
      console.error(`Erro ao buscar proventos Brapi para ${ticker}:`, e);
      // Repassa o erro de plano para o chamador
      if (e.code === 'FEATURE_NOT_AVAILABLE') {
          throw e;
      }
    }
    return [];
  }
};
