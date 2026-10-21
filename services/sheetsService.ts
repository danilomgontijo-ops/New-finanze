
import { COIN_MAP } from './brapiService';

export interface SheetHistoryData {
    ticker: string;
    resultados: {
        mes?: string; // Legacy
        inicio?: number | string; // Legacy
        fim?: number | string; // Legacy
        data?: string; // New daily
        preco?: number | string; // New daily
        variacao?: number | string;
    }[];
}

export const SheetsService = {
    fetchAssetHistory: async (ticker: string): Promise<SheetHistoryData | null> => {
        let isJson = false;
        let parsed: any = null;

        try {
            const response = await fetch(`/api/sheets/history?ticker=${encodeURIComponent(ticker)}`);
            
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const text = await response.text();
                    if (text && !text.trim().startsWith("<")) {
                        parsed = JSON.parse(text);
                        if (!parsed.error && !parsed.erro) {
                            return parsed; // success!
                        }
                    }
                }
            } else {
                try {
                    const errData = await response.json();
                    if (errData && errData.error) parsed = { erro: errData.error };
                } catch (pe) {}
            }
        } catch (e) {
            console.warn(`[SheetsService] server route failed for ${ticker}:`, e);
        }

        // Detect if it's crypto for CoinGecko fallback
        let isCrypto = false;
        let coingeckoId = "";
        let baseTicker = ticker.replace(/CURRENCY:/i, "");
        const cleanBase = baseTicker.toUpperCase().replace(/USD$/, "").replace(/BRL$/, "").replace(/-USD$/, "").replace(/-BRL$/, "");
        if (COIN_MAP[cleanBase]) {
            isCrypto = true;
            coingeckoId = COIN_MAP[cleanBase];
        } else if (cleanBase.length > 2 && (baseTicker.endsWith("USD") || baseTicker.endsWith("BRL"))) {
             // Heuristic for unknown coins if mapped with USD/BRL
            isCrypto = true;
            coingeckoId = cleanBase.toLowerCase();
        }

        if (isCrypto && coingeckoId) {
             console.log(`[SheetsProxy] Falling back to CoinGecko for ${ticker}...`);
             try {
                // CoinGecko market_chart returns timestamp and prices
                const currency = baseTicker.toUpperCase().endsWith("BRL") ? "brl" : "usd";
                const cgRes = await fetch(`/api/coingecko/history/${coingeckoId}?vs_currency=${currency}&days=3650`);
                if (cgRes.ok) {
                    const cgData = await cgRes.json();
                    if (cgData && cgData.prices && cgData.prices.length > 0) {
                        const mapped = cgData.prices.map((p: [number, number]) => {
                             return {
                                 data: new Date(p[0]).toISOString().split('T')[0],
                                 preco: p[1],
                                 variacao: null
                             };
                        });

                        // Avoid returning duplicates for same day
                        const uniqueMap = new Map<string, any>();
                        mapped.forEach((m: any) => {
                            uniqueMap.set(m.data, m);
                        });
                        const uniqueResults = Array.from(uniqueMap.values());

                        return {
                            ticker: ticker,
                            resultados: uniqueResults
                        };
                    }
                }
             } catch (e) {
                 console.log(`CoinGecko fallback unsuccessful for ${ticker}`);
             }
        }

        // Fallback to Brapi API if Google Sheets returns HTML, error, or server proxy fails
        console.log(`[SheetsProxy] Falling back to Brapi for ${ticker}...`);
        try {
            // Some tickers need mapping for brapi:
            let brapiTicker = ticker;
            if (brapiTicker.toUpperCase().startsWith("CURRENCY:")) {
                brapiTicker = brapiTicker.replace(/CURRENCY:/i, "");
            }
            if (brapiTicker.toUpperCase().startsWith("BVMF:")) {
                brapiTicker = brapiTicker.replace(/BVMF:/i, "");
            }
            if (brapiTicker.toUpperCase().startsWith("NYSEARCA:")) {
                brapiTicker = brapiTicker.replace(/NYSEARCA:/i, "");
            }

            // Crypto / Currency to Brapi format (e.g. BTCUSD -> BTC-USD)
            if (brapiTicker.length >= 6 && (brapiTicker.endsWith("USD") || brapiTicker.endsWith("BRL")) && !brapiTicker.includes("-")) {
                const currency = brapiTicker.slice(-3);
                const asset = brapiTicker.slice(0, -3);
                brapiTicker = `${asset}-${currency}`;
            }
            
            const brapiRes = await fetch(`/api/brapi/quote/${brapiTicker}?range=3mo&interval=1d`);
            if (brapiRes.ok) {
                const brapiData = await brapiRes.json();
                if (brapiData.results && brapiData.results[0] && brapiData.results[0].historicalDataPrice) {
                    const brapiHistory = brapiData.results[0].historicalDataPrice;
                    const mapped = brapiHistory.map((h: any) => ({
                        // Brapi returns timestamp `date`, let's map it to "yyyy-mm-dd"
                        data: new Date(h.date * 1000).toISOString().split('T')[0],
                        preco: h.close,
                        variacao: null // we can ignore change or compute it later
                    }));
                    return {
                        ticker: ticker,
                        resultados: mapped
                    };
                }
            }
        } catch (e) {
            console.log(`Brapi fallback unsuccessful for ${ticker}`);
        }

        return parsed ? parsed as any : null;
    }
};
