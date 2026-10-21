
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYlkaqgQ5ytxz_5tDxNAss69KbEzz7hnvZmSISUHZ0baAZcEhz4sFqPHj8QDU_2zI/exec';

export interface HistoricalDataPoint {
  /**
   * Retorna sempre como string sem hora:
   * - diário: YYYY-MM-DD
   * - mensal (legacy): YYYY-MM
   */
  date: string;

  /** Preço de fechamento (ou preço do dia, no retorno diário do GOOGLEFINANCE) */
  close: number;

  /**
   * Preço de abertura (opcional).
   * - no formato mensal antigo: "inicio"
   * - no formato diário novo: como não temos abertura, usamos o mesmo preço do dia
   */
  open?: number;

  /** Variação (opcional) */
  change?: number;
}

// Garanta que SCRIPT_URL exista no seu projeto
// SCRIPT_URL is declared above

type LegacyRow = {
  mes?: string;
  inicio?: number | string;
  fim?: number | string;
  variacao?: number | string;
};

type DailyRow = {
  data?: string; // já vem como YYYY-MM-DD do Apps Script
  preco?: number | string;
  variacao?: number | string;
};

type ApiResponse =
  | { ticker?: string; resultados?: Array<LegacyRow | DailyRow>; erro?: string; detalheA2?: string; detalheB2?: string }
  | Array<LegacyRow | DailyRow>;

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value: unknown): string {
  if (typeof value === "string") {
    let dateStr = value.trim();
    // Handle DD/MM/YYYY or DD/MM/YY
    const brDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (brDateMatch) {
        const day = brDateMatch[1].padStart(2, '0');
        const month = brDateMatch[2].padStart(2, '0');
        let year = brDateMatch[3];
        if (year.length === 2) {
            year = `20${year}`;
        }
        return `${year}-${month}-${day}`;
    }
    // Handle ISO strings like 2024-01-02T00:00:00.000Z
    if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
    }
    return dateStr;
  }

  // Se vier algo inesperado (ex: Date), converte para YYYY-MM-DD
  try {
    const d = new Date(value as any);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    // ignore
  }

  return "";
}

export const HistoricalPriceService = {
  getHistoricalPrices: async (ticker: string): Promise<HistoricalDataPoint[]> => {
    try {
      const t = (ticker || "").toUpperCase().trim();
      if (!t) return [];

      let formattedTicker = t;

      let results = [];
      let sheetsData: ApiResponse | null = null;
      try {
        const url = `/api/sheets/history?ticker=${encodeURIComponent(formattedTicker)}&t=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
           const contentType = response.headers.get("content-type");
           if (contentType && !contentType.includes("application/json")) {
               console.warn(`[Apps Script] ${t}: unexpected content-type ${contentType}. Tentando fallback Brapi...`);
           } else {
               const text = await response.text();
               if (text && !text.trim().startsWith("<")) {
                   sheetsData = JSON.parse(text);
                   results = (Array.isArray(sheetsData) ? sheetsData : sheetsData?.resultados) ?? [];
               } else {
                   console.warn(`[Apps Script] ${t}: HTML or empty response instead of JSON. Tentando fallback Brapi...`);
               }
           }
        } else {
           console.warn(`[Apps Script] ${t}: return status ${response.status}. Tentando fallback Brapi...`);
        }
      } catch (e) {
        console.warn(`[Apps Script] ${t}: fetch failed. Tentando fallback Brapi...`, e);
      }

      // Fallback to Brapi if Sheets failed or returned error/empty results
      if (!results || results.length === 0 || (sheetsData && (sheetsData as any).erro)) {
          if (sheetsData && (sheetsData as any).erro) {
              console.warn(`[Apps Script] ${t}: ${(sheetsData as any).erro}. Tentando fallback Brapi...`);
          } else {
              console.log(`[Apps Script] ${t}: Histórico vazio. Tentando fallback Brapi...`);
          }
          
          try {
              const brapiRes = await fetch(`/api/brapi/history/${t}`);
              if (brapiRes.ok) {
                  const brapiData = await brapiRes.json();
                  if (brapiData.results && brapiData.results[0] && brapiData.results[0].results) {
                      const brapiHistory = brapiData.results[0].results;
                      return brapiHistory.map((h: any) => ({
                          date: h.date.split('T')[0],
                          close: h.close,
                          open: h.open,
                          change: h.change
                      }));
                  }
              }
          } catch (e) {
              console.error(`Brapi fallback failed for ${t}:`, e);
          }
      }

      const mapped = results.map((d: any): HistoricalDataPoint => {
        // Formato novo (diário): { data, preco, variacao }
        if (d?.data != null || d?.preco != null) {
          const date = normalizeDate(d.data);
          const price = toNumber(d.preco, 0);
          const change = d.variacao != null ? toNumber(d.variacao, NaN) : NaN;

          return {
            date,
            close: price,
            open: price,              // como não temos open diário, espelhamos
            change: Number.isFinite(change) ? change : undefined,
          };
        }

        // Formato antigo (mensal): { mes, inicio, fim, variacao }
        const date = normalizeDate(d.mes);
        const open = toNumber(d.inicio, 0);
        const close = toNumber(d.fim, 0);
        const change = d.variacao != null ? toNumber(d.variacao, NaN) : NaN;

        return {
          date,
          open,
          close,
          change: Number.isFinite(change) ? change : undefined,
        };
      });

      // valida: precisa ter date e close numérico
      return mapped.filter((p) => p.date && Number.isFinite(p.close));
    } catch (error) {
      const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('load failed') || msg.toLowerCase().includes('http error')) {
        // Suppress CORS / 500 errors from Google Apps Script for delisted tickers like SQIA3
      } else {
        console.warn(`Error fetching history for ${ticker}:`, error);
      }
      return [];
    }
  },
};
