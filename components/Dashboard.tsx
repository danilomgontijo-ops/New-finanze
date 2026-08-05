
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, UserSettings, PaymentMethod, CreditCard, SubCategory, AssetPrice } from '../types';
import { GeminiService } from '../services/geminiService';
import { BrapiService } from '../services/brapiService';
import { StorageService } from '../services/storageService';
import { 
  TrendingUp, TrendingDown, Calendar, Wallet, ArrowUp, ArrowDown, 
  CreditCard as CardIcon, Banknote, Sparkles, ChevronLeft, ChevronRight,
  MoreHorizontal, Pencil, Trash2, ShieldCheck, PieChart, AlertCircle,
  Percent, ArrowRight, Clock, ChevronDown, ChevronUp, Target, PiggyBank,
  AlertTriangle, CheckCircle2, Loader2, DollarSign, Utensils, Car, Home, Gamepad, Activity, User, Dog, Circle, ShoppingBag, Coffee, Smartphone, Hammer, Plane, Music, Gift, Wifi, Zap, Book, Briefcase, Shirt, BrainCircuit, RefreshCcw, BarChart3,
  Receipt, Coins, Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Line, Legend
} from 'recharts';
import { BankLogo, BrandLogo } from './CreditCardManager';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  assetPrices?: AssetPrice[];
  settings: UserSettings;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string, mode?: 'single' | 'future' | 'all') => void;
}

const IconRenderer = ({ iconName, size = 16, className }: { iconName: string; size?: number, className?: string }) => {
  const icons: any = { utensils: Utensils, car: Car, home: Home, gamepad: Gamepad, activity: Activity, user: User, dog: Dog, banknote: Banknote, 'trending-up': TrendingUp, circle: Circle, 'shopping-bag': ShoppingBag, coffee: Coffee, smartphone: Smartphone, hammer: Hammer, plane: Plane, music: Music, gift: Gift, wifi: Wifi, zap: Zap, book: Book, briefcase: Briefcase, shirt: Shirt };
  const IconComponent = icons[iconName] || Circle;
  return <IconComponent size={size} className={className} />;
};

// Helper function to get Asset Icons from public APIs
const getAssetIcon = (ticker: string) => {
    const cleanTicker = ticker.trim().toUpperCase();
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LTC', 'UNI', 'LINK'];
    const cryptoMatch = cleanTicker.endsWith('BRL') ? cleanTicker.replace('BRL', '') : cleanTicker;
    
    if (cryptoSymbols.includes(cryptoMatch)) {
        return `https://assets.coincap.io/assets/icons/${cryptoMatch.toLowerCase()}@2x.png`;
    }
    return `https://icons.brapi.dev/icons/${cleanTicker}.svg`;
}

