
import React, { useMemo, useState } from 'react';
import { Transaction, Category, SubCategory, TransactionType, UserSettings, CreditCard, PaymentMethod } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, ComposedChart, Line, LineChart
} from 'recharts';
import { TrendingUp, Calendar, Target, PieChart as PieIcon, Activity, ArrowUp, ArrowDown, Wallet, ShieldCheck, AlertTriangle, List, ChevronLeft, ChevronRight, Filter, Search, X, Check, Layers, ArrowRight, Utensils, Car, Home, Gamepad, User, Dog, Banknote, Circle, ShoppingBag, Coffee, Smartphone, Hammer, Plane, Music, Gift, Wifi, Zap, Book, Briefcase, Shirt, CheckSquare, Square, Percent, ChevronDown, ChevronUp, Merge, Calculator, Hash, Maximize, Minimize, Map as MapIcon, Users } from 'lucide-react';

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

const formatPercent = (val: number) => 
  `${val.toFixed(1)}%`;

const normalizeText = (text: string) => 
  text.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

const IconRenderer = ({ iconName, className }: { iconName: string; className?: string }) => {
  const icons: any = { utensils: Utensils, car: Car, home: Home, gamepad: Gamepad, activity: Activity, user: User, dog: Dog, banknote: Banknote, 'trending-up': TrendingUp, circle: Circle, 'shopping-bag': ShoppingBag, coffee: Coffee, smartphone: Smartphone, hammer: Hammer, plane: Plane, music: Music, gift: Gift, wifi: Wifi, zap: Zap, book: Book, briefcase: Briefcase, shirt: Shirt, users: Users };
  const IconComponent = icons[iconName] || Circle;
  return <IconComponent className={className} />;
};

