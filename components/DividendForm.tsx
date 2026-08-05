
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, PaymentMethod, SubCategory } from '../types';
import { GeminiService } from '../services/geminiService';
import { BrapiService } from '../services/brapiService';
import { X, Gift, Calendar, DollarSign, TrendingUp, Landmark, FileText, Calculator, Layers, AlertCircle, Globe, Loader2, Search } from 'lucide-react';

interface DividendFormProps {
  transactionToEdit?: Transaction | null;
  categories: Category[];
  subCategories?: SubCategory[]; 
  transactions?: Transaction[]; 
  onSave: (data: Partial<Transaction>) => void;
  onClose: () => void;
}

export const DividendForm: React.FC<DividendFormProps> = ({ categories, subCategories = [], transactions = [], onSave, onClose, transactionToEdit }) => {
  const [ticker, setTicker] = useState(transactionToEdit?.investmentDetails?.ticker || '');
  const [broker, setBroker] = useState(transactionToEdit?.investmentDetails?.broker || '');
  const [eventType, setEventType] = useState<'DIVIDEND' | 'JCP' | 'RENDIMENTO' | 'REEMBOLSO'>((transactionToEdit?.investmentDetails?.event as any) || 'DIVIDEND');
  const [date, setDate] = useState(transactionToEdit?.date || new Date().toISOString().split('T')[0]);
  
  // Values
  const [grossValue, setGrossValue] = useState(transactionToEdit?.amount ? String(Math.abs(transactionToEdit.amount) + (transactionToEdit.investmentDetails?.tax || 0)) : '');
  const [taxValue, setTaxValue] = useState(transactionToEdit?.investmentDetails?.tax ? String(transactionToEdit.investmentDetails.tax) : '');
  const [netValue, setNetValue] = useState(transactionToEdit?.amount ? String(Math.abs(transactionToEdit.amount)) : '');
  
  // Foreign Exchange
  const [currency, setCurrency] = useState<'BRL' | 'USD'>((transactionToEdit?.currency as any) || 'BRL');
  const [ptax, setPtax] = useState(transactionToEdit?.investmentDetails?.ptax ? String(transactionToEdit.investmentDetails.ptax) : '');
  const [loadingForex, setLoadingForex] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Auto-select first investment category
  useEffect(() => {
      if (!categoryId) {
          const invCat = categories.find(c => c.type === TransactionType.INVESTMENT);
          if (invCat) setCategoryId(invCat.id);
      }
  }, [categories]);

  // Auto-calculate Net Value (Converted to BRL)
  useEffect(() => {
      const gross = parseFloat(grossValue) || 0;
      const tax = parseFloat(taxValue) || 0;
      const conversionRate = currency === 'USD' ? (parseFloat(ptax) || 0) : 1;
      
      // Logic: (Gross - Tax) in original currency * Exchange Rate
      // If USD: (1.00 - 0.30) * 5.50 = R$ 3.85
      const netOriginal = gross - tax;
      const netBrl = netOriginal * (conversionRate > 0 ? conversionRate : 0);

      setNetValue(netBrl.toFixed(2));
      
      // Check for Duplicates
      if (ticker && date && netBrl > 0) {
          const isDuplicate = transactions.some(t => 
              t.type === TransactionType.INVESTMENT &&
              t.investmentDetails?.ticker === ticker.toUpperCase() &&
              t.investmentDetails?.event === eventType &&
              t.date.split('T')[0] === date &&
              Math.abs(t.amount - netBrl) < 0.05
          );
          setDuplicateWarning(isDuplicate);
      } else {
          setDuplicateWarning(false);
      }
  }, [grossValue, taxValue, ticker, date, eventType, transactions, currency, ptax]);

  // Auto-Fill Category and Subcategory based on Ticker History
  useEffect(() => {
      if (ticker.length >= 3) {
          const cleanTicker = ticker.trim().toUpperCase();
          
          // Find the most recent investment transaction with this ticker
          const relevant = transactions
              .filter(t => t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker === cleanTicker)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          if (relevant.length > 0) {
              const last = relevant[0];
              if (last.categoryId) setCategoryId(last.categoryId);
              if (last.subCategoryId) setSubCategoryId(last.subCategoryId);
              
              // Try to auto-detect currency from previous entries
              if (last.investmentDetails?.currency) {
                  setCurrency(last.investmentDetails.currency as 'BRL' | 'USD');
              }
          }
      }
  }, [ticker, transactions]);

  const handleFetchForex = async () => {
      if (!date) return;
      setLoadingForex(true);
      try {
          const rate = await BrapiService.fetchPtaxForDate(date);
          if (rate) {
              setPtax(rate.compra.toString());
          } else {
              alert("Não foi possível encontrar o PTAX para esta data. Insira manualmente.");
          }
      } catch (e) { 
        console.error(e);
      } finally { setLoadingForex(false); }
  };

  useEffect(() => {
      if (currency === 'USD' && date) {
          handleFetchForex();
      }
  }, [date, currency]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!ticker || !netValue || parseFloat(netValue) <= 0) return;
      
      if (currency === 'USD' && (!ptax || parseFloat(ptax) <= 0)) {
          alert("Para proventos em Dólar, o PTAX é obrigatório para converter o valor final para Reais.");
          return;
      }

      const descMap: Record<string, string> = {
          'DIVIDEND': 'Dividendos',
          'JCP': 'JCP',
          'RENDIMENTO': 'Rendimentos',
          'REEMBOLSO': 'Reembolso'
      };

      const payload: any = {
          type: TransactionType.INVESTMENT,
          amount: parseFloat(netValue), // Value entering the cash flow (always BRL)
          date: new Date(date + 'T12:00:00').toISOString(),
          description: `${descMap[eventType]} - ${ticker.toUpperCase()}`,
          categoryId,
          subCategoryId: subCategoryId || undefined,
          paymentMethod: PaymentMethod.DEBIT_CASH,
          isPaid: true,
          investmentDetails: {
              ticker: ticker.toUpperCase(),
              event: eventType,
              quantity: 0, 
              price: 0, 
              fees: 0,
              broker: broker,
              tax: parseFloat(taxValue) || 0, // Tax in Original Currency
              grossAmount: parseFloat(grossValue) || 0, // Gross in Original Currency
              currency: currency,
              ptax: currency === 'USD' ? parseFloat(ptax) : undefined
          }
      };
      onSave(payload);
      onClose();
  };

  const filteredSubCategories = subCategories.filter(s => s.categoryId === categoryId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center bg-gray-50 dark:bg-zinc-800\/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50 flex items-center gap-2"><Gift size={20} className="text-gray-700 dark:text-zinc-300"/> Registrar Provento</h2>
          <button onClick={onClose} className="p-2 bg-white hover:bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-full transition-colors shadow-sm"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
            
            {duplicateWarning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg flex items-start gap-2 text-xs font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>Atenção: Parece que este provento já foi cadastrado anteriormente nesta data.</span>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><TrendingUp size={12}/> Ativo (Ticker)</label>
                    <input type="text" required value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none text-gray-900 dark:text-zinc-50 font-bold uppercase placeholder:font-normal" placeholder="Ex: AAPL" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><Calendar size={12}/> Data Pagamento</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none font-bold text-gray-800" />
                </div>
            </div>

            <div className="space-y-3">
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Tipo de Evento</label>
                <div className="grid grid-cols-4 gap-2">
                    <button type="button" onClick={() => setEventType('DIVIDEND')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${eventType === 'DIVIDEND' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800\/50'}`}>Div.</button>
                    <button type="button" onClick={() => setEventType('JCP')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${eventType === 'JCP' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800\/50'}`}>JCP</button>
                    <button type="button" onClick={() => setEventType('RENDIMENTO')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${eventType === 'RENDIMENTO' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800\/50'}`}>Rend.</button>
                    <button type="button" onClick={() => setEventType('REEMBOLSO')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${eventType === 'REEMBOLSO' ? 'bg-cyan-50 border-cyan-500 text-cyan-700' : 'bg-white border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800\/50'}`}>Reemb.</button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><Globe size={12}/> Moeda</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value as 'BRL'|'USD')} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none font-bold text-gray-800">
                        <option value="BRL">BRL (R$)</option>
                        <option value="USD">USD (U$)</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><Landmark size={12}/> Corretora (Opcional)</label>
                    <input type="text" value={broker} onChange={(e) => setBroker(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none" placeholder="Ex: Avenue, XP..." />
                </div>
            </div>

            {currency === 'USD' && (
                <div className="bg-gray-50 dark:bg-zinc-800\/50 p-3 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center gap-3 animate-in fade-in">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">PTAX (Dólar)</label>
                        <input type="number" step="0.0001" value={ptax} onChange={(e) => setPtax(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-gray-500" placeholder="Ex: 5.25" />
                    </div>
                    <button type="button" onClick={handleFetchForex} disabled={loadingForex} className="mt-4 bg-white text-gray-700 dark:text-zinc-300 px-3 py-2 rounded-lg text-[10px] font-bold shadow-sm hover:bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5 border border-gray-200 dark:border-zinc-700 h-fit">
                        {loadingForex ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
                    </button>
                </div>
            )}

            <div className="bg-gray-50 dark:bg-zinc-800\/50 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5">Valor Bruto ({currency})</label>
                        <input type="number" step="0.01" required value={grossValue} onChange={(e) => setGrossValue(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:border-gray-500 font-medium" placeholder="0,00" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5">Taxa/Imposto ({currency})</label>
                        <input type="number" step="0.01" value={taxValue} onChange={(e) => setTaxValue(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:border-gray-500 text-rose-600 font-medium" placeholder="0,00" />
                    </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-end">
                    <div className="text-xs text-gray-500 dark:text-zinc-400 font-medium flex flex-col">
                        <span>Valor Líquido {currency === 'USD' && '(Convertido)'}</span>
                        <span className="text-[10px] text-gray-500 dark:text-zinc-400/80">(Entrada no Caixa em BRL)</span>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600">
                            R$ {(parseFloat(netValue || '0') || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                        {currency === 'USD' && (
                            <div className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold">
                                = ( {parseFloat(grossValue || '0').toFixed(2)} - {parseFloat(taxValue || '0').toFixed(2)} ) x {parseFloat(ptax || '0').toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><FileText size={12}/> Categoria</label>
                    <select required value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId(''); }} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none">
                        <option value="">Selecione...</option>
                        {categories.filter(c => c.type === TransactionType.INVESTMENT).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><Layers size={12}/> Subcategoria</label>
                    <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} disabled={!categoryId} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800\/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none disabled:bg-gray-100 dark:bg-zinc-800 disabled:text-gray-500 dark:text-zinc-400">
                        <option value="">Nenhuma</option>
                        {filteredSubCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

        </form>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800\/50 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:border-zinc-700">Cancelar</button>
            <button type="button" onClick={handleSubmit} className="flex-[2] py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-gray-200 transition-all">Salvar Provento</button>
        </div>

      </div>
    </div>
  );
};
