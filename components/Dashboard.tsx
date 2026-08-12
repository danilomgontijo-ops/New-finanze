
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, UserSettings, PaymentMethod, CreditCard, SubCategory, AssetPrice } from '../types';
import { GeminiService } from '../services/geminiService';
import { usePortfolioData } from '../hooks/usePortfolio';
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
  cdiHistory?: { date: string; value: number }[];
  ipcaHistory?: { date: string; value: number }[];
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

const formatCurrency = (val: number, currency: string = 'BRL') => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const toIsoDateStr = (input: string | Date | undefined): string => {
    if (!input) return new Date().toISOString().split("T")[0];
    if (input instanceof Date) {
        if (isNaN(input.getTime())) return new Date().toISOString().split("T")[0];
        return input.toISOString().split("T")[0];
    }
    const str = String(input).trim();
    if (str.includes("T")) {
        return str.split("T")[0];
    }
    if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(str)) {
        const parts = str.split(/[\/-]/);
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        const year = parts[2].substring(0, 4);
        return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
};

const safeFormatPtBR = (dateVal: any, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateVal) return "--/--/----";
  try {
    const iso = toIsoDateStr(dateVal);
    const parts = iso.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return d.toLocaleDateString("pt-BR", options);
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR", options);
  } catch {
    // fallback
  }
  return String(dateVal || "");
};

// Robust XIRR Calculation with fallback
const calculateXIRR = (values: number[], dates: Date[], guess: number = 0.1): number => {
  if (!values || !dates || values.length < 2) return 0;
  if (values.every((v) => v >= 0) || values.every((v) => v <= 0)) return 0;

  const flows = values
    .map((val, idx) => ({ amount: val, date: new Date(dates[idx]) }))
    .filter((f) => !isNaN(f.date.getTime()) && !isNaN(f.amount))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flows.length < 2) return 0;

  const startDate = flows[0].date;
  const endDate = flows[flows.length - 1].date;
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 1) {
    const totalOutflow = flows.filter((f) => f.amount < 0).reduce((acc, f) => acc + Math.abs(f.amount), 0);
    const totalInflow = flows.filter((f) => f.amount > 0).reduce((acc, f) => acc + f.amount, 0);
    if (totalOutflow > 0) {
      return ((totalInflow - totalOutflow) / totalOutflow) * 100;
    }
    return 0;
  }

  const xirr = (sortedFlows: { date: Date; amount: number }[], initialGuess: number) => {
    const limit = 100;
    const tol = 1e-6;
    let x0 = initialGuess;

    for (let i = 0; i < limit; i++) {
      let fValue = 0;
      let fDerivative = 0;

      for (let j = 0; j < sortedFlows.length; j++) {
        const dt = (sortedFlows[j].date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (dt < 0) continue;

        const base = 1 + x0;
        if (base <= 0) {
          x0 = -0.99;
          break;
        }

        const factor = Math.pow(base, dt);
        fValue += sortedFlows[j].amount / factor;
        fDerivative += (-dt * sortedFlows[j].amount) / (factor * base);
      }

      if (Math.abs(fDerivative) < 1e-12) break;
      const step = fValue / fDerivative;
      const stepDampened = Math.max(-0.5, Math.min(0.5, step));
      const x1 = x0 - stepDampened;

      if (Math.abs(x1 - x0) < tol) return x1;
      x0 = x1;
      if (x0 <= -0.999) x0 = -0.99;
    }
    return x0;
  };

  try {
    let result = xirr(flows, guess);

    if (isNaN(result) || !isFinite(result) || Math.abs(result) > 10 || result <= -1) {
      const guesses = [0.05, -0.05, 0.2, -0.2, 0.5];
      for (const g of guesses) {
        const altResult = xirr(flows, g);
        if (!isNaN(altResult) && isFinite(altResult) && Math.abs(altResult) <= 10 && altResult > -1) {
          result = altResult;
          break;
        }
      }
    }

    if (isNaN(result) || !isFinite(result) || result <= -1) return 0;

    const annualRatePct = result * 100;
    if (diffDays < 30 && Math.abs(annualRatePct) > 500) {
      const totalOutflow = flows.filter((f) => f.amount < 0).reduce((acc, f) => acc + Math.abs(f.amount), 0);
      const totalInflow = flows.filter((f) => f.amount > 0).reduce((acc, f) => acc + f.amount, 0);
      if (totalOutflow > 0) {
        return ((totalInflow - totalOutflow) / totalOutflow) * 100;
      }
    }

    return annualRatePct;
  } catch (e) {
    return 0;
  }
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

const KPICard = ({ title, value, icon: Icon, color, subtext, onClick }: { title: string, value: number, icon: any, color: 'emerald' | 'rose' | 'indigo' | 'violet' | 'zinc', subtext?: React.ReactNode, onClick?: () => void }) => {
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
            whileHover={{ y: -2 }}
            whileTap={onClick ? { scale: 0.98 } : {}}
            onClick={onClick}
            className={`p-5 rounded-2xl border ${v.border} bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700' : 'cursor-default'} relative overflow-hidden group`}
        >
            <div className={`p-3 rounded-xl ${v.iconBg} transition-transform group-hover:scale-105 shrink-0`}>
                <Icon strokeWidth={1.8} size={22} />
            </div>
            <div className="relative z-10 flex-1 min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold uppercase tracking-wider mb-1 truncate">{title}</p>
                <h3 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none truncate tabular-nums">
                    {formatCurrency((value || 0))}
                </h3>
                {subtext && <div className="mt-1.5 leading-tight">{subtext}</div>}
            </div>
            {onClick && (
                <div className="text-zinc-400 group-hover:text-violet-500 transition-colors shrink-0">
                    <ArrowRight strokeWidth={1.8} size={18} />
                </div>
            )}
        </motion.div>
    );
};

