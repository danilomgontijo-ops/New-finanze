import React, { useState, useEffect, useMemo } from "react";
import {
  Transaction,
  TransactionType,
  Category,
  SubCategory,
  CreditCard,
  UserSettings,
  AssetPrice,
  InvestmentDetails,
  PaymentMethod,
} from "../types";
import { StorageService, AssetHistory } from "../services/storageService";
import { GeminiService } from "../services/geminiService";
import { BrapiService } from "../services/brapiService";
import { SheetsService } from "../services/sheetsService";
import { DividendBulkImporter } from "./DividendBulkImporter";
import { AiDividendRadar } from "./AiDividendRadar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
  Pie,
  PieChart,
  Legend,
  AreaChart,
  Area,
  LineChart,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Target,
  Wallet,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Sparkles,
  AlertCircle,
  BarChart3,
  RefreshCw,
  List,
  Pencil,
  Trash2,
  X,
  Check,
  Save,
  CloudLightning,
  Calculator,
  Loader2,
  ExternalLink,
  Info,
  History,
  CheckSquare,
  Square,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Upload,
  Search,
  Filter,
  Landmark,
  Edit3,
  AlertTriangle,
  Layers,
  Gift,
  Divide,
  Merge,
  Globe,
  DollarSign,
  LayoutList,
  RefreshCcw,
  MoreHorizontal,
  Activity,
  FileText,
  Download,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  Banknote,
  AreaChart as AreaChartIcon,
  Clock,
  Percent,
  ShieldCheck,
  PieChart as PieChartIcon,
  Clipboard,
} from "lucide-react";

interface InvestmentsProps {
  cdiHistory?: { date: string; value: number }[];
  ipcaHistory?: { date: string; value: number }[];
  ibovHistory?: { date: string; value: number }[];
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  settings: UserSettings;
  currentDate: Date;
  assetPrices: AssetPrice[];
  onDateChange: (date: Date) => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string, mode?: "single" | "future" | "all") => void;
  onOpenBulkImport: () => void;
  onOpenDividendForm: () => void;
}

interface PortfolioItem {
  ticker: string;
  quantity: number;
  totalCost: number; // Custo de Aquisição (Base Fiscal)
  historicalCost: number; // Custo Histórico ajustado (Para performance)
  avgPriceFiscal: number; // PM Fiscal (Para IR)
  avgPriceYield: number; // PM Ajustado por Proventos (Gerencial - Breakeven)
  totalProventos: number;
  totalProventos12m: number;
  realizedProfit: number;
  category: string;
  subCategory: string;
  categoryId: string;
  subCategoryId: string;
  currency: string;
  broker: string;
  longName?: string;
  yieldRate?: string;
  earliestDate?: Date;
  currentQuote: number;
  currentPriceBRL: number;
  currentTotal: number; // Valor de Mercado Atual
  unrealizedProfit: number; // Lucro não realizado (Mercado - Custo)
  totalProfit: number; // Retorno Total (Não realizado + Proventos + Realizado)
  totalReturnPct: number;
  xtir: number;
  dailyChangePercent: number;
  dailyProfit: number;
  cashFlows: { date: Date; amount: number }[];
  isFixedIncome?: boolean;
}

