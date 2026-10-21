
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
  Receipt, Coins, Info, ArrowUpRight, ArrowDownRight, Minus, Flame, History, Layers
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
const getAssetIcon = (ticker: string, category: string = "") => {
    if (!ticker) return "";
    const cleanTicker = ticker.trim().toUpperCase();
    const pureTicker = cleanTicker.includes(':') ? cleanTicker.split(':').pop()! : cleanTicker;
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LTC', 'UNI', 'LINK'];
    const cryptoMatch = pureTicker.endsWith('BRL') ? pureTicker.replace('BRL', '') : pureTicker;
    
    if (category.toLowerCase().includes("cripto") || cryptoSymbols.includes(cryptoMatch)) {
        return `https://assets.coincap.io/assets/icons/${cryptoMatch.toLowerCase()}@2x.png`;
    }
    // Ativos internacionais / ETFs sem número no ticker (ex: VOO, QQQ, SPY, VT, AAPL, MSFT)
    if (!/\d/.test(pureTicker)) {
        return `https://abs.twimg.com/finance/v1/stock/${pureTicker}.png`;
    }
    return `https://icons.brapi.dev/icons/${pureTicker}.svg`;
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

const calculateRealFixedIncome = (principal: number, startDateStr: string, rateStr: string, cdiData: { date: string, value: number }[]): number => {
    if (!principal || principal <= 0) return 0;
    if (!rateStr || typeof rateStr !== 'string') rateStr = '100% CDI';

    const startIso = toIsoDateStr(startDateStr);
    const endIso = new Date().toISOString().split("T")[0];

    const upperStr = rateStr.toUpperCase().trim();
    let pctCDI = 0;
    let isCDI = false;
    let fixedRate = 0;

    const numbers = upperStr.match(/(\d+(?:[.,]\d+)?)/g);

    const isExplicitCdi =
        upperStr.includes("CDI") ||
        upperStr.includes("DO CDI") ||
        upperStr.includes("SELIC");

    const isPreOrFixed =
        upperStr.includes("PRÉ") ||
        upperStr.includes("PRE") ||
        upperStr.includes("FIXO") ||
        upperStr.includes("FIXED") ||
        upperStr.includes("A.A.") ||
        upperStr.includes("USD") ||
        upperStr.includes("DÓLAR") ||
        upperStr.includes("DOLAR");

    const hasCdiExplicit =
        (isExplicitCdi ||
            upperStr.includes("CDB") ||
            upperStr.includes("LCI") ||
            upperStr.includes("LCA") ||
            upperStr.includes("CRI") ||
            upperStr.includes("CRA") ||
            upperStr.includes("POUPA")) &&
        !isPreOrFixed;

    if (hasCdiExplicit) {
        isCDI = true;
        if (upperStr.includes("POUPA")) {
            pctCDI = numbers && numbers.length > 0 ? parseFloat(numbers[0].replace(",", ".")) : 70;
        } else if (numbers && numbers.length > 0) {
            pctCDI = parseFloat(numbers[0].replace(",", "."));
        } else {
            pctCDI = 100;
        }
    } else if (numbers && numbers.length > 0) {
        const val = parseFloat(numbers[0].replace(",", "."));
        if (val >= 50 && !upperStr.includes("IPCA") && !isPreOrFixed) {
            isCDI = true;
            pctCDI = val;
        } else {
            fixedRate = val;
        }
    } else {
        isCDI = false;
    }

    if (isCDI) {
        if (!cdiData || cdiData.length === 0) return principal;
        const relevantRates = cdiData.filter(d => d.date >= startIso && d.date <= endIso);
        let accumulatedFactor = 1;
        for (const day of relevantRates) {
            const dailyFactor = 1 + ((day.value / 100) * (pctCDI / 100));
            accumulatedFactor *= dailyFactor;
        }
        return principal * accumulatedFactor;
    } else {
        const relevantRates = cdiData ? cdiData.filter((d) => d.date >= startIso && d.date <= endIso) : [];
        const businessDays = relevantRates.length > 0 ? relevantRates.length : Math.ceil(Math.abs(new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) * (252 / 365);
        const years = businessDays / 252;
        if (fixedRate > 0) return principal * Math.pow(1 + (fixedRate / 100), years);
    }
    return principal;
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
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={onClick ? { scale: 0.98 } : {}}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClick}
            className={`p-5 rounded-2xl border ${v.border} bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700' : 'cursor-default'} relative overflow-hidden group`}
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
      
  const isNathyTransaction = (t: Transaction) => {
    if (!t) return false;
    const descLower = (t.description || '').toLowerCase();
    if (descLower.includes('(minha parte)') || descLower.includes('minha parte')) {
      return false;
    }
    if (descLower.includes('(parte nathy)') || descLower.includes('parte nathy')) {
      return true;
    }
    const cat = categories?.find(c => c.id === t.categoryId);
    const catNameLower = (cat?.name || '').toLowerCase();
    const isNathyCat = catNameLower === 'nathy' || catNameLower.includes('nathy');
    const isAdditional = cat?.isAdditionalCard || false;
    const isCardOriginAdd = (t.cardOrigin || '').toUpperCase() === 'ADDITIONAL' || (t.cardOrigin || '').toUpperCase() === 'ADICIONAL';
    return isAdditional || isNathyCat || isCardOriginAdd;
  };

  const getTransactionUserAmount = (t: Transaction) => {
    if (isNathyTransaction(t)) return 0;
    const descLower = (t.description || '').toLowerCase();
    const isExplicitUserPart = descLower.includes('(minha parte)') || descLower.includes('minha parte');
    if (t.isShared && !isExplicitUserPart) {
      return t.amount / 2;
    }
    return t.amount;
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
    let myStandardIncomeForBudget = 0;
    let myFullySpendableIncome = 0;
    let myIncomeForBudget = 0;
    let myExpense = 0;
    let myOperationalExpense = 0;
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
      
      if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          totalCredit += t.amount;
      }
      
      if (isNathy) return;

      const userAmt = getTransactionUserAmount(t);

      if (t.type === TransactionType.INCOME) {
        myIncome += t.amount;
        if (!t.excludeFromBudget) {
          if (t.fullySpendableIncome) {
            myFullySpendableIncome += t.amount;
          } else {
            myStandardIncomeForBudget += t.amount;
          }
          myIncomeForBudget += t.amount;
        }
      } else if (t.type === TransactionType.EXPENSE) {
        myExpense += userAmt;
        if (t.fundedByResgate) {
          myResgateExpense += userAmt;
        } else {
          myOperationalExpense += userAmt;
        }
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          myCreditTotal += userAmt;
        } else {
          debitTotal += userAmt;
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
    const standardIncomeForSavings = myStandardIncomeForBudget > 0 ? myStandardIncomeForBudget : (myFullySpendableIncome > 0 ? 0 : myIncome);
    const fallbackTargetSavings = (standardIncomeForSavings * (100 - (settings.monthlyBudgetPercentage || 80))) / 100;
    const targetSavings = (settings.monthlySavingsGoal && settings.monthlySavingsGoal > 0) 
      ? settings.monthlySavingsGoal 
      : fallbackTargetSavings;
    const endingProventosPool = pocketInvestmentStats.passivePool;

    return {
      myIncome,
      myIncomeForBudget,
      myStandardIncomeForBudget,
      myFullySpendableIncome,
      myExpense,
      myOperationalExpense,
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
    let standardIncome = 0;
    let fullySpendableIncome = 0;
    let excludedIncome = 0;
    let myExpense = 0;
    let myOperationalExpense = 0;
    let myResgateExpense = 0;
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    transactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      if (isNathy) return;

      const effDate = calculateEffectiveDate(t, creditCards, settings);
      // Acumula os meses desde Janeiro até o mês selecionado no seletor de data
      if (effDate.getFullYear() === currentYear && effDate.getMonth() <= currentMonth) {
        const userAmt = getTransactionUserAmount(t);
        if (t.type === TransactionType.INCOME) {
          myIncome += t.amount;
          if (t.excludeFromBudget) {
            excludedIncome += t.amount;
          } else if (t.fullySpendableIncome) {
            fullySpendableIncome += t.amount;
          } else {
            standardIncome += t.amount;
          }
        }
        if (t.type === TransactionType.EXPENSE) {
          myExpense += userAmt;
          if (t.fundedByResgate) {
            myResgateExpense += userAmt;
          } else {
            myOperationalExpense += userAmt;
          }
        }
      }
    });

    const myBalance = myIncome - myOperationalExpense;
    // Gastos operacionais consom primeiro a receita 100% gastável (destinada integralmente a consumo).
    // O que exceder a receita 100% gastável é que consome a receita padrão e compete com a meta de poupança.
    const expenseConsumingStandard = Math.max(0, myOperationalExpense - fullySpendableIncome);
    const baseSavingsBalance = standardIncome - expenseConsumingStandard;
    const remainingFullySpendable = Math.max(0, fullySpendableIncome - myOperationalExpense);
    const operationalIncome = standardIncome + fullySpendableIncome;
    const operationalBalance = operationalIncome - myOperationalExpense;
    return { 
      myIncome, 
      standardIncome, 
      fullySpendableIncome, 
      excludedIncome, 
      operationalIncome,
      operationalBalance,
      baseSavingsBalance,
      remainingFullySpendable,
      expenseConsumingStandard,
      myExpense, 
      myOperationalExpense,
      myResgateExpense,
      myBalance 
    };
  }, [transactions, creditCards, settings, currentDate, categories]);

  // Meta de poupança acumulada do ano:
  // Se houver meta fixa em R$ definida nas configurações, usa ela.
  // Caso contrário, calcula com base na porcentagem de economia (100% - limite de gastos) sobre a renda padrão acumulada no ano.
  const targetSavingsRatePct = 100 - (settings.monthlyBudgetPercentage || 80);
  const annualTargetSavings = (settings.monthlySavingsGoal && settings.monthlySavingsGoal > 0)
    ? settings.monthlySavingsGoal * (currentDate.getMonth() + 1)
    : (annualStats.standardIncome * targetSavingsRatePct) / 100;

  const annualDiff = annualStats.baseSavingsBalance - annualTargetSavings;
  const annualSavingsPctOfIncome = annualStats.myIncome > 0 ? (annualStats.myBalance / annualStats.myIncome) * 100 : 0;
  const annualBaseSavingsPct = annualStats.standardIncome > 0 ? (annualStats.baseSavingsBalance / annualStats.standardIncome) * 100 : 0;
  const annualGoalCompletionPct = annualTargetSavings > 0 ? (annualStats.baseSavingsBalance / annualTargetSavings) * 100 : 0;
  
  // Meses passados até agora e meses restantes no ano
  const currentMonthIndex = currentDate.getMonth(); // 0 a 11
  const monthsElapsed = currentMonthIndex + 1; // 1 a 12
  const monthsRemaining = 12 - monthsElapsed; // meses que restam no ano
  
  // Média mensal atual de renda padrão
  const avgMonthlyStandardIncome = monthsElapsed > 0 ? annualStats.standardIncome / monthsElapsed : 0;
  
  // Meta projetada para os 12 meses do ano:
  // Se tem meta fixa, é 12 * meta mensal. Se é percentual, é a meta % sobre o total projetado para os 12 meses.
  const fullYearTargetSavings = (settings.monthlySavingsGoal && settings.monthlySavingsGoal > 0)
    ? settings.monthlySavingsGoal * 12
    : ((annualStats.standardIncome + (avgMonthlyStandardIncome * monthsRemaining)) * targetSavingsRatePct) / 100;
  
  // Quanto ainda precisa ser poupado no restante do ano para atingir a meta total dos 12 meses:
  const remainingSavingsNeededForYear = Math.max(0, fullYearTargetSavings - annualStats.baseSavingsBalance);
  
  // Economia mensal necessária em cada um dos meses restantes para fechar o ano batendo a meta:
  const requiredSavingsPerMonthToEndYear = monthsRemaining > 0 
    ? remainingSavingsNeededForYear / monthsRemaining 
    : 0;

  // Valor extra mensal estritamente necessário para zerar o déficit acumulado (R$ 3.462,72 / meses restantes):
  const requiredExtraPerMonthToRecoverDeficit = monthsRemaining > 0 && annualDiff < 0
    ? Math.abs(annualDiff) / monthsRemaining
    : 0;

  // Economia mensal total recomendada (Meta mensal normal + o extra para compensar o déficit):
  const normalMonthlyTargetSavings = (avgMonthlyStandardIncome * targetSavingsRatePct) / 100;
  const totalRecommendedSavingsPerMonth = normalMonthlyTargetSavings + requiredExtraPerMonthToRecoverDeficit;

  // Gastos Insights Engine (Analisa Janela de 3 Meses com Detecção de Anomalias e Pontos de Atenção)
  const spendingInsights = useMemo(() => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Mês Atual (M0), Mês Passado (M1), Mês Retrasado (M2)
    const m0Date = new Date(currentYear, currentMonth, 1);
    const m0Key = getYearMonthKey(m0Date);
    const m1Date = new Date(currentYear, currentMonth - 1, 1);
    const m1Key = getYearMonthKey(m1Date);
    const m2Date = new Date(currentYear, currentMonth - 2, 1);
    const m2Key = getYearMonthKey(m2Date);

    // Label do período de 3 meses (ex: "Jun a Ago de 2026")
    const m2Name = m2Date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const m0Name = m0Date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const periodLabel = `${m2Name.charAt(0).toUpperCase() + m2Name.slice(1)} a ${m0Name.charAt(0).toUpperCase() + m0Name.slice(1)}/${currentYear}`;

    // Despesas filtradas dos 3 meses (excluindo parte Nathy e despesas cobertas por resgate)
    const expenses3M = transactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE || isNathyTransaction(t) || t.fundedByResgate) return false;
      const effDate = calculateEffectiveDate(t, creditCards, settings);
      const key = getYearMonthKey(effDate);
      return key === m0Key || key === m1Key || key === m2Key;
    });

    const expensesM0 = expenses3M.filter(t => getYearMonthKey(calculateEffectiveDate(t, creditCards, settings)) === m0Key);
    const expensesM1 = expenses3M.filter(t => getYearMonthKey(calculateEffectiveDate(t, creditCards, settings)) === m1Key);
    const expensesM2 = expenses3M.filter(t => getYearMonthKey(calculateEffectiveDate(t, creditCards, settings)) === m2Key);
    const expensesM1M2 = expenses3M.filter(t => {
      const key = getYearMonthKey(calculateEffectiveDate(t, creditCards, settings));
      return key === m1Key || key === m2Key;
    });

    // Totais gerais do período
    let totalSpentM0 = 0;
    expensesM0.forEach(t => { totalSpentM0 += getTransactionUserAmount(t); });

    let totalSpentM1 = 0;
    expensesM1.forEach(t => { totalSpentM1 += getTransactionUserAmount(t); });

    let totalSpentM2 = 0;
    expensesM2.forEach(t => { totalSpentM2 += getTransactionUserAmount(t); });

    const totalSpent3M = totalSpentM0 + totalSpentM1 + totalSpentM2;
    const activeMonthsCount = [totalSpentM0 > 0, totalSpentM1 > 0, totalSpentM2 > 0].filter(Boolean).length || 1;
    const monthlyAvg3M = totalSpent3M / activeMonthsCount;
    
    // Comparativo M0 vs média dos meses anteriores (M1 e M2)
    const pastMonthsCount = [totalSpentM1 > 0, totalSpentM2 > 0].filter(Boolean).length || 1;
    const pastMonthlyAvg = (totalSpentM1 + totalSpentM2) / pastMonthsCount;
    const currentVsPastDiff = totalSpentM0 - pastMonthlyAvg;
    const currentVsPastPct = pastMonthlyAvg > 0 ? (currentVsPastDiff / pastMonthlyAvg) * 100 : 0;

    // -- 1. Gastos Mais Frequentes com Categoria e Comparativo Histórico --
    const freqMap = new Map<string, { 
      count: number; 
      total: number; 
      rawDesc: string; 
      categoryId: string;
      pastTotal: number;
      pastCount: number;
    }>();

    expensesM0.forEach(t => {
      const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim().toLowerCase();
      const amount = getTransactionUserAmount(t);
      const existing = freqMap.get(cleanDesc);
      if (existing) {
        existing.count += 1;
        existing.total += amount;
      } else {
        freqMap.set(cleanDesc, { 
          count: 1, 
          total: amount, 
          rawDesc: t.description.replace(/\s\(\d+\/\d+\)$/, '').trim(),
          categoryId: t.categoryId,
          pastTotal: 0,
          pastCount: 0
        });
      }
    });

    expensesM1M2.forEach(t => {
      const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim().toLowerCase();
      const amount = getTransactionUserAmount(t);
      const existing = freqMap.get(cleanDesc);
      if (existing) {
        existing.pastTotal += amount;
        existing.pastCount += 1;
      }
    });

    const mostFrequent = Array.from(freqMap.values())
      .filter(item => item.count >= 2 || item.pastCount >= 3)
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 4)
      .map(item => {
        const pastAvg = item.pastTotal / pastMonthsCount;
        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        const diff = item.total - pastAvg;
        const pctDiff = pastAvg > 0 ? (diff / pastAvg) * 100 : (item.total > 0 ? 100 : 0);
        
        if (item.total > pastAvg * 1.08 && diff > 10) trend = 'up';
        else if (item.total < pastAvg * 0.92 && pastAvg > 0 && diff < -10) trend = 'down';
        
        const cat = categories.find(c => c.id === item.categoryId);

        return {
          ...item,
          catName: cat?.name || 'Geral',
          catColor: cat?.color || '#a1a1aa',
          pastAvg,
          diff,
          pctDiff,
          trend
        };
      });

    // -- 2. Evolução Histórica & Alertas de Crescimento por Categoria --
    const catTotalsCurrent: Record<string, number> = {};
    const catTotalsPastAvg: Record<string, number> = {};

    expensesM0.forEach(t => {
      const amount = getTransactionUserAmount(t);
      catTotalsCurrent[t.categoryId] = (catTotalsCurrent[t.categoryId] || 0) + amount;
    });

    expensesM1M2.forEach(t => {
      const amount = getTransactionUserAmount(t);
      catTotalsPastAvg[t.categoryId] = (catTotalsPastAvg[t.categoryId] || 0) + (amount / pastMonthsCount);
    });

    const growthCategories = categories.map(cat => {
      const currentVal = catTotalsCurrent[cat.id] || 0;
      const prevVal = catTotalsPastAvg[cat.id] || 0;
      const diff = currentVal - prevVal;
      const pct = prevVal > 0 ? (diff / prevVal) * 100 : (currentVal > 0 ? 100 : 0);
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        currentVal,
        prevVal,
        diff,
        pct
      };
    })
    .filter(c => c.diff > 20 && c.currentVal > 0)
    .sort((a, b) => b.diff - a.diff);

    const biggestGrowth = growthCategories[0] || null;
    const secondaryGrowth = growthCategories[1] || null;
    let growthCulpritName = '';
    let growthCulpritDiff = 0;
    let growthCulpritTotal = 0;

    if (biggestGrowth) {
      const catExpensesM0 = expensesM0.filter(t => t.categoryId === biggestGrowth.id);
      const catExpensesPast = expensesM1M2.filter(t => t.categoryId === biggestGrowth.id);

      const descMap = new Map<string, { current: number; past: number }>();
      
      catExpensesM0.forEach(t => {
         const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
         const amount = getTransactionUserAmount(t);
         const existing = descMap.get(cleanDesc) || { current: 0, past: 0 };
         existing.current += amount;
         descMap.set(cleanDesc, existing);
      });

      catExpensesPast.forEach(t => {
         const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
         const amount = getTransactionUserAmount(t);
         const existing = descMap.get(cleanDesc) || { current: 0, past: 0 };
         existing.past += (amount / pastMonthsCount);
         descMap.set(cleanDesc, existing);
      });

      const sortedCulprits = Array.from(descMap.entries()).map(([desc, vals]) => {
         return { desc, diff: vals.current - vals.past, current: vals.current };
      }).sort((a, b) => b.diff - a.diff);

      if (sortedCulprits.length > 0 && sortedCulprits[0].diff > 0) {
         growthCulpritName = sortedCulprits[0].desc;
         growthCulpritDiff = sortedCulprits[0].diff;
         growthCulpritTotal = sortedCulprits[0].current;
      }
    }

    // Detecção de Despesas Atípicas / Picos de Alto Valor no Mês Atual
    const avgExpenseTicket = expensesM0.length > 0 ? (totalSpentM0 / expensesM0.length) : 0;
    const atypicalThreshold = Math.max(avgExpenseTicket * 3, 250);
    const atypicalExpenses = expensesM0
      .map(t => ({
        desc: t.description.replace(/\s\(\d+\/\d+\)$/, '').trim(),
        amount: getTransactionUserAmount(t),
        date: t.date,
        cat: categories.find(c => c.id === t.categoryId)
      }))
      .filter(item => item.amount >= atypicalThreshold)
      .sort((a, b) => b.amount - a.amount);

    const topAtypical = atypicalExpenses[0] || null;

    // -- 3. Perfil de Consumo Trimestral & Concentração --
    const catTotals3M: Record<string, number> = {};
    const subcatTotals3M: Record<string, Record<string, number>> = {};
    
    expenses3M.forEach(t => {
      const amount = getTransactionUserAmount(t);
      catTotals3M[t.categoryId] = (catTotals3M[t.categoryId] || 0) + amount;
      
      if (t.subCategoryId) {
        if (!subcatTotals3M[t.categoryId]) subcatTotals3M[t.categoryId] = {};
        subcatTotals3M[t.categoryId][t.subCategoryId] = (subcatTotals3M[t.categoryId][t.subCategoryId] || 0) + amount;
      }
    });

    const sortedCategories3M = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      total: catTotals3M[cat.id] || 0,
      pct: totalSpent3M > 0 ? ((catTotals3M[cat.id] || 0) / totalSpent3M) * 100 : 0
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

    const topCat = sortedCategories3M[0] || null;
    const top2Cat = sortedCategories3M[1] || null;
    const top3Cat = sortedCategories3M[2] || null;
    const top3ConcentrationPct = (topCat?.pct || 0) + (top2Cat?.pct || 0) + (top3Cat?.pct || 0);

    let topSubcatName = '';
    let topSubcatTotal = 0;
    let topExpenseName = '';
    let topExpenseVal = 0;

    if (topCat) {
       const subcats = subcatTotals3M[topCat.id];
       if (subcats) {
         const topSubcatEntry = Object.entries(subcats).sort((a,b) => b[1] - a[1])[0];
         if (topSubcatEntry) {
            const sub = subCategories.find(s => s.id === topSubcatEntry[0]);
            if (sub) {
              topSubcatName = sub.name;
              topSubcatTotal = topSubcatEntry[1] / activeMonthsCount;
            }
         }
       }
       
       const catExpenses3M = expenses3M.filter(t => t.categoryId === topCat.id);
       const catDescTotals = new Map<string, number>();
       catExpenses3M.forEach(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          const amount = getTransactionUserAmount(t);
          catDescTotals.set(cleanDesc, (catDescTotals.get(cleanDesc) || 0) + amount);
       });
       
       const topExp = Array.from(catDescTotals.entries()).sort((a,b) => b[1] - a[1])[0];
       if (topExp) {
          topExpenseName = topExp[0];
          topExpenseVal = topExp[1] / activeMonthsCount;
       }
    }

    // -- 4. Análise Fim de Semana vs Dias Úteis (Janela 3 Meses) --
    let weekendTotal3M = 0;
    let weekdayTotal3M = 0;
    const weekendCatTotals = new Map<string, number>();

    expenses3M.forEach(t => {
      const amount = getTransactionUserAmount(t);
      const d = new Date(t.date);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        weekendTotal3M += amount;
        weekendCatTotals.set(t.categoryId, (weekendCatTotals.get(t.categoryId) || 0) + amount);
      } else {
        weekdayTotal3M += amount;
      }
    });

    const totalSpentWknd = weekendTotal3M + weekdayTotal3M;
    const weekendPct = totalSpentWknd > 0 ? (weekendTotal3M / totalSpentWknd) * 100 : 0;
    const weekdayPct = 100 - weekendPct;
    
    let topWkndCatName = '';
    let topWkndCatColor = '';
    let topWkndCatVal = 0;
    if (weekendCatTotals.size > 0) {
      const topEntry = Array.from(weekendCatTotals.entries()).sort((a,b) => b[1] - a[1])[0];
      const cat = categories.find(c => c.id === topEntry[0]);
      if (cat) {
        topWkndCatName = cat.name;
        topWkndCatColor = cat.color;
        topWkndCatVal = topEntry[1] / activeMonthsCount;
      }
    }

    // Maior Despesa Única de todo o trimestre
    let singleLargestExpense3M: { desc: string; amount: number; date: string; catName: string; catColor: string } | null = null;
    expenses3M.forEach(t => {
      const amount = getTransactionUserAmount(t);
      if (!singleLargestExpense3M || amount > singleLargestExpense3M.amount) {
        const cat = categories.find(c => c.id === t.categoryId);
        singleLargestExpense3M = {
          desc: t.description.replace(/\s\(\d+\/\d+\)$/, '').trim(),
          amount,
          date: t.date,
          catName: cat?.name || 'Despesa',
          catColor: cat?.color || '#a1a1aa'
        };
      }
    });

    // Contagem de Alertas / Pontos de Atenção
    let attentionPointsCount = 0;
    if (biggestGrowth && biggestGrowth.pct > 20) attentionPointsCount++;
    if (secondaryGrowth && secondaryGrowth.pct > 25) attentionPointsCount++;
    if (topAtypical) attentionPointsCount++;
    if (weekendPct > 35) attentionPointsCount++;
    if (topCat && topCat.pct > 35) attentionPointsCount++;
    if (mostFrequent.some(f => f.trend === 'up')) attentionPointsCount++;

    return {
      periodLabel,
      totalSpentM0,
      totalSpent3M,
      monthlyAvg3M,
      currentVsPastDiff,
      currentVsPastPct,
      mostFrequent,
      biggestGrowth,
      secondaryGrowth,
      growthCulpritName,
      growthCulpritDiff,
      growthCulpritTotal,
      topAtypical,
      topCat,
      top2Cat,
      top3Cat,
      top3ConcentrationPct,
      topSubcatName,
      topSubcatTotal,
      topExpenseName,
      topExpenseVal,
      weekendPct,
      weekdayPct,
      topWkndCatName,
      topWkndCatColor,
      topWkndCatVal,
      singleLargestExpense3M,
      attentionPointsCount,
      hasData: expensesM0.length > 0 || expenses3M.length > 0
    };
  }, [transactions, creditCards, settings, currentDate, categories, subCategories]);

  // Investment stats
      // Monthly Pocket Investment Stats
  const { summary: portfolioSummary, list: portfolioList } = usePortfolioData(transactions, assetPrices, categories, subCategories, cdiHistory);

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
    const hasAnyIncomeForBudget = stats.myIncomeForBudget > 0;
    const standardIncome = hasAnyIncomeForBudget 
      ? stats.myStandardIncomeForBudget 
      : (stats.myFullySpendableIncome > 0 ? 0 : stats.myIncome);
    const fullySpendable = stats.myFullySpendableIncome;
    const effectiveTotalBudgetIncome = hasAnyIncomeForBudget ? stats.myIncomeForBudget : stats.myIncome;
    
    // Teto de gastos: % da meta sobre a receita padrão + 100% da receita integral gastável
    const targetExpense = ((standardIncome * monthlyBudgetPercentage) / 100) + fullySpendable;
    const currentExpenseForBudget = stats.myOperationalExpense;
    const percentageOfIncomeUsed = targetExpense > 0 ? (currentExpenseForBudget / targetExpense) * 100 : 0;
    const isOverBudget = currentExpenseForBudget > targetExpense;
    const remaining = targetExpense - currentExpenseForBudget;

    return {
      monthlyBudgetPercentage,
      targetExpense,
      currentExpenseForBudget,
      percentageOfIncomeUsed,
      isOverBudget,
      remaining,
      standardIncome,
      fullySpendable,
      effectiveTotalBudgetIncome
    };
  }, [settings, stats]);

  // Card & Installment Data
  const cardData = useMemo(() => {
    const groupedCredit = creditCards.map(card => {
      let total = 0;
      let myTotal = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id) {
          total += t.amount;
          if (!isNathyTransaction(t)) {
            myTotal += getTransactionUserAmount(t);
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
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Dashboard Financeiro</h1>
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
        />

        <KPICard 
          title="Custo de Vida" 
          value={stats.myExpense} 
          icon={TrendingDown} 
          color="rose" 
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.004]">
        <div className="flex justify-between items-center pb-5 mb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Planejamento & Orçamento</h2>
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
              <div className="flex justify-between items-baseline text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-300">
                  <span>Gastos</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(budgetStats.currentExpenseForBudget)}</span>
                  {stats.myResgateExpense > 0 && (
                    <span className="text-[10px] text-zinc-400 font-normal">
                      (+{formatCurrency(stats.myResgateExpense)} resgate)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="text-zinc-400">de {formatCurrency(budgetStats.targetExpense)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    budgetStats.isOverBudget 
                      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' 
                      : budgetStats.percentageOfIncomeUsed > 80
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                        : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {budgetStats.percentageOfIncomeUsed.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="h-3.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(budgetStats.percentageOfIncomeUsed, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetStats.isOverBudget 
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600' 
                      : budgetStats.percentageOfIncomeUsed > 80 
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  }`}
                />
              </div>

              <div className="flex justify-between items-center text-xs pt-0.5">
                <div className="flex flex-col">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Teto planejado: {formatCurrency(budgetStats.targetExpense)}</span>
                  {budgetStats.fullySpendable > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                      Inclui {formatCurrency(budgetStats.fullySpendable)} (100% gastável)
                    </span>
                  )}
                </div>
                {budgetStats.isOverBudget ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px] bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={12} /> Excedeu {formatCurrency(Math.abs(budgetStats.remaining))}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
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
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Balanço Anual ({currentDate.getFullYear()})</h3>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  {currentDate.getMonth() === 0
                    ? `Janeiro de ${currentDate.getFullYear()}`
                    : `Acumulado: Jan a ${currentDate.toLocaleDateString('pt-BR', { month: 'short' })}/${currentDate.getFullYear()}`}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Renda Acumulada</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency((annualStats.myIncome || 0))}</span>
                </div>
                {(annualStats.fullySpendableIncome > 0 || annualStats.excludedIncome > 0) && (
                  <div className="pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                    <div className="flex justify-between">
                      <span>• Padrão (Base da Meta):</span>
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">{formatCurrency(annualStats.standardIncome)}</span>
                    </div>
                    {annualStats.fullySpendableIncome > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>• 100% Gastável:</span>
                        <span className="font-medium">{formatCurrency(annualStats.fullySpendableIncome)}</span>
                      </div>
                    )}
                    {annualStats.excludedIncome > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>• Fora da Meta:</span>
                        <span className="font-medium">{formatCurrency(annualStats.excludedIncome)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Gastos Acumulados</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency((annualStats.myOperationalExpense || 0))}</span>
                </div>
                {annualStats.myResgateExpense > 0 && (
                  <div className="pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                    <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                      <span>• Cobertos por resgate (fora da meta):</span>
                      <span className="font-medium">{formatCurrency(annualStats.myResgateExpense)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="py-1.5 space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">Saldo Poupado Total</span>
                    {annualStats.myIncome > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        annualSavingsPctOfIncome >= 20 
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                          : annualSavingsPctOfIncome >= 0 
                            ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                            : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                      }`}>
                        {annualSavingsPctOfIncome.toFixed(1)}% da renda
                      </span>
                    )}
                  </div>
                  <span className={`font-bold ${annualStats.myBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency((annualStats.myBalance || 0))}
                  </span>
                </div>
                {(annualStats.excludedIncome > 0 || annualStats.fullySpendableIncome > 0) && (
                  <div className="pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                    <div className="flex justify-between items-center">
                      <span>• Da base padrão (com meta):</span>
                      <div className="flex items-center gap-1.5">
                        {annualStats.standardIncome > 0 && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                            ({annualBaseSavingsPct.toFixed(1)}% da base)
                          </span>
                        )}
                        <span className={`font-medium ${annualStats.baseSavingsBalance >= 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-rose-500 dark:text-rose-400'}`}>
                          {formatCurrency(annualStats.baseSavingsBalance)}
                        </span>
                      </div>
                    </div>
                    {annualStats.excludedIncome > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>• De receitas fora da meta:</span>
                        <span className="font-medium">+{formatCurrency(annualStats.excludedIncome)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {annualDiff < 0 ? (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-xl text-[11px] font-medium leading-tight flex items-start gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col space-y-1">
                    <div>
                      <span>
                        Déficit acumulado de <strong>{formatCurrency(Math.abs(annualDiff))}</strong> frente à meta de {targetSavingsRatePct}%
                        {annualTargetSavings > 0 && ` (${annualGoalCompletionPct.toFixed(0)}% da meta atingida)`}.
                      </span>
                      {monthsRemaining > 0 && (
                        <div className="mt-1 text-zinc-700 dark:text-zinc-300 font-normal">
                          Para eliminar esse déficit, economize <strong>+{formatCurrency(requiredExtraPerMonthToRecoverDeficit)}/mês além da sua meta normal</strong> nos próximos {monthsRemaining} {monthsRemaining === 1 ? 'mês' : 'meses'} (totalizando <strong>{formatCurrency(totalRecommendedSavingsPerMonth)}/mês</strong> de poupança total).
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                      (Taxa acumulada: {annualBaseSavingsPct.toFixed(1)}% vs meta de {targetSavingsRatePct}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-medium leading-tight flex items-start gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span>
                      Você está {formatCurrency(annualDiff)} acima da meta acumulada para o ano!
                      {annualTargetSavings > 0 && (
                        <span className="ml-1 font-bold">({annualGoalCompletionPct.toFixed(0)}% da meta atingida)</span>
                      )}
                    </span>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                      (Taxa de economia anual: {annualBaseSavingsPct.toFixed(1)}% da renda base padrão | Meta: {targetSavingsRatePct}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA 3: COMPOSIÇÃO DO APORTE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Origem dos Aportes</h3>
                  <span className="text-[10px] text-zinc-400 font-semibold">Total: {formatCurrency(stats.myInvestment)}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full">
                {monthlyInvestmentsList.length} {monthlyInvestmentsList.length === 1 ? 'aporte' : 'aportes'}
              </span>
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

      {/* CARD ADICIONAL: INSIGHTS E PADRÕES DE CONSUMO DE GASTOS (HISTÓRICO 3 MESES) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.004] transition-all duration-300 space-y-5">
        {/* CABEÇALHO DO CARD COM RESUMO TRIMESTRAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 rounded-xl">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Insights de Consumo & Padrões</h3>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                  Janela 3 Meses ({spendingInsights.periodLabel})
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Inteligência histórica para identificar tendências, gastos recorrentes e pontos de atenção
              </p>
            </div>
          </div>

          {spendingInsights.hasData && (
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <div className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-750/50 rounded-xl text-[11px]">
                <span className="text-zinc-400 dark:text-zinc-500 mr-1.5 font-medium">Média 3M:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(spendingInsights.monthlyAvg3M)}/mês</span>
              </div>
              {spendingInsights.attentionPointsCount > 0 ? (
                <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 rounded-xl text-[11px] font-bold flex items-center gap-1">
                  <AlertCircle size={12} />
                  {spendingInsights.attentionPointsCount} {spendingInsights.attentionPointsCount === 1 ? 'ponto de atenção' : 'pontos de atenção'}
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Consumo Equilibrado
                </span>
              )}
            </div>
          )}
        </div>

        {!spendingInsights.hasData ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Info size={24} className="text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Registre despesas no período selecionado para gerar diagnósticos e insights automáticos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* COLUNA 1: GASTOS MAIS FREQUENTES & RECORRENTES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <RefreshCcw size={14} className="text-blue-500 shrink-0" />
                  <span>Gastos Frequentes & Padrões</span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">vs Média 3M</span>
              </div>

              <div className="space-y-2">
                {spendingInsights.mostFrequent.length === 0 ? (
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-zinc-450 dark:text-zinc-500 italic">Nenhuma repetição frequente identificada neste mês.</p>
                  </div>
                ) : (
                  spendingInsights.mostFrequent.map((item, idx) => (
                    <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-2.5 flex justify-between items-center text-xs group transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.catColor }}></span>
                          <p className="font-semibold text-zinc-850 dark:text-zinc-200 truncate capitalize text-[11px]">{item.rawDesc}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{item.count}x no mês</span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{item.catName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs block">
                          {formatCurrency(item.total)}
                        </span>
                        <div className="flex items-center justify-end gap-0.5 text-[9px] font-semibold mt-0.5">
                          {item.trend === 'up' && (
                            <span className="text-rose-650 dark:text-rose-400 flex items-center gap-0.5">
                              <ArrowUpRight size={11} className="shrink-0" />
                              +{formatCurrency(item.diff)}
                            </span>
                          )}
                          {item.trend === 'down' && (
                            <span className="text-emerald-650 dark:text-emerald-400 flex items-center gap-0.5">
                              <ArrowDownRight size={11} className="shrink-0" />
                              {formatCurrency(item.diff)}
                            </span>
                          )}
                          {item.trend === 'neutral' && (
                            <span className="text-zinc-400 flex items-center gap-0.5">
                              <Minus size={11} className="shrink-0" />
                              Estável
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUNA 2: EVOLUÇÃO HISTÓRICA & PONTOS DE ATENÇÃO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <TrendingUp size={14} className="text-rose-500 shrink-0" />
                  <span>Evolução & Pontos Críticos</span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">Diagnóstico</span>
              </div>

              <div className="space-y-2">
                {spendingInsights.biggestGrowth ? (
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 text-xs">
                        <ArrowUpRight size={15} />
                        <span>Maior Alta Recente</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                        +{spendingInsights.biggestGrowth.pct.toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-zinc-650 dark:text-zinc-400 leading-snug text-[11px]">
                      A categoria <strong className="text-zinc-850 dark:text-zinc-200 font-bold">{spendingInsights.biggestGrowth.name}</strong> subiu <strong className="text-rose-600 dark:text-rose-400 font-bold">+{formatCurrency(spendingInsights.biggestGrowth.diff)}</strong> em relação à média dos meses anteriores.
                    </p>

                    {spendingInsights.growthCulpritName && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-2">
                        <div className="p-1 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded shrink-0 mt-0.5">
                          <AlertCircle size={12} />
                        </div>
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-snug">
                          <strong>Item de maior impacto:</strong> O gasto com <strong className="text-zinc-850 dark:text-zinc-200">"{spendingInsights.growthCulpritName}"</strong> somou {formatCurrency(spendingInsights.growthCulpritTotal)} (+{formatCurrency(spendingInsights.growthCulpritDiff)} vs média).
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-3 text-center space-y-1">
                    <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Consumo Controlado</p>
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500">Nenhuma categoria apresentou disparada expressiva em relação ao histórico.</p>
                  </div>
                )}

                {/* ALERTA DE GASTO ATÍPICO OU SEGUNDA ALTA */}
                {spendingInsights.topAtypical && (
                  <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded-xl p-2.5 flex items-start gap-2 text-xs">
                    <div className="p-1 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded shrink-0 mt-0.5">
                      <Flame size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200 text-[11px]">Compra Atípica Identificada</p>
                      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-snug mt-0.5">
                        <strong className="text-zinc-850 dark:text-zinc-100">"{spendingInsights.topAtypical.desc}"</strong> ({formatCurrency(spendingInsights.topAtypical.amount)}) foi um dos maiores desembolsos avulsos do mês.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA 3: PERFIL DE CONSUMO & PADRÕES TEMPORAIS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <BrainCircuit size={14} className="text-emerald-500 shrink-0" />
                  <span>Perfil & Concentração</span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">Trimestral</span>
              </div>
              
              <div className="space-y-2">
                {/* Concentração de Categorias e Subcategorias */}
                {spendingInsights.topCat && (
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-850 dark:text-zinc-200 text-[11px]">
                        <PieChart size={13} className="text-indigo-500 shrink-0" />
                        <span>Concentração Orçamentária</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                        {spendingInsights.topCat.pct.toFixed(0)}% do total
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      A categoria <strong className="text-zinc-850 dark:text-zinc-200">{spendingInsights.topCat.name}</strong> {spendingInsights.topSubcatName ? <span>(com foco em <strong>{spendingInsights.topSubcatName}</strong>)</span> : ''} lidera os gastos.
                    </p>

                    {spendingInsights.topExpenseName && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                        Principal custo: <strong className="text-zinc-850 dark:text-zinc-200">"{spendingInsights.topExpenseName}"</strong> (~{formatCurrency(spendingInsights.topExpenseVal)}/mês).
                      </p>
                    )}
                  </div>
                )}

                {/* Gastos de Fim de Semana vs Dias Úteis */}
                <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-2.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-zinc-850 dark:text-zinc-200 text-[11px]">
                      <Calendar size={13} className="text-violet-500 shrink-0" />
                      <span>Dias Úteis vs Fim de Semana</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-zinc-800 dark:text-zinc-200">
                      {spendingInsights.weekendPct.toFixed(0)}% no FDS
                    </span>
                  </div>

                  {/* Barra de Proporção Visual */}
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full flex overflow-hidden">
                      <div 
                        style={{ width: `${spendingInsights.weekdayPct}%` }} 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        title={`Dias Úteis: ${spendingInsights.weekdayPct.toFixed(0)}%`}
                      />
                      <div 
                        style={{ width: `${spendingInsights.weekendPct}%` }} 
                        className="h-full bg-violet-500 transition-all duration-500" 
                        title={`Fim de Semana: ${spendingInsights.weekendPct.toFixed(0)}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-400 font-semibold">
                      <span>Úteis: {spendingInsights.weekdayPct.toFixed(0)}%</span>
                      <span>Fim de Semana: {spendingInsights.weekendPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {spendingInsights.topWkndCatName && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 leading-snug">
                      Principal dreno de fim de semana: <strong className="text-zinc-850 dark:text-zinc-200">{spendingInsights.topWkndCatName}</strong> (~{formatCurrency(spendingInsights.topWkndCatVal)}/mês).
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 3: CARD UNIFICADO DE PATRIMÔNIO & INVESTIMENTOS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-6 transition-all duration-300 hover:shadow-md hover:scale-[1.004]">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Gestão de Patrimônio</h2>
          </div>
        </div>

        {/* 4 CARDS DE METRICAS PRINCIPAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm hover:shadow-md space-y-1 cursor-default transition-shadow"
          >
            <span className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider block">Patrimônio Total</span>
            <span className="text-xl sm:text-2xl font-bold tracking-tight block">
              {formatCurrency((totalPatrimonioAtual || 0))}
            </span>
            <span className="text-[10px] text-blue-200 block font-medium">Investimentos em Carteira</span>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md space-y-1 cursor-default transition-shadow"
          >
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Resultado Líquido</span>
            <span className={`text-xl sm:text-2xl font-bold tracking-tight block ${investmentStats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {investmentStats.totalProfit >= 0 ? '+' : ''}{formatCurrency((investmentStats.totalProfit || 0))}
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">Lucros + Proventos ({investmentStats.cumulativeReturnPct >= 0 ? '+' : ''}{investmentStats.cumulativeReturnPct.toFixed(1)}%)</span>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md space-y-1 cursor-default transition-shadow"
          >
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Rentabilidade (a.a.)</span>
            <span className={`text-xl sm:text-2xl font-bold tracking-tight block ${investmentStats.portfolioAnnualXTIR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {investmentStats.portfolioAnnualXTIR >= 0 ? '+' : ''}{investmentStats.portfolioAnnualXTIR.toFixed(2)}%
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">Taxa Interna de Retorno (XTIR)</span>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md space-y-1 cursor-default transition-shadow"
          >
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Capital p/ Aporte</span>
            <span className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-zinc-200 tracking-tight block">
              {formatCurrency(Math.max(0, (stats.balance || 0) - (stats.myInvestmentFromPocket || 0)))}
            </span>
            <span className="text-[10px] text-zinc-400 block font-medium">
              {stats.myInvestmentFromPocket > 0
                ? `Restante do mês (${formatCurrency(stats.myInvestmentFromPocket)} já aportado)`
                : 'Capacidade do mês'}
            </span>
          </motion.div>
        </div>

        {/* RANKING DESTAQUES */}
        <div className="w-full bg-zinc-900 dark:bg-zinc-950 p-5 rounded-2xl text-white space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Destaques da Carteira (Maior Rentabilidade)</span>
            <Sparkles size={16} className="text-amber-400" />
          </div>

          {investmentStats.top3.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {investmentStats.top3.map((asset, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2 cursor-default hover:bg-white/10 transition-colors"
                >
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
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic">Cadastre ativos de investimentos para visualizar a performance detalhada.</p>
          )}
        </div>
      </div>

      {/* SEÇÃO 5: CARTÕES & DÉBITO + PROJEÇÃO DE PARCELAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD 1: CARTÕES, DÉBITO E TOTAL DE GASTOS */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.006] transition-all duration-300 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* CABEÇALHO CARTÕES */}
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

            {/* LISTA DOS CARTÕES (sem scrollbar, tudo visível) */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {cardData.groupedCredit.filter(c => c.total > 0).length > 0 ? (
                cardData.groupedCredit.map(card => {
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
                })
              ) : (
                <p className="text-xs text-zinc-400 italic py-2">Nenhum gasto em cartão neste mês.</p>
              )}
            </div>

            {/* DÉBITO & DINHEIRO SEPARADO POR LINHA */}
            <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Banknote size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Débito & Dinheiro</span>
                  <span className="text-[10px] text-zinc-400">PIX, TED e pagamentos à vista</span>
                </div>
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency((stats.debitTotal || 0))}
              </span>
            </div>
          </div>

          {/* SOMA DE TODOS OS GASTOS */}
          <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-950/60 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:px-6 rounded-b-2xl sm:rounded-b-3xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Total de Gastos</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold">Mês</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency((stats.expense || 0))}
              </span>
              {stats.myExpense !== (stats.totalCredit + stats.debitTotal) && (
                <span className="text-[10px] text-zinc-500 font-medium">
                  Geral: {formatCurrency((stats.totalCredit + stats.debitTotal))}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: PROJEÇÃO DE PARCELAS */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.006] transition-all duration-300 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Projeção de Parcelas</h3>
              </div>
              {projectionScope && (
                <button 
                  onClick={() => setProjectionScope(null)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Ver todos
                </button>
              )}
            </div>

            {(installmentStats.userInstallmentTotal > 0 || installmentStats.nathyInstallmentTotal > 0) ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {installmentStats.userInstallmentTotal > 0 && (
                    <button 
                      onClick={() => setProjectionScope(projectionScope === 'user' ? null : 'user')} 
                      className={`flex-1 p-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        projectionScope === 'user' 
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-xs ring-1 ring-blue-400' 
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 shadow-xs hover:shadow-sm'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">Minhas Parcelas</span>
                      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(installmentStats.userInstallmentTotal)}</span>
                    </button>
                  )}

                  {installmentStats.nathyInstallmentTotal > 0 && (
                    <button 
                      onClick={() => setProjectionScope(projectionScope === 'nathy' ? null : 'nathy')} 
                      className={`flex-1 p-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        projectionScope === 'nathy' 
                          ? 'bg-pink-50 dark:bg-pink-950/50 border-pink-400 dark:border-pink-700 shadow-xs ring-1 ring-pink-400' 
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 shadow-xs hover:shadow-sm'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">Parcelas Adicionais</span>
                      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(installmentStats.nathyInstallmentTotal)}</span>
                    </button>
                  )}
                </div>

                {projectionScope && projectionData.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {projectionData.map((monthData, idx) => (
                      <div key={idx} className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                        <div className="flex justify-between items-center pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs font-bold">
                          <span className="capitalize text-zinc-700 dark:text-zinc-300">{monthData.date.toLocaleDateString('pt-BR', { month: 'long', year: '2-digit' })}</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(monthData.total)}</span>
                        </div>
                        <div className="space-y-1 text-[10px]">
                          {monthData.items.map((t, tIdx) => (
                            <div key={tIdx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span className="truncate max-w-[110px]">{t.description.replace(/\s\(\d+\/\d+\)$/, '')}</span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.installmentIndex}/{t.totalInstallments}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 text-center">
                    {projectionScope 
                      ? 'Nenhuma parcela futura registrada para este perfil.' 
                      : 'Selecione um dos perfis acima para visualizar o cronograma das faturas futuras.'}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-400 text-center">
                Nenhuma compra parcelada registrada no período.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 7: ÚLTIMAS MOVIMENTAÇÕES & PROVENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ÚLTIMOS LANÇAMENTOS */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.006] transition-all duration-300 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Clock size={18} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Últimos Lançamentos</h3>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[280px] overflow-y-auto pr-1">
            {recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.categoryId);
              const catColor = cat?.color || '#3b82f6';
              return (
                <div 
                  key={t.id} 
                  onClick={() => onEditTransaction(t)}
                  className="py-2.5 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl px-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                      style={{ backgroundColor: catColor }}
                    >
                      <IconRenderer iconName={cat?.icon || 'circle'} size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate block">{t.description}</span>
                      <span className="text-[10px] font-medium flex items-center gap-1">
                        <span className="text-zinc-400">{safeFormatPtBR(t.date, { day: '2-digit', month: '2-digit' })}</span>
                        <span className="text-zinc-400">•</span>
                        <span className="font-semibold truncate max-w-[140px]" style={{ color: catColor }}>
                          {cat?.name || 'Sem categoria'}
                        </span>
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.006] transition-all duration-300 space-y-4">
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