export const Dashboard = ({
  cdiHistory = [],
  ipcaHistory = [],
  transactions,
  categories,
  subCategories,
  creditCards,
  assetPrices,
  settings,
  currentDate,
  onDateChange,
  onEditTransaction,
  onDeleteTransaction
}: DashboardProps) => {
  // Navigation
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

  // State

  const [showInvestmentDetails, setShowInvestmentDetails] = useState(false);
    const [projectionScope, setProjectionScope] = useState<'user' | 'nathy' | null>(null);

  // Goal simulator state
      
  // Helper filter
  const isNathyTransaction = (t: Transaction) => {
    const nathyCatId = categories?.find(c => c.name.toLowerCase() === 'nathy')?.id;
    const isNathyCat = Boolean(nathyCatId && t.categoryId === nathyCatId);
    const isNathyDesc = Boolean(t.description && t.description.toLowerCase().includes('(parte nathy)'));
    return isNathyCat || isNathyDesc;
  };

  // Transactions for current month
  const currentMonthKey = getYearMonthKey(currentDate);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const effDate = calculateEffectiveDate(t, creditCards, settings);
      return getYearMonthKey(effDate) === currentMonthKey;
    });
  }, [transactions, creditCards, settings, currentMonthKey]);

  // Monthly Investments List (Only BUY and BONUS aportes)
  const monthlyInvestmentsList = useMemo(() => {
    return filteredTransactions.filter(t => {
      if (t.type !== TransactionType.INVESTMENT) return false;
      const isNathy = isNathyTransaction(t);
      if (isNathy) return false;
      const event = t.investmentDetails?.event || 'BUY';
      return ['BUY', 'BONUS'].includes(event);
    });
  }, [filteredTransactions]);

  // Monthly Pocket Investment Stats
  const pocketInvestmentStats = useMemo(() => {
    let activePool = 0;
    let totalProventosReceived = 0;
    let totalProventosReinvested = 0;
    let totalResgatesReceived = 0;
    let totalResgatesReinvested = 0;
    let currentProventosPool = 0;
    let currentResgatesPool = 0;
    const txBreakdown = new Map<string, { pocket: number, provento: number, resgate: number }>();

    const currentYearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const sortedTxs = [...transactions]
      .filter(t => t.date.slice(0, 7) <= currentYearMonth)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group transactions by year-month
    const txByMonth = new Map<string, Transaction[]>();
    sortedTxs.forEach(t => {
      const ym = t.date.slice(0, 7);
      if (!txByMonth.has(ym)) {
        txByMonth.set(ym, []);
      }
      txByMonth.get(ym)!.push(t);
    });

    const sortedMonths = Array.from(txByMonth.keys()).sort();

    sortedMonths.forEach(ym => {
      const monthTxs = txByMonth.get(ym)!;

      // 1. Accumulate all monthly proventos and resgates received BEFORE processing investments
      let monthProventos = 0;
      let monthResgates = 0;

      monthTxs.forEach(t => {
        if (t.type === TransactionType.INVESTMENT) {
          const isNathy = isNathyTransaction(t);
          if (isNathy) return;

          const event = t.investmentDetails?.event || 'BUY';
          if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(event)) {
            monthProventos += t.amount;
            totalProventosReceived += t.amount;
          } else if (event === 'SELL' || event === 'AMORTIZACAO') {
            monthResgates += t.amount;
            totalResgatesReceived += t.amount;
          }
        }
      });

      currentProventosPool += monthProventos;
      currentResgatesPool += monthResgates;

      // 2. Calculate total monthly investment (BUY/BONUS)
      let monthInvested = 0;
      const monthBuys: Transaction[] = [];

      monthTxs.forEach(t => {
        if (t.type === TransactionType.INVESTMENT) {
          const isNathy = isNathyTransaction(t);
          if (isNathy) return;

          const event = t.investmentDetails?.event || 'BUY';
          if (['BUY', 'BONUS'].includes(event)) {
            monthInvested += t.amount;
            monthBuys.push(t);
          }
        }
      });

      // 3. Subtract proventos and resgates pool from total monthly invested amount
      let monthResgateUsed = 0;
      let monthProventoUsed = 0;
      let monthPocket = 0;

      if (monthInvested > 0) {
        // First try to use Resgates Pool
        monthResgateUsed = Math.min(monthInvested, currentResgatesPool);
        currentResgatesPool -= monthResgateUsed;
        const remaining = monthInvested - monthResgateUsed;

        // Next try to use Proventos Pool
        monthProventoUsed = Math.min(remaining, currentProventosPool);
        currentProventosPool -= monthProventoUsed;

        // The rest is pocket money
        monthPocket = remaining - monthProventoUsed;

        totalProventosReinvested += monthProventoUsed;
        totalResgatesReinvested += monthResgateUsed;
        activePool += monthPocket;

        // 4. Distribute the monthly totals proportionally to each transaction of this month
        monthBuys.forEach(t => {
          const ratio = t.amount / monthInvested;
          txBreakdown.set(t.id, {
            pocket: monthPocket * ratio,
            provento: monthProventoUsed * ratio,
            resgate: monthResgateUsed * ratio
          });
        });
      }
    });

    return { 
      activePool, 
      passivePool: currentProventosPool + currentResgatesPool, 
      resgatesPool: currentResgatesPool,
      totalProventosReceived, 
      totalProventosReinvested,
      txBreakdown
    };
  }, [transactions, categories, currentDate]);

  // Monthly stats
  const stats = useMemo(() => {
    let myIncome = 0;
    let myIncomeForBudget = 0;
    let myExpense = 0;
    let myResgateExpense = 0;
    let myInvestmentFromPocket = 0;
    let myInvestment = 0;
    let myReinvestedProventos = 0;
    let myReinvestedResgates = 0;
    let myCreditTotal = 0;
    let totalCredit = 0;
    let debitTotal = 0;

    filteredTransactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      const isShared = t.isShared;
      
      if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          totalCredit += t.amount;
      }
      
      if (isNathy && !isShared) return;

      if (t.type === TransactionType.INCOME) {
        myIncome += t.amount;
        if (!t.excludeFromBudget) {
          myIncomeForBudget += t.amount;
        }
      } else if (t.type === TransactionType.EXPENSE) {
        myExpense += isShared ? (t.amount / 2) : t.amount;
        if (t.fundedByResgate) {
          myResgateExpense += isShared ? (t.amount / 2) : t.amount;
        }
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          myCreditTotal += isShared ? (t.amount / 2) : t.amount;
        } else {
          debitTotal += isShared ? (t.amount / 2) : t.amount;
        }
      } else if (t.type === TransactionType.INVESTMENT) {
        const event = t.investmentDetails?.event || 'BUY';
        if (['BUY', 'BONUS'].includes(event)) {
          myInvestment += t.amount;
          const breakdown = pocketInvestmentStats.txBreakdown.get(t.id);
          if (breakdown) {
            myInvestmentFromPocket += breakdown.pocket;
            myReinvestedProventos += breakdown.provento;
            myReinvestedResgates += breakdown.resgate;
          } else {
            // Fallback just in case
            myInvestmentFromPocket += t.amount;
          }
        }
      }
    });

    const expense = myExpense;
    const balance = myIncome - myExpense;
    const incomeForBudget = myIncomeForBudget > 0 ? myIncomeForBudget : myIncome;
    const fallbackTargetSavings = (incomeForBudget * (100 - (settings.monthlyBudgetPercentage || 80))) / 100;
    const targetSavings = (settings.monthlySavingsGoal && settings.monthlySavingsGoal > 0) 
      ? settings.monthlySavingsGoal 
      : fallbackTargetSavings;
    const endingProventosPool = pocketInvestmentStats.passivePool;

    return {
      myIncome,
      myIncomeForBudget,
      myExpense,
      myResgateExpense,
      myInvestmentFromPocket,
      myInvestment,
      myReinvestedProventos,
      myReinvestedResgates,
      endingProventosPool,
      expense,
      balance,
      targetSavings,
      myCreditTotal,
      totalCredit,
      debitTotal
    };
  }, [filteredTransactions, settings, pocketInvestmentStats, categories]);

  // Annual stats
  const annualStats = useMemo(() => {
    let myIncome = 0;
    let myExpense = 0;
    const currentYear = currentDate.getFullYear();

    transactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      if (isNathy) return;

      const effDate = calculateEffectiveDate(t, creditCards, settings);
      if (effDate.getFullYear() === currentYear) {
        if (t.type === TransactionType.INCOME) myIncome += t.amount;
        if (t.type === TransactionType.EXPENSE) myExpense += t.amount;
      }
    });

    const myBalance = myIncome - myExpense;
    return { myIncome, myExpense, myBalance };
  }, [transactions, creditCards, settings, currentDate, categories]);

  const annualTargetSavings = (settings.monthlySavingsGoal || 0) * (currentDate.getMonth() + 1);
  const annualDiff = annualStats.myBalance - annualTargetSavings;
  const monthsRemaining = 12 - (currentDate.getMonth() + 1);
  const requiredSavingsPerMonth = monthsRemaining > 0 && annualDiff < 0 
    ? Math.abs(annualDiff) / monthsRemaining 
    : 0;

  // Investment stats
      // Monthly Pocket Investment Stats
  const { summary: portfolioSummary, list: portfolioList } = usePortfolioData(transactions, assetPrices, categories, subCategories, cdiHistory, ipcaHistory);

  const investmentStats = useMemo(() => {
    // Sort by totalReturnPct to show real highlights, including fixed income (filter out zero balance/cost)
    const top3 = [...portfolioList]
      .filter((a) => a.currentTotal > 1 && a.totalCost > 0)
      .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
      .slice(0, 3);
    let monthlyGoal = settings.monthlySavingsGoal || 0;
    if (!monthlyGoal || monthlyGoal <= 0) {
      const inc = stats.myIncomeForBudget > 0 ? stats.myIncomeForBudget : stats.myIncome;
      const budgetPct = settings.monthlyBudgetPercentage || 80;
      const savingsPct = 100 - budgetPct;
      if (inc > 0 && savingsPct > 0) {
        monthlyGoal = (inc * savingsPct) / 100;
      }
    }
    
    const totalProfit = portfolioSummary.totalProfit ?? (portfolioSummary.marketValue - portfolioSummary.investedValue + portfolioSummary.realizedProfit + portfolioSummary.proventosTotal);
    const portfolioAnnualXTIR = portfolioSummary.xtir ?? 0;
    const cumulativeReturnPct = portfolioSummary.cumulativeReturnPct ?? (portfolioSummary.investedValue > 0 ? (totalProfit / portfolioSummary.investedValue) * 100 : 0);

    return {
      top3,
      totalProfit,
      portfolioAnnualXTIR,
      cumulativeReturnPct,
      monthlyGoal,
      currentValueAll: portfolioSummary.marketValue,
      totalInvestedAll: portfolioSummary.investedValue
    };
  }, [portfolioSummary, portfolioList, settings]);

  // Total Patrimonio
  const totalPatrimonioAtual = useMemo(() => {
    return investmentStats.currentValueAll;
  }, [investmentStats.currentValueAll]);

  // Budget stats
  const budgetStats = useMemo(() => {
    const monthlyBudgetPercentage = settings.monthlyBudgetPercentage || 80;
    const incomeForBudget = stats.myIncomeForBudget > 0 ? stats.myIncomeForBudget : stats.myIncome;
    const targetExpense = (incomeForBudget * monthlyBudgetPercentage) / 100;
    const percentageOfIncomeUsed = incomeForBudget > 0 ? (stats.myExpense / incomeForBudget) * 100 : 0;
    const isOverBudget = stats.myExpense > targetExpense;
    const remaining = targetExpense - stats.myExpense;

    return {
      monthlyBudgetPercentage,
      targetExpense,
      percentageOfIncomeUsed,
      isOverBudget,
      remaining
    };
  }, [settings, stats]);

  const budgetColor = budgetStats.percentageOfIncomeUsed > 100 
    ? 'bg-rose-500' 
    : budgetStats.percentageOfIncomeUsed > 80 
      ? 'bg-amber-500' 
      : 'bg-emerald-500';

  // Card & Installment Data
  const cardData = useMemo(() => {
    const groupedCredit = creditCards.map(card => {
      let total = 0;
      let myTotal = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id) {
          total += t.amount;
          if (t.isShared) {
            myTotal += (t.amount / 2);
          } else if (!isNathyTransaction(t)) {
            myTotal += t.amount;
          }
        }
      });
      return { ...card, total, myTotal };
    });

    return { groupedCredit };
  }, [creditCards, filteredTransactions, categories]);

  // Installment stats
  const installmentStats = useMemo(() => {
    let userInstallmentTotal = 0;
    let nathyInstallmentTotal = 0;

    filteredTransactions.forEach(t => {
      if (t.totalInstallments && t.totalInstallments > 1) {
        if (isNathyTransaction(t)) {
          nathyInstallmentTotal += t.amount;
        } else {
          userInstallmentTotal += t.amount;
        }
      }
    });

    return { userInstallmentTotal, nathyInstallmentTotal };
  }, [transactions, categories]);

  // Projection data for installments
  const projectionData = useMemo(() => {
    if (!projectionScope) return [];

    const monthsMap = new Map<string, { date: Date, total: number, items: Transaction[] }>();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0);

    transactions.forEach(t => {
      if (t.totalInstallments && t.totalInstallments > 1) {
        const isNathy = isNathyTransaction(t);
        if ((projectionScope === 'nathy' && !isNathy) || (projectionScope === 'user' && isNathy)) return;

        const effDate = calculateEffectiveDate(t, creditCards, settings);
        if (effDate >= currentMonthStart) {
          const key = getYearMonthKey(effDate);
          const existing = monthsMap.get(key) || { date: effDate, total: 0, items: [] };
          existing.total += t.amount;
          existing.items.push(t);
          monthsMap.set(key, existing);
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  }, [projectionScope, transactions, creditCards, settings, currentDate, categories]);

  // Recent lists
  const recentTransactions = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => !isNathyTransaction(t) && (t.type === TransactionType.INCOME || t.type === TransactionType.EXPENSE))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [filteredTransactions, categories]);

  const recentDividends = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => 
        t.type === TransactionType.INVESTMENT && 
        t.investmentDetails?.event &&
        ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails.event)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [filteredTransactions]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-20">
      {/* HEADER & NAVIGATOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Dashboard Financeiro</h1>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {monthlyInvestmentsList.length} Aportes no Mês
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Visão consolidada do fluxo de caixa, orçamento e patrimônio.</p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
          <button
            onClick={handlePrevMonth}
            className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2 px-3">
            <Calendar size={16} className="text-blue-500 shrink-0" />
            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 capitalize whitespace-nowrap">
              {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: MOVIMENTAÇÃO DO MÊS (CARDS CONSOLIDADOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Renda Mensal" 
          value={stats.myIncome} 
          icon={TrendingUp} 
          color="emerald" 
          subtext={
            stats.myIncome !== stats.myIncomeForBudget ? (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatCurrency(stats.myIncomeForBudget)} p/ orçamento
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Entradas do mês</span>
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
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                ({formatCurrency(stats.myResgateExpense)} cobertos p/ resgates)
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Despesas do mês</span>
            )
          }
        />

        <KPICard 
          title="Saldo Livre" 
          value={stats.balance} 
          icon={Wallet} 
          color="indigo" 
          subtext={
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
              {stats.targetSavings > 0 ? ((stats.balance / stats.targetSavings) * 100).toFixed(0) : 0}% da meta de poupança
            </span>
          }
        />

        <KPICard 
          title="Aporte Ativo" 
          value={stats.myInvestmentFromPocket} 
          icon={PiggyBank} 
          color="violet" 
          onClick={() => setShowInvestmentDetails(!showInvestmentDetails)}
          subtext={
            <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1">
              {investmentStats.monthlyGoal > 0 ? (
                `${((stats.myInvestmentFromPocket / investmentStats.monthlyGoal) * 100).toFixed(0)}% da meta (${formatCurrency(investmentStats.monthlyGoal)})`
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Meta não definida</span>
              )}
              <span className="underline ml-auto font-bold cursor-pointer">Detalhes</span>
            </span>
          }
        />
      </div>

      {showInvestmentDetails && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-900/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} /> Detalhamento dos Aportes do Mês ({monthlyInvestmentsList.length})
            </h4>
            <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              Total Investido: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{formatCurrency(monthlyInvestmentsList.reduce((acc, t) => acc + (t.amount || 0), 0))}</span>
            </div>
          </div>

          {monthlyInvestmentsList.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 text-center">Nenhum aporte (compra/bônus) realizado neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[11px] font-bold text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Ativo / Ticker</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Preço Un.</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3 text-right">Origem do Capital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                  {monthlyInvestmentsList.map(t => {
                    const breakdown = pocketInvestmentStats.txBreakdown.get(t.id);
                    const event = t.investmentDetails?.event || 'BUY';
                    const eventLabel = event === 'BONUS' ? 'Bonificação' : 'Compra';
                    const qty = t.investmentDetails?.quantity || 0;
                    const price = t.investmentDetails?.price || (qty > 0 ? t.amount / qty : 0);
                    
                    let originLabel = "Dinheiro de Bolso";
                    if (breakdown) {
                      if (breakdown.provento > 0 && breakdown.pocket === 0) originLabel = "Proventos";
                      else if (breakdown.resgate > 0 && breakdown.pocket === 0) originLabel = "Resgates";
                      else if (breakdown.provento > 0 || breakdown.resgate > 0) originLabel = "Misto (Bolso/Reinvestido)";
                    }

                    return (
                      <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                          {safeFormatPtBR(t.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                          <div>{t.investmentDetails?.ticker || t.description}</div>
                          {t.description && t.description !== t.investmentDetails?.ticker && (
                            <div className="text-[10px] text-zinc-400 font-normal">{t.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                            {eventLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {qty ? qty.toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {price > 0 ? formatCurrency(price) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(t.amount || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[11px] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                            {originLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* SEÇÃO 2: CARD UNIFICADO DE ORÇAMENTO, BALANÇO ANUAL E APORTES */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex justify-between items-center pb-5 mb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Planejamento & Orçamento</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Controle de limites, poupança acumulada e origem dos investimentos.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/60 px-3 py-1 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <Target size={14} className="text-blue-500" />
            Meta: {budgetStats.monthlyBudgetPercentage}% da renda
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* COLUNA 1: CONSUMO DO ORÇAMENTO */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                <Receipt size={18} />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Consumo do Mês</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-zinc-500 dark:text-zinc-400">Gastos vs Limite</span>
                <span className={budgetStats.isOverBudget ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                  {budgetStats.percentageOfIncomeUsed.toFixed(1)}% utilizado
                </span>
              </div>

              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 z-10"
                  style={{ left: `${budgetStats.monthlyBudgetPercentage}%` }}
                  title={`Meta: ${budgetStats.monthlyBudgetPercentage}%`}
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(budgetStats.percentageOfIncomeUsed, 100)}%` }}
                  className={`h-full ${budgetColor}`}
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Teto: {formatCurrency(budgetStats.targetExpense)}</span>
                {budgetStats.isOverBudget ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px]">
                    <AlertTriangle size={12} /> Excedeu {formatCurrency(Math.abs(budgetStats.remaining))}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 size={12} /> Sobram {formatCurrency(budgetStats.remaining)}
                  </span>
                )}
              </div>

              <p className={`p-3 rounded-xl text-xs font-medium leading-relaxed ${budgetStats.isOverBudget ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'}`}>
                {budgetStats.isOverBudget ? 
                  'Atenção aos gastos supérfluos neste final de período para evitar comprometer o caixa.' : 
                  'Excelente controle! Você está gastando dentro da meta planejada.'
                }
              </p>
            </div>
          </div>

          {/* COLUNA 2: HISTÓRICO DE ECONOMIA ANUAL */}
          <div className="space-y-4 lg:border-l lg:border-r border-zinc-100 dark:border-zinc-800 lg:px-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <BarChart3 size={18} />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Balanço Anual ({currentDate.getFullYear()})</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Renda Acumulada</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency((annualStats.myIncome || 0))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Gastos Acumulados</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency((annualStats.myExpense || 0))}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Saldo Poupado</span>
                <span className={`font-bold ${annualStats.myBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency((annualStats.myBalance || 0))}
                </span>
              </div>

              {annualDiff < 0 ? (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-xl text-[11px] font-medium leading-tight flex items-start gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Desvio acumulado de {formatCurrency(Math.abs(annualDiff))}. Recomenda-se poupar {formatCurrency(requiredSavingsPerMonth)}/mês no restante do ano.</span>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-medium leading-tight flex items-start gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <span>Você está {formatCurrency(annualDiff)} acima da meta acumulada para o ano!</span>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA 3: COMPOSIÇÃO DO APORTE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
                <Coins size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Origem dos Aportes</h3>
                <span className="text-[10px] text-zinc-400 font-semibold">Total: {formatCurrency(stats.myInvestment)}</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Dinheiro de Bolso
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency((stats.myInvestmentFromPocket || 0))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Proventos Reinvestidos
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency((stats.myReinvestedProventos || 0))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Resgates Reinvestidos
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency((stats.myReinvestedResgates || 0))}</span>
              </div>

              {/* Barra Empilhada */}
              <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full flex overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myInvestmentFromPocket / stats.myInvestment) * 100 : 0}%` }}
                  className="h-full bg-blue-500" 
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myReinvestedProventos / stats.myInvestment) * 100 : 0}%` }}
                  className="h-full bg-emerald-500" 
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.myInvestment > 0 ? (stats.myReinvestedResgates / stats.myInvestment) * 100 : 0}%` }}
                  className="h-full bg-purple-500" 
                />
              </div>

              <div className="pt-2 flex justify-between items-center text-[11px] border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 font-medium">Pool para reinvestir:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency((stats.endingProventosPool || 0))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: CARD UNIFICADO DE PATRIMÔNIO & INVESTIMENTOS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Gestão de Patrimônio</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Posição global dos seus ativos, rentabilidade e capital acumulado.</p>
          </div>
          <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Atualizado
          </span>
        </div>

        {/* 4 CARDS DE METRICAS PRINCIPAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm space-y-1">
            <span className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider block">Patrimônio Total</span>
            <span className="text-xl sm:text-2xl font-bold tracking-tight block">
              {formatCurrency((totalPatrimonioAtual || 0))}
            </span>
            <span className="text-[10px] text-blue-200 block font-medium">Investimentos em Carteira</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Resultado Líquido</span>
            <span className={`text-xl sm:text-2xl font-bold tracking-tight block ${investmentStats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {investmentStats.totalProfit >= 0 ? '+' : ''}{formatCurrency((investmentStats.totalProfit || 0))}
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">Lucros + Proventos ({investmentStats.cumulativeReturnPct >= 0 ? '+' : ''}{investmentStats.cumulativeReturnPct.toFixed(1)}%)</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Rentabilidade (a.a.)</span>
            <span className={`text-xl sm:text-2xl font-bold tracking-tight block ${investmentStats.portfolioAnnualXTIR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {investmentStats.portfolioAnnualXTIR >= 0 ? '+' : ''}{investmentStats.portfolioAnnualXTIR.toFixed(2)}%
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">Taxa Interna de Retorno (XTIR)</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Capital p/ Aporte</span>
            <span className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-zinc-200 tracking-tight block">
              {formatCurrency(Math.max(0, (stats.balance || 0) - (stats.myInvestmentFromPocket || 0)))}
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">
              {stats.myInvestmentFromPocket > 0
                ? `Restante do mês (${formatCurrency(stats.myInvestmentFromPocket)} já aportado)`
                : 'Capacidade do mês'}
            </span>
          </div>
        </div>

        {/* RANKING & POOL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900 dark:bg-zinc-950 p-5 rounded-2xl text-white space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Destaques da Carteira (Maior Rentabilidade)</span>
              <Sparkles size={16} className="text-amber-400" />
            </div>

            {investmentStats.top3.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {investmentStats.top3.map((asset, i) => (
                  <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center p-1 shrink-0">
                        <img src={getAssetIcon(asset.ticker)} className="w-full h-full object-contain" onError={e => e.currentTarget.style.display='none'} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-sm truncate block">{asset.ticker}</span>
                        <span className="text-[9px] text-zinc-400 uppercase">#{i+1} da carteira</span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${asset.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {asset.totalReturnPct > 0 ? '+' : ''}{asset.totalReturnPct.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {formatCurrency(asset.totalProfit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">Cadastre ativos de investimentos para visualizar a performance detalhada.</p>
            )}
          </div>

          <div className="bg-violet-600 p-5 rounded-2xl text-white flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-200 block mb-1">Pool de Reinvestimento</span>
              <span className="text-2xl font-bold tracking-tight block">{formatCurrency((pocketInvestmentStats.passivePool || 0))}</span>
              <p className="text-xs text-violet-100/80 mt-1">Soma de dividendos e resgates disponíveis para novos aportes.</p>
            </div>
            <div className="pt-3 border-t border-white/20 flex justify-between items-center text-xs font-bold">
              <span>Status do Caixa</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">Pronto</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5: CARTÕES & DÉBITO */}
      {stats.expense > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                  <CardIcon size={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Cartões de Crédito</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency((stats.totalCredit || 0))}
                </span>
                {stats.myCreditTotal !== stats.totalCredit && (
                  <span className="text-[10px] text-zinc-500 font-medium">Sua parte: {formatCurrency(stats.myCreditTotal || 0)}</span>
                )}
              </div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[180px] overflow-y-auto pr-1">
              {cardData.groupedCredit.map(card => {
                if (card.total === 0) return null;
                return (
                  <div key={card.id} className="flex justify-between items-center py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <BankLogo bankId={card.icon || 'generic'} className="w-6 h-6 rounded-md shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{card.name}</span>
                        {card.total !== card.myTotal && (
                          <span className="text-[9px] text-zinc-500 font-medium truncate">Sua parte: {formatCurrency(card.myTotal || 0)}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatCurrency((card.total || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Banknote size={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Débito & Dinheiro</h3>
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency((stats.debitTotal || 0))}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500">
              Pagamentos diretos em conta corrente e PIX.
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 6: PARCELAS */}
      {(installmentStats.userInstallmentTotal > 0 || installmentStats.nathyInstallmentTotal > 0) && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={14} className="text-blue-500" /> Projeção de Parcelas
          </h3>

          <div className="flex gap-3">
            {installmentStats.userInstallmentTotal > 0 && (
              <button 
                onClick={() => setProjectionScope(projectionScope === 'user' ? null : 'user')} 
                className={`flex-1 p-3 rounded-xl border text-left transition-colors ${projectionScope === 'user' ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}
              >
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">Minhas Parcelas</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(installmentStats.userInstallmentTotal)}</span>
              </button>
            )}

            {installmentStats.nathyInstallmentTotal > 0 && (
              <button 
                onClick={() => setProjectionScope(projectionScope === 'nathy' ? null : 'nathy')} 
                className={`flex-1 p-3 rounded-xl border text-left transition-colors ${projectionScope === 'nathy' ? 'bg-pink-50 dark:bg-pink-950/50 border-pink-300' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}
              >
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">Parcelas Nathy</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(installmentStats.nathyInstallmentTotal)}</span>
              </button>
            )}
          </div>

          {projectionScope && projectionData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {projectionData.map((monthData, idx) => (
                <div key={idx} className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs font-bold">
                    <span className="capitalize">{monthData.date.toLocaleDateString('pt-BR', { month: 'long' })}</span>
                    <span className="text-blue-600">{formatCurrency(monthData.total)}</span>
                  </div>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto text-[11px]">
                    {monthData.items.map((t, tIdx) => (
                      <div key={tIdx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span className="truncate max-w-[120px]">{t.description.replace(/\s\(\d+\/\d+\)$/, '')}</span>
                        <span className="font-semibold">{t.installmentIndex}/{t.totalInstallments}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 7: ÚLTIMAS MOVIMENTAÇÕES & PROVENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ÚLTIMOS LANÇAMENTOS */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Clock size={18} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Últimos Lançamentos</h3>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[280px] overflow-y-auto pr-1">
            {recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.categoryId);
              return (
                <div 
                  key={t.id} 
                  onClick={() => onEditTransaction(t)}
                  className="py-2.5 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl px-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <IconRenderer iconName={cat?.icon || 'circle'} size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate block">{t.description}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {safeFormatPtBR(t.date, { day: '2-digit', month: '2-digit' })} • {cat?.name}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {t.type === TransactionType.INCOME ? '+' : ''} {formatCurrency((t.amount || 0))}
                  </span>
                </div>
              );
            })}

            {recentTransactions.length === 0 && (
              <p className="py-8 text-center text-xs text-zinc-400 italic">Nenhum lançamento no período.</p>
            )}
          </div>
        </div>

        {/* ÚLTIMOS PROVENTOS */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Gift size={18} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Proventos Recebidos</h3>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[280px] overflow-y-auto pr-1">
            {recentDividends.map(t => (
              <div 
                key={t.id} 
                onClick={() => onEditTransaction(t)}
                className="py-2.5 flex justify-between items-center hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-xl px-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 flex items-center justify-center shrink-0">
                    <img src={getAssetIcon(t.investmentDetails?.ticker || '')} className="w-full h-full object-contain" onError={e => e.currentTarget.style.display='none'} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate block">{t.investmentDetails?.ticker}</span>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {safeFormatPtBR(t.date, { day: '2-digit', month: '2-digit' })} • {t.investmentDetails?.event}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  + {formatCurrency((t.amount || 0))}
                </span>
              </div>
            ))}

            {recentDividends.length === 0 && (
              <p className="py-8 text-center text-xs text-zinc-400 italic">Nenhum provento registrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
