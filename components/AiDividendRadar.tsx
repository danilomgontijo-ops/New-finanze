
import React, { useState, useEffect } from 'react';
import { Transaction, Category, TransactionType, PaymentMethod, InvestmentDetails, SubCategory } from '../types';
import { GeminiService } from '../services/geminiService';
import { YahooFinanceService } from '../services/yahooFinanceService';
import { BrapiService } from '../services/brapiService';
import { X, Sparkles, Search, CheckCircle2, AlertCircle, Save, Calendar, Loader2, ArrowRight, DollarSign } from 'lucide-react';

interface AiDividendRadarProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[]; // Histórico completo para saber o que já tenho
  categories: Category[];
  subCategories: SubCategory[];
  onImport: (transactions: any[]) => Promise<void>;
}

export const AiDividendRadar: React.FC<AiDividendRadarProps> = ({ isOpen, onClose, transactions, categories, subCategories, onImport }) => {
  const [step, setStep] = useState<'select' | 'searching' | 'review'>('select');
  const [activeTickers, setActiveTickers] = useState<string[]>([]);
  const [tickerCategoryMap, setTickerCategoryMap] = useState<Record<string, {categoryId: string, subCategoryId?: string}>>({});
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('');
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [foundDividends, setFoundDividends] = useState<any[]>([]);
  const [sources, setSources] = useState<{ uri: string, title: string }[]>([]);
  
  const getLocalMonthString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [startMonth, setStartMonth] = useState(getLocalMonthString());
  const [endMonth, setEndMonth] = useState(getLocalMonthString());
  const [warning, setWarning] = useState<string | null>(null);

  // Load Active Portfolio on Open
  useEffect(() => {
    if (isOpen) {
        // Ordena cronologicamente para garantir cálculo correto de SPLITS/MERGES
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const holdings: Record<string, number> = {};
        const tickerCatMap: Record<string, { categoryId: string, subCategoryId?: string }> = {};
        
        sortedTransactions.forEach(t => {
            if (t.type === TransactionType.INVESTMENT && t.investmentDetails) {
                const { ticker, quantity, event, newTicker } = t.investmentDetails;
                
                if (!holdings[ticker]) holdings[ticker] = 0;
                
                // Track category
                if (event === 'BUY') {
                    tickerCatMap[ticker] = { categoryId: t.categoryId, subCategoryId: t.subCategoryId };
                }

                if (event === 'BUY') {
                    holdings[ticker] += quantity;
                } else if (event === 'BONUS') {
                    holdings[ticker] += quantity;
                } else if (event === 'SELL') {
                    holdings[ticker] -= quantity;
                } else if (event === 'SPLIT') {
                    holdings[ticker] *= quantity; // Multiplica a quantidade atual pelo fator
                } else if (event === 'MERGE') {
                    holdings[ticker] /= quantity; // Divide a quantidade atual pelo fator
                } else if (event === 'TICKER_UPDATE' && newTicker) {
                    // Migra a quantidade para o novo ticker
                    const qtyToMove = holdings[ticker] || 0;
                    holdings[ticker] = 0;
                    holdings[newTicker] = (holdings[newTicker] || 0) + qtyToMove;
                    tickerCatMap[newTicker] = tickerCatMap[ticker];
                }
            }
        });
        
        const active = Object.keys(holdings).filter(t => {
            // Filter out fixed income (Tesouro, CDB, LCI, LCA, CRI, CRA, DEB)
            const isFixedIncome = t.startsWith('TD:') || t.startsWith('TESOURO') || t.includes('CDB') || t.includes('LCI') || t.includes('LCA') || t.includes('CRI') || t.includes('CRA') || t.includes('DEB');
            // FIX: Only keep if holdings > 0
            return !isFixedIncome && holdings[t] > 0;
        }).sort();
        setActiveTickers(active);
        setTickerCategoryMap(tickerCatMap);
        setSelectedTickers(active); // Select all by default
        setStep('select');
    }
  }, [isOpen, transactions]);

  const groupedTickers = React.useMemo(() => {
      const groups: Record<string, Record<string, string[]>> = {};
      
      activeTickers.forEach(ticker => {
          const mapInfo = tickerCategoryMap[ticker];
          let catName = 'Outros';
          let subCatName = 'Sem Subcategoria';
          
          if (mapInfo) {
              const cat = categories.find(c => c.id === mapInfo.categoryId);
              if (cat) catName = cat.name;
              
              if (mapInfo.subCategoryId) {
                  const subC = subCategories.find(s => s.id === mapInfo.subCategoryId);
                  if (subC) subCatName = subC.name;
              }
          }
          
          if (!groups[catName]) groups[catName] = {};
          if (!groups[catName][subCatName]) groups[catName][subCatName] = [];
          groups[catName][subCatName].push(ticker);
      });
      return groups;
  }, [activeTickers, tickerCategoryMap, categories, subCategories]);

  const handleSearch = async () => {
      if (selectedTickers.length === 0) return;
      if (startMonth > endMonth) { alert("Mês final deve ser maior ou igual ao inicial."); return; }

      setStep('searching');
      
      try {
          const [startY, startM] = startMonth.split('-').map(Number);
          const [endY, endM] = endMonth.split('-').map(Number);
          
          const startStr = `${startY}-${String(startM).padStart(2, '0')}-00`;
          const endStr = `${endY}-${String(endM).padStart(2, '0')}-99`;

          let allDividends: any[] = [];
          let allSources: { uri: string, title: string }[] = [];

          // Fetch Dividends from Yahoo Finance for all selected tickers
          let warningMessage = '';
          if (selectedTickers.length > 0) {
              const results = await Promise.allSettled(selectedTickers.map(t => YahooFinanceService.fetchDividends(t, '2y')));
              
              const successfulResults: any[] = [];
              let failedCount = 0;

              results.forEach((result, index) => {
                  if (result.status === 'fulfilled') {
                      successfulResults.push(result.value);
                  } else {
                      failedCount++;
                  }
              });

              if (failedCount > 0) {
                  warningMessage += `Atenção: Não foi possível buscar no Yahoo Finance para ${failedCount} ativo(s). `;
              }

              const flatResults = successfulResults.flat().filter(d => {
                  if (!d.paymentDate) return false;
                  // Filter strictly by payment date (or dataCom if used as paymentDate)
                  return d.paymentDate >= startStr && d.paymentDate <= endStr;
              });
              allDividends = [...allDividends, ...flatResults];
              allSources.push({ uri: 'https://finance.yahoo.com', title: 'Yahoo Finance' });
              
              // ADD: Fetch from Gemini as well!
              try {
                  const realStartDate = new Date(startY, startM - 1, 1);
                  const realEndDate = new Date(endY, endM, 0, 23, 59, 59);
                  const { dividends: aiDividends, sources: aiSources } = await GeminiService.findDividends(selectedTickers, realStartDate, realEndDate);
                  if (aiDividends.length > 0) {
                      allDividends = [...aiDividends, ...allDividends];
                  }
                  if (aiSources.length > 0) {
                      allSources = [...allSources, ...aiSources];
                  }
              } catch (err) {
                  console.error("Gemini dividend fetch error:", err);
                  warningMessage += "Houve uma falha na busca inteligente do Gemini.";
              }
          }
          
          // Pre-calculate holdings correctly based on chronological order
          const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const getQuantityOnDate = (targetTicker: string, targetDateStr: string) => {
              const targetDate = new Date(targetDateStr + 'T23:59:59Z');
              const tempHoldings: Record<string, number> = {};
              
              sortedTransactions.forEach(t => {
                  if (t.type === TransactionType.INVESTMENT && t.investmentDetails && new Date(t.date) <= targetDate) {
                      const { ticker, quantity, event, newTicker } = t.investmentDetails;
                      if (!tempHoldings[ticker]) tempHoldings[ticker] = 0;

                      if (event === 'BUY') tempHoldings[ticker] += quantity;
                      else if (event === 'BONUS') tempHoldings[ticker] += quantity;
                      else if (event === 'SELL') tempHoldings[ticker] -= quantity;
                      else if (event === 'SPLIT') tempHoldings[ticker] *= quantity;
                      else if (event === 'MERGE') tempHoldings[ticker] /= quantity;
                      else if (event === 'TICKER_UPDATE' && newTicker) {
                          const qty = tempHoldings[ticker];
                          tempHoldings[ticker] = 0;
                          tempHoldings[newTicker] = (tempHoldings[newTicker] || 0) + qty;
                      }
                  }
              });
              
              return tempHoldings[targetTicker] || 0;
          };

          // Helper to check if ticker/dividend is in USD / exterior
          const isUsdAsset = (ticker: string, divCurrency?: string) => {
              if (divCurrency === 'USD') return true;
              const recentTx = sortedTransactions
                  .filter(t => t.investmentDetails?.ticker === ticker)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              if (recentTx?.investmentDetails?.currency === 'USD') return true;

              const mapInfo = tickerCategoryMap[ticker];
              if (mapInfo) {
                  const cat = categories.find(c => c.id === mapInfo.categoryId);
                  const subC = subCategories.find(s => s.id === mapInfo.subCategoryId);
                  const catName = (cat?.name || '').toLowerCase();
                  const subCatName = (subC?.name || '').toLowerCase();
                  if (catName.includes('exterior') || catName.includes('eua') || catName.includes('internacional') || subCatName.includes('eua') || subCatName.includes('exterior')) {
                      return true;
                  }
              }
              // Tickers without numbers (e.g. AAPL, MSFT, O, SCHD, NVDA, TSLA) that aren't Brazilian 'OUTROS'
              if (!/\d/.test(ticker) && ticker !== 'OUTROS' && ticker.length <= 6) {
                  return true;
              }
              return false;
          };

          // Cache for PTAX queries during the search session
          const ptaxCache = new Map<string, number>();

          const getPtaxForDate = async (dateStr: string): Promise<number> => {
              if (!dateStr) dateStr = new Date().toISOString().split('T')[0];
              if (ptaxCache.has(dateStr)) return ptaxCache.get(dateStr)!;

              // Check BCB PTAX for dateStr or preceding business days (up to 5 days back for weekends/holidays)
              let cur = new Date(dateStr + 'T12:00:00Z');
              for (let i = 0; i < 5; i++) {
                  const yyyy = cur.getUTCFullYear();
                  const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
                  const dd = String(cur.getUTCDate()).padStart(2, '0');
                  const tryDateStr = `${yyyy}-${mm}-${dd}`;

                  try {
                      const ptaxRes = await BrapiService.fetchPtaxForDate(tryDateStr);
                      if (ptaxRes && ptaxRes.venda > 0) {
                          ptaxCache.set(dateStr, ptaxRes.venda);
                          return ptaxRes.venda;
                      }
                  } catch (e) {
                      console.warn(`Error fetching BCB PTAX for ${tryDateStr}:`, e);
                  }
                  cur.setUTCDate(cur.getUTCDate() - 1);
              }

              // Fallback: Gemini historical forex
              try {
                  const gRate = await GeminiService.fetchHistoricalForex(dateStr, 'USD');
                  if (gRate && gRate > 1) {
                      ptaxCache.set(dateStr, gRate);
                      return gRate;
                  }
              } catch (e) {}

              // Fallback: Current BCB PTAX
              try {
                  const currentPtax = await BrapiService.fetchPtax();
                  if (currentPtax && currentPtax > 1) {
                      ptaxCache.set(dateStr, currentPtax);
                      return currentPtax;
                  }
              } catch (e) {}

              return 5.50; // default fallback if APIs fail
          };

          // Process results: Match with quantity user owns
          const processed: any[] = [];
          const seen = new Set<string>();

          for (let idx = 0; idx < allDividends.length; idx++) {
              const div = allDividends[idx];
              // If we have dataCom, use it. Otherwise, assume they held it 30 days before payment.
              let targetDate = div.dataCom;
              if (!targetDate) {
                  if (div.paymentDate) {
                      const d = new Date(div.paymentDate);
                      d.setDate(d.getDate() - 30);
                      targetDate = d.toISOString().split('T')[0];
                  } else {
                      // Fallback to today if both are missing
                      targetDate = new Date().toISOString().split('T')[0];
                  }
              }
              
              const currentQty = getQuantityOnDate(div.ticker, targetDate);
              
              // Skip if user didn't hold the asset
              if (currentQty <= 0) continue;

              // Check for duplicates inside the search session
              let divDateForKey = new Date();
              if (div.paymentDate) divDateForKey = new Date(div.paymentDate);
              const uniqueKey = `${div.ticker}-${divDateForKey.getFullYear()}-${divDateForKey.getMonth()}-${Number(div.amount).toFixed(4)}`;
              if (seen.has(uniqueKey)) continue;
              seen.add(uniqueKey);

              const isUsd = isUsdAsset(div.ticker, div.currency);
              const currency = isUsd ? 'USD' : 'BRL';

              // --- US TAX LOGIC & PTAX LOOKUP ---
              let grossUnit = Number(div.amount) || 0;
              let taxUnit = 0;
              let netUnit = grossUnit;
              let ptax = 1;

              if (isUsd) {
                  // If div already has a valid PTAX > 1 from Gemini/source, use it; otherwise fetch real PTAX
                  if (div.ptax && typeof div.ptax === 'number' && div.ptax > 1) {
                      ptax = div.ptax;
                  } else {
                      ptax = await getPtaxForDate(div.paymentDate || targetDate);
                  }
                  // US Law: 30% tax on dividends for non-residents
                  taxUnit = grossUnit * 0.30;
                  netUnit = grossUnit - taxUnit;
              } else if (div.type === 'JCP') {
                  // JCP (Juros sobre Capital Próprio) in Brazil has 15% IRRF
                  taxUnit = grossUnit * 0.15;
                  netUnit = grossUnit - taxUnit;
              }

              // Calculate Totals in BRL: (Net USD * Qty) * PTAX
              const totalAmountBrl = (netUnit * currentQty) * ptax;

              // Check for Duplicates (Compare converted BRL amount)
              const isDuplicate = transactions.some(t => 
                  t.type === TransactionType.INVESTMENT &&
                  t.investmentDetails?.ticker === div.ticker &&
                  // Check if event type matches
                  (t.investmentDetails?.event === div.type || 
                   (t.investmentDetails?.event === 'DIVIDEND' && div.type === 'DIVIDEND') ||
                   (t.investmentDetails?.event === 'JCP' && div.type === 'JCP') ||
                   (t.investmentDetails?.event === 'RENDIMENTO' && div.type === 'RENDIMENTO')) &&
                  // Check if date is in the same month and year
                  new Date(t.date).getMonth() === new Date(div.paymentDate).getMonth() &&
                  new Date(t.date).getFullYear() === new Date(div.paymentDate).getFullYear() &&
                  // Check amount tolerance (1% tolerance or R$ 1.00, whichever is larger)
                  Math.abs(t.amount - totalAmountBrl) < Math.max(1.00, totalAmountBrl * 0.01)
              );

              processed.push({
                  id: `ai-div-${idx}-${Date.now()}`,
                  ticker: div.ticker,
                  type: div.type,
                  date: div.paymentDate,
                  
                  // Detail fields
                  grossUnit,
                  taxUnit,
                  netUnit, // Unitary Net in Original Currency
                  
                  quantity: currentQty,
                  currency: currency,
                  ptax: ptax,
                  
                  totalAmount: totalAmountBrl, // Final BRL to receive
                  
                  selected: !isDuplicate && totalAmountBrl > 0,
                  isDuplicate: isDuplicate,
                  editableDate: div.paymentDate,
                  editableAmount: totalAmountBrl
              });
          }

          setFoundDividends(processed);
          setSources(allSources);
          setWarning(warningMessage || null);
          setStep('review');
      } catch (e) {
          console.error(e);
          alert("Erro ao buscar dados. Tente novamente.");
          setStep('select');
      }
  };

  const handleConfirmImport = async () => {
      const toImport = foundDividends.filter(d => d.selected && d.totalAmount > 0);
      const defaultInvestmentCategory = categories.find(c => c.type === TransactionType.INVESTMENT);
      
      const payload = toImport.map(d => {
          // Busca a transação mais recente deste ativo para herdar a Categoria e Subcategoria corretas
          const recentTx = transactions
            .filter(t => t.investmentDetails?.ticker === d.ticker)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]; // Ordena decrescente (mais recente primeiro)
          
          return {
            type: TransactionType.INVESTMENT,
            description: `${d.type === 'DIVIDEND' ? 'Dividendos' : (d.type === 'JCP' ? 'JCP' : 'Rendimentos')} - ${d.ticker}`,
            amount: d.totalAmount, // Valor Líquido em BRL (Caixa)
            date: new Date(d.date + 'T12:00:00').toISOString(),
            // Usa a categoria do histórico do ativo, ou fallback para a padrão de investimentos
            categoryId: recentTx?.categoryId || defaultInvestmentCategory?.id || '',
            // Usa a subcategoria do histórico do ativo
            subCategoryId: recentTx?.subCategoryId || undefined,
            paymentMethod: PaymentMethod.DEBIT_CASH,
            isPaid: true,
            investmentDetails: {
                ticker: d.ticker,
                event: d.type,
                quantity: 0,
                price: 0,
                fees: 0,
                broker: 'Radar IA',
                tax: d.taxUnit * d.quantity, // Imposto Total na moeda original
                grossAmount: d.grossUnit * d.quantity, // Bruto Total na moeda original
                currency: d.currency,
                ptax: d.currency === 'USD' ? d.ptax : undefined
            } as InvestmentDetails
          };
      });

      await onImport(payload);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-gray-700"><Sparkles size={20} /></div>
              <div>
                  <h2 className="text-lg font-bold text-gray-900">Radar de Proventos IA</h2>
                  <p className="text-xs text-gray-700 font-medium">Busca automática com regras tributárias (30% EUA, 15% JCP BR)</p>
              </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {step === 'select' && (
                <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2"><Calendar size={14}/> Intervalo de Busca</label>
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">De</span>
                                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-gray-500" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Até</span>
                                <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-gray-500" />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">A IA buscará datas de pagamento ("Pay Date") dentro deste intervalo.</p>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-800">Ativos na Carteira ({activeTickers.length})</h3>
                            <button onClick={() => setSelectedTickers(selectedTickers.length === activeTickers.length ? [] : activeTickers)} className="text-xs text-gray-700 font-bold hover:underline">
                                {selectedTickers.length === activeTickers.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {Object.entries(groupedTickers).map(([catName, subCats]) => (
                                <div key={catName} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-100/80 px-4 py-2 border-b border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-700">{catName}</h4>
                                    </div>
                                    <div className="p-3 space-y-4 bg-white dark:bg-zinc-900">
                                        {Object.entries(subCats).map(([subCatName, tickers]) => {
                                            const isAllSelected = tickers.every(t => selectedTickers.includes(t));
                                            
                                            const handleToggleSubCat = () => {
                                                if (isAllSelected) {
                                                    setSelectedTickers(prev => prev.filter(t => !tickers.includes(t)));
                                                } else {
                                                    const toAdd = tickers.filter(t => !selectedTickers.includes(t));
                                                    setSelectedTickers(prev => [...prev, ...toAdd]);
                                                }
                                            }

                                            return (
                                            <div key={subCatName}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <h5 className="text-[10px] font-bold text-gray-500 uppercase">{subCatName}</h5>
                                                    <button onClick={handleToggleSubCat} className="text-[10px] bg-gray-50 px-2 py-0.5 rounded text-gray-500 hover:text-gray-800 transition-colors">
                                                        {isAllSelected ? 'Desmarcar' : 'Marcar'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                    {tickers.map(ticker => (
                                                        <button 
                                                            key={ticker} 
                                                            onClick={() => setSelectedTickers(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker])}
                                                            className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedTickers.includes(ticker) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-zinc-900 text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                                        >
                                                            {ticker}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button onClick={handleSearch} disabled={selectedTickers.length === 0} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            Iniciar Varredura <Search size={18} />
                        </button>
                    </div>
                </div>
            )}

            {step === 'searching' && (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700 animate-pulse" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Analisando o Mercado...</h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">A IA está consultando fontes oficiais, calculando impostos (30% EUA, 15% JCP BR) e buscando o PTAX para <strong>{selectedTickers.length} ativos</strong>.</p>
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-6">
                    {warning && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex items-start space-x-3">
                            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-yellow-800">{warning}</p>
                        </div>
                    )}
                    {foundDividends.length === 0 ? (
                        <div className="text-center py-10">
                            <AlertCircle size={48} className="mx-auto text-gray-700 mb-4"/>
                            <p className="text-gray-500 font-medium">Nenhum provento encontrado para os ativos selecionados neste período.</p>
                            <button onClick={() => setStep('select')} className="mt-4 text-gray-700 font-bold hover:underline">Tentar outro intervalo</button>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[50vh] custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 w-10">
                                                <input type="checkbox" checked={foundDividends.every(d => d.selected)} onChange={(e) => setFoundDividends(prev => prev.map(d => ({ ...d, selected: e.target.checked })))} className="rounded text-gray-700 focus:ring-gray-500" />
                                            </th>
                                            <th className="px-4 py-3">Ativo</th>
                                            <th className="px-4 py-3">Pagamento</th>
                                            <th className="px-4 py-3 text-right">Bruto (Orig)</th>
                                            <th className="px-4 py-3 text-right">Taxa (Orig)</th>
                                            <th className="px-4 py-3 text-center">PTAX</th>
                                            <th className="px-4 py-3 text-right">Líquido Final (BRL)</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {foundDividends.map((item) => (
                                            <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.selected ? 'opacity-50 grayscale' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <input type="checkbox" checked={item.selected} onChange={(e) => setFoundDividends(prev => prev.map(d => d.id === item.id ? { ...d, selected: e.target.checked } : d))} className="rounded text-gray-700 focus:ring-gray-500" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-800">{item.ticker}</div>
                                                    <div className="text-[9px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5">{item.type}</div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{(() => { const d = new Date(item.date); return isNaN(d.getTime()) ? (item.date || '') : d.toLocaleDateString('pt-BR', {timeZone: 'UTC'}); })()}</td>
                                                <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                                                    {item.currency} {item.grossUnit.toFixed(4)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-rose-500">
                                                    {item.taxUnit > 0 ? `-${item.taxUnit.toFixed(4)}` : '-'}
                                                    {item.currency === 'USD' && item.taxUnit > 0 && <span className="block text-[8px] text-rose-600 font-bold">(30%)</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-gray-500 font-mono">
                                                    {item.currency === 'USD' ? (
                                                        <span className="font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-100">
                                                            R$ {item.ptax.toFixed(4)}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-bold text-emerald-600 bg-emerald-50/50 px-2 py-1 rounded">
                                                        R$ {(item.totalAmount || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                    </div>
                                                    <div className="text-[9px] text-gray-500 mt-0.5">
                                                        (Qtd: {item.quantity})
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.isDuplicate ? (
                                                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded border border-amber-200">Duplicado</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 size={10}/> Novo</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase">Total Previsto (Líquido)</span>
                                    <p className="text-2xl font-bold text-emerald-600">R$ {(foundDividends.filter(d => d.selected).reduce((acc, curr) => acc + curr.totalAmount, 0) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setStep('select')} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Voltar</button>
                                    <button onClick={handleConfirmImport} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2">Confirmar Importação <CheckCircle2 size={18} /></button>
                                </div>
                            </div>

                            {sources.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Fontes Consultadas</p>
                                    <div className="flex flex-wrap gap-2">
                                        {sources.slice(0, 3).map((s, idx) => (
                                            <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline bg-blue-50 px-2 py-1 rounded truncate max-w-[200px] block">
                                                {s.title || s.uri}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
