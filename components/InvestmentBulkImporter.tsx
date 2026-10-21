
import React, { useState, useMemo } from 'react';
import { Category, Transaction, TransactionType, PaymentMethod, InvestmentDetails, SubCategory } from '../types';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, Table, ArrowRight, Save, Database } from 'lucide-react';

interface InvestmentBulkImporterProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subCategories: SubCategory[];
  transactions: Transaction[];
  onImport: (transactions: any[]) => Promise<void>;
}

interface ParsedInvestment {
  id: string;
  ticker: string;
  date: string;
  event: 'BUY' | 'SELL' | 'BONUS' | 'SPLIT' | 'MERGE' | 'TICKER_UPDATE' | 'AMORTIZACAO';
  quantity: number;
  price: number;
  fees: number;
  broker: string;
  tax: number;
  currency: string;
  description: string;
  categoryName: string;
  categoryId: string;
  subCategoryName: string;
  subCategoryId: string;
  ptax: number;
  totalAmount: number;
  newTicker?: string;
  isValid: boolean;
  error?: string;
  isDuplicate: boolean;
  signInverted: boolean;
}

export const InvestmentBulkImporter: React.FC<InvestmentBulkImporterProps> = ({ isOpen, onClose, categories, subCategories, transactions, onImport }) => {
  const [step, setStep] = useState<'input' | 'review' | 'saving'>('input');
  const [textInput, setTextInput] = useState('');
  const [parsedData, setParsedData] = useState<ParsedInvestment[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const investmentCategories = useMemo(() => categories.filter(c => c.type === TransactionType.INVESTMENT), [categories]);

  const parseText = () => {
    const lines = textInput.split('\n').filter(l => l.trim().length > 0);
    const results: ParsedInvestment[] = [];

    const startIdx = lines[0].toLowerCase().includes('ativo') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      let columns = lines[i].split('\t');
      if (columns.length < 5) columns = lines[i].split('|');
      if (columns.length < 5) columns = lines[i].split(';');
      if (columns.length < 5) continue;

      try {
        const ticker = columns[0]?.trim().toUpperCase() || '';
        const rawDate = columns[1]?.trim() || '';
        let rawEvent = columns[2]?.trim().toUpperCase() || 'C';
        
        // Limpeza de números inteligente: suporta formato BR (1.000,00) e formato US (1000.00)
        const cleanNum = (val: string) => {
          if (!val) return "0";
          let clean = val.replace(/[R$\s]/g, '').trim();
          // Se tiver vírgula e ponto, assumimos que o último é o decimal
          const lastComma = clean.lastIndexOf(',');
          const lastDot = clean.lastIndexOf('.');
          
          if (lastComma > lastDot) {
              // Formato BR: 1.000,00
              clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
              // Formato US: 1,000.00
              clean = clean.replace(/,/g, '');
          } else if (lastComma !== -1) {
              // Apenas vírgula: 1000,00
              clean = clean.replace(',', '.');
          }
          // Se tiver apenas ponto, e tiver mais de 2 casas decimais após ele (ex: 1.000), pode ser milhar.
          // Mas normalmente assumimos que é decimal se tiver apenas 1 ponto.
          
          return clean;
        };

        const rawQtyStr = cleanNum(columns[3]);
        const rawPriceStr = cleanNum(columns[4]);
        const rawFeesStr = cleanNum(columns[5]);
        const rawTaxStr = cleanNum(columns[7]);

        let quantity = parseFloat(rawQtyStr);
        let price = parseFloat(rawPriceStr);
        const fees = Math.abs(parseFloat(rawFeesStr)) || 0;
        const tax = Math.abs(parseFloat(rawTaxStr)) || 0;

        const broker = columns[6]?.trim() || '';
        const currency = columns[8]?.trim() || 'BRL';
        const obs = columns[9]?.trim() || '';
        const categoryName = columns[10]?.trim() || '';
        const subCategoryName = columns[11]?.trim() || '';
        const rawPtaxStr = cleanNum(columns[12]);
        const ptax = parseFloat(rawPtaxStr) || 0;

        const dateParts = rawDate.split('/');
        const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : new Date().toISOString().split('T')[0];

        // MAPPING EVENTS
        let event: 'BUY' | 'SELL' | 'BONUS' | 'SPLIT' | 'MERGE' | 'TICKER_UPDATE' | 'AMORTIZACAO' = 'BUY';
        let newTicker: string | undefined = undefined;

        if (['V', 'VENDA', 'S', 'SELL'].includes(rawEvent)) event = 'SELL';
        else if (['C', 'COMPRA', 'B', 'BUY'].includes(rawEvent)) event = 'BUY';
        else if (['BN', 'BONUS', 'BONIFICACAO'].includes(rawEvent)) event = 'BONUS';
        else if (['SPLIT', 'DESDOBRAMENTO', 'S/'].includes(rawEvent)) event = 'SPLIT';
        else if (['INPLIT', 'GRUPAMENTO', 'I', 'MERGE'].includes(rawEvent)) event = 'MERGE';
        else if (['AT', 'UPDATE', 'TICKER'].includes(rawEvent)) {
            event = 'TICKER_UPDATE';
        }
        else if (['AM', 'AMORTIZACAO', 'AMORTIZATION'].includes(rawEvent)) event = 'AMORTIZACAO';

        // REGRA: Se quantidade ou preço for negativo em C/V, inverte lógica (apenas se não for evento especial)
        const originalEvent = event;
        if ((event === 'BUY' || event === 'SELL') && (quantity < 0 || price < 0)) {
            event = 'SELL';
            quantity = Math.abs(quantity);
            price = Math.abs(price);
        }
        const signInverted = event !== originalEvent;

        // 1. Identificar Categoria
        // Só tenta casar com o nome informado se ele foi preenchido; caso contrário usa a
        // primeira categoria como padrão de conveniência (não é considerado "não mapeado").
        const matchedCategory = categoryName ? investmentCategories.find(c =>
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
        ) : undefined;
        const categoryMismatch = !!categoryName && !matchedCategory;
        const category = matchedCategory || investmentCategories[0];

        // 2. Identificar Subcategoria (se houver categoria e nome fornecido)
        let subCategoryId = '';
        if (category && subCategoryName) {
            const sub = subCategories.find(s => 
                s.categoryId === category.id && 
                s.name.toLowerCase() === subCategoryName.toLowerCase()
            );
            if (sub) subCategoryId = sub.id;
        }

        // 3. Lógica PTAX (Renda Variável Internacional)
        const isInternational = categoryName.toLowerCase().includes('internacional') || categoryName.toLowerCase().includes('exterior');
        let finalPrice = price;
        let conversionFactor = 1;

        if (isInternational && ptax > 0) {
            finalPrice = price; 
            conversionFactor = ptax;
        }

        // Cálculo do Total Financeiro em REAIS (para o campo 'amount' da transação)
        // (Qtd * Preço * PTAX) + Taxas (taxas também convertidas pela PTAX quando internacional)
        let totalAmount = 0;
        if (event === 'BUY') {
            totalAmount = (quantity * price * conversionFactor) + (fees + tax) * conversionFactor;
        } else if (event === 'SELL') {
            totalAmount = (quantity * price * conversionFactor) - (fees + tax) * conversionFactor;
        } else if (event === 'AMORTIZACAO') {
             // Amortization is money coming in.
             totalAmount = (quantity * price * conversionFactor);
        } else {
            // Eventos corporativos geralmente têm fluxo 0 no caixa, exceto taxas
            totalAmount = 0;
        }

        const isDuplicate = transactions.some(t => 
            t.type === TransactionType.INVESTMENT &&
            t.investmentDetails?.ticker === ticker &&
            t.investmentDetails?.event === event &&
            t.date.split('T')[0] === isoDate &&
            Math.abs(t.investmentDetails?.quantity - quantity) < 0.0001 &&
            Math.abs(t.investmentDetails?.price - finalPrice) < 0.01
        );

        results.push({
          id: `bulk-${i}-${Date.now()}`,
          ticker,
          date: isoDate,
          event,
          quantity,
          price: finalPrice, 
          fees,
          broker,
          tax,
          currency: isInternational ? 'USD' : currency,
          description: obs || `${event} ${ticker}`,
          categoryName,
          categoryId: category?.id || '',
          subCategoryName,
          subCategoryId,
          ptax: isInternational ? ptax : 0,
          totalAmount: Math.abs(totalAmount), 
          newTicker,
          isValid: ticker.length > 0 && !categoryMismatch && (event === 'TICKER_UPDATE' || quantity > 0 || event === 'AMORTIZACAO'),
          error: !category
            ? 'Classe não mapeada'
            : (categoryMismatch ? `Categoria "${categoryName}" não encontrada — selecione manualmente` : undefined),
          isDuplicate,
          signInverted
        });
      } catch (err) {
        console.error("Erro ao processar linha", i, err);
      }
    }

    setParsedData(results);
    setStep('review');
  };

  const handleFinalImport = async () => {
    setIsSaving(true);
    setStep('saving');
    
    const validItems = parsedData.filter(d => d.isValid && !d.isDuplicate).map(d => ({
      type: TransactionType.INVESTMENT,
      description: d.description,
      amount: d.totalAmount, // Valor total em BRL
      date: new Date(d.date + 'T12:00:00').toISOString(),
      categoryId: d.categoryId,
      subCategoryId: d.subCategoryId || undefined,
      paymentMethod: PaymentMethod.DEBIT_CASH,
      isPaid: true,
      userId: "", // Will be filled by StorageService
      investmentDetails: {
        ticker: d.ticker,
        event: d.event,
        quantity: d.quantity,
        price: d.price, 
        fees: d.fees,
        broker: d.broker,
        tax: d.tax,
        currency: d.currency,
        ptax: d.ptax > 0 ? d.ptax : undefined,
        newTicker: d.newTicker
      } as InvestmentDetails
    }));

    await onImport(validItems);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-blue-600" /> Importação em Lote: Investimentos
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-emerald-700 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'input' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                <AlertCircle className="text-blue-600 shrink-0" size={20} />
                <div className="text-sm text-blue-800">
                  <p className="font-bold">Como importar:</p>
                  <p className="mb-2">Copie e cole as células do seu Excel. Códigos suportados na coluna Evento: <strong>C/V</strong> (Compra/Venda), <strong>BN</strong> (Bonificação), <strong>S</strong> (Desdobramento/Split), <strong>I</strong> (Grupamento/Inplit), <strong>AT</strong> (Atualização Ticker), <strong>AM</strong> (Amortização).</p>
                  <div className="overflow-x-auto bg-white/60 p-2 rounded border border-blue-200">
                    <code className="text-xs font-mono whitespace-nowrap block">
                      ativo | date | evento | qtd | preco | taxas | corretora | irrf | moeda | observacao | categoria | subcategoria | PTAX
                    </code>
                  </div>
                </div>
              </div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-900"
                placeholder={`Exemplo:\nPETR4\t15/01/2024\tBN\t10\t0\t0\tXP\t0\tBRL\tBonificação\tAções\tBrasil\t0\nFB\t20/06/2023\tAT\t0\t0\t0\tAVENUE\t0\tUSD\tMudou para META\tInternacional\tTech\t5.00`}
              />
              <div className="flex justify-end">
                <button
                  onClick={parseText}
                  disabled={!textInput.trim()}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg flex items-center gap-2"
                >
                  Processar Dados <ArrowRight size={18} />
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
                      <th className="px-4 py-3 text-center">Ev.</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-right">Preço</th>
                      <th className="px-4 py-3 text-right">Total (BRL)</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.map((d) => (
                      <tr key={d.id} className={!d.isValid ? 'bg-rose-50' : (d.isDuplicate ? 'bg-amber-50 opacity-60' : 'hover:bg-gray-50')}>
                        <td className="px-4 py-3 font-bold text-gray-800">{d.ticker}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-700">{d.date}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${d.event === 'BUY' ? 'bg-emerald-100 text-emerald-700' : (d.event === 'SELL' ? 'bg-rose-100 text-rose-700' : (d.event === 'AMORTIZACAO' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-800'))}`}>
                            {d.event === 'TICKER_UPDATE' ? 'AT' : (d.event === 'BONUS' ? 'BN' : (d.event === 'SPLIT' ? 'S' : (d.event === 'MERGE' ? 'I' : (d.event === 'AMORTIZACAO' ? 'AM' : d.event))))}
                          </span>
                          {d.signInverted && (
                            <div title="Quantidade ou preço veio negativo na planilha: evento foi invertido automaticamente para VENDA. Confira se é o esperado.">
                              <AlertCircle size={11} className="text-amber-500 inline-block ml-1" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">{d.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{(d.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">R$ {(d.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-xs truncate max-w-[120px]" title={d.categoryName}>
                          <select
                            value={d.categoryId}
                            onChange={(e) => {
                              const newCatId = e.target.value;
                              setParsedData(prev => prev.map(item => item.id === d.id ? {
                                ...item,
                                categoryId: newCatId,
                                error: newCatId ? undefined : item.error,
                                isValid: item.ticker.length > 0 && !!newCatId && (item.event === 'TICKER_UPDATE' || item.quantity > 0 || item.event === 'AMORTIZACAO'),
                              } : item));
                            }}
                            className="w-full border rounded bg-transparent outline-none text-gray-800"
                          >
                            <option value="">Sel...</option>
                            {investmentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {d.isValid && !d.isDuplicate ? (
                            <CheckCircle2 className="text-emerald-500 mx-auto" size={16} />
                          ) : d.isDuplicate ? (
                            <div className="flex items-center justify-center gap-1 text-amber-500" title="Possível Duplicata">
                              <AlertCircle size={14} />
                              <span className="text-[10px] font-bold">Duplicado</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-rose-500" title={d.error}>
                              <AlertCircle size={14} />
                              <span className="text-[10px] font-bold">Erro</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  {parsedData.filter(d => d.isValid && !d.isDuplicate).length} operações serão importadas.
                  {parsedData.some(d => d.isDuplicate) && (
                    <span className="text-amber-600 font-bold">
                      {' '}{parsedData.filter(d => d.isDuplicate).length} duplicada(s) serão ignoradas.
                    </span>
                  )}
                </span>
                <div className="flex gap-3">
                  <button onClick={() => setStep('input')} className="px-6 py-2 text-gray-500 font-bold hover:bg-emerald-700 rounded-xl transition-colors">Voltar</button>
                  <button onClick={handleFinalImport} className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-lg flex items-center gap-2">
                    Confirmar Importação <Save size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={48} className="text-blue-600 animate-spin mb-6" />
              <h3 className="text-xl font-bold text-gray-900">Processando lote...</h3>
              <p className="text-gray-500 text-sm mt-2 font-medium">As operações estão sendo gravadas no histórico.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
