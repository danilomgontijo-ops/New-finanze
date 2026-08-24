
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Category, SubCategory, CreditCard, ImportedTransaction, Transaction, TransactionType, PaymentMethod, DescriptionMap } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { Upload, FileText, Check, AlertCircle, X, Loader2, Calendar, CreditCard as CreditCardIcon, ArrowRight, Type, Wallet, Banknote, AlertTriangle, Landmark, Repeat, CheckCircle2, ChevronDown, ChevronUp, Info, Layers, Edit3 } from 'lucide-react';

interface InvoiceImporterProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  transactions: Transaction[]; 
  onImport: (transactions: ImportedTransaction[], cardId?: string, paymentMethod?: PaymentMethod) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const MONTH_MAP: Record<string, number> = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
};

export const InvoiceImporter: React.FC<InvoiceImporterProps> = ({
  isOpen, onClose, categories, subCategories, creditCards, transactions, onImport
}) => {
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'summary'>('upload');
  const [importMode, setImportMode] = useState<'file' | 'text' | 'ofx'>('file');
  const [textInput, setTextInput] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedTransaction[]>([]);
  
  const [targetCardId, setTargetCardId] = useState<string>('');
  const [targetMethod, setTargetMethod] = useState<PaymentMethod>(PaymentMethod.DEBIT_CASH);

  const [error, setError] = useState<string | null>(null);
  const [descriptionMappings, setDescriptionMappings] = useState<DescriptionMap>({});
  
  // Batch Edit States
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchSubCategoryId, setBatchSubCategoryId] = useState('');
  
  const [importStats, setImportStats] = useState<{ importedCount: number; skippedItems: ImportedTransaction[] }>({
    importedCount: 0,
    skippedItems: []
  });
  const [showPreSkipped, setShowPreSkipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const preFinalizationInfo = useMemo(() => {
    const ready = importedData.filter(t => t.selected && t.categoryId);
    const skipped = importedData.filter(t => !t.selected || !t.categoryId);
    return { ready, skipped };
  }, [importedData]);

  useEffect(() => {
      if (isOpen) {
          StorageService.getMappings().then(map => {
              setDescriptionMappings(map);
          });
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      if (file.name.toLowerCase().endsWith('.ofx')) {
          setImportMode('ofx');
          setTargetMethod(PaymentMethod.DEBIT_CASH);
      } else {
          setImportMode('file');
          setTargetMethod(PaymentMethod.CREDIT_CARD);
      }
    }
  };

  const applyAutoFillAndCheckDuplicates = (data: ImportedTransaction[]) => {
      return data.map(item => {
          let updatedItem = { ...item };
          const isDuplicate = transactions.some(t => {
              const tDate = t.date.split('T')[0];
              const isDateMatch = tDate === item.date;
              const isAmountMatch = Math.abs(t.amount - item.amount) < 0.05;
              return isDateMatch && isAmountMatch;
          });

          if (isDuplicate) {
              updatedItem.isDuplicate = true;
              updatedItem.selected = false;
          }

          const original = (updatedItem.originalDescription || updatedItem.description).trim();
          let mapping: typeof descriptionMappings[string] | undefined = undefined;

          // Helper to check if category is Nathy
          const isNathy = (catId?: string) => {
              if (!catId) return false;
              const cat = categories.find(c => c.id === catId);
              return cat ? cat.name.toLowerCase().includes('nathy') : false;
          };

          // 1. Direct exact key match
          if (descriptionMappings[original]) {
              mapping = descriptionMappings[original];
          }

          // 2. Case-insensitive exact matches (prioritizing non-nathy category)
          if (!mapping) {
              const lowerOriginal = original.toLowerCase();
              const exactCandidates = Object.keys(descriptionMappings).filter(k => k.trim().toLowerCase() === lowerOriginal);
              if (exactCandidates.length > 0) {
                  const nonNathyKey = exactCandidates.find(k => !isNathy(descriptionMappings[k]?.categoryId));
                  mapping = descriptionMappings[nonNathyKey || exactCandidates[0]];
              }
          }

          // 3. Substring match (longest key first, strongly prioritizing non-nathy category)
          if (!mapping) {
              const lowerOriginal = original.toLowerCase();
              const foundKeys = Object.keys(descriptionMappings)
                  .filter(k => {
                      const lowerKey = k.trim().toLowerCase();
                      return lowerKey.length >= 3 && lowerOriginal.includes(lowerKey);
                  })
                  .sort((a, b) => b.length - a.length); // Most specific (longest) first

              if (foundKeys.length > 0) {
                  const nonNathyKey = foundKeys.find(k => !isNathy(descriptionMappings[k]?.categoryId));
                  mapping = descriptionMappings[nonNathyKey || foundKeys[0]];
              }
          }
          
          if (mapping) {
              updatedItem = {
                  ...updatedItem,
                  description: mapping.targetDescription, 
                  categoryId: mapping.categoryId || updatedItem.categoryId,
                  subCategoryId: mapping.subCategoryId || updatedItem.subCategoryId
              };
          }
          return updatedItem;
      });
  };

  const parseOFX = (text: string): ImportedTransaction[] => {
      const transactions: ImportedTransaction[] = [];
      const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
      let match;
      while ((match = stmtTrnRegex.exec(text)) !== null) {
          const block = match[1];
          const amountMatch = block.match(/<TRNAMT>([\s\S]*?)(?:\r?\n|<)/);
          const dateMatch = block.match(/<DTPOSTED>([\s\S]*?)(?:\r?\n|<)/);
          const memoMatch = block.match(/<MEMO>([\s\S]*?)(?:\r?\n|<)/);
          const nameMatch = block.match(/<NAME>([\s\S]*?)(?:\r?\n|<)/);
          if (amountMatch && dateMatch) {
              const rawAmount = parseFloat(amountMatch[1].trim());
              const amount = Math.abs(rawAmount);
              const rawDate = dateMatch[1].trim();
              const y = rawDate.substring(0, 4);
              const m = rawDate.substring(4, 6);
              const d = rawDate.substring(6, 8);
              const dateStr = `${y}-${m}-${d}`;
              const description = (memoMatch ? memoMatch[1] : (nameMatch ? nameMatch[1] : 'Transação Banco')).trim();
              transactions.push({ id: `ofx-${Date.now()}-${Math.random()}`, date: dateStr, description, originalDescription: description, amount, categoryId: '', subCategoryId: '', installments: 1, selected: true });
          }
      }
      return transactions;
  };

  const parsePastedText = (text: string) => {
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const parsed: ImportedTransaction[] = [];
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Helper to find category/subcategory
      const findCategoryMatch = (text: string) => {
          if (!text) return null;
          const lowerText = text.toLowerCase();
          
          // 1. Try Subcategories (Longest first to avoid partial matches)
          const sortedSubs = [...subCategories].sort((a, b) => b.name.length - a.name.length);
          const foundSub = sortedSubs.find(s => lowerText.includes(s.name.toLowerCase()));
          if (foundSub) return { catId: foundSub.categoryId, subId: foundSub.id };

          // 2. Try Categories - EXCLUINDO "NATHY" da detecção automática
          const sortedCats = [...categories]
            .filter(c => c.name.toLowerCase() !== 'nathy' && !c.name.toLowerCase().includes('nathy')) // EXCLUDE NATHY
            .sort((a, b) => b.name.length - a.name.length);
            
          const foundCat = sortedCats.find(c => lowerText.includes(c.name.toLowerCase()));
          if (foundCat) return { catId: foundCat.id, subId: '' };

          return null;
      };

      lines.forEach((line, index) => {
          let cleanLine = line.replace(/\s+/g, ' ').trim();
          let dateStr = '';
          let dateObj: Date | null = null;
          let description = '';
          let categoryHint = '';
          let amount = 0;
          let foundDate = false;
          let foundAmount = false;
          let installments = 1;
          let installmentIndex = 1;

          // 1. Detectar Padrão de Data (DD/MM/YYYY ou DD/MM)
          const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/;
          const dateMatch = cleanLine.match(dateRegex);
          
          // 1.5 Detectar Data por extenso abreviada (17 jan. ou 17 jan)
          const textDateRegex = /\b(\d{1,2})\s+([a-zA-ZçÇ]{3,})\.?\b/;
          const textDateMatch = cleanLine.match(textDateRegex);

          if (dateMatch) {
              const d = parseInt(dateMatch[1]);
              const m = parseInt(dateMatch[2]);
              let y = dateMatch[3] ? parseInt(dateMatch[3]) : currentYear;
              if (dateMatch[3] && dateMatch[3].length === 2) y += 2000;
              if (!dateMatch[3] && m - 1 > currentMonth + 1) y = currentYear - 1;
              dateObj = new Date(y, m - 1, d, 12, 0, 0);
              foundDate = true;
              cleanLine = cleanLine.replace(dateMatch[0], '').trim();
          } else if (textDateMatch) {
              const d = parseInt(textDateMatch[1]);
              const monthStr = textDateMatch[2].toLowerCase();
              if (MONTH_MAP.hasOwnProperty(monthStr)) {
                  const mIndex = MONTH_MAP[monthStr];
                  let y = currentYear;
                  // Se o mês detectado for muito à frente do atual (ex: Lendo Dez em Jan), assume ano anterior
                  if (mIndex > currentMonth + 1) y = currentYear - 1;
                  
                  dateObj = new Date(y, mIndex, d, 12, 0, 0);
                  foundDate = true;
                  cleanLine = cleanLine.replace(textDateMatch[0], '').trim();
              }
          }

          // 2. Detectar Parcelamento (XX/YY) - CRÍTICO
          const installmentRegex = /\b(\d{1,2})\/(\d{1,2})\b/;
          const instMatch = cleanLine.match(installmentRegex);
          if (instMatch) {
              installmentIndex = parseInt(instMatch[1]);
              installments = parseInt(instMatch[2]);
              cleanLine = cleanLine.replace(instMatch[0], '').trim();
          }

          // 3. Detectar Valor Financeiro (R$ 0,00 ou 0.00)
          // Priorizamos valores que venham DEPOIS da indicação de parcelas
          const moneyRegex = /(?:R\$|RS|\$)?\s*(-?[\d\.]+,\d{2}|-?[\d,]+\.\d{2}|-?\d+,\d{2})\b/i;
          const moneyMatch = moneyRegex.exec(cleanLine); // Exec to get index
          
          if (moneyMatch) {
              let rawAmount = moneyMatch[1];
              if (rawAmount.includes(',') && rawAmount.includes('.')) rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
              else if (rawAmount.includes(',')) rawAmount = rawAmount.replace(',', '.');
              amount = Math.abs(parseFloat(rawAmount));
              foundAmount = true;
              
              // DIVIDE LINE: Description (Left) | Category Hint (Right)
              const amountIndex = moneyMatch.index;
              const amountStrLength = moneyMatch[0].length;

              const leftSide = cleanLine.substring(0, amountIndex).trim();
              const rightSide = cleanLine.substring(amountIndex + amountStrLength).trim();

              // Clean leading/trailing separators (-, |)
              description = leftSide.replace(/^[-\s|/]+/, '').replace(/[-\s|/]+$/, '').trim();
              categoryHint = rightSide.replace(/^[-\s|/]+/, '').replace(/[-\s|/]+$/, '').trim();
          }

          if (dateObj && foundAmount && amount > 0) {
             let detectedCategoryId = '';
             let detectedSubCategoryId = '';
             
             // --- INSTALLMENT DATE SHIFT LOGIC ---
             // Se for uma parcela (ex: 02/05), a data no texto geralmente é a data da COMPRA original.
             // Precisamos projetar a data para o mês correto da parcela atual.
             // Ex: Compra 10/08 (Ago). Parcela 05/05. Data correta da parcela = Ago + 4 meses = Dez.
             if (installmentIndex > 1) {
                 dateObj.setMonth(dateObj.getMonth() + (installmentIndex - 1));
             }
             dateStr = dateObj.toISOString().split('T')[0];

             // --- CATEGORIZATION LOGIC ---
             
             // 1. Try to match the text AFTER the price (Explicit Category Hint)
             if (categoryHint) {
                 const match = findCategoryMatch(categoryHint);
                 if (match) {
                     detectedCategoryId = match.catId;
                     detectedSubCategoryId = match.subId;
                 } else {
                     // If hint exists but doesn't match a category, append it to description 
                     // to prevent data loss (it might be a note).
                     description = `${description} ${categoryHint}`;
                 }
             }

             // 2. If no category found via hint, fall back to searching the Description
             if (!detectedCategoryId && description) {
                 const match = findCategoryMatch(description);
                 if (match) {
                     detectedCategoryId = match.catId;
                     detectedSubCategoryId = match.subId;
                 }
             }

             // Handle empty description
             if (!description) description = 'Sem descrição';
             
             parsed.push({
                 id: `text-import-${index}-${Date.now()}`,
                 date: dateStr,
                 description: description,
                 originalDescription: description, // Keep original-ish
                 amount: amount,
                 categoryId: detectedCategoryId,
                 subCategoryId: detectedSubCategoryId,
                 installments: installments,
                 installmentIndex: installmentIndex,
                 tags: [],
                 selected: true
             });
          }
      });
      return parsed;
  };

  const handleProcessMode = async () => {
    if (importMode === 'text') handleProcessText();
    else if (importMode === 'ofx') handleProcessOFX();
    else handleProcessFile();
  };

  const handleProcessOFX = () => {
    if (!selectedFile) return;
    setStep('processing');
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        const results = parseOFX(text);
        if (results.length === 0) { setError("Nenhuma transação encontrada."); setStep('upload'); }
        else { setImportedData(applyAutoFillAndCheckDuplicates(results)); setStep('review'); }
    };
    reader.readAsText(selectedFile);
  };

  const handleProcessText = () => {
      if (!textInput.trim()) return;
      setStep('processing');
      setTimeout(() => {
          const results = parsePastedText(textInput);
          if (results.length === 0) { setError("Não foi possível identificar transações no formato esperado."); setStep('upload'); }
          else { setImportedData(applyAutoFillAndCheckDuplicates(results)); setStep('review'); }
      }, 600);
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;
    setStep('processing');
    try {
      const base64 = await fileToBase64(selectedFile);
      const rawData = await GeminiService.parseInvoice(base64, selectedFile.type);
      
      const findCategoryMatch = (text: string) => {
          if (!text) return null;
          const lowerText = text.toLowerCase();
          
          const sortedSubs = [...subCategories].sort((a, b) => b.name.length - a.name.length);
          const foundSub = sortedSubs.find(s => lowerText.includes(s.name.toLowerCase()));
          if (foundSub) return { catId: foundSub.categoryId, subId: foundSub.id };

          const sortedCats = [...categories]
            .filter(c => c.name.toLowerCase() !== 'nathy' && !c.name.toLowerCase().includes('nathy'))
            .sort((a, b) => b.name.length - a.name.length);
            
          const foundCat = sortedCats.find(c => lowerText.includes(c.name.toLowerCase()));
          if (foundCat) return { catId: foundCat.id, subId: '' };

          return null;
      };

      const mapped: ImportedTransaction[] = rawData.map((item: any, index: number) => {
        const match = findCategoryMatch(item.description);
        return {
          id: `import-${index}-${Date.now()}`,
          date: item.date,
          description: item.description,
          originalDescription: item.description,
          amount: item.amount,
          categoryId: match ? match.catId : '',
          subCategoryId: match ? match.subId : '',
          installments: 1,
          tags: [],
          selected: true
        };
      });
      setImportedData(applyAutoFillAndCheckDuplicates(mapped));
      setStep('review');
    } catch (err) { setError("Falha ao processar arquivo."); setStep('upload'); }
  };

  const updateItem = (id: string, field: keyof ImportedTransaction, value: any) => {
    setImportedData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleApplyBatchCategory = () => {
      if (!batchCategoryId) return;
      
      const count = importedData.filter(i => i.selected).length;
      if (count === 0) return;

      setImportedData(prev => prev.map(item => {
          if (item.selected) {
              return { 
                  ...item, 
                  categoryId: batchCategoryId, 
                  subCategoryId: batchSubCategoryId 
              };
          }
          return item;
      }));
      
      // Optional: Reset selections or keep them
      // setBatchCategoryId(''); 
      // setBatchSubCategoryId('');
  };

  const handleFinalize = async () => {
    if (targetMethod === PaymentMethod.CREDIT_CARD && !targetCardId) { setError("Selecione um cartão de crédito."); return; }
    const { ready, skipped } = preFinalizationInfo;
    if (ready.length === 0) { setError("Nenhum lançamento válido para importar."); return; }
    
    setIsSaving(true);
    const newMappings: DescriptionMap = {};
    ready.forEach(t => { if (t.originalDescription) newMappings[t.originalDescription.trim()] = { targetDescription: t.description, categoryId: t.categoryId, subCategoryId: t.subCategoryId }; });
    if (Object.keys(newMappings).length > 0) await StorageService.saveMappings(newMappings);
    
    // Pequeno delay para feedback visual
    setTimeout(() => {
        onImport(ready, targetMethod === PaymentMethod.CREDIT_CARD ? targetCardId : undefined, targetMethod);
        setImportStats({ importedCount: ready.length, skippedItems: skipped });
        setStep('summary');
        setIsSaving(false);
    }, 500);
  };

  const resetImporter = () => {
    setStep('upload');
    setImportMode('file');
    setTextInput('');
    setSelectedFile(null);
    setImportedData([]);
    setImportStats({ importedCount: 0, skippedItems: [] });
    setError(null);
    setIsSaving(false);
    onClose();
  };

  const expenseCategories = categories.filter(c => c.type === TransactionType.EXPENSE);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Landmark className="text-gray-700" /> Sincronizar Banco / Fatura</h2>
          <button onClick={resetImporter} className="p-2 text-gray-500 hover:bg-emerald-700 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="h-full flex flex-col">
                <div className="flex bg-gray-100 p-1 rounded-xl mb-6 self-center">
                    <button onClick={() => setImportMode('file')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${importMode === 'file' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-500'}`}><Upload size={16} /> Fatura (PDF/Img)</button>
                    <button onClick={() => setImportMode('ofx')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${importMode === 'ofx' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-500'}`}><Landmark size={16} /> Arquivo Banco (OFX)</button>
                    <button onClick={() => setImportMode('text')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${importMode === 'text' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-500'}`}><Type size={16} /> Colar Texto</button>
                </div>
                {importMode !== 'text' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                        <div className="w-full max-w-lg border-2 border-dashed border-gray-300 rounded-2xl p-10 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-16 h-16 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">{importMode === 'ofx' ? <Landmark size={32} /> : <Upload size={32} />}</div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{importMode === 'ofx' ? 'Selecione o arquivo .OFX do Itaú' : 'Selecione o PDF da Fatura'}</h3>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={importMode === 'ofx' ? '.ofx' : 'application/pdf,image/*'} className="hidden" />
                            {selectedFile && <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-gray-800 font-medium inline-flex items-center gap-2"><Check size={16} /> {selectedFile.name}</div>}
                        </div>
                        <button onClick={handleProcessMode} disabled={!selectedFile} className="mt-8 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg">{importMode === 'ofx' ? 'Importar Extrato' : 'Analisar com IA'}</button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center flex-1 w-full max-w-2xl mx-auto">
                        <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} className="w-full flex-1 bg-white border border-gray-300 rounded-xl p-4 text-sm font-mono text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none resize-none" placeholder="Cole aqui (ex: 10/08/2023 Htm*adrianasanta 06/06 R$ 183,39)"></textarea>
                        <button onClick={handleProcessText} disabled={!textInput.trim()} className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg">Processar Texto</button>
                    </div>
                )}
                {error && <div className="mt-6 bg-rose-50 text-rose-600 px-4 py-3 rounded-lg flex items-center gap-2 text-sm mx-auto"><AlertCircle size={16} /> {error}</div>}
            </div>
          )}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 size={48} className="text-gray-700 animate-spin mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Processando...</h3>
            </div>
          )}
          {step === 'review' && (
            <div className="space-y-6 flex flex-col h-full">
              <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shrink-0">
                <div className="w-full md:w-auto space-y-3">
                    <div className="flex bg-white rounded-lg p-1 border border-gray-200 w-fit">
                        <button onClick={() => setTargetMethod(PaymentMethod.CREDIT_CARD)} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${targetMethod === PaymentMethod.CREDIT_CARD ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}><CreditCardIcon size={16} /> Cartão</button>
                        <button onClick={() => setTargetMethod(PaymentMethod.DEBIT_CASH)} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${targetMethod === PaymentMethod.DEBIT_CASH ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}><Banknote size={16} /> Débito</button>
                    </div>
                    {targetMethod === PaymentMethod.CREDIT_CARD && (
                        <select value={targetCardId} onChange={(e) => setTargetCardId(e.target.value)} className="pl-4 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold outline-none w-64 text-gray-900">
                            <option value="">Selecione o cartão...</option>
                            {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
                <div className="text-right flex items-center gap-6">
                    <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Prontos</p><p className="text-xl font-bold text-gray-900">{preFinalizationInfo.ready.length}</p></div>
                    <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Total</p><p className="text-xl font-bold text-gray-800">R$ {(preFinalizationInfo.ready.reduce((acc, curr) => acc + curr.amount, 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                </div>
              </div>

              {/* BATCH ACTION BAR */}
              <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex flex-wrap gap-3 items-center animate-in slide-in-from-top-2">
                  <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Layers size={14}/> Edição em Lote:</span>
                  <div className="flex-1 flex gap-2 min-w-[200px]">
                      <select 
                          value={batchCategoryId} 
                          onChange={(e) => { setBatchCategoryId(e.target.value); setBatchSubCategoryId(''); }} 
                          className="flex-1 text-xs rounded border border-gray-300 py-1.5 px-2 bg-white focus:ring-1 focus:ring-gray-500 outline-none"
                      >
                          <option value="">Selecione Categoria...</option>
                          {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select 
                          value={batchSubCategoryId} 
                          onChange={(e) => setBatchSubCategoryId(e.target.value)} 
                          className="flex-1 text-xs rounded border border-gray-300 py-1.5 px-2 bg-white focus:ring-1 focus:ring-gray-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                          disabled={!batchCategoryId}
                      >
                          <option value="">Selecione Subcategoria...</option>
                          {subCategories.filter(s => s.categoryId === batchCategoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                  </div>
                  <button 
                      onClick={handleApplyBatchCategory}
                      disabled={!batchCategoryId}
                      className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                      Aplicar aos Selecionados
                  </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 min-h-[300px]">
                <div className="overflow-x-auto h-full">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-10"><input type="checkbox" checked={importedData.length > 0 && importedData.every(i => i.selected)} onChange={(e) => setImportedData(prev => prev.map(i => ({ ...i, selected: e.target.checked })))} className="rounded text-gray-700" /></th>
                        <th className="px-4 py-3 w-32">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3 w-28 text-right">Valor</th>
                        <th className="px-4 py-3 w-32">Categoria</th>
                        <th className="px-4 py-3 w-32">Subcat.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {importedData.map(item => {
                        const isMissingCategory = !item.categoryId;
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.selected ? 'opacity-40 grayscale' : ''} ${item.isDuplicate ? 'bg-amber-50' : ''}`}>
                            <td className="px-4 py-3"><input type="checkbox" checked={item.selected} onChange={(e) => updateItem(item.id, 'selected', e.target.checked)} className="rounded text-gray-700" /></td>
                            <td className="px-4 py-3">
                                <input 
                                    type="date" 
                                    value={item.date} 
                                    onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent focus:border-gray-500 outline-none text-xs font-bold text-gray-700"
                                />
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-gray-500 outline-none font-medium text-gray-900" />
                                  {item.installments > 1 && (<span className="text-[10px] text-gray-500 font-bold flex items-center gap-1 mt-0.5"><Repeat size={10} /> Parcela {item.installmentIndex}/{item.installments}</span>)}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end">
                                    <span className="text-xs text-gray-500 mr-1">R$</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={item.amount} 
                                        onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value))}
                                        className="w-24 bg-transparent border-b border-transparent focus:border-gray-500 outline-none font-bold text-gray-900 text-right"
                                    />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                              <select value={item.categoryId} onChange={(e) => { updateItem(item.id, 'categoryId', e.target.value); updateItem(item.id, 'subCategoryId', ''); }} className={`w-full text-xs rounded border py-1 bg-white focus:ring-2 focus:ring-gray-500 outline-none transition-colors ${isMissingCategory && item.selected ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-800'}`}>
                                  <option value="">- Selecione -</option>
                                  {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select value={item.subCategoryId} onChange={(e) => updateItem(item.id, 'subCategoryId', e.target.value)} className="w-full text-xs rounded border py-1 bg-white text-gray-800 focus:ring-2 focus:ring-gray-500 outline-none border-gray-200 disabled:bg-gray-50 disabled:text-gray-500" disabled={!item.categoryId}>
                                  <option value="">-</option>
                                  {subCategories.filter(s => s.categoryId === item.categoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shrink-0 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div><span className="font-bold text-gray-800">{preFinalizationInfo.ready.length} prontos</span></div>
                      {preFinalizationInfo.skipped.length > 0 && (<div className="flex items-center gap-2 text-sm"><div className="w-2 h-2 bg-amber-400 rounded-full"></div><span className="font-bold text-gray-500">{preFinalizationInfo.skipped.length} ignorados</span></div>)}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('upload')} disabled={isSaving} className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50">Voltar</button>
                    <button onClick={handleFinalize} disabled={preFinalizationInfo.ready.length === 0 || isSaving} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <><span className="hidden sm:inline">Confirmar e</span> Finalizar <ArrowRight size={20} /></>}
                    </button>
                  </div>
              </div>
            </div>
          )}

          {step === 'summary' && (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={48} /></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Importação Finalizada!</h3>
                <div className="grid grid-cols-2 gap-4 w-full max-w-2xl my-8">
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center"><span className="text-[10px] font-bold uppercase text-emerald-600 mb-2">Importados</span><span className="text-4xl font-bold text-emerald-700 block">{importStats.importedCount}</span></div>
                    <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl text-center"><span className="text-[10px] font-bold uppercase text-gray-500 mb-2">Ignorados</span><span className="text-4xl font-bold text-gray-800 block">{importStats.skippedItems.length}</span></div>
                </div>
                <button onClick={resetImporter} className="bg-emerald-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 shadow-xl transition-all">Concluir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
