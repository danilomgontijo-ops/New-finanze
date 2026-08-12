import { useMemo } from 'react';
import { Transaction, AssetPrice, Category, SubCategory, TransactionType } from '../types';
import { BrapiService } from '../services/brapiService';

const calculateXIRR = (
  values: number[],
  dates: Date[],
  guess: number = 0.1,
): number => {
  if (!values || !dates || values.length < 2) return 0;
  if (values.every((v) => v >= 0) || values.every((v) => v <= 0)) return 0;

  // Combine values and dates into flow items and sort chronologically
  const flows = values
    .map((val, idx) => ({ amount: val, date: new Date(dates[idx]) }))
    .filter((f) => !isNaN(f.date.getTime()) && !isNaN(f.amount))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flows.length < 2) return 0;

  const startDate = flows[0].date;
  const endDate = flows[flows.length - 1].date;
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  // If holding period is less than 1 day, calculate simple return % instead of annualizing
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


export const toIsoDateStr = (input: string | Date | undefined): string => {
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

export const calculateRealFixedIncome = (
  principal: number,
  startDateInput: string | Date,
  rateStr: string,
  cdiData: { date: string; value: number }[],
  endDateInput?: string | Date,
  ipcaData?: { date: string; value: number }[]
): number => {
  if (!principal || principal <= 0) return 0;
  if (!rateStr || typeof rateStr !== "string") rateStr = "100% CDI";

  const startIso = toIsoDateStr(startDateInput);
  const endIso = toIsoDateStr(endDateInput);

  const upperStr = rateStr.toUpperCase().trim();
  let pctCDI = 0;
  let isCDI = false;
  let isIPCA = false;
  let fixedRate = 0;
  let ipcaSpread = 0;

  const numbers = upperStr.match(/(\d+(?:[.,]\d+)?)/g);

  // IPCA é verificado primeiro: um título "IPCA+X%" é indexado à inflação, nunca
  // deve cair no ramo de taxa prefixada nem no de %CDI.
  const hasIpcaExplicit = upperStr.includes("IPCA");

  const hasCdiExplicit =
    !hasIpcaExplicit &&
    (upperStr.includes("CDI") ||
      upperStr.includes("INTER") ||
      upperStr.includes("CDB") ||
      upperStr.includes("LCI") ||
      upperStr.includes("LCA") ||
      upperStr.includes("CRI") ||
      upperStr.includes("CRA") ||
      upperStr.includes("POUPA") ||
      upperStr.includes("DO CDI"));

  if (hasIpcaExplicit) {
    isIPCA = true;
    ipcaSpread = numbers && numbers.length > 0 ? parseFloat(numbers[0].replace(",", ".")) : 0;
  } else if (hasCdiExplicit) {
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
    if (val >= 50) {
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

    const relevantRates = cdiData.filter((d) => d.date >= startIso && d.date <= endIso);
    let accumulatedFactor = 1;
    for (const day of relevantRates) {
      const dailyFactor = 1 + (day.value / 100) * (pctCDI / 100);
      accumulatedFactor *= dailyFactor;
    }
    return principal * accumulatedFactor;
  } else if (isIPCA) {
    const relevantRates = cdiData ? cdiData.filter((d) => d.date >= startIso && d.date <= endIso) : [];
    const businessDays = relevantRates.length > 0 ? relevantRates.length : Math.ceil(Math.abs(new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) * (252 / 365);
    const years = businessDays / 252;

    // Composição da série real mensal de IPCA (BCB SGS 433) no período do título.
    const relevantIpca = ipcaData ? ipcaData.filter((d) => d.date >= startIso && d.date <= endIso) : [];
    let ipcaFactor: number;
    if (relevantIpca.length > 0) {
      ipcaFactor = relevantIpca.reduce((acc, m) => acc * (1 + m.value / 100), 1);
    } else {
      // Sem série de IPCA disponível para o período: aproxima pela inflação média histórica (~4% a.a.)
      ipcaFactor = Math.pow(1.04, years);
    }

    const spreadFactor = Math.pow(1 + ipcaSpread / 100, years);
    return principal * ipcaFactor * spreadFactor;
  } else {
    const relevantRates = cdiData ? cdiData.filter((d) => d.date >= startIso && d.date <= endIso) : [];

    const businessDays = relevantRates.length > 0 ? relevantRates.length : Math.ceil(Math.abs(new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) * (252 / 365);
    const years = businessDays / 252;
    if (fixedRate > 0) return principal * Math.pow(1 + fixedRate / 100, years);
  }
  return principal;
};

export interface PortfolioItem {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  totalCost: number;
  currentTotal: number;
  proventos: number;
  totalProventos12m: number;
  realizedProfit: number;
  yieldRate?: string;
  maturityDate?: string;
  hasDailyLiquidity?: boolean;
  category: string;
  subCategory: string;
  categoryId: string;
  subCategoryId: string;
  profit: number;
  lots: any[];
}

export const getTxAmountBrl = (t: Transaction, currentUsdRate: number = 5.5): number => {
  if (!t) return 0;
  const rawAmount = Math.abs(t.amount || 0);
  const det = t.investmentDetails;
  if (!det) return rawAmount;

  const isUsd = det.currency === 'USD';
  if (!isUsd) return rawAmount;

  const ptax = (det.ptax && det.ptax > 1) ? det.ptax : (currentUsdRate > 1 ? currentUsdRate : 5.5);

  let expectedUSD = 0;
  const gross = det.grossAmount || 0;
  const tax = det.tax || 0;
  const netUSD = gross > 0 ? (gross - tax) : 0;
  const qty = det.quantity || 0;
  const price = det.price || 0;

  if (netUSD > 0) {
    expectedUSD = netUSD;
  } else if (gross > 0) {
    expectedUSD = gross;
  } else if (qty > 0 && price > 0) {
    expectedUSD = qty * price;
  }

  if (expectedUSD > 0) {
    const expectedBRL = expectedUSD * ptax;
    const distUSD = Math.abs(rawAmount - expectedUSD);
    const distBRL = Math.abs(rawAmount - expectedBRL);

    if (distBRL < distUSD) {
      return rawAmount;
    } else {
      return rawAmount * ptax;
    }
  }

  if (ptax > 1.2 && rawAmount > 0) {
    if (rawAmount < 300) {
      return rawAmount * ptax;
    }
  }

  return rawAmount;
};

export function usePortfolioData(
  investmentTransactions: Transaction[],
  assetPrices: AssetPrice[],
  categories: Category[],
  subCategories: SubCategory[],
  cdiHistory: { date: string; value: number }[],
  ipcaHistory: { date: string; value: number }[] = []
) {
  const isNathyTransaction = (t: Transaction) => {
    const nathyCategory = categories.find(
      (c) => c.name && c.name.toLowerCase() === "nathy",
    );
    const isNathyCat = nathyCategory && t.categoryId === nathyCategory.id;
    const isNathyDesc =
      t.description && t.description.toLowerCase().includes("(parte nathy)");
    return isNathyCat || isNathyDesc;
  };

  const cleanInvestmentTxs = useMemo(() => {
    return (investmentTransactions || [])
      .filter(
        (t) =>
          t && t.type === TransactionType.INVESTMENT && !isNathyTransaction(t),
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
      });
  }, [investmentTransactions, categories]);

  return useMemo(() => {
    const usdPriceObj = assetPrices.find(
      (p) => p.ticker === "USDBRL" || p.ticker === "USD/BRL" || p.ticker === "USDBRL=X" || p.ticker === "BRL=X",
    );
    let currentUsdRate = usdPriceObj && usdPriceObj.currentPrice > 1 ? usdPriceObj.currentPrice : 0;
    if (currentUsdRate <= 1) {
      const txWithPtax = cleanInvestmentTxs.find(
        (t) => t.investmentDetails?.currency === "USD" && t.investmentDetails?.ptax && t.investmentDetails.ptax > 1,
      );
      currentUsdRate = txWithPtax?.investmentDetails?.ptax || 5.5;
    }
    const assets: Record<string, any> = {};
    const profitMap: Record<string, number> = {};
    let totalRealizedProfit = 0;

    cleanInvestmentTxs.forEach((t) => {
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
        maturityDate,
        hasDailyLiquidity,
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
          maturityDate: maturityDate || undefined,
          hasDailyLiquidity: hasDailyLiquidity !== undefined ? hasDailyLiquidity : undefined,
          earliestDate: tDate,
          lots: [], // FIFO Tracking: Array of { date: Date, q: number, cost: number, yieldRate?: string }
        };
      }
      const a = assets[ticker];
      if (maturityDate) a.maturityDate = maturityDate;
      if (hasDailyLiquidity !== undefined) a.hasDailyLiquidity = hasDailyLiquidity;
      if (tDate < a.earliestDate) a.earliestDate = tDate;

      const effectiveTxAmount = getTxAmountBrl(t, currentUsdRate);

      if (["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(event)) {
        a.totalProventos += effectiveTxAmount;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (tDate >= oneYearAgo) a.totalProventos12m += effectiveTxAmount;

        a.cashFlows.push({ date: tDate, amount: effectiveTxAmount });
      } else if (event === "AMORTIZACAO") {
        a.totalCost -= effectiveTxAmount;
        a.historicalCost -= effectiveTxAmount;
        a.cashFlows.push({ date: tDate, amount: effectiveTxAmount });
      } else if (event === "BUY") {
        a.quantity += quantity;
        a.totalCost += effectiveTxAmount;
        a.historicalCost += effectiveTxAmount;
        a.cashFlows.push({ date: tDate, amount: -effectiveTxAmount });
        // Add to FIFO Lots
        const rateForLot = yieldRate || a.yieldRate;
        a.lots.push({
          date: tDate,
          q: quantity,
          cost: effectiveTxAmount,
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
              ipcaHistory,
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
              ipcaHistory,
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

        const transactionProfit = effectiveTxAmount - costOfSold;

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

        a.cashFlows.push({ date: tDate, amount: effectiveTxAmount });
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
                  undefined,
                  ipcaHistory,
                );
                calcBal += curVal;

                const lotDateStr =
                  lot.date instanceof Date && !isNaN(lot.date.getTime())
                    ? lot.date.toISOString()
                    : String(lot.date || "");
                if (lotDateStr <= yesterdayStr) {
                  calcYesterday += calculateRealFixedIncome(
                    lot.cost,
                    lot.date,
                    rateToUse,
                    cdiHistory,
                    yesterdayStr,
                    ipcaHistory,
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
                undefined,
                ipcaHistory,
              );
              calcYesterday = calculateRealFixedIncome(
                a.totalCost,
                startDate,
                rateToUse,
                cdiHistory,
                yesterdayStr,
                ipcaHistory,
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
          // Fechamento em "hoje" (ou na data da última cotação manual, quando o preço
          // vem de lá) — nunca estendido para acomodar um fluxo de caixa futuro, senão
          // o XTIR vira uma projeção em vez do retorno até a data atual.
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
      
      
      summary.realizedProfit += a.realizedProfit;
      summary.proventosTotal += a.totalProventos;
      summary.proventos12mTotal += a.totalProventos12m;
    });

    // Consolidated Portfolio Cash Flows for Real Portfolio XTIR
    const portfolioCashFlows: { date: Date; amount: number }[] = [];
    cleanInvestmentTxs.forEach((t) => {
      const tDate = new Date(t.date);
      const event = t.investmentDetails?.event || "BUY";
      const amtBrl = getTxAmountBrl(t, currentUsdRate);
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
        portfolioCashFlows.push({ date: tDate, amount: amtBrl });
      } else if (event === "BUY") {
        portfolioCashFlows.push({ date: tDate, amount: -amtBrl });
      }
    });

    let portfolioXTIR = 0;
    if (portfolioCashFlows.length > 0 && summary.marketValue > 0) {
      // Fechamento sempre em "hoje": o XTIR mostra o retorno até a data atual,
      // não uma projeção estendida até um fluxo futuro (ex: aporte lançado com
      // data adiantada dentro do mês).
      const closingDate = new Date();
      const flows = [
        ...portfolioCashFlows,
        { date: closingDate, amount: summary.marketValue },
      ];
      portfolioXTIR = calculateXIRR(
        flows.map((f) => f.amount),
        flows.map((f) => f.date),
      );
    }

    summary.xtir = portfolioXTIR;
    summary.totalProfit = summary.unrealizedTotal + summary.realizedProfit + summary.proventosTotal;
    summary.cumulativeReturnPct = summary.investedValue > 0 ? (summary.totalProfit / summary.investedValue) * 100 : 0;

    return { list, summary, usdRate: currentUsdRate, profitMap };
  }, [cleanInvestmentTxs, assetPrices, categories, subCategories, cdiHistory]);
}