const calculateXIRR = (
  values: number[],
  dates: Date[],
  guess: number = 0.1,
): number => {
  const xirr = (values: number[], dates: Date[], guess: number) => {
    const limit = 100;
    const tol = 1e-6;
    let x0 = guess;
    for (let i = 0; i < limit; i++) {
      let fValue = 0;
      let fDerivative = 0;
      for (let j = 0; j < values.length; j++) {
        const dt =
          (dates[j].getTime() - dates[0].getTime()) /
          (1000 * 60 * 60 * 24 * 365.25);
        const factor = Math.pow(Math.abs(1 + x0), dt);
        const sign = 1 + x0 >= 0 ? 1 : Math.floor(dt) % 2 === 0 ? 1 : -1;
        fValue += values[j] / (sign * factor);
        fDerivative += (-dt * values[j]) / (sign * factor * (1 + x0));
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
    if (
      values.length === 0 ||
      values.every((v) => v >= 0) ||
      values.every((v) => v <= 0)
    )
      return 0;
    const result = xirr(values, dates, guess);
    return isNaN(result) || !isFinite(result) ? 0 : result * 100;
  } catch (e) {
    return 0;
  }
};

// Alíquota média estimada para imposto de renda sobre Renda Fixa em resgates parciais (tabela regressiva de 15% a 22.5%, adotando 20% como média)
const ESTIMATED_FIXED_INCOME_TAX_RATE = 0.20;

// Taxa diária de CDI padrão de fallback caso a consulta online não esteja disponível (equivalente a uma taxa anual estável de 10.75%)
const FALLBACK_DAILY_CDI_RATE = 0.040168;

const getYoCCostBasis = (historicalCost: number, totalCost: number): number => {
  return historicalCost > 0 ? historicalCost : (totalCost > 0 ? totalCost : 0);
};

const calculateYoC = (proventos12m: number, costBasis: number): number => {
  return costBasis > 0 ? (proventos12m / costBasis) * 100 : 0;
};

const convertAnnualToMonthlyCompound = (annualRatePct: number): number => {
  return (Math.pow(1 + annualRatePct / 100, 1 / 12) - 1) * 100;
};

const formatCurrency = (val: number, currency: string = "BRL") =>
  (val || 0).toLocaleString("pt-BR", { style: "currency", currency: currency });

const getAssetIcon = (ticker: string, category: string = "") => {
  const cleanTicker = ticker.trim().toUpperCase();
  if (
    category.toLowerCase().includes("cripto") ||
    BrapiService.isCrypto(cleanTicker)
  ) {
    const symbol = cleanTicker.replace("BRL", "").toLowerCase();
    // Special mapping for some logos if needed, otherwise default to symbol-symbol
    return `https://cryptologos.cc/logos/${symbol}-${symbol}-logo.png`;
  }
  return `https://icons.brapi.dev/icons/${cleanTicker}.svg`;
};

// Fixed Income Logic
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

const calculateRealFixedIncome = (
  principal: number,
  startDateInput: string | Date,
  rateStr: string,
  cdiData: { date: string; value: number }[],
  endDateInput?: string | Date,
): number => {
  if (!principal || principal <= 0) return 0;
  if (!rateStr || typeof rateStr !== "string") rateStr = "100% CDI";

  const startIso = toIsoDateStr(startDateInput);
  const endIso = toIsoDateStr(endDateInput);

  const upperStr = rateStr.toUpperCase().trim();
  let pctCDI = 0;
  let isCDI = false;
  let fixedRate = 0;

  const numbers = upperStr.match(/(\d+(?:[.,]\d+)?)/g);

  const hasCdiExplicit =
    upperStr.includes("CDI") ||
    upperStr.includes("INTER") ||
    upperStr.includes("CDB") ||
    upperStr.includes("LCI") ||
    upperStr.includes("LCA") ||
    upperStr.includes("CRI") ||
    upperStr.includes("CRA") ||
    upperStr.includes("POUPA") ||
    upperStr.includes("DO CDI");

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
    if (val >= 50 && !upperStr.includes("IPCA")) {
      isCDI = true;
      pctCDI = val;
    } else {
      fixedRate = val;
    }
  } else {
    isCDI = true;
    pctCDI = 100;
  }

  if (isCDI) {
    if (!cdiData || cdiData.length === 0) return principal;

    const relevantRates = cdiData.filter(
      (d) => d.date >= startIso && d.date <= endIso,
    );
    let accumulatedFactor = 1;
    for (const day of relevantRates) {
      const dailyFactor = 1 + (day.value / 100) * (pctCDI / 100);
      accumulatedFactor *= dailyFactor;
    }
    return principal * accumulatedFactor;
  } else {
    const relevantRates = cdiData ? cdiData.filter((d) => d.date >= startIso && d.date <= endIso) : [];
    const businessDays = relevantRates.length > 0 ? relevantRates.length : Math.ceil(Math.abs(new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) * (252 / 365);
    const years = businessDays / 252;
    if (fixedRate > 0) return principal * Math.pow(1 + fixedRate / 100, years);
  }
  return principal;
};

const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = (id: string) => {
    if (selected.includes(id))
      onChange(selected.filter((x: string) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 cursor-pointer flex items-center justify-between min-w-[120px]"
      >
        <span className="truncate">
          {selected.length === 0
            ? placeholder
            : `${selected.length} selecionados`}
        </span>
        <ChevronDown size={10} />
      </div>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
            {options.map((opt: any) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-[10px]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="rounded border-slate-300"
                />
                <span className="truncate">{opt.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const Investments: React.FC<InvestmentsProps> = ({
  cdiHistory = [],
  ipcaHistory = [],
  ibovHistory = [],
  transactions,
  categories,
  subCategories = [],
  creditCards,
  settings,
  currentDate,
  assetPrices,
  onDateChange,
  onEditTransaction,
  onDeleteTransaction,
  onOpenBulkImport,
  onOpenDividendForm,
}) => {
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['cdiAccum', 'ipcaAccum', 'ibovAccum']);
  const [activeTab, setActiveTab] = useState<
    "overview" | "portfolio" | "history" | "proventos" | "tax"
  >("overview");
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");


  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalCategoryFilters, setGlobalCategoryFilters] = useState<string[]>([]);
  const [globalSubCategoryFilters, setGlobalSubCategoryFilters] = useState<string[]>([]);
  const portfolioSearchTerm = globalSearchTerm;
  const setPortfolioSearchTerm = setGlobalSearchTerm;
  const portfolioCategoryFilters = globalCategoryFilters;
  const setPortfolioCategoryFilters = setGlobalCategoryFilters;
  const portfolioSubCategoryFilters = globalSubCategoryFilters;
  const setPortfolioSubCategoryFilters = setGlobalSubCategoryFilters;
  const historySearchTerm = globalSearchTerm;
  const setHistorySearchTerm = setGlobalSearchTerm;

  const [historyViewMode, setHistoryViewMode] = useState<
    "grouped" | "operations" | "dividends"
  >("grouped");

  const [expandedTickerHistory, setExpandedTickerHistory] = useState<
    string | null
  >(null);
  const [expandedSubCategories, setExpandedSubCategories] = useState<
    Set<string>
  >(new Set());
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const historyFilterCategory = globalCategoryFilters[0] || "";
  const setHistoryFilterCategory = (val: string) => setGlobalCategoryFilters(val ? [val] : []);
  const historyFilterSubCategory = globalSubCategoryFilters[0] || "";
  const setHistoryFilterSubCategory = (val: string) => setGlobalSubCategoryFilters(val ? [val] : []);

    useState("");
  const overviewSearchTerm = globalSearchTerm;
  const setOverviewSearchTerm = setGlobalSearchTerm;
  const [overviewFilterDate, setOverviewFilterDate] = useState<string | null>(
    null,
  );

  const proventosSearch = globalSearchTerm;
  const setProventosSearch = setGlobalSearchTerm;

  
  const [isDivBulkOpen, setIsDivBulkOpen] = useState(false);
  const [isAiRadarOpen, setIsAiRadarOpen] = useState(false);
  const [assetHistory, setAssetHistory] = useState<
    Record<string, AssetHistory>
  >({});
  const [isManualHistoryOpen, setIsManualHistoryOpen] = useState(false);
  const [manualHistoryTab, setManualHistoryTab] = useState<"single" | "bulk">(
    "single",
  );
  const [selectedTickerForHistory, setSelectedTickerForHistory] = useState<
    string | null
  >(null);
  const [selectedManualDates, setSelectedManualDates] = useState<string[]>([]);
  const [syncHistoryStatus, setSyncHistoryStatus] = useState("");
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [individualDeleteConfirm, setIndividualDeleteConfirm] = useState<
    string | null
  >(null);
  const [manualPriceActionError, setManualPriceActionError] = useState("");

  useEffect(() => {
    const unsub = StorageService.subscribeToAssetHistory((data) => {
      setAssetHistory(data);
    });
    return () => unsub();
  }, []);

  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchTargetCat, setBatchTargetCat] = useState("");
  const [batchTargetSub, setBatchTargetSub] = useState("");
  const [batchTargetTicker, setBatchTargetTicker] = useState("");
  const [batchTargetBroker, setBatchTargetBroker] = useState("");
  const [isBatchSaving, setIsBatchSaving] = useState(false);

  const [proventosYearFilter, setProventosYearFilter] = useState(
    new Date().getFullYear().toString(),
  );
  const proventosTickerFilter = globalSearchTerm;
  const setProventosTickerFilter = setGlobalSearchTerm;
  const proventosCategoryFilter = globalCategoryFilters[0] || "";
  const setProventosCategoryFilter = (val: string) => setGlobalCategoryFilters(val ? [val] : []);

  const [taxViewMode, setTaxViewMode] = useState<"darf" | "dirf">("darf");
  const [taxYearFilter, setTaxYearFilter] = useState(
    new Date().getFullYear().toString(),
  );
  const [selectedTaxMonth, setSelectedTaxMonth] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedMonthDetails, setSelectedMonthDetails] = useState<any[]>([]);



  const isNathyTransaction = (t: Transaction) => {
    const nathyCategory = categories.find(
      (c) => c.name.toLowerCase() === "nathy",
    );
    const isNathyCat = nathyCategory && t.categoryId === nathyCategory.id;
    const isNathyDesc = t.description.toLowerCase().includes("(parte nathy)");
    return isNathyCat || isNathyDesc;
  };

  const investmentTransactions = useMemo<Transaction[]>(
    () =>
      transactions
        .filter(
          (t) =>
            t.type === TransactionType.INVESTMENT && !isNathyTransaction(t),
        )
        .sort((a, b) => {
          const dateA = a.date.split("T")[0];
          const dateB = b.date.split("T")[0];
          const dateDiff = dateA.localeCompare(dateB);
          if (dateDiff !== 0) return dateDiff;

          const order: Record<string, number> = {
            BUY: 1,
            BONUS: 2,
            SELL: 3,
            SPLIT: 4,
            MERGE: 5,
            TICKER_UPDATE: 6,
            AMORTIZACAO: 7,
          };
          const aOrder = order[a.investmentDetails?.event || ""] || 99;
          const bOrder = order[b.investmentDetails?.event || ""] || 99;
          return aOrder - bOrder;
        }),
    [transactions],
  );

  const portfolioData = useMemo(() => {
    const usdPriceObj = assetPrices.find((p) => p.ticker === "USDBRL");
    const currentUsdRate = usdPriceObj ? usdPriceObj.currentPrice : 1;
    const assets: Record<string, any> = {};
    const profitMap: Record<string, number> = {};
    let totalRealizedProfit = 0;

    investmentTransactions.forEach((t) => {
      if (!t.investmentDetails) return;
      const {
        ticker,
        quantity,
        price,
        event,
        currency,
        broker,
        newTicker,
        yieldRate,
      } = t.investmentDetails;
      const tDate = new Date(t.date);

      if (!assets[ticker]) {
        const cat = categories.find((c) => c.id === t.categoryId);
        const sub = subCategories.find((s) => s.id === t.subCategoryId);
        assets[ticker] = {
          ticker,
          quantity: 0,
          totalCost: 0,
          totalProventos: 0,
          totalProventos12m: 0,
          bonusCost: 0,
          realizedProfit: 0,
          historicalCost: 0,
          category: cat?.name || "Outros",
          subCategory: sub?.name || "Geral",
          categoryId: t.categoryId,
          subCategoryId: t.subCategoryId || "",
          currency: currency || "BRL",
          broker: broker || "Carteira",
          cashFlows: [],
          yieldRate: yieldRate || undefined,
          earliestDate: tDate,
          lots: [], // FIFO Tracking: Array of { date: Date, q: number, cost: number, yieldRate?: string }
        };
      }
      const a = assets[ticker];
      if (tDate < a.earliestDate) a.earliestDate = tDate;

      if (["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(event)) {
        a.totalProventos += t.amount;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (tDate >= oneYearAgo) a.totalProventos12m += t.amount;

        a.cashFlows.push({ date: tDate, amount: t.amount });
      } else if (event === "AMORTIZACAO") {
        a.totalCost -= t.amount;
        a.historicalCost -= t.amount;
        a.cashFlows.push({ date: tDate, amount: t.amount });
      } else if (event === "BUY") {
        a.quantity += quantity;
        a.totalCost += t.amount;
        a.historicalCost += t.amount;
        a.cashFlows.push({ date: tDate, amount: -t.amount });
        // Add to FIFO Lots
        const rateForLot = yieldRate || a.yieldRate;
        a.lots.push({
          date: tDate,
          q: quantity,
          cost: t.amount,
          yieldRate: rateForLot,
        });
        if (yieldRate) a.yieldRate = yieldRate;
      } else if (event === "SELL") {
        const tickerUpper = ticker.toUpperCase();
        const isFixed =
          !!a.yieldRate ||
          tickerUpper.startsWith("TD:") ||
          tickerUpper.includes("TESOURO") ||
          tickerUpper.includes("CDB") ||
          tickerUpper.includes("INTER") ||
          tickerUpper.includes("LCI") ||
          tickerUpper.includes("LCA") ||
          tickerUpper.includes("CRI") ||
          tickerUpper.includes("CRA") ||
          tickerUpper.includes("DEBENTURE") ||
          tickerUpper.includes("CDI") ||
          tickerUpper.includes("100%");
        let costOfSold = 0;
        const fees = t.investmentDetails.fees || 0;
        const tax = t.investmentDetails.tax || 0;

        let actualQtySold = quantity;
        let isFullSale =
          Math.abs(quantity - a.quantity) < 0.000001 ||
          t.investmentDetails.isTotalRedemption ||
          false;

        if (isFixed) {
          let estimatedTotalValue = 0;
          a.lots.forEach((lot: any) => {
            estimatedTotalValue += calculateRealFixedIncome(
              lot.cost,
              lot.date,
              a.yieldRate || lot.yieldRate || "100% CDI",
              cdiHistory,
              t.date,
            );
          });
          if (estimatedTotalValue === 0) estimatedTotalValue = a.totalCost;

          if (
            t.investmentDetails.isTotalRedemption ||
            t.amount + fees + tax >= estimatedTotalValue * 0.98
          ) {
            isFullSale = true;
          } else if (t.amount + fees + tax < estimatedTotalValue * 0.95) {
            isFullSale = false;
          }
        }

        if (isFullSale) {
          costOfSold = a.totalCost;
          actualQtySold = a.quantity;
          a.lots = [];
        } else if (isFixed) {
          // Renda Fixa Parcial: Usa o valor financeiro para abater os lotes
          let remainingGrossAmountToSell = t.amount + fees + tax;
          let calculatedCostOfSold = 0;
          let calculatedQtySold = 0;

          a.lots.sort(
            (x: any, y: any) =>
              new Date(x.date).getTime() - new Date(y.date).getTime(),
          );
          let tempLots = JSON.parse(JSON.stringify(a.lots));

          while (remainingGrossAmountToSell > 0.01 && tempLots.length > 0) {
            const lot = tempLots[0];
            let lotCurrentValue = calculateRealFixedIncome(
              lot.cost,
              lot.date,
              a.yieldRate || lot.yieldRate || "100% CDI",
              cdiHistory,
              t.date,
            );
            if (lotCurrentValue <= lot.cost && tax > 0) {
              lotCurrentValue = lot.cost + tax / ESTIMATED_FIXED_INCOME_TAX_RATE;
            }

            if (lotCurrentValue <= 0) {
              tempLots.shift();
              continue;
            }

            if (remainingGrossAmountToSell >= lotCurrentValue * 0.999) {
              calculatedCostOfSold += lot.cost;
              remainingGrossAmountToSell -= lotCurrentValue;
              calculatedQtySold += lot.q;
              tempLots.shift();
            } else {
              const ratio = Math.min(1, remainingGrossAmountToSell / lotCurrentValue);
              const lotCostSold = lot.cost * ratio;
              const lotQtySold = lot.q * ratio;
              calculatedCostOfSold += lotCostSold;
              calculatedQtySold += lotQtySold;
              lot.cost -= lotCostSold;
              lot.q -= lotQtySold;
              remainingGrossAmountToSell = 0;
              if (lot.cost <= 0.0001) {
                tempLots.shift();
              }
            }
          }
          costOfSold = calculatedCostOfSold;
          actualQtySold = calculatedQtySold;
          a.lots = tempLots;
        } else {
          // Renda Variável Parcial: Custo Médio
          const avgPrice = a.quantity > 0 ? a.totalCost / a.quantity : 0;
          costOfSold = actualQtySold * avgPrice;

          let qtyToSell = actualQtySold;
          while (qtyToSell > 0 && a.lots.length > 0) {
            const lot = a.lots[0];
            if (lot.q > qtyToSell) {
              const unitCost = lot.cost / lot.q;
              const partialCost = unitCost * qtyToSell;
              lot.q -= qtyToSell;
              lot.cost -= partialCost;
              qtyToSell = 0;
            } else {
              qtyToSell -= lot.q;
              a.lots.shift();
            }
          }
        }

        // Se a quantidade restante for muito pequena, limpa os lotes
        if (a.quantity - actualQtySold <= 0.000001) {
          a.lots = [];
        }

        const transactionProfit = t.amount - costOfSold;

        const previousTotalCost = a.totalCost;
        const reductionRatio =
          previousTotalCost > 0
            ? Math.max(0, (previousTotalCost - costOfSold) / previousTotalCost)
            : 0;

        a.totalCost -= costOfSold;

        if (a.quantity <= 0.000001) a.historicalCost = 0;
        else a.historicalCost = a.historicalCost * reductionRatio;

        profitMap[t.id] = transactionProfit;
        a.realizedProfit += transactionProfit;
        totalRealizedProfit += transactionProfit;
        a.quantity -= actualQtySold;

        // FORCE CLEANUP IF SOLD OUT
        if (
          (!isFixed && a.quantity < 0.000001) ||
          (isFixed && a.totalCost < 1)
        ) {
          a.quantity = 0;
          a.totalCost = 0;
          a.historicalCost = 0;
          a.lots = [];
        }

        a.cashFlows.push({ date: tDate, amount: t.amount });
      } else if (event === "BONUS") {
        const bonusValue = quantity * price;
        a.quantity += quantity;
        a.totalCost += bonusValue;
        a.historicalCost += bonusValue;
        a.bonusCost += bonusValue;
        a.lots.push({ date: tDate, q: quantity, cost: bonusValue });
      } else if (event === "SPLIT") {
        const factor =
          quantity > 50 && a.quantity > 0
            ? (a.quantity + quantity) / a.quantity
            : quantity;
        a.quantity *= factor;
        a.lots.forEach((lot: any) => {
          lot.q *= factor;
        });
      } else if (event === "MERGE") {
        a.quantity /= quantity;
        a.lots.forEach((lot: any) => {
          lot.q /= quantity;
        });
      } else if (event === "TICKER_UPDATE" && newTicker) {
        const targetTicker = newTicker.toUpperCase();
        if (!assets[targetTicker])
          assets[targetTicker] = {
            ticker: targetTicker,
            quantity: 0,
            totalCost: 0,
            totalProventos: 0,
            totalProventos12m: 0,
            bonusCost: 0,
            realizedProfit: 0,
            historicalCost: 0,
            category: a.category,
            subCategory: a.subCategory,
            categoryId: a.categoryId,
            subCategoryId: a.subCategoryId,
            currency: a.currency,
            broker: a.broker,
            cashFlows: [],
            yieldRate: a.yieldRate,
            earliestDate: a.earliestDate,
            lots: [],
          };
        const b = assets[targetTicker];
        const multiplier = quantity && quantity > 0 ? quantity : 1;
        b.quantity += a.quantity * multiplier;
        b.totalCost += a.totalCost;
        b.historicalCost += a.historicalCost;
        b.totalProventos += a.totalProventos;
        b.totalProventos12m += a.totalProventos12m;
        b.bonusCost += a.bonusCost;
        b.realizedProfit += a.realizedProfit;
        b.cashFlows = [...b.cashFlows, ...a.cashFlows];
        const adjustedLots = a.lots.map((lot: any) => ({
          ...lot,
          q: lot.q * multiplier,
        }));
        b.lots = [...b.lots, ...adjustedLots];
        a.quantity = 0;
        a.totalCost = 0;
        a.historicalCost = 0;
        a.totalProventos = 0;
        a.totalProventos12m = 0;
        a.bonusCost = 0;
        a.realizedProfit = 0;
        a.cashFlows = [];
        a.lots = [];
      }
    });

    const list: PortfolioItem[] = Object.values(assets)
      .filter((a: any) => {
        if (
          portfolioCategoryFilters.length > 0 &&
          !portfolioCategoryFilters.includes(a.categoryId)
        )
          return false;
        if (
          portfolioSubCategoryFilters.length > 0 &&
          !portfolioSubCategoryFilters.includes(a.subCategoryId)
        )
          return false;
        if (portfolioSearchTerm) {
          const searchTerms = portfolioSearchTerm.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
          if (searchTerms.length > 0) {
            const matches = searchTerms.some(term => a.ticker.toUpperCase().includes(term));
            if (!matches) return false;
          }
        }
        return true;
      })
      .map((a: any) => {
        const priceObj = assetPrices.find((p) => p.ticker === a.ticker);
        const avgPrice = a.quantity > 0 ? a.totalCost / a.quantity : 0;
        let rawQuote = avgPrice;
        let currentTotal = 0;
        let isFixedIncome = false;
        let calculatedBalanceYesterday = 0;
        let todayNetFlow = 0;
        const isTesouro =
          a.ticker.startsWith("TD:") || a.ticker.startsWith("TESOURO");

        const catName = a.category?.toLowerCase() || "";
        const subCatName = a.subCategory?.toLowerCase() || "";
        const tickerUpper = a.ticker.toUpperCase();
        const isFixedType =
          catName.includes("renda fixa") ||
          subCatName.includes("renda fixa") ||
          catName.includes("poupança") ||
          subCatName.includes("poupança") ||
          tickerUpper.includes("CDB") ||
          tickerUpper.includes("LCI") ||
          tickerUpper.includes("LCA") ||
          tickerUpper.includes("CRI") ||
          tickerUpper.includes("CRA") ||
          tickerUpper.includes("DEBENTURE") ||
          tickerUpper.includes("INTER") ||
          tickerUpper.includes("TESOURO") ||
          tickerUpper.includes("TD:") ||
          tickerUpper.includes("CDI") ||
          tickerUpper.includes("100%") ||
          !!a.yieldRate;

        if (!a.yieldRate && isFixedType && !isTesouro) {
          a.yieldRate =
            tickerUpper.includes("POUPA") || catName.includes("poupança")
              ? "70% CDI"
              : a.ticker;
        }

        if (
          a.yieldRate &&
          !isTesouro &&
          !(
            priceObj &&
            priceObj.manualHistory &&
            priceObj.manualHistory.length > 0
          )
        ) {
          isFixedIncome = true;
          // Optimization: If quantity is 0, don't run expensive calculations
          if (a.quantity <= 0.000001 && (!a.lots || a.lots.length === 0)) {
            currentTotal = 0;
            calculatedBalanceYesterday = 0;
          } else {
            let calcBal = 0;
            let calcYesterday = 0;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString();

            if (a.lots && a.lots.length > 0) {
              let totalLotCost = 0;
              a.lots.forEach((lot: any) => {
                totalLotCost += lot.cost;
                const rateToUse = a.yieldRate || lot.yieldRate || "100% CDI";
                const curVal = calculateRealFixedIncome(
                  lot.cost,
                  lot.date,
                  rateToUse,
                  cdiHistory,
                );
                calcBal += curVal;

                const lotDateStr =
                  lot.date instanceof Date
                    ? lot.date.toISOString()
                    : String(lot.date);
                if (lotDateStr <= yesterdayStr) {
                  calcYesterday += calculateRealFixedIncome(
                    lot.cost,
                    lot.date,
                    rateToUse,
                    cdiHistory,
                    yesterdayStr,
                  );
                } else {
                  todayNetFlow += lot.cost;
                }
              });
              if (totalLotCost > 0) a.totalCost = totalLotCost;
            } else if (a.totalCost > 0) {
              const rateToUse = a.yieldRate || "100% CDI";
              const startDate = a.earliestDate || new Date();
              calcBal = calculateRealFixedIncome(
                a.totalCost,
                startDate,
                rateToUse,
                cdiHistory,
              );
              calcYesterday = calculateRealFixedIncome(
                a.totalCost,
                startDate,
                rateToUse,
                cdiHistory,
                yesterdayStr,
              );
            }

            if (calcBal < 0.01 && a.totalCost > 0) calcBal = a.totalCost;
            if (calcYesterday <= 0.01 && a.totalCost - todayNetFlow > 0)
              calcYesterday = a.totalCost - todayNetFlow;

            currentTotal = calcBal;
            calculatedBalanceYesterday = calcYesterday;
          }
          rawQuote = currentTotal;
        } else {
          if (isTesouro) isFixedIncome = true;
          let quoteBRL = rawQuote;
          if (priceObj) {
            if (priceObj.manualHistory && priceObj.manualHistory.length > 0) {
              const sortedH = [...priceObj.manualHistory].sort((m1, m2) =>
                m2.date.localeCompare(m1.date),
              );
              rawQuote = sortedH[0].price;
            } else {
              rawQuote = priceObj.currentPrice;
            }
            quoteBRL =
              a.currency === "USD" ? rawQuote * currentUsdRate : rawQuote;
          } else {
            quoteBRL = avgPrice; // avgPrice is always in BRL
          }
          currentTotal = a.quantity * quoteBRL;
        }

        let quoteBRL = rawQuote;
        if (priceObj) {
          let finalPrice = priceObj.currentPrice;
          if (priceObj.manualHistory && priceObj.manualHistory.length > 0) {
            const sortedH = [...priceObj.manualHistory].sort((m1, m2) =>
              m2.date.localeCompare(m1.date),
            );
            finalPrice = sortedH[0].price;
          }
          quoteBRL =
            a.currency === "USD" ? finalPrice * currentUsdRate : finalPrice;
        } else {
          quoteBRL = avgPrice;
        }

        const unrealizedProfit =
          currentTotal - (a.totalCost - (a.bonusCost || 0));
        const totalProfit = unrealizedProfit + a.totalProventos;

        let xtir = 0;
        if (a.cashFlows.length > 0 && currentTotal > 0) {
          let closingDate = new Date();
          if (
            priceObj &&
            priceObj.manualHistory &&
            priceObj.manualHistory.length > 0
          ) {
            const sortedH = [...priceObj.manualHistory].sort((m1, m2) =>
              m2.date.localeCompare(m1.date),
            );
            closingDate = new Date(sortedH[0].date);
          }
          const flows = [
            ...a.cashFlows,
            { date: closingDate, amount: currentTotal },
          ];
          xtir = calculateXIRR(
            flows.map((f: any) => f.amount),
            flows.map((f: any) => f.date),
          );
        }

        let finalDailyProfit =
          (currentTotal * (priceObj?.changePercent || 0)) / 100;
        let finalDailyChangePct = priceObj?.changePercent || 0;

        if (isFixedIncome && currentTotal > 0) {
          if (calculatedBalanceYesterday > 0 && !isTesouro) {
            finalDailyProfit =
              currentTotal - calculatedBalanceYesterday - todayNetFlow;
            finalDailyChangePct =
              calculatedBalanceYesterday > 0
                ? (finalDailyProfit / calculatedBalanceYesterday) * 100
                : 0;
          }

          if (
            Math.abs(finalDailyProfit) <= 0.001 &&
            Math.abs(finalDailyChangePct) <= 0.001
          ) {
            let rateStrToUse = a.yieldRate || "";
            if (!rateStrToUse && isTesouro) {
              const tickerObjId = (priceObj?.ticker || a.ticker).toUpperCase();
              const fallbackTaxa = (priceObj as any)?.taxa || 0;
              if (tickerObjId.includes("SELIC")) {
                rateStrToUse = "100% CDI";
              } else if (
                tickerObjId.includes("IPCA") ||
                tickerObjId.includes("RENDA") ||
                tickerObjId.includes("EDUCA")
              ) {
                rateStrToUse = `IPCA+${fallbackTaxa > 0 ? fallbackTaxa : 5.0}`;
              } else if (tickerObjId.includes("PRE")) {
                rateStrToUse = `${fallbackTaxa > 0 ? fallbackTaxa : 10.0}`;
              }
            }

            if (rateStrToUse) {
              const cleanRate = rateStrToUse
                .toUpperCase()
                .replace(",", ".")
                .replace("%", "");
              let dailyFactor = 1;

              if (cleanRate.includes("CDI") || cleanRate.includes("SELIC")) {
                const numStr = cleanRate
                  .replace("CDI", "")
                  .replace("SELIC", "")
                  .trim();
                let pctCDI = numStr ? parseFloat(numStr) : 100;
                if (isNaN(pctCDI)) pctCDI = 100;

                let lastDailyCDI = FALLBACK_DAILY_CDI_RATE; // fallback
                if (cdiHistory && cdiHistory.length > 0) {
                  lastDailyCDI = cdiHistory[cdiHistory.length - 1].value;
                }
                dailyFactor = 1 + (lastDailyCDI / 100) * (pctCDI / 100);
              } else if (cleanRate.includes("IPCA")) {
                const numStr = cleanRate
                  .replace("IPCA", "")
                  .replace("+", "")
                  .trim();
                let fixed = parseFloat(numStr) || 0;
                dailyFactor = Math.pow(1 + (fixed + 4.0) / 100, 1 / 365.25);
              } else {
                let fixedRate = parseFloat(cleanRate) || 0;
                dailyFactor = Math.pow(1 + fixedRate / 100, 1 / 365.25);
              }

              finalDailyChangePct = (dailyFactor - 1) * 100;
              finalDailyProfit = currentTotal - currentTotal / dailyFactor;
            }
          }
        }

        return {
          ...a,
          isFixedIncome,
          avgPriceFiscal: avgPrice,
          avgPriceYield:
            a.quantity > 0 ? Math.max(0, (a.totalCost - a.totalProventos) / a.quantity) : 0,
          currentQuote: rawQuote,
          currentPriceBRL: quoteBRL,
          currentTotal,
          unrealizedProfit,
          totalProfit,
          totalReturnPct:
            a.totalCost - (a.bonusCost || 0) > 0
              ? (totalProfit / (a.totalCost - (a.bonusCost || 0))) * 100
              : 0,
          xtir,
          longName: priceObj?.longName || a.ticker,
          dailyChangePercent: finalDailyChangePct,
          dailyProfit: finalDailyProfit,
        };
      })
      .filter((i: any) => {
        // FILTER: Must have quantity. Dust removal for Fixed Income too.
        if (i.quantity <= 0.000001 && !i.isFixedIncome) return false;
        if (i.isFixedIncome) return i.currentTotal > 1 && i.totalCost > 0.01;
        return true;
      });

    const summary = list.reduce(
      (acc: any, curr: any) => {
        if (
          curr.quantity > 0.000001 ||
          (curr.isFixedIncome && curr.currentTotal > 1)
        ) {
          acc.marketValue += curr.currentTotal;
          acc.investedValue += curr.totalCost - (curr.bonusCost || 0);
          acc.unrealizedTotal += curr.unrealizedProfit;
          acc.dailyProfitTotal += curr.dailyProfit;
        }
        return acc;
      },
      {
        marketValue: 0,
        investedValue: 0,
        unrealizedTotal: 0,
        proventosTotal: 0,
        proventos12mTotal: 0,
        realizedProfit: 0,
        dailyProfitTotal: 0,
      },
    );

    // Calculate realizedProfit and proventosTotal from ALL filtered assets (including sold ones)
    Object.values(assets).forEach((a: any) => {
      if (
        portfolioCategoryFilters.length > 0 &&
        !portfolioCategoryFilters.includes(a.categoryId)
      )
        return;
      if (
        portfolioSubCategoryFilters.length > 0 &&
        !portfolioSubCategoryFilters.includes(a.subCategoryId)
      )
        return;
      if (portfolioSearchTerm) {
        const searchTerms = portfolioSearchTerm.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => a.ticker.toUpperCase().includes(term));
          if (!matches) return;
        }
      }
      summary.realizedProfit += a.realizedProfit;
      summary.proventosTotal += a.totalProventos;
      summary.proventos12mTotal += a.totalProventos12m;
    });

    return { list, summary, usdRate: currentUsdRate, profitMap };
  }, [
    investmentTransactions,
    categories,
    subCategories,
    assetPrices,
    cdiHistory,
    portfolioCategoryFilters,
    portfolioSubCategoryFilters,
    portfolioSearchTerm,
  ]);

  const overviewData = useMemo(() => {
    let filteredTxs = [...investmentTransactions];

    if (globalCategoryFilters.length > 0) {
      filteredTxs = filteredTxs.filter(
        (t) => globalCategoryFilters.includes(t.categoryId),
      );
    }
    if (globalSubCategoryFilters.length > 0) {
      filteredTxs = filteredTxs.filter(
        (t) => globalSubCategoryFilters.includes(t.subCategoryId || ""),
      );
    }

    if (overviewSearchTerm) {
      const term = overviewSearchTerm.trim().toUpperCase();
      filteredTxs = filteredTxs.filter((t) =>
        t.investmentDetails?.ticker?.toUpperCase().includes(term),
      );
    }

    if (filteredTxs.length === 0)
      return { chartData: [], tableData: [], report: null };

    const getStrategy = (ticker: string, catId?: string, subCatId?: string) => {
      const cat =
        categories.find((c) => c.id === catId)?.name.toLowerCase() || "";
      const sub =
        subCategories.find((s) => s.id === subCatId)?.name.toLowerCase() || "";
      const name = (cat + " " + sub).toLowerCase();

      if (
        name.includes("liquidez") ||
        name.includes("caixa") ||
        name.includes("reserva")
      )
        return "Liquidez";
      if (name.includes("tesouro") || name.includes("público"))
        return "Título Público";
      if (
        name.includes("pós") ||
        name.includes("cdi") ||
        name.includes("selic")
      )
        return "Pós-fixado";
      if (name.includes("pré")) return "Prefixado";
      if (
        name.includes("cripto") ||
        name.includes("crypto") ||
        name.includes("bitcoin")
      )
        return "Cripto";
      if (
        name.includes("fii") ||
        name.includes("imobiliário") ||
        name.includes("listado")
      )
        return "Fundos Listados";
      if (
        name.includes("eua") ||
        name.includes("global") ||
        name.includes("internacional") ||
        name.includes("us")
      )
        return "Global";
      if (
        name.includes("ação") ||
        name.includes("ações") ||
        name.includes("variável") ||
        name.includes("etf")
      )
        return "Renda Variável";

      return "Outros";
    };

    const getLiquidityTerm = (strategy: string) => {
      if (strategy === "Liquidez") return "0 a 1 dia";
      if (
        ["Renda Variável", "Fundos Listados", "Global", "Cripto"].includes(
          strategy,
        )
      )
        return "2 a 5 dias";
      if (["Pós-fixado", "Prefixado", "Título Público"].includes(strategy))
        return "Mais de 180 dias";
      return "16 a 30 dias";
    };

    const firstDate = new Date(filteredTxs[0].date);
    const lastDate = new Date();
    const months: string[] = [];
    let cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (cursor <= lastDate) {
      const mKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      months.push(mKey);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Pre-calculate split/merge/bonus multipliers
    const assetMultipliers: Record<string, Record<string, number>> = {};
    const splitEvents = filteredTxs.filter((t) =>
      ["SPLIT", "MERGE", "BONUS"].includes(t.investmentDetails?.event || ""),
    );
    const uniqueTickers = Array.from(
      new Set(
        filteredTxs.map((t) => t.investmentDetails?.ticker).filter(Boolean),
      ),
    ) as string[];

    uniqueTickers.forEach((ticker) => {
      assetMultipliers[ticker] = {};

      // Pre-calculate quantity before each transaction for this ticker
      const tickerTxs = filteredTxs.filter(
        (t) => t.investmentDetails?.ticker === ticker,
      );
      const qtyBeforeTx: Record<string, number> = {};
      let runningQty = 0;

      tickerTxs.forEach((t) => {
        const det = t.investmentDetails!;
        qtyBeforeTx[t.id] = runningQty;

        if (det.event === "BUY") runningQty += det.quantity;
        else if (det.event === "BONUS") runningQty += det.quantity;
        else if (det.event === "SELL") runningQty -= det.quantity;
        else if (det.event === "SPLIT") {
          const factor =
            det.quantity > 50 && runningQty > 0
              ? (runningQty + det.quantity) / runningQty
              : det.quantity;
          runningQty *= factor;
        } else if (det.event === "MERGE") runningQty /= det.quantity;
        else if (det.event === "TICKER_UPDATE" && det.newTicker) runningQty = 0;
      });

      const tickerEvents = splitEvents.filter(
        (t) => t.investmentDetails?.ticker === ticker,
      );

      months.forEach((monthKey) => {
        // Future events are those that occur in a month STRICTLY AFTER the current monthKey.
        // This correctly avoids timezone offset issues that happen when comparing local month boundaries against ISO UTC transaction dates.
        const futureEvents = tickerEvents.filter((e) => {
          const eventMonthKey = e.date.substring(0, 7);
          return eventMonthKey > monthKey;
        });

        let multiplier = 1;
        futureEvents.forEach((e) => {
          const det = e.investmentDetails!;
          if (det.event === "SPLIT") {
            const qtyBefore = qtyBeforeTx[e.id];
            const factor =
              det.quantity > 50 && qtyBefore > 0
                ? (qtyBefore + det.quantity) / qtyBefore
                : det.quantity || 1;
            multiplier *= factor;
          } else if (det.event === "MERGE") {
            multiplier /= det.quantity || 1;
          } else if (det.event === "BONUS") {
            if (typeof det.bonusRatio === "number" && !isNaN(det.bonusRatio)) {
              multiplier *= 1 + det.bonusRatio / 100;
            } else {
              const qtyBefore = qtyBeforeTx[e.id];
              if (qtyBefore > 0) {
                multiplier *= (qtyBefore + det.quantity) / qtyBefore;
              }
            }
          }
        });
        assetMultipliers[ticker][monthKey] = multiplier;
      });
    });

    let cumulativeInvested = 0;
    let cumulativeRealized = 0;
    let cumulativeDividends = 0;
    let cumulativeBonusCost = 0;

    const runningAssets: Record<
      string,
      {
        qty: number;
        cost: number;
        yieldRate?: string;
        currency?: string;
        firstDate?: Date;
        categoryId?: string;
        subCategoryId?: string;
      }
    > = {};
    const assetValuesPrevMonth: Record<string, number> = {};
    let chartData: any[] = [];
    let tableData: any[] = [];

    let previousMarketValue = 0;
    let cdiIndex = 100;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const cumulativeCashFlows: { date: Date; amount: number }[] = [];

    months.forEach((monthKey, monthIdx) => {
      const [y, m] = monthKey.split("-").map(Number);
      const monthEnd = new Date(y, m, 0);
      const monthTxs = filteredTxs.filter((t) => t.date.startsWith(monthKey));

      monthTxs.forEach((t) => {
        const event = t.investmentDetails?.event;
        if (!event) return;
        const tDate = new Date(t.date);
        if (
          [
            "DIVIDEND",
            "JCP",
            "RENDIMENTO",
            "REEMBOLSO",
            "AMORTIZACAO",
            "SELL",
          ].includes(event)
        ) {
          cumulativeCashFlows.push({ date: tDate, amount: t.amount });
        } else if (event === "BUY") {
          cumulativeCashFlows.push({ date: tDate, amount: -t.amount });
        }
      });

      let monthNetFlow = 0;
      let monthWeightedFlow = 0;
      let monthPurchases = 0;
      let monthSales = 0;
      let monthRealized = 0;
      let monthDividends = 0;

      const assetPurchases: Record<string, number> = {};
      const assetWeightedFlow: Record<string, number> = {};
      const assetPurchasesQty: Record<string, number> = {};
      const assetDividends: Record<string, number> = {};
      const assetSales: Record<string, number> = {};
      const assetSalesQty: Record<string, number> = {};

      const assetQtyAtStart: Record<string, number> = {};
      const assetRealized: Record<string, number> = {};
      Object.entries(runningAssets).forEach(([ticker, asset]) => {
        assetQtyAtStart[ticker] = asset.qty;
        assetRealized[ticker] = 0;
      });

      monthTxs.forEach((t) => {
        const det = t.investmentDetails!;
        const amount = t.amount;
        const ticker = det.ticker;
        if (!runningAssets[ticker]) {
          const catName =
            categories.find((c) => c.id === t.categoryId)?.name.toLowerCase() ||
            "";
          const subCatName =
            subCategories
              .find((s) => s.id === t.subCategoryId)
              ?.name.toLowerCase() || "";
          const isFixed =
            catName.includes("renda fixa") ||
            subCatName.includes("renda fixa") ||
            catName.includes("tesouro") ||
            subCatName.includes("tesouro") ||
            catName.includes("poupança") ||
            subCatName.includes("poupança") ||
            ticker.toUpperCase().includes("CDB") ||
            ticker.toUpperCase().includes("LCI") ||
            ticker.toUpperCase().includes("LCA") ||
            ticker.toUpperCase().includes("CRI") ||
            ticker.toUpperCase().includes("CRA") ||
            ticker.toUpperCase().includes("DEBENTURE");

          let yRate = det.yieldRate;
          if (
            !yRate &&
            isFixed &&
            !ticker.toUpperCase().includes("TESOURO") &&
            !ticker.toUpperCase().startsWith("TD:")
          ) {
            yRate =
              ticker.toUpperCase().includes("POUPA") ||
              catName.includes("poupança")
                ? "70% CDI"
                : "100% CDI";
          }

          runningAssets[ticker] = {
            qty: 0,
            cost: 0,
            yieldRate: yRate,
            currency: det.currency,
            firstDate: new Date(t.date),
            categoryId: t.categoryId,
            subCategoryId: t.subCategoryId,
          };
          assetRealized[ticker] = 0;
        }
        const asset = runningAssets[ticker];

        const txDate = new Date(t.date);
        const day = txDate.getDate();
        const daysInMonth = monthEnd.getDate();
        // Weight based on days remaining in month (Modified Dietz)
        const weight = (daysInMonth - day + 1) / daysInMonth;

        if (det.event === "BUY") {
          asset.qty += det.quantity;
          asset.cost += amount;
          cumulativeInvested += amount;

          monthNetFlow += amount;
          monthPurchases += amount;
          monthWeightedFlow += amount * weight;
          assetPurchases[ticker] = (assetPurchases[ticker] || 0) + amount;
          assetWeightedFlow[ticker] =
            (assetWeightedFlow[ticker] || 0) + amount * weight;

          assetPurchasesQty[ticker] =
            (assetPurchasesQty[ticker] || 0) + det.quantity;
          if (det.currency) asset.currency = det.currency;
        } else if (det.event === "BONUS") {
          const addedQty = det.quantity;
          const costIncrease = addedQty * (det.price || 0);
          asset.qty += addedQty;
          asset.cost += costIncrease;
          cumulativeInvested += costIncrease;

          if (det.currency) asset.currency = det.currency;

          cumulativeBonusCost += costIncrease;
        } else if (det.event === "SELL") {
          const avgPrice = asset.qty > 0 ? asset.cost / asset.qty : 0;
          const costSold = avgPrice * det.quantity;
          const profit = amount - costSold;
          monthRealized += profit;
          cumulativeRealized += profit;
          assetRealized[ticker] = (assetRealized[ticker] || 0) + profit;
          asset.qty -= det.quantity;
          asset.cost -= costSold;
          cumulativeInvested -= costSold;
          monthNetFlow -= amount;
          monthSales += amount;
          monthWeightedFlow -= amount * weight;
          assetWeightedFlow[ticker] =
            (assetWeightedFlow[ticker] || 0) - amount * weight;
          assetSales[ticker] = (assetSales[ticker] || 0) + amount;
          assetSalesQty[ticker] = (assetSalesQty[ticker] || 0) + det.quantity;
          if (asset.qty < 0.000001) {
            asset.qty = 0;
            asset.cost = 0;
          }
        } else if (det.event === "AMORTIZACAO") {
          const avgPrice = asset.qty > 0 ? asset.cost / asset.qty : 0;
          const costReduction = Math.min(asset.cost, amount);
          const profit = amount - costReduction;

          asset.cost -= costReduction;
          cumulativeInvested -= costReduction;
          monthNetFlow -= amount;
          monthSales += amount;
          monthWeightedFlow -= amount * weight;
          assetWeightedFlow[ticker] =
            (assetWeightedFlow[ticker] || 0) - amount * weight;
          monthRealized += profit;
          cumulativeRealized += profit;
          assetRealized[ticker] = (assetRealized[ticker] || 0) + profit;
          assetSales[ticker] = (assetSales[ticker] || 0) + amount;
        } else if (
          ["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(det.event)
        ) {
          monthDividends += amount;
          cumulativeDividends += amount;
          assetDividends[ticker] = (assetDividends[ticker] || 0) + amount;
          // Cash dividends are usually external flows if they leave the portfolio,
          // but here we assume they stay in the "cash" part of the portfolio gain.
          // If we want to be strictly TWR for the ASSET, dividends are external flows out.
          // However, for the PORTFOLIO, they are internal.
          // Let's keep them as internal for now (don't add to monthNetFlow).
        } else if (det.event === "SPLIT") {
          const factor =
            det.quantity > 50 && asset.qty > 0
              ? (asset.qty + det.quantity) / asset.qty
              : det.quantity;
          asset.qty *= factor;
        } else if (det.event === "MERGE") asset.qty /= det.quantity;
        else if (det.event === "TICKER_UPDATE" && det.newTicker) {
          const newT = det.newTicker.toUpperCase();
          if (!runningAssets[newT])
            runningAssets[newT] = {
              qty: 0,
              cost: 0,
              yieldRate: asset.yieldRate,
              currency: asset.currency,
              firstDate: asset.firstDate,
              categoryId: asset.categoryId,
              subCategoryId: asset.subCategoryId,
            };
          const multiplier =
            det.quantity && det.quantity > 0 ? det.quantity : 1;
          runningAssets[newT].qty += asset.qty * multiplier;
          runningAssets[newT].cost += asset.cost;
          asset.qty = 0;
          asset.cost = 0;
        }
      });

      let monthMarketValue = 0;
      let monthTotalInvested = 0;
      const isCurrentMonth = monthKey === currentMonthKey;
      const monthAssetDetails: any[] = [];
      const strategyAllocation: Record<string, number> = {};

      Object.entries(runningAssets).forEach(([ticker, asset]) => {
        const qtyStart = assetQtyAtStart[ticker] || 0;
        const purchasesQty = assetPurchasesQty[ticker] || 0;
        const salesQty = assetSalesQty[ticker] || 0;

        const multiplier = assetMultipliers[ticker]?.[monthKey] || 1;

        if (
          asset.qty <= 0.000001 &&
          !asset.yieldRate &&
          qtyStart === 0 &&
          purchasesQty === 0 &&
          salesQty === 0
        ) {
          assetValuesPrevMonth[ticker] = 0;
          return;
        }

        let assetEndValue = 0;

        // PRE-CHECK: Manual History Override (for both Fixed and Variable income)
        const manualPriceObj = assetPrices.find((ap) => ap.ticker === ticker);
        let manualPriceFound = 0;
        if (
          manualPriceObj &&
          manualPriceObj.manualHistory &&
          manualPriceObj.manualHistory.length > 0
        ) {
          const manualExact = manualPriceObj.manualHistory.find(
            (h) => h.date.substring(0, 7) === monthKey,
          );
          if (manualExact) {
            manualPriceFound = manualExact.price;
          } else {
            const manualSorted = [...manualPriceObj.manualHistory].sort(
              (a, b) => b.date.localeCompare(a.date),
            );
            const olderManual = manualSorted.find(
              (h) => h.date.substring(0, 7) < monthKey,
            );
            if (olderManual) manualPriceFound = olderManual.price;
          }
        }

        const pData = portfolioData.list.find((p) => p.ticker === ticker);
        
        if (isCurrentMonth) {
          assetEndValue = pData ? pData.currentTotal : 0;
        } else if (asset.yieldRate && manualPriceFound <= 0) {
          let val = 0;
          const monthEndUtc = new Date(
            Date.UTC(y, m, 0, 23, 59, 59, 999),
          ).toISOString();
          investmentTransactions
            .filter(
              (t) =>
                t.investmentDetails?.ticker === ticker &&
                t.date.substring(0, 7) <= monthKey,
            )
            .forEach((t) => {
              const ev = t.investmentDetails?.event;
              if (ev === "BUY" || ev === "BONUS")
                val += calculateRealFixedIncome(
                  t.amount,
                  t.date,
                  asset.yieldRate!,
                  cdiHistory,
                  monthEndUtc,
                );
              else if (ev === "SELL" || ev === "AMORTIZACAO")
                val -= calculateRealFixedIncome(
                  t.amount,
                  t.date,
                  asset.yieldRate!,
                  cdiHistory,
                  monthEndUtc,
                );
            });
          if (val < 0) val = 0;
          assetEndValue = val;
        } else {
          let interpolatedTotal = asset.cost;
          const histData = assetHistory[ticker];

          let priceToUse = manualPriceFound;

          // PRIORIDADE 2: Histórico Automático (se não encontrou manual ou manual é 0)
          if (priceToUse <= 0 && histData && histData.history) {
            const exactMatch = histData.history.find(
              (h) => h.date === monthKey,
            );
            if (exactMatch && exactMatch.closingPrice > 0) {
              priceToUse = exactMatch.closingPrice;
            } else {
              for (const h of histData.history) {
                if (h.date < monthKey && h.closingPrice > 0) {
                  priceToUse = h.closingPrice;
                }
              }
            }
          }

          if (isCurrentMonth) {
            assetEndValue = 0; // Already handled above
          } else {
            if (manualPriceFound > 0) {
              interpolatedTotal = manualPriceFound * asset.qty;
            } else if (priceToUse > 0) {
              const _mult = (histData?.adjustForSplits === false) ? 1 : (multiplier || 1);
              interpolatedTotal = priceToUse * (asset.qty * _mult);
            }
            assetEndValue = interpolatedTotal;
          }
        }

        monthMarketValue += assetEndValue;
        monthTotalInvested += asset.cost;

        const strategy = getStrategy(
          ticker,
          asset.categoryId,
          asset.subCategoryId,
        );
        strategyAllocation[strategy] =
          (strategyAllocation[strategy] || 0) + assetEndValue;

        const prevValue = assetValuesPrevMonth[ticker] || 0;
        const purchases = assetPurchases[ticker] || 0;
        const dividends = assetDividends[ticker] || 0;
        const sales = assetSales[ticker] || 0;
        const netFlow = purchases - sales;
        const weightedFlow = assetWeightedFlow[ticker] || 0;

        let assetTwr = 0;
        const assetGain = assetEndValue - prevValue - netFlow + dividends;

        // True TWR Calculation for Individual Asset (using exact transaction prices)
        const txsInMonth = monthTxs.filter(
          (t) => t.investmentDetails?.ticker === ticker,
        );

        if (txsInMonth.length > 0 && !asset.yieldRate) {
          let currentVal = prevValue;
          let currentQty = qtyStart;
          let twrFactor = 1;

          txsInMonth.forEach((t) => {
            const det = t.investmentDetails!;
            const amount = t.amount;

            if (det.event === "BUY" || det.event === "SELL") {
              const txPrice = det.quantity > 0 ? amount / det.quantity : 0;
              if (txPrice > 0 && currentQty > 0) {
                const valueBeforeTx = currentQty * txPrice;
                const subPeriodReturn =
                  (valueBeforeTx - currentVal) / currentVal;
                twrFactor *= 1 + subPeriodReturn;

                if (det.event === "BUY") {
                  currentVal = valueBeforeTx + amount;
                  currentQty += det.quantity;
                } else {
                  currentVal = valueBeforeTx - amount;
                  currentQty -= det.quantity;
                }
              } else if (currentQty <= 0 && det.event === "BUY") {
                currentVal = amount;
                currentQty = det.quantity;
              }
            } else if (det.event === "SPLIT") {
              const factor =
                det.quantity > 50 && currentQty > 0
                  ? (currentQty + det.quantity) / currentQty
                  : det.quantity || 1;
              currentQty *= factor;
            } else if (det.event === "MERGE") {
              currentQty /= det.quantity;
            } else if (det.event === "BONUS") {
              currentQty += det.quantity;
            } else if (det.event === "AMORTIZACAO") {
              const avgPrice = currentQty > 0 ? currentVal / currentQty : 0;
              const costReduction = Math.min(currentVal, amount);
              currentVal -= costReduction;
            }
          });

          // Final sub-period to end of month
          if (currentVal > 0) {
            const finalSubPeriodReturn =
              (assetEndValue + dividends - currentVal) / currentVal;
            twrFactor *= 1 + finalSubPeriodReturn;
          } else if (dividends > 0 && prevValue > 0) {
            twrFactor *= 1 + (dividends / prevValue);
          }

          assetTwr = (twrFactor - 1) * 100;
        } else {
          // Fallback to Modified Dietz
          if (prevValue > 0) {
            let denominator = prevValue + weightedFlow;
            // Modified Dietz anomaly protection for large outflows:
            if (denominator < prevValue * 0.5 && netFlow < 0) {
              denominator = prevValue;
            }
            if (denominator > 0) assetTwr = (assetGain / denominator) * 100;
            else assetTwr = (assetGain / (prevValue + purchases)) * 100;
          } else if (purchases > 0) {
            // For new positions, use total purchases as denominator to avoid timing-based amplification
            assetTwr = (assetGain / purchases) * 100;
          } else if (netFlow > 0) assetTwr = (assetGain / netFlow) * 100;
        }

        let priceStart = 0;
        if (qtyStart > 0 && prevValue > 0) priceStart = prevValue / qtyStart;
        else if (purchasesQty > 0 && purchases > 0)
          priceStart = purchases / purchasesQty;

        let priceEnd = 0;
        if (asset.qty > 0 && assetEndValue > 0)
          priceEnd = assetEndValue / asset.qty;
        else if (salesQty > 0 && sales > 0) priceEnd = sales / salesQty;

        const _mult = multiplier || 1;
        const prevMonthKey = monthIdx > 0 ? months[monthIdx - 1] : null;
        const _startMult = prevMonthKey
          ? assetMultipliers[ticker]?.[prevMonthKey] || 1
          : _mult;

        const adjQtyStart = qtyStart * _startMult;
        const adjPurchasesQty = purchasesQty * _mult;
        const adjSalesQty = salesQty * _mult;
        const adjQuantity = asset.qty * _mult;
        const eventsQty =
          adjQuantity - adjQtyStart - adjPurchasesQty + adjSalesQty;

        monthAssetDetails.push({
          ticker,
          strategy,
          quantity: adjQuantity,
          qtyStart: adjQtyStart,
          eventsQty,
          purchasesQty: adjPurchasesQty,
          purchasesValue: purchases,
          salesQty: adjSalesQty,
          salesValue: sales,
          avgPrice: (asset.qty > 0 ? asset.cost / asset.qty : 0) / _mult,
          invested: asset.cost,
          startValue: prevValue,
          endValue: assetEndValue,
          priceStart: priceStart / _mult,
          priceEnd: priceEnd / _mult,
          netFlow,
          dividends,
          realized: assetRealized[ticker] || 0,
          twr: assetTwr,
          gain: assetGain,
        });

        assetValuesPrevMonth[ticker] = assetEndValue;
      });

      let monthlyReturnPct = 0;
      const gain =
        monthMarketValue - previousMarketValue - monthNetFlow + monthDividends;

      if (previousMarketValue > 0) {
        let denominator = previousMarketValue + monthWeightedFlow;
        // Modified Dietz anomaly protection for large outflows:
        if (denominator < previousMarketValue * 0.5 && monthNetFlow < 0) {
          denominator = previousMarketValue;
        }
        if (denominator > 0) monthlyReturnPct = gain / denominator;
        else monthlyReturnPct = gain / (previousMarketValue + monthPurchases);
      } else if (monthPurchases > 0) {
        // For new portfolios, use total purchases as denominator to avoid timing-based amplification
        monthlyReturnPct = gain / monthPurchases;
      } else if (monthNetFlow > 0) monthlyReturnPct = gain / monthNetFlow;

      const monthRates = cdiHistory.filter((d) => d.date.startsWith(monthKey));
      let cdiMonthFactor = 1;
      monthRates.forEach((d) => {
        cdiMonthFactor *= 1 + d.value / 100;
      });
      const cdiMonthPct = cdiMonthFactor - 1;
      const ipcaMonthObj = ipcaHistory.find(d => d.date.startsWith(monthKey));
      const ipcaMonthPct = ipcaMonthObj ? ipcaMonthObj.value / 100 : 0;
      
      const ibovMonthRates = ibovHistory.filter(d => d.date.startsWith(monthKey)).sort((a,b) => a.date.localeCompare(b.date));
      let ibovMonthPct = 0;
      if (ibovMonthRates.length > 0) {
        const first = ibovMonthRates[0];
        const last = ibovMonthRates[ibovMonthRates.length - 1];
        ibovMonthPct = (last.value / first.value) - 1;
      }
      const prevTwrAccum =
        chartData.length > 0
          ? chartData[chartData.length - 1].twrAccum / 100
          : 0;
      const currentTwrAccum = (1 + prevTwrAccum) * (1 + monthlyReturnPct) - 1;
      cdiIndex = cdiIndex * (1 + cdiMonthPct);
      
      const prevChartPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
      let ibovIndex = prevChartPoint ? (prevChartPoint.ibovAccum + 100) : 100;
      ibovIndex = ibovIndex * (1 + ibovMonthPct);
      let ipcaIndex = prevChartPoint ? (prevChartPoint.ipcaAccum + 100) : 100;
      ipcaIndex = ipcaIndex * (1 + ipcaMonthPct);

      const displayDate = new Date(y, m - 1, 2).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      const totalProfitAccumulated =
        monthMarketValue +
        cumulativeDividends +
        cumulativeRealized +
        cumulativeBonusCost -
        monthTotalInvested;

      let monthXtirAnnual = 0;
      let monthXtirMonthly = 0;
      if (cumulativeCashFlows.length > 0) {
        // Tenta encontrar a data manual mais recente deste mês para maior precisão no XTIR
        let bestEndDate = isCurrentMonth ? now : monthEnd;
        let latestManualDateMatch: string | null = null;

        assetPrices.forEach((ap) => {
          if (ap.manualHistory) {
            const manualInMonth = ap.manualHistory.find(
              (h) => h.date.substring(0, 7) === monthKey,
            );
            if (
              manualInMonth &&
              (!latestManualDateMatch ||
                manualInMonth.date > latestManualDateMatch)
            ) {
              latestManualDateMatch = manualInMonth.date;
            }
          }
        });

        if (latestManualDateMatch) {
          bestEndDate = new Date(latestManualDateMatch);
          // Ajusta para o final do dia para bater com o fechamento
          bestEndDate.setHours(23, 59, 59, 999);
        }

        const flows = [
          ...cumulativeCashFlows,
          { date: bestEndDate, amount: monthMarketValue },
        ];
        monthXtirAnnual = calculateXIRR(
          flows.map((f) => f.amount),
          flows.map((f) => f.date),
        );
        monthXtirMonthly =
          (Math.pow(1 + monthXtirAnnual / 100, 1 / 12) - 1) * 100;
      }

      const dataPoint = {
        date: displayDate,
        fullDate: monthKey,
        invested: monthTotalInvested,
        totalInvested: monthTotalInvested,
        market: monthMarketValue,
        flow: monthNetFlow,
        purchases: monthPurchases,
        sales: monthSales,
        dividends: monthDividends,
        cumulativeDividends,
        realized: monthRealized,
        totalProfit: totalProfitAccumulated,
        totalProfitAccumulated,
        gain: gain,
        twrMonthly: monthlyReturnPct * 100,
        twrAccum: currentTwrAccum * 100,
        xtirAnnual: monthXtirAnnual,
        xtirMonthly: monthXtirMonthly,
        cdiAccum: cdiIndex - 100,
        cdiMonthly: cdiMonthPct * 100,
        ibovAccum: ibovIndex - 100,
        ibovMonthly: ibovMonthPct * 100,
        ipcaAccum: ipcaIndex - 100,
        ipcaMonthly: ipcaMonthPct * 100,
        assetDetails: monthAssetDetails.sort((a, b) => b.endValue - a.endValue),
        strategyAllocation,
      };

      console.log("dataPoint", {date: dataPoint.date, ibovAccum: dataPoint.ibovAccum, ipcaAccum: dataPoint.ipcaAccum, ibovMonthly: dataPoint.ibovMonthly}); chartData.push(dataPoint);
      tableData.unshift(dataPoint);
      previousMarketValue = monthMarketValue;
    });

    const effectiveStartDateRaw =
      overviewFilterDate !== null
        ? overviewFilterDate
        : settings.historyStartDate;
    const effectiveStartDate = effectiveStartDateRaw
      ? effectiveStartDateRaw.slice(0, 7)
      : undefined;
    if (effectiveStartDate && chartData.length > 0) {
      const startIndex = chartData.findIndex(
        (d) => d.fullDate >= effectiveStartDate,
      );
      if (startIndex > 0) {
        const startPoint = chartData[startIndex - 1];
        const baseTwr = startPoint.twrAccum;
        const baseCdi = startPoint.cdiAccum;

        chartData = chartData.slice(startIndex).map((d) => {
          const baseTwrFactor = 1 + baseTwr / 100;
          const baseCdiFactor = 1 + baseCdi / 100;
          return {
            ...d,
            twrAccum:
              baseTwrFactor !== 0
                ? ((1 + d.twrAccum / 100) / baseTwrFactor - 1) * 100
                : d.twrAccum,
            cdiAccum:
              baseCdiFactor !== 0
                ? ((1 + d.cdiAccum / 100) / baseCdiFactor - 1) * 100
                : d.cdiAccum,
          };
        });

        tableData = tableData
          .filter((d) => d.fullDate >= effectiveStartDate)
          .map((d) => {
            const originalD = chartData.find((c) => c.fullDate === d.fullDate);
            if (!originalD) return d;
            return {
              ...d,
              twrAccum: originalD.twrAccum,
              cdiAccum: originalD.cdiAccum,
            };
          });
      } else if (startIndex === -1) {
        chartData = [];
        tableData = [];
      }
    }

    if (chartData.length === 0)
      return { chartData: [], tableData: [], report: null };

    // REPORT CALCULATIONS
    const lastMonth = chartData[chartData.length - 1];
    const prevMonth =
      chartData.length > 1 ? chartData[chartData.length - 2] : null;

    const returnsMonth = lastMonth.twrMonthly;
    const currentYear = new Date().getFullYear();
    const yearPoints = chartData.filter((d) =>
      d.fullDate.startsWith(currentYear.toString()),
    );
    let yearReturn = 0;
    if (yearPoints.length > 0) {
      const startYearTwr =
        chartData.find((d) =>
          d.fullDate.startsWith((currentYear - 1).toString() + "-12"),
        )?.twrAccum || 0;
      yearReturn =
        ((1 + lastMonth.twrAccum / 100) / (1 + startYearTwr / 100) - 1) * 100;
    }
    const inceptionReturn = lastMonth.twrAccum;

    const monthlyReturns = chartData.map((d) => d.twrMonthly);
    const avgReturn =
      monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
    const variance =
      monthlyReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) /
      monthlyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(12);

    const maxReturn = Math.max(...monthlyReturns);
    const minReturn = Math.min(...monthlyReturns);
    const monthsAboveCDI = chartData.filter(
      (d) => d.twrMonthly > d.cdiMonthly,
    ).length;
    const monthsBelowCDI = chartData.length - monthsAboveCDI;

    const calculateHorizonPerformance = (monthsCount: number) => {
      const points = chartData.slice(-monthsCount);
      if (points.length === 0) return null;

      const startPoint =
        chartData.length > monthsCount
          ? chartData[chartData.length - monthsCount - 1]
          : null;
      const startTwr = startPoint ? startPoint.twrAccum : 0;
      const startCdi = startPoint ? startPoint.cdiAccum : 0;

      const portfolioReturn =
        ((1 + lastMonth.twrAccum / 100) / (1 + startTwr / 100) - 1) * 100;
      const cdiReturn =
        ((1 + lastMonth.cdiAccum / 100) / (1 + startCdi / 100) - 1) * 100;
      const index = cdiReturn !== 0 ? (portfolioReturn / cdiReturn) * 100 : 0;

      const horizonMonthlyReturns = points.map((d) => d.twrMonthly);
      const hAvg =
        horizonMonthlyReturns.reduce((a, b) => a + b, 0) /
        horizonMonthlyReturns.length;
      const hVar =
        horizonMonthlyReturns.reduce((a, b) => a + Math.pow(b - hAvg, 2), 0) /
        horizonMonthlyReturns.length;
      const hVol = Math.sqrt(hVar) * Math.sqrt(12);

      let hXtirAnnual = 0;
      let hXtirMonthly = 0;

      const horizonFlows: { date: Date; amount: number }[] = [];
      const startDate = startPoint
        ? new Date(
            Number(startPoint.fullDate.split("-")[0]),
            Number(startPoint.fullDate.split("-")[1]),
            0,
          )
        : null;
      const endDate =
        lastMonth.fullDate === currentMonthKey
          ? now
          : new Date(
              Number(lastMonth.fullDate.split("-")[0]),
              Number(lastMonth.fullDate.split("-")[1]),
              0,
            );

      if (startPoint && startPoint.market) {
        horizonFlows.push({ date: startDate!, amount: -startPoint.market });
      }

      filteredTxs.forEach((t) => {
        const event = t.investmentDetails?.event;
        if (!event) return;
        const tDate = new Date(t.date);
        if ((!startDate || tDate > startDate) && tDate <= endDate) {
          if (
            [
              "DIVIDEND",
              "JCP",
              "RENDIMENTO",
              "REEMBOLSO",
              "AMORTIZACAO",
              "SELL",
            ].includes(event)
          ) {
            horizonFlows.push({ date: tDate, amount: t.amount });
          } else if (event === "BUY") {
            horizonFlows.push({ date: tDate, amount: -t.amount });
          }
        }
      });

      if (horizonFlows.length > 0 && lastMonth.market > 0) {
        horizonFlows.push({ date: endDate, amount: lastMonth.market });
        hXtirAnnual = calculateXIRR(
          horizonFlows.map((f) => f.amount),
          horizonFlows.map((f) => f.date),
        );
        hXtirMonthly = (Math.pow(1 + hXtirAnnual / 100, 1 / 12) - 1) * 100;
      }

      return {
        portfolio: portfolioReturn,
        cdi: cdiReturn,
        index: index,
        volatility: hVol,
        xtirAnnual: hXtirAnnual,
        xtirMonthly: hXtirMonthly,
      };
    };

    const horizons = [
      { label: "03 meses", months: 3 },
      { label: "06 meses", months: 6 },
      { label: "12 meses", months: 12 },
      { label: "24 meses", months: 24 },
      { label: "36 meses", months: 36 },
      { label: "Desde o início", months: chartData.length },
    ];

    const performanceHorizons = horizons.map((h) => ({
      period: h.label,
      ...(calculateHorizonPerformance(h.months) || {
        portfolio: 0,
        cdi: 0,
        index: 0,
        volatility: 0,
      }),
    }));

    const riskReturnSummary = {
      above: {
        qty: monthsAboveCDI,
        percent: (monthsAboveCDI / chartData.length) * 100,
      },
      below: {
        qty: monthsBelowCDI,
        percent: (monthsBelowCDI / chartData.length) * 100,
      },
    };

    const strategyTypes = [
      {
        name: "Renda Fixa",
        strategies: ["Liquidez", "Título Público", "Pós-fixado", "Prefixado"],
      },
      {
        name: "Renda Variável",
        strategies: ["Renda Variável", "Fundos Listados"],
      },
      { name: "Exterior", strategies: ["Global"] },
      { name: "Cripto", strategies: ["Cripto"] },
      { name: "Outros", strategies: ["Outros"] },
    ];

    const strategyGains: any[] = [];
    strategyTypes.forEach((type) => {
      let typeMonth = 0;
      let typeYear = 0;
      let typeInception = 0;
      let typeAllocation = 0;
      let typeMarket = 0;
      const subGains: any[] = [];

      type.strategies.forEach((strat) => {
        const assets = lastMonth.assetDetails.filter(
          (d: any) => d.strategy === strat,
        );
        const monthGain = assets.reduce(
          (sum: number, a: any) => sum + a.gain,
          0,
        );
        const market = assets.reduce(
          (sum: number, a: any) => sum + (a.endValue || 0),
          0,
        );
        const yearGain = yearPoints.reduce((sum, p) => {
          const pAssets = p.assetDetails.filter(
            (d: any) => d.strategy === strat,
          );
          return sum + pAssets.reduce((s: number, a: any) => s + a.gain, 0);
        }, 0);
        const inceptionGain = chartData.reduce((sum, p) => {
          const pAssets = p.assetDetails.filter(
            (d: any) => d.strategy === strat,
          );
          return sum + pAssets.reduce((s: number, a: any) => s + a.gain, 0);
        }, 0);
        const allocation =
          ((lastMonth.strategyAllocation[strat] || 0) /
            (lastMonth.market || 1)) *
          100;

        let monthPct =
          market - monthGain !== 0
            ? (monthGain / Math.abs(market - monthGain)) * 100
            : 0;
        if (isNaN(monthPct) || !isFinite(monthPct)) monthPct = 0;

        let yearPct =
          market - yearGain !== 0
            ? (yearGain / Math.abs(market - yearGain)) * 100
            : 0;
        if (isNaN(yearPct) || !isFinite(yearPct)) yearPct = 0;

        let inceptionPct =
          market - inceptionGain !== 0
            ? (inceptionGain / Math.abs(market - inceptionGain)) * 100
            : 0;
        if (isNaN(inceptionPct) || !isFinite(inceptionPct)) inceptionPct = 0;

        typeMonth += monthGain;
        typeYear += yearGain;
        typeInception += inceptionGain;
        typeAllocation += allocation;
        typeMarket += market;

        subGains.push({
          strategy: strat,
          month: monthGain,
          year: yearGain,
          inception: inceptionGain,
          monthPct,
          yearPct,
          inceptionPct,
          allocation,
        });
      });

      let typeMonthPct =
        typeMarket - typeMonth !== 0
          ? (typeMonth / Math.abs(typeMarket - typeMonth)) * 100
          : 0;
      if (isNaN(typeMonthPct) || !isFinite(typeMonthPct)) typeMonthPct = 0;

      let typeYearPct =
        typeMarket - typeYear !== 0
          ? (typeYear / Math.abs(typeMarket - typeYear)) * 100
          : 0;
      if (isNaN(typeYearPct) || !isFinite(typeYearPct)) typeYearPct = 0;

      let typeInceptionPct =
        typeMarket - typeInception !== 0
          ? (typeInception / Math.abs(typeMarket - typeInception)) * 100
          : 0;
      if (isNaN(typeInceptionPct) || !isFinite(typeInceptionPct)) typeInceptionPct = 0;

      strategyGains.push({
        strategy: type.name,
        isHeader: true,
        month: typeMonth,
        year: typeYear,
        inception: typeInception,
        monthPct: typeMonthPct,
        yearPct: typeYearPct,
        inceptionPct: typeInceptionPct,
        allocation: typeAllocation,
      });

      subGains.forEach((sub) => {
        strategyGains.push({
          ...sub,
          isSub: true,
        });
      });
    });

    const liquidityTerms = [
      "0 a 1 dia",
      "2 a 5 dias",
      "16 a 30 dias",
      "Mais de 180 dias",
    ];
    const liquidityData = liquidityTerms.map((term) => {
      const value = lastMonth.assetDetails
        .filter((d: any) => getLiquidityTerm(d.strategy) === term)
        .reduce((sum: number, a: any) => sum + a.endValue, 0);
      return { term, value, percent: (value / (lastMonth.market || 1)) * 100 };
    });

    let xtirAnnual = 0;
    let xtirMonthly = 0;
    const portfolioCashFlows: { date: Date; amount: number }[] = [];
    filteredTxs.forEach((t) => {
      const event = t.investmentDetails?.event;
      if (!event) return;
      const tDate = new Date(t.date);
      if (
        [
          "DIVIDEND",
          "JCP",
          "RENDIMENTO",
          "REEMBOLSO",
          "AMORTIZACAO",
          "SELL",
        ].includes(event)
      ) {
        portfolioCashFlows.push({ date: tDate, amount: t.amount });
      } else if (event === "BUY") {
        portfolioCashFlows.push({ date: tDate, amount: -t.amount });
      }
    });
    if (portfolioCashFlows.length > 0 && lastMonth.market > 0) {
      const endDate =
        lastMonth.fullDate === currentMonthKey
          ? now
          : new Date(
              Number(lastMonth.fullDate.split("-")[0]),
              Number(lastMonth.fullDate.split("-")[1]),
              0,
            );
      portfolioCashFlows.push({ date: endDate, amount: lastMonth.market });
      xtirAnnual = calculateXIRR(
        portfolioCashFlows.map((f) => f.amount),
        portfolioCashFlows.map((f) => f.date),
      );
      xtirMonthly = (Math.pow(1 + xtirAnnual / 100, 1 / 12) - 1) * 100;
    }

    const report = {
      identification: {
        title: "Relatório de Performance Consolidado",
        reference: lastMonth.date,
        period: `${chartData[0].date} - ${lastMonth.date}`,
        purpose:
          "Análise gerencial de rentabilidade, alocação e riscos da carteira de investimentos.",
      },
      executiveSummary: {
        equityEnd: lastMonth.market,
        equityPrev: prevMonth?.market || 0,
        gainsMonth: lastMonth.gain,
        applications:
          lastMonth.purchases - lastMonth.sales - lastMonth.dividends,
        redemptions: lastMonth.sales,
        totalInvested: lastMonth.totalInvested,
        totalProfitAccumulated: lastMonth.totalProfitAccumulated,
        cumulativeDividends: lastMonth.cumulativeDividends,
        totalAlpha: lastMonth.twrAccum - lastMonth.cdiAccum,
        returns: {
          month: returnsMonth,
          year: yearReturn,
          inception: inceptionReturn,
          xtirAnnual,
          xtirMonthly,
        },
      },
      riskReturn: {
        volatility,
        maxReturn,
        minReturn,
        monthsAboveCDI,
        monthsBelowCDI,
        summary: riskReturnSummary,
        horizons: performanceHorizons,
      },
      strategyGains,
      liquidityData,
      lastMonthData: lastMonth,
    };

    return { chartData, tableData, report };
  }, [
    investmentTransactions,
    cdiHistory,
    assetPrices,
    portfolioData,
    assetHistory,
    globalCategoryFilters,
    globalSubCategoryFilters,
    overviewSearchTerm,
    categories,
    subCategories,
    settings.historyStartDate,
    overviewFilterDate,
  ]);

  const handleSyncHistory = async (syncType: "all" | "current_month" = "all") => {
    if (!overviewData || !overviewData.tableData) return;

    setIsSyncingHistory(true);
    setSyncHistoryStatus("Iniciando...");
    setShowSyncOptions(false);

    try {
      const tickers = new Map<string, boolean>();
      const cryptoMap = new Map<string, boolean>();
      const fixedIncomeMap = new Map<string, boolean>();
      
      const targetRow = syncType === "current_month" && overviewData.tableData.length > 0 
        ? [overviewData.tableData[0]] // first element because it's unshifted (latest month)
        : overviewData.tableData;

      targetRow.forEach((row: any) => {
        if (row.assetDetails) {
          row.assetDetails.forEach((d: any) => {
            const pData = portfolioData.list.find((p) => p.ticker === d.ticker);
            let isSyncableVariable = false;
            let isUS = false;
            let isCrypto = false;
            let isFixed = false;

            if (pData) {
              isUS = pData.currency === "USD";
              isFixed = !!pData.isFixedIncome;
              const isT =
                d.ticker.toUpperCase().startsWith("TD:") ||
                d.ticker.toUpperCase().startsWith("TESOURO");
              // Only sync variable income and tesouro direct
              isSyncableVariable = !isFixed || isT;
              const catName = pData.category?.toLowerCase() || "";
              const subName = pData.subCategory?.toLowerCase() || "";
              isCrypto =
                catName.includes("cripto") ||
                subName.includes("cripto") ||
                subName.includes("bitcoin") ||
                subName.includes("ether") ||
                BrapiService.isCrypto(d.ticker);
            } else {
              // For historical assets not in current portfolio, check transactions
              const firstTx = investmentTransactions.find(
                (t) => t.investmentDetails?.ticker === d.ticker,
              );
              if (firstTx && firstTx.investmentDetails) {
                const det = firstTx.investmentDetails;
                const cat = categories.find((c) => c.id === det.categoryId);
                const subCat = subCategories.find(
                  (s) => s.id === det.subCategoryId,
                );

                const catName = cat?.name.toLowerCase() || "";
                const subCatName = subCat?.name.toLowerCase() || "";

                isFixed =
                  catName.includes("renda fixa") ||
                  subCatName.includes("renda fixa") ||
                  catName.includes("tesouro") ||
                  subCatName.includes("tesouro") ||
                  catName.includes("poupança") ||
                  subCatName.includes("poupança");

                isUS = det.currency === "USD";
                const isT =
                  d.ticker.toUpperCase().startsWith("TD:") ||
                  d.ticker.toUpperCase().startsWith("TESOURO");
                // Only sync variable income and tesouro direct
                isSyncableVariable = !isFixed || isT;
                isCrypto =
                  catName.includes("cripto") ||
                  subCatName.includes("cripto") ||
                  subCatName.includes("bitcoin") ||
                  subCatName.includes("ether") ||
                  BrapiService.isCrypto(d.ticker);
              }
            }

            if (isSyncableVariable) {
              if (syncType === "current_month" && (!pData || pData.quantity <= 0)) {
                  // Skip it, user doesn't hold it anymore
              } else {
                  tickers.set(d.ticker, isUS);
                  cryptoMap.set(d.ticker, isCrypto);
                  fixedIncomeMap.set(d.ticker, isFixed);
              }
            }
          });
        }
      });

      const tickerList = Array.from(tickers.keys());
      const hasUSAssets = Array.from(tickers.values()).some((isUS) => isUS) || Array.from(cryptoMap.values()).some((isCrypto) => isCrypto);

      const parseBrNumber = (val: any): number => {
        if (typeof val === "number") return val;
        if (!val) return 0;
        const str = val.toString().trim();
        const cleanStr = str.replace(/[R$\s%]/g, "");
        if (cleanStr.includes(".") && cleanStr.includes(",")) {
          return parseFloat(cleanStr.replace(/\./g, "").replace(",", "."));
        }
        if (cleanStr.includes(",")) {
          return parseFloat(cleanStr.replace(",", "."));
        }
        return parseFloat(cleanStr);
      };

      const processSheetData = (resultados: any[]) => {
        const monthlyGroups = new Map<
          string,
          {
            firstDate: string;
            lastDate: string;
            opening: number;
            closing: number;
          }
        >();

        resultados.forEach((r) => {
          if (r.data && r.preco != null) {
            let dateStr = r.data.toString().trim();
            const brDateMatch = dateStr.match(
              /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
            );
            if (brDateMatch) {
              const day = brDateMatch[1].padStart(2, "0");
              const month = brDateMatch[2].padStart(2, "0");
              let year = brDateMatch[3];
              if (year.length === 2) {
                year = `20${year}`;
              }
              dateStr = `${year}-${month}-${day}`;
            } else if (dateStr.includes("T")) {
              dateStr = dateStr.split("T")[0];
            } else if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              try {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                  dateStr = d.toISOString().split("T")[0];
                } else {
                  return;
                }
              } catch {
                return;
              }
            }

            const monthKey = dateStr.substring(0, 7);
            const price = parseBrNumber(r.preco);

            if (isNaN(price) || price <= 0) return;

            const existing = monthlyGroups.get(monthKey);
            if (!existing) {
              monthlyGroups.set(monthKey, {
                firstDate: dateStr,
                lastDate: dateStr,
                opening: price,
                closing: price,
              });
            } else {
              if (dateStr < existing.firstDate) {
                existing.firstDate = dateStr;
                existing.opening = price;
              }
              if (dateStr >= existing.lastDate) {
                existing.lastDate = dateStr;
                existing.closing = price;
              }
            }
          } else if (
            r.mes &&
            r.mes !== "Date" &&
            r.mes.match(/^\d{4}-\d{2}$/)
          ) {
            const monthKey = r.mes;
            const closing = parseBrNumber(r.fim);
            const opening = parseBrNumber(r.inicio);

            if (!isNaN(closing) && closing > 0) {
              monthlyGroups.set(monthKey, {
                firstDate: monthKey + "-01",
                lastDate: monthKey + "-31",
                opening: opening || closing,
                closing,
              });
            }
          }
        });

        const priceMap = new Map<
          string,
          { opening: number; closing: number }
        >();
        const sortedMonths = Array.from(monthlyGroups.keys()).sort();
        let lastClosing = 0;

        sortedMonths.forEach((monthKey) => {
          const data = monthlyGroups.get(monthKey)!;
          let opening = data.opening;
          let closing = data.closing;
          if (lastClosing > 0) {
            opening = lastClosing;
          } else if (opening === 0) {
            opening = closing;
          }
          priceMap.set(monthKey, { opening, closing });
          lastClosing = closing;
        });

        return priceMap;
      };

      let usaBrlPriceMap = new Map<
        string,
        { opening: number; closing: number }
      >();

      if (hasUSAssets) {
        setSyncHistoryStatus(`Buscando USDBRL...`);
        const ptaxSheetData = await SheetsService.fetchAssetHistory("CURRENCY:USDBRL");
        if (ptaxSheetData && ptaxSheetData.resultados) {
          usaBrlPriceMap = processSheetData(ptaxSheetData.resultados);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const failedTickers: string[] = [];

      for (const ticker of tickerList) {
        setSyncHistoryStatus(`Buscando ${ticker}...`);
        let fetchTicker = ticker;
        const isCrypto = cryptoMap.get(ticker) || false;
        const isUSA = tickers.get(ticker) || false;

        if (isCrypto && !fetchTicker.match(/[0-9]{2}$/)) {
          let base = fetchTicker.toUpperCase();
          if (base.startsWith("CURRENCY:")) {
            base = base.replace("CURRENCY:", "");
          }
          base = base.replace("-BRL", "").replace("BRL", "").replace("-USD", "").replace("USD", "");
          
          fetchTicker = `CURRENCY:${base}USD`;
        } else {
            const isTesouro = fetchTicker.toUpperCase().startsWith("TD:") || fetchTicker.toUpperCase().startsWith("TESOURO");
            const isFixed = fixedIncomeMap.get(ticker);
            
            if (!isTesouro && !isFixed && !fetchTicker.includes(":")) {
                if (isUSA) {
                    fetchTicker = `NYSEARCA:${fetchTicker}`;
                } else {
                    fetchTicker = `BVMF:${fetchTicker}`;
                }
            }
        }
        
        let sheetData = null;
        try {
            sheetData = await SheetsService.fetchAssetHistory(fetchTicker);
        } catch (err) {
            console.error(`Erro ao buscar ${ticker}:`, err);
        }

        if (sheetData && sheetData.resultados) {
          const isUS = tickers.get(ticker) || false;
          const priceMap = processSheetData(sheetData.resultados);

          const historyItems: {
            date: string;
            quantity: number;
            avgPrice: number;
            openingPrice: number;
            closingPrice: number;
          }[] = [];

          overviewData.tableData.forEach((row: any) => {
            const detail = row.assetDetails?.find(
              (d: any) => d.ticker === ticker,
            );
            if (detail && detail.quantity > 0) {
              const date = row.fullDate;
              const prices = priceMap.get(date);

              let openingPrice = prices?.opening || 0;
              let closingPrice = prices?.closing || 0;

              const shouldMultiplyUSD = isUS || (isCrypto && !ticker.match(/[0-9]{2}$/));

              if (shouldMultiplyUSD) {
                const usdPrices = usaBrlPriceMap.get(date);
                // We fallback to 1 if we couldn't fetch USDBRL for some reason, to not zero it completely
                const usdOp = usdPrices?.opening || 1;
                const usdCl = usdPrices?.closing || 1;
                openingPrice *= usdOp;
                closingPrice *= usdCl;
              }

              historyItems.push({
                date,
                quantity: detail.quantity,
                avgPrice: detail.avgPrice || 0,
                openingPrice,
                closingPrice,
              });
            }
          });

          if (historyItems.length > 0) {
            historyItems.sort((a, b) => a.date.localeCompare(b.date));
            // SheetsService (Google Finance) usually returns adjusted prices. Maintain user's preference if toggled.
            const preserveAdjustment = assetHistory[ticker] !== undefined 
                ? assetHistory[ticker].adjustForSplits 
                : true;
            await StorageService.saveAssetHistory(ticker, historyItems, preserveAdjustment);
          }
        } else {
          // Failure case
          failedTickers.push(ticker);
          if (sheetData && (sheetData as any).erro) {
            const errMesg = (sheetData as any).erro;
            console.error(`Erro do Apps Script para ${ticker}:`, errMesg);
            setSyncHistoryStatus(`Erro: ${errMesg}`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            console.warn(`Sincronização falhou para o ativo ${ticker}. Dados não retornados.`);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (failedTickers.length > 0) {
          alert(`Os seguintes ativos não puderam ser sincronizados (possível troca de ticker, OPA, ou API indisponível):\n\n${failedTickers.join(', ')}`);
      }

      setSyncHistoryStatus("Finalizado!");
    } catch (e) {
      console.error(e);
      setSyncHistoryStatus("Erro!");
    } finally {
      setTimeout(() => setSyncHistoryStatus(""), 3000);
      setIsSyncingHistory(false);
    }
  };

  // ... (rest of the component code remains exactly the same)

  const classSummary = useMemo(() => {
    const groups: Record<
      string,
      {
        name: string;
        market: number;
        invested: number;
        totalProfit: number;
        dailyProfit: number;
        count: number;
        subcategories: any;
      }
    > = {};
    portfolioData.list.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = {
          name: item.category,
          market: 0,
          invested: 0,
          totalProfit: 0,
          dailyProfit: 0,
          count: 0,
          subcategories: {},
        };
      }
      const g = groups[item.category];
      g.market += item.currentTotal;
      g.invested += item.totalCost;
      g.totalProfit += item.totalProfit;
      g.dailyProfit += item.dailyProfit;
      g.count += 1;

      const subName = item.subCategory || "Outros";
      if (!g.subcategories[subName])
        g.subcategories[subName] = {
          name: subName,
          value: 0,
          invested: 0,
          dailyProfit: 0,
          totalProfit: 0,
        };
      g.subcategories[subName].value += item.currentTotal;
      g.subcategories[subName].invested += item.totalCost;
      g.subcategories[subName].dailyProfit += item.dailyProfit;
      g.subcategories[subName].totalProfit += item.totalProfit;
    });
    return Object.values(groups).sort((a, b) => b.market - a.market);
  }, [portfolioData.list]);

  const groupedPositions = useMemo(() => {
    const groups: Record<string, typeof portfolioData.list> = {};
    portfolioData.list.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => b.currentTotal - a.currentTotal);
    });
    return groups;
  }, [portfolioData.list]);

  const toggleSubCategory = (catName: string, subName: string) => {
    const key = `${catName}-${subName}`;
    const newSet = new Set(expandedSubCategories);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedSubCategories(newSet);
  };

  const filteredHistoryTransactions = useMemo<Transaction[]>(() => {
    return [...investmentTransactions].reverse().filter((t) => {
      if (
        historySearchTerm &&
        !t.investmentDetails?.ticker.includes(
          historySearchTerm.toUpperCase(),
        ) &&
        !(
          t.investmentDetails?.newTicker &&
          t.investmentDetails.newTicker.includes(
            historySearchTerm.toUpperCase(),
          )
        )
      )
        return false;
      if (historyFilterCategory && t.categoryId !== historyFilterCategory)
        return false;
      if (
        historyFilterSubCategory &&
        t.subCategoryId !== historyFilterSubCategory
      )
        return false;
      const dateStr = t.date.split("T")[0];
      if (historyStart && dateStr < historyStart) return false;
      if (historyEnd && dateStr > historyEnd) return false;
      return true;
    });
  }, [
    investmentTransactions,
    historySearchTerm,
    historyFilterCategory,
    historyFilterSubCategory,
    historyStart,
    historyEnd,
  ]);

  const historyDividendsList = useMemo(() => {
    return filteredHistoryTransactions.filter((t) =>
      ["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
        t.investmentDetails?.event || "",
      ),
    );
  }, [filteredHistoryTransactions]);

  const historyOperationsList = useMemo(() => {
    return filteredHistoryTransactions.filter(
      (t) =>
        !["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
          t.investmentDetails?.event || "",
        ),
    );
  }, [filteredHistoryTransactions]);

  const historySummary = useMemo(() => {
    let proventos = 0;
    let realizedProfit = 0;
    let netFlow = 0;
    filteredHistoryTransactions.forEach((t) => {
      const event = t.investmentDetails?.event || "";
      if (["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(event))
        proventos += t.amount;
      else if (event === "SELL") {
        const profit = portfolioData.profitMap[t.id] || 0;
        realizedProfit += profit;
        netFlow -= t.amount;
      } else if (event === "BUY") netFlow += t.amount;
    });
    return { proventos, realizedProfit, netFlow };
  }, [filteredHistoryTransactions, portfolioData.profitMap]);

  const organizedHistory = useMemo(() => {
    const structure: Record<
      string,
      Record<
        string,
        Record<
          string,
          {
            trades: Transaction[];
            proventos: Transaction[];
            totalProventosValue: number;
            totalRealizedProfit: number;
            categoryId: string;
            subCategoryId?: string;
          }
        >
      >
    > = {};
    filteredHistoryTransactions.forEach((t) => {
      const ticker = t.investmentDetails?.ticker || "OUTROS";
      const cat = categories.find((c) => c.id === t.categoryId);
      const sub = subCategories.find((s) => s.id === t.subCategoryId);
      const catName = cat?.name || "Sem Categoria";
      const subName = sub?.name || "Geral";
      if (!structure[catName]) structure[catName] = {};
      if (!structure[catName][subName]) structure[catName][subName] = {};
      if (!structure[catName][subName][ticker])
        structure[catName][subName][ticker] = {
          trades: [],
          proventos: [],
          totalProventosValue: 0,
          totalRealizedProfit: 0,
          categoryId: t.categoryId,
          subCategoryId: t.subCategoryId,
        };
      const group = structure[catName][subName][ticker];
      if (
        ["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
          t.investmentDetails?.event || "",
        )
      ) {
        group.proventos.push(t);
        group.totalProventosValue += t.amount;
      } else {
        group.trades.push(t);
        if (t.investmentDetails?.event === "SELL") {
          group.totalRealizedProfit += portfolioData.profitMap[t.id] || 0;
        }
      }
    });
    return structure;
  }, [
    filteredHistoryTransactions,
    categories,
    subCategories,
    portfolioData.profitMap,
  ]);

  const handleUpdatePrices = async () => {
    setLoadingOnline(true);
    setSyncStatus("Sincronizando...");
    try {
      const tickers: string[] = Array.from(
        new Set(
          portfolioData.list
            .map((i) => i.ticker)
            .filter((t) => !t.startsWith("TD:") && !t.includes("TESOURO")),
        ),
      );
      const stocks: string[] = tickers.filter(
        (t: string) => !BrapiService.isCrypto(t),
      );
      const cryptos: string[] = tickers.filter((t: string) =>
        BrapiService.isCrypto(t),
      );

      const [stockPrices, cryptoPrices, tesouroPrices, ptax] =
        await Promise.all([
          stocks.length > 0
            ? BrapiService.fetchPricesBatch(stocks)
            : Promise.resolve([]),
          cryptos.length > 0
            ? BrapiService.fetchCryptoPrices(cryptos)
            : Promise.resolve([]),
          BrapiService.fetchTesouroDireto(),
          BrapiService.fetchPtax(),
        ]);

      let updatedPrices: AssetPrice[] = [];

      if (stockPrices && stockPrices.length > 0) {
        updatedPrices = [
          ...updatedPrices,
          ...stockPrices.map((p) => ({
            ...p,
            id: p.ticker,
            lastUpdated: new Date().toISOString(),
          })),
        ];
      }

      if (cryptoPrices && cryptoPrices.length > 0) {
        updatedPrices = [
          ...updatedPrices,
          ...cryptoPrices.map((p) => ({
            ...p,
            id: p.ticker,
            lastUpdated: new Date().toISOString(),
          })),
        ];
      }

      if (tesouroPrices && tesouroPrices.length > 0) {
        updatedPrices = [
          ...updatedPrices,
          ...tesouroPrices.map((p) => ({
            ticker: p.ticker,
            currentPrice: p.currentPrice,
            longName: p.longName,
            id: p.ticker,
            lastUpdated: new Date().toISOString(),
          })),
        ];
      }

      if (ptax) {
        updatedPrices.push({
          ticker: "USDBRL",
          currentPrice: ptax,
          id: "USDBRL",
          lastUpdated: new Date().toISOString(),
        });
      }

      if (updatedPrices.length > 0) {
        await StorageService.saveAssetPriceBatch(updatedPrices as AssetPrice[]);
      }

      setSyncStatus("Atualizado!");
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (e) {
      console.error(e);
      setSyncStatus("Erro na atualização");
    } finally {
      setLoadingOnline(false);
    }
  };

  const handleSingleUpdate = async (ticker: string) => {
    setLoadingOnline(true);
    try {
      let p: any = null;
      if (BrapiService.isCrypto(ticker)) {
        const res = await BrapiService.fetchCryptoPrices([ticker]);
        if (res && res.length > 0) p = res[0];
      } else {
        const res = await BrapiService.fetchPricesBatch([ticker]);
        if (res && res.length > 0) p = res[0];
      }

      if (p) {
        await StorageService.saveAssetPrice({
          ...p,
          id: p.ticker,
          lastUpdated: new Date().toISOString(),
        } as AssetPrice);
        alert(`Preço de ${ticker} atualizado: R$ ${p.currentPrice}`);
      } else {
        alert(`Não foi possível atualizar ${ticker}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOnline(false);
    }
  };

  const handleBulkDividendImport = async (data: any[]) => {
    for (const t of data) await StorageService.addTransaction(t);
  };
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };
  const handleSelectGroup = (items: Transaction[]) => {
    const allIds = items.map((i) => i.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    if (allSelected)
      setSelectedIds((prev) => prev.filter((id) => !allIds.includes(id)));
    else setSelectedIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };
  const handleBatchEdit = async () => {
    if (selectedIds.length === 0) return;
    if (!batchTargetCat && !batchTargetTicker && !batchTargetBroker) {
      alert(
        "Selecione uma categoria, informe um novo ticker ou uma corretora.",
      );
      return;
    }
    setIsBatchSaving(true);
    try {
      const promises = selectedIds.map((id) => {
        const t = transactions.find((tx) => tx.id === id);
        if (!t) return Promise.resolve();
        const updates: Partial<Transaction> = {};
        if (batchTargetCat) {
          updates.categoryId = batchTargetCat;
          updates.subCategoryId = batchTargetSub || undefined;
        }
        if (t.type === TransactionType.INVESTMENT && t.investmentDetails) {
          let invUpdates: any = {};
          if (batchTargetTicker)
            invUpdates.ticker = batchTargetTicker.toUpperCase();
          if (batchTargetBroker) invUpdates.broker = batchTargetBroker;
          if (Object.keys(invUpdates).length > 0)
            updates.investmentDetails = {
              ...t.investmentDetails,
              ...invUpdates,
            };
        }
        if (Object.keys(updates).length === 0) return Promise.resolve();
        return StorageService.updateTransaction({ ...t, ...updates });
      });
      await Promise.all(promises);
      setSelectedIds([]);
      setBatchTargetCat("");
      setBatchTargetSub("");
      setBatchTargetTicker("");
      setBatchTargetBroker("");
      setIsBatchEditOpen(false);
      alert("Alterações salvas com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar alterações.");
    } finally {
      setIsBatchSaving(false);
    }
  };
  const filteredSubCategoriesForBatch = useMemo(
    () => subCategories.filter((s) => s.categoryId === batchTargetCat),
    [batchTargetCat, subCategories],
  );

  const monthlyTaxReport = useMemo(() => {
    const report: Record<
      string,
      {
        month: string;
        salesTotal: number;
        salesStocks: number;
        profitStocks: number;
        salesFIIs: number;
        profitFIIs: number;
        salesEtfs: number;
        profitEtfs: number;
        salesBDRs: number;
        profitBDRs: number;
        salesCrypto: number;
        profitCrypto: number;
        salesExterior: number;
        profitExterior: number;
        profitDayTrade: number;
        salesDayTrade: number;
        taxDue: number;
        taxExterior: number;
        accumulatedLossCommon: number;
        accumulatedLossFII: number;
        accumulatedLossCrypto: number;
        accumulatedLossExterior: number;
        accumulatedLossDayTrade: number;
        items: {
          transaction: Transaction;
          profit: number;
          type: "STOCK" | "FII" | "ETF" | "BDR" | "CRYPTO" | "EXTERIOR";
          isDayTrade: boolean;
        }[];
      }
    > = {};

    // Sort chronologically
    const sorted = [...investmentTransactions];

    let accLossFII = 0;
    let accLossCommon = 0; // Swing Trade: Stocks + ETFs + BDRs
    let accLossCrypto = 0;
    let accLossExterior = 0;
    let accLossDayTrade = 0;

    // 1. Identify Day Trades
    const dayTrades = new Set<string>(); // "ticker-YYYY-MM-DD"
    const dailyOps: Record<string, { buy: boolean; sell: boolean }> = {};

    sorted.forEach((t) => {
      if (!t.investmentDetails) return;
      const ticker = t.investmentDetails.ticker.toUpperCase();
      const dateStr = t.date.split("T")[0];
      const key = `${ticker}-${dateStr}`;
      if (!dailyOps[key]) dailyOps[key] = { buy: false, sell: false };
      if (t.investmentDetails.event === "BUY") dailyOps[key].buy = true;
      if (t.investmentDetails.event === "SELL") dailyOps[key].sell = true;
      if (dailyOps[key].buy && dailyOps[key].sell) dayTrades.add(key);
    });

    // 2. Process ALL transactions to build correct accumulation history
    sorted.forEach((t) => {
      if (t.investmentDetails?.event !== "SELL") return;

      const date = new Date(t.date);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const dayKey = `${t.investmentDetails.ticker.toUpperCase()}-${t.date.split("T")[0]}`;
      const isDayTrade = dayTrades.has(dayKey);

      if (!report[monthKey])
        report[monthKey] = {
          month: monthKey,
          salesTotal: 0,
          salesStocks: 0,
          profitStocks: 0,
          salesFIIs: 0,
          profitFIIs: 0,
          salesEtfs: 0,
          profitEtfs: 0,
          salesBDRs: 0,
          profitBDRs: 0,
          salesCrypto: 0,
          profitCrypto: 0,
          salesExterior: 0,
          profitExterior: 0,
          profitDayTrade: 0,
          salesDayTrade: 0,
          taxDue: 0,
          taxExterior: 0,
          accumulatedLossCommon: 0,
          accumulatedLossFII: 0,
          accumulatedLossCrypto: 0,
          accumulatedLossExterior: 0,
          accumulatedLossDayTrade: 0,
          items: [],
        };

      const r = report[monthKey];
      const amount = t.amount;
      const profit = portfolioData.profitMap[t.id] || 0;

      const ticker = t.investmentDetails?.ticker.toUpperCase() || "";
      const catName =
        categories.find((c) => c.id === t.categoryId)?.name.toUpperCase() || "";
      const subName =
        subCategories
          .find((s) => s.id === t.subCategoryId)
          ?.name.toUpperCase() || "";
      const currency = t.investmentDetails?.currency || "BRL";

      // EXCLUDE FIXED INCOME FROM DARF CALCULATION
      if (
        catName.includes("RENDA FIXA") ||
        subName.includes("TESOURO") ||
        subName.includes("CDB") ||
        subName.includes("LCI") ||
        subName.includes("LCA")
      ) {
        return;
      }

      r.salesTotal += amount;

      // ASSET CLASSIFICATION LOGIC
      const knownUnits = [
        "BPAC11",
        "TAEE11",
        "KLBN11",
        "ALUP11",
        "SANB11",
        "ENGI11",
        "SAPR11",
        "SULA11",
        "TIET11",
        "BIDI11",
        "IGTI11",
        "CPLE11",
      ];
      const isExterior =
        currency === "USD" ||
        catName.includes("EXTERIOR") ||
        subName.includes("EXTERIOR");
      const isCrypto =
        catName.includes("CRIPTO") ||
        subName.includes("CRIPTO") ||
        subName.includes("BITCOIN") ||
        subName.includes("ETHER");
      const isFII =
        !isCrypto &&
        !isExterior &&
        (catName.includes("FII") ||
          subName.includes("FII") ||
          (ticker.endsWith("11") &&
            !ticker.startsWith("BOVA") &&
            !ticker.startsWith("IVVB") &&
            !ticker.startsWith("XINA") &&
            !ticker.startsWith("SMAL") &&
            !knownUnits.includes(ticker)));
      const isBDR =
        !isCrypto &&
        !isExterior &&
        !isFII &&
        (catName.includes("BDR") ||
          subName.includes("BDR") ||
          ticker.match(/3[23459]$/));
      const isETF =
        !isCrypto &&
        !isExterior &&
        !isFII &&
        !isBDR &&
        (catName.includes("ETF") ||
          subName.includes("ETF") ||
          ticker.startsWith("BOVA") ||
          ticker.startsWith("IVVB") ||
          ticker.startsWith("XINA") ||
          ticker.startsWith("SMAL"));

      let type: "STOCK" | "FII" | "ETF" | "BDR" | "CRYPTO" | "EXTERIOR" =
        "STOCK";

      if (isExterior) {
        type = "EXTERIOR";
      } else if (isCrypto) {
        type = "CRYPTO";
      } else if (isFII) {
        type = "FII";
      } else if (isBDR) {
        type = "BDR";
      } else if (isETF) {
        type = "ETF";
      } else {
        type = "STOCK";
      }

      r.items.push({ transaction: t, profit, type, isDayTrade });
    });

    // 3. Calculate Tax per Month with Loss Compensation (Iterate chronologically over all months)
    const allMonths = Object.keys(report).sort();

    allMonths.forEach((key) => {
      const r = report[key];
      let monthlyTax = 0;
      let exteriorTax = 0;

      // --- 1. FIIs (20% flat, separate basket, Swing and DT together) ---
      const fiiItems = r.items.filter((i) => i.type === "FII");
      r.profitFIIs = fiiItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesFIIs = fiiItems.reduce((acc, i) => acc + i.transaction.amount, 0);

      let taxableFII = r.profitFIIs;
      if (taxableFII < 0) {
        accLossFII += taxableFII;
        taxableFII = 0;
      } else if (accLossFII < 0) {
        const offset = Math.min(taxableFII, Math.abs(accLossFII));
        taxableFII -= offset;
        accLossFII += offset;
      }
      if (taxableFII > 0) monthlyTax += taxableFII * 0.2;

      // --- 2. Day Trade Basket (Stocks + ETFs + BDRs) ---
      const dtItems = r.items.filter(
        (i) =>
          (i.type === "STOCK" || i.type === "ETF" || i.type === "BDR") &&
          i.isDayTrade,
      );
      r.profitDayTrade = dtItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesDayTrade = dtItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      let taxableDT = r.profitDayTrade;
      if (taxableDT < 0) {
        accLossDayTrade += taxableDT;
        taxableDT = 0;
      } else if (accLossDayTrade < 0) {
        const offset = Math.min(taxableDT, Math.abs(accLossDayTrade));
        taxableDT -= offset;
        accLossDayTrade += offset;
      }
      if (taxableDT > 0) monthlyTax += taxableDT * 0.2;

      // --- 3. Common Basket (Swing Trade: Stocks + ETFs + BDRs) ---
      const swingEtfItems = r.items.filter(
        (i) => i.type === "ETF" && !i.isDayTrade,
      );
      const swingBdrItems = r.items.filter(
        (i) => i.type === "BDR" && !i.isDayTrade,
      );
      const swingStockItems = r.items.filter(
        (i) => i.type === "STOCK" && !i.isDayTrade,
      );

      r.profitEtfs = swingEtfItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesEtfs = swingEtfItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      r.profitBDRs = swingBdrItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesBDRs = swingBdrItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      r.profitStocks = swingStockItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesStocks = swingStockItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      let commonProfit = r.profitEtfs + r.profitBDRs; // ETFs and BDRs always taxable

      if (r.salesStocks > 20000) {
        commonProfit += r.profitStocks; // Stocks taxable
      } else if (r.profitStocks < 0) {
        // Loss in exempt stocks is NOT compensable
      }

      if (commonProfit < 0) {
        accLossCommon += commonProfit;
        commonProfit = 0;
      } else if (accLossCommon < 0) {
        const offset = Math.min(commonProfit, Math.abs(accLossCommon));
        commonProfit -= offset;
        accLossCommon += offset;
      }
      if (commonProfit > 0) monthlyTax += commonProfit * 0.15;

      // --- 4. Crypto Basket (15% on gain if sales > 35k/month) ---
      const cryptoItems = r.items.filter((i) => i.type === "CRYPTO");
      r.profitCrypto = cryptoItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesCrypto = cryptoItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      let taxableCrypto = 0;
      if (r.salesCrypto > 35000) {
        taxableCrypto = r.profitCrypto;
      }
      // Crypto losses are NOT compensable in Brazil
      if (taxableCrypto > 0) monthlyTax += taxableCrypto * 0.15;

      // --- 5. Exterior Basket (15% flat, no exemption limit since 2024, paid annually) ---
      const exteriorItems = r.items.filter((i) => i.type === "EXTERIOR");
      r.profitExterior = exteriorItems.reduce((acc, i) => acc + i.profit, 0);
      r.salesExterior = exteriorItems.reduce(
        (acc, i) => acc + i.transaction.amount,
        0,
      );

      let taxableExterior = r.profitExterior;
      if (taxableExterior < 0) {
        accLossExterior += taxableExterior;
        taxableExterior = 0;
      } else if (accLossExterior < 0) {
        const offset = Math.min(taxableExterior, Math.abs(accLossExterior));
        taxableExterior -= offset;
        accLossExterior += offset;
      }
      if (taxableExterior > 0) exteriorTax += taxableExterior * 0.15;

      r.taxDue = monthlyTax;
      r.taxExterior = exteriorTax;
      r.accumulatedLossCommon = accLossCommon;
      r.accumulatedLossFII = accLossFII;
      r.accumulatedLossCrypto = 0; // Removed, not compensable
      r.accumulatedLossExterior = accLossExterior;
      r.accumulatedLossDayTrade = accLossDayTrade;
    });

    // Filter by selected year for display
    return Object.values(report)
      .filter((r) => !taxYearFilter || r.month.startsWith(taxYearFilter))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [
    investmentTransactions,
    portfolioData.profitMap,
    categories,
    subCategories,
    taxYearFilter,
  ]);

  const dirfData = useMemo(() => {
    // Reconstruct portfolio at the end of taxYearFilter
    const targetDate = `${taxYearFilter}-12-31`;
    const prevTargetDate = `${parseInt(taxYearFilter) - 1}-12-31`;

    const getPositionsAtDate = (dateLimit: string) => {
      const posMap: Record<
        string,
        {
          ticker: string;
          quantity: number;
          totalCost: number;
          avgPrice: number;
          type: string;
          longName: string;
          broker: string;
          cnpj: string;
        }
      > = {};

      const sorted = [...investmentTransactions];
      sorted.forEach((t) => {
        if (t.date > dateLimit) return;

        const ticker = t.investmentDetails?.ticker.toUpperCase() || "";
        if (!ticker) return;

        if (!posMap[ticker]) {
          posMap[ticker] = {
            ticker,
            quantity: 0,
            totalCost: 0,
            avgPrice: 0,
            type: "Outros",
            longName: ticker,
            broker: t.investmentDetails?.broker || "",
            cnpj: t.investmentDetails?.cnpj || "",
          };
        }

        const pos = posMap[ticker];
        const qty = t.investmentDetails?.quantity || 0;
        const total = t.amount;
        const event = t.investmentDetails?.event;

        if (event === "BUY") {
          pos.quantity += qty;
          pos.totalCost += total;
          pos.avgPrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;
          pos.broker = t.investmentDetails?.broker || pos.broker;
          if (t.investmentDetails?.cnpj) pos.cnpj = t.investmentDetails.cnpj;
        } else if (event === "SELL") {
          pos.quantity -= qty;
          const costSold = qty * pos.avgPrice;
          pos.totalCost -= costSold;
        } else if (event === "SPLIT") {
          const factor =
            qty > 50 && pos.quantity > 0
              ? (pos.quantity + qty) / pos.quantity
              : qty;
          pos.quantity *= factor;
          pos.avgPrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;
        } else if (event === "MERGE") {
          pos.quantity /= qty;
          pos.avgPrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;
        } else if (event === "BONUS") {
          pos.quantity += qty;
          const bonusCost = qty * (t.investmentDetails?.price || 0);
          pos.totalCost += bonusCost;
          pos.avgPrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;
        } else if (
          event === "TICKER_UPDATE" &&
          t.investmentDetails?.newTicker
        ) {
          const targetTicker = t.investmentDetails.newTicker.toUpperCase();
          if (!posMap[targetTicker]) {
            posMap[targetTicker] = {
              ticker: targetTicker,
              quantity: 0,
              totalCost: 0,
              avgPrice: 0,
              type: "Outros",
              longName: targetTicker,
              broker: pos.broker,
              cnpj: pos.cnpj,
            };
          }
          const b = posMap[targetTicker];
          const multiplier = qty && qty > 0 ? qty : 1;
          b.quantity += pos.quantity * multiplier;
          b.totalCost += pos.totalCost;
          b.avgPrice = b.quantity > 0 ? b.totalCost / b.quantity : 0;

          pos.quantity = 0;
          pos.totalCost = 0;
          pos.avgPrice = 0;
        }
      });
      return posMap;
    };

    const currentPositions = getPositionsAtDate(targetDate);
    const prevPositions = getPositionsAtDate(prevTargetDate);

    const positions: Record<string, any> = {};

    Object.keys(currentPositions).forEach((ticker) => {
      positions[ticker] = {
        ...currentPositions[ticker],
        totalProventos: 0,
        prevQuantity: prevPositions[ticker]?.quantity || 0,
        prevTotalCost: prevPositions[ticker]?.totalCost || 0,
      };
    });

    Object.keys(prevPositions).forEach((ticker) => {
      if (!positions[ticker]) {
        positions[ticker] = {
          ...prevPositions[ticker],
          quantity: 0,
          totalCost: 0,
          avgPrice: 0,
          totalProventos: 0,
          prevQuantity: prevPositions[ticker].quantity,
          prevTotalCost: prevPositions[ticker].totalCost,
        };
      }
    });

    // 2. Calculate Proventos for the specific year
    investmentTransactions.forEach((t) => {
      if (!t.date.startsWith(taxYearFilter)) return;
      if (
        !["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
          t.investmentDetails?.event || "",
        )
      )
        return;

      const ticker = t.investmentDetails?.ticker.toUpperCase() || "";
      if (positions[ticker]) {
        positions[ticker].totalProventos += t.amount;
      } else {
        positions[ticker] = {
          ticker,
          quantity: 0,
          totalCost: 0,
          avgPrice: 0,
          type: "Outros",
          longName: ticker,
          broker: t.investmentDetails?.broker || "",
          cnpj: t.investmentDetails?.cnpj || "",
          totalProventos: t.amount,
          prevQuantity: 0,
          prevTotalCost: 0,
        };
      }
    });

    // 3. Group by Type
    const grouped: Record<string, any[]> = {};

    const knownUnits = [
      "BPAC11",
      "TAEE11",
      "SANB11",
      "KLBN11",
      "ALUP11",
      "ENGI11",
      "SULA11",
      "BIDI11",
      "SAPR11",
      "TIET11",
    ];

    Object.values(positions).forEach((item) => {
      if (
        item.quantity <= 0.000001 &&
        item.totalProventos <= 0 &&
        item.prevQuantity <= 0.000001
      )
        return;

      const sampleTrans = investmentTransactions.find(
        (t) => t.investmentDetails?.ticker === item.ticker,
      );
      const catId = sampleTrans?.categoryId;
      const subId = sampleTrans?.subCategoryId;
      const catName =
        categories.find((c) => c.id === catId)?.name.toUpperCase() || "";
      const subName =
        subCategories.find((s) => s.id === subId)?.name.toUpperCase() || "";

      let group = "Ações";
      if (
        catName.includes("RENDA FIXA") ||
        subName.includes("TESOURO") ||
        subName.includes("CDB")
      )
        group = "Renda Fixa";
      else if (
        catName.includes("FII") ||
        subName.includes("FII") ||
        (item.ticker.endsWith("11") &&
          !item.ticker.startsWith("BOVA") &&
          !knownUnits.includes(item.ticker))
      )
        group = "FIIs";
      else if (
        catName.includes("ETF") ||
        subName.includes("ETF") ||
        item.ticker.startsWith("BOVA") ||
        item.ticker.startsWith("IVVB")
      )
        group = "ETFs/BDRs";
      else if (catName.includes("CRIPTO") || subName.includes("CRIPTO"))
        group = "Criptoativos";

      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({
        ...item,
        avgPriceFiscal: item.avgPrice,
        isFixedIncome: group === "Renda Fixa",
      });
    });

    return grouped;
  }, [investmentTransactions, taxYearFilter, categories, subCategories]);

  
    const filteredDividendsList = useMemo(() => {
    return investmentTransactions
      .filter((t) =>
        ["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
          t.investmentDetails?.event || "",
        ),
      )
      .filter((t) => {
        if (proventosYearFilter && !t.date.startsWith(proventosYearFilter))
          return false;
        if (proventosTickerFilter) {
          const searchTerms = proventosTickerFilter.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
          if (searchTerms.length > 0) {
            const matches = searchTerms.some(term => t.investmentDetails?.ticker.includes(term));
            if (!matches) return false;
          }
        }
        if (proventosCategoryFilter && t.categoryId !== proventosCategoryFilter)
          return false;
        return true;
      });
  }, [investmentTransactions, proventosYearFilter, proventosTickerFilter, proventosCategoryFilter]);

  const filteredProventosSummary = useMemo(() => {
    let total = 0;
    let total12m = 0;
    const oneYearAgoStr = new Date();
    oneYearAgoStr.setFullYear(oneYearAgoStr.getFullYear() - 1);
    const oneYearAgo = oneYearAgoStr.toISOString();

    filteredDividendsList.forEach((t) => {
      total += t.amount;
      if (t.date >= oneYearAgo) {
        total12m += t.amount;
      }
    });

    let investedValue = 0;
    portfolioData.list.forEach((asset: any) => {
      if (proventosTickerFilter) {
        const searchTerms = proventosTickerFilter.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => asset.ticker.toUpperCase().includes(term));
          if (!matches) return;
        }
      }
      if (proventosCategoryFilter && asset.categoryId !== proventosCategoryFilter) return;
      investedValue += asset.totalCost;
    });

    return { total, total12m, investedValue };
  }, [filteredDividendsList, portfolioData, proventosTickerFilter, proventosCategoryFilter]);

  const proventosChartData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredDividendsList.forEach((t) => {
      const key = t.date.slice(0, 7);
      data[key] = (data[key] || 0) + t.amount;
    });
    return Object.entries(data)
      .sort()
      .map(([date, amount]) => ({ date, amount }));
  }, [filteredDividendsList]);

  const topPayers = useMemo(() => {
    const data: Record<string, number> = {};
    filteredDividendsList.forEach((t) => {
      const ticker = t.investmentDetails?.ticker || "Outros";
      data[ticker] = (data[ticker] || 0) + t.amount;
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDividendsList]);

  const monthlyDividendsTable = useMemo(() => {
    const grouped: Record<
      string,
      { date: string; total: number; items: Transaction[] }
    > = {};
    filteredDividendsList.forEach((t) => {
      const monthKey = t.date.slice(0, 7);
      if (!grouped[monthKey])
        grouped[monthKey] = { date: monthKey, total: 0, items: [] };
      grouped[monthKey].total += t.amount;
      grouped[monthKey].items.push(t);
    });
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredDividendsList]);

  return (
    <div className="space-y-4 animate-in fade-in pb-24">
      {/* PROFESSIONAL INVESTMENT MENU BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex w-full md:w-auto overflow-x-auto gap-2">
          {[
            { id: "overview", label: "Visão Geral", icon: AreaChartIcon },
            { id: "portfolio", label: "Custódia (Carteira)", icon: Briefcase },
            { id: "history", label: "Extrato (Histórico)", icon: History },
            { id: "proventos", label: "Proventos", icon: Gift },
            { id: "tax", label: "Fiscal (IR)", icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
            >
              <tab.icon
                size={14}
                className={activeTab === tab.id ? "text-white" : "text-zinc-500 dark:text-zinc-400"}
              />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
          <button
            onClick={() => setIsManualHistoryOpen(true)}
            className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-all"
            title="Gerenciar Cotações Manuais"
          >
            <History size={18} />
          </button>
          <button
            onClick={onOpenBulkImport}
            className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-all"
            title="Importar Dados"
          >
            <Upload size={18} />
          </button>
        </div>
      </div>


      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center gap-4 z-20 relative">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtros</span>
        </div>
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          <MultiSelect
            options={categories.filter(
              (c) => c.type === TransactionType.INVESTMENT,
            )}
            selected={globalCategoryFilters}
            onChange={setGlobalCategoryFilters}
            placeholder="Todas as Categorias"
          />
          <MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Todas as Subcategorias"
          />
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              size={14}
            />
            <input
              type="text"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-full outline-none focus:ring-2 focus:ring-blue-600 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
              placeholder="Buscar ativos (ex: ITSA4)..."
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm text-white">
          <span className="text-xs font-semibold text-white/75 uppercase tracking-wider block mb-1">
            Patrimônio Atual
          </span>
          <div className="text-2xl font-bold tabular-nums tracking-tight">
            {formatCurrency(portfolioData.summary.marketValue)}
          </div>
          <div className="flex justify-between items-center mt-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/15">
              {portfolioData.summary.unrealizedTotal >= 0 ? "+" : ""}
              {formatCurrency(portfolioData.summary.unrealizedTotal)}
              <span className="ml-1 opacity-80">
                (
                {portfolioData.summary.investedValue > 0
                  ? (
                      (portfolioData.summary.unrealizedTotal /
                        portfolioData.summary.investedValue) *
                      100
                    ).toFixed(2)
                  : "0.00"}
                %)
              </span>
            </span>
            <span className="text-white/80">
              Dia: {portfolioData.summary.dailyProfitTotal >= 0 ? "+" : ""}
              {formatCurrency(portfolioData.summary.dailyProfitTotal)}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm text-zinc-900 dark:text-zinc-100">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Proventos {activeTab === "history" ? "(Filtro)" : "Acumulados"}
          </span>
          <div className="text-2xl font-bold tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
            {formatCurrency(
              activeTab === "history"
                ? historySummary.proventos
                : portfolioData.summary.proventosTotal,
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            {activeTab === "history"
              ? "No período selecionado"
              : `YoC a.a.: ${calculateYoC(filteredProventosSummary.total12m, filteredProventosSummary.investedValue).toFixed(2)}% | a.m.: ${convertAnnualToMonthlyCompound(calculateYoC(filteredProventosSummary.total12m, filteredProventosSummary.investedValue)).toFixed(2)}%`}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm text-zinc-900 dark:text-zinc-100">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Lucro Realizado {activeTab === "history" && "(Filtro)"}
          </span>
          <div
            className={`text-2xl font-bold tabular-nums tracking-tight ${(activeTab === "history" ? historySummary.realizedProfit : portfolioData.summary.realizedProfit) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {formatCurrency(
              activeTab === "history"
                ? historySummary.realizedProfit
                : portfolioData.summary.realizedProfit,
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Vendas fechadas</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm text-zinc-900 dark:text-zinc-100">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            {activeTab === "history" ? "Fluxo Líquido" : "Custo de Aquisição"}
          </span>
          <div className="text-2xl font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-200">
            {formatCurrency(
              activeTab === "history"
                ? historySummary.netFlow
                : portfolioData.summary.investedValue,
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            {activeTab === "history"
              ? "Aportes - Vendas no filtro"
              : `PTAX: R$ ${portfolioData.usdRate.toFixed(4)}`}
          </p>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">
                Período:
              </span>
            </div>
            <input
              type="month"
              value={
                overviewFilterDate !== null
                  ? overviewFilterDate
                  : settings.historyStartDate
                    ? settings.historyStartDate.slice(0, 7)
                    : ""
              }
              onChange={(e) => setOverviewFilterDate(e.target.value)}
              className="bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
              title="Mês Inicial"
            />
            <button
              onClick={() => setShowDetailedReport(!showDetailedReport)}
              className={`ml-auto flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${showDetailedReport ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-zinc-900 text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-blue-950/60"}`}
            >
              <FileText size={14} />
              {showDetailedReport
                ? "Ocultar Relatório"
                : "Ver Relatório Detalhado"}
            </button>
          </div>

          {showDetailedReport && overviewData.report && (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm space-y-8 animate-in slide-in-from-top-4 duration-500">
              {/* 1. Identificação */}
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {overviewData.report.identification.title}
                </h2>
                <div className="flex flex-wrap gap-4 mt-2 text-[10px] font-bold text-gray-900 uppercase tracking-wider">
                  <span>
                    Mês de Referência:{" "}
                    <span className="text-blue-600">
                      {overviewData.report.identification.reference}
                    </span>
                  </span>
                  <span>
                    Período:{" "}
                    <span className="text-blue-600">
                      {overviewData.report.identification.period}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2 italic">
                  {overviewData.report.identification.purpose}
                </p>
              </div>

              {/* 2. Resumo Executivo */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-50 dark:bg-blue-950/600 rounded-full"></div>
                  Resumo Executivo da Carteira
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                      Patrimônio Final
                    </span>
                    <div className="text-lg font-bold text-slate-800">
                      {formatCurrency(
                        overviewData.report.executiveSummary.equityEnd,
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-600 mt-1">
                      <span>Anterior: {formatCurrency(overviewData.report.executiveSummary.equityPrev)}</span>
                      <span>Aplicado: {formatCurrency(overviewData.report.executiveSummary.totalInvested)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                      Resultado Global Acumulado
                    </span>
                    <div className={`text-lg font-bold ${overviewData.report.executiveSummary.totalProfitAccumulated >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(overviewData.report.executiveSummary.totalProfitAccumulated)}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1 flex justify-between items-center">
                      <span>Rentabilidade-CDI (Alpha):</span>
                      <span className={`font-bold ${overviewData.report.executiveSummary.totalAlpha >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {overviewData.report.executiveSummary.totalAlpha > 0 ? "+" : ""}
                        {overviewData.report.executiveSummary.totalAlpha.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                      Resultado no Mês
                    </span>
                    <div
                      className={`text-lg font-bold ${overviewData.report.executiveSummary.gainsMonth >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {formatCurrency(
                        overviewData.report.executiveSummary.gainsMonth,
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-600 mt-1">
                      <span>Aportes L.: {formatCurrency(overviewData.report.executiveSummary.applications)}</span>
                      <span>Resgates: {formatCurrency(overviewData.report.executiveSummary.redemptions)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                      Proventos & Renda
                    </span>
                    <div className="text-lg font-bold text-emerald-600">
                      {formatCurrency(overviewData.report.executiveSummary.cumulativeDividends)}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      Yield on Cost: {calculateYoC(portfolioData.summary.proventos12mTotal, overviewData.report.executiveSummary.totalInvested).toFixed(2)}%
                    </div>
                  </div>

                  {/* Segunda Linha */}

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 mb-1 group relative">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">
                        Rentabilidade (TWR)
                      </span>
                      <Info size={10} className="text-gray-600 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-100 text-gray-900 text-[10px] rounded shadow-lg z-50 whitespace-normal leading-tight">
                        Mede a performance da estratégia, isolando o efeito de
                        aportes e resgates. Ideal para comparar com o CDI.
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-lg font-bold text-blue-600">
                         {overviewData.report.executiveSummary.returns.month.toFixed(
                           2,
                         )}
                         %{" "}
                       </div>
                       <span className="text-[10px] font-normal text-gray-500 font-medium">mês</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1 flex justify-between">
                      <span>Ano: {overviewData.report.executiveSummary.returns.year.toFixed(2)}%</span>
                      <span>Total: {overviewData.report.executiveSummary.returns.inception.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 mb-1 group relative">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">
                        Rentabilidade (XTIR)
                      </span>
                      <Info size={10} className="text-gray-600 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-100 text-gray-900 text-[10px] rounded shadow-lg z-50 whitespace-normal leading-tight">
                        Mede o crescimento real do seu dinheiro, considerando o
                        tamanho e a data exata de cada aporte ou resgate.
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-lg font-bold text-blue-600">
                         {overviewData.report.executiveSummary.returns.xtirMonthly.toFixed(
                           2,
                         )}
                         %{" "}
                       </div>
                       <span className="text-[10px] font-normal text-gray-500 font-medium">a.m.</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      Anualizada:{" "}
                      {overviewData.report.executiveSummary.returns.xtirAnnual.toFixed(
                        2,
                      )}
                      % a.a.
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-1 sm:col-span-2 lg:col-span-2">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                      Análise de Risco & Histórico de Sucesso
                    </span>
                    <div className="flex mt-3 justify-between items-center text-slate-800">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Volatilidade (Mensal)</div>
                            <div className="text-xl font-bold">
                              {(overviewData.report.riskReturn.volatility * 100).toFixed(2)}%
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Meses vs CDI</div>
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {overviewData.report.riskReturn.monthsAboveCDI} <span className="text-sm font-medium text-blue-400">VITÓRIAS</span>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Eventos do Mês */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                  Eventos Financeiros do Mês
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-2">
                      Proventos Recebidos
                    </span>
                    <div className="space-y-2">
                      {overviewData.report.lastMonthData.assetDetails
                        .filter((d: any) => d.dividends > 0)
                        .slice(0, 5)
                        .map((d: any) => (
                          <div
                            key={d.ticker}
                            className="flex justify-between text-[10px]"
                          >
                            <span className="font-bold text-slate-600">
                              {d.ticker}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              {formatCurrency(d.dividends)}
                            </span>
                          </div>
                        ))}
                      {overviewData.report.lastMonthData.assetDetails.filter(
                        (d: any) => d.dividends > 0,
                      ).length > 5 && (
                        <div className="text-[10px] text-gray-600 text-center italic">
                          ...e outros ativos
                        </div>
                      )}
                      {overviewData.report.lastMonthData.assetDetails.filter(
                        (d: any) => d.dividends > 0,
                      ).length === 0 && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                          Nenhum provento no mês.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-2">
                      Movimentações de Capital
                    </span>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-600">
                          Aportes Realizados
                        </span>
                        <span className="text-blue-600 font-bold">
                          {formatCurrency(
                            overviewData.report.executiveSummary.applications,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-600">Resgates/Vendas</span>
                        <span className="text-rose-600 font-bold">
                          {formatCurrency(
                            overviewData.report.executiveSummary.redemptions,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                        <span className="font-bold text-slate-700">
                          Fluxo Líquido
                        </span>
                        <span
                          className={`font-bold ${overviewData.report.lastMonthData.flow >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {formatCurrency(
                            overviewData.report.lastMonthData.flow,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Rentabilidade e Evolução Patrimonial */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                  Rentabilidade e Evolução Patrimonial
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-[300px]">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-4">
                      Evolução da Rentabilidade (Carteira x CDI)
                    </span>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewData.chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                        <YAxis stroke="#94a3b8" fontSize={9} unit="%" />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          }}
                          formatter={(val: number) => `${val.toFixed(2)}%`}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: "10px" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="twrAccum"
                          name="Carteira (TWR)"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="cdiAccum"
                          name="CDI Acumulado"
                          stroke="#334155"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-[300px]">
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-4">
                      Evolução Patrimonial (Patrimônio x Investido)
                    </span>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewData.chartData}>
                        <defs>
                          <linearGradient
                            id="repMarket"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#6366f1"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#6366f1"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={9}
                          tickFormatter={(val) => `R$${val / 1000}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          }}
                          formatter={(val: number) => formatCurrency(val)}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: "10px" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="market"
                          name="Patrimônio"
                          stroke="#6366f1"
                          fillOpacity={1}
                          fill="url(#repMarket)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="invested"
                          name="Total Aportado"
                          stroke="#94a3b8"
                          fill="none"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-2">
                      Análise de Risco/Retorno da Carteira
                    </span>
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50 text-gray-900 font-bold uppercase">
                          <tr>
                            <th className="px-4 py-2">Métrica</th>
                            <th className="px-4 py-2 text-right">Quantidade</th>
                            <th className="px-4 py-2 text-right">
                              Percentual (%)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr>
                            <td className="px-4 py-2 font-bold text-slate-700">
                              Meses acima do Benchmark
                            </td>
                            <td className="px-4 py-2 text-right text-emerald-600 font-bold">
                              {overviewData.report.riskReturn.summary.above.qty}
                            </td>
                            <td className="px-4 py-2 text-right text-emerald-600 font-bold">
                              {overviewData.report.riskReturn.summary.above.percent.toFixed(
                                2,
                              )}
                              %
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-bold text-slate-700">
                              Meses abaixo do Benchmark
                            </td>
                            <td className="px-4 py-2 text-right text-rose-600 font-bold">
                              {overviewData.report.riskReturn.summary.below.qty}
                            </td>
                            <td className="px-4 py-2 text-right text-rose-600 font-bold">
                              {overviewData.report.riskReturn.summary.below.percent.toFixed(
                                2,
                              )}
                              %
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase block mb-2">
                      Performance por Período
                    </span>
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50 text-gray-900 font-bold uppercase">
                          <tr>
                            <th className="px-4 py-2">Período</th>
                            <th
                              className="px-4 py-2 text-right"
                              title="Time-Weighted Return: Isola o efeito dos aportes. Ideal para comparar com o CDI."
                            >
                              <div className="flex items-center justify-end gap-1">
                                Carteira (TWR){" "}
                                <Info
                                  size={10}
                                  className="text-gray-600 cursor-help"
                                />
                              </div>
                            </th>
                            <th className="px-4 py-2 text-right">CDI</th>
                            <th className="px-4 py-2 text-right">Index.</th>
                            <th className="px-4 py-2 text-right">
                              Volatilidade
                            </th>
                            <th
                              className="px-4 py-2 text-right text-blue-600"
                              title="Taxa Interna de Retorno: Considera o tamanho e a data dos aportes."
                            >
                              <div className="flex items-center justify-end gap-1">
                                XTIR a.m.{" "}
                                <Info
                                  size={10}
                                  className="text-blue-300 cursor-help"
                                />
                              </div>
                            </th>
                            <th
                              className="px-4 py-2 text-right text-blue-600"
                              title="Taxa Interna de Retorno: Considera o tamanho e a data dos aportes."
                            >
                              <div className="flex items-center justify-end gap-1">
                                XTIR a.a.{" "}
                                <Info
                                  size={10}
                                  className="text-blue-300 cursor-help"
                                />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {overviewData.report.riskReturn.horizons.map(
                            (h: any) => (
                              <tr
                                key={h.period}
                                className="hover:bg-slate-50/50"
                              >
                                <td className="px-4 py-2 font-bold text-slate-700">
                                  {h.period}
                                </td>
                                <td
                                  className={`px-4 py-2 text-right font-bold ${h.portfolio >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                >
                                  {h.portfolio.toFixed(2)}%
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {h.cdi.toFixed(2)}%
                                </td>
                                <td
                                  className={`px-4 py-2 text-right font-bold ${h.index >= 100 ? "text-emerald-600" : "text-slate-600"}`}
                                >
                                  {h.index.toFixed(2)}%
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {(h.volatility * 100).toFixed(2)}%
                                </td>
                                <td
                                  className={`px-4 py-2 text-right font-bold ${h.xtirMonthly >= 0 ? "text-blue-600" : "text-rose-600"}`}
                                >
                                  {h.xtirMonthly.toFixed(2)}%
                                </td>
                                <td
                                  className={`px-4 py-2 text-right font-bold ${h.xtirAnnual >= 0 ? "text-blue-600" : "text-rose-600"}`}
                                >
                                  {h.xtirAnnual.toFixed(2)}%
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Ganhos por Estratégia */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                  Análise de Ganhos por Estratégia
                </h3>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-slate-50 text-gray-900 font-bold uppercase">
                      <tr>
                        <th className="px-4 py-2">Estratégia</th>
                        <th className="px-4 py-2 text-right">Alocação</th>
                        <th className="px-4 py-2 text-right">Ganho Mês</th>
                        <th className="px-4 py-2 text-right border-l border-slate-100">
                          Ganho Ano
                        </th>
                        <th className="px-4 py-2 text-right border-l border-slate-100">
                          Ganho Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {overviewData.report.strategyGains
                        .filter(
                          (s: any) =>
                            s.allocation > 0 || s.inception !== 0 || s.isHeader,
                        )
                        .map((s: any) => {
                          if (
                            s.isHeader &&
                            s.allocation === 0 &&
                            s.inception === 0
                          )
                            return null; // hide empty headers

                          return (
                            <tr
                              key={`${s.strategy}-${s.isHeader ? "header" : "sub"}`}
                              className={`hover:bg-slate-50/50 ${s.isHeader ? "bg-slate-50 border-t-2 border-slate-100" : ""}`}
                            >
                              <td
                                className={`px-4 py-2 text-slate-700 ${s.isHeader ? "font-bold uppercase tracking-wider text-[10px]" : "font-bold pl-8"}`}
                              >
                                {s.strategy}
                              </td>
                              <td
                                className={`px-4 py-2 text-right ${s.isHeader ? "font-bold text-slate-700" : "text-gray-900"}`}
                              >
                                {s.allocation.toFixed(2)}%
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-bold ${s.month >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                <div className="flex flex-col">
                                  <span>{formatCurrency(s.month)}</span>
                                  <span className="text-[10px] opacity-80 font-normal">
                                    {s.monthPct > 0 ? "+" : ""}
                                    {s.monthPct.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-bold border-l border-slate-50 ${s.year >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                <div className="flex flex-col">
                                  <span>{formatCurrency(s.year)}</span>
                                  <span className="text-[10px] opacity-80 font-normal">
                                    {s.yearPct > 0 ? "+" : ""}
                                    {s.yearPct.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-bold border-l border-slate-50 ${s.inception >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                <div className="flex flex-col">
                                  <span>{formatCurrency(s.inception)}</span>
                                  <span className="text-[10px] opacity-80 font-normal">
                                    {s.inceptionPct > 0 ? "+" : ""}
                                    {s.inceptionPct.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. Liquidez */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                  Análise de Liquidez (Estimada)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-3">
                    {overviewData.report.liquidityData.map((l: any) => (
                      <div key={l.term} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-600">{l.term}</span>
                          <span className="text-slate-800">
                            {formatCurrency(l.value)} ({l.percent.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${l.percent}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-600 italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                    A liquidez é estimada com base na classe do ativo. Renda
                    Variável e FIIs são considerados D+2 a D+5. Títulos Públicos
                    e Renda Fixa com carência são considerados longo prazo
                    (&gt;180 dias) para fins de disponibilidade imediata, exceto
                    reserva de emergência.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showDetailedReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[350px]">
                <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <AreaChartIcon size={16} className="text-blue-500" />{" "}
                  Evolução Patrimonial
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overviewData.chartData}>
                    <defs>
                      <linearGradient
                        id="colorMarket"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorInvested"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#94a3b8"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="95%"
                          stopColor="#94a3b8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickFormatter={(val) => `R$${val / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      }}
                      formatter={(val: number) => formatCurrency(val)}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="market"
                      name="Patrimônio (Mercado)"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorMarket)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="invested"
                      name="Custo Investido"
                      stroke="#94a3b8"
                      fillOpacity={1}
                      fill="url(#colorInvested)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Area
                      type="monotone"
                      dataKey="cashFlow"
                      name="Fluxo de Caixa (Aportes Líquidos)"
                      stroke="#10b981"
                      fill="none"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[350px]">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" />{" "}
                    Rentabilidade Acumulada (TWR vs Benchmarks)
                  </h3>
                  <div className="flex gap-3 text-[10px] font-bold">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('cdiAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('cdiAccum') ? prev.filter(x => x !== 'cdiAccum') : [...prev, 'cdiAccum'])} className="accent-slate-700" />
                      CDI
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('ipcaAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('ipcaAccum') ? prev.filter(x => x !== 'ipcaAccum') : [...prev, 'ipcaAccum'])} className="accent-rose-500" />
                      IPCA
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('ibovAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('ibovAccum') ? prev.filter(x => x !== 'ibovAccum') : [...prev, 'ibovAccum'])} className="accent-blue-500" />
                      IBOV
                    </label>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewData.chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} unit="%" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      }}
                      formatter={(val: number) => `${val.toFixed(2)}%`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="twrAccum"
                      name="Carteira (TWR)"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 0 }}
                      activeDot={{ r: 6 }}
                    />
                    {selectedBenchmarks.includes('cdiAccum') && (
                      <Line
                        type="monotone"
                        dataKey="cdiAccum"
                        name="CDI Acumulado"
                        stroke="#334155"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}
                    {selectedBenchmarks.includes('ipcaAccum') && (
                      <Line
                        type="monotone"
                        dataKey="ipcaAccum"
                        name="IPCA Acumulado"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}
                    {selectedBenchmarks.includes('ibovAccum') && (
                      <Line
                        type="monotone"
                        dataKey="ibovAccum"
                        name="IBOV Acumulado"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ... (Table code remains similar) ... */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center overflow-visible">
              <h3 className="text-xs font-bold text-slate-700 uppercase">
                Histórico Mensal Detalhado
              </h3>
              <div className="relative">
                <button
                  onClick={() => setShowSyncOptions(!showSyncOptions)}
                  disabled={isSyncingHistory}
                  className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-xl text-[10px] font-bold border border-blue-100 hover:bg-blue-100 disabled:opacity-50 transition-all"
                >
                  {isSyncingHistory ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <RefreshCw size={10} />
                  )}
                  {syncHistoryStatus || "Sincronizar Histórico (Sheets)"}
                </button>

                {showSyncOptions && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100">
                    <button
                      onClick={() => handleSyncHistory("current_month")}
                      className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <div className="font-bold">Apenas Mês Atual</div>
                      <div className="text-slate-500 mt-0.5">Sincroniza apenas ativos na carteira hoje</div>
                    </button>
                    <button
                      onClick={() => handleSyncHistory("all")}
                      className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <div className="font-bold">Todo o Histórico</div>
                      <div className="text-slate-500 mt-0.5">Sincroniza todos os ativos já negociados</div>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-gray-900 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-50 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">
                      Mês/Ano
                    </th>
                    <th
                      className="px-4 py-3 text-right text-blue-600"
                      title="Aportes e retiradas líquidas apenas neste mês"
                    >
                      Fluxo Cx Mês
                    </th>
                    <th
                      className="px-4 py-3 text-right text-gray-600"
                      title="Custo total histórico (cumulativo) da carteira neste mês"
                    >
                      Custo Total (Investido)
                    </th>
                    <th className="px-4 py-3 text-right">Mercado</th>
                    <th className="px-4 py-3 text-right text-emerald-600">
                      Proventos
                    </th>
                    <th className="px-4 py-3 text-right">Lucro (Total)</th>
                    <th
                      className="px-4 py-3 text-right bg-emerald-50/50 text-emerald-700"
                      title="Time-Weighted Return: Isola o efeito dos aportes."
                    >
                      <div className="flex items-center justify-end gap-1">
                        TWR Mensal{" "}
                        <Info
                          size={10}
                          className="text-emerald-600 cursor-help"
                        />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right bg-emerald-50/50 text-emerald-700"
                      title="Time-Weighted Return: Isola o efeito dos aportes."
                    >
                      <div className="flex items-center justify-end gap-1">
                        TWR Acum.{" "}
                        <Info
                          size={10}
                          className="text-emerald-600 cursor-help"
                        />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right bg-blue-50 dark:bg-blue-950/60/50 text-blue-700 dark:text-blue-300"
                      title="Taxa Interna de Retorno: Considera o tamanho e a data dos aportes."
                    >
                      <div className="flex items-center justify-end gap-1">
                        XTIR a.m.{" "}
                        <Info
                          size={10}
                          className="text-blue-600 cursor-help"
                        />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right bg-blue-50 dark:bg-blue-950/60/50 text-blue-700 dark:text-blue-300"
                      title="Taxa Interna de Retorno: Considera o tamanho e a data dos aportes."
                    >
                      <div className="flex items-center justify-end gap-1">
                        XTIR a.a.{" "}
                        <Info
                          size={10}
                          className="text-blue-600 cursor-help"
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {overviewData.tableData.map((row: any, idx: number) => {
                    const isExpanded = expandedTickerHistory === row.date;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() =>
                            setExpandedTickerHistory(
                              isExpanded ? null : row.date,
                            )
                          }
                        >
                          <td className="px-4 py-2.5 font-bold text-slate-700 sticky left-0 bg-white dark:bg-zinc-900 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronUp size={12} className="text-gray-600" />
                            ) : (
                              <ChevronDown
                                size={12}
                                className="text-gray-600"
                              />
                            )}
                            {row.date}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-medium ${row.flow > 0 ? "text-blue-600" : row.flow < 0 ? "text-rose-500" : "text-gray-700"}`}
                          >
                            {row.flow !== 0 ? formatCurrency(row.flow) : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-900">
                            {formatCurrency(row.invested)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                            {formatCurrency(row.market)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-emerald-600">
                            {row.dividends > 0
                              ? formatCurrency(row.dividends)
                              : "-"}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-medium ${row.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {formatCurrency(row.totalProfit)}
                            <span className="text-[10px] ml-1.5 opacity-70 font-bold">
                              (
                              {row.invested > 0
                                ? (
                                    (row.totalProfit / row.invested) *
                                    100
                                  ).toFixed(2)
                                : "0.00"}
                              %)
                            </span>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${row.twrMonthly >= 0 ? "text-emerald-600" : "text-rose-600"} bg-emerald-50/10`}
                          >
                            {row.twrMonthly.toFixed(2)}%
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${row.twrAccum >= 0 ? "text-emerald-600" : "text-rose-600"} bg-emerald-50/10`}
                          >
                            {row.twrAccum.toFixed(2)}%
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${row.xtirMonthly >= 0 ? "text-blue-600" : "text-rose-600"} bg-blue-50 dark:bg-blue-950/60/10`}
                          >
                            {row.xtirMonthly.toFixed(2)}%
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${row.xtirAnnual >= 0 ? "text-blue-600" : "text-rose-600"} bg-blue-50 dark:bg-blue-950/60/10`}
                          >
                            {row.xtirAnnual.toFixed(2)}%
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/50 animate-in slide-in-from-top-2">
                            <td colSpan={10} className="p-4">
                              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 p-3 shadow-sm">
                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-2">
                                  Detalhamento de Ativos em {row.date}
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[10px]">
                                    <thead className="text-gray-600 border-b border-slate-100">
                                      <tr>
                                        <th className="text-left py-1">
                                          Ativo
                                        </th>
                                        <th className="text-right py-1">
                                          Qtd Início
                                        </th>
                                        <th className="text-right py-1">
                                          Compras
                                        </th>
                                        <th className="text-right py-1">
                                          Vendas
                                        </th>
                                        {row.assetDetails?.some(
                                          (d: any) =>
                                            Math.abs(d.eventsQty || 0) >
                                            0.000001,
                                        ) && (
                                          <th className="text-right py-1 text-amber-600">
                                            Eventos (Qtd)
                                          </th>
                                        )}
                                        <th className="text-right py-1">
                                          Qtd Fim
                                        </th>
                                        <th className="text-right py-1">
                                          Preço Médio
                                        </th>
                                        <th
                                          className="text-right py-1"
                                          title="Custo total acumulado de todas as compras menos vendas até o final deste mês"
                                        >
                                          Custo Total (Investido)
                                        </th>
                                        <th className="text-right py-1">
                                          Cotação Fim
                                        </th>
                                        <th className="text-right py-1">
                                          Realizado
                                        </th>
                                        <th className="text-right py-1">
                                          Lucro Mês
                                        </th>
                                        <th
                                          className="text-right py-1"
                                          title="Time-Weighted Return: Isola o efeito do tamanho e data dos aportes no mês, refletindo a variação intrínseca do ativo."
                                        >
                                          <div className="flex items-center justify-end gap-1">
                                            TWR Mês{" "}
                                            <Info
                                              size={10}
                                              className="text-gray-400 cursor-help"
                                            />
                                          </div>
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {row.assetDetails
                                        ?.filter(
                                          (d: any) =>
                                            d.qtyStart > 0 ||
                                            d.purchasesQty > 0 ||
                                            d.salesQty > 0 ||
                                            d.quantity > 0,
                                        )
                                        .map((item: any, i: number) => (
                                          <tr key={i}>
                                            <td className="py-1 font-bold text-slate-700">
                                              {item.ticker}
                                            </td>
                                            <td className="py-1 text-right text-gray-900">
                                              {(
                                                item.qtyStart || 0
                                              ).toLocaleString("pt-BR", {
                                                maximumFractionDigits: 4,
                                              })}
                                            </td>
                                            <td className="py-1 text-right text-gray-900">
                                              {item.purchasesQty > 0
                                                ? `+${(item.purchasesQty || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`
                                                : "-"}
                                            </td>
                                            <td className="py-1 text-right text-rose-500">
                                              {item.salesQty > 0
                                                ? `-${(item.salesQty || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`
                                                : "-"}
                                            </td>
                                            {row.assetDetails?.some(
                                              (d: any) =>
                                                Math.abs(d.eventsQty || 0) >
                                                0.000001,
                                            ) && (
                                              <td className="py-1 text-right text-amber-600 font-medium">
                                                {Math.abs(item.eventsQty || 0) >
                                                0.000001
                                                  ? `${item.eventsQty > 0 ? "+" : ""}${(item.eventsQty || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`
                                                  : "-"}
                                              </td>
                                            )}
                                            <td className="py-1 text-right text-gray-900">
                                              {(
                                                item.quantity || 0
                                              ).toLocaleString("pt-BR", {
                                                maximumFractionDigits: 4,
                                              })}
                                            </td>
                                            <td className="py-1 text-right text-gray-900">
                                              {formatCurrency(item.avgPrice)}
                                            </td>
                                            <td className="py-1 text-right text-gray-900 font-medium">
                                              {formatCurrency(item.invested)}
                                            </td>
                                            <td className="py-1 text-right text-gray-900">
                                              {formatCurrency(item.priceEnd)}
                                            </td>
                                            <td
                                              className={`py-1 text-right font-bold ${item.realized >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                            >
                                              {item.realized !== 0
                                                ? formatCurrency(item.realized)
                                                : "-"}
                                            </td>
                                            <td
                                              className={`py-1 text-right font-bold ${item.gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                            >
                                              {formatCurrency(item.gain || 0)}
                                              <span className="text-[10px] ml-1.5 opacity-70">
                                                (
                                                {item.invested > 0
                                                  ? (
                                                      (item.gain /
                                                        item.invested) *
                                                      100
                                                    ).toFixed(2)
                                                  : "0.00"}
                                                %)
                                              </span>
                                            </td>
                                            <td
                                              className={`py-1 text-right font-bold ${item.twr >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                            >
                                              {(item.twr || 0).toFixed(2)}%
                                            </td>
                                          </tr>
                                        ))}
                                      {!row.assetDetails?.some(
                                        (d: any) =>
                                          d.qtyStart > 0 ||
                                          d.purchasesQty > 0 ||
                                          d.salesQty > 0 ||
                                          d.quantity > 0,
                                      ) && (
                                        <tr>
                                          <td
                                            colSpan={
                                              row.assetDetails?.some(
                                                (d: any) =>
                                                  Math.abs(d.eventsQty || 0) >
                                                  0.000001,
                                              )
                                                ? 12
                                                : 11
                                            }
                                            className="py-2 text-center text-gray-600 italic"
                                          >
                                            Nenhum dado encontrado para este
                                            mês.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ... (Rest of Tabs: portfolio, history, proventos, tax - same content, just keeping the structure) */}
      {activeTab === "portfolio" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {classSummary.map((cls) => {
              const totalProfitPct =
                cls.invested > 0 ? (cls.totalProfit / cls.invested) * 100 : 0;
              const dailyProfitPct =
                cls.market - cls.dailyProfit > 0
                  ? (cls.dailyProfit / (cls.market - cls.dailyProfit)) * 100
                  : 0;
              const share =
                (cls.market / portfolioData.summary.marketValue) * 100;
              const isExpanded = expandedClass === cls.name;
              const subcats = Object.values(
                cls.subcategories as Record<
                  string,
                  {
                    name: string;
                    value: number;
                    invested: number;
                    dailyProfit: number;
                    totalProfit: number;
                  }
                >,
              ).sort((a: any, b: any) => b.value - a.value);
              return (
                <div
                  key={cls.name}
                  onClick={() => setExpandedClass(isExpanded ? null : cls.name)}
                  className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm transition-all cursor-pointer ${isExpanded ? "border-blue-300 dark:border-blue-500/50 ring-4 ring-blue-500/10 dark:ring-blue-500/20" : "border-zinc-200/80 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md dark:shadow-none"}`}
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate pr-2 flex items-center gap-1">
                      {cls.name}
                      {isExpanded ? (
                        <ChevronUp size={12} className="text-zinc-400 dark:text-zinc-500" />
                      ) : (
                        <ChevronDown size={12} className="text-zinc-400 dark:text-zinc-500" />
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {formatCurrency(cls.market)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1 py-0.5 rounded-sm ${cls.dailyProfit >= 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10"}`}
                      >
                        {cls.dailyProfit >= 0 ? "+" : ""}
                        {dailyProfitPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-1000"
                        style={{ width: `${share}%` }}
                      ></div>
                    </div>
                    {isExpanded ? (
                      <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 animate-in slide-in-from-top-2">
                        {subcats.map((sub: any) => {
                          const subTotalProfitPct =
                            sub.invested > 0
                              ? (sub.totalProfit / sub.invested) * 100
                              : 0;
                          const subDailyProfitPct =
                            sub.value - sub.dailyProfit > 0
                              ? (sub.dailyProfit /
                                  (sub.value - sub.dailyProfit)) *
                                100
                              : 0;
                          return (
                            <div
                              key={sub.name}
                              className="flex flex-col gap-1 bg-zinc-50 dark:bg-zinc-800/30 p-2 rounded-lg"
                            >
                              <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate pr-2">
                                  {sub.name}
                               </span>
                                <span className="text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                                  {formatCurrency(sub.value)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] font-medium">
                                <span
                                  className={
                                    sub.dailyProfit >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  Dia: {formatCurrency(sub.dailyProfit)} (
                                  {subDailyProfitPct >= 0 ? "+" : ""}
                                  {subDailyProfitPct.toFixed(2)}%)
                                </span>
                                <span
                                  className={
                                    sub.totalProfit >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  Total: {formatCurrency(sub.totalProfit)} (
                                  {subTotalProfitPct >= 0 ? "+" : ""}
                                  {subTotalProfitPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-between text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="flex gap-1">
                          Dia:{" "}
                          <span
                            className={
                              cls.dailyProfit >= 0
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-rose-600 dark:text-rose-400 font-bold"
                            }
                          >
                            {cls.dailyProfit >= 0 ? "+" : ""}
                            {dailyProfitPct.toFixed(2)}%
                          </span>
                        </span>
                        <span>{cls.count} ativos</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-3 justify-between items-center">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-xs uppercase flex items-center gap-2 tracking-wider">
                <LayoutList size={14} className="text-blue-500" /> Posição
                Detalhada
              </h3>
              <div className="flex items-center gap-2">
                
                {syncStatus && (
                  <span className="text-[10px] font-bold text-blue-600 animate-pulse bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded">
                    {syncStatus}
                  </span>
                )}
                <button
                  onClick={handleUpdatePrices}
                  disabled={loadingOnline}
                  className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-xl text-[10px] font-bold border border-blue-100 hover:bg-blue-100 disabled:opacity-50 transition-all"
                >
                  {loadingOnline ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <RefreshCw size={10} />
                  )}{" "}
                  Sincronizar Cotações
                </button>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[11px] text-left table-fixed min-w-[1000px]">
                <thead className="bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 font-bold uppercase text-[10px] border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 w-[18%]">Ativo / Empresa</th>
                    <th className="px-3 py-3 w-[8%] text-right">Quantidade</th>
                    <th
                      className="px-3 py-3 w-[10%] text-right"
                      title="PM Fiscal (IR - Inclui Taxas) / PM Ajustado (Rentabilidade - Abate Proventos)"
                    >
                      Preço Médio (F/A)
                    </th>
                    <th className="px-3 py-3 w-[10%] text-right">
                      Valor Investido
                    </th>
                    <th className="px-3 py-3 w-[10%] text-right">
                      Cotação Atual
                    </th>
                    <th className="px-3 py-3 w-[10%] text-right">
                      Total Atual
                    </th>
                    <th className="px-3 py-3 w-[12%] text-right">
                      Proventos (YoC)
                    </th>
                    <th className="px-3 py-3 w-[13%] text-right">
                      Resultado Total
                    </th>
                    <th className="px-3 py-3 w-[9%] text-right">XTIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(groupedPositions).map(([catName, assets]) => {
                    // ... (Table rows rendering logic)
                    const subGroups = (assets as PortfolioItem[]).reduce(
                      (acc, item) => {
                        const sub = item.subCategory || "Geral";
                        if (!acc[sub]) acc[sub] = [];
                        acc[sub].push(item);
                        return acc;
                      },
                      {} as Record<string, PortfolioItem[]>,
                    );

                    return (
                      <React.Fragment key={catName}>
                        <tr className="bg-zinc-100/50 dark:bg-zinc-800/50">
                          <td
                            colSpan={9}
                            className="px-4 py-1.5 font-bold text-zinc-600 dark:text-zinc-400 uppercase text-[10px] tracking-widest border-b border-zinc-100 dark:border-zinc-800"
                          >
                            {catName}
                          </td>
                        </tr>
                        {Object.entries(subGroups).map(
                          ([subName, subAssets]: [string, PortfolioItem[]]) => (
                            <React.Fragment key={subName}>
                              {subName !== "Geral" && (
                                <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                                  <td
                                    colSpan={9}
                                    className="px-4 py-2 border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/20"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Layers
                                        size={12}
                                        className="text-blue-500"
                                      />
                                      <span className="font-bold text-blue-900 dark:text-blue-300 text-[10px] uppercase tracking-wider">
                                        {subName}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {subAssets
                                .filter((a) =>
                                  a.ticker.includes(
                                    portfolioSearchTerm.toUpperCase(),
                                  ),
                                )
                                .map((item) => {
                                  // Use historicalCost for YoC to reflect yield on original capital remaining
                                  const costBasis = getYoCCostBasis(item.historicalCost, item.totalCost);
                                  const yocAnual = calculateYoC(item.totalProventos12m, costBasis);

                                  return (
                                    <tr
                                      key={item.ticker}
                                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                    >
                                      {/* ... (Row content) ... */}
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
                                            <img
                                              src={getAssetIcon(
                                                item.ticker,
                                                item.category,
                                              )}
                                              alt=""
                                              className="w-full h-full object-contain"
                                              onError={(e) => {
                                                e.currentTarget.style.display =
                                                  "none";
                                              }}
                                            />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <p
                                                className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-none mb-0.5 truncate"
                                                title={item.ticker}
                                              >
                                                {item.ticker}
                                              </p>
                                              {item.yieldRate ? (
                                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 rounded font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-0.5">
                                                  <Calculator size={8} />{" "}
                                                  {item.isFixedIncome
                                                    ? "CDI"
                                                    : "Calc"}
                                                </span>
                                              ) : (
                                                <button
                                                  onClick={() =>
                                                    handleSingleUpdate(
                                                      item.ticker,
                                                    )
                                                  }
                                                  className="text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Atualizar Cotação Individual"
                                                >
                                                  <RefreshCw size={10} />
                                                </button>
                                              )}
                                            </div>
                                            <p
                                              className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-tight font-medium"
                                              title={item.longName}
                                            >
                                              {item.longName}
                                            </p>
                                            {item.yieldRate && (
                                              <span
                                                className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-700 inline-block mt-0.5"
                                                title="Rentabilidade Contratada"
                                              >
                                                {item.yieldRate}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-600 dark:text-zinc-400">
                                        {item.isFixedIncome &&
                                        !item.ticker.startsWith("TD:") &&
                                        !item.ticker.startsWith("TESOURO")
                                          ? "-"
                                          : (item.quantity || 0).toLocaleString(
                                              "pt-BR",
                                              { maximumFractionDigits: 6 },
                                            )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        {item.isFixedIncome &&
                                        !item.ticker.startsWith("TD:") &&
                                        !item.ticker.startsWith("TESOURO") ? (
                                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                                            N/A
                                          </span>
                                        ) : (
                                          <>
                                            <div
                                              className="font-semibold text-zinc-700 dark:text-zinc-300"
                                              title="PM Fiscal (Para IR)"
                                            >
                                              {formatCurrency(
                                                item.avgPriceFiscal,
                                              )}
                                            </div>
                                            <div
                                              className="text-[10px] text-blue-500 font-bold"
                                              title="Preço Médio Ajustado (Custo - Proventos) / Qtd"
                                            >
                                              Aj:{" "}
                                              {formatCurrency(
                                                item.avgPriceYield,
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-medium text-zinc-600 dark:text-zinc-400">
                                        {formatCurrency(item.totalCost)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        <>
                                          <div className="font-bold text-zinc-800 dark:text-zinc-200">
                                            {formatCurrency(
                                              item.currentQuote,
                                              item.currency,
                                            )}
                                          </div>
                                          <div
                                            className={`text-[10px] font-bold ${item.dailyChangePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                          >
                                            {item.dailyChangePercent > 0
                                              ? "+"
                                              : ""}
                                            {item.dailyChangePercent.toFixed(2)}
                                            %
                                          </div>
                                        </>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50/20 dark:bg-zinc-800/20">
                                        {formatCurrency(item.currentTotal)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        <div
                                          className="font-bold text-blue-600"
                                          title="Total Acumulado na História"
                                        >
                                          {formatCurrency(item.totalProventos)}
                                        </div>
                                        <div
                                          className="text-[10px] font-bold text-blue-600"
                                          title="YoC Anualizado (Rendimentos dos últimos 12 meses / Custo Original)"
                                        >
                                          YoC: {yocAnual.toFixed(2)}%
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        <div
                                          className={`font-bold text-xs ${item.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                        >
                                          {item.totalReturnPct.toFixed(2)}%
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-bold">
                                          {item.totalProfit >= 0 ? "+" : ""}
                                          {formatCurrency(item.totalProfit)}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.xtir >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                                        >
                                          {item.xtir >= 0 ? "+" : ""}
                                          {item.xtir.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          ),
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        // ... (history tab content same as before, see Investments.tsx in file tree)
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                  <History size={14} /> Histórico de Operações
                </h3>
                <div className="flex bg-slate-200 p-1 rounded-xl">
                  <button
                    onClick={() => setHistoryViewMode("grouped")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${historyViewMode === "grouped" ? "bg-white dark:bg-zinc-900 shadow text-blue-600" : "text-gray-900 hover:text-slate-700"}`}
                  >
                    Agrupado
                  </button>
                  <button
                    onClick={() => setHistoryViewMode("operations")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${historyViewMode === "operations" ? "bg-white dark:bg-zinc-900 shadow text-blue-600" : "text-gray-900 hover:text-slate-700"}`}
                  >
                    <Briefcase size={10} /> Operações
                  </button>
                  <button
                    onClick={() => setHistoryViewMode("dividends")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${historyViewMode === "dividends" ? "bg-white dark:bg-zinc-900 shadow text-blue-600" : "text-gray-900 hover:text-slate-700"}`}
                  >
                    <Gift size={10} /> Proventos
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={historyFilterCategory}
                  onChange={(e) => setHistoryFilterCategory(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px] truncate"
                >
                  <option value="">Todas Categorias</option>
                  {categories
                    .filter((c) => c.type === TransactionType.INVESTMENT)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  value={historyFilterSubCategory}
                  onChange={(e) => setHistoryFilterSubCategory(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px] truncate"
                >
                  <option value="">Todas Subcategorias</option>
                  {subCategories
                    .filter((s) => {
                      const isInvestment =
                        categories.find((c) => c.id === s.categoryId)?.type ===
                        TransactionType.INVESTMENT;
                      return (
                        isInvestment &&
                        (!historyFilterCategory ||
                          s.categoryId === historyFilterCategory)
                      );
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={historyStart}
                    onChange={(e) => setHistoryStart(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600 text-[10px]">até</span>
                  <input
                    type="date"
                    value={historyEnd}
                    onChange={(e) => setHistoryEnd(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[70vh] custom-scrollbar p-2 space-y-4 pb-20">
            {historyViewMode === "grouped" &&
              Object.keys(organizedHistory)
                .sort()
                .map((catName) => (
                  <div key={catName} className="space-y-2 animate-in fade-in">
                    {/* ... Grouped View ... */}
                    <div className="sticky top-0 bg-slate-100/90 backdrop-blur-sm z-10 px-3 py-1.5 border-b border-zinc-200/60 dark:border-zinc-800/80 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold uppercase text-slate-600 tracking-widest">
                        {catName}
                      </span>
                    </div>
                    {Object.keys(organizedHistory[catName])
                      .sort()
                      .map((subName) => (
                        <div key={subName} className="pl-2 space-y-2">
                          {Object.keys(organizedHistory[catName][subName])
                            .sort()
                            .map((ticker) => {
                              const data =
                                organizedHistory[catName][subName][ticker];
                              return (
                                <div
                                  key={ticker}
                                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                >
                                  <div
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                                    onClick={() =>
                                      setExpandedTickerHistory(
                                        expandedTickerHistory === ticker
                                          ? null
                                          : ticker,
                                      )
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
                                        <img
                                          src={getAssetIcon(ticker, catName)}
                                          alt=""
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="block font-bold text-slate-800 text-sm">
                                          {ticker}
                                        </span>
                                        <div className="flex gap-2 text-[10px]">
                                          {data.trades.length > 0 && (
                                            <span className="text-gray-900 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                                              {data.trades.length} operações
                                            </span>
                                          )}
                                          {data.totalProventosValue > 0 && (
                                            <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                                              +
                                              {formatCurrency(
                                                data.totalProventosValue,
                                              )}{" "}
                                              proventos
                                            </span>
                                          )}
                                          {data.totalRealizedProfit !== 0 && (
                                            <span
                                              className={`${data.totalRealizedProfit >= 0 ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100"} px-1.5 py-0.5 rounded font-bold`}
                                            >
                                              {data.totalRealizedProfit > 0
                                                ? "+"
                                                : ""}
                                              {formatCurrency(
                                                data.totalRealizedProfit,
                                              )}{" "}
                                              L/P
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      {expandedTickerHistory === ticker ? (
                                        <ChevronUp
                                          className="text-gray-600"
                                          size={16}
                                        />
                                      ) : (
                                        <ChevronDown
                                          className="text-gray-600"
                                          size={16}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {expandedTickerHistory === ticker && (
                                    <div className="p-4 space-y-6 animate-in slide-in-from-top-2 border-t border-slate-100">
                                      {data.trades.length > 0 && (
                                        <div>
                                          <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-2 flex items-center gap-2 pb-1 border-b border-slate-50">
                                            <Briefcase size={12} /> Operações
                                          </h4>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                              <thead className="text-[10px] text-gray-600 font-bold uppercase bg-slate-50/50">
                                                <tr>
                                                  <th className="px-2 py-1">
                                                    Data
                                                  </th>
                                                  <th className="px-2 py-1">
                                                    Tipo
                                                  </th>
                                                  <th className="px-2 py-1 text-right">
                                                    Qtd
                                                  </th>
                                                  <th className="px-2 py-1 text-right">
                                                    Valor Total
                                                  </th>
                                                  <th className="px-2 py-1 text-right">
                                                    Resultado (L/P)
                                                  </th>
                                                  <th className="px-2 py-1 text-right">
                                                    Ações
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-50">
                                                {data.trades.map((t) => {
                                                  const profit =
                                                    portfolioData.profitMap[
                                                      t.id
                                                    ];
                                                  return (
                                                    <tr
                                                      key={t.id}
                                                      className="hover:bg-slate-50/50 text-slate-600"
                                                    >
                                                      <td className="px-2 py-1.5 font-mono text-[10px] text-gray-900">
                                                        {new Date(
                                                          t.date,
                                                        ).toLocaleDateString(
                                                          "pt-BR",
                                                          { timeZone: "UTC" },
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1.5">
                                                        <span
                                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${t.investmentDetails!.event === "BUY" ? "bg-emerald-100 text-emerald-700" : t.investmentDetails!.event === "SELL" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}
                                                        >
                                                          {
                                                            t.investmentDetails!
                                                              .event
                                                          }
                                                        </span>
                                                        {t.investmentDetails
                                                          ?.event ===
                                                          "TICKER_UPDATE" &&
                                                          t.investmentDetails
                                                            ?.newTicker && (
                                                            <span className="ml-2 text-[10px] text-blue-600 font-normal">
                                                              →{" "}
                                                              {
                                                                t
                                                                  .investmentDetails
                                                                  .newTicker
                                                              }
                                                            </span>
                                                          )}
                                                      </td>
                                                      <td className="px-2 py-1.5 text-right font-mono">
                                                        {
                                                          t.investmentDetails!
                                                            .quantity
                                                        }
                                                      </td>
                                                      <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                                                        {t.investmentDetails
                                                          ?.event ===
                                                        "TICKER_UPDATE"
                                                          ? "-"
                                                          : formatCurrency(
                                                              t.amount,
                                                            )}
                                                      </td>
                                                      <td className="px-2 py-1.5 text-right font-bold">
                                                        {t.investmentDetails
                                                          ?.event === "SELL" &&
                                                        profit !== undefined ? (
                                                          <span
                                                            className={
                                                              profit >= 0
                                                                ? "text-emerald-600"
                                                                : "text-rose-600"
                                                            }
                                                          >
                                                            {profit > 0
                                                              ? "+"
                                                              : ""}
                                                            {formatCurrency(
                                                              profit,
                                                            )}
                                                            <span className="text-[10px] ml-1 opacity-80">
                                                              (
                                                              {t.amount -
                                                                profit >
                                                              0
                                                                ? (
                                                                    (profit /
                                                                      (t.amount -
                                                                        profit)) *
                                                                    100
                                                                  ).toFixed(2)
                                                                : profit > 0
                                                                  ? "100.00"
                                                                  : "0.00"}
                                                              %)
                                                            </span>
                                                          </span>
                                                        ) : (
                                                          "-"
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1.5 text-right flex justify-end gap-1">
                                                        <button
                                                          onClick={() =>
                                                            onEditTransaction(t)
                                                          }
                                                          className="text-gray-600 hover:text-blue-600"
                                                        >
                                                          <Pencil size={12} />
                                                        </button>
                                                        <button
                                                          onClick={() =>
                                                            onDeleteTransaction(
                                                              t.id,
                                                            )
                                                          }
                                                          className="text-gray-600 hover:text-rose-600"
                                                        >
                                                          <Trash2 size={12} />
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}

                                      {data.proventos.length > 0 && (
                                        <div>
                                          <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-2 flex items-center justify-between pb-1 border-b border-slate-50">
                                            <span className="flex items-center gap-2">
                                              <Gift size={12} /> Proventos
                                              Recebidos
                                            </span>
                                            <span className="text-emerald-600 font-bold">
                                              {formatCurrency(
                                                data.totalProventosValue,
                                              )}
                                            </span>
                                          </h4>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                              <tbody className="divide-y divide-slate-50">
                                                {data.proventos.map((p) => (
                                                  <tr
                                                    key={p.id}
                                                    className="hover:bg-emerald-50/30 text-slate-600"
                                                  >
                                                    <td className="px-2 py-1.5 font-mono text-[10px] text-gray-900">
                                                      {new Date(
                                                        p.date,
                                                      ).toLocaleDateString(
                                                        "pt-BR",
                                                        { timeZone: "UTC" },
                                                      )}
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 text-emerald-700">
                                                        {
                                                          p.investmentDetails
                                                            ?.event
                                                        }
                                                      </span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-bold text-emerald-600">
                                                      {formatCurrency(p.amount)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right flex justify-end gap-1">
                                                      <button
                                                        onClick={() =>
                                                          onEditTransaction(p)
                                                        }
                                                        className="text-gray-600 hover:text-blue-600"
                                                      >
                                                        <Pencil size={12} />
                                                      </button>
                                                      <button
                                                        onClick={() =>
                                                          onDeleteTransaction(
                                                            p.id,
                                                          )
                                                        }
                                                        className="text-gray-600 hover:text-rose-600"
                                                      >
                                                        <Trash2 size={12} />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ))}
                  </div>
                ))}

            {historyViewMode === "operations" && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 overflow-hidden shadow-sm animate-in fade-in">
                {/* ... Operations Table (Flat) ... */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wide">
                  <Briefcase size={14} /> Lista de Operações
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-gray-900 border-b border-zinc-200/60 dark:border-zinc-800/80">
                      <tr>
                        <th className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={
                              selectedIds.length > 0 &&
                              selectedIds.length ===
                                historyOperationsList.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(
                                  historyOperationsList.map((tx) => tx.id),
                                );
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Ativo</th>
                        <th className="px-4 py-3 text-center">Operação</th>
                        <th className="px-4 py-3 text-right">Qtd</th>
                        <th className="px-4 py-3 text-right">Preço</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        let currentMonth = "";
                        return historyOperationsList.map((t) => {
                          const dateObj = new Date(t.date);
                          const monthKey = dateObj
                            .toLocaleDateString("pt-BR", {
                              month: "long",
                              year: "numeric",
                              timeZone: "UTC",
                            })
                            .toUpperCase();
                          const showSeparator = monthKey !== currentMonth;
                          if (showSeparator) currentMonth = monthKey;

                          const isSell = t.investmentDetails?.event === "SELL";
                          const profit = isSell
                            ? portfolioData.profitMap[t.id] || 0
                            : 0;
                          const cost = t.amount - profit;
                          const profitPercent =
                            cost > 0 ? (profit / cost) * 100 : 0;

                          return (
                            <React.Fragment key={t.id}>
                              {showSeparator && (
                                <tr className="bg-slate-100/50">
                                  <td
                                    colSpan={8}
                                    className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-y border-zinc-200/60 dark:border-zinc-800/80"
                                  >
                                    {monthKey}
                                  </td>
                                </tr>
                              )}
                              <tr
                                className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(t.id) ? "bg-blue-50 dark:bg-blue-950/60/50" : ""}`}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(t.id)}
                                    onChange={() => handleToggleSelect(t.id)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-[10px] text-gray-900">
                                  {dateObj.toLocaleDateString("pt-BR", {
                                    timeZone: "UTC",
                                  })}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-700">
                                  {t.investmentDetails?.ticker}
                                  {t.investmentDetails?.event ===
                                    "TICKER_UPDATE" &&
                                    t.investmentDetails?.newTicker && (
                                      <span className="ml-2 text-[10px] text-blue-600 font-normal">
                                        → {t.investmentDetails.newTicker}
                                      </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${t.investmentDetails!.event === "BUY" ? "bg-emerald-100 text-emerald-700" : t.investmentDetails!.event === "SELL" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}
                                  >
                                    {t.investmentDetails!.event}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono">
                                  {t.investmentDetails?.quantity}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-gray-900">
                                  {t.investmentDetails?.event ===
                                  "TICKER_UPDATE"
                                    ? "-"
                                    : formatCurrency(
                                        t.investmentDetails?.price || 0,
                                      )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="font-bold text-slate-700">
                                    {t.investmentDetails?.event ===
                                    "TICKER_UPDATE"
                                      ? "-"
                                      : formatCurrency(t.amount)}
                                  </div>
                                  {isSell && (
                                    <div
                                      className={`text-[10px] font-bold mt-0.5 ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                    >
                                      {profit >= 0 ? "+" : ""}
                                      {formatCurrency(profit)} (
                                      {profitPercent >= 0 ? "+" : ""}
                                      {profitPercent.toFixed(2)}%)
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                  <button
                                    onClick={() => onEditTransaction(t)}
                                    className="text-gray-600 hover:text-blue-600"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => onDeleteTransaction(t.id)}
                                    className="text-gray-600 hover:text-rose-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })()}
                      {historyOperationsList.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-8 text-center text-gray-600 italic"
                          >
                            Nenhuma operação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {historyViewMode === "dividends" && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 overflow-hidden shadow-sm animate-in fade-in">
                {/* ... Dividends Table (Flat) ... */}
                <div className="p-3 border-b border-slate-100 bg-emerald-50/30 flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  <Gift size={14} /> Lista de Proventos
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-gray-900 border-b border-zinc-200/60 dark:border-zinc-800/80">
                      <tr>
                        <th className="px-4 py-3">Data Pagamento</th>
                        <th className="px-4 py-3">Ativo</th>
                        <th className="px-4 py-3 text-center">Tipo</th>
                        <th className="px-4 py-3 text-right">Valor Líquido</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyDividendsList.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-[10px] text-gray-900">
                            {new Date(t.date).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            })}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {t.investmentDetails?.ticker}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 text-emerald-700">
                              {t.investmentDetails?.event}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <button
                              onClick={() => onEditTransaction(t)}
                              className="text-gray-600 hover:text-blue-600"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteTransaction(t.id)}
                              className="text-gray-600 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {historyDividendsList.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-gray-600 italic"
                          >
                            Nenhum provento encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "proventos" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                Total Recebido (Histórico)
              </span>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(filteredProventosSummary.total)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                Média Mensal (12m)
              </span>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(filteredProventosSummary.total12m / 12)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                Yield on Cost (Global)
              </span>
              <div className="text-2xl font-bold text-blue-600">
                {calculateYoC(filteredProventosSummary.total12m, filteredProventosSummary.investedValue).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[350px]">
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-emerald-500" /> Evolução
                Mensal
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proventosChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `R$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-[350px] overflow-hidden flex flex-col">
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                <Target size={14} className="text-blue-500" /> Top 10
                Pagadoras
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {topPayers.map((item, idx) => {
                  const maxVal = topPayers[0]?.value || 1;
                  const percent = (item.value / maxVal) * 100;
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>
                          {idx + 1}. {item.name}
                        </span>
                        <span>{formatCurrency(item.value)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-50 dark:bg-blue-950/600 rounded-full"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => onOpenDividendForm()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2 text-xs"
            >
              <Plus size={14} /> Novo Provento
            </button>
            <button
              onClick={() => setIsDivBulkOpen(true)}
              className="bg-white dark:bg-zinc-900 text-slate-600 border border-zinc-200/60 dark:border-zinc-800/80 px-4 py-2 rounded-xl font-bold hover:bg-slate-50 shadow-sm flex items-center gap-2 text-xs"
            >
              <Upload size={14} /> Importar CSV
            </button>
            <button
              onClick={() => setIsAiRadarOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md flex items-center gap-2 text-xs"
            >
              <Sparkles size={14} /> Radar IA
            </button>
          </div>

          {/* Monthly Table with Filters */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-emerald-50/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wide">
                <Gift size={14} /> Histórico Detalhado
              </div>
              <div className="flex gap-2">
                
                <select
                  value={proventosYearFilter}
                  onChange={(e) => setProventosYearFilter(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Todos os Anos</option>
                  {Array.from(
                    new Set(
                      investmentTransactions.map((t) => t.date.slice(0, 4)),
                    ),
                  )
                    .sort()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
                
              </div>
            </div>

            <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
              {monthlyDividendsTable.map((group) => (
                <div
                  key={group.date}
                  className="border-b border-slate-100 last:border-0"
                >
                  <div className="bg-slate-50 px-4 py-2 flex justify-between items-center sticky top-0 z-10">
                    <span className="text-[10px] font-bold text-gray-900 uppercase tracking-wider">
                      {new Date(group.date + "-02").toLocaleDateString(
                        "pt-BR",
                        { month: "long", year: "numeric" },
                      )}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {formatCurrency(group.total)}
                    </span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-slate-50">
                      {group.items.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50 transition-colors group"
                        >
                          <td className="px-4 py-2 w-24 font-mono text-[10px] text-gray-600">
                            {new Date(t.date).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            })}
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-bold text-slate-700">
                              {t.investmentDetails?.ticker}
                            </div>
                            <div className="text-[10px] text-gray-600">
                              {t.investmentDetails?.event}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-emerald-600">
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="px-4 py-2 text-right w-16 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => onEditTransaction(t)}
                                className="text-gray-600 hover:text-blue-600"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => onDeleteTransaction(t.id)}
                                className="text-gray-600 hover:text-rose-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {monthlyDividendsTable.length === 0 && (
                <div className="p-8 text-center text-gray-600 italic text-xs">
                  Nenhum provento encontrado com os filtros atuais.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tax" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setTaxViewMode("darf")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${taxViewMode === "darf" ? "bg-white dark:bg-zinc-900 shadow text-rose-600" : "text-gray-900 hover:text-slate-700"}`}
              >
                <ShieldCheck size={14} /> Controle de DARF (Mensal)
              </button>
              <button
                onClick={() => setTaxViewMode("dirf")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${taxViewMode === "dirf" ? "bg-white dark:bg-zinc-900 shadow text-blue-600" : "text-gray-900 hover:text-slate-700"}`}
              >
                <FileText size={14} /> Declaração Anual (DIRF)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                Ano Base:
              </span>
              <select
                value={taxYearFilter}
                onChange={(e) => setTaxYearFilter(e.target.value)}
                className="bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from(
                  new Set(
                    investmentTransactions.map((t) => t.date.slice(0, 4)),
                  ),
                )
                  .sort()
                  .reverse()
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {taxViewMode === "darf" && (
            <div className="space-y-6 animate-in fade-in">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                    Total Vendas ({taxYearFilter})
                  </span>
                  <div className="text-2xl font-bold text-slate-800">
                    {formatCurrency(
                      monthlyTaxReport.reduce(
                        (acc, r) => acc + r.salesTotal,
                        0,
                      ),
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                    Lucro Realizado ({taxYearFilter})
                  </span>
                  <div
                    className={`text-2xl font-bold ${monthlyTaxReport.reduce((acc, r) => acc + (r.profitStocks + r.profitFIIs + r.profitEtfs + r.profitBDRs + r.profitExterior + r.profitCrypto + r.profitDayTrade), 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {formatCurrency(
                      monthlyTaxReport.reduce(
                        (acc, r) =>
                          acc +
                          (r.profitStocks +
                            r.profitFIIs +
                            r.profitEtfs +
                            r.profitBDRs +
                            r.profitExterior +
                            r.profitCrypto +
                            r.profitDayTrade),
                        0,
                      ),
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest block mb-1">
                    Imposto Estimado (DARF)
                  </span>
                  <div className="text-2xl font-bold text-rose-600">
                    {formatCurrency(
                      monthlyTaxReport.reduce((acc, r) => acc + r.taxDue, 0),
                    )}
                  </div>
                </div>
              </div>

              {/* DARF Report Table */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-rose-50/30 flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wide">
                  <ShieldCheck size={14} /> Apuração Mensal de Imposto
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-gray-900 border-b border-zinc-200/60 dark:border-zinc-800/80 text-[10px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Mês/Ano</th>
                        <th className="px-4 py-3 text-right">Vendas Totais</th>
                        <th className="px-4 py-3 text-right">Lucro Swing</th>
                        <th className="px-4 py-3 text-right">Lucro DayTrade</th>
                        <th className="px-4 py-3 text-right">Lucro FIIs</th>
                        <th className="px-4 py-3 text-right">Lucro Cripto</th>
                        <th className="px-4 py-3 text-right">Lucro Exterior</th>
                        <th className="px-4 py-3 text-right text-rose-600">
                          DARF a Pagar
                        </th>
                        <th className="px-4 py-3 text-right text-teal-600">
                          Imposto Exterior (Anual)
                        </th>
                        <th className="px-4 py-3 text-right text-gray-600">
                          Prej. Acumulado
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyTaxReport.map((r) => (
                        <React.Fragment key={r.month}>
                          <tr
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedTaxMonth === r.month ? "bg-slate-50" : ""}`}
                            onClick={() =>
                              setSelectedTaxMonth(
                                selectedTaxMonth === r.month ? null : r.month,
                              )
                            }
                          >
                            <td className="px-4 py-3 font-bold text-slate-700 flex items-center gap-2">
                              {selectedTaxMonth === r.month ? (
                                <ChevronUp size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                              {new Date(r.month + "-02")
                                .toLocaleDateString("pt-BR", {
                                  month: "short",
                                  year: "numeric",
                                })
                                .toUpperCase()}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(r.salesTotal)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold ${r.profitStocks + r.profitEtfs + r.profitBDRs >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {formatCurrency(
                                r.profitStocks + r.profitEtfs + r.profitBDRs,
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold ${r.profitDayTrade >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {formatCurrency(r.profitDayTrade)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold ${r.profitFIIs >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {formatCurrency(r.profitFIIs)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold ${r.profitCrypto >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {formatCurrency(r.profitCrypto)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold ${r.profitExterior >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {formatCurrency(r.profitExterior)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600 bg-rose-50/30">
                              {r.taxDue > 0 ? formatCurrency(r.taxDue) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-teal-600 bg-teal-50/30">
                              {r.taxExterior > 0
                                ? formatCurrency(r.taxExterior)
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600 text-[10px]">
                              <div className="flex flex-col items-end gap-0.5">
                                {r.accumulatedLossCommon < 0 && (
                                  <div
                                    title="Swing Trade"
                                    className="bg-slate-100 px-1 rounded"
                                  >
                                    S:{" "}
                                    {formatCurrency(
                                      Math.abs(r.accumulatedLossCommon),
                                    )}
                                  </div>
                                )}
                                {r.accumulatedLossDayTrade < 0 && (
                                  <div
                                    title="Day Trade"
                                    className="bg-rose-50 text-rose-600 px-1 rounded"
                                  >
                                    D:{" "}
                                    {formatCurrency(
                                      Math.abs(r.accumulatedLossDayTrade),
                                    )}
                                  </div>
                                )}
                                {r.accumulatedLossFII < 0 && (
                                  <div
                                    title="FII"
                                    className="bg-orange-50 text-orange-600 px-1 rounded"
                                  >
                                    F:{" "}
                                    {formatCurrency(
                                      Math.abs(r.accumulatedLossFII),
                                    )}
                                  </div>
                                )}
                                {r.accumulatedLossCrypto < 0 && (
                                  <div
                                    title="Cripto"
                                    className="bg-purple-50 text-purple-600 px-1 rounded"
                                  >
                                    C:{" "}
                                    {formatCurrency(
                                      Math.abs(r.accumulatedLossCrypto),
                                    )}
                                  </div>
                                )}
                                {r.accumulatedLossExterior < 0 && (
                                  <div
                                    title="Exterior"
                                    className="bg-teal-50 text-teal-600 px-1 rounded"
                                  >
                                    E:{" "}
                                    {formatCurrency(
                                      Math.abs(r.accumulatedLossExterior),
                                    )}
                                  </div>
                                )}
                                {r.accumulatedLossCommon >= 0 &&
                                  r.accumulatedLossDayTrade >= 0 &&
                                  r.accumulatedLossFII >= 0 &&
                                  r.accumulatedLossCrypto >= 0 &&
                                  r.accumulatedLossExterior >= 0 && (
                                    <span>-</span>
                                  )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              <List size={12} />
                            </td>
                          </tr>
                          {selectedTaxMonth === r.month && (
                            <tr>
                              <td colSpan={10} className="p-0">
                                <div className="bg-slate-50 p-4 border-y border-zinc-200/60 dark:border-zinc-800/80 animate-in slide-in-from-top-2">
                                  <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-2 flex items-center gap-2">
                                    <Briefcase size={12} /> Detalhe das
                                    Operações ({r.month})
                                  </h4>
                                  <table className="w-full text-xs text-left bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 overflow-hidden">
                                    <thead className="bg-slate-100 text-[10px] font-bold text-gray-900 uppercase">
                                      <tr>
                                        <th className="px-3 py-2">Data</th>
                                        <th className="px-3 py-2">Ativo</th>
                                        <th className="px-3 py-2">Tipo</th>
                                        <th className="px-3 py-2">
                                          Modalidade
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                          Valor Venda
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                          Lucro/Prejuízo
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {r.items.map((item) => (
                                        <tr
                                          key={item.transaction.id}
                                          className="hover:bg-slate-50"
                                        >
                                          <td className="px-3 py-2 font-mono text-[10px] text-gray-900">
                                            {new Date(
                                              item.transaction.date,
                                            ).toLocaleDateString("pt-BR", {
                                              timeZone: "UTC",
                                            })}
                                          </td>
                                          <td className="px-3 py-2 font-bold text-slate-700">
                                            {
                                              item.transaction.investmentDetails
                                                ?.ticker
                                            }
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.type === "FII" ? "bg-orange-100 text-orange-700" : item.type === "ETF" ? "bg-blue-100 text-blue-700" : item.type === "CRYPTO" ? "bg-purple-100 text-purple-700" : item.type === "EXTERIOR" ? "bg-teal-100 text-teal-700" : item.type === "BDR" ? "bg-blue-100 text-blue-700 dark:text-blue-300" : "bg-slate-100 text-slate-700"}`}
                                            >
                                              {item.type}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.isDayTrade ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                                            >
                                              {item.isDayTrade
                                                ? "Day Trade"
                                                : "Swing Trade"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium">
                                            {formatCurrency(
                                              item.transaction.amount,
                                            )}
                                          </td>
                                          <td
                                            className={`px-3 py-2 text-right font-bold ${item.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                          >
                                            {formatCurrency(item.profit)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {monthlyTaxReport.length === 0 && (
                        <tr>
                          <td
                            colSpan={12}
                            className="p-8 text-center text-gray-600 italic"
                          >
                            Nenhuma venda registrada no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {taxViewMode === "dirf" && (
            <div className="space-y-6 animate-in fade-in">
              {Object.entries(dirfData)
                .sort()
                .map(([groupName, items]) => (
                  <div
                    key={groupName}
                    className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden"
                  >
                    <div className="p-3 border-b border-slate-100 bg-blue-50 dark:bg-blue-950/60/30 flex items-center gap-2 text-xs font-bold text-blue-800 uppercase tracking-wide">
                      <FileText size={14} /> {groupName} - Posição em 31/12/
                      {taxYearFilter}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 font-bold text-gray-900 border-b border-zinc-200/60 dark:border-zinc-800/80 text-[10px] uppercase">
                          <tr>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">
                              Discriminação (Sugestão)
                            </th>
                            <th className="px-4 py-3 text-right">
                              Proventos Recebidos
                            </th>
                            <th className="px-4 py-3 text-right">
                              Situação em 31/12/{parseInt(taxYearFilter) - 1}
                            </th>
                            <th className="px-4 py-3 text-right">
                              Situação em 31/12/{taxYearFilter}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(items as any[])
                            .sort((a, b) => a.ticker.localeCompare(b.ticker))
                            .map((item) => (
                              <tr
                                key={item.ticker}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-4 py-3 font-bold text-slate-700 w-24">
                                  {item.ticker}
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-[10px]">
                                  {item.quantity}{" "}
                                  {item.isFixedIncome
                                    ? "unidades"
                                    : "ações/cotas"}{" "}
                                  de {item.longName || item.ticker}
                                  {item.cnpj ? ` (CNPJ: ${item.cnpj})` : ""},
                                  custo médio de{" "}
                                  {formatCurrency(item.avgPriceFiscal)},
                                  custodiado na corretora {item.broker}.
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600 w-32">
                                  {formatCurrency(item.totalProventos)}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-500 w-32">
                                  {formatCurrency(item.prevTotalCost)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-blue-700 dark:text-blue-300 w-32">
                                  {formatCurrency(item.totalCost)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              {Object.keys(dirfData).length === 0 && (
                <div className="bg-white dark:bg-zinc-900 p-12 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm text-center text-gray-600 italic text-xs">
                  Nenhuma posição encontrada para o ano de {taxYearFilter}.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals are rendered here */}
      
      {isDivBulkOpen && (
        <DividendBulkImporter
          isOpen={isDivBulkOpen}
          onClose={() => setIsDivBulkOpen(false)}
          categories={categories}
          subCategories={subCategories}
          transactions={transactions}
          onImport={handleBulkDividendImport}
        />
      )}
      {isAiRadarOpen && (
        <AiDividendRadar
          isOpen={isAiRadarOpen}
          onClose={() => setIsAiRadarOpen(false)}
          transactions={transactions}
          categories={categories}
          subCategories={subCategories}
          onImport={handleBulkDividendImport}
        />
      )}

      {selectedMonth && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="text-blue-600" size={24} />
                  Ativos em{" "}
                  {new Date(selectedMonth + "-02").toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-gray-900 font-medium mt-1">
                  Detalhamento de posição e performance mensal por ativo
                </p>
              </div>
              <button
                onClick={() => setSelectedMonth(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-gray-600 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-gray-900 font-bold uppercase text-[10px] border-b">
                    <tr>
                      <th className="px-4 py-3">Ativo</th>
                      <th className="px-4 py-3 text-right">Quantidade</th>
                      <th
                        className="px-4 py-3 text-right"
                        title="Valor no início do mês + Compras no período"
                      >
                        V. Início / Compra
                      </th>
                      <th
                        className="px-4 py-3 text-right"
                        title="Valor no último dia útil do mês"
                      >
                        V. Mercado (Fim)
                      </th>
                      <th className="px-4 py-3 text-right text-blue-600">
                        Fluxo Líq.
                      </th>
                      <th className="px-4 py-3 text-right text-emerald-600">
                        Proventos
                      </th>
                      <th
                        className="px-4 py-3 text-right bg-blue-50 dark:bg-blue-950/60/50 text-blue-700 dark:text-blue-300"
                        title="Time-Weighted Return: Isola o efeito do tamanho e data dos aportes no mês, refletindo a variação intrínseca do ativo."
                      >
                        <div className="flex items-center justify-end gap-1">
                          TWR Mensal{" "}
                          <Info
                            size={10}
                            className="text-blue-400 cursor-help"
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedMonthDetails.map((asset: any) => (
                      <tr
                        key={asset.ticker}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-white dark:bg-zinc-900 border border-slate-100 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
                              <img
                                src={getAssetIcon(asset.ticker)}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {asset.ticker}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                          {(asset.quantity || 0).toLocaleString("pt-BR", {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(asset.startValue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(asset.endValue)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${asset.netFlow > 0 ? "text-blue-600" : asset.netFlow < 0 ? "text-rose-500" : "text-gray-700"}`}
                        >
                          {asset.netFlow !== 0
                            ? formatCurrency(asset.netFlow)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {asset.dividends > 0
                            ? formatCurrency(asset.dividends)
                            : "-"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${asset.twr >= 0 ? "text-emerald-600" : "text-rose-600"} bg-blue-50 dark:bg-blue-950/60/20`}
                        >
                          {asset.twr.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                    {selectedMonthDetails.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-12 text-center text-gray-600 italic"
                        >
                          Nenhum ativo encontrado para este mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedMonth(null)}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isManualHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <History className="text-amber-600" size={24} />
                  Cotações Históricas Manuais
                </h3>
                <p className="text-xs text-gray-900 font-medium mt-1">
                  Gerencie preços de fechamento para ativos sem cotação
                  automática
                </p>
              </div>
              <button
                onClick={() => {
                  setIsManualHistoryOpen(false);
                  setSelectedTickerForHistory(null);
                  setManualPriceActionError("");
                  setBulkDeleteConfirm(false);
                  setIndividualDeleteConfirm(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-800 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {manualPriceActionError && (
                <div className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-xl border border-rose-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                  <span>{manualPriceActionError}</span>
                  <button
                    onClick={() => setManualPriceActionError("")}
                    className="p-1 hover:bg-rose-100 rounded-xl"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {!manualHistoryTab || manualHistoryTab === "single" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                      Ticker
                    </label>
                    <input
                      type="text"
                      value={selectedTickerForHistory || ""}
                      onChange={(e) => {
                        setSelectedTickerForHistory(
                          e.target.value.toUpperCase(),
                        );
                        setSelectedManualDates([]);
                        setBulkDeleteConfirm(false);
                        setIndividualDeleteConfirm(null);
                      }}
                      placeholder="Ex: PETR4"
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-4 py-2 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                      Preço (R$)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      id="new-manual-price"
                      placeholder="0,00"
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                      Data
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        id="new-manual-date"
                        defaultValue={new Date().toISOString().split("T")[0]}
                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        onClick={async () => {
                          const ticker = selectedTickerForHistory;
                          const priceVal = (
                            document.getElementById(
                              "new-manual-price",
                            ) as HTMLInputElement
                          )?.value;
                          const dateVal = (
                            document.getElementById(
                              "new-manual-date",
                            ) as HTMLInputElement
                          )?.value;
                          if (!ticker || !priceVal || !dateVal) {
                            setManualPriceActionError(
                              "Preencha todos os campos.",
                            );
                            return;
                          }
                          const priceB = parseFloat(priceVal);
                          const existingP = assetPrices.find(
                            (p) => p.ticker === ticker,
                          ) || {
                            id: ticker,
                            ticker: ticker,
                            currentPrice: priceB,
                            lastUpdated: new Date().toISOString(),
                          };
                          const hist = [...(existingP.manualHistory || [])];
                          const idx = hist.findIndex((h) => h.date === dateVal);
                          if (idx >= 0)
                            hist[idx] = { date: dateVal, price: priceB };
                          else hist.push({ date: dateVal, price: priceB });
                          hist.sort((a, b) => b.date.localeCompare(a.date));
                          await StorageService.saveAssetPrice({
                            ...existingP,
                            manualHistory: hist,
                            lastUpdated: new Date().toISOString(),
                          } as AssetPrice);
                          (
                            document.getElementById(
                              "new-manual-price",
                            ) as HTMLInputElement
                          ).value = "";
                        }}
                        className="bg-amber-600 text-white p-2 rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">
                    <Clipboard size={10} /> Cole sua lista aqui (Data e Valor
                    por linha)
                  </label>
                  <textarea
                    id="manual-bulk-input"
                    rows={5}
                    placeholder="01/01/2024 10.50&#10;02/01/2024 R$ 11,00"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={async () => {
                      const input = (
                        document.getElementById(
                          "manual-bulk-input",
                        ) as HTMLTextAreaElement
                      ).value;
                      if (!input || !selectedTickerForHistory) {
                        if (!selectedTickerForHistory)
                          setManualPriceActionError(
                            "Selecione ou digite um Ticker primeiro.",
                          );
                        return;
                      }

                      const lines = input.split("\n");
                      const newPoints: { date: string; price: number }[] = [];

                      lines.forEach((line) => {
                        const dateMatch = line.match(
                          /(\d{2})\/(\d{2})\/(\d{4})/,
                        );
                        if (dateMatch) {
                          const dateStr = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                          const rest = line.replace(dateMatch[0], "");
                          const clean = rest
                            .replace(/R\$/g, "")
                            .replace(/\s/g, "");
                          let priceB = NaN;
                          if (clean.includes(",") && clean.includes(".")) {
                            priceB = parseFloat(
                              clean.replace(/\./g, "").replace(",", "."),
                            );
                          } else if (clean.includes(",")) {
                            priceB = parseFloat(clean.replace(",", "."));
                          } else {
                            priceB = parseFloat(clean);
                          }

                          if (!isNaN(priceB)) {
                            newPoints.push({ date: dateStr, price: priceB });
                          }
                        }
                      });

                      if (newPoints.length === 0) {
                        setManualPriceActionError(
                          "Nenhum dado válido encontrado. Use o formato: DD/MM/AAAA Valor",
                        );
                        return;
                      }

                      const existingP = assetPrices.find(
                        (p) => p.ticker === selectedTickerForHistory,
                      ) || {
                        id: selectedTickerForHistory,
                        ticker: selectedTickerForHistory,
                        currentPrice: newPoints[0].price,
                        lastUpdated: new Date().toISOString(),
                      };

                      const hist = [...(existingP.manualHistory || [])];
                      newPoints.forEach((np) => {
                        const idx = hist.findIndex((h) => h.date === np.date);
                        if (idx >= 0) hist[idx] = np;
                        else hist.push(np);
                      });

                      hist.sort((a, b) => b.date.localeCompare(a.date));
                      await StorageService.saveAssetPrice({
                        ...existingP,
                        manualHistory: hist,
                        lastUpdated: new Date().toISOString(),
                      } as AssetPrice);
                      (
                        document.getElementById(
                          "manual-bulk-input",
                        ) as HTMLTextAreaElement
                      ).value = "";
                      setManualHistoryTab("single");
                    }}
                    className="w-full bg-amber-600 text-white font-bold py-2 rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 text-xs"
                  >
                    Processar e Salvar {selectedTickerForHistory || "Ativo"}
                  </button>
                </div>
              )}

              {selectedTickerForHistory && (
                <div className="space-y-4">
                  <div className="flex border-b border-slate-100 mb-2">
                    <button
                      onClick={() => {
                        setManualHistoryTab("single");
                        setManualPriceActionError("");
                        setBulkDeleteConfirm(false);
                      }}
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${!manualHistoryTab || manualHistoryTab === "single" ? "border-amber-600 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                    >
                      Individual
                    </button>
                    <button
                      onClick={() => {
                        setManualHistoryTab("bulk");
                        setManualPriceActionError("");
                        setBulkDeleteConfirm(false);
                      }}
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${manualHistoryTab === "bulk" ? "border-amber-600 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                    >
                      Colar Lista (DD/MM/AAAA R$)
                    </button>
                  </div>

                    <div className="flex flex-col gap-2 mb-4">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                          Histórico: {selectedTickerForHistory}
                        </h4>
                        {selectedManualDates.length > 0 && (
                          <div className="flex items-center gap-2">
                            {bulkDeleteConfirm ? (
                              <>
                                <button
                                  onClick={() => setBulkDeleteConfirm(false)}
                                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-200 transition-all border border-zinc-200/60 dark:border-zinc-800/80"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={async () => {
                                    const p = assetPrices.find(
                                      (ap) =>
                                        ap.ticker === selectedTickerForHistory,
                                    );
                                    if (!p) return;
                                    const filtered =
                                      p.manualHistory?.filter(
                                        (mh) =>
                                          !selectedManualDates.includes(mh.date),
                                      ) || [];
                                    await StorageService.saveAssetPrice({
                                      ...p,
                                      manualHistory: filtered,
                                      lastUpdated: new Date().toISOString(),
                                    } as AssetPrice);
                                    setSelectedManualDates([]);
                                    setBulkDeleteConfirm(false);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-rose-700 transition-all border border-rose-600 shadow-sm"
                                >
                                  Confirmar Exclusão ({selectedManualDates.length})
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setBulkDeleteConfirm(true)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold uppercase hover:bg-rose-100 transition-all border border-rose-200"
                              >
                                <Trash2 size={12} /> Excluir Selecionados (
                                {selectedManualDates.length})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {assetHistory[selectedTickerForHistory] && (
                        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/60/50 border border-blue-100 rounded-xl">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assetHistory[selectedTickerForHistory]?.adjustForSplits ?? false}
                              onChange={async (e) => {
                                await StorageService.toggleAssetHistoryAdjustment(
                                  selectedTickerForHistory,
                                  e.target.checked
                                );
                              }}
                              className="w-4 h-4 mt-0.5 text-blue-600 border-blue-300 rounded focus:ring-blue-500 transition-colors"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">
                                Preços já importados (Sheets) consideram desdobramentos?
                              </span>
                              <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                                Marque se o Google Finance retornar o preço histórico <strong className="font-bold">já ajustado</strong> pelo split (Ex: Ações BR/EUA). Desmarque se for o preço nominal não ajustado (comum em FIIs na B3).
                              </span>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  {assetPrices.find(
                    (p) => p.ticker === selectedTickerForHistory,
                  )?.manualHistory?.length ? (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-2 w-10">
                              <button
                                onClick={() => {
                                  const p = assetPrices.find(
                                    (ap) => ap.ticker === selectedTickerForHistory,
                                  );
                                  const hist = p?.manualHistory || [];
                                  if (
                                    selectedManualDates.length > 0 &&
                                    selectedManualDates.length === (hist.length || 0)
                                  ) {
                                    setSelectedManualDates([]);
                                  } else {
                                    setSelectedManualDates(
                                      hist.map((h) => h.date),
                                    );
                                  }
                                }}
                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                              >
                                {selectedManualDates.length > 0 &&
                                selectedManualDates.length ===
                                  (assetPrices.find(
                                    (p) => p.ticker === selectedTickerForHistory,
                                  )?.manualHistory?.length || 0) ? (
                                  <CheckSquare
                                    size={14}
                                    className="text-amber-600"
                                  />
                                ) : (
                                  <Square size={14} />
                                )}
                              </button>
                            </th>
                            <th className="px-4 py-2 text-left">Data</th>
                            <th className="px-4 py-2 text-left">
                              Preço Unitário
                            </th>
                            <th className="px-4 py-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {assetPrices
                            .find((p) => p.ticker === selectedTickerForHistory)
                            ?.manualHistory?.map((h) => (
                              <tr
                                key={h.date}
                                className={`hover:bg-slate-50/50 transition-colors ${selectedManualDates.includes(h.date) ? "bg-amber-50/30" : ""}`}
                              >
                                <td className="px-4 py-2">
                                  <button
                                    onClick={() => {
                                      if (selectedManualDates.includes(h.date)) {
                                        setSelectedManualDates(
                                          selectedManualDates.filter(
                                            (d) => d !== h.date,
                                          ),
                                        );
                                      } else {
                                        setSelectedManualDates([
                                          ...selectedManualDates,
                                          h.date,
                                        ]);
                                      }
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                                  >
                                    {selectedManualDates.includes(h.date) ? (
                                      <CheckSquare
                                        size={14}
                                        className="text-amber-600"
                                      />
                                    ) : (
                                      <Square size={14} />
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-2 font-medium">
                                  {new Date(
                                    h.date + "T12:00:00",
                                  ).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-4 py-2 font-bold text-slate-800">
                                  {formatCurrency(h.price)}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {individualDeleteConfirm === h.date ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() =>
                                          setIndividualDeleteConfirm(null)
                                        }
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-xl"
                                      >
                                        <X size={12} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          const p = assetPrices.find(
                                            (ap) =>
                                              ap.ticker ===
                                              selectedTickerForHistory,
                                          );
                                          if (!p) return;
                                          const filtered =
                                            p.manualHistory?.filter(
                                              (mh) => mh.date !== h.date,
                                            ) || [];
                                          await StorageService.saveAssetPrice({
                                            ...p,
                                            manualHistory: filtered,
                                            lastUpdated:
                                              new Date().toISOString(),
                                          } as AssetPrice);
                                          setSelectedManualDates(
                                            selectedManualDates.filter(
                                              (d) => d !== h.date,
                                            ),
                                          );
                                          setIndividualDeleteConfirm(null);
                                        }}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-xl"
                                      >
                                        <Check size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setIndividualDeleteConfirm(h.date)
                                      }
                                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs italic border-2 border-dashed border-slate-100 rounded-2xl">
                      Nenhuma cotação manual cadastrada para este ativo.
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest px-1 text-gray-900">
                  Ativos com Cotação Manual
                </h4>
                <div className="flex flex-wrap gap-2">
                  {assetPrices
                    .filter(
                      (p) => p.manualHistory && p.manualHistory.length > 0,
                    )
                    .map((p) => (
                      <button
                        key={p.ticker}
                        onClick={() => {
                          setSelectedTickerForHistory(p.ticker);
                          setSelectedManualDates([]);
                          setBulkDeleteConfirm(false);
                          setIndividualDeleteConfirm(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${selectedTickerForHistory === p.ticker ? "bg-amber-100 border-amber-300 text-amber-800 shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 hover:border-amber-200"}`}
                      >
                        {p.ticker} ({p.manualHistory?.length})
                      </button>
                    ))}
                  {assetPrices.filter(
                    (p) => p.manualHistory && p.manualHistory.length > 0,
                  ).length === 0 && (
                    <p className="text-[10px] text-slate-400 italic px-1">
                      Nenhum ativo com histórico manual configurado.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                <Info className="text-blue-600 shrink-0" size={18} />
                <div className="space-y-1">
                  <p className="text-[11px] text-blue-900 font-bold uppercase tracking-wider">
                    Como funciona?
                  </p>
                  <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                    Ao cadastrar preços manuais, o sistema utilizará a cotação
                    mais recente para o cálculo do patrimônio atual. Para o
                    cálculo de Rentabilidade (TWR/XTIR), o sistema considerará a
                    data da cotação manual como o fechamento do período,
                    permitindo acompanhar ativos que não possuem integração
                    automática (capital fechado, imóveis, etc).
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setIsManualHistoryOpen(false);
                  setSelectedTickerForHistory(null);
                }}
                className="px-8 py-2 bg-slate-800 text-white font-extrabold rounded-xl hover:bg-slate-900 transition-all shadow-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isBatchEditOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit3 size={20} className="text-blue-600" /> Editar{" "}
              {selectedIds.length} Itens
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1.5 flex items-center gap-1.5">
                  <TrendingUp size={12} /> Novo Ativo / Título (Opcional)
                </label>
                <input
                  type="text"
                  value={batchTargetTicker}
                  onChange={(e) =>
                    setBatchTargetTicker(e.target.value.toUpperCase())
                  }
                  className="w-full bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase placeholder:font-normal"
                  placeholder="Ex: PETR4"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Deixe em branco para manter o ativo original.
                </p>
              </div>

              <div className="h-px bg-slate-100 my-2"></div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1.5 flex items-center gap-1.5">
                  <Landmark size={12} /> Nova Corretora (Opcional)
                </label>
                <input
                  type="text"
                  value={batchTargetBroker}
                  onChange={(e) => setBatchTargetBroker(e.target.value)}
                  className="w-full bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:font-normal"
                  placeholder="Ex: XP, BTG, Itaú"
                />
              </div>

              <div className="h-px bg-slate-100 my-2"></div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1.5">
                  Nova Categoria
                </label>
                <select
                  value={batchTargetCat}
                  onChange={(e) => {
                    setBatchTargetCat(e.target.value);
                    setBatchTargetSub("");
                  }}
                  className="w-full bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {categories
                    .filter((c) => c.type === TransactionType.INVESTMENT)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1.5">
                  Nova Subcategoria
                </label>
                <select
                  value={batchTargetSub}
                  onChange={(e) => setBatchTargetSub(e.target.value)}
                  disabled={!batchTargetCat}
                  className="w-full bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Sem alteração / Nenhuma</option>
                  {filteredSubCategoriesForBatch.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsBatchEditOpen(false)}
                  className="flex-1 py-2 text-gray-900 font-bold hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBatchEdit}
                  disabled={isBatchSaving}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
                >
                  {isBatchSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 &&
        activeTab === "history" &&
        historyViewMode === "operations" && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-white dark:bg-zinc-900 text-gray-900 rounded-full shadow-2xl z-50 px-4 py-3 border border-gray-200 animate-in slide-in-from-bottom-8 ring-1 ring-black/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 dark:text-blue-300 p-2 rounded-full">
                <CheckSquare size={16} />
              </div>
              <span className="font-bold text-sm text-gray-800">
                {selectedIds.length} selecionados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBatchEditOpen(true)}
                className="bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
              >
                <Edit3 size={14} /> Editar
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-gray-400 hover:text-gray-700 p-2"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
