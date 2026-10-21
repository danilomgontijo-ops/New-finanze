import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, TransactionType, PaymentMethod, CreditCard, UserSettings, SubCategory } from '../types';
import { 
  X, 
  Printer, 
  Calendar, 
  Filter, 
  FileText, 
  PieChart, 
  ArrowRight, 
  Check, 
  Square, 
  CheckSquare, 
  CreditCard as CreditCardIcon, 
  Layers, 
  AlertCircle, 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  HelpCircle,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  UserCheck
} from 'lucide-react';
import { calculateEffectiveDate } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';

interface ReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards?: CreditCard[];
  settings?: UserSettings;
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
  const [additionalCardScope, setAdditionalCardScope] = useState<'ALL' | 'MAIN_ONLY' | 'ADDITIONAL_ONLY'>('ALL');
  const [sharedFilter, setSharedFilter] = useState<'ALL' | 'ONLY_SHARED' | 'SHARED_MAIN' | 'SHARED_ADDITIONAL'>('ALL');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOnlyInstallments, setFilterOnlyInstallments] = useState(false);
  const [showPrintHint, setShowPrintHint] = useState(false);

  // Dynamic tags available in transaction list
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    transactions.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [transactions]);

  const availableSubCategories = useMemo(() => {
    return subCategories.filter(s => selectedCategoryIds.includes(s.categoryId));
  }, [subCategories, selectedCategoryIds]);

  // Set default filters on open
  useEffect(() => {
    if (isOpen) {
      setSelectedCategoryIds(categories.map(c => c.id));
      setSelectedSubCategoryIds(subCategories.map(s => s.id));
      setSelectedTags([]); 
      setSelectedPaymentMethod('ALL');
      setSelectedCardId('ALL');
      setAdditionalCardScope('ALL');
      setSharedFilter('ALL');
      setDateMode('month');
      setFilterOnlyInstallments(false);
      setStep('config');
      setShowPrintHint(false);
    }
  }, [isOpen, categories, subCategories]);

  // Helper para identificar a ORIGEM DO CARTÃO da transação (Titular vs Adicional)
  const isAdditionalCardTransaction = (t: Transaction, catList: Category[]) => {
    if (!t) return false;

    // 1. Origem explícita do cartão (cardOrigin) é a fonte absoluta de verdade sobre ONDE a compra foi passada
    const origin = (t.cardOrigin || '').toUpperCase();
    if (origin === 'ADDITIONAL' || origin === 'ADICIONAL') return true;
    if (origin === 'TITULAR') return false;

    // 2. Fallback para dados legados sem cardOrigin explícito
    const cat = catList.find(c => c.id === t.categoryId);
    if (cat?.isAdditionalCard) return true;

    const descLower = (t.description || '').toLowerCase();
    // Lançamento legado não-dividido na categoria Nathy era no cartão adicional
    if (!t.isShared && cat?.name?.toLowerCase().includes('nathy')) {
      return true;
    }

    return false;
  };

  // Sync subcategories with selected categories
  useEffect(() => {
    const currentAvailableIds = subCategories
      .filter(s => selectedCategoryIds.includes(s.categoryId))
      .map(s => s.id);
    setSelectedSubCategoryIds(prev => prev.filter(id => currentAvailableIds.includes(id)));
  }, [selectedCategoryIds, subCategories]);

  const reportData = useMemo(() => {
    if (!isOpen || step === 'config') return null;
    let targetMonthIndex = -1; 
    let targetYear = -1;
    let customStart = new Date(0); 
    let customEnd = new Date(0);

    if (dateMode === 'month' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      targetYear = y; 
      targetMonthIndex = m - 1;
    } else {
      customStart = new Date(startDate ? `${startDate}T00:00:00` : '1970-01-01T00:00:00');
      customEnd = new Date(endDate ? `${endDate}T23:59:59` : '2099-12-31T23:59:59');
    }

    const filtered = transactions.filter(t => {
      // Date filtering
      if (dateMode === 'month') {
        const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
        if (effectiveDate.getFullYear() !== targetYear || effectiveDate.getMonth() !== targetMonthIndex) return false;
      } else {
        const tDate = new Date(t.date);
        if (tDate < customStart || tDate > customEnd) return false;
      }

      // Type filtering
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;

      // Payment method filtering
      if (selectedPaymentMethod !== 'ALL') {
        if (t.type === TransactionType.EXPENSE || t.type === TransactionType.INVESTMENT) {
          if (t.paymentMethod !== selectedPaymentMethod) return false;
          if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD && selectedCardId !== 'ALL') {
            if (t.creditCardId !== selectedCardId) return false;
          }
        } else if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD) {
          return false;
        }
      }

      // Additional Card Scope filtering
      const isAdditional = isAdditionalCardTransaction(t, categories);
      if (additionalCardScope === 'MAIN_ONLY' && isAdditional) return false;
      if (additionalCardScope === 'ADDITIONAL_ONLY' && !isAdditional) return false;

      // Shared expenses filter (All, Only Shared, Shared on Main/Titular, Shared on Additional)
      if (sharedFilter === 'ONLY_SHARED' && !t.isShared) return false;
      if (sharedFilter === 'SHARED_MAIN' && (!t.isShared || isAdditional)) return false;
      if (sharedFilter === 'SHARED_ADDITIONAL' && (!t.isShared || !isAdditional)) return false;

      // Category and Subcategory filtering
      if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(t.categoryId)) return false;
      if (t.subCategoryId && selectedSubCategoryIds.length > 0 && !selectedSubCategoryIds.includes(t.subCategoryId)) return false;

      // Tag filtering
      if (selectedTags.length > 0) {
        const hasMatch = (t.tags || []).some(tag => selectedTags.includes(tag));
        if (!hasMatch) return false;
      }

      // Installment flags
      if (filterOnlyInstallments && (!t.totalInstallments || t.totalInstallments <= 1)) return false;

      return true;
    });

    const totalIncome = filtered.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === TransactionType.EXPENSE && !t.fundedByResgate).reduce((acc, t) => acc + t.amount, 0);
    const totalInvested = filtered.filter(t => t.type === TransactionType.INVESTMENT).reduce((acc, t) => acc + t.amount, 0);

    let sharedTotalAmount = 0;
    let sharedTotalCount = 0;
    let sharedMainCount = 0;
    let sharedMainAmount = 0;
    let sharedAdditionalCount = 0;
    let sharedAdditionalAmount = 0;

    const categorySummary: Record<string, { name: string, value: number, color: string, type: TransactionType }> = {};
    const subCategorySummary: Record<string, { name: string, value: number, parentName: string }> = {};
    const expenseGroups: Record<string, { description: string, value: number, count: number }> = {};

    filtered.forEach(t => {
      if (t.isShared) {
        const isAdditional = isAdditionalCardTransaction(t, categories);
        sharedTotalCount += 1;
        sharedTotalAmount += t.amount;
        if (isAdditional) {
          sharedAdditionalCount += 1;
          sharedAdditionalAmount += t.amount;
        } else {
          sharedMainCount += 1;
          sharedMainAmount += t.amount;
        }
      }

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
      transactions: filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
      totalIncome, 
      totalExpense, 
      totalInvested,
      balance: totalIncome - totalExpense - totalInvested,
      sharedStats: {
        totalAmount: sharedTotalAmount,
        totalCount: sharedTotalCount,
        mainAmount: sharedMainAmount,
        mainCount: sharedMainCount,
        additionalAmount: sharedAdditionalAmount,
        additionalCount: sharedAdditionalCount
      },
      categorySummary: Object.values(categorySummary).sort((a, b) => b.value - a.value),
      subCategorySummary: Object.values(subCategorySummary).sort((a, b) => b.value - a.value),
      topExpenses: Object.values(expenseGroups).sort((a, b) => b.value - a.value).slice(0, 5)
    };
  }, [step, transactions, categories, subCategories, creditCards, settings, dateMode, selectedMonth, startDate, endDate, selectedType, selectedPaymentMethod, selectedCardId, additionalCardScope, sharedFilter, selectedCategoryIds, selectedSubCategoryIds, selectedTags, isOpen, filterOnlyInstallments]);

  if (!isOpen) return null;

  const handlePrintAction = () => {
    setShowPrintHint(true);
    try {
      window.print();
    } catch (e) {
      console.warn("Print blocked by browser environment");
    }
  };

  const handleGenerate = () => { 
    setStep('preview'); 
    setShowPrintHint(false); 
  };

  const handleClose = () => { 
    setStep('config'); 
    onClose(); 
  };

  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  const selectAllCategories = () => {
    setSelectedCategoryIds(categories.map(c => c.id));
  };

  const deselectAllCategories = () => {
    setSelectedCategoryIds([]);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/70 z-50 flex items-center justify-center p-0 sm:p-4 print:p-0 print:bg-white dark:bg-zinc-950/85 print:static overflow-hidden backdrop-blur-xs">
      <AnimatePresence mode="wait">
        {step === 'config' ? (
          <motion.div 
            key="config"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white dark:bg-zinc-900 w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] border border-zinc-100 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Configurar Relatório</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Selecione filtros para exportar ou imprimir dados financeiros.</p>
                </div>
              </div>
              <button 
                onClick={handleClose} 
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Scrollable Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Period Section */}
                <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" /> Período do Relatório
                  </label>
                  
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mb-3">
                    <button 
                      type="button"
                      onClick={() => setDateMode('month')} 
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        dateMode === 'month' 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-850 dark:text-zinc-100 border border-zinc-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-zinc-750 dark:hover:text-zinc-200'
                      }`}
                    >
                      Mensal
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDateMode('custom')} 
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        dateMode === 'custom' 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-850 dark:text-zinc-100 border border-zinc-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-zinc-750 dark:hover:text-zinc-200'
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {dateMode === 'month' ? (
                    <input 
                      type="month" 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(e.target.value)} 
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-850 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all font-semibold" 
                    />
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-400 font-medium">Início</span>
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)} 
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-700 rounded-xl px-2.5 py-2.5 text-xs text-zinc-850 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500" 
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-400 font-medium">Fim</span>
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)} 
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-700 rounded-xl px-2.5 py-2.5 text-xs text-zinc-850 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter / Type Section */}
                <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Filter size={14} className="text-emerald-600 dark:text-emerald-400" /> Tipo de Fluxo
                  </label>

                  <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setSelectedType('ALL')} 
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectedType === 'ALL' 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-zinc-750'
                      }`}
                    >
                      Todos
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSelectedType(TransactionType.EXPENSE)} 
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectedType === TransactionType.EXPENSE 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-rose-600 dark:text-rose-400 border border-rose-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-rose-600/80'
                      }`}
                    >
                      Despesas
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSelectedType(TransactionType.INCOME)} 
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectedType === TransactionType.INCOME 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-emerald-600/80'
                      }`}
                    >
                      Receitas
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSelectedType(TransactionType.INVESTMENT)} 
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectedType === TransactionType.INVESTMENT 
                          ? 'bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400 border border-blue-200/20' 
                          : 'text-zinc-550 dark:text-zinc-400 hover:text-blue-600/80'
                      }`}
                    >
                      Investimentos
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setFilterOnlyInstallments(!filterOnlyInstallments)} 
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                          filterOnlyInstallments 
                            ? 'bg-purple-50 dark:bg-purple-950/35 border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 shadow-xs font-extrabold' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50'
                        }`}
                      >
                        Apenas Parcelados
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSharedFilter(prev => prev === 'ALL' ? 'ONLY_SHARED' : 'ALL')} 
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                          sharedFilter !== 'ALL' 
                            ? 'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 shadow-xs font-extrabold' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50'
                        }`}
                      >
                        {sharedFilter !== 'ALL' ? 'Filtro Divididos Ativo' : 'Apenas Divididos'}
                      </button>
                    </div>

                    {sharedFilter !== 'ALL' && (
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setSharedFilter('ONLY_SHARED')}
                          className={`flex-1 py-1 font-bold rounded-lg transition-all ${
                            sharedFilter === 'ONLY_SHARED'
                              ? 'bg-white dark:bg-zinc-900 shadow-xs text-blue-600 dark:text-blue-400'
                              : 'text-zinc-500 hover:text-zinc-700'
                          }`}
                        >
                          Todas Divididas
                        </button>
                        <button
                          type="button"
                          onClick={() => setSharedFilter('SHARED_MAIN')}
                          className={`flex-1 py-1 font-bold rounded-lg transition-all ${
                            sharedFilter === 'SHARED_MAIN'
                              ? 'bg-white dark:bg-zinc-900 shadow-xs text-blue-600 dark:text-blue-400'
                              : 'text-zinc-500 hover:text-zinc-700'
                          }`}
                        >
                          Origem Titular
                        </button>
                        <button
                          type="button"
                          onClick={() => setSharedFilter('SHARED_ADDITIONAL')}
                          className={`flex-1 py-1 font-bold rounded-lg transition-all ${
                            sharedFilter === 'SHARED_ADDITIONAL'
                              ? 'bg-white dark:bg-zinc-900 shadow-xs text-rose-600 dark:text-rose-400'
                              : 'text-zinc-500 hover:text-zinc-700'
                          }`}
                        >
                          Origem Adicional
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method / Cards & Titular / Cartão Adicional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Method / Cards */}
                <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <CreditCardIcon size={14} className="text-emerald-600 dark:text-emerald-400" /> Meios de Pagamento
                  </label>
                  
                  <div className="space-y-2">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0">
                      <button 
                        type="button"
                        onClick={() => { setSelectedPaymentMethod('ALL'); setSelectedCardId('ALL'); }} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          selectedPaymentMethod === 'ALL' 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Todos
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSelectedPaymentMethod(PaymentMethod.CREDIT_CARD)} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          selectedPaymentMethod === PaymentMethod.CREDIT_CARD 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Crédito
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setSelectedPaymentMethod(PaymentMethod.DEBIT_CASH); setSelectedCardId('ALL'); }} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          selectedPaymentMethod === PaymentMethod.DEBIT_CASH 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Débito/Din
                      </button>
                    </div>

                    {selectedPaymentMethod === PaymentMethod.CREDIT_CARD ? (
                      <select 
                        value={selectedCardId} 
                        onChange={(e) => setSelectedCardId(e.target.value)} 
                        className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 font-semibold outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="ALL">Todos os Cartões</option>
                        {creditCards.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center text-xs text-zinc-450 dark:text-zinc-500 bg-zinc-100/50 dark:bg-zinc-800/40 rounded-xl px-3 py-1.5 border border-dashed border-zinc-200/50 dark:border-zinc-800">
                        Disponível apenas para Crédito.
                      </div>
                    )}
                  </div>
                </div>

                {/* Titular vs Cartão Adicional Scope */}
                <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-emerald-600 dark:text-emerald-400" /> Titular / Cartão Adicional
                  </label>
                  
                  <div className="space-y-2">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0">
                      <button 
                        type="button"
                        onClick={() => setAdditionalCardScope('ALL')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          additionalCardScope === 'ALL' 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Geral
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdditionalCardScope('MAIN_ONLY')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          additionalCardScope === 'MAIN_ONLY' 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-blue-600 dark:text-blue-400' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Titular
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdditionalCardScope('ADDITIONAL_ONLY')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          additionalCardScope === 'ADDITIONAL_ONLY' 
                            ? 'bg-white dark:bg-zinc-900 shadow-xs text-rose-600 dark:text-rose-400' 
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                        }`}
                      >
                        Adicional
                      </button>
                    </div>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug px-1">
                      {additionalCardScope === 'ALL' && 'Inclui todos os lançamentos (titular e dependentes).'}
                      {additionalCardScope === 'MAIN_ONLY' && 'Apenas gastos do titular (exclui cartões adicionais).'}
                      {additionalCardScope === 'ADDITIONAL_ONLY' && 'Extrato exclusivo para conferência do cartão adicional.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories Selector */}
              <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
                <div className="flex justify-between items-center pb-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <PieChart size={14} className="text-emerald-600 dark:text-emerald-400" /> Filtrar Categorias
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={selectAllCategories} 
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold transition-all hover:underline cursor-pointer"
                    >
                      Marcar todas
                    </button>
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-700">|</span>
                    <button 
                      type="button"
                      onClick={deselectAllCategories} 
                      className="text-[10px] text-rose-500 hover:text-rose-600 dark:text-rose-400 font-bold transition-all hover:underline cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-800 max-h-48 overflow-y-auto custom-scrollbar shadow-xs">
                  {categories.filter(c => selectedType === 'ALL' || c.type === selectedType).map(c => {
                    const isChecked = selectedCategoryIds.includes(c.id);
                    return (
                      <button 
                        key={c.id} 
                        type="button"
                        onClick={() => toggleItem(selectedCategoryIds, setSelectedCategoryIds, c.id)} 
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all text-left cursor-pointer ${
                          isChecked 
                            ? 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-250 dark:border-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs' 
                            : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-750 dark:hover:text-zinc-300 hover:bg-zinc-50/50'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square size={14} className="text-zinc-300 dark:text-zinc-700 shrink-0" />
                        )}
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }}></div>
                        <span className="truncate font-medium">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={handleClose} 
                className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-xl cursor-pointer text-xs transition-all border border-zinc-250/55 dark:border-zinc-750"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleGenerate} 
                className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 hover:shadow-lg active:scale-[0.98] flex items-center gap-2 shadow-md shadow-emerald-600/10 transition-all cursor-pointer text-xs"
              >
                Gerar Relatório <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white dark:bg-zinc-900 w-full h-full sm:h-[92vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col print:shadow-none print:h-auto print:max-w-none print:rounded-none border border-zinc-100 dark:border-zinc-800"
          >
            {/* Toolbar Header (hidden on print) */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 px-6 py-4 flex justify-between items-center print:hidden shrink-0">
              <button 
                onClick={() => setStep('config')} 
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-650 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 cursor-pointer transition-all"
              >
                <ChevronLeft size={16} /> Voltar para Filtros
              </button>
              
              <div className="flex gap-2.5 items-center">
                <button 
                  onClick={handleClose} 
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-750 dark:hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-150 dark:hover:bg-zinc-800 cursor-pointer transition-all"
                >
                  Fechar
                </button>
                <button 
                  onClick={handlePrintAction} 
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 hover:shadow-md active:scale-95 transition-all shadow-sm shadow-emerald-600/15 cursor-pointer"
                >
                  <Printer size={15} /> Imprimir Relatório
                </button>
              </div>
            </div>

            {/* Alert / Hints */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-center gap-2 print:hidden shrink-0">
              <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                Aviso: Use o atalho <strong>Ctrl + P</strong> (Cmd + P) se o navegador bloquear o botão de impressão.
              </span>
            </div>

            {showPrintHint && (
              <div className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 print:hidden">
                <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Caixa de Impressão Acionada</p>
                  <p className="text-[11px] text-zinc-650 dark:text-zinc-400 leading-relaxed mt-1">
                    Se o diálogo não abrir automaticamente devido a restrições de sandbox, use <strong>Ctrl + P</strong> (ou <strong>Cmd + P</strong>) no teclado para obter o PDF com formatação otimizada para papel.
                  </p>
                </div>
              </div>
            )}

            {/* Report Preview Body */}
            <div className="flex-1 overflow-y-auto px-6 py-8 sm:p-12 print:p-0 print:overflow-visible custom-scrollbar bg-white dark:bg-zinc-950">
              
              {/* Report Header Logo & Title */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 border-b-2 border-zinc-150 dark:border-zinc-800 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight uppercase flex items-center gap-2">
                    <FileText className="text-emerald-600 dark:text-emerald-400 print:text-zinc-900" /> Relatório Financeiro
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">FinanZe Personal Finance</p>
                    {additionalCardScope === 'MAIN_ONLY' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 print:border-zinc-400 print:text-zinc-800">
                        Apenas Titular
                      </span>
                    )}
                    {additionalCardScope === 'ADDITIONAL_ONLY' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 print:border-zinc-400 print:text-zinc-800">
                        Cartão Adicional (Fatura Separada)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Período de Referência</div>
                  <div className="text-base font-light text-zinc-700 dark:text-zinc-300 capitalize mt-1">
                    {dateMode === 'month' ? (
                      (() => { 
                        const d = new Date(selectedMonth + '-02'); 
                        return isNaN(d.getTime()) ? selectedMonth : d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); 
                      })()
                    ) : (
                      (() => { 
                        const d1 = new Date(startDate ? `${startDate}T12:00:00` : ''); 
                        const d2 = new Date(endDate ? `${endDate}T12:00:00` : ''); 
                        const str1 = isNaN(d1.getTime()) ? startDate : d1.toLocaleDateString('pt-BR'); 
                        const str2 = isNaN(d2.getTime()) ? endDate : d2.toLocaleDateString('pt-BR'); 
                        return `${str1} até ${str2}`; 
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Cards Dashboard Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 break-inside-avoid">
                {/* Income */}
                <div className="border border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/10 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Total Receitas</span>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight size={14} className="shrink-0" />
                      R$ {(reportData?.totalIncome || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Expense */}
                <div className="border border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/10 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Total Despesas</span>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ArrowDownRight size={14} className="shrink-0" />
                      R$ {(reportData?.totalExpense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Invested */}
                <div className="border border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/10 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Total Investido</span>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <TrendingUp size={14} className="shrink-0" />
                      R$ {(reportData?.totalInvested || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Balance */}
                <div className="border border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/10 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Saldo Líquido</span>
                    <div className={`text-lg font-bold flex items-center gap-1 ${
                      (reportData?.balance || 0) >= 0 ? 'text-zinc-800 dark:text-zinc-100' : 'text-rose-600'
                    }`}>
                      <Wallet size={14} className="shrink-0" />
                      R$ {(reportData?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid of Categories and Subcategories Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Category summary bars */}
                {reportData && reportData.categorySummary.length > 0 ? (
                  <div className="break-inside-avoid border border-zinc-150 dark:border-zinc-800/80 rounded-2xl p-5 bg-zinc-50/10 dark:bg-zinc-900/5">
                    <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wider pb-3 border-b border-zinc-150 dark:border-zinc-800 mb-5 flex items-center gap-2">
                      <PieChart size={15} className="text-emerald-600 dark:text-emerald-400" /> Distribuição por Categoria
                    </h3>
                    <div className="space-y-4">
                      {reportData.categorySummary.map((cat, idx) => {
                        const totalReference = cat.type === TransactionType.INCOME 
                          ? reportData.totalIncome 
                          : (cat.type === TransactionType.INVESTMENT ? reportData.totalInvested : reportData.totalExpense);
                        const percentage = totalReference > 0 ? (cat.value / totalReference) * 100 : 0;

                        return (
                          <div key={idx} className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color }}></span>
                                {cat.name}
                              </span>
                              <span className="font-bold text-zinc-850 dark:text-zinc-100">
                                R$ {(cat.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                <span className="text-[10px] text-zinc-400 font-normal ml-1">({percentage.toFixed(0)}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: cat.color }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Subcategory simple details list */}
                {reportData && reportData.subCategorySummary.length > 0 ? (
                  <div className="break-inside-avoid border border-zinc-150 dark:border-zinc-800/80 rounded-2xl p-5 bg-zinc-50/10 dark:bg-zinc-900/5">
                    <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wider pb-3 border-b border-zinc-150 dark:border-zinc-800 mb-5 flex items-center gap-2">
                      <Layers size={15} className="text-emerald-600 dark:text-emerald-400" /> Subcategorias de Destaque
                    </h3>
                    <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                      {reportData.subCategorySummary.slice(0, 7).map((sub, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-zinc-100 dark:border-zinc-800/50 pb-2.5 last:border-b-0 last:pb-0">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-750 dark:text-zinc-200">{sub.name}</span>
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{sub.parentName}</span>
                          </div>
                          <div className="text-right font-semibold text-zinc-900 dark:text-zinc-100">
                            R$ {(sub.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Dedicated Shared Expenses Origin Breakdown Panel */}
              {reportData && reportData.sharedStats.totalCount > 0 && (
                <div className="mb-8 p-4 sm:p-5 bg-zinc-50/40 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl break-inside-avoid">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5 pb-2.5 border-b border-zinc-200/70 dark:border-zinc-800/70">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <Users size={15} className="text-blue-600 dark:text-blue-400" /> Origem das Despesas Divididas ({reportData.sharedStats.totalCount} lançamentos)
                    </h3>
                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Total Dividido: R$ {reportData.sharedStats.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Origem no Cartão Titular */}
                    <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Origem: Cartão Titular</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {reportData.sharedStats.mainCount} item(ns) debitados na sua conta/cartão
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-blue-700 dark:text-blue-300">
                          R$ {reportData.sharedStats.mainAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {reportData.sharedStats.totalAmount > 0 ? ((reportData.sharedStats.mainAmount / reportData.sharedStats.totalAmount) * 100).toFixed(0) : 0}% das divididas
                        </div>
                      </div>
                    </div>

                    {/* Origem no Cartão Adicional */}
                    <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Origem: Cartão Adicional</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {reportData.sharedStats.additionalCount} item(ns) debitados no cartão dependente
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-rose-700 dark:text-rose-300">
                          R$ {reportData.sharedStats.additionalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {reportData.sharedStats.totalAmount > 0 ? ((reportData.sharedStats.additionalAmount / reportData.sharedStats.totalAmount) * 100).toFixed(0) : 0}% das divididas
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions Detailed Ledger Table */}
              <div className="break-before-auto mt-6">
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wider pb-3 border-b border-zinc-150 dark:border-zinc-800 mb-5">
                  Detalhamento das Transações
                </h3>
                
                <div className="overflow-x-auto rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm print:border-none print:shadow-none">
                  <table className="w-full text-xs text-left border-collapse bg-white dark:bg-zinc-950">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-3">Descrição / Meio</th>
                        <th className="py-3 px-3">Categoria</th>
                        <th className="py-3 px-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {reportData && reportData.transactions.map((t) => {
                        const isAdd = isAdditionalCardTransaction(t, categories);
                        return (
                          <tr key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all break-inside-avoid">
                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-mono text-[10px] shrink-0 whitespace-nowrap">
                              {(() => { 
                                const d = new Date(t.date); 
                                return isNaN(d.getTime()) ? (t.date || '') : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); 
                              })()}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                                {t.description}
                              </div>
                              <div className="text-[9px] text-zinc-400 dark:text-zinc-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>
                                  {t.paymentMethod === PaymentMethod.CREDIT_CARD 
                                    ? creditCards.find(c => c.id === t.creditCardId)?.name || 'Cartão de Crédito' 
                                    : (t.paymentMethod === PaymentMethod.DEBIT_CASH ? 'Débito / Dinheiro' : t.paymentMethod)}
                                </span>
                                {t.isShared && (
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold text-[8px] ${
                                    isAdd 
                                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60' 
                                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                                  }`}>
                                    <Users size={8} />
                                    Dividido (Origem: {isAdd ? 'Adicional' : 'Titular'})
                                  </span>
                                )}
                                {!t.isShared && isAdd && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-extrabold text-[8px]">
                                    Adicional
                                  </span>
                                )}
                                {t.totalInstallments && t.totalInstallments > 1 && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-extrabold text-[8px]">
                                    Parcelado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-zinc-650 dark:text-zinc-400 font-medium">
                              {categories.find(c => c.id === t.categoryId)?.name || 'Outros'}
                            </td>
                            <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                              t.type === TransactionType.INCOME 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : (t.type === TransactionType.INVESTMENT ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100')
                            }`}>
                              R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