function calculateEffectiveDate(t: Transaction, creditCards: CreditCard[] = [], settings: UserSettings): Date {
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
        const card = creditCards?.find(c => c.id === t.creditCardId);
        if (card && dayOfMonth > card.closingDay) comparisonDate.setMonth(comparisonDate.getMonth() + 1);
    } else {
        const salaryDay = settings.salaryDay || 1;
        const shift = settings.salaryShift ?? (salaryDay >= 20 ? 1 : 0);
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

export const Analytics: React.FC<AnalyticsProps> = ({ 
  transactions = [], 
  categories = [], 
  subCategories = [], 
  creditCards = [], 
  currentDate, 
  settings,
  onDateChange
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'trends' | 'annual'>('overview');
  
  // Time Range States
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'custom' | 'all'>('month');
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [customStartMonth, setCustomStartMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [customEndMonth, setCustomEndMonth] = useState(new Date().toISOString().slice(0, 7));

  const [distMode, setDistMode] = useState<'category' | 'subcategory'>('category');
  const [groupMode, setGroupMode] = useState<'description' | 'category' | 'subcategory'>('description');
  
  // Nathy / Shared visibility state
  const [includeNathy, setIncludeNathy] = useState(false);
  
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
  const isNathyTransaction = (t: Transaction, nathyId?: string) => {
      const isNathyCat = nathyId && t.categoryId === nathyId;
      const isNathyDesc = t.description.toLowerCase().includes('(parte nathy)');
      return isNathyCat || isNathyDesc;
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
    return transactions?.filter(t => {
      // Exclusion Logic (Nathy/Shared)
      if (!includeNathy && isNathyTransaction(t, nathyId)) return false;
      
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
  }, [transactions, categories, timeRange, currentDate, selectedYear, customStartMonth, customEndMonth, creditCards, settings, includeNathy]);

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

      const sortedTransactions = [...(transactions || [])]
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

          if (settings.resgatesResetMonth && monthKey === settings.resgatesResetMonth) {
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
              const tIso = `${year}-${String(month + 1).padStart(2, '0')}`; 
              isTarget = (tIso >= customStartMonth && tIso <= customEndMonth);
              isBefore = (tIso < customStartMonth);
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

          if (remainingInvested > 0) {
              aporteNovo = Math.min(remainingInvested, Math.max(0, activePool));
              activePool -= aporteNovo;
              remainingInvested -= aporteNovo;

              reinvestedProventos = Math.min(remainingInvested, Math.max(0, proventosPool));
              proventosPool -= reinvestedProventos;
              remainingInvested -= reinvestedProventos;

              reinvestedResgates = Math.min(remainingInvested, Math.max(0, resgatesPool));
              resgatesPool -= reinvestedResgates;
              remainingInvested -= reinvestedResgates;

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
  }, [transactions, timeRange, currentDate, selectedYear, customStartMonth, customEndMonth, creditCards, settings, includeNathy, categories]);

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
      return Array.from(map.values())
          .map(item => {
              const catTotal = categoryTotalMap.get(item.categoryId) || 0;
              return {
                  ...item,
                  shareOfTotal: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
                  shareOfCategory: catTotal > 0 ? (item.total / catTotal) * 100 : 0
              };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 15);
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

  const trendsHistoryData = useMemo(() => {
    const data = [];
    const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
    
    let monthsToLookBack = 11;
    if (settings.historyStartDate) {
        const startDate = new Date(settings.historyStartDate);
        const today = new Date();
        const diffMonths = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
        monthsToLookBack = Math.max(0, diffMonths);
    }

    for (let i = monthsToLookBack; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); 
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      let inc = 0, exp = 0;
      transactions.forEach(t => {
        const effDate = calculateEffectiveDate(t, creditCards, settings);
        if (effDate.getMonth() === d.getMonth() && effDate.getFullYear() === d.getFullYear()) {
          if (!includeNathy && isNathyTransaction(t, nathyId)) return;
          if (!matchesFilters(t)) return;
          if (t.type === TransactionType.INCOME) inc += t.amount;
          else if (t.type === TransactionType.INVESTMENT) {
              const event = t.investmentDetails?.event;
              if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO', 'AMORTIZACAO', 'SELL'].includes(event || '')) {
                  inc += t.amount;
              }
          }
          else if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) exp += t.amount;
        }
      });
      data.push({ name: label, Receita: inc, Despesa: exp });
    }
    return data;
  }, [transactions, categories, creditCards, settings, filterCategoryIds, filterTag, includeNathy]);

  const categoryEvolutionData = useMemo(() => {
      const data: any[] = [];
      const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
      const relevantCategories = new Set<string>();
      if (!isFiltering) {
          const overallTotals = new Map<string, number>();
          transactions.forEach(t => {
              if (t.type !== analysisType) return;
              if (analysisType === TransactionType.EXPENSE && t.fundedByResgate) return;
              if (analysisType === TransactionType.INVESTMENT && t.investmentDetails?.event !== 'BUY') return;
              if (!includeNathy && isNathyTransaction(t, nathyId)) return;
              const catName = categories.find(c => c.id === t.categoryId)?.name || 'Outros';
              overallTotals.set(catName, (overallTotals.get(catName) || 0) + t.amount);
          });
          Array.from(overallTotals.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5).forEach(([name]) => relevantCategories.add(name));
      }
      
      let monthsToLookBack = 11;
      if (settings.historyStartDate) {
          const startDate = new Date(settings.historyStartDate);
          const today = new Date();
          const diffMonths = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
          monthsToLookBack = Math.max(0, diffMonths);
      }

      for (let i = monthsToLookBack; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
          const label = d.toLocaleDateString('pt-BR', { month: 'short' });
          const monthData: any = { name: label };
          transactions.forEach(t => {
              if (analysisType === TransactionType.INVESTMENT) {
                  if (t.type !== TransactionType.INVESTMENT || t.investmentDetails?.event !== 'BUY') return;
              } else {
                  const isInvestmentIncome = t.type === TransactionType.INVESTMENT && 
                      ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO', 'AMORTIZACAO', 'SELL'].includes(t.investmentDetails?.event || '');
                  
                  if (t.type !== analysisType && !isInvestmentIncome) return;
                  if (analysisType === TransactionType.EXPENSE && isInvestmentIncome) return;
                  if (analysisType === TransactionType.EXPENSE && t.fundedByResgate) return;
                  if (analysisType === TransactionType.INCOME && t.type === TransactionType.INVESTMENT && !isInvestmentIncome) return;
              }

              const effDate = calculateEffectiveDate(t, creditCards, settings);
              if (effDate.getMonth() === d.getMonth() && effDate.getFullYear() === d.getFullYear()) {
                  if (!includeNathy && isNathyTransaction(t, nathyId)) return;
                  if (isFiltering) {
                      if (matchesFilters(t)) monthData['Selecionado'] = (monthData['Selecionado'] || 0) + t.amount;
                  } else {
                      const catName = categories.find(c => c.id === t.categoryId)?.name || 'Outros';
                      if (relevantCategories.has(catName)) monthData[catName] = (monthData[catName] || 0) + t.amount;
                  }
              }
          });
          data.push(monthData);
      }
      return { data, lines: isFiltering ? ['Selecionado'] : Array.from(relevantCategories) };
  }, [transactions, categories, creditCards, settings, isFiltering, filterCategoryIds, filterTag, includeNathy, analysisType]);

  const annualComparisonData = useMemo(() => {
    const data = [];
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const nathyId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
    for (let m = 0; m < 12; m++) {
      let totalExpense = 0;
      let filteredExpense = 0;
      transactions.forEach(t => {
        const effDate = calculateEffectiveDate(t, creditCards, settings);
        if (effDate.getFullYear() === selectedYear && effDate.getMonth() === m) {
          if (t.type === analysisType) {
             if (analysisType === TransactionType.INVESTMENT && t.investmentDetails?.event !== 'BUY') return;
             if (!includeNathy && isNathyTransaction(t, nathyId)) return;
             totalExpense += t.amount;
             if (matchesFilters(t)) filteredExpense += t.amount;
          }
        }
      });
      const ratio = totalExpense > 0 ? (filteredExpense / totalExpense) * 100 : 0;
      data.push({ name: labels[m], Total: totalExpense, Filtrado: filteredExpense, Ratio: Math.round(ratio) });
    }
    return data;
  }, [transactions, selectedYear, categories, creditCards, settings, filterCategoryIds, filterTag, includeNathy, analysisType]);

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
      {/* TOP CONTROL DECK */}
      <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl border border-zinc-200/40 dark:border-zinc-800/50 shadow-lg p-5 space-y-4">
          {/* Row 1: Summary & Main Controls */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
              {/* View Switcher & Date */}
              <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full shrink-0">
                      <button onClick={() => setTimeRange('month')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${timeRange === 'month' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Mês</button>
                      <button onClick={() => setTimeRange('year')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${timeRange === 'year' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Ano</button>
                      <button onClick={() => setTimeRange('custom')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${timeRange === 'custom' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Personalizado</button>
                      <button onClick={() => setTimeRange('all')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${timeRange === 'all' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Tudo</button>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 lg:flex-none justify-center">
                      {timeRange === 'month' && (
                          <>
                              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"><ChevronLeft size={18}/></button>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-wide min-w-[100px] text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                              <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"><ChevronRight size={18}/></button>
                          </>
                      )}
                      {timeRange === 'year' && (
                          <>
                              <button onClick={() => setSelectedYear(y => y - 1)} className="p-1.5 hover:bg-white dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400"><ChevronLeft size={18}/></button>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 min-w-[60px] text-center">{selectedYear}</span>
                              <button onClick={() => setSelectedYear(y => y + 1)} className="p-1.5 hover:bg-white dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400"><ChevronRight size={18}/></button>
                          </>
                      )}
                      {timeRange === 'custom' && (
                          <>
                              <input type="month" value={customStartMonth} onChange={(e) => setCustomStartMonth(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none w-24 text-center" />
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">até</span>
                              <input type="month" value={customEndMonth} onChange={(e) => setCustomEndMonth(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none w-24 text-center" />
                          </>
                      )}
                      {timeRange === 'all' && (
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-wide min-w-[100px] text-center">Todo o Período</span>
                      )}
                  </div>
              </div>

              {/* Quick Stats Strip */}
              <div className="flex items-center gap-6 text-sm flex-1 justify-center lg:justify-end border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800/60 pt-3 lg:pt-0 w-full lg:w-auto">
                  <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Receitas</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">R$ {(periodStats.income || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800"></div>
                  <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Despesas</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">R$ {(periodStats.expense || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800"></div>
                  <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Saldo</span>
                      <span className={`font-bold ${(periodStats.income - periodStats.expense) >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-600'}`}>R$ {((periodStats.income - periodStats.expense) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
              </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/40">
             <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full shrink-0">
                  <button onClick={() => setAnalysisType(TransactionType.EXPENSE)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.EXPENSE ? 'bg-white dark:bg-zinc-900 shadow text-rose-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Despesas</button>
                  <button onClick={() => setAnalysisType(TransactionType.INCOME)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.INCOME ? 'bg-white dark:bg-zinc-900 shadow text-emerald-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Receitas</button>
                  <button onClick={() => setAnalysisType(TransactionType.INVESTMENT)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${analysisType === TransactionType.INVESTMENT ? 'bg-white dark:bg-zinc-900 shadow text-blue-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Investimentos</button>
              </div>

              <button 
                onClick={() => setIncludeNathy(!includeNathy)} 
                className={`flex items-center gap-2 px-3 py-2 border rounded-full text-xs font-bold whitespace-nowrap transition-all ${includeNathy ? 'bg-pink-50/10 dark:bg-pink-950/20 border-pink-200/40 dark:border-pink-900/30 text-pink-700 dark:text-pink-400' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                title="Mostrar gastos da Nathy e partes divididas que normalmente são excluídas da sua análise pessoal."
              >
                  <Users size={14} /> {includeNathy ? 'Ocultar Nathy' : 'Incluir Nathy'}
              </button>
              <button onClick={() => setIsFilterVisible(!isFilterVisible)} className={`flex items-center gap-2 px-3 py-2 border rounded-full text-xs font-bold whitespace-nowrap transition-all ${isFilterVisible || filterTag || filterCategoryIds.length > 0 ? 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}><Filter size={14} /> Filtros Avançados</button>
          </div>
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
          {[{ id: 'overview', label: 'Resumo e Agrupamentos', icon: Activity }, { id: 'categories', label: 'Distribuição', icon: PieIcon }, { id: 'trends', label: 'Histórico Mensal', icon: TrendingUp }, { id: 'annual', label: 'Comparativo Anual', icon: Calendar }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center whitespace-nowrap gap-2 px-6 py-2 text-sm font-bold rounded-full transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><tab.icon size={16} /> {tab.label}</button>
          ))}
      </div>

      {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex justify-between items-center flex-wrap gap-2">
                      <div><h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-wide"><List size={16} className="text-zinc-500 dark:text-zinc-400" /> {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} Agrupados</h3></div>
                      <div className="flex bg-zinc-200 dark:bg-zinc-700 p-1 rounded-full">
                          <button onClick={() => setGroupMode('description')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'description' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>{analysisType === TransactionType.INVESTMENT ? 'Ativo/Descrição' : 'Descrição'}</button>
                          <button onClick={() => setGroupMode('category')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'category' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>Categoria</button>
                          {(analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) && (
                             <button onClick={() => setGroupMode('subcategory')} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${groupMode === 'subcategory' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>Subcategoria</button>
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
                              {groupedDataList?.map((item, idx) => (
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
                              {(!groupedDataList || groupedDataList.length === 0) && (<tr><td colSpan={6} className="p-12 text-center text-zinc-500 dark:text-zinc-400">Nenhum dado encontrado para o período.</td></tr>)}
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
                      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[300px]">
                          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-zinc-500 dark:text-zinc-400"/> {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} Acumulados</h3>
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={trajectoryData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                                  <YAxis stroke="#94a3b8" fontSize={10} />
                                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                  <Area type="monotone" dataKey="total" name="Acumulado" stroke={analysisType === TransactionType.EXPENSE ? "#6366f1" : "#10b981"} fill={analysisType === TransactionType.EXPENSE ? "#6366f120" : "#10b98120"} strokeWidth={3} />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                  )}
                  <div className={`p-8 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-center min-h-[300px] ${analysisType === TransactionType.EXPENSE ? 'bg-emerald-600 text-white' : (analysisType === TransactionType.INVESTMENT ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white')}`}>
                      {isFiltering || includeNathy ? (
                          <>
                              <Percent className="absolute -right-4 -bottom-4 w-32 h-32 text-zinc-900 dark:text-zinc-100/10" />
                              <h3 className="text-lg font-bold mb-2 uppercase tracking-wide opacity-90">Representatividade</h3>
                              <p className="text-zinc-900 dark:text-zinc-100/80 text-sm mb-6 leading-relaxed">
                                  {analysisType === TransactionType.EXPENSE 
                                      ? "Estes gastos representam" 
                                      : (analysisType === TransactionType.INVESTMENT ? "Estes investimentos representam" : "Estas receitas representam")}
                                  <strong className="block text-zinc-900 dark:text-zinc-100 text-lg mt-1">da sua Renda Total do período.</strong>
                              </p>
                              <div className="text-5xl font-bold mb-2">{representativeValue.toFixed(1)}%</div>
                              <div className="h-2 w-full bg-black/20 rounded-full mt-4 border border-zinc-200 dark:border-zinc-800">
                                  <div className="h-full bg-white dark:bg-zinc-900 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000" style={{width: `${Math.min(representativeValue, 100)}%`}}></div>
                              </div>
                              <p className="text-[10px] mt-4 opacity-60 text-center uppercase tracking-widest font-bold">Base: R$ {formatCurrency(globalStats.income)}</p>
                          </>
                      ) : (
                          <>
                              <ShieldCheck className="absolute -right-4 -bottom-4 w-32 h-32 text-zinc-900 dark:text-zinc-100/10" />
                              <h3 className="text-lg font-bold mb-2">Resumo da Meta</h3>
                              {analysisType === TransactionType.INVESTMENT ? (() => {
                                  const budgetPct = settings.monthlyBudgetPercentage || 80;
                                  const savingsTargetPct = 100 - budgetPct;
                                  const targetSavings = globalStats.income * (savingsTargetPct / 100);
                                  const investmentPercent = targetSavings > 0 ? (periodStats.myInvestmentFromPocket / targetSavings) * 100 : 0;
                                  return (
                                      <>
                                          <p className="text-zinc-900 dark:text-zinc-100 text-sm mb-6">Neste período, você atingiu da sua meta de investimentos:</p>
                                          <div className="text-5xl font-bold mb-2">{investmentPercent.toFixed(1)}%</div>
                                          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mt-4">
                                              <div className="h-full bg-white dark:bg-zinc-900 rounded-full transition-all duration-1000" style={{width: `${Math.min(investmentPercent, 100)}%`}}></div>
                                          </div>
                                          <p className="text-[10px] mt-4 opacity-60 text-center uppercase tracking-widest font-bold">Meta: R$ {formatCurrency(targetSavings)}</p>
                                          {periodStats.myReinvested > 0 && (
                                              <p className="text-[10px] mt-2 text-center text-blue-800 font-medium">
                                                  + R$ {formatCurrency(periodStats.myReinvested)} reinvestidos da renda passiva
                                              </p>
                                          )}
                                          {periodStats.startingPool > 0 && (
                                              <p className="text-[10px] mt-1 text-center text-emerald-800 font-medium">
                                                  Saldo inicial de proventos: R$ {formatCurrency(periodStats.startingPool)}
                                              </p>
                                          )}
                                          {periodStats.endingPool > 0 && (
                                              <p className="text-[10px] mt-1 text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 italic">
                                                  Saldo final de proventos: R$ {formatCurrency(periodStats.endingPool)}
                                              </p>
                                          )}
                                      </>
                                  );
                              })() : (
                                  <>
                                      <p className="text-zinc-900 dark:text-zinc-100 text-sm mb-6">Neste período, sua taxa de economia média é de:</p>
                                      <div className="text-5xl font-bold mb-2">{periodStats.savingsRate.toFixed(1)}%</div>
                                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mt-4">
                                          <div className="h-full bg-white dark:bg-zinc-900 rounded-full transition-all duration-1000" style={{width: `${Math.min(periodStats.savingsRate, 100)}%`}}></div>
                                      </div>
                                  </>
                              )}
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'categories' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[450px] flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-wider"><PieIcon size={16} className="text-zinc-500 dark:text-zinc-400" /> Distribuição de {analysisType === TransactionType.EXPENSE ? 'Gastos' : (analysisType === TransactionType.INVESTMENT ? 'Investimentos' : 'Receitas')} {distMode === 'subcategory' && '(Top 10)'}</h3>
                          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                              <button onClick={() => { setDistMode('category'); setSelectedDetailSlice(null); }} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${distMode === 'category' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>Categorias</button>
                              {(analysisType === TransactionType.EXPENSE || analysisType === TransactionType.INVESTMENT) && (
                                <button onClick={() => { setDistMode('subcategory'); setSelectedDetailSlice(null); }} className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${distMode === 'subcategory' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>Subcategorias</button>
                              )}
                          </div>
                      </div>
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
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                              <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                          </PieChart>
                      </ResponsiveContainer>
                      <p className="text-[10px] text-center text-zinc-500 dark:text-zinc-400 mt-2 italic">Dica: Clique em uma fatia para ver os lançamentos detalhados abaixo.</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40"><h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase">Ranking Detalhado</h3></div>
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
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden animate-in slide-in-from-top-4">
                      <div className="p-4 bg-emerald-600 text-white flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><List size={18}/></div>
                              <div>
                                  <h3 className="text-sm font-bold uppercase tracking-widest">Lançamentos em: {detailSliceName}</h3>
                                  <p className="text-[10px] text-zinc-900 dark:text-zinc-100">Exibindo todos os {analysisType === TransactionType.EXPENSE ? 'gastos' : (analysisType === TransactionType.INVESTMENT ? 'investimentos' : 'ganhos')} no período analisado.</p>
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
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[400px]">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2 uppercase tracking-wider"><TrendingUp size={16} className="text-zinc-500 dark:text-zinc-400"/> Histórico de Receitas vs Despesas (Filtros Ativos)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendsHistoryData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend /><Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} /></BarChart>
                  </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[400px]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
                          <Activity size={16} className="text-zinc-500 dark:text-zinc-400"/> 
                          {isFiltering ? 'Evolução da Seleção Atual' : 'Evolução Detalhada (Top 5 Categorias)'}
                      </h3>
                      {!isFiltering && <span className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">Sem filtros ativos. Exibindo Top 5.</span>}
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={categoryEvolutionData.data}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          {categoryEvolutionData.lines.map((lineKey, index) => (
                              <Line 
                                  key={lineKey}
                                  type="monotone" 
                                  dataKey={lineKey} 
                                  stroke={COLORS[index % COLORS.length]} 
                                  strokeWidth={3}
                                  dot={{r: 4, strokeWidth: 1, fill: '#fff'}}
                                  activeDot={{r: 6}}
                              />
                          ))}
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>
      )}

      {activeTab === 'annual' && (
          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[450px]">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2 uppercase tracking-wider"><Target size={16} className="text-zinc-500 dark:text-zinc-400"/> Comparativo: Total Geral vs Filtros Selecionados ({selectedYear})</h3>
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={annualComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                          <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `R$${val/1000}k`} />
                          <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={10} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                          <Tooltip formatter={(value: number, name: string) => name === 'Ratio' ? formatPercent(value) : formatCurrency(value)} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="Total" name="Despesa Geral" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar yAxisId="left" dataKey="Filtrado" name="Despesa Filtrada" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                          <Line yAxisId="right" type="monotone" dataKey="Ratio" name="% Representativo" stroke="#6366f1" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: "#fff"}} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>
      )}
    </div>
  );
};
