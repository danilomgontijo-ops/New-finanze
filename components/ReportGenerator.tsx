import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, TransactionType, PaymentMethod, CreditCard, UserSettings, SubCategory } from '../types';
import { X, Printer, Calendar, Filter, FileText, PieChart, ArrowRight, Check, Hash, Square, CheckSquare, Tag, CreditCard as CreditCardIcon, Banknote, Repeat, Users, Layers, TrendingDown, AlertCircle } from 'lucide-react';

interface ReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards?: CreditCard[];
  settings?: UserSettings;
}

// Logic duplicated from Dashboard to ensure consistency
function calculateEffectiveDate(t: Transaction, creditCards: CreditCard[], settings?: UserSettings): Date {
    if (t.manualAccountingDate) return new Date(t.manualAccountingDate);
    const date = new Date(t.date);
    const dayOfMonth = t.originalDay || date.getUTCDate();
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const comparisonDate = new Date(year, month, 1, 12, 0, 0);
    
    if (t.type === TransactionType.INVESTMENT) {
        return comparisonDate;
    }
    
    if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId) {
        const card = creditCards.find(c => c.id === t.creditCardId);
        if (card && dayOfMonth > card.closingDay) comparisonDate.setMonth(comparisonDate.getMonth() + 1);
    } else {
        const salaryDay = settings?.salaryDay || 1;
        const shift = settings?.salaryShift ?? (salaryDay >= 20 ? 1 : 0);
        const lastDayOfMonth = new Date(comparisonDate.getFullYear(), comparisonDate.getMonth() + 1, 0).getDate();
        const effectiveSalaryDay = Math.min(salaryDay, lastDayOfMonth);

        if (dayOfMonth >= effectiveSalaryDay) {
            comparisonDate.setMonth(comparisonDate.getMonth() + shift);
        } else {
            comparisonDate.setMonth(comparisonDate.getMonth() + shift - 1);
        }
    }
    return comparisonDate;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  isOpen, onClose, transactions, categories, subCategories, creditCards = [], settings
}) => {
  const [step, setStep] = useState<'config' | 'preview'>('config');
  const [dateMode, setDateMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'ALL' | PaymentMethod>('ALL');
  const [selectedCardId, setSelectedCardId] = useState<string>('ALL');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOnlyShared, setFilterOnlyShared] = useState(false);
  const [filterOnlyInstallments, setFilterOnlyInstallments] = useState(false);
  const [showPrintHint, setShowPrintHint] = useState(false);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    transactions.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [transactions]);

  const availableSubCategories = useMemo(() => {
      return subCategories.filter(s => selectedCategoryIds.includes(s.categoryId));
  }, [subCategories, selectedCategoryIds]);

  useEffect(() => {
    if (isOpen) {
        setSelectedCategoryIds(categories.map(c => c.id));
        setSelectedSubCategoryIds(subCategories.map(s => s.id));
        setSelectedTags([]); 
        setSelectedPaymentMethod('ALL');
        setSelectedCardId('ALL');
        setDateMode('month');
        setFilterOnlyShared(false);
        setFilterOnlyInstallments(false);
        setStep('config');
        setShowPrintHint(false);
    }
  }, [isOpen, categories, subCategories]);

  useEffect(() => {
      setSelectedSubCategoryIds(subCategories.filter(s => selectedCategoryIds.includes(s.categoryId)).map(s => s.id));
  }, [selectedCategoryIds, subCategories]);

  const reportData = useMemo(() => {
    if (!isOpen || step === 'config') return null;
    let targetMonthIndex = -1; let targetYear = -1;
    let customStart = new Date(0); let customEnd = new Date(0);
    if (dateMode === 'month' && selectedMonth) {
        const [y, m] = selectedMonth.split('-').map(Number);
        targetYear = y; targetMonthIndex = m - 1;
    } else {
        customStart = new Date(startDate + 'T00:00:00');
        customEnd = new Date(endDate + 'T23:59:59');
    }

    const filtered = transactions.filter(t => {
      if (dateMode === 'month') {
          const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
          if (effectiveDate.getFullYear() !== targetYear || effectiveDate.getMonth() !== targetMonthIndex) return false;
      } else {
          const tDate = new Date(t.date);
          if (tDate < customStart || tDate > customEnd) return false;
      }
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;
      if (selectedPaymentMethod !== 'ALL') {
          if (t.type === TransactionType.EXPENSE || t.type === TransactionType.INVESTMENT) {
             if (t.paymentMethod !== selectedPaymentMethod) return false;
             if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD && selectedCardId !== 'ALL') {
                 if (t.creditCardId !== selectedCardId) return false;
             }
          } else if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD) return false;
      }
      if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(t.categoryId)) return false;
      if (t.subCategoryId && selectedSubCategoryIds.length > 0 && !selectedSubCategoryIds.includes(t.subCategoryId)) return false;
      if (selectedTags.length > 0) {
          const hasMatch = (t.tags || []).some(tag => selectedTags.includes(tag));
          if (!hasMatch) return false;
      }
      if (filterOnlyShared && !t.isShared) return false;
      if (filterOnlyInstallments && (!t.totalInstallments || t.totalInstallments <= 1)) return false;
      return true;
    });

    const totalIncome = filtered.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === TransactionType.EXPENSE && !t.fundedByResgate).reduce((acc, t) => acc + t.amount, 0);
    const totalInvested = filtered.filter(t => t.type === TransactionType.INVESTMENT).reduce((acc, t) => acc + t.amount, 0);

    const categorySummary: Record<string, { name: string, value: number, color: string, type: TransactionType }> = {};
    const subCategorySummary: Record<string, { name: string, value: number, parentName: string }> = {};
    const expenseGroups: Record<string, { description: string, value: number, count: number }> = {};

    filtered.forEach(t => {
        if (t.type === TransactionType.EXPENSE && t.fundedByResgate) return;
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat?.name || 'Outros';
        const color = cat?.color || '#94a3b8';
        if (!categorySummary[name]) categorySummary[name] = { name, value: 0, color, type: t.type };
        categorySummary[name].value += t.amount;
        if (t.type === TransactionType.EXPENSE || t.type === TransactionType.INVESTMENT) {
            if (t.subCategoryId) {
                const sub = subCategories.find(s => s.id === t.subCategoryId);
                const subName = sub?.name || 'Desconhecido';
                const key = `${name} > ${subName}`;
                if (!subCategorySummary[key]) subCategorySummary[key] = { name: subName, value: 0, parentName: name };
                subCategorySummary[key].value += t.amount;
            }
            const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
            if (!expenseGroups[cleanDesc]) expenseGroups[cleanDesc] = { description: cleanDesc, value: 0, count: 0 };
            expenseGroups[cleanDesc].value += t.amount;
            expenseGroups[cleanDesc].count += 1;
        }
    });

    return {
        transactions: filtered, 
        totalIncome, 
        totalExpense, 
        totalInvested,
        balance: totalIncome - totalExpense - totalInvested,
        categorySummary: Object.values(categorySummary).sort((a, b) => b.value - a.value),
        subCategorySummary: Object.values(subCategorySummary).sort((a, b) => b.value - a.value),
        topExpenses: Object.values(expenseGroups).sort((a, b) => b.value - a.value).slice(0, 5)
    };
  }, [step, transactions, categories, subCategories, creditCards, settings, dateMode, selectedMonth, startDate, endDate, selectedType, selectedPaymentMethod, selectedCardId, selectedCategoryIds, selectedSubCategoryIds, selectedTags, isOpen, filterOnlyShared, filterOnlyInstallments]);

  if (!isOpen) return null;

  const handlePrintAction = () => {
    setShowPrintHint(true);
    try {
        window.print();
    } catch (e) {
        console.warn("Print blocked by browser environment");
    }
  };

  const handleGenerate = () => { setStep('preview'); setShowPrintHint(false); };
  const handleClose = () => { setStep('config'); onClose(); };
  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
      if (list.includes(item)) setList(list.filter(i => i !== item));
      else setList([...list, item]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white dark:bg-zinc-900 print:static">
      {step === 'config' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center bg-gray-50 dark:bg-zinc-800\/50 shrink-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50 flex items-center gap-2"><FileText className="text-gray-700 dark:text-zinc-300" /> Configurar Relatório</h2>
                <button onClick={handleClose} className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-emerald-700 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2"><Calendar size={16} className="text-gray-500 dark:text-zinc-400" /> Período</label>
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg mb-2">
                            <button onClick={() => setDateMode('month')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${dateMode === 'month' ? 'bg-white dark:bg-zinc-900 shadow text-gray-700 dark:text-zinc-300' : 'text-gray-500 dark:text-zinc-400'}`}>Mês</button>
                            <button onClick={() => setDateMode('custom')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${dateMode === 'custom' ? 'bg-white dark:bg-zinc-900 shadow text-gray-700 dark:text-zinc-300' : 'text-gray-500 dark:text-zinc-400'}`}>Livre</button>
                        </div>
                        {dateMode === 'month' ? (
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none" />
                        ) : (
                            <div className="flex gap-2"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs" /></div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2"><Filter size={16} className="text-gray-500 dark:text-zinc-400" /> Tipo</label>
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                            <button onClick={() => setSelectedType('ALL')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedType === 'ALL' ? 'bg-white dark:bg-zinc-900 shadow text-gray-900 dark:text-zinc-50' : 'text-gray-500 dark:text-zinc-400'}`}>Todas</button>
                            <button onClick={() => setSelectedType(TransactionType.EXPENSE)} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedType === TransactionType.EXPENSE ? 'bg-white dark:bg-zinc-900 shadow text-rose-600' : 'text-gray-500 dark:text-zinc-400'}`}>Despesas</button>
                            <button onClick={() => setSelectedType(TransactionType.INCOME)} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedType === TransactionType.INCOME ? 'bg-white dark:bg-zinc-900 shadow text-emerald-600' : 'text-gray-500 dark:text-zinc-400'}`}>Receitas</button>
                        </div>
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                             <button onClick={() => setSelectedType(TransactionType.INVESTMENT)} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedType === TransactionType.INVESTMENT ? 'bg-white dark:bg-zinc-900 shadow text-blue-600' : 'text-gray-500 dark:text-zinc-400'}`}>Investimentos</button>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setFilterOnlyInstallments(!filterOnlyInstallments)} className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border transition-all ${filterOnlyInstallments ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400'}`}>Parcelados</button>
                            <button onClick={() => setFilterOnlyShared(!filterOnlyShared)} className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border transition-all ${filterOnlyShared ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400'}`}>Divididos</button>
                        </div>
                    </div>
                </div>
                <div className="space-y-3 border-t border-gray-200 dark:border-zinc-700 pt-4">
                     <label className="text-sm font-bold text-gray-800 flex items-center gap-2"><CreditCardIcon size={16} className="text-gray-500 dark:text-zinc-400" /> Pagamento</label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                            <button onClick={() => { setSelectedPaymentMethod('ALL'); setSelectedCardId('ALL'); }} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedPaymentMethod === 'ALL' ? 'bg-white dark:bg-zinc-900 shadow text-gray-900 dark:text-zinc-50' : 'text-gray-500 dark:text-zinc-400'}`}>Tudo</button>
                            <button onClick={() => setSelectedPaymentMethod(PaymentMethod.CREDIT_CARD)} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedPaymentMethod === PaymentMethod.CREDIT_CARD ? 'bg-white dark:bg-zinc-900 shadow text-gray-700 dark:text-zinc-300' : 'text-gray-500 dark:text-zinc-400'}`}>Crédito</button>
                            <button onClick={() => { setSelectedPaymentMethod(PaymentMethod.DEBIT_CASH); setSelectedCardId('ALL'); }} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${selectedPaymentMethod === PaymentMethod.DEBIT_CASH ? 'bg-white dark:bg-zinc-900 shadow text-gray-700 dark:text-zinc-300' : 'text-gray-500 dark:text-zinc-400'}`}>Débito/Din</button>
                        </div>
                        {selectedPaymentMethod === PaymentMethod.CREDIT_CARD && (
                            <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-800 bg-white dark:bg-zinc-900 font-medium"><option value="ALL">Todos os Cartões</option>{creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        )}
                    </div>
                </div>
                <div className="space-y-3 border-t border-gray-200 dark:border-zinc-700 pt-4">
                    <div className="flex justify-between items-end"><label className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieChart size={16} className="text-gray-500 dark:text-zinc-400" /> Categorias</label></div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50 dark:bg-zinc-800\/50 p-3 rounded-xl border border-gray-200 dark:border-zinc-700 max-h-40 overflow-y-auto custom-scrollbar">
                        {categories.filter(c => selectedType === 'ALL' || c.type === selectedType).map(c => (
                            <button key={c.id} onClick={() => toggleItem(selectedCategoryIds, setSelectedCategoryIds, c.id)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all text-left ${selectedCategoryIds.includes(c.id) ? 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-50 shadow-sm' : 'border-transparent text-gray-500 dark:text-zinc-400'}`}>
                                {selectedCategoryIds.includes(c.id) ? <CheckSquare size={14} className="text-gray-700 dark:text-zinc-300" /> : <Square size={14} className="text-gray-700 dark:text-zinc-300" />}
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></div><span className="truncate">{c.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800\/50 flex justify-end gap-3 shrink-0">
                <button onClick={handleClose} className="px-4 py-2 text-gray-700 dark:text-zinc-300 font-medium hover:bg-emerald-700 rounded-lg text-sm">Cancelar</button>
                <button onClick={handleGenerate} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-colors text-sm">Gerar Relatório <ArrowRight size={16} /></button>
            </div>
        </div>
      )}
      {step === 'preview' && reportData && (
        <div className="bg-white dark:bg-zinc-900 w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 print:shadow-none print:h-auto print:max-w-none print:rounded-none">
            <div className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 px-6 py-3 flex justify-between items-center print:hidden shrink-0">
                <h2 className="font-bold flex items-center gap-2 text-sm md:text-base"><FileText size={18} /> Visualização do Relatório</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={() => setStep('config')} className="text-xs md:text-sm text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:text-zinc-50">Filtros</button>
                    <button onClick={handleClose} className="text-xs md:text-sm text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:text-zinc-50">Fechar</button>
                    <button onClick={handlePrintAction} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs md:text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-95 shadow-lg"><Printer size={16} /> Imprimir</button>
                </div>
            </div>

            {/* Print Instruction for Sandboxed environment */}
            <div className="bg-gray-50 dark:bg-zinc-800\/50 border-b border-gray-200 dark:border-zinc-700 px-6 py-2 flex items-center justify-center gap-2 print:hidden shrink-0">
                <AlertCircle size={14} className="text-gray-700 dark:text-zinc-300" />
                <span className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">Atenção: Use <strong>Ctrl + P</strong> (ou Cmd + P) caso o botão imprimir seja ignorado pelo navegador.</span>
            </div>

            {showPrintHint && (
                <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 print:hidden">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">Impressão Manual Necessária</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                            Este ambiente bloqueia a abertura automática do diálogo de impressão. 
                            <strong> Utilize o atalho Ctrl + P</strong> no Windows ou <strong>Cmd + P</strong> no Mac para concluir a impressão.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-12 print:p-0 print:overflow-visible custom-scrollbar">
                <div className="flex justify-between items-start mb-8 border-b-2 border-gray-200 dark:border-zinc-700 pb-6">
                    <div><h1 className="text-3xl font-extrabold text-gray-900 dark:text-zinc-50 mb-2 uppercase">Relatório Financeiro</h1><p className="text-sm font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">FinanZe Personal Finance</p></div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-zinc-50">PERÍODO</div>
                        <div className="text-xl font-light text-gray-700 dark:text-zinc-300 capitalize">{dateMode === 'month' ? (() => { const d = new Date(selectedMonth + '-02'); return isNaN(d.getTime()) ? selectedMonth : d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); })() : (() => { const d1 = new Date(startDate + 'T12:00:00'); const d2 = new Date(endDate + 'T12:00:00'); const str1 = isNaN(d1.getTime()) ? startDate : d1.toLocaleDateString('pt-BR'); const str2 = isNaN(d2.getTime()) ? endDate : d2.toLocaleDateString('pt-BR'); return `${str1} - ${str2}`; })()}</div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-8 mb-10 break-inside-avoid">
                    <div className="border-l-4 border-emerald-500 pl-4 py-1"><span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase block">Receita</span><span className="text-2xl font-bold text-gray-900 dark:text-zinc-50">R$ {(reportData.totalIncome || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    <div className="border-l-4 border-rose-500 pl-4 py-1"><span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase block">Despesa</span><span className="text-2xl font-bold text-gray-900 dark:text-zinc-50">R$ {(reportData.totalExpense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    <div className={`border-l-4 pl-4 py-1 ${reportData.balance >= 0 ? 'border-gray-500' : 'border-gray-200 dark:border-zinc-700'}`}><span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase block">Saldo</span><span className={`text-2xl font-bold ${reportData.balance >= 0 ? 'text-gray-700 dark:text-zinc-300' : 'text-gray-900 dark:text-zinc-50'}`}>R$ {(reportData.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </div>
                {reportData.totalInvested > 0 && (
                     <div className="mb-10 break-inside-avoid">
                        <div className="border-l-4 border-blue-500 pl-4 py-1"><span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase block">Total Investido</span><span className="text-2xl font-bold text-blue-600">R$ {(reportData.totalInvested || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                     </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {reportData.categorySummary.length > 0 && (
                        <div className="break-inside-avoid">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 uppercase mb-6 pb-2 border-b flex items-center gap-2"><PieChart size={16} /> Análise por Categoria</h3>
                            <div className="space-y-4">
                                {reportData.categorySummary.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-4 text-sm">
                                        <div className="w-32 font-medium text-gray-800 truncate text-right">{cat.name}</div>
                                        <div className="flex-1 h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(cat.value / (cat.type === TransactionType.INCOME ? reportData.totalIncome : (cat.type === TransactionType.INVESTMENT ? reportData.totalInvested : reportData.totalExpense))) * 100}%`, backgroundColor: cat.color }}></div></div>
                                        <div className="w-24 text-right font-bold text-gray-900 dark:text-zinc-50">R$ {(cat.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {reportData.subCategorySummary.length > 0 && (
                        <div className="break-inside-avoid">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 uppercase mb-6 pb-2 border-b flex items-center gap-2"><Layers size={16} /> Subcategorias</h3>
                            <div className="space-y-3">
                                {reportData.subCategorySummary.slice(0, 8).map((sub, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                        <div className="flex flex-col"><span className="font-semibold text-gray-800">{sub.name}</span><span className="text-[10px] text-gray-500 dark:text-zinc-400">{sub.parentName}</span></div>
                                        <div className="text-right font-bold text-gray-900 dark:text-zinc-50">R$ {(sub.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="break-before-auto">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 uppercase mb-6 pb-2 border-b">Detalhamento</h3>
                    <table className="w-full text-sm text-left border-collapse">
                        <thead><tr className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase border-b-2 border-gray-200 dark:border-zinc-700"><th className="py-3 pl-2">Data</th><th className="py-3">Descrição</th><th className="py-3">Categoria</th><th className="py-3 text-right">Valor</th></tr></thead>
                        <tbody className="text-gray-800">
                            {reportData.transactions.map((t, index) => (
                                <tr key={t.id} className="border-b border-gray-200 dark:border-zinc-700 odd:bg-white dark:bg-zinc-900 even:bg-gray-50 dark:bg-zinc-800\/50 break-inside-avoid">
                                    <td className="py-2.5 pl-2 text-gray-700 dark:text-zinc-300 font-mono text-xs">{(() => { const d = new Date(t.date); return isNaN(d.getTime()) ? (t.date || '') : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); })()}</td>
                                    <td className="py-2.5 pr-4"><div className="font-semibold text-gray-900 dark:text-zinc-50">{t.description}</div><div className="text-[10px] text-gray-500 dark:text-zinc-400">{t.paymentMethod === PaymentMethod.CREDIT_CARD ? creditCards.find(c => c.id === t.creditCardId)?.name || 'Crédito' : 'Débito'}{t.isShared && ' • Dividido'}</div></td>
                                    <td className="py-2.5 text-xs">{categories.find(c => c.id === t.categoryId)?.name}</td>
                                    <td className={`py-2.5 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-700' : (t.type === TransactionType.INVESTMENT ? 'text-blue-700' : 'text-gray-900 dark:text-zinc-50')}`}>R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};