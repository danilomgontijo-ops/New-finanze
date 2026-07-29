const BASE_URL = '/api/yahoo/dividends';

export const YahooFinanceService = {
  fetchDividends: async (ticker: string, range: string = '1y'): Promise<any[]> => {
    try {
      const response = await fetch(`${BASE_URL}/${ticker.toUpperCase()}?range=${range}`);
      if (!response.ok) return [];

      const data = await response.json();
      
      if (data.chart && data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0];
        const currency = result.meta?.currency || 'BRL';
        
        if (result.events && result.events.dividends) {
          const dividendsObj = result.events.dividends;
          
          // Convert object to array
          const dividends = Object.values(dividendsObj).map((div: any) => {
            console.log("DEBUG: Yahoo Dividend Data:", div);
            // div.date is a unix timestamp in seconds
            const dateObj = new Date(div.date * 1000);
            const dateStr = dateObj.toISOString().split('T')[0];
            
            // Yahoo Finance typically gives the ex-dividend date (Data Com).
            // We'll use it as dataCom. For paymentDate, since Yahoo doesn't provide it reliably
            // for BRL, we will just use dataCom, so it doesn't hallucinate dates. Gemini search will fill in accurate dates.
            const paymentDateStr = dateStr;

            return {
              ticker: ticker.toUpperCase(),
              type: 'DIVIDEND', // Yahoo doesn't distinguish JCP vs Dividend
              paymentDate: paymentDateStr,
              dataCom: dateStr,
              amount: div.amount,
              currency: currency,
              ptax: 1
            };
          });
          
          return dividends;
        }
      }
    } catch (e) {
      console.error(`Erro ao buscar proventos Yahoo Finance para ${ticker}:`, e);
    }
    return [];
  }
};
