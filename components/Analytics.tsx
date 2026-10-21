
import React, { useMemo, useState } from 'react';
import { Transaction, Category, SubCategory, TransactionType, UserSettings, CreditCard, PaymentMethod } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, Line, LineChart, ComposedChart
} from 'recharts';
import { TrendingUp, TrendingDown, PieChart as PieIcon, Activity, ArrowUp, ArrowDown, Wallet, ShieldCheck, AlertTriangle, List, ChevronLeft, ChevronRight, Filter, Search, X, Check, Layers, ArrowRight, CheckSquare, Square, Percent, ChevronDown, ChevronUp, Merge, Calculator, Hash, Maximize, Minimize, Map as MapIcon, Users, Calendar, Sparkles, Clock, Flame } from 'lucide-react';
import { calculateEffectiveDate } from '../utils/dateUtils';
import { motion } from 'motion/react';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  currentDate: Date;
  settings: UserSettings;
  onDateChange: (date: Date) => void;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f43f5e', '#84cc16', '#14b8a6', '#64748b', '#3b82f6', '#d946ef'];

const formatCurrency = (val: number) => 
  (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalizeText = (text: string) => 
  text.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

const isAdditionalCardTransaction = (t: Transaction, catList: Category[]) => {
  if (!t) return false;
  const descLower = (t.description || '').toLowerCase();
  if (descLower.includes('(minha parte)') || descLower.includes('minha parte')) {
    return false;
  }
  if (descLower.includes('(parte nathy)') || descLower.includes('parte nathy')) {
    return true;
  }
  const cat = catList.find(c => c.id === t.categoryId);
  const catNameLower = (cat?.name || '').toLowerCase();
  const isAdditional = cat?.isAdditionalCard || false;
  const isNathyCat = catNameLower === 'nathy' || catNameLower.includes('nathy');
  const isCardOriginAdd = (t.cardOrigin || '').toUpperCase() === 'ADDITIONAL' || (t.cardOrigin || '').toUpperCase() === 'ADICIONAL';
  return isAdditional || isNathyCat || isCardOriginAdd;
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-md text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {label && <p className="font-bold text-zinc-900 dark:text-zinc-105 mb-1">{label}</p>}
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }}></div>
                        <span className="opacity-80">{p.name}:</span>
                        <span className="font-bold">{formatCurrency(p.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const DailyProgressionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload;
        if (!data) return null;

        const diff6M = (data.cumulativeExpense !== null && data.Media6Meses !== undefined && data.Media6Meses > 0)
            ? (data.cumulativeExpense - data.Media6Meses)
            : null;
        const pctDiff6M = (diff6M !== null && data.Media6Meses > 0)
            ? ((diff6M / data.Media6Meses) * 100)
            : null;

        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xl text-xs text-zinc-800 dark:text-zinc-200 min-w-[270px] max-w-[340px]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-150 dark:border-zinc-800">
                    <div>
                        <div className="font-black text-zinc-900 dark:text-zinc-100 text-sm">{data.label}</div>
                        <div className="text-[10px] text-zinc-400 font-semibold">Dia {data.dayIndex} do ciclo salarial</div>
                    </div>
                    {data.isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">Hoje</span>
                    )}
                </div>

                <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Gasto do Dia:
                        </span>
                        <span className="font-extrabold text-rose-600 dark:text-rose-400">
                            {formatCurrency(data.dailyExpense || 0)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span> Acumulado no Mês:
                        </span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400">
                            {data.cumulativeExpense !== null ? formatCurrency(data.cumulativeExpense) : '—'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Média 6 Meses (até este dia):
                        </span>
                        <span className="font-extrabold text-purple-600 dark:text-purple-400">
                            {formatCurrency(data.Media6Meses || 0)}
                        </span>
                    </div>

                    {diff6M !== null && (
                        <div className={`p-2 rounded-xl text-[11px] font-bold flex items-center justify-between ${diff6M > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'}`}>
                            <span>{diff6M > 0 ? 'Acima da média de 6M:' : 'Abaixo da média de 6M:'}</span>
                            <span>{diff6M > 0 ? '+' : ''}{formatCurrency(diff6M)} ({pctDiff6M ? (pctDiff6M > 0 ? `+${pctDiff6M.toFixed(0)}%` : `${pctDiff6M.toFixed(0)}%`) : ''})</span>
                        </div>
                    )}
                </div>

                {data.items && data.items.length > 0 && (
                    <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex justify-between">
                            <span>Lançamentos ({data.items.length})</span>
                            <span>Valor</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                            {data.items.map((it: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-[11px] gap-2">
                                    <span className="truncate text-zinc-700 dark:text-zinc-300 flex items-center gap-1" title={it.description}>
                                        <span className="truncate">{it.description}</span>
                                        {it.isAdditional && (
                                            <span className="px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[8px] font-bold shrink-0">Adic.</span>
                                        )}
                                    </span>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                                        {formatCurrency(it.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const KPICard = ({ title, value, icon: Icon, color, isPercentage, subtext }: { title: string, value: number, icon: any, color: 'emerald' | 'rose' | 'indigo' | 'violet' | 'zinc', isPercentage?: boolean, subtext?: React.ReactNode }) => {
    const variants = {
        emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200/50 dark:border-emerald-900/40' },
        rose: { iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400', border: 'border-rose-200/50 dark:border-rose-900/40' },
        indigo: { iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200/50 dark:border-indigo-900/40' },
        violet: { iconBg: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400', border: 'border-violet-200/50 dark:border-violet-900/40' },
        zinc: { iconBg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400', border: 'border-zinc-200/60 dark:border-zinc-800/80' }
    } as const;
    const v = variants[color] || variants.zinc;
    return (
        <motion.div
            whileHover={{ y: -1 }}
            className={`p-4 sm:p-5 rounded-2xl border ${v.border} bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-4 transition-all relative overflow-hidden group`}
        >
            <div className={`p-3 rounded-xl ${v.iconBg} transition-transform group-hover:scale-105 shrink-0`}>
                <Icon strokeWidth={1.8} size={20} />
            </div>
            <div className="relative z-10 flex-1 min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1 truncate">{title}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none truncate tabular-nums">
                    {isPercentage ? `${(value || 0).toFixed(1)}%` : `R$ ${(value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                </h3>
                {subtext && <div className="mt-1 leading-tight">{subtext}</div>}
            </div>
        </motion.div>
    );
};

export const Analytics: React.FC<AnalyticsProps> = ({
  transactions = [], 
  categories = [], 
  subCategories = [], 
  creditCards = [], 
  currentDate, 
  settings,
  onDateChange
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'trends'>('overview');
  
  // Time Range States
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'custom' | 'all'>('month');
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [customStartMonth, setCustomStartMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [customEndMonth, setCustomEndMonth] = useState(new Date().toISOString().slice(0, 7));

  const [distMode, setDistMode] = useState<'category' | 'subcategory'>('category');
  const [groupMode, setGroupMode] = useState<'description' | 'category' | 'subcategory'>('description');
  
  // Nathy / Shared visibility state
  const [includeNathy, setIncludeNathy] = useState(false);
  
  // Exclude future transactions state
  const [excludeFuture, setExcludeFuture] = useState(true);
  
  // Drill-down States
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedDetailSlice, setSelectedDetailSlice] = useState<string | null>(null);
  const [groupDetailsByName, setGroupDetailsByName] = useState(true);
  
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [analysisType, setAnalysisType] = useState<TransactionType>(TransactionType.EXPENSE);

  const toggleCategoryFilter = (catId: string) => { 
      setFilterCategoryIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]); 
  };

  const selectAllCategories = (type: TransactionType) => {
      const typeIds = categories.filter(c => c.type === type).map(c => c.id);
      const allSelected = typeIds.every(id => filterCategoryIds.includes(id));
      if (allSelected) {
          setFilterCategoryIds(prev => prev.filter(id => !typeIds.includes(id)));
      } else {
          setFilterCategoryIds(prev => [...new Set([...prev, ...typeIds])]);
      }
  };

  const clearCategoryFilters = () => setFilterCategoryIds([]);

  // Date Navigation
  const handlePrevMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      onDateChange(newDate);
  };

  const handleNextMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      onDateChange(newDate);
  };

  // Nathy Exclusion Logic helper
  const isNathyTransaction = (t: Transaction, _nathyId?: string) => {
      return isAdditionalCardTransaction(t, categories);
  };

  // Helper to check if a transaction passes the CURRENT ACTIVE filters (Category & Tag)
  const matchesFilters = (t: Transaction) => {
      if (filterCategoryIds.length > 0 && !filterCategoryIds.includes(t.categoryId)) return false;
      if (filterTag) {
          const search = filterTag.toLowerCase();
          const hasTag = t.tags?.some(tag => tag.toLowerCase().includes(search));
          const hasDesc = t.description.toLowerCase().includes(search);
          if (!hasTag && !hasDesc) return false;
      }
      return true;
  };

  const isFiltering = filterCategoryIds.length > 0 || filterTag;

  // GLOBAL DATA: All transactions for the period
  const globalPeriodData = useMemo(() => {
    const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
    const todayStr = new Date().toISOString().slice(0, 10);
    return transactions?.filter(t => {
      // Exclusion Logic (Nathy/Shared)
      if (!includeNathy && isNathyTransaction(t, nathyId)) return false;
      
      // Future Exclusion Logic
      if (excludeFuture && t.date.slice(0, 10) > todayStr) return false;
      
      // Date Logic
      const effDate = calculateEffectiveDate(t, creditCards, settings);
      if (timeRange === 'month') { 
          if (effDate.getMonth() !== currentDate.getMonth() || effDate.getFullYear() !== currentDate.getFullYear()) return false; 
      } 
      else if (timeRange === 'year') { 
          if (effDate.getFullYear() !== selectedYear) return false; 
      }
      else if (timeRange === 'custom') {
          const tIso = effDate.toISOString().slice(0, 7); 
          if (tIso < customStartMonth || tIso > customEndMonth) return false;
      }
      return true;
    });
  }, [transactions, categories, timeRange, currentDate, selectedYear, customStartMonth, customEndMonth, creditCards, settings, includeNathy, excludeFuture]);

  const globalStats = useMemo(() => {
      let income = 0;
      let expense = 0;
      let investment = 0;
      globalPeriodData?.forEach(t => { 
          if (t.type === TransactionType.INCOME) income += t.amount; 
          else if (t.type === TransactionType.INVESTMENT) {
              const event = t.investmentDetails?.event;
              if (event === 'BUY') {
                  investment += t.amount;
              }
          }
          else expense += t.amount;
      });
      return { income, expense, investment };
  }, [globalPeriodData]);

  // BASE FILTERED DATA
  const baseFilteredData = useMemo(() => {
    return globalPeriodData?.filter(t => matchesFilters(t));
  }, [globalPeriodData, filterCategoryIds, filterTag]);

  const pocketInvestmentStats = useMemo(() => {
      let activePool = 0;
      let proventosPool = 0;
      let resgatesPool = 0;

      let myInvestmentFromPocket = 0;
      let myDividends = 0;
      let myResgates = 0;
      let myReinvestedProventos = 0;
      let myReinvestedResgates = 0;
      let startingProventosPool = 0;
      let endingProventosPool = 0;
      let startingResgatesPool = 0;
      let endingResgatesPool = 0;

      const monthlyData = new Map<string, { income: number, expense: number, proventos: number, resgates: number, invested: number, fundedByResgateExpense: number }>();

      const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;

      const todayStr = new Date().toISOString().slice(0, 10);
      const filteredTransactions = (transactions || []).filter(t => {
          if (excludeFuture && t.date.slice(0, 10) > todayStr) return false;
          return true;
      });

      const sortedTransactions = [...filteredTransactions]
          .sort((a, b) => {
              const dateA = calculateEffectiveDate(a, creditCards, settings).getTime();
              const dateB = calculateEffectiveDate(b, creditCards, settings).getTime();
              return dateA - dateB;
          });

      sortedTransactions.forEach(t => {
          const effDate = calculateEffectiveDate(t, creditCards, settings);
          const monthKey = `${effDate.getFullYear()}-${String(effDate.getMonth()).padStart(2, '0')}`;

          if (!monthlyData.has(monthKey)) {
              monthlyData.set(monthKey, { income: 0, expense: 0, proventos: 0, resgates: 0, invested: 0, fundedByResgateExpense: 0 });
          }

          const data = monthlyData.get(monthKey)!;

          if (t.type === TransactionType.INCOME && (includeNathy || !isNathyTransaction(t, nathyId))) {
              data.income += t.amount;
          } else if (t.type === TransactionType.EXPENSE && (includeNathy || !isNathyTransaction(t, nathyId))) {
              if (t.fundedByResgate) {
                  data.fundedByResgateExpense += t.amount;
              } else {
                  data.expense += t.amount;
              }
          } else if (t.type === TransactionType.INVESTMENT && (includeNathy || !isNathyTransaction(t, nathyId))) {
              const event = t.investmentDetails?.event;
              if (['DIVIDEND', 'JCP', 'RENDIMENTO'].includes(event || '')) {
                  data.proventos += t.amount;
              } else if (['SELL', 'AMORTIZACAO', 'REEMBOLSO'].includes(event || '')) {
                  data.resgates += t.amount;
              } else if (event === 'BUY') {
                  data.invested += t.amount;
              }
          }
      });

      const sortedMonths = Array.from(monthlyData.keys()).sort();

      sortedMonths.forEach(monthKey => {
          const data = monthlyData.get(monthKey)!;
          const [yearStr, monthStr] = monthKey.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);
          // monthKey usa mês 0-indexado (getMonth()). Valores vindos de <input type="month">
          // (customStartMonth/customEndMonth, settings.resgatesResetMonth) usam o padrão
          // HTML 1-12, então convertemos aqui para comparar igual em ambos os lados.
          const isoMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

          if (settings.resgatesResetMonth && isoMonthKey === settings.resgatesResetMonth) {
              resgatesPool = 0;
          }

          let isTarget = false;
          let isBefore = false;

          if (timeRange === 'month') {
              isTarget = (month === currentDate.getMonth() && year === currentDate.getFullYear());
              isBefore = (year < currentDate.getFullYear() || (year === currentDate.getFullYear() && month < currentDate.getMonth()));
          }
          else if (timeRange === 'year') {
              isTarget = (year === selectedYear);
              isBefore = (year < selectedYear);
          }
          else if (timeRange === 'custom') {
              isTarget = (isoMonthKey >= customStartMonth && isoMonthKey <= customEndMonth);
              isBefore = (isoMonthKey < customStartMonth);
          }

          const monthlySavings = data.income - data.expense;
          activePool += monthlySavings;
          proventosPool += data.proventos;
          resgatesPool += data.resgates;

          // Deduct expenses funded by resgates from the resgates pool
          resgatesPool -= data.fundedByResgateExpense;

          let remainingInvested = data.invested;
          let reinvestedProventos = 0;
          let reinvestedResgates = 0;
          let aporteNovo = 0;

          // Ordem de prioridade: resgates primeiro, depois proventos, e só o que
          // sobrar sai do bolso (dinheiro novo) — mesma ordem usada na tabela
          // "Resumo Financeiro Anual" de Lançamentos, pra não divergir entre telas.
          if (remainingInvested > 0) {
              reinvestedResgates = Math.min(remainingInvested, Math.max(0, resgatesPool));
              resgatesPool -= reinvestedResgates;
              remainingInvested -= reinvestedResgates;

              reinvestedProventos = Math.min(remainingInvested, Math.max(0, proventosPool));
              proventosPool -= reinvestedProventos;
              remainingInvested -= reinvestedProventos;

              aporteNovo = Math.min(remainingInvested, Math.max(0, activePool));
              activePool -= aporteNovo;
              remainingInvested -= aporteNovo;

              if (remainingInvested > 0) {
                  aporteNovo += remainingInvested;
                  activePool -= remainingInvested;
                  remainingInvested = 0;
              }
          }

          if (isBefore) {
              startingProventosPool = proventosPool;
              startingResgatesPool = resgatesPool;
          }

          if (isTarget) {
              myInvestmentFromPocket += aporteNovo;
              myReinvestedProventos += reinvestedProventos;
              myReinvestedResgates += reinvestedResgates;
              myDividends += data.proventos;
              myResgates += data.resgates;
          }
          
          endingProventosPool = proventosPool;
          endingResgatesPool = resgatesPool;
      });

      return { 
          myInvestmentFromPocket, 
          myDividends, 
          myResgates,
          myReinvestedProventos,
          myReinvestedResgates,
          myReinvested: myReinvestedProventos + myReinvestedResgates,
          startingPool: startingProventosPool + startingResgatesPool, 
          endingPool: endingProventosPool + endingResgatesPool,
          startingProventosPool,
          endingProventosPool,
          startingResgatesPool,
          endingResgatesPool
      };
  }, [transactions, timeRange, currentDate, selectedYear, customStartMonth, customEndMonth, creditCards, settings, includeNathy, categories, excludeFuture]);

  const periodStats = useMemo(() => {
      let income = 0, expense = 0, investment = 0, fixedExpense = 0;
      baseFilteredData?.forEach(t => { 
          if (t.type === TransactionType.INCOME) income += t.amount; 
          else if (t.type === TransactionType.INVESTMENT) {
              const event = t.investmentDetails?.event;
              if (event === 'BUY') {
                  investment += t.amount;
              }
          }
          else { 
              if (!t.fundedByResgate) {
                  expense += t.amount; 
                  if (t.isFixed) fixedExpense += t.amount; 
              }
          } 
      });
      return { 
          income, 
          expense, 
          investment, 
          myDividends: pocketInvestmentStats.myDividends, 
          myInvestmentFromPocket: pocketInvestmentStats.myInvestmentFromPocket, 
          myReinvested: pocketInvestmentStats.myReinvested,
          startingPool: pocketInvestmentStats.startingPool,
          endingPool: pocketInvestmentStats.endingPool,
          fixedExpense, 
          savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0 
      };
  }, [baseFilteredData, pocketInvestmentStats]);

  const analysisFilteredData = useMemo(() => {
      return baseFilteredData?.filter(t => {
          if (t.type !== analysisType) return false;
          if (analysisType === TransactionType.EXPENSE && t.fundedByResgate) return false;
          if (analysisType === TransactionType.INVESTMENT && t.investmentDetails?.event !== 'BUY') return false;
          return true;
      }) || [];
  }, [baseFilteredData, analysisType]);

  const categoryTotalMap = useMemo(() => {
      const map = new Map<string, number>();
      globalPeriodData?.forEach(t => {
          if (t.type === analysisType) {
              if (analysisType === TransactionType.EXPENSE && t.fundedByResgate) return;
              if (analysisType === TransactionType.INVESTMENT && t.investmentDetails?.event !== 'BUY') return;
              map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
          }
      });
      return map;
  }, [globalPeriodData, analysisType]);

  const groupedDataList = useMemo(() => {
      const map = new Map<string, { total: number, count: number, label: string, secondary: string, categoryId: string }>();
      analysisFilteredData.forEach(t => {
          let key = '', label = '', secondary = '';
          if (groupMode === 'description') {
              if (analysisType === TransactionType.INVESTMENT && t.investmentDetails?.ticker) {
                  key = t.investmentDetails.ticker;
                  label = t.investmentDetails.ticker;
                  secondary = categories?.find(c => c.id === t.categoryId)?.name || 'Outros';
              } else {
                  const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
                  key = normalizeText(cleanDesc);
                  label = cleanDesc; 
                  secondary = categories?.find(c => c.id === t.categoryId)?.name || 'Outros';
              }
          } else if (groupMode === 'category') {
              const cat = categories?.find(c => c.id === t.categoryId);
              key = t.categoryId; 
              label = cat?.name || 'Outros'; 
              secondary = 'Categoria';
          } else {
              if (analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) {
                const sub = subCategories?.find(s => s.id === t.subCategoryId);
                key = t.subCategoryId || 'none'; 
                label = sub?.name || 'Sem Subcategoria'; 
                secondary = categories?.find(c => c.id === t.categoryId)?.name || 'Outros';
              } else {
                 const cat = categories?.find(c => c.id === t.categoryId);
                 key = t.categoryId; 
                 label = cat?.name || 'Outros'; 
                 secondary = 'Categoria (Receita)';
              }
          }
          const current = map.get(key) || { total: 0, count: 0, label, secondary, categoryId: t.categoryId };
          map.set(key, { ...current, total: current.total + t.amount, count: current.count + 1, categoryId: t.categoryId });
      });
      const grandTotal = analysisType === TransactionType.EXPENSE ? globalStats.expense : (analysisType === TransactionType.INVESTMENT ? globalStats.investment : globalStats.income);
      const allItems = Array.from(map.values())
          .map(item => {
              const catTotal = categoryTotalMap.get(item.categoryId) || 0;
              return {
                  ...item,
                  shareOfTotal: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
                  shareOfCategory: catTotal > 0 ? (item.total / catTotal) * 100 : 0
              };
          })
          .sort((a, b) => b.total - a.total);
      const items = allItems.slice(0, 15);
      const hidden = allItems.slice(15);
      // A tabela mostra só os 15 maiores; guardamos quantos ficaram de fora e a soma
      // deles para não deixar o card "Total no Período" (que soma tudo) parecer
      // inconsistente com as linhas visíveis, sem nenhuma explicação.
      return { items, hiddenCount: hidden.length, hiddenTotal: hidden.reduce((acc, i) => acc + i.total, 0) };
  }, [analysisFilteredData, categories, subCategories, groupMode, analysisType, categoryTotalMap, globalStats]);

  const selectionSummary = useMemo(() => {
      const relevantData = analysisFilteredData;
      if (relevantData.length === 0) return null;
      const total = relevantData.reduce((acc, t) => acc + t.amount, 0);
      const count = relevantData.length;
      const avg = total / count;
      const sorted = [...relevantData].sort((a,b) => b.amount - a.amount);
      const max = sorted[0];
      return { total, count, avg, max };
  }, [analysisFilteredData]);

  const distributionData = useMemo(() => {
      const map = new Map<string, {name: string, value: number, id: string}>();
      analysisFilteredData.forEach(t => {
          let label = 'Outros';
          let id = t.categoryId;
          if (distMode === 'category') {
              label = categories?.find(c => c.id === t.categoryId)?.name || 'Outros';
              id = t.categoryId;
          } else {
              if (analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) {
                const sub = subCategories?.find(s => s.id === t.subCategoryId);
                label = sub?.name || 'Sem Subcategoria';
                id = t.subCategoryId || 'none';
              } else {
                label = categories?.find(c => c.id === t.categoryId)?.name || 'Outros';
                id = t.categoryId;
              }
          }
          const current = map.get(id) || { name: label, value: 0, id };
          map.set(id, { ...current, value: current.value + t.amount });
      });
      const result = Array.from(map.values()).sort((a, b) => b.value - a.value);
      return distMode === 'subcategory' && (analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) ? result.slice(0, 10) : result;
  }, [analysisFilteredData, categories, subCategories, distMode, analysisType]);

  const getSubcategoryBreakdown = (categoryId: string) => {
      const map = new Map<string, { id: string, name: string, value: number }>();
      analysisFilteredData.forEach(t => {
          if (t.categoryId === categoryId) {
              const subId = t.subCategoryId || 'none';
              const subName = subCategories.find(s => s.id === t.subCategoryId)?.name || 'Sem Subcategoria';
              const current = map.get(subId) || { id: subId, name: subName, value: 0 };
              map.set(subId, { ...current, value: current.value + t.amount });
          }
      });
      return Array.from(map.values())
          .sort((a, b) => b.value - a.value);
  };

  const detailTransactions = useMemo(() => {
    if (!selectedDetailSlice) return [];
    
    // Identificar se o slice é uma categoria ou subcategoria para o filtro correto
    const isCategory = categories.some(c => c.id === selectedDetailSlice);

    return analysisFilteredData.filter(t => {
        if (isCategory) return t.categoryId === selectedDetailSlice;
        return t.subCategoryId === selectedDetailSlice || (!t.subCategoryId && selectedDetailSlice === 'none');
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [analysisFilteredData, selectedDetailSlice, categories]);

  const visibleDetailList = useMemo(() => {
      if (!groupDetailsByName) return detailTransactions;
      const groups = new Map<string, any>();
      detailTransactions.forEach(t => {
           const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
           const key = normalizeText(cleanDesc);
           if(!groups.has(key)) {
               groups.set(key, { ...t, description: cleanDesc, originalAmount: t.amount, amount: 0, count: 0, dates: [] as string[], originalIds: [] as string[] });
           }
           const g = groups.get(key);
           g.amount += t.amount;
           g.count += 1;
           g.dates.push(t.date);
           g.originalIds.push(t.id);
      });
      return Array.from(groups.values()).sort((a,b) => b.amount - a.amount);
  }, [detailTransactions, groupDetailsByName]);

  const detailSliceName = useMemo(() => {
      if (!selectedDetailSlice) return '';
      const cat = categories.find(c => c.id === selectedDetailSlice);
      if (cat) return cat.name;
      return subCategories.find(s => s.id === selectedDetailSlice)?.name || 'Sem Subcategoria';
  }, [selectedDetailSlice, categories, subCategories]);

  const trajectoryData = useMemo(() => {
      const data: any[] = []; const daily: Record<number, number> = {};
      if (timeRange !== 'month') return [];
      analysisFilteredData.forEach(t => { 
          const day = new Date(t.date).getUTCDate(); 
          daily[day] = (daily[day] || 0) + t.amount; 
      });
      let running = 0; const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) { running += (daily[i] || 0); data.push({ day: i, total: running }); }
      return data;
  }, [analysisFilteredData, timeRange, currentDate]);

  // Salary cycle calculation (Data de corte e ciclo do salário)
  const salaryCycleInfo = useMemo(() => {
    const salaryDay = Math.max(1, Math.min(31, settings.salaryDay || 1));
    const shift = settings.salaryShift ?? (salaryDay >= 20 ? 1 : 0);

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    let cycleStart: Date;
    let cycleEnd: Date;

    if (salaryDay === 1 || (shift === 0 && salaryDay <= 1)) {
      cycleStart = new Date(y, m, 1, 0, 0, 0);
      cycleEnd = new Date(y, m + 1, 0, 23, 59, 59);
    } else if (shift === 1) {
      cycleStart = new Date(y, m - 1, salaryDay, 0, 0, 0);
      cycleEnd = new Date(y, m, salaryDay - 1, 23, 59, 59);
    } else {
      cycleStart = new Date(y, m, salaryDay, 0, 0, 0);
      cycleEnd = new Date(y, m + 1, salaryDay - 1, 23, 59, 59);
    }

    return {
      salaryDay,
      shift,
      cycleStart,
      cycleEnd
    };
  }, [currentDate, settings.salaryDay, settings.salaryShift]);

  const dailyProgressionData = useMemo(() => {
    const { cycleStart, cycleEnd, salaryDay } = salaryCycleInfo;
    const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const days: any[] = [];
    const curr = new Date(cycleStart.getTime());
    let dayIndex = 1;

    // Filter transactions belonging to this accounting cycle by calculateEffectiveDate
    const periodTransactions = (transactions || []).filter(t => {
      const eff = calculateEffectiveDate(t, creditCards, settings);
      if (eff.getFullYear() !== currentDate.getFullYear() || eff.getMonth() !== currentDate.getMonth()) return false;
      if (!includeNathy && isNathyTransaction(t, nathyId)) return false;
      if (!matchesFilters(t)) return false;
      return true;
    });

    // Map transactions by their original calendar date (t.date.slice(0, 10))
    const txByDateStr = new Map<string, Transaction[]>();
    periodTransactions.forEach(t => {
      const dStr = t.date.slice(0, 10);
      if (!txByDateStr.has(dStr)) txByDateStr.set(dStr, []);
      txByDateStr.get(dStr)!.push(t);
    });

    let runningCumulativeExpense = 0;
    let runningCumulativeIncome = 0;
    let peakDailyExpense = 0;
    let peakDateLabel = '';
    let peakItems: any[] = [];
    let totalExpenseSoFar = 0;
    let totalIncomeSoFar = 0;
    let daysPassed = 0;
    let currentCycleDayIndex = 0;

    while (curr <= cycleEnd) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isToday = dateStr === todayStr;
      if (isToday) {
        currentCycleDayIndex = dayIndex;
      }
      const isFuture = excludeFuture && (dateStr > todayStr);

      const txsOnDay = txByDateStr.get(dateStr) || [];
      let dailyExp = 0;
      let dailyInc = 0;
      const items: { description: string; amount: number; category: string; isAdditional?: boolean }[] = [];

      txsOnDay.forEach(t => {
        if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) {
          dailyExp += t.amount;
          const catName = categories.find(c => c.id === t.categoryId)?.name || 'Outros';
          const isAdd = isAdditionalCardTransaction(t, categories);
          items.push({ description: t.description, amount: t.amount, category: catName, isAdditional: isAdd });
        } else if (t.type === TransactionType.INCOME) {
          dailyInc += t.amount;
        }
      });

      items.sort((a, b) => b.amount - a.amount);

      if (!isFuture) {
        runningCumulativeExpense += dailyExp;
        runningCumulativeIncome += dailyInc;
        totalExpenseSoFar = runningCumulativeExpense;
        totalIncomeSoFar = runningCumulativeIncome;
        daysPassed++;

        if (dailyExp > peakDailyExpense) {
          peakDailyExpense = dailyExp;
          peakDateLabel = `${day}/${month}`;
          peakItems = items;
        }
      }

      days.push({
        date: new Date(curr.getTime()),
        dateStr,
        dayIndex,
        label: `${day}/${month} (Dia ${dayIndex})`,
        shortLabel: `${day}/${month}`,
        isToday,
        isFuture,
        dailyExpense: isFuture ? null : dailyExp,
        cumulativeExpense: isFuture ? null : runningCumulativeExpense,
        dailyIncome: isFuture ? null : dailyInc,
        cumulativeIncome: isFuture ? null : runningCumulativeIncome,
        items
      });

      curr.setDate(curr.getDate() + 1);
      dayIndex++;
    }

    const totalCycleDays = days.length;
    const avgDailyExpense = daysPassed > 0 ? (totalExpenseSoFar / daysPassed) : 0;
    const projectedTotal = avgDailyExpense * totalCycleDays;
    
    // Calculate 6-month historical baseline for comparison
    const past6MonthsCycles: { dayExpenses: number[]; totalExpense: number; daysCount: number }[] = [];

    for (let i = 1; i <= 6; i++) {
      const dRef = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const pY = dRef.getFullYear();
      const pM = dRef.getMonth();

      if (settings.historyStartDate) {
        const histStart = new Date(settings.historyStartDate);
        if (new Date(pY, pM + 1, 0) < histStart) {
          continue;
        }
      }

      let pCycleStart: Date;
      let pCycleEnd: Date;

      if (salaryDay === 1 || (salaryCycleInfo.shift === 0 && salaryDay <= 1)) {
        pCycleStart = new Date(pY, pM, 1, 0, 0, 0);
        pCycleEnd = new Date(pY, pM + 1, 0, 23, 59, 59);
      } else if (salaryCycleInfo.shift === 1) {
        pCycleStart = new Date(pY, pM - 1, salaryDay, 0, 0, 0);
        pCycleEnd = new Date(pY, pM, salaryDay - 1, 23, 59, 59);
      } else {
        pCycleStart = new Date(pY, pM, salaryDay, 0, 0, 0);
        pCycleEnd = new Date(pY, pM + 1, salaryDay - 1, 23, 59, 59);
      }

      const pastTx = (transactions || []).filter(t => {
        const eff = calculateEffectiveDate(t, creditCards, settings);
        if (eff.getFullYear() !== pY || eff.getMonth() !== pM) return false;
        if (!includeNathy && isNathyTransaction(t, nathyId)) return false;
        if (!matchesFilters(t)) return false;
        if (t.type !== TransactionType.EXPENSE || t.fundedByResgate) return false;
        return true;
      });

      const txByPastDateStr = new Map<string, number>();
      let pastTotal = 0;
      pastTx.forEach(t => {
        const dStr = t.date.slice(0, 10);
        txByPastDateStr.set(dStr, (txByPastDateStr.get(dStr) || 0) + t.amount);
        pastTotal += t.amount;
      });

      const pCurr = new Date(pCycleStart.getTime());
      let pRunning = 0;
      const pCumulatives: number[] = [];
      while (pCurr <= pCycleEnd) {
        const yStr = pCurr.getFullYear();
        const mStr = String(pCurr.getMonth() + 1).padStart(2, '0');
        const dayStr = String(pCurr.getDate()).padStart(2, '0');
        const dateStr = `${yStr}-${mStr}-${dayStr}`;

        const expOnDay = txByPastDateStr.get(dateStr) || 0;
        pRunning += expOnDay;
        pCumulatives.push(pRunning);

        pCurr.setDate(pCurr.getDate() + 1);
      }

      if (pCumulatives.length > 0) {
        past6MonthsCycles.push({
          dayExpenses: pCumulatives,
          totalExpense: pastTotal,
          daysCount: pCumulatives.length
        });
      }
    }

    const pastCyclesCount = past6MonthsCycles.length;
    const totalPastExpenses = past6MonthsCycles.reduce((acc, c) => acc + c.totalExpense, 0);
    const totalPastDays = past6MonthsCycles.reduce((acc, c) => acc + c.daysCount, 0);
    const avgDailyExpense6M = totalPastDays > 0 ? (totalPastExpenses / totalPastDays) : 0;
    const avgMonthlyExpense6M = pastCyclesCount > 0 ? (totalPastExpenses / pastCyclesCount) : 0;

    // Build day-by-day 6-month average cumulative curve
    const avg6mCumulativeByDayIndex = days.map((_, idx) => {
      if (pastCyclesCount === 0) {
        return Math.round(avgDailyExpense * (idx + 1));
      }
      let sumAtDay = 0;
      past6MonthsCycles.forEach(c => {
        const val = c.dayExpenses[Math.min(idx, c.dayExpenses.length - 1)] ?? c.totalExpense;
        sumAtDay += val;
      });
      return Math.round(sumAtDay / pastCyclesCount);
    });

    // Build chart data
    const chartData = days.map((d, idx) => {
      const media6m = avg6mCumulativeByDayIndex[idx] ?? Math.round(avgDailyExpense6M * (idx + 1));
      return {
        ...d,
        GastoAcumulado: d.isFuture ? null : d.cumulativeExpense,
        GastoDoDia: d.isFuture ? null : d.dailyExpense,
        Media6Meses: media6m
      };
    });

    // Top impact spending days
    const topSpendingDays = [...days]
      .filter(d => !d.isFuture && (d.dailyExpense || 0) > 0)
      .sort((a, b) => (b.dailyExpense || 0) - (a.dailyExpense || 0))
      .slice(0, 5);

    const zeroSpendingDays = days.filter(d => !d.isFuture && (!d.dailyExpense || d.dailyExpense === 0)).length;

    return {
      chartData,
      days,
      totalCycleDays,
      daysPassed,
      currentCycleDayIndex: currentCycleDayIndex || daysPassed,
      totalExpenseSoFar,
      totalIncomeSoFar,
      avgDailyExpense,
      projectedTotal,
      avgDailyExpense6M,
      avgMonthlyExpense6M,
      avg6mCumulativeByDayIndex,
      pastCyclesCount,
      peakDailyExpense,
      peakDateLabel,
      peakItems,
      topSpendingDays,
      zeroSpendingDays,
      cycleStart,
      cycleEnd,
      salaryDay
    };
  }, [salaryCycleInfo, currentDate, transactions, categories, creditCards, settings, filterCategoryIds, filterTag, includeNathy, excludeFuture]);

  const renderCategoryFilterSection = (type: TransactionType) => {
      const cats = categories.filter(c => c.type === type);
      if (cats.length === 0) return null;
      return (
          <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <h4 className={`text-[10px] font-bold uppercase tracking-wider ${type === TransactionType.EXPENSE ? 'text-rose-600' : (type === TransactionType.INVESTMENT ? 'text-blue-600' : 'text-emerald-600')}`}>{type === TransactionType.EXPENSE ? 'Despesas' : (type === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')}</h4>
                  <button onClick={() => selectAllCategories(type)} className="text-[10px] text-zinc-700 dark:text-zinc-300 hover:underline">Inverter Seleção</button>
              </div>
              <div className="flex flex-wrap gap-2">
                  {cats.map(cat => {
                      const isSelected = filterCategoryIds.includes(cat.id);
                      return (
                          <button key={cat.id} onClick={() => toggleCategoryFilter(cat.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950/40'}`}>
                              {isSelected ? <CheckSquare size={12} className="shrink-0" /> : <Square size={12} className="shrink-0" />}
                              <span className="truncate max-w-[120px]">{cat.name}</span>
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  const representativeValue = useMemo(() => {
      if (!isFiltering && !includeNathy) return 0;
      if (globalStats.income === 0) return 0;
      const filteredAmount = analysisType === TransactionType.EXPENSE ? periodStats.expense : (analysisType === TransactionType.INVESTMENT ? periodStats.investment : periodStats.income);
      return Math.min((filteredAmount / globalStats.income) * 100, 100);
  }, [isFiltering, analysisType, periodStats, globalStats, includeNathy]);

  return (
    <div className="space-y-6 animate-in fade-in pb-24">
      {/* HEADER & NAVIGATOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Análise e Insights</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded-xl shrink-0">
              <button onClick={() => setTimeRange('month')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'month' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Mês</button>
              <button onClick={() => setTimeRange('year')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'year' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Ano</button>
              <button onClick={() => setTimeRange('custom')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'custom' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Período</button>
              <button onClick={() => setTimeRange('all')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'all' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Tudo</button>
          </div>

          <div className="flex items-center gap-1">
              {timeRange === 'month' && (
                  <>
                      <button onClick={handlePrevMonth} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"><ChevronLeft size={16}/></button>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-wide min-w-[100px] text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                      <button onClick={handleNextMonth} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"><ChevronRight size={16}/></button>
                  </>
              )}
              {timeRange === 'year' && (
                  <>
                      <button onClick={() => setSelectedYear(y => y - 1)} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"><ChevronLeft size={16}/></button>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 min-w-[60px] text-center text-xs">{selectedYear}</span>
                      <button onClick={() => setSelectedYear(y => y + 1)} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"><ChevronRight size={16}/></button>
                  </>
              )}
              {timeRange === 'custom' && (
                  <div className="flex items-center gap-1.5 px-2">
                      <input type="month" value={customStartMonth} onChange={(e) => setCustomStartMonth(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-850 dark:text-zinc-200 outline-none w-24 text-center" />
                      <span className="text-zinc-450 text-[10px]">até</span>
                      <input type="month" value={customEndMonth} onChange={(e) => setCustomEndMonth(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-850 dark:text-zinc-200 outline-none w-24 text-center" />
                  </div>
              )}
              {timeRange === 'all' && (
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-wide px-3">Todo Período</span>
              )}
          </div>
        </div>
      </div>

      {/* CONTROL & FILTER ACTION DECK */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-4 shadow-sm">
          <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full shrink-0">
               <button onClick={() => setAnalysisType(TransactionType.EXPENSE)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.EXPENSE ? 'bg-white dark:bg-zinc-900 shadow text-rose-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Despesas</button>
               <button onClick={() => setAnalysisType(TransactionType.INCOME)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.INCOME ? 'bg-white dark:bg-zinc-900 shadow text-emerald-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Receitas</button>
               <button onClick={() => setAnalysisType(TransactionType.INVESTMENT)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.INVESTMENT ? 'bg-white dark:bg-zinc-900 shadow text-blue-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Investimentos</button>
          </div>

          <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setExcludeFuture(!excludeFuture)} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-bold whitespace-nowrap transition-all ${!excludeFuture ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-350 dark:border-amber-900 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                title="Incluir ou não despesas e receitas futuras na sua análise."
              >
                  <Calendar size={14} /> {excludeFuture ? 'Incluir Futuros' : 'Ocultar Futuros'}
              </button>
              <button 
                onClick={() => setIncludeNathy(!includeNathy)} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-bold whitespace-nowrap transition-all ${includeNathy ? 'bg-pink-50/10 dark:bg-pink-950/20 border-pink-200/40 dark:border-pink-900/30 text-pink-700 dark:text-pink-400' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                title="Mostrar gastos da Nathy e partes divididas que normalmente são excluídas da sua análise pessoal."
              >
                  <Users size={14} /> {includeNathy ? 'Ocultar Nathy' : 'Incluir Nathy'}
              </button>
              <button 
                onClick={() => setIsFilterVisible(!isFilterVisible)} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-bold whitespace-nowrap transition-all ${isFilterVisible || filterTag || filterCategoryIds.length > 0 ? 'bg-zinc-100 dark:bg-zinc-850 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
              >
                  <Filter size={14} /> Filtros Avançados
              </button>
          </div>
      </div>

      {/* KPI CARDS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Receitas Totais" 
          value={periodStats.income} 
          icon={TrendingUp} 
          color="emerald" 
        />
        <KPICard 
          title="Custo de Vida" 
          value={periodStats.expense} 
          icon={TrendingDown} 
          color="rose" 
        />
        <KPICard 
          title="Saldo Líquido" 
          value={periodStats.income - periodStats.expense} 
          icon={Wallet} 
          color={(periodStats.income - periodStats.expense) >= 0 ? "indigo" : "rose"} 
        />
        <KPICard 
          title="Taxa de Poupança" 
          value={periodStats.savingsRate} 
          icon={Percent} 
          color="violet" 
          isPercentage={true}
        />
      </div>

      {isFilterVisible && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2"><Filter size={18} className="text-zinc-700 dark:text-zinc-300" /> Configurar Filtros</h3>
                  {(filterCategoryIds.length > 0 || filterTag) && (
                      <button onClick={() => { setFilterCategoryIds([]); setFilterTag(''); }} className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"><X size={14} /> Limpar Tudo</button>
                  )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-2"><Search size={14}/> Buscar Tag ou Texto</label>
                      <div className="relative">
                          <input type="text" value={filterTag} onChange={e => setFilterTag(e.target.value)} placeholder="Ex: Uber, iFood, #ferias..." className="w-full pl-4 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          {filterTag && <button onClick={() => setFilterTag('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 hover:text-rose-500"><X size={16}/></button>}
                      </div>
                  </div>
                  <div className="space-y-4 md:col-span-2 bg-zinc-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-2"><PieIcon size={14}/> Filtrar por Categorias</label>
                          <div className="flex gap-2">
                              <button onClick={() => setFilterCategoryIds(categories.map(c => c.id))} className="text-[10px] text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1 rounded shadow-sm hover:bg-zinc-50 dark:bg-zinc-950/40">Marcar Todas</button>
                              <button onClick={clearCategoryFilters} className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1 rounded shadow-sm hover:bg-zinc-50 dark:bg-zinc-950/40">Desmarcar Todas</button>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                          {renderCategoryFilterSection(TransactionType.EXPENSE)}
                          {renderCategoryFilterSection(TransactionType.INCOME)}
                          {renderCategoryFilterSection(TransactionType.INVESTMENT)}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm w-fit max-w-full overflow-x-auto custom-scrollbar">
          {[{ id: 'overview', label: 'Resumo e Agrupamentos', icon: Activity }, { id: 'categories', label: 'Distribuição', icon: PieIcon }, { id: 'trends', label: 'Caminhada Diária (Dia a Dia)', icon: TrendingUp }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center whitespace-nowrap gap-2 px-6 py-2 text-sm font-bold rounded-full transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><tab.icon size={16} /> {tab.label}</button>
          ))}
      </div>

      {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 sm:p-5 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex justify-between items-center flex-wrap gap-2">
                      <div><h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-tight"><List size={18} className="text-zinc-500 dark:text-zinc-400" /> {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} Agrupados</h3></div>
                      <div className="flex bg-zinc-100 dark:bg-zinc-850 p-1 rounded-full border border-zinc-200/40 dark:border-zinc-800/40">
                          <button onClick={() => setGroupMode('description')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'description' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>{analysisType === TransactionType.INVESTMENT ? 'Ativo/Descrição' : 'Descrição'}</button>
                          <button onClick={() => setGroupMode('category')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'category' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Categoria</button>
                          {(analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) && (
                             <button onClick={() => setGroupMode('subcategory')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'subcategory' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Subcategoria</button>
                          )}
                      </div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead className="bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px]">
                              <tr>
                                  <th className="px-6 py-3 text-left">Item</th>
                                  <th className="px-6 py-3 text-left">Referência</th>
                                  <th className="px-6 py-3 text-center">Freq.</th>
                                  <th className="px-6 py-3 text-left w-24">% Global</th>
                                  <th className="px-6 py-3 text-left w-24">% Categ.</th>
                                  <th className="px-6 py-3 text-right">Total Acumulado</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                              {groupedDataList?.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50 dark:bg-zinc-950/40 transition-colors group">
                                      <td className="px-6 py-4 font-semibold text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate" title={item.label}>{item.label}</td>
                                      <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400 max-w-[150px] truncate" title={item.secondary}>{item.secondary}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.count}x</span>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex flex-col gap-1 w-full">
                                              <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{item.shareOfTotal.toFixed(1)}%</span>
                                              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.shareOfTotal}%` }}></div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          {groupMode !== 'category' ? (
                                              <div className="flex flex-col gap-1 w-full">
                                                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{item.shareOfCategory.toFixed(1)}%</span>
                                                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.shareOfCategory}%` }}></div>
                                                  </div>
                                              </div>
                                          ) : (
                                              <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">-</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(item.total)}</td>
                                  </tr>
                              ))}
                              {groupedDataList && groupedDataList.hiddenCount > 0 && (
                                  <tr className="bg-zinc-50/60 dark:bg-zinc-950/30">
                                      <td colSpan={5} className="px-6 py-3 text-xs text-zinc-500 dark:text-zinc-400 italic">+ {groupedDataList.hiddenCount} outros itens não exibidos (fora do Top 15)</td>
                                      <td className="px-6 py-3 text-right font-bold text-zinc-600 dark:text-zinc-400">{formatCurrency(groupedDataList.hiddenTotal)}</td>
                                  </tr>
                              )}
                              {(!groupedDataList || groupedDataList.items.length === 0) && (<tr><td colSpan={6} className="p-12 text-center text-zinc-500 dark:text-zinc-400">Nenhum dado encontrado para o período.</td></tr>)}
                          </tbody>
                      </table>
                  </div>
                  {selectionSummary && (
                      <div className="bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2">
                          <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1"><Calculator size={10}/> Total no Período</span>
                              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(selectionSummary.total)}</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1"><Percent size={10}/> Média por Lançamento</span>
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(selectionSummary.avg)}</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1"><Hash size={10}/> Quantidade</span>
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{selectionSummary.count} itens</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1"><Maximize size={10}/> Maior Lançamento</span>
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(selectionSummary.max.amount)}</span>
                              <span className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate max-w-[100px]" title={selectionSummary.max.description}>{selectionSummary.max.description}</span>
                          </div>
                      </div>
                  )}
              </div>
              <div className="space-y-6">
                  {timeRange === 'month' && (
                      <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm h-[300px] flex flex-col">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wider"><TrendingUp size={16} className="text-zinc-500 dark:text-zinc-400"/> {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} Acumulados</h3>
                          <div className="flex-1 min-h-0">
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={trajectoryData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-150 dark:text-zinc-800/60" />
                                      <XAxis dataKey="day" stroke="currentColor" className="text-zinc-400 dark:text-zinc-500 font-semibold" fontSize={10} tickLine={false} />
                                      <YAxis stroke="currentColor" className="text-zinc-400 dark:text-zinc-500 font-semibold" fontSize={10} tickLine={false} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Area type="monotone" dataKey="total" name="Acumulado" stroke={analysisType === TransactionType.EXPENSE ? "#f43f5e" : (analysisType === TransactionType.INVESTMENT ? "#3b82f6" : "#10b981")} fill={analysisType === TransactionType.EXPENSE ? "#f43f5e15" : (analysisType === TransactionType.INVESTMENT ? "#3b82f615" : "#10b98115")} strokeWidth={3} />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  )}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[300px]">
                      {isFiltering || includeNathy ? (
                          <>
                              <Percent className="absolute -right-4 -bottom-4 w-32 h-32 text-zinc-100 dark:text-zinc-800/20 pointer-events-none" />
                              <div className="relative z-10">
                                  <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-400 uppercase tracking-wider mb-2">Representatividade</h3>
                                  <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-6 leading-relaxed">
                                      {analysisType === TransactionType.EXPENSE 
                                          ? "Estes gastos representam" 
                                          : (analysisType === TransactionType.INVESTMENT ? "Estes investimentos representam" : "Estas receitas representam")}
                                      <strong className="block text-zinc-900 dark:text-zinc-100 text-base font-semibold mt-1">da sua Renda Total do período.</strong>
                                  </p>
                                  <div className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none mb-4">{representativeValue.toFixed(1)}%</div>
                                  <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                      <div className={`h-full rounded-full transition-all duration-1000 ${analysisType === TransactionType.EXPENSE ? 'bg-rose-500' : (analysisType === TransactionType.INVESTMENT ? 'bg-blue-500' : 'bg-emerald-500')}`} style={{width: `${Math.min(representativeValue, 100)}%`}}></div>
                                  </div>
                                  <p className="text-[10px] mt-4 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold">Base: R$ {formatCurrency(globalStats.income)}</p>
                              </div>
                          </>
                      ) : (
                          <>
                              <ShieldCheck className="absolute -right-4 -bottom-4 w-32 h-32 text-zinc-100 dark:text-zinc-800/20 pointer-events-none" />
                              <div className="relative z-10">
                                  <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-400 uppercase tracking-wider mb-2">Resumo da Meta</h3>
                                  {analysisType === TransactionType.INVESTMENT ? (() => {
                                      const budgetPct = settings.monthlyBudgetPercentage || 80;
                                      const savingsTargetPct = 100 - budgetPct;
                                      const targetSavings = globalStats.income * (savingsTargetPct / 100);
                                      const investmentPercent = targetSavings > 0 ? (periodStats.myInvestmentFromPocket / targetSavings) * 100 : 0;
                                      return (
                                          <>
                                              <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-6 leading-relaxed">Neste período, você atingiu da sua meta de investimentos:</p>
                                              <div className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none mb-4">{investmentPercent.toFixed(1)}%</div>
                                              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3">
                                                  <div className="h-full bg-violet-500 rounded-full transition-all duration-1000" style={{width: `${Math.min(investmentPercent, 100)}%`}}></div>
                                              </div>
                                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold mb-4">Meta: R$ {formatCurrency(targetSavings)}</p>
                                              {periodStats.myReinvested > 0 && (
                                                  <p className="text-[11px] text-violet-600 dark:text-violet-400 font-bold flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 rounded-lg border border-violet-100 dark:border-violet-900/30">
                                                      + R$ {formatCurrency(periodStats.myReinvested)} reinvestidos da renda passiva
                                                  </p>
                                              )}
                                              {periodStats.startingPool > 0 && (
                                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 mt-2">
                                                      Saldo inicial de proventos: R$ {formatCurrency(periodStats.startingPool)}
                                                  </p>
                                              )}
                                              {periodStats.endingPool > 0 && (
                                                  <p className="text-[11px] text-zinc-650 dark:text-zinc-400 font-medium italic mt-2 text-center">
                                                      Saldo final de proventos: R$ {formatCurrency(periodStats.endingPool)}
                                                  </p>
                                              )}
                                          </>
                                      );
                                  })() : (
                                      <>
                                          <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-6 leading-relaxed">Neste período, sua taxa de economia média é de:</p>
                                          <div className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none mb-4">{periodStats.savingsRate.toFixed(1)}%</div>
                                          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{width: `${Math.min(periodStats.savingsRate, 100)}%`}}></div>
                                          </div>
                                      </>
                                  )}
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'categories' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm h-[450px] flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-tight"><PieIcon size={18} className="text-zinc-500 dark:text-zinc-400" /> Distribuição de {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} {distMode === 'subcategory' && '(Top 10)'}</h3>
                          <div className="flex bg-zinc-100 dark:bg-zinc-850 p-1 rounded-full border border-zinc-200/40 dark:border-zinc-800/40">
                              <button onClick={() => { setDistMode('category'); setSelectedDetailSlice(null); }} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${distMode === 'category' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'}`}>Categorias</button>
                              {(analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) && (
                                <button onClick={() => { setDistMode('subcategory'); setSelectedDetailSlice(null); }} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${distMode === 'subcategory' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'}`}>Subcategorias</button>
                              )}
                          </div>
                      </div>
                      <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie 
                                    data={distributionData} cx="50%" cy="50%" innerRadius={80} outerRadius={130} dataKey="value" paddingAngle={4}
                                    onClick={(data: any) => {
                                        if(distMode === 'category') {
                                            setExpandedCategory(expandedCategory === data.id ? null : data.id);
                                        }
                                        setSelectedDetailSlice(data.id);
                                    }}
                                    className="cursor-pointer"
                                  >
                                      {distributionData?.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip content={<CustomTooltip />} />
                                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                      <p className="text-[10px] text-center text-zinc-450 dark:text-zinc-500 mt-2 italic">Dica: Clique em uma fatia para ver os lançamentos detalhados abaixo.</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30"><h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Ranking Detalhado</h3></div>
                      <div className="overflow-y-auto flex-1 custom-scrollbar max-h-[400px]">
                          {distributionData?.map((item, idx) => {
                              const isExpanded = expandedCategory === item.id && distMode === 'category';
                              const subData = isExpanded ? getSubcategoryBreakdown(item.id) : [];
                              return (
                                <React.Fragment key={idx}>
                                    <div className={`w-full flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:bg-zinc-950/40 transition-colors cursor-pointer ${selectedDetailSlice === item.id ? 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800' : ''}`}
                                         onClick={() => {
                                             if (distMode === 'category') setExpandedCategory(expandedCategory === item.id ? null : item.id);
                                             setSelectedDetailSlice(item.id);
                                         }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">{item.name}</span>
                                            {distMode === 'category' && (isExpanded ? <ChevronUp size={12} className="text-zinc-500 dark:text-zinc-400"/> : <ChevronDown size={12} className="text-zinc-500 dark:text-zinc-400"/>)}
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(item.value)}</span>
                                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">{((item.value / (analysisType === TransactionType.EXPENSE ? periodStats.expense : (analysisType === TransactionType.INVESTMENT ? periodStats.investment : periodStats.income))) * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-top-2">
                                            {subData.map((sub, sIdx) => (
                                                <div 
                                                    key={sIdx} 
                                                    className={`flex justify-between items-center py-2 px-4 pl-10 text-xs text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:bg-zinc-950/40 cursor-pointer transition-colors ${selectedDetailSlice === sub.id ? 'bg-zinc-50 dark:bg-zinc-950/40' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDetailSlice(sub.id);
                                                    }}
                                                >
                                                    <span className="font-medium truncate max-w-[120px]">{sub.name}</span>
                                                    <div className="text-right">
                                                        <span className="block font-medium">{formatCurrency(sub.value)}</span>
                                                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400">{(sub.value / item.value * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => setSelectedDetailSlice(item.id)}
                                                className="w-full text-center py-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950/40 uppercase tracking-wider flex items-center justify-center gap-1"
                                            >
                                                <List size={10} /> Ver Tudo da Categoria
                                            </button>
                                        </div>
                                    )}
                                </React.Fragment>
                              );
                          })}
                      </div>
                  </div>
              </div>

              {selectedDetailSlice && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg overflow-hidden animate-in slide-in-from-top-4">
                      <div className={`p-4 ${analysisType === TransactionType.EXPENSE ? 'bg-rose-600 dark:bg-rose-700' : (analysisType === TransactionType.INVESTMENT ? 'bg-blue-600 dark:bg-blue-700' : 'bg-emerald-600 dark:bg-emerald-700')} text-white flex justify-between items-center`}>
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-white/20 rounded-lg"><List size={18}/></div>
                              <div>
                                  <h3 className="text-sm font-bold uppercase tracking-widest">Lançamentos em: {detailSliceName}</h3>
                                  <p className="text-[10px] text-white/90">Exibindo todos os {analysisType === TransactionType.EXPENSE ? 'gastos' : (analysisType === TransactionType.INVESTMENT ? 'investimentos' : 'ganhos')} no período analisado.</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <button onClick={() => setGroupDetailsByName(!groupDetailsByName)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${groupDetailsByName ? 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-white' : 'bg-white/20 text-white border-white/20 hover:bg-white/30'}`}>
                                  <Merge size={12} /> {groupDetailsByName ? 'Agrupado por Nome' : 'Agrupar Similares'}
                              </button>
                              <button onClick={() => setSelectedDetailSlice(null)} className="p-2 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors"><X size={20}/></button>
                          </div>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                              <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px]">
                                  <tr>
                                      <th className="px-6 py-3 text-left">{groupDetailsByName ? 'Data / Frequência' : 'Data'}</th>
                                      <th className="px-6 py-3 text-left">Descrição</th>
                                      <th className="px-6 py-3 text-left">Forma Pgto.</th>
                                      <th className="px-6 py-3 text-right">Valor</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                  {visibleDetailList.map((t: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-zinc-50 dark:bg-zinc-950/40 transition-colors">
                                          <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                                              {groupDetailsByName && t.count > 1 ? (
                                                  <span className="font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/40 px-2 py-1 rounded-md">{t.count} ocorrências</span>
                                              ) : (
                                                  (() => {
                                                      const raw = t.date || t.dates?.[0];
                                                      if (!raw) return '--/--/----';
                                                      const d = new Date(raw);
                                                      if (isNaN(d.getTime())) return String(raw);
                                                      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                                  })()
                                              )}
                                          </td>
                                          <td className="px-6 py-4">
                                              <div className="font-bold text-zinc-800 dark:text-zinc-200">{t.description}</div>
                                              <div className="flex gap-1 mt-1">
                                                  {t.isFixed && <span className="text-[8px] bg-amber-100 text-amber-600 px-1 rounded font-bold">FIXA</span>}
                                                  {t.totalInstallments && t.totalInstallments > 1 && <span className="text-[8px] bg-purple-100 text-purple-600 px-1 rounded font-bold">PARCELADO</span>}
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                                              {groupDetailsByName && t.count > 1 ? 'Diversos' : (
                                                  <>
                                                    {t.paymentMethod === PaymentMethod.CREDIT_CARD ? 'Cartão de Crédito' : 'Débito/Dinheiro'}
                                                    {t.creditCardId && <span className="block opacity-50 text-[9px]">{creditCards.find(c => c.id === t.creditCardId)?.name}</span>}
                                                  </>
                                              )}
                                          </td>
                                          <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(t.amount)}</td>
                                      </tr>
                                  ))}
                                  {visibleDetailList.length === 0 && (
                                      <tr><td colSpan={4} className="p-8 text-center text-zinc-500 dark:text-zinc-400">Nenhum lançamento encontrado.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 text-right">
                          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-2 uppercase">Total da Seleção:</span>
                          <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{formatCurrency(visibleDetailList.reduce((acc: number, curr: any) => acc + curr.amount, 0))}</span>
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'trends' && (
          <div className="space-y-6">
              {/* Top Banner with Cycle Context & Metrics */}
              <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-rose-500/10 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-rose-950/30 border border-blue-200/60 dark:border-blue-800/60 p-6 rounded-2xl md:rounded-3xl shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[11px] uppercase tracking-wider">
                                Ciclo Salarial (Corte: Dia {dailyProgressionData.salaryDay})
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                                {dailyProgressionData.cycleStart.toLocaleDateString('pt-BR')} até {dailyProgressionData.cycleEnd.toLocaleDateString('pt-BR')}
                              </span>
                          </div>
                          <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                              <TrendingUp className="text-blue-600 dark:text-blue-400" size={22} />
                              Caminhada Diária das Despesas
                          </h2>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
                              Acompanhe a curva de gastos dia a dia desde o recebimento do salário até o fechamento do ciclo, identificando picos de consumo e o ritmo médio diário.
                          </p>
                      </div>

                      {/* Progress in cycle */}
                      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 rounded-2xl shadow-sm flex flex-col justify-center min-w-[200px]">
                          <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                              <span>Progresso do Ciclo</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                Dia {dailyProgressionData.currentCycleDayIndex} de {dailyProgressionData.totalCycleDays} ({Math.min(100, Math.round((dailyProgressionData.currentCycleDayIndex / dailyProgressionData.totalCycleDays) * 100))}%)
                              </span>
                          </div>
                          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded-full transition-all" 
                                style={{ width: `${Math.min(100, (dailyProgressionData.currentCycleDayIndex / dailyProgressionData.totalCycleDays) * 100)}%` }}
                              />
                          </div>
                      </div>
                  </div>
              </div>

              {/* Cycle KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase text-zinc-400">Total Gasto no Ciclo</span>
                          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                              <ArrowDown size={16} />
                          </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(dailyProgressionData.totalExpenseSoFar)}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-2">
                          Acumulado até o dia atual ({dailyProgressionData.daysPassed} dias passados)
                      </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase text-zinc-400">Média Diária Atual</span>
                          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                              <Activity size={16} />
                          </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(dailyProgressionData.avgDailyExpense)}
                          <span className="text-xs font-bold text-zinc-400 font-normal"> / dia</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-2 flex items-center gap-1">
                          <span>Média 6M: {formatCurrency(dailyProgressionData.avgDailyExpense6M)}/dia</span>
                          {dailyProgressionData.avgDailyExpense6M > 0 && (
                              <span className={`font-bold ${dailyProgressionData.avgDailyExpense > dailyProgressionData.avgDailyExpense6M ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  ({dailyProgressionData.avgDailyExpense >= dailyProgressionData.avgDailyExpense6M ? '+' : ''}{(((dailyProgressionData.avgDailyExpense - dailyProgressionData.avgDailyExpense6M) / dailyProgressionData.avgDailyExpense6M) * 100).toFixed(0)}%)
                              </span>
                          )}
                      </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase text-zinc-400">Média Mensal (6 Meses)</span>
                          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                              <Sparkles size={16} />
                          </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-purple-600 dark:text-purple-400">
                          {formatCurrency(dailyProgressionData.avgMonthlyExpense6M)}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-2">
                          Referência histórica ({dailyProgressionData.pastCyclesCount} meses analisados)
                      </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase text-zinc-400">Pico de Gasto Diário</span>
                          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                              <Flame size={16} />
                          </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400">
                          {formatCurrency(dailyProgressionData.peakDailyExpense)}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-2">
                          {dailyProgressionData.peakDateLabel ? `Ocorrido em ${dailyProgressionData.peakDateLabel}` : 'Nenhum gasto registrado'}
                      </div>
                  </div>
              </div>

              {/* Main Daily Progression Chart */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm h-[460px] flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                      <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-tight">
                              <Activity size={18} className="text-blue-600 dark:text-blue-400"/> 
                              Trajetória e Volume de Gastos Dia a Dia
                          </h3>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              Área azul: Caminhada acumulada • Barras vermelhas: Despesas do dia • Linha tracejada: Média diária dos últimos 6 meses
                          </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 flex-wrap">
                          <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                              <span>Acumulado</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-rose-500"></span>
                              <span>Gasto do Dia</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                              <span className="w-4 h-0.5 border-b-2 border-dashed border-purple-500"></span>
                              <span className="text-purple-600 dark:text-purple-400">Média 6 Meses</span>
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={dailyProgressionData.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="colorGastoAcumulado" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800/60" />
                              <XAxis dataKey="shortLabel" stroke="currentColor" className="text-zinc-400 dark:text-zinc-500 font-semibold" fontSize={10} tickLine={false} />
                              <YAxis stroke="currentColor" className="text-zinc-400 dark:text-zinc-500 font-semibold" fontSize={10} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                              <Tooltip content={<DailyProgressionTooltip />} />
                              <Bar dataKey="GastoDoDia" name="Gasto do Dia" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} />
                              <Area type="monotone" dataKey="GastoAcumulado" name="Acumulado" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorGastoAcumulado)" dot={{ r: 3, fill: '#2563eb', strokeWidth: 1 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="Media6Meses" name="Média 6 Meses" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 5 }} />
                          </ComposedChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Peak Spending Days & Details Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Top Spending Days List */}
                  <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-5 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <Flame size={18} className="text-rose-500" />
                              Dias de Maior Impacto no Ciclo (Top Picos)
                          </h3>
                          <span className="text-[11px] font-bold text-zinc-400 uppercase">Maiores saídas diárias</span>
                      </div>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {dailyProgressionData.topSpendingDays.length === 0 ? (
                              <div className="p-8 text-center text-sm text-zinc-400 font-semibold">
                                  Nenhum gasto registrado neste ciclo.
                              </div>
                          ) : (
                              dailyProgressionData.topSpendingDays.map((dayItem: any, idx: number) => (
                                  <div key={idx} className="p-4 sm:p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/30 transition-colors">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2">
                                              <span className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                                                  #{idx + 1}
                                              </span>
                                              <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                                                  {dayItem.label}
                                              </span>
                                              <span className="text-xs text-zinc-400 font-semibold">
                                                  ({dayItem.items?.length || 0} compras)
                                              </span>
                                          </div>
                                          <div className="text-right">
                                              <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
                                                  {formatCurrency(dayItem.dailyExpense)}
                                              </span>
                                          </div>
                                      </div>

                                      {/* Top purchases on this peak day */}
                                      {dayItem.items && dayItem.items.length > 0 && (
                                          <div className="mt-2.5 space-y-1.5 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-150 dark:border-zinc-850">
                                              {dayItem.items.slice(0, 3).map((item: any, iIdx: number) => (
                                                  <div key={iIdx} className="flex items-center justify-between text-xs gap-3">
                                                      <span className="truncate text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5" title={item.description}>
                                                          <span className="truncate">{item.description}</span>
                                                          <span className="text-[10px] text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold shrink-0">{item.category}</span>
                                                          {item.isAdditional && (
                                                              <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[9px] font-black shrink-0">Cartão Adicional</span>
                                                          )}
                                                      </span>
                                                      <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                                                          {formatCurrency(item.amount)}
                                                      </span>
                                                  </div>
                                              ))}
                                              {dayItem.items.length > 3 && (
                                                  <div className="text-[10px] text-zinc-400 font-bold pt-1 text-right">
                                                      + {dayItem.items.length - 3} outros lançamentos neste dia
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              ))
                          )}
                      </div>
                  </div>

                  {/* Cycle Insights Summary Card */}
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm p-6 flex flex-col justify-between space-y-6">
                      <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                              <Sparkles size={18} className="text-indigo-500" />
                              Diagnóstico da Caminhada
                          </h3>
                          
                          <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-300">
                              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                      <TrendingUp size={14} className="text-purple-500" /> Comparativo vs. Média de 6 Meses
                                  </div>
                                  <p>
                                      {dailyProgressionData.pastCyclesCount > 0 ? (
                                          dailyProgressionData.totalExpenseSoFar > (dailyProgressionData.avg6mCumulativeByDayIndex?.[dailyProgressionData.daysPassed - 1] ?? (dailyProgressionData.avgDailyExpense6M * dailyProgressionData.daysPassed)) ? (
                                              <>
                                                  Seu gasto acumulado até hoje está <strong className="text-rose-600 dark:text-rose-400">acima</strong> da sua trajetória média histórica dos últimos 6 meses ({formatCurrency(dailyProgressionData.avgMonthlyExpense6M)}/mês).
                                              </>
                                          ) : (
                                              <>
                                                  Seu gasto acumulado até hoje está <strong className="text-emerald-600 dark:text-emerald-400">abaixo ou no ritmo esperado</strong> da sua trajetória média histórica de 6 meses ({formatCurrency(dailyProgressionData.avgMonthlyExpense6M)}/mês).
                                              </>
                                          )
                                      ) : (
                                          <>
                                              Acumulando histórico para traçar médias consolidadas de 6 meses.
                                          </>
                                      )}
                                  </p>
                              </div>

                              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                      <Clock size={14} className="text-blue-500" /> Dias com Zero Despesa
                                  </div>
                                  <p>
                                      Houve <strong>{dailyProgressionData.zeroSpendingDays} dias</strong> sem nenhuma despesa registrada até o momento no ciclo.
                                  </p>
                              </div>

                              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                      <Calendar size={14} className="text-amber-500" /> Regra do Ciclo Salarial
                                  </div>
                                  <p>
                                      O ciclo inicia no dia <strong>{dailyProgressionData.salaryDay}</strong> e encerra na véspera do próximo pagamento ({dailyProgressionData.salaryDay - 1 === 0 ? 'último dia do mês' : `dia ${dailyProgressionData.salaryDay - 1}`}).
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-between items-center text-xs font-bold text-zinc-500 dark:text-zinc-400">
                          <span>Status do Ciclo:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                              <Check size={14} /> Monitoramento Ativo
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