// Fixed Income Logic (Sync with Investments.tsx)
const calculateRealFixedIncome = (principal: number, startDateStr: string, rateStr: string, cdiData: { date: string, value: number }[]): number => {
    const cleanRate = rateStr.toUpperCase().replace(',', '.').replace('%', '');
    let pctCDI = 0;
    let isCDI = false;
    let fixedRate = 0;

    if (cleanRate.includes('CDI')) {
        isCDI = true;
        const numStr = cleanRate.replace('CDI', '').trim();
        pctCDI = numStr ? parseFloat(numStr) : 100;
        if (isNaN(pctCDI)) pctCDI = 100;
    } else {
        fixedRate = parseFloat(cleanRate);
        if (isNaN(fixedRate)) fixedRate = 0;
    }

    if (isCDI) {
        if (cdiData.length === 0) return principal;
        const startIso = startDateStr.split('T')[0];
        const relevantRates = cdiData.filter(d => d.date >= startIso);
        let accumulatedFactor = 1;
        for (const day of relevantRates) {
            const dailyFactor = 1 + ((day.value / 100) * (pctCDI / 100));
            accumulatedFactor *= dailyFactor;
        }
        return principal * accumulatedFactor;
    } else {
        const start = new Date(startDateStr);
        const diffTime = Math.abs(new Date().getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const years = diffDays / 365.25;
        if (fixedRate > 0) return principal * Math.pow(1 + (fixedRate / 100), years);
    }
    return principal;
};

// Robust XIRR Calculation with fallback
const calculateXIRR = (values: number[], dates: Date[], guess: number = 0.1): number => {
    const xirr = (values: number[], dates: Date[], guess: number) => {
        const limit = 100; const tol = 1e-6; let x0 = guess;
        for (let i = 0; i < limit; i++) {
            let fValue = 0; let fDerivative = 0;
            for (let j = 0; j < values.length; j++) {
                const dt = (dates[j].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                const factor = Math.pow(Math.abs(1 + x0), dt);
                const sign = (1 + x0) >= 0 ? 1 : (Math.floor(dt) % 2 === 0 ? 1 : -1);
                fValue += values[j] / (sign * factor);
                fDerivative += -dt * values[j] / (sign * factor * (1 + x0));
            }
            if (Math.abs(fDerivative) < 1e-12) break;
            const step = fValue / fDerivative;
            const x1 = x0 - Math.max(-0.5, Math.min(0.5, step)); // Dampen the step to prevent wild oscillations
            if (Math.abs(x1 - x0) < tol) return x1;
            x0 = x1;
            if (x0 <= -1) x0 = -0.999; // Keep x0 in a valid range for Math.pow
        }
        return x0; 
    };
    try {
        if (values.length === 0 || values.every(v => v >= 0) || values.every(v => v <= 0)) return 0;
        const result = xirr(values, dates, guess);
        const resultPct = isNaN(result) || !isFinite(result) ? 0 : result * 100;
        if (Math.abs(resultPct) > 10000) return 0; 
        return resultPct;
    } catch (e) { return 0; }
};

function calculateEffectiveDate(t: Transaction, creditCards: CreditCard[], settings: UserSettings): Date {
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
        if (card && dayOfMonth > card.closingDay) {
            comparisonDate.setMonth(comparisonDate.getMonth() + 1);
        }
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

const getYearMonthKey = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    return `${y}-${m.toString().padStart(2, '0')}`;
};

const KPICard = ({ title, value, icon: Icon, color, subtext, onClick }: { title: string, value: number, icon: any, color: 'emerald' | 'rose' | 'indigo' | 'blue' | 'zinc', subtext?: React.ReactNode, onClick?: () => void }) => {
    // "indigo" is the bento hero variant: gradient card, reserved for the primary headline stat.
    if (color === 'indigo') {
        return (
            <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={onClick ? { scale: 0.98 } : {}}
                onClick={onClick}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-md shadow-blue-200/60 dark:shadow-none flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer' : 'cursor-default'} relative overflow-hidden group`}
            >
                <div className="p-3 rounded-xl bg-white/15 text-white transition-transform group-hover:scale-105 group-hover:rotate-3">
                    <Icon strokeWidth={1.5} size={20} />
                </div>
                <div className="relative z-10 flex-1">
                    <p className="text-blue-100 text-[11px] font-semibold uppercase tracking-[0.15em] mb-1">{title}</p>
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-none overflow-hidden tabular-nums">
                        R$ {(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    {subtext && <div className="mt-1.5 transition-opacity group-hover:opacity-90 leading-tight">{subtext}</div>}
                </div>
                {onClick && (
                    <div className="absolute top-5 right-5 text-white/50 group-hover:text-white transition-colors">
                        <ArrowRight strokeWidth={1.5} size={18} />
                    </div>
                )}
            </motion.div>
        );
    }

    const variants = {
        emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' },
        rose: { iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' },
        blue: { iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' },
        zinc: { iconBg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' }
    } as const;
    const v = variants[color as Exclude<typeof color, 'indigo'>];
    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={onClick ? { scale: 0.98 } : {}}
            onClick={onClick}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer' : 'cursor-default'} relative overflow-hidden group`}
        >
            <div className={`p-3 rounded-xl ${v.iconBg} transition-transform group-hover:scale-105 group-hover:rotate-3`}>
                <Icon strokeWidth={1.5} size={20} />
            </div>
            <div className="relative z-10 flex-1">
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold uppercase tracking-[0.15em] mb-1">{title}</p>
                <h3 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none overflow-hidden tabular-nums">
                    R$ {(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                {subtext && <div className="mt-1.5 transition-opacity group-hover:opacity-90 leading-tight">{subtext}</div>}
            </div>
            {onClick && (
                <div className="absolute top-5 right-5 text-zinc-300 group-hover:text-blue-500 transition-colors">
                    <ArrowRight strokeWidth={1.5} size={18} />
                </div>
            )}
        </motion.div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({
  transactions, categories, subCategories, creditCards, assetPrices = [], settings,
  currentDate, onDateChange,
  onEditTransaction, onDeleteTransaction
}) => {
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [projectionScope, setProjectionScope] = useState<'user' | 'nathy' | null>(null);
  const [showInvestmentDetails, setShowInvestmentDetails] = useState(false);
  const [isGoalSimulatorOpen, setIsGoalSimulatorOpen] = useState(false);
  
  // States for Metas / Independence Simulator (Meta R$ 1.25M)
  const [targetMet, setTargetMet] = useState(1250000);
  const [annualReturn, setAnnualReturn] = useState(11.5);
  const [monthlyAporte, setMonthlyAporte] = useState(1500);
  const [isProjectionStateInitialized, setIsProjectionStateInitialized] = useState(false);
  
  // CDI Data for Fixed Income Calculations
  const [cdiHistory, setCdiHistory] = useState<{ date: string, value: number }[]>([]);
  const [hasFetchedCdi, setHasFetchedCdi] = useState(false);

  useEffect(() => {
      if (!hasFetchedCdi) {
          BrapiService.fetchCdiHistory().then(data => {
              setCdiHistory(data);
              setHasFetchedCdi(true);
          });
      }
  }, [hasFetchedCdi]);

  const isNathyTransaction = (t: Transaction) => {
      const nathyCategory = categories.find(c => c.name.toLowerCase() === 'nathy');
      const isNathyCat = nathyCategory && t.categoryId === nathyCategory.id;
      const isNathyDesc = t.description.toLowerCase().includes('(parte nathy)');
      return isNathyCat || isNathyDesc;
  };



  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const effDate = calculateEffectiveDate(t, creditCards, settings);
      return effDate.getMonth() === currentDate.getMonth() && effDate.getFullYear() === currentDate.getFullYear();
    });
  }, [transactions, currentDate, creditCards, settings]);

  const monthlyInvestmentsList = useMemo(() => {
      return filteredTransactions
        .filter(t => t.type === TransactionType.INVESTMENT && t.investmentDetails?.event === 'BUY')
        .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

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
      let annualInvestedValue = 0;

      const monthlyData = new Map<string, { income: number, expense: number, proventos: number, resgates: number, invested: number, fundedByResgateExpense: number }>();

      const sortedTransactions = [...(transactions || [])].sort((a, b) => {
          const dateA = calculateEffectiveDate(a, creditCards, settings).getTime();
          const dateB = calculateEffectiveDate(b, creditCards, settings).getTime();
          return dateA - dateB;
      });

      sortedTransactions.forEach(t => {
          const effDate = calculateEffectiveDate(t, creditCards, settings);
          const monthKey = `${effDate.getFullYear()}-${String(effDate.getMonth()).padStart(2, '0')}`;

          // Respect balanceResetDate if present
          if (settings.balanceResetDate) {
              const resetDate = new Date(settings.balanceResetDate);
              const resetMonthKey = `${resetDate.getFullYear()}-${String(resetDate.getMonth()).padStart(2, '0')}`;
              if (monthKey < resetMonthKey) return;
          }

          if (!monthlyData.has(monthKey)) {
              monthlyData.set(monthKey, { income: 0, expense: 0, proventos: 0, resgates: 0, invested: 0, fundedByResgateExpense: 0 });
          }

          const data = monthlyData.get(monthKey)!;

          if (t.type === TransactionType.INCOME && !isNathyTransaction(t)) {
              data.income += t.amount;
          } else if (t.type === TransactionType.EXPENSE && !isNathyTransaction(t)) {
              if (t.fundedByResgate) {
                  data.fundedByResgateExpense += t.amount;
              } else {
                  data.expense += t.amount;
              }
          } else if (t.type === TransactionType.INVESTMENT) {
              const event = t.investmentDetails?.event;
              if (['DIVIDEND', 'JCP', 'RENDIMENTO'].includes(event || '')) {
                  if (!isNathyTransaction(t)) data.proventos += t.amount;
              } else if (['SELL', 'AMORTIZACAO', 'REEMBOLSO'].includes(event || '')) {
                  if (!isNathyTransaction(t)) data.resgates += t.amount;
              } else if (event === 'BUY' && !isNathyTransaction(t)) {
                  data.invested += t.amount;
              }
          }
      });

      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth()).padStart(2, '0')}`;
      const currentYear = currentDate.getFullYear();

      const sortedMonths = Array.from(monthlyData.keys()).sort();

      sortedMonths.forEach(monthKey => {
          const data = monthlyData.get(monthKey)!;
          const [yearStr, monthStr] = monthKey.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);

          if (settings.resgatesResetMonth && monthKey === settings.resgatesResetMonth) {
              resgatesPool = 0;
          }

          if (monthKey === currentMonthKey) {
              startingProventosPool = proventosPool;
              startingResgatesPool = resgatesPool;
          }

          const monthlySavings = data.income - data.expense;
          activePool += monthlySavings;
          
          // Ensure activePool doesn't go extremely negative if we are calculating "Available Savings"
          // However, we want to reflect the real wallet balance if possible.
          // But if it's representing "Economizado Disponível", we might want to floor it at 0
          // or at least cap the subtraction.
          
          proventosPool += data.proventos;
          resgatesPool += data.resgates;
          
          // Deduct expenses funded by resgates from the resgates pool
          resgatesPool -= data.fundedByResgateExpense;

          let remainingInvested = data.invested;
          let reinvestedProventos = 0;
          let reinvestedResgates = 0;
          let aporteNovo = 0;

          if (remainingInvested > 0) {
              // 1. Aporte Novo (from activePool)
              aporteNovo = Math.min(remainingInvested, Math.max(0, activePool));
              activePool -= aporteNovo;
              remainingInvested -= aporteNovo;

              // 2. Proventos
              if (remainingInvested > 0) {
                  reinvestedProventos = Math.min(remainingInvested, Math.max(0, proventosPool));
                  proventosPool -= reinvestedProventos;
                  remainingInvested -= reinvestedProventos;
              }

              // 3. Resgates
              if (remainingInvested > 0) {
                  reinvestedResgates = Math.min(remainingInvested, Math.max(0, resgatesPool));
                  resgatesPool -= reinvestedResgates;
                  remainingInvested -= reinvestedResgates;
              }

              // If there's still remainingInvested, it goes to Aporte Novo (and can make activePool negative)
              if (remainingInvested > 0) {
                  aporteNovo += remainingInvested;
                  activePool -= remainingInvested;
                  remainingInvested = 0;
              }
          }

          if (monthKey === currentMonthKey) {
              myInvestmentFromPocket = aporteNovo;
              myReinvestedProventos = reinvestedProventos;
              myReinvestedResgates = reinvestedResgates;
              myDividends = data.proventos;
              myResgates = data.resgates;
              endingProventosPool = proventosPool;
              endingResgatesPool = resgatesPool;
          }

          if (year === currentYear && month <= currentDate.getMonth()) {
              annualInvestedValue += aporteNovo;
          }
      });

      if (!monthlyData.has(currentMonthKey)) {
          startingProventosPool = proventosPool;
          startingResgatesPool = resgatesPool;
          endingProventosPool = proventosPool;
          endingResgatesPool = resgatesPool;
      }

      return { 
          myInvestmentFromPocket, 
          myDividends, 
          myResgates,
          myReinvestedProventos,
          myReinvestedResgates,
          startingProventosPool, 
          endingProventosPool,
          startingResgatesPool,
          endingResgatesPool,
          annualInvestedValue,
          activePool,
          proventosPool,
          resgatesPool,
          passivePool: proventosPool + resgatesPool
      };
  }, [transactions, currentDate, creditCards, settings, categories]);

  const stats = useMemo(() => {
    let income = 0, myIncome = 0, myIncomeForBudget = 0, expense = 0, myExpense = 0, investment = 0, myInvestment = 0, creditTotal = 0, debitTotal = 0;
    let myResgateExpense = 0, debitResgateExpense = 0;

    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
          income += t.amount;
          if (!isNathyTransaction(t)) {
              myIncome += t.amount;
              if (!t.excludeFromBudget) {
                  myIncomeForBudget += t.amount;
              }
          }
      }
      else if (t.type === TransactionType.INVESTMENT) {
          const event = t.investmentDetails?.event;
          if (event === 'BUY') {
              investment += t.amount;
              if (!isNathyTransaction(t)) myInvestment += t.amount;
          }
      }
      else {
        if (!t.fundedByResgate) {
            expense += t.amount;
            if (!isNathyTransaction(t)) myExpense += t.amount;
        } else {
            if (!isNathyTransaction(t)) myResgateExpense += t.amount;
        }
        
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
            creditTotal += t.amount;
        } else {
            if (!t.fundedByResgate) {
                debitTotal += t.amount;
            }
        }

        if (t.fundedByResgate && t.paymentMethod !== PaymentMethod.CREDIT_CARD) {
            debitResgateExpense += t.amount;
        }
      }
    });

    const myBalance = myIncome - myExpense; 
    const surplus = myIncome - myExpense; 
    const budgetPct = settings.monthlyBudgetPercentage || 80;
    const savingsTargetPct = 100 - budgetPct;
    const targetSavings = myIncomeForBudget * (savingsTargetPct / 100);

    return { 
        income, 
        myIncome,
        myIncomeForBudget,
        expense, 
        myExpense, 
        investment, 
        myInvestment, 
        myResgateExpense,
        debitResgateExpense,
        myDividends: pocketInvestmentStats.myDividends, 
        myResgates: pocketInvestmentStats.myResgates,
        myInvestmentFromPocket: pocketInvestmentStats.myInvestmentFromPocket, 
        myReinvestedProventos: pocketInvestmentStats.myReinvestedProventos,
        myReinvestedResgates: pocketInvestmentStats.myReinvestedResgates,
        startingProventosPool: pocketInvestmentStats.startingProventosPool,
        endingProventosPool: pocketInvestmentStats.endingProventosPool,
        startingResgatesPool: pocketInvestmentStats.startingResgatesPool,
        endingResgatesPool: pocketInvestmentStats.endingResgatesPool,
        balance: myBalance, 
        surplus, 
        creditTotal, 
        debitTotal, 
        targetSavings 
    };
  }, [filteredTransactions, categories, settings, pocketInvestmentStats]);

  const annualStats = useMemo(() => {
      let income = 0;
      let myIncome = 0;
      let myIncomeForBudget = 0;
      let expense = 0;
      let myExpense = 0;
      let dividends = 0;
      let myInvestment = 0;
      const year = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      const monthlyData = Array.from({ length: 12 }, () => ({ myIncome: 0, myExpense: 0, myInvestment: 0 }));

      transactions?.forEach(t => {
          const effDate = calculateEffectiveDate(t, creditCards, settings);
          if (effDate.getFullYear() === year && effDate.getMonth() <= currentMonth) {
              const m = effDate.getMonth();
              if (t.type === TransactionType.INCOME) {
                  income += t.amount;
                  if (!isNathyTransaction(t)) {
                      myIncome += t.amount;
                      if (!t.excludeFromBudget) {
                          myIncomeForBudget += t.amount;
                      }
                      monthlyData[m].myIncome += t.amount;
                  }
              } else if (t.type === TransactionType.INVESTMENT) {
                  const event = t.investmentDetails?.event;
                  if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'SELL', 'AMORTIZACAO', 'REEMBOLSO'].includes(event || '')) {
                      dividends += t.amount;
                  } else if (event === 'BUY') {
                      if (!isNathyTransaction(t)) {
                          myInvestment += t.amount;
                          monthlyData[m].myInvestment += t.amount;
                      }
                  }
              } else {
                  if (!t.fundedByResgate) {
                      expense += t.amount;
                      if (!isNathyTransaction(t)) {
                          myExpense += t.amount;
                          monthlyData[m].myExpense += t.amount;
                      }
                  }
              }
          }
      });

      const savingsTargetPct = 100 - (settings.monthlyBudgetPercentage || 80);
      const annualGoal = myIncomeForBudget * (savingsTargetPct / 100);

      return {
          income,
          myIncome,
          myIncomeForBudget,
          expense,
          myExpense,
          balance: income - expense,
          myBalance: myIncome - myExpense,
          dividends,
          myInvestment,
          annualGoal
      };
  }, [transactions, currentDate, creditCards, settings, categories]);

  const investmentStats = useMemo(() => {
      const usdPriceObj = assetPrices.find(p => p.ticker === 'USDBRL');
      const currentUsdRate = usdPriceObj ? usdPriceObj.currentPrice : 1;
      const assets: Record<string, any> = {};
      const globalCashFlows: { date: Date, amount: number }[] = [];
      const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      sortedTransactions.forEach(t => {
          if (t.type === TransactionType.INVESTMENT && t.investmentDetails && !isNathyTransaction(t)) {
              const { ticker, quantity, event, currency, price, yieldRate, newTicker } = t.investmentDetails;
              if (!assets[ticker]) {
                  const cat = categories.find(c => c.id === t.categoryId);
                  assets[ticker] = { quantity: 0, totalCost: 0, bonusCost: 0, ticker, currency: currency || 'BRL', cashFlows: [], yieldRate, category: cat?.name || 'Geral' };
              }
              const asset = assets[ticker];
              const flowAmount = event === 'BUY' ? -t.amount : (['SELL', 'AMORTIZACAO', 'REEMBOLSO', 'DIVIDEND', 'JCP', 'RENDIMENTO'].includes(event) ? t.amount : 0);
              if (flowAmount !== 0) {
                  const flow = { date: new Date(t.date), amount: flowAmount };
                  asset.cashFlows.push(flow);
                  globalCashFlows.push(flow);
              }

              if (event === 'BUY') { asset.quantity += quantity; asset.totalCost += t.amount; }
              else if (event === 'SELL') {
                  const isFixedIncome = yieldRate || ticker.toUpperCase().includes('CDB') || ticker.toUpperCase().includes('TESOURO') || ticker.toUpperCase().startsWith('TD:');
                  let qtySold = quantity;
                  let costSold = 0;
                  
                  if (isFixedIncome) {
                      const reductionRatio = Math.min(1, t.amount / (asset.totalCost > 0 ? asset.totalCost : 1));
                      qtySold = asset.quantity * reductionRatio;
                      costSold = asset.totalCost * reductionRatio;
                  } else {
                      const currentAvgPrice = asset.quantity > 0 ? asset.totalCost / asset.quantity : 0;
                      costSold = currentAvgPrice * quantity;
                  }
                  
                  const transactionProfit = t.amount - costSold;
                  asset.realizedProfit = (asset.realizedProfit || 0) + transactionProfit;
                  asset.quantity -= qtySold; 
                  asset.totalCost -= costSold;
                  if (asset.quantity <= 0.000001) { asset.quantity = 0; asset.totalCost = 0; }
              } 
              else if (event === 'AMORTIZACAO' || event === 'REEMBOLSO') {
                  asset.totalCost -= t.amount;
                  if (asset.totalCost < 0) asset.totalCost = 0;
              }
              else if (['DIVIDEND', 'JCP', 'RENDIMENTO'].includes(event)) {
                  asset.totalProventos = (asset.totalProventos || 0) + t.amount;
              }
              else if (event === 'BONUS') { 
                  asset.quantity += quantity;
                  const bonusPrice = t.investmentDetails?.price || 0;
                  const bonusValue = quantity * bonusPrice;
                  asset.totalCost += bonusValue;
                  asset.bonusCost += bonusValue;
              }
              else if (event === 'SPLIT') { asset.quantity *= quantity; }
              else if (event === 'MERGE') { asset.quantity /= quantity; }
              else if (event === 'TICKER_UPDATE' && newTicker) {
                  const targetTicker = newTicker.toUpperCase();
                  if (!assets[targetTicker]) assets[targetTicker] = { quantity: 0, totalCost: 0, bonusCost: 0, ticker: targetTicker, currency: asset.currency, cashFlows: [], yieldRate: asset.yieldRate, category: asset.category };
                  const b = assets[targetTicker]; b.quantity += asset.quantity; b.totalCost += asset.totalCost; b.bonusCost += (asset.bonusCost || 0);
                  asset.quantity = 0; asset.totalCost = 0; asset.bonusCost = 0;
              }
          }
      });

      let totalInvestedValue = 0;
      let totalCurrentValue = 0;
      let totalBonusCost = 0;
      const activeAssets: any[] = [];

      Object.values(assets).forEach((a: any) => {
          if (a.quantity > 0.000001 || a.yieldRate) {
              const priceObj = assetPrices.find(p => p.ticker === a.ticker);
              const avgPriceBRL = a.quantity > 0 ? a.totalCost / a.quantity : 0;
              let currentTotal = 0;
              const isTesouro = a.ticker.startsWith('TD:') || a.ticker.startsWith('TESOURO');
              
              if (a.yieldRate && !isTesouro && !(priceObj && priceObj.manualHistory && priceObj.manualHistory.length > 0)) {
                  let calculatedBalance = 0;
                  const assetTxs = sortedTransactions.filter(t => t.investmentDetails?.ticker === a.ticker);
                  assetTxs.forEach(t => {
                      const ev = t.investmentDetails?.event;
                      const amt = t.amount;
                      const date = t.date;
                      if (ev === 'BUY' || ev === 'BONUS') calculatedBalance += calculateRealFixedIncome(amt, date, a.yieldRate, cdiHistory);
                      else if (ev === 'SELL' || ev === 'AMORTIZACAO') calculatedBalance -= calculateRealFixedIncome(amt, date, a.yieldRate, cdiHistory);
                  });
                  if (calculatedBalance < 0.01 && a.totalCost > 0) calculatedBalance = a.totalCost;
                  currentTotal = calculatedBalance;
              } else {
                  let rawQuotePrice = (priceObj && priceObj.manualHistory && priceObj.manualHistory.length > 0) 
                      ? [...priceObj.manualHistory].sort((m1, m2) => m2.date.localeCompare(m1.date))[0].price
                      : (priceObj ? priceObj.currentPrice : (a.currency === 'USD' ? 0 : avgPriceBRL));
                  let quotePriceBRL = rawQuotePrice;
                  if (a.currency === 'USD') quotePriceBRL = rawQuotePrice * currentUsdRate;
                  if (rawQuotePrice === 0) quotePriceBRL = avgPriceBRL;
                  currentTotal = a.quantity * quotePriceBRL;
              }

              totalCurrentValue += currentTotal;
              totalInvestedValue += a.totalCost;
              totalBonusCost += (a.bonusCost || 0);
              const unrealizedProfit = currentTotal - a.totalCost + (a.bonusCost || 0);
              const totalProfit = unrealizedProfit + (a.totalProventos || 0) + (a.realizedProfit || 0);
              const investedOutOfPocket = a.totalCost - (a.bonusCost || 0);
              const profitPct = investedOutOfPocket > 0 ? (totalProfit / investedOutOfPocket) * 100 : 0;
              let xtir = 0;
              if (a.cashFlows.length > 0 && currentTotal > 0) {
                  let closingDate = new Date();
                  if (priceObj && priceObj.manualHistory && priceObj.manualHistory.length > 0) {
                      closingDate = new Date([...priceObj.manualHistory].sort((m1,m2)=>m2.date.localeCompare(m1.date))[0].date);
                  }
                  const flowsWithCurrent = [...a.cashFlows, { date: closingDate, amount: currentTotal }];
                  xtir = calculateXIRR(flowsWithCurrent.map(f => f.amount), flowsWithCurrent.map(f => f.date));
                  if (xtir === 0 && Math.abs(profitPct) > 0.1) xtir = profitPct;
                  xtir = Math.max(-95, Math.min(500, xtir));
              }
              activeAssets.push({ ticker: a.ticker, category: a.category, profit: totalProfit, profitPct, xtir });
          }
      });

      let portfolioAnnualXTIR = 0;
      let portfolioMonthlyXTIR = 0;
      if (globalCashFlows.length > 0 && totalCurrentValue > 0) {
          const globalFlowsWithCurrent = [...globalCashFlows, { date: new Date(), amount: totalCurrentValue }];
          portfolioAnnualXTIR = calculateXIRR(globalFlowsWithCurrent.map(f => f.amount), globalFlowsWithCurrent.map(f => f.date));
          if (portfolioAnnualXTIR > -90 && portfolioAnnualXTIR < 1000) portfolioMonthlyXTIR = (Math.pow(1 + (portfolioAnnualXTIR / 100), 1/12) - 1) * 100;
      }

      const top3 = activeAssets.sort((a,b) => b.profit - a.profit).slice(0, 3);
      const totalProfit = totalCurrentValue - totalInvestedValue + totalBonusCost;
      const totalInvestedOutOfPocket = totalInvestedValue - totalBonusCost;
      const roi = totalInvestedOutOfPocket > 0 ? (totalProfit / totalInvestedOutOfPocket) * 100 : 0;

      const savingsTargetPct = 100 - (settings.monthlyBudgetPercentage || 80);
      const monthlyGoal = stats.myIncomeForBudget * (savingsTargetPct / 100);

      return { 
          totalCurrentValue, 
          totalInvestedValue, 
          roi, 
          top3, 
          totalProfit, 
          portfolioAnnualXTIR, 
          portfolioMonthlyXTIR,
          monthlyInvestedValue: stats.myInvestmentFromPocket,
          annualInvestedValue: pocketInvestmentStats.annualInvestedValue,
          monthlyGoal,
          annualGoal: annualStats.annualGoal
      };
  }, [transactions, assetPrices, cdiHistory, stats, annualStats, pocketInvestmentStats, settings, currentDate]);

  const budgetStats = useMemo(() => {
      const myIncome = stats.myIncomeForBudget;
      const myExpense = stats.myExpense;
      const monthlyBudgetPercentage = settings.monthlyBudgetPercentage || 80;
      
      const targetExpense = myIncome * (monthlyBudgetPercentage / 100);
      const percentageOfIncomeUsed = myIncome > 0 ? (myExpense / myIncome) * 100 : 0;
      const remaining = targetExpense - myExpense;
      const isOverBudget = myExpense > targetExpense;

      return {
          targetExpense,
          percentageOfIncomeUsed,
          remaining,
          isOverBudget,
          monthlyBudgetPercentage
      };
  }, [stats.myIncomeForBudget, stats.myExpense, settings.monthlyBudgetPercentage]);

  const getBudgetColors = (percentage: number, limit: number) => {
      if (percentage >= limit) return 'bg-rose-500';
      if (percentage >= limit * 0.85) return 'bg-amber-500';
      return 'bg-emerald-500';
  };
  const budgetColor = getBudgetColors(budgetStats.percentageOfIncomeUsed, budgetStats.monthlyBudgetPercentage);

  const accumulatedStats = useMemo(() => {
      let realAccumulated = 0;
      let targetAccumulated = 0;
      let resetKey = '';
      if (settings.balanceResetDate) {
          const rDate = new Date(settings.balanceResetDate);
          const safeRDate = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate(), 12, 0, 0);
          resetKey = getYearMonthKey(safeRDate);
      }
      const currentViewKey = getYearMonthKey(currentDate);
      const monthlyHistory: Record<string, { income: number }> = {};

      transactions.forEach(t => {
          const effDate = calculateEffectiveDate(t, creditCards, settings);
          const tKey = getYearMonthKey(effDate);
          if (resetKey && tKey < resetKey) return;
          if (tKey > currentViewKey) return;
          if (isNathyTransaction(t)) return;

          if (!monthlyHistory[tKey]) monthlyHistory[tKey] = { income: 0 };

          if (t.type === TransactionType.INCOME) {
              realAccumulated += t.amount;
              monthlyHistory[tKey].income += t.amount;
          } else if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) {
              realAccumulated -= t.amount;
          }
      });

      const budgetPct = settings.monthlyBudgetPercentage || 80;
      const savingsTargetPct = (100 - budgetPct) / 100;
      Object.values(monthlyHistory).forEach(month => {
          targetAccumulated += (month.income * savingsTargetPct);
      });

      return { real: realAccumulated, target: targetAccumulated, diff: realAccumulated - targetAccumulated };
  }, [transactions, settings, categories, creditCards, currentDate]);

  const totalPatrimonioAtual = useMemo(() => {
      // Pedido do usuário: soma do patrimônio em investimento + saldo entre renda ativa - despesas realizadas
      // Para ser exato em não duplicar e ao mesmo tempo ser simples:
      // O Saldo Real em Caixa é: (Renda - Despesas) - (Compras de Investimento - Proventos/Vendas)
      let globalIncome = 0;
      let globalExpense = 0;
      let globalInvested = 0;
      let globalInvestmentsCashBack = 0;
      
      transactions.forEach(t => {
          if (isNathyTransaction(t)) return;
          if (t.type === TransactionType.INCOME) {
              globalIncome += t.amount;
          } else if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) {
              globalExpense += t.amount;
          } else if (t.type === TransactionType.INVESTMENT) {
              const ev = t.investmentDetails?.event;
              if (ev === 'BUY') globalInvested += t.amount;
              else if (['SELL', 'AMORTIZACAO', 'REEMBOLSO', 'DIVIDEND', 'JCP', 'RENDIMENTO'].includes(ev || '')) {
                  globalInvestmentsCashBack += t.amount;
              }
          }
      });
      
      const realCashBalance = (globalIncome - globalExpense) - globalInvested + globalInvestmentsCashBack;
      // Caso a intenção do usuário tenha sido literalmente somar Renda - Despesas (assumindo que seja o acumulado que guardou)
      // sem subtrair os aportes, podemos enviar as duas, mas para manter o Patrimonio exato:
      // A matemática correta da Riqueza atual é: (Valor de Mercado dos Ativos) + (Dinheiro vivo em contas/caixa)
      return investmentStats.totalCurrentValue + Math.max(0, realCashBalance);
  }, [transactions, investmentStats.totalCurrentValue]);


  const averageMonthlyContribution = useMemo(() => {
      // Group investments by year-month to calculate actual historical average
      const monthlyInvestments: Record<string, number> = {};
      transactions.forEach(t => {
          if (isNathyTransaction(t)) return;
          if (t.type === TransactionType.INVESTMENT) {
              const date = new Date(t.date);
              const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
              const ev = t.investmentDetails?.event;
              if (ev === 'BUY') {
                  monthlyInvestments[key] = (monthlyInvestments[key] || 0) + t.amount;
              } else if (['SELL', 'AMORTIZACAO', 'REEMBOLSO'].includes(ev || '')) {
                  monthlyInvestments[key] = (monthlyInvestments[key] || 0) - t.amount;
              }
          }
      });
      const values = Object.values(monthlyInvestments);
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, v) => acc + Math.max(0, v), 0);
      return sum / values.length;
  }, [transactions]);

  useEffect(() => {
      if (!isProjectionStateInitialized && totalPatrimonioAtual > 0) {
          if (investmentStats.portfolioAnnualXTIR > 0.5) {
              setAnnualReturn(Number(investmentStats.portfolioAnnualXTIR.toFixed(2)));
          }
          if (averageMonthlyContribution > 50) {
              setMonthlyAporte(Math.round(averageMonthlyContribution));
          } else if (stats.myInvestmentFromPocket > 0) {
              setMonthlyAporte(Math.round(stats.myInvestmentFromPocket));
          }
          setIsProjectionStateInitialized(true);
      }
  }, [totalPatrimonioAtual, investmentStats.portfolioAnnualXTIR, averageMonthlyContribution, stats.myInvestmentFromPocket, isProjectionStateInitialized]);

  const goalProjectionData = useMemo(() => {
      const p0 = totalPatrimonioAtual || 0;
      const a = monthlyAporte;
      const target = targetMet;
      
      const r = annualReturn > 0 ? (Math.pow(1 + (annualReturn / 100), 1/12) - 1) : 0;
      
      if (p0 >= target) {
          return {
              months: 0,
              years: 0,
              remainingMonths: 0,
              totalInvested: p0,
              totalInterest: 0,
              impossible: false,
              estimatedDateStr: 'Já alcançado!'
          };
      }
      
      if (r <= 0.00001) {
          if (a <= 0) {
              return { impossible: true, months: 0, years: 0, remainingMonths: 0, totalInvested: p0, totalInterest: 0, estimatedDateStr: 'Impossível' };
          }
          const totalMonths = Math.ceil((target - p0) / a);
          const y = Math.floor(totalMonths / 12);
          const m = totalMonths % 12;
          const totalInvested = p0 + (a * totalMonths);
          const totalInterest = 0;
          
          const estDate = new Date();
          estDate.setMonth(estDate.getMonth() + totalMonths);
          const estDateStr = estDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          
          return {
              months: totalMonths,
              years: y,
              remainingMonths: m,
              totalInvested,
              totalInterest,
              impossible: false,
              estimatedDateStr: estDateStr
          };
      }
      
      const numerator = (target * r) + a;
      const denominator = (p0 * r) + a;
      
      if (denominator <= 0 || numerator <= 0) {
          return { impossible: true, months: 0, years: 0, remainingMonths: 0, totalInvested: p0, totalInterest: 0, estimatedDateStr: 'Impossível' };
      }
      
      const n = Math.log(numerator / denominator) / Math.log(1 + r);
      const totalMonths = Math.ceil(n);
      
      if (isNaN(totalMonths) || !isFinite(totalMonths) || totalMonths < 0) {
          return { impossible: true, months: 0, years: 0, remainingMonths: 0, totalInvested: p0, totalInterest: 0, estimatedDateStr: 'Impossível' };
      }
      
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      
      let current = p0;
      let totalInvestedVal = p0;
      for (let month = 1; month <= totalMonths; month++) {
          current = (current * (1 + r)) + a;
          totalInvestedVal += a;
      }
      
      const totalInterestVal = Math.max(0, target - totalInvestedVal);
      
      const estDate = new Date();
      estDate.setMonth(estDate.getMonth() + totalMonths);
      const estDateStr = estDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      return {
          months: totalMonths,
          years: y,
          remainingMonths: m,
          totalInvested: totalInvestedVal,
          totalInterest: totalInterestVal,
          impossible: false,
          estimatedDateStr: estDateStr
      };
  }, [totalPatrimonioAtual, monthlyAporte, targetMet, annualReturn]);

  const chartData = useMemo(() => {
      if (goalProjectionData.impossible || goalProjectionData.months === 0) return [];
      
      const dataPoints: any[] = [];
      const p0 = totalPatrimonioAtual || 0;
      const a = monthlyAporte;
      const r = annualReturn > 0 ? (Math.pow(1 + (annualReturn / 100), 1/12) - 1) : 0;
      
      const totalMonths = goalProjectionData.months;
      const step = Math.max(1, Math.ceil(totalMonths / 12));
      
      let current = p0;
      let totalInvested = p0;
      
      dataPoints.push({
          label: 'Hoje',
          'Patrimônio': Math.round(p0),
          'Total Aportado': Math.round(totalInvested)
      });
      
      for (let month = 1; month <= totalMonths; month++) {
          current = (current * (1 + r)) + a;
          totalInvested += a;
          
          if (month % step === 0 || month === totalMonths) {
              const dateObj = new Date();
              dateObj.setMonth(dateObj.getMonth() + month);
              const labelStr = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
              dataPoints.push({
                  label: labelStr,
                  'Patrimônio': Math.round(current),
                  'Total Aportado': Math.round(totalInvested)
              });
          }
      }
      
      return dataPoints;
  }, [totalPatrimonioAtual, monthlyAporte, annualReturn, goalProjectionData]);


  const cardData = useMemo(() => {
    const groupedCredit = creditCards.map(card => {
      const cardTxs = filteredTransactions.filter(t => t.creditCardId === card.id && t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD);
      const total = cardTxs.reduce((sum, t) => sum + t.amount, 0);
      const myPart = cardTxs.reduce((sum, t) => {
          if (isNathyTransaction(t)) return sum;
          return sum + t.amount;
      }, 0);
      return { ...card, total, myPart };
    });
    return { groupedCredit };
  }, [creditCards, filteredTransactions, transactions, categories]); 

  const installmentStats = useMemo(() => {
    let userInstallmentTotal = 0;
    let nathyInstallmentTotal = 0;
    filteredTransactions.forEach(t => {
        if (t.totalInstallments && t.totalInstallments > 1 && t.type === TransactionType.EXPENSE && !t.fundedByResgate) {
             if (isNathyTransaction(t)) nathyInstallmentTotal += t.amount;
             else userInstallmentTotal += t.amount;
        }
    });
    return { userInstallmentTotal, nathyInstallmentTotal };
  }, [filteredTransactions, categories]);

  const historicalData = useMemo(() => {
    const data: any[] = [];
    const now = new Date(currentDate);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      let income = 0;
      let expense = 0;
      let investment = 0;

      transactions.forEach(t => {
        const effDate = calculateEffectiveDate(t, creditCards, settings);
        if (effDate.getMonth() === d.getMonth() && effDate.getFullYear() === d.getFullYear()) {
          if (t.type === TransactionType.INCOME) {
              income += t.amount;
          } else if (t.type === TransactionType.INVESTMENT) {
            const event = t.investmentDetails?.event;
            if (event === 'BUY') {
              if (!isNathyTransaction(t)) investment += t.amount;
            }
          } else {
            if (!isNathyTransaction(t) && !t.fundedByResgate) expense += t.amount;
          }
        }
      });

      data.push({
        name: monthStr,
        Receitas: income,
        Despesas: expense,
        Investimentos: investment
      });
    }
    return data;
  }, [transactions, creditCards, settings, currentDate, categories]);

  const projectionData = useMemo(() => {
      if (!projectionScope) return [];
      const projections = [];
      for (let i = 1; i <= 3; i++) {
          const futureDate = new Date(currentDate);
          futureDate.setMonth(futureDate.getMonth() + i);
          let total = 0;
          const items: Transaction[] = [];
          transactions.forEach(t => {
              if (t.type !== TransactionType.EXPENSE) return;
              if (!t.totalInstallments || t.totalInstallments <= 1) return;
              const isNathy = isNathyTransaction(t);
              if (projectionScope === 'user' && isNathy) return;
              if (projectionScope === 'nathy' && !isNathy) return;
              const effDate = calculateEffectiveDate(t, creditCards, settings);
              if (effDate.getMonth() === futureDate.getMonth() && effDate.getFullYear() === futureDate.getFullYear()) {
                  total += t.amount;
                  items.push(t);
              }
          });
          projections.push({
              date: futureDate,
              total,
              items: items.sort((a,b) => b.amount - a.amount)
          });
      }
      return projections;
  }, [projectionScope, transactions, currentDate, creditCards, settings, categories]);

  // --- RECENT LISTS ---
  const recentTransactions = useMemo(() => {
      // Show ONLY Income/Expense in this list
      return [...filteredTransactions]
        .filter(t => t.type !== TransactionType.INVESTMENT)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
  }, [filteredTransactions]);

  const recentDividends = useMemo(() => {
      // Show Only Investment Returns
      return transactions
        .filter(t => t.type === TransactionType.INVESTMENT && ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails?.event || ''))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6);
  }, [transactions]);

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

  const investmentPercent = stats.surplus > 0 ? (stats.myInvestment / stats.surplus) * 100 : 0;

  const annualTargetSavings = annualStats.myIncomeForBudget * ((100 - (settings.monthlyBudgetPercentage || 80)) / 100);
  const annualBalanceForBudget = annualStats.myIncomeForBudget - annualStats.myExpense;
  const annualDiff = annualBalanceForBudget - annualTargetSavings;
  const remainingMonths = 12 - (currentDate.getMonth() + 1);
  const requiredSavingsPerMonth = annualDiff < 0 && remainingMonths > 0 ? Math.abs(annualDiff) / remainingMonths : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      {/* HEADER: TOPBAR + DATE NAV PILL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Visão Geral</h1>
              <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">Resumo financeiro do período</p>
          </div>

          <div className="flex items-center gap-3">
              <div className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold ${stats.balance >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'}`}>
                  {stats.balance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {(monthlyInvestmentsList.length)} ativos aportados
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-4 pr-1.5 py-1.5 shadow-sm">
                  <Calendar size={14} className="text-blue-500 mr-1.5 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 capitalize whitespace-nowrap px-1">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                  <button
                    onClick={handlePrevMonth}
                    className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-colors active:scale-95"
                  >
                    <ChevronLeft size={15}/>
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-colors active:scale-95"
                  >
                    <ChevronRight size={15}/>
                  </button>
              </div>
          </div>
      </div>

      {/* SEÇÃO 1: FLUXO DE CAIXA MENSAL - RESUMO DOS APORTES E SALDOS */}
      <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
              <div>
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Movimentação do Mês</h3>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Fluxo de Caixa & Aportes</h2>
              </div>
              <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Sincronizado</span>
              </div>
          </div>

          {/* GRID DE KPIs PRIMÁRIOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                  title="Renda Mensal" 
                  value={stats.myIncome} 
                  icon={TrendingUp} 
                  color="emerald" 
                  subtext={
                      stats.myIncome !== stats.myIncomeForBudget ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              R$ {stats.myIncomeForBudget.toLocaleString('pt-BR')} elegíveis p/ meta
                          </span>
                      ) : (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Total de ganhos do período</span>
                      )
                  }
              />
              <KPICard 
                  title="Custo de Vida" 
                  value={stats.myExpense} 
                  icon={TrendingDown} 
                  color="rose" 
                  subtext={
                      stats.myResgateExpense > 0 ? (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                              (R$ {stats.myResgateExpense.toLocaleString('pt-BR')} cobertos por resgates)
                          </span>
                      ) : (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Despesas reais apuradas</span>
                      )
                  }
              />
              <KPICard 
                  title="Saldo Livre" 
                  value={stats.balance} 
                  icon={Wallet} 
                  color="indigo" 
                  subtext={
                      <span className="text-[10px] text-blue-500 dark:text-blue-400 font-semibold uppercase tracking-wider">
                          {stats.targetSavings > 0 ? ((stats.balance / stats.targetSavings) * 100).toFixed(1) : 0}% da meta de poupança
                      </span>
                  }
              />
              <KPICard 
                  title="Aporte Ativo" 
                  value={stats.myInvestmentFromPocket} 
                  icon={PiggyBank} 
                  color="zinc" 
                  onClick={() => setShowInvestmentDetails(!showInvestmentDetails)}
                  subtext={
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                          {investmentStats.monthlyGoal > 0 ? ((stats.myInvestmentFromPocket / investmentStats.monthlyGoal) * 100).toFixed(1) : 0}% da meta de aporte
                          <span className="text-[9px] text-blue-500 underline ml-auto font-bold">Ver detalhes</span>
                      </span>
                  }
              />
          </div>
      </div>

      {/* SEÇÃO 2: DETALHAMENTO DE PERFORMANCE & ALOCAÇÃO (FLAT LAYOUT - NO NESTED CARDS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ORÇAMENTO E HISTÓRICO - COL-SPAN-2 */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x md:divide-zinc-200/60 dark:md:divide-zinc-800/40">
                  
                  {/* ESQUERDA: CONTROLE DE ORÇAMENTO */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                              <Receipt size={18} />
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Limite & Orçamento</h4>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Consumo da Renda Ativa</p>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="space-y-2">
                              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                  <span>Limite Consumido</span>
                                  <span className={budgetStats.isOverBudget ? 'text-rose-500 font-bold' : 'text-zinc-600 dark:text-zinc-300'}>
                                      Meta: {budgetStats.monthlyBudgetPercentage}%
                                  </span>
                              </div>
                              <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-full overflow-hidden relative shadow-inner">
                                  <div 
                                      className="absolute top-0 bottom-0 w-0.5 bg-zinc-400/50 z-10"
                                      style={{ left: `${budgetStats.monthlyBudgetPercentage}%` }}
                                  />
                                  <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(budgetStats.percentageOfIncomeUsed, 100)}%` }}
                                      className={`h-full ${budgetColor} shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]`}
                                  />
                              </div>
                              <div className="flex justify-between items-center text-[11px] font-bold">
                                  <span className={budgetStats.isOverBudget ? 'text-rose-600' : 'text-emerald-600'}>
                                      {budgetStats.percentageOfIncomeUsed.toFixed(1)}% utilizado
                                  </span>
                                  <div className="flex items-center gap-1">
                                      {budgetStats.isOverBudget ? (
                                          <span className="text-rose-600 flex items-center gap-1 text-[10px]">
                                              <AlertTriangle size={12} /> Excedeu R$ {Math.abs(budgetStats.remaining).toLocaleString('pt-BR')}
                                          </span>
                                      ) : (
                                          <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
                                              <CheckCircle2 size={12} /> Sobram R$ {budgetStats.remaining.toLocaleString('pt-BR')}
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* DICA DE ORÇAMENTO */}
                          <div className={`p-3.5 rounded-2xl text-[11px] leading-relaxed font-medium ${budgetStats.isOverBudget ? 'bg-rose-500/5 text-rose-700 dark:text-rose-400 border border-rose-500/10' : 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border border-emerald-500/10'}`}>
                              {budgetStats.isOverBudget ? (
                                  <span>Você ultrapassou a meta de gastos de {budgetStats.monthlyBudgetPercentage}%. Evite despesas supérfluas nos próximos dias para reequilibrar o caixa.</span>
                              ) : (
                                  <span>Excelente controle de gastos! Você está operando dentro do limite estipulado, garantindo sua meta de poupança mensal.</span>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* DIREITA: HISTÓRICO DE ECONOMIA ANUAL (FLAT - NOT A NESTED CARD) */}
                  <div className="space-y-6 md:pl-8">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl">
                                  <BarChart3 size={18} />
                              </div>
                              <div>
                                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Histórico de Poupança</h4>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Performance Anual de {currentDate.getFullYear()}</p>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="space-y-2.5">
                              <div className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-800/40">
                                  <span className="font-bold text-zinc-500 dark:text-zinc-400">Renda Acumulada</span>
                                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">R$ {(annualStats.myIncome || 0).toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-800/40">
                                  <span className="font-bold text-zinc-500 dark:text-zinc-400">Gastos Acumulados</span>
                                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">R$ {(annualStats.myExpense || 0).toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs py-1">
                                  <span className="font-bold text-zinc-900 dark:text-zinc-200">Saldo Líquido</span>
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${annualStats.myBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                      R$ {(annualStats.myBalance || 0).toLocaleString('pt-BR')}
                                  </span>
                              </div>
                          </div>

                          {/* STATUS DA META ANUAL */}
                          <div>
                              {annualDiff < 0 ? (
                                  <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl space-y-1">
                                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider">
                                          <AlertTriangle size={12} /> Desvio de Meta
                                      </div>
                                      <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-normal font-medium">
                                          Abaixo da meta acumulada em <strong>R$ {Math.abs(annualDiff).toLocaleString('pt-BR')}</strong>.
                                          {remainingMonths > 0 && <span> Poupe <strong>R$ {requiredSavingsPerMonth.toLocaleString('pt-BR')}</strong>/mês para recuperar.</span>}
                                      </p>
                                  </div>
                              ) : (
                                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-1">
                                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                                          <Target size={12} /> Meta Saudável
                                      </div>
                                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-normal font-medium">
                                          Você está <strong>R$ {annualDiff.toLocaleString('pt-BR')}</strong> acima da meta acumulada. Ótimo trabalho!
                                      </p>
                                  </div>
                              )}
                          </div>
                      </div>

                  </div>
              </div>
          </div>

          {/* COMPOSIÇÃO DOS APORTES - COL-SPAN-1 */}
          <div className="bg-[#0e0f12] dark:bg-[#060709] p-8 rounded-3xl text-white shadow-lg relative overflow-hidden group border border-zinc-800">
              <div className="absolute -bottom-10 -right-10 opacity-[0.05] rotate-12 text-white group-hover:scale-110 group-hover:rotate-0 transition-transform duration-1000">
                  <Coins size={220} />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                  <div>
                      <div className="flex items-center gap-3.5 mb-6">
                          <div className="p-3 bg-zinc-800/80 text-white rounded-xl border border-white/5">
                              <Target size={18} />
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-white tracking-tight leading-none">Composição do Aporte</h4>
                              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Total: R$ {stats.myInvestment.toLocaleString('pt-BR')}</p>
                          </div>
                      </div>

                      <div className="space-y-3.5">
                          <div className="flex justify-between items-center group/item text-xs">
                              <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></div>
                                  <span className="font-semibold text-zinc-400 group-hover/item:text-white transition-colors">Dinheiro de Bolso</span>
                              </div>
                              <span className="font-bold text-white">R$ {(stats.myInvestmentFromPocket || 0).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between items-center group/item text-xs">
                              <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                                  <span className="font-semibold text-zinc-400 group-hover/item:text-white transition-colors">Prov. Reinvestidos</span>
                              </div>
                              <span className="font-bold text-white">R$ {(stats.myReinvestedProventos || 0).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between items-center group/item text-xs">
                              <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></div>
                                  <span className="font-semibold text-zinc-400 group-hover/item:text-white transition-colors">Resg. Reinvestidos</span>
                              </div>
                              <span className="font-bold text-white">R$ {(stats.myReinvestedResgates || 0).toLocaleString('pt-BR')}</span>
                          </div>
                          
                          {/* STACKED BAR */}
                          <div className="h-3 w-full bg-zinc-900 rounded-full flex overflow-hidden p-0.5 border border-zinc-800 shadow-inner">
                              <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myInvestmentFromPocket / stats.myInvestment) * 100 : 0}%` }}
                                  className="h-full bg-blue-500 rounded-l-full" 
                              />
                              <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myReinvestedProventos / stats.myInvestment) * 100 : 0}%` }}
                                  className="h-full bg-emerald-500" 
                              />
                              <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myReinvestedResgates / stats.myInvestment) * 100 : 0}%` }}
                                  className="h-full bg-purple-500 rounded-r-full" 
                              />
                          </div>
                      </div>
                  </div>

                  {/* BOTTOM REINVESTMENT / PROVENTOS SUMMARY */}
                  <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-[11px]">
                          <div>
                              <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider mb-1">Renda Passiva</p>
                              <p className="font-semibold text-emerald-400">R$ {(stats.myDividends || 0).toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider mb-1">Pool Retido</p>
                              <p className="font-semibold text-emerald-500">R$ {(stats.endingProventosPool || 0).toLocaleString('pt-BR')}</p>
                          </div>
                      </div>

                      {stats.myDividends > 0 && (
                          stats.myReinvestedProventos >= stats.myDividends ? (
                              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                  <ShieldCheck size={14} /> Reinvestido 100%
                              </div>
                          ) : (
                              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] text-amber-300 font-medium text-center leading-tight">
                                  R$ {((stats.myDividends - stats.myReinvestedProventos) || 0).toLocaleString('pt-BR')} ainda não foram reinvestidos neste mês.
                              </div>
                          )
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* INVESTMENT SUMMARY - COMPACT GESTÃO DE PATRIMÔNIO */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm p-5 md:p-6 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-6 h-[2px] bg-blue-500"></div>
                Gestão de Patrimônio
            </h3>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Tempo Real</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Patrimônio Atual -> Destaque */}
              <div className="bg-blue-600 p-4 rounded-2xl border border-blue-500 hover:shadow-md transition-all group/item overflow-hidden relative">
                  <div className="flex items-center gap-1.5 mb-1 group/tooltip relative z-10">
                      <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">Patrimônio Atual</span>
                      <Info size={12} className="text-blue-300 cursor-help" />
                      <div className="absolute top-7 left-0 bg-zinc-800 text-white text-[10px] p-2.5 rounded-xl w-60 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-opacity z-50 shadow-xl">
                          <strong>Composição:</strong> Valor de Mercado dos Investimentos + Saldo em Conta Corrente.
                      </div>
                  </div>
                  <span className="text-xl md:text-2xl font-bold text-white tracking-tight relative z-10">R$ {(totalPatrimonioAtual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="absolute -right-3 -bottom-3 opacity-[0.12] text-white">
                      <ShieldCheck size={56} />
                  </div>
              </div>

              {/* Resultado Líquido */}
              <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 hover:shadow-sm transition-all group/item overflow-hidden relative">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Resultado Líquido</span>
                  <span className={`text-lg md:text-xl font-bold tracking-tight ${investmentStats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {investmentStats.totalProfit >= 0 ? '+' : ''}R$ {(investmentStats.totalProfit || 0).toLocaleString('pt-BR')}
                  </span>
                  <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-zinc-900 dark:text-zinc-100">
                      <TrendingUp size={48} />
                  </div>
              </div>

              {/* Rentabilidade Anual */}
              <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 hover:shadow-sm transition-all group/item overflow-hidden relative">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Rentabilidade (a.a.)</span>
                  <span className={`text-lg md:text-xl font-bold tracking-tight ${investmentStats.portfolioAnnualXTIR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {investmentStats.portfolioAnnualXTIR >= 0 ? '+' : ''}{investmentStats.portfolioAnnualXTIR.toFixed(2)}%
                  </span>
                  <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-zinc-900 dark:text-zinc-100">
                      <Activity size={48} />
                  </div>
              </div>

              {/* Capital p/ Aporte */}
              <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 hover:shadow-sm transition-all group/item overflow-hidden relative">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Capital p/ Aporte</span>
                  <span className="text-lg md:text-xl font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                      R$ {Math.max(0, pocketInvestmentStats.activePool || 0).toLocaleString('pt-BR')}
                  </span>
                  <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-zinc-900 dark:text-zinc-100">
                      <Wallet size={48} />
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
              {/* Top Ativos */}
              <div className="lg:col-span-2 bg-zinc-900 rounded-2xl p-5 text-white relative overflow-hidden group/top">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
                    <Sparkles size={90} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ranking de Performance (Lucro Total)</span>
                    </div>
                    {investmentStats.top3.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {investmentStats.top3.map((asset, i) => (
                                <div key={i} className="flex flex-col gap-1.5 group/asset bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1.5 shrink-0">
                                            <img src={getAssetIcon(asset.ticker)} className="w-full h-full object-contain" onError={e => e.currentTarget.style.display='none'} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-bold tracking-tight truncate">{asset.ticker}</span>
                                          <span className="text-[9px] font-semibold text-zinc-400 uppercase">Ranking #{i+1}</span>
                                        </div>
                                    </div>
                                    <div className={`text-base font-bold ${asset.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        R$ {asset.profit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${(asset.profit / (investmentStats.top3[0]?.profit || 1)) * 100}%` }}
                                          className={`h-full ${asset.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-zinc-400 italic">Dados insuficientes para ranking.</span>
                    )}
                  </div>
              </div>

              {/* Pool Reinvestimento */}
              <div 
                  onClick={() => setShowInvestmentDetails(!showInvestmentDetails)}
                  className="bg-blue-600 rounded-2xl p-5 text-white relative overflow-hidden group/pool cursor-pointer active:scale-[0.98] transition-transform flex flex-col justify-between"
              >
                  <div className="absolute -bottom-2 -right-2 opacity-10 group-hover:scale-105 transition-transform duration-500">
                    <RefreshCcw size={110} />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block mb-2">Pool p/ Reinvestimento</span>
                        <div className="space-y-1">
                            <span className="text-2xl font-bold tracking-tight block leading-none">R$ {(pocketInvestmentStats.passivePool || 0).toLocaleString('pt-BR')}</span>
                            <span className="text-[10px] font-medium text-blue-100/80 block leading-tight mt-1">Proveniente de dividendos e juros.</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                          <span>Status do Caixa</span>
                          <span className="px-2.5 py-0.5 bg-white/20 rounded-full">Pronto</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      {/* SIMULADOR DE METAS / INDEPENDÊNCIA FINANCEIRA - OCULTADO POR PADRÃO */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow mt-6">
          <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isGoalSimulatorOpen ? 'mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800' : ''}`}>
              <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                      <Target size={20} />
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Simulador de Metas e Independência</h3>
                          {!isGoalSimulatorOpen && (
                              <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md uppercase tracking-wider">Ocultado</span>
                          )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Projete quando alcançará seus objetivos financeiros com base no seu histórico real de rendimentos e aportes.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl border border-blue-100 dark:border-blue-900/40">
                      <Sparkles size={13} className="shrink-0" />
                      <span>Histórico Ativo: {investmentStats.portfolioAnnualXTIR > 0.5 ? `${investmentStats.portfolioAnnualXTIR.toFixed(2)}% a.a.` : 'CDI de Referência'}</span>
                  </div>
                  <button
                      onClick={() => setIsGoalSimulatorOpen(!isGoalSimulatorOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
                  >
                      <span>{isGoalSimulatorOpen ? 'Ocultar Simulador' : 'Simular Metas'}</span>
                      {isGoalSimulatorOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
              </div>
          </div>

          {isGoalSimulatorOpen && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* CONTROLES (SLIDERS) */}
                      <div className="lg:col-span-5 space-y-6">
                          {/* Slider 1: Meta */}
                          <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                  <span>Meta de Patrimônio</span>
                                  <span className="text-sm font-semibold text-blue-600 font-mono">R$ {targetMet.toLocaleString('pt-BR')}</span>
                              </div>
                              <input 
                                  type="range" 
                                  min={100000} 
                                  max={5000000} 
                                  step={50000}
                                  value={targetMet} 
                                  onChange={(e) => setTargetMet(Number(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                                  <span>R$ 100 mil</span>
                                  <span>R$ 5 milhões</span>
                              </div>
                          </div>

                          {/* Slider 2: Aporte Mensal */}
                          <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                  <span>Aporte Mensal Previsto</span>
                                  <span className="text-sm font-semibold text-blue-600 font-mono">R$ {monthlyAporte.toLocaleString('pt-BR')}</span>
                              </div>
                              <input 
                                  type="range" 
                                  min={0} 
                                  max={30000} 
                                  step={250}
                                  value={monthlyAporte} 
                                  onChange={(e) => setMonthlyAporte(Number(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                                  <span>R$ 0</span>
                                  <span>R$ 30 mil / mês</span>
                              </div>
                          </div>

                          {/* Slider 3: Rentabilidade */}
                          <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                  <span>Retorno Esperado (a.a.)</span>
                                  <span className="text-sm font-semibold text-blue-600 font-mono">{annualReturn.toFixed(1)}%</span>
                              </div>
                              <input 
                                  type="range" 
                                  min={0} 
                                  max={30} 
                                  step={0.5}
                                  value={annualReturn} 
                                  onChange={(e) => setAnnualReturn(Number(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                                  <span>0% a.a.</span>
                                  <span>30% a.a.</span>
                              </div>
                          </div>

                          {/* COMPARAÇÃO HISTÓRICA */}
                          <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed flex items-start gap-2.5">
                              <Info size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                              <div>
                                  <p className="font-semibold mb-1 text-zinc-700 dark:text-zinc-300">Seu comportamento de investimento histórico:</p>
                                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                                      <li>Patrimônio de Partida: <strong>R$ {totalPatrimonioAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></li>
                                      <li>Média Real de Aportes: <strong>R$ {averageMonthlyContribution.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês</strong></li>
                                      <li>Rentabilidade Anual XTIR: <strong className={investmentStats.portfolioAnnualXTIR >= 0 ? "text-emerald-600" : "text-rose-600"}>{investmentStats.portfolioAnnualXTIR.toFixed(2)}% a.a.</strong></li>
                                  </ul>
                              </div>
                          </div>
                      </div>

                      {/* PAINEL DE RESULTADOS */}
                      <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                          {goalProjectionData.impossible ? (
                              <div className="flex-1 bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                                  <AlertTriangle size={36} className="text-rose-500 mb-2" />
                                  <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wider mb-1">Simulação Inviável</h4>
                                  <p className="text-xs text-rose-600 max-w-sm">Com aporte de zero ou juros nulos/negativos, a meta de R$ {targetMet.toLocaleString('pt-BR')} não poderá ser atingida. Aumente o aporte mensal ou revise a rentabilidade esperada.</p>
                              </div>
                          ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Card Tempo Estimado */}
                                  <div className="bg-gradient-to-br from-blue-50/30 to-blue-50/10 dark:from-blue-500/5 dark:to-blue-500/10 border border-blue-100/50 dark:border-blue-900/30 rounded-3xl p-5 flex flex-col justify-between group/result hover:border-blue-200/50 dark:hover:border-blue-800/50 transition-colors text-blue-950 dark:text-blue-200">
                                      <div>
                                          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300/80 uppercase tracking-wider block mb-2">Tempo Estimado</span>
                                          <span className="text-2xl font-bold text-blue-950 dark:text-blue-100 tracking-tight block leading-none">
                                              {goalProjectionData.years > 0 ? `${goalProjectionData.years} ${goalProjectionData.years === 1 ? 'ano' : 'anos'}` : ''}
                                              {goalProjectionData.years > 0 && goalProjectionData.remainingMonths > 0 ? ' e ' : ''}
                                              {goalProjectionData.remainingMonths > 0 || goalProjectionData.years === 0 ? `${goalProjectionData.remainingMonths} ${goalProjectionData.remainingMonths === 1 ? 'mês' : 'meses'}` : ''}
                                          </span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-4 uppercase tracking-wider flex items-center gap-1">
                                          <Calendar size={12} /> {goalProjectionData.estimatedDateStr}
                                      </span>
                                  </div>

                                  {/* Card Total Investido */}
                                  <div className="bg-zinc-50/40 dark:bg-zinc-950/30 border border-zinc-200/40 dark:border-zinc-800/40 rounded-3xl p-5 flex flex-col justify-between group/result hover:border-zinc-300 dark:border-zinc-700/50 transition-colors">
                                      <div>
                                          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Seus Aportes</span>
                                          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight block leading-none">
                                              R$ {goalProjectionData.totalInvested.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                          </span>
                                      </div>
                                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-4 block">
                                          Soma do patrimônio atual + parcelas mensais.
                                      </span>
                                  </div>

                                  {/* Card Juros Compostos */}
                                  <div className="bg-emerald-50/30 dark:bg-emerald-500/5 border border-emerald-100/50 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col justify-between group/result hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-colors text-emerald-950 dark:text-emerald-200">
                                      <div>
                                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-2">Juros Recebidos</span>
                                          <span className="text-xl font-bold text-emerald-950 dark:text-emerald-200 tracking-tight block leading-none">
                                              R$ {goalProjectionData.totalInterest.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                          </span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-4 uppercase tracking-wider flex items-center gap-1">
                                          <TrendingUp size={12} /> {goalProjectionData.totalInvested > 0 ? ((goalProjectionData.totalInterest / targetMet) * 100).toFixed(1) : 0}% da meta
                                      </span>
                                  </div>
                              </div>
                          )}

                          {/* GRÁFICO DE CRESCIMENTO */}
                          {!goalProjectionData.impossible && chartData.length > 0 && (
                              <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl p-5 flex-1 flex flex-col justify-between min-h-[220px]">
                                  <div className="flex justify-between items-center mb-3">
                                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Crescimento Patrimonial vs. Aportes</span>
                                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Patrimônio</span>
                                          <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-zinc-400"></span> Total Aportado</span>
                                      </div>
                                  </div>
                                  <div className="w-full h-[140px]">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                              <defs>
                                                  <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                                                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                  </linearGradient>
                                                  <linearGradient id="colorAportado" x1="0" y1="0" x2="0" y2="1">
                                                      <stop offset="5%" stopColor="#71717a" stopOpacity={0.1}/>
                                                      <stop offset="95%" stopColor="#71717a" stopOpacity={0}/>
                                                  </linearGradient>
                                              </defs>
                                              <XAxis 
                                                  dataKey="label" 
                                                  tickLine={false} 
                                                  axisLine={false} 
                                                  tick={{ fontSize: 9, fill: '#71717a', fontWeight: 500 }} 
                                              />
                                              <YAxis 
                                                  tickLine={false} 
                                                  axisLine={false} 
                                                  tick={{ fontSize: 9, fill: '#71717a', fontWeight: 500 }}
                                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                              />
                                              <Tooltip 
                                                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]}
                                                  contentStyle={{ fontSize: 11, borderRadius: '1rem', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                                              />
                                              <Area type="monotone" dataKey="Patrimônio" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorPatrimonio)" />
                                              <Area type="monotone" dataKey="Total Aportado" stroke="#71717a" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={1} fill="url(#colorAportado)" />
                                          </AreaChart>
                                      </ResponsiveContainer>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}
      </div>
      
      {/* ... rest of the dashboard ... */}



      {showInvestmentDetails && monthlyInvestmentsList.length > 0 && (
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-t-0 border-zinc-200 dark:border-zinc-800/80 p-5 -mt-2 mb-6 rounded-b-3xl mx-1 shadow-inner animate-in slide-in-from-top-2">
              <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-blue-600 dark:text-blue-400"/> Detalhamento dos Aportes do Mês
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {monthlyInvestmentsList.map(t => (
                      <div key={t.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40 flex justify-between items-center text-sm shadow-sm">
                          <div className="flex flex-col overflow-hidden">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{t.investmentDetails?.ticker}</span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{t.description}</span>
                          </div>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-2 shrink-0">R$ {(t.amount || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* DETALHAMENTO: CARTÃO DE CRÉDITO, DEBITO E DINHEIRO */}
      {stats.expense > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cartões de Crédito */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm p-5 md:p-6 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                            <CardIcon size={18} />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider">Cartões de Crédito</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Faturas</span>
                </div>
                <div className="mb-4">
                    <span className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight">R$ {(stats.creditTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {cardData.groupedCredit.map(card => {
                        if (card.total === 0) return null;
                        const percentage = stats.creditTotal > 0 ? (card.total / stats.creditTotal) * 100 : 0;
                        return (
                            <div key={card.id} className="flex justify-between items-center py-2.5 group">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <BankLogo bankId={card.icon || 'generic'} className="w-7 h-7 rounded-lg shrink-0 shadow-sm" />
                                    <div className="min-w-0">
                                        <span className="block font-bold text-zinc-800 dark:text-zinc-200 text-xs truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{card.name}</span>
                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Minha parte: <strong className="text-zinc-700 dark:text-zinc-300">R$ {(card.myPart || 0).toLocaleString('pt-BR')}</strong></span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="block font-bold text-zinc-900 dark:text-zinc-100 text-xs">R$ {(card.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">{percentage.toFixed(0)}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Débito & Dinheiro */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm p-5 md:p-6 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl">
                                <Banknote size={18} />
                            </div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Débito & Dinheiro</h3>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">À Vista</span>
                    </div>
                    <div className="mb-3">
                        <span className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight">R$ {(stats.debitTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {stats.debitResgateExpense > 0 && (
                            <span className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80 block mt-1">
                                (Inclui R$ {stats.debitResgateExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em resgates)
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-4">
                    <Info size={14} className="text-emerald-500 shrink-0" />
                    <span>Pagamentos e débitos automáticos realizados diretamente no saldo em conta corrente ou espécie.</span>
                </div>
            </div>
        </div>
      )}

      {/* PARCELAS */}
      {(installmentStats.userInstallmentTotal > 0 || installmentStats.nathyInstallmentTotal > 0) && (
          <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={14} className="text-blue-500"/> Projeção de Parcelas</h3>
              <div className="flex gap-3">
                  {installmentStats.userInstallmentTotal > 0 && (
                      <button onClick={() => setProjectionScope(projectionScope === 'user' ? null : 'user')} className={`flex-1 p-3.5 rounded-2xl border transition-all text-left group ${projectionScope === 'user' ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 ring-2 ring-blue-500/20 shadow-inner' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-blue-50/50 hover:border-blue-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider block transition-colors ${projectionScope === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500'}`}>Minhas Parcelas</span>
                              {projectionScope === 'user' ? <ChevronUp size={14} className="text-blue-500"/> : <ChevronDown size={14} className="text-zinc-400 group-hover:text-blue-400"/>}
                          </div>
                          <span className={`text-xl font-bold tracking-tight transition-colors ${projectionScope === 'user' ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'}`}>R$ {(installmentStats.userInstallmentTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </button>
                  )}
                  {installmentStats.nathyInstallmentTotal > 0 && (
                      <button onClick={() => setProjectionScope(projectionScope === 'nathy' ? null : 'nathy')} className={`flex-1 p-3.5 rounded-2xl border transition-all text-left group ${projectionScope === 'nathy' ? 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 ring-2 ring-pink-500/20 shadow-inner' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-pink-50/50 hover:border-pink-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider block transition-colors ${projectionScope === 'nathy' ? 'text-pink-600 dark:text-pink-400' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-pink-500'}`}>Parcelas Nathy</span>
                              {projectionScope === 'nathy' ? <ChevronUp size={14} className="text-pink-500"/> : <ChevronDown size={14} className="text-zinc-400 group-hover:text-pink-400"/>}
                          </div>
                          <span className={`text-xl font-bold tracking-tight transition-colors ${projectionScope === 'nathy' ? 'text-pink-700 dark:text-pink-300' : 'text-zinc-800 dark:text-zinc-200'}`}>R$ {(installmentStats.nathyInstallmentTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </button>
                  )}
              </div>
              {projectionScope && projectionData.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in slide-in-from-top-3 duration-300">
                      {projectionData.map((monthData, idx) => (
                          <div key={idx} className="bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 h-[180px] flex flex-col hover:bg-white dark:hover:bg-zinc-900 hover:shadow-sm transition-all">
                              <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
                                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 capitalize tracking-wide">{monthData.date.toLocaleDateString('pt-BR', { month: 'long' })}</span>
                                  <span className={`text-xs md:text-sm font-bold ${projectionScope === 'nathy' ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400'}`}>R$ {(monthData.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                              </div>
                              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1.5 pr-1">
                                  {monthData.items.map((t, tIdx) => (
                                      <div key={tIdx} className="flex justify-between items-center text-[11px] text-zinc-600 dark:text-zinc-400 group">
                                          <span className="truncate max-w-[130px] group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors font-medium">{t.description.replace(/\s\(\d+\/\d+\)$/, '')}</span>
                                          <span className="font-bold text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400">{t.installmentIndex}/{t.totalInstallments}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* BOTTOM ROW: RECENT TRANSACTIONS (Left) | DIVIDENDS (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          
          {/* LATEST TRANSACTIONS SECTION */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden flex flex-col h-[400px] hover:shadow-md transition-all group">
              <div className="p-4 md:p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl shadow-xs">
                        <Clock size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm md:text-base tracking-tight leading-none">Últimos Lançamentos</h3>
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Sincronizado agora</p>
                    </div>
                  </div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40 overflow-y-auto flex-1 custom-scrollbar p-1.5">
                  {recentTransactions.map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      return (
                          <div key={t.id} 
                               onClick={() => onEditTransaction(t)}
                               className="p-3 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group/row rounded-xl my-0.5 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/60 cursor-pointer active:scale-[0.99]"
                          >
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all group-hover/row:scale-105 ${t.type === TransactionType.INCOME ? 'bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                      <IconRenderer iconName={cat?.icon || 'circle'} size={16} />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                      <span className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-[200px] group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors uppercase tracking-tight">{t.description}</span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{new Date(t.date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded truncate max-w-[100px]">{cat?.name}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right shrink-0 pl-2">
                                <span className={`text-xs md:text-sm font-bold whitespace-nowrap block ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                    {t.type === TransactionType.INCOME ? '+' : ''} R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Confirmado</span>
                              </div>
                          </div>
                      );
                  })}
                  {recentTransactions.length === 0 && (
                      <div className="p-12 text-center text-xs text-zinc-400 italic flex flex-col items-center gap-3 opacity-60">
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full">
                            <Clock size={32} className="text-zinc-300" />
                          </div>
                          <span className="uppercase font-bold tracking-widest text-[10px]">Nenhum lançamento recente</span>
                      </div>
                  )}
              </div>
          </div>

          {/* RECENT DIVIDENDS SECTION */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden flex flex-col h-[400px] hover:shadow-md transition-all group">
              <div className="p-4 md:p-5 border-b border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/20 dark:bg-emerald-950/10 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <Gift size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm md:text-base tracking-tight leading-none">Últimos Proventos</h3>
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Renda Passiva Recebida</p>
                    </div>
                  </div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40 overflow-y-auto flex-1 custom-scrollbar p-1.5">
                  {transactions
                    .filter(t => t.type === TransactionType.INVESTMENT && ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails?.event || ''))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 8)
                    .map(t => (
                      <div key={t.id} 
                           onClick={() => onEditTransaction(t)}
                           className="p-3 flex justify-between items-center hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all group/row rounded-xl my-0.5 border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/30 cursor-pointer active:scale-[0.99]"
                      >
                           <div className="flex items-center gap-3 overflow-hidden">
                               <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-center p-1.5 shadow-xs shrink-0 transition-all group-hover/row:scale-105">
                                   <img src={getAssetIcon(t.investmentDetails?.ticker || '')} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                               </div>
                               <div className="flex flex-col min-w-0">
                                   <span className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100 group-hover/row:text-emerald-600 dark:group-hover/row:text-emerald-400 transition-colors uppercase tracking-tight">{t.investmentDetails?.ticker}</span>
                                   <div className="flex items-center gap-1.5 mt-0.5">
                                     <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{new Date(t.date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                                     <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                                     <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">{t.investmentDetails?.event}</span>
                                   </div>
                               </div>
                           </div>
                           <div className="text-right shrink-0 pl-2">
                             <span className="text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-400 block">+ R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                             <span className="text-[9px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Entrada</span>
                           </div>
                      </div>
                  ))}
                  {transactions.filter(t => t.type === TransactionType.INVESTMENT && ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails?.event || '')).length === 0 && (
                      <div className="p-12 text-center text-xs text-zinc-400 italic flex flex-col items-center gap-3 opacity-60">
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-full">
                            <Gift size={32} className="text-emerald-300" />
                          </div>
                          <span className="uppercase font-bold tracking-widest text-[10px]">Nenhum provento recebido</span>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
