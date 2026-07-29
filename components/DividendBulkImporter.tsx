
import React, { useState, useMemo } from 'react';
import { Category, TransactionType, PaymentMethod, InvestmentDetails, SubCategory, Transaction } from '../types';
import { X, Database, ArrowRight, Save, AlertCircle, CheckCircle2, Table, Loader2 } from 'lucide-react';

interface DividendBulkImporterProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subCategories: SubCategory[];
  transactions?: Transaction[]; // Added for duplicate check
  onImport: (transactions: any[]) => Promise<void>;
}

interface ParsedDividend {
  id: string;
  ticker: string;
  date: string;
  type: 'DIVIDEND' | 'JCP' | 'RENDIMENTO';
  gross: number;
  tax: number;
  net: number;
  currency: string;
  ptax: number;
  broker: string;
  categoryId: string;
  subCategoryId: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

export const DividendBulkImporter: React.FC<DividendBulkImporterProps> = ({ isOpen, onClose, categories, subCategories, transactions = [], onImport }) => {
  const [step, setStep] = useState<'input' | 'review' | 'saving'>('input');
  const [textInput, setTextInput] = useState('');
  const [parsedData, setParsedData] = useState<ParsedDividend[]>([]);
  
  const investmentCategories = useMemo(() => categories.filter(c => c.type === TransactionType.INVESTMENT), [categories]);
  const defaultCatId = investmentCategories.length > 0 ? investmentCategories[0].id : '';

  const parseText = () => {
    const lines = textInput.split('\n').filter(l => l.trim().length > 0);
    const results: ParsedDividend[] = [];

    // Tenta detectar cabeçalho (pula se encontrar)
    const startIdx = lines[0].toLowerCase().includes('ativo') || lines[0].toLowerCase().includes('ticker') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        // Tenta separar por Tabulação ou Ponto e Vírgula
        let columns = lines[i].split('\t');
        if (columns.length < 4) columns = lines[i].split(';');
        
        if (columns.length < 4) continue;

        try {
            let ticker = '';
            let dateStr = '';
            let type: 'DIVIDEND' | 'JCP' | 'RENDIMENTO' = 'DIVIDEND';
            let gross = 0;
            let tax = 0;
            let net = 0;
            let broker = '';
            let currency = 'BRL';

            // Detecta formato B3: Produto | Tipo | Instituição | Pagamento | Valor
            if (columns.length === 5 && columns[0].includes(' - ')) {
                ticker = columns[0].split(' - ')[0].trim().toUpperCase();
                const rawType = columns[1].trim().toUpperCase();
                if (rawType.includes('JCP') || rawType.includes('JUROS')) type = 'JCP';
                else if (rawType.includes('REND') || rawType.includes('FII')) type = 'RENDIMENTO';
                
                broker = columns[2].trim();
                dateStr = columns[3].trim();
                
                // Valor Líquido
                const val = columns[4].trim();
                const cleanNum = (val: string) => parseFloat(val.replace(/\./g, '').replace(',', '.').replace(/[R$\s]/g, '')) || 0;
                net = cleanNum(val);
                gross = net; // Assume bruto = líquido se não houver IRRF informado
                tax = 0;
            } else {
                // Formato original
                ticker = columns[0]?.trim().toUpperCase();
                dateStr = columns[1]?.trim();
                
                const rawType = columns[2]?.trim().toUpperCase() || '';
                if (rawType.includes('JCP') || rawType.includes('JUROS')) type = 'JCP';
                else if (rawType.includes('REND') || rawType.includes('FII')) type = 'RENDIMENTO';

                const cleanNum = (val: string) => parseFloat(val.replace(/\./g, '').replace(',', '.').replace(/[R$\s]/g, '')) || 0;
                gross = cleanNum(columns[3]);
                tax = cleanNum(columns[4]);
                currency = columns[5]?.trim() || 'BRL';
                
                // ... (rest of the original logic for PTAX, etc.)
                const col6Raw = columns[6]?.trim();
                const isCol6Numeric = col6Raw && !isNaN(parseFloat(col6Raw.replace(',', '.'))) && !/[a-zA-Z]/.test(col6Raw);
                
                let ptax = 1;
                if (isCol6Numeric) {
                    ptax = cleanNum(col6Raw) || 1;
                    broker = columns[7]?.trim() || '';
                } else {
                    broker = col6Raw || '';
                }
                
                let conversionFactor = 1;
                if (currency !== 'BRL' && ptax > 0) conversionFactor = ptax;
                net = (gross - tax) * conversionFactor;
            }

            // Tratamento de Data
            let isoDate = new Date().toISOString().split('T')[0];
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            let categoryId = defaultCatId;
            let subCategoryId = '';

            // Tenta encontrar categoria pelo nome (se disponível)
            // No formato B3, não temos categoria/subcategoria, usa padrão.
            // No formato original, tentamos extrair.
            
            // Re-implementar lógica de categoria para o formato original se necessário
            // Para o formato B3, manter padrão.

            // Check Duplicate
            const isDuplicate = transactions.some(t => 
                t.type === TransactionType.INVESTMENT &&
                t.investmentDetails?.ticker === ticker &&
                t.investmentDetails?.event === type &&
                t.date.split('T')[0] === isoDate &&
                Math.abs(t.amount - net) < 0.05
            );

            results.push({
                id: `div-import-${i}-${Date.now()}`,
                ticker,
                date: isoDate,
                type,
                gross,
                tax,
                net,
                currency,
                ptax: currency !== 'BRL' ? 1 : 0,
                broker,
                categoryId,
                subCategoryId,
                isValid: ticker.length >= 3 && net > 0,
                isDuplicate
            });
        } catch (e) { console.error("Erro parsing linha", i, e); }
    }
    setParsedData(results);
    setStep('review');
  };

  const handleSave = async () => {
      setStep('saving');
      
      // Filter out invalid items AND marked duplicates
      const transactionsToSave = parsedData
        .filter(d => d.isValid && !d.isDuplicate)
        .map(d => ({
          type: TransactionType.INVESTMENT,
          description: `${d.type === 'DIVIDEND' ? 'Dividendos' : (d.type === 'JCP' ? 'JCP' : 'Rendimentos')} - ${d.ticker}`,
          amount: d.net, // Valor Líquido em REAIS que entra no caixa
          date: new Date(d.date + 'T12:00:00').toISOString(),
          categoryId: d.categoryId,
          subCategoryId: d.subCategoryId || undefined,
          paymentMethod: PaymentMethod.DEBIT_CASH,
          isPaid: true,
          investmentDetails: {
              ticker: d.ticker,
              event: d.type,
              quantity: 0,
              price: 0,
              fees: 0,
              broker: d.broker,
              tax: d.tax,
              grossAmount: d.gross,
              currency: d.currency,
              ptax: d.ptax > 0 ? d.ptax : undefined
          } as InvestmentDetails
      }));
      
      // Add a small delay so user sees the saving state
      setTimeout(async () => {
          await onImport(transactionsToSave);
          onClose();
      }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-gray-700" /> Importar Proventos em Lote
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {step === 'input' && (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                        <p className="font-bold mb-2">Cole os dados da sua planilha (separados por TAB ou Ponto-e-Vírgula):</p>
                        <div className="bg-white/60 p-2 rounded border border-blue-200 overflow-x-auto">
                            <code className="text-xs font-mono whitespace-nowrap">
                                Ativo | Data (DD/MM/AAAA) | Evento | Valor | IRRF | Moeda | [PTAX] | Corretora | Categoria | Subcategoria
                            </code>
                        </div>
                        <p className="mt-2 text-xs opacity-80">
                            * <strong>PTAX é opcional:</strong> Se a moeda for BRL ou se a coluna não for numérica, o sistema assume 1 e lê a próxima coluna como Corretora.<br/>
                            * O campo "Valor" deve ser o valor bruto.<br/>
                        </p>
                    </div>
                    <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-gray-500 outline-none resize-none text-gray-900"
                        placeholder="PETR4	15/05/2024	DIV	150,00	0,00	BRL	XP	Ações	Brasil&#10;AAPL34	20/05/2024	DIV	1.50	0.45	USD	5.20	Avenue	Ações	EUA"
                    />
                    <div className="flex justify-end">
                        <button onClick={parseText} disabled={!textInput.trim()} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-lg flex items-center gap-2">
                            Processar <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
            
            {step === 'review' && (
                <div className="space-y-6">
                    <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[50vh] custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Ativo</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Evento</th>
                                    <th className="px-4 py-3 text-right">Bruto</th>
                                    <th className="px-4 py-3 text-right">IR</th>
                                    <th className="px-4 py-3">Moeda/PTAX</th>
                                    <th className="px-4 py-3 text-right">Líquido (BRL)</th>
                                    <th className="px-4 py-3">Categoria</th>
                                    <th className="px-4 py-3">Subcat.</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {parsedData.map((d) => (
                                    <tr key={d.id} className={!d.isValid ? 'bg-rose-50' : (d.isDuplicate ? 'bg-amber-50 opacity-60' : 'hover:bg-gray-50')}>
                                        <td className="px-4 py-3 font-bold text-gray-800">{d.ticker}</td>
                                        <td className="px-4 py-3 text-xs font-mono text-gray-700">{d.date}</td>
                                        <td className="px-4 py-3"><span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-700">{d.type}</span></td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{d.gross.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-rose-500">{d.tax > 0 ? `-${d.tax.toFixed(2)}` : '-'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{d.currency} {d.currency !== 'BRL' && d.ptax > 0 ? `(${d.ptax})` : ''}</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{d.net.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <select 
                                                value={d.categoryId} 
                                                onChange={(e) => setParsedData(prev => prev.map(p => p.id === d.id ? { ...p, categoryId: e.target.value, subCategoryId: '' } : p))}
                                                className="bg-transparent border-b border-transparent focus:border-gray-500 outline-none text-xs w-24 truncate text-gray-800"
                                            >
                                                {investmentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select 
                                                value={d.subCategoryId} 
                                                onChange={(e) => setParsedData(prev => prev.map(p => p.id === d.id ? { ...p, subCategoryId: e.target.value } : p))}
                                                className="bg-transparent border-b border-transparent focus:border-gray-500 outline-none text-xs w-24 truncate disabled:opacity-50 text-gray-800"
                                                disabled={!d.categoryId}
                                            >
                                                <option value="">-</option>
                                                {subCategories.filter(s => s.categoryId === d.categoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {!d.isValid ? (
                                                <AlertCircle className="text-rose-500 mx-auto" size={16} />
                                            ) : d.isDuplicate ? (
                                                <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">Duplicado</span>
                                            ) : (
                                                <CheckCircle2 className="text-emerald-500 mx-auto" size={16} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="text-sm font-medium text-gray-700">
                            Total de <b>{parsedData.filter(d => d.isValid && !d.isDuplicate).length}</b> novos proventos.
                            <br/>
                            <span className="text-xs text-amber-600 font-bold">{parsedData.filter(d => d.isDuplicate).length} duplicatas serão ignoradas.</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setStep('input')} className="px-6 py-2 text-gray-500 font-bold hover:bg-emerald-700 rounded-xl transition-colors">Voltar</button>
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-lg flex items-center gap-2">Confirmar <Save size={18} /></button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'saving' && (
                <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
                    <Loader2 size={48} className="text-emerald-600 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-gray-900">Salvando Registros...</h3>
                    <p className="text-sm text-gray-500 mt-2">Estamos processando e gravando seus proventos no histórico.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
