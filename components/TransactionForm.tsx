
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TransactionType, PaymentMethod, Category, SubCategory, CreditCard, Transaction, UserSettings, DescriptionMap } from '../types';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { BrapiService } from '../services/brapiService';
import { 
  X, TrendingUp, Calendar, Calculator, DollarSign, Search, Loader2, Landmark, 
  ShieldCheck, FileText, Percent, Layers, Info, AlertCircle, Tag, CreditCard as CardIcon, 
  Banknote, Repeat, Users, CheckCircle2, ChevronDown, Plus, Minus, Gift, Divide, Merge, Globe, RefreshCcw, Coins, Save, ArrowRightLeft, Clock, FastForward, Copy, ArrowDownRight, Target
} from 'lucide-react';

interface TransactionFormProps {
  transactions?: Transaction[]; 
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  initialData?: Transaction | null;
  onSave: (data: any, mode?: 'single' | 'future' | 'all') => void;
  onClose: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  transactions = [],
  categories,
  subCategories,
  creditCards,
  initialData,
  onSave,
  onClose,
}) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Competence Date (Mês de Referência)
  const [useCompetenceDate, setUseCompetenceDate] = useState(false);
  const [competenceMonth, setCompetenceMonth] = useState(''); // YYYY-MM

  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.DEBIT_CASH);
  const [creditCardId, setCreditCardId] = useState('');
  const [installments, setInstallments] = useState(1);
  const [isPaid, setIsPaid] = useState(true);
  const [isShared, setIsShared] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [fundedByResgate, setFundedByResgate] = useState(false);
  const [excludeFromBudget, setExcludeFromBudget] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  // New State for Debit Installments
  const [isRecurringDebit, setIsRecurringDebit] = useState(false);

  // Mappings State
  const [mappings, setMappings] = useState<DescriptionMap>({});

  // Investment Specific States
  const [invTicker, setInvTicker] = useState('');
  const [invEvent, setInvEvent] = useState<'BUY' | 'SELL' | 'BONUS' | 'SPLIT' | 'MERGE' | 'TICKER_UPDATE' | 'AMORTIZACAO' | 'DIVIDEND' | 'JCP' | 'RENDIMENTO' | 'REEMBOLSO'>('BUY');
  const [invQuantity, setInvQuantity] = useState('');
  const [invPrice, setInvPrice] = useState('');
  const [invFees, setInvFees] = useState('');
  const [invBroker, setInvBroker] = useState('');
  const [invTax, setInvTax] = useState(''); 
  const [invCurrency, setInvCurrency] = useState('BRL');
  const [invYieldRate, setInvYieldRate] = useState('');
  const [invPtax, setInvPtax] = useState(''); 
  const [invNewTicker, setInvNewTicker] = useState(''); // Estado para TICKER_UPDATE
  const [invBonusRatio, setInvBonusRatio] = useState(''); // Estado para BONUS
  const [invGrossAmount, setInvGrossAmount] = useState(''); // Estado para Proventos Brutos
  const [invMaturityDate, setInvMaturityDate] = useState('');
  const [invProfitabilityType, setInvProfitabilityType] = useState<'PRE' | 'POS' | 'INDEXED' | ''>('');

  const [fixedIncomeIndexer, setFixedIncomeIndexer] = useState('CDI');
  const [fixedIncomeRate, setFixedIncomeRate] = useState('');

  const [invIsTotalRedemption, setInvIsTotalRedemption] = useState(false);
  
  // Autocomplete State
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [forexRate, setForexRate] = useState<number | null>(null);
  const [loadingForex, setLoadingForex] = useState(false);

  // Update Mode Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [shouldCloseAfterSave, setShouldCloseAfterSave] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastInitializedId = useRef<string | null>(null);

  // Load Mappings on Mount
  useEffect(() => {
      StorageService.getMappings().then(setMappings);
  }, []);

  // Detect Fixed Income Category or Ticker
  const isFixedIncome = useMemo(() => {
      if (invTicker) {
          const tickUpper = invTicker.toUpperCase();
          if (
              tickUpper.includes('CDB') ||
              tickUpper.includes('LCI') ||
              tickUpper.includes('LCA') ||
              tickUpper.includes('CRI') ||
              tickUpper.includes('CRA') ||
              tickUpper.includes('DEB') ||
              tickUpper.includes('INTER') ||
              tickUpper.includes('TESOURO') ||
              tickUpper.startsWith('TD:') ||
              tickUpper.includes('CDI') ||
              tickUpper.includes('100%')
          ) {
              return true;
          }
      }
      if (!categoryId) return false;
      const cat = categories.find(c => c.id === categoryId);
      if (!cat) return false;
      const name = cat.name.toLowerCase();
      return name.includes('renda fixa') || name.includes('tesouro') || name.includes('cdb') || name.includes('lci') || name.includes('lca') || name.includes('título') || name.includes('poupança');
  }, [categoryId, categories, invTicker]);

  // Update yield rate when builder changes
  useEffect(() => {
      if (!isFixedIncome || fixedIncomeIndexer === 'CUSTOM') return;
      
      if (fixedIncomeIndexer === 'CDI' || fixedIncomeIndexer === 'SELIC') {
          setInvYieldRate(`${fixedIncomeRate ? fixedIncomeRate + '% ' : ''}${fixedIncomeIndexer}`);
          setInvProfitabilityType('POS');
      } else if (fixedIncomeIndexer === 'IPCA') {
          setInvYieldRate(`IPCA + ${fixedIncomeRate}%`);
          setInvProfitabilityType('INDEXED');
      } else if (fixedIncomeIndexer === 'PRE') {
          setInvYieldRate(`${fixedIncomeRate}% a.a.`);
          setInvProfitabilityType('PRE');
      }
  }, [fixedIncomeIndexer, fixedIncomeRate, isFixedIncome]);

  // Lista única de ativos já cadastrados para autocomplete
  const existingAssets = useMemo(() => {
      const assets = new Set<string>();
      transactions.forEach(t => {
          if (t.type === TransactionType.INVESTMENT && t.investmentDetails) {
              assets.add(t.investmentDetails.ticker);
          }
      });
      return Array.from(assets).sort();
  }, [transactions]);

  // Lista única de descrições para sugestão (Datalist)
  const descriptionSuggestions = useMemo(() => {
      const descs = new Set<string>();
      // Adiciona apenas mapeamentos configurados (redações normatizadas)
      Object.entries(mappings).forEach(([original, m]: [string, any]) => {
          if (m.targetDescription) {
              descs.add(m.targetDescription);
          }
      });
      
      return Array.from(descs).sort();
  }, [mappings]);

  const filteredTickerSuggestions = useMemo(() => {
      if (!invTicker) return [];
      const search = invTicker.toUpperCase();
      return existingAssets.filter(asset => asset.includes(search) && asset !== search);
  }, [invTicker, existingAssets]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowTickerSuggestions(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestedTicker = (ticker: string) => {
      setInvTicker(ticker);
      setShowTickerSuggestions(false);
      
      // Tenta encontrar a última transação desse ativo para auto-preencher categoria
      const lastTx = transactions.find(t => t.investmentDetails?.ticker === ticker);
      if (lastTx) {
          setCategoryId(lastTx.categoryId);
          if (lastTx.subCategoryId) setSubCategoryId(lastTx.subCategoryId);
          if (lastTx.investmentDetails?.currency) setInvCurrency(lastTx.investmentDetails.currency);
      }
  };

  const normalizeTickerName = () => {
      let clean = invTicker.trim().toUpperCase().replace(/\s+/g, ' ');
      
      // Normalização Específica para Tesouro
      if (clean.includes('TESOURO')) {
          clean = clean
              .replace(/IPCA/g, 'IPCA')
              .replace(/SELIC/g, 'SELIC')
              .replace(/PREFIXADO/g, 'PREFIXADO')
              .replace(/RENDA\+/g, 'RENDA+')
              .replace(/EDUCA\+/g, 'EDUCA+');
      }
      
      if (clean !== invTicker) {
          setInvTicker(clean);
      }
  };

  // Lógica centralizada de aplicação de mapeamento (Autocomplete Inteligente)
  const applyMapping = (text: string) => {
      if (!text) return;
      const lowerText = text.toLowerCase().trim();
      
      const possibleMatches: any[] = [];

      // 1. Tenta Match com Regras Explícitas (Mappings)
      // 1a. Match exato da chave (Original Description)
      if (mappings[text.trim()]) {
          possibleMatches.push(mappings[text.trim()]);
      }
      
      // 1b. Match parcial (Se a descrição digitada contém a chave da regra)
      const foundKeys = Object.keys(mappings).filter(key => 
          lowerText.includes(key.toLowerCase()) && key.length > 2 
      );
      foundKeys.forEach(key => possibleMatches.push(mappings[key]));

      // 2. Tenta Match com Histórico (Implicit Autocomplete)
      // Ordena transações da mais recente para a mais antiga para pegar o hábito mais novo
      const sortedHistory = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const historicalMatches = sortedHistory.filter(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          return cleanDesc.toLowerCase() === lowerText;
      });

      historicalMatches.forEach(t => {
          possibleMatches.push({
              targetDescription: t.description.replace(/\s\(\d+\/\d+\)$/, '').trim(),
              categoryId: t.categoryId,
              subCategoryId: t.subCategoryId
          });
      });

      if (possibleMatches.length === 0) return;

      // Prioriza categorias que NÃO sejam "nathy"
      let match = possibleMatches.find(m => {
          const cat = categories.find(c => c.id === m.categoryId);
          return cat && cat.name.toLowerCase() !== 'nathy';
      });

      // Se todas forem "nathy" ou não tiver categoria, pega a primeira (que respeita a ordem de prioridade: exato > parcial > histórico recente)
      if (!match) {
          match = possibleMatches[0];
      }

      // Aplica o Match encontrado
      if (match) {
          // Só aplica se for diferente para evitar loop ou override indesejado
          // Nota: Se o usuário já tiver selecionado uma categoria manualmente, o autcomplete NÃO deve sobrescrever 
          // a menos que ele mude a descrição novamente.
          // Aqui assumimos que se ele está digitando a descrição/saindo do campo, podemos sugerir.
          
          // Se a descrição for mapeada para algo diferente, atualiza
          // REMOVED: setDescription(match.targetDescription) to prevent overwriting user edits
          
          if (match.categoryId && (!categoryId || categoryId !== match.categoryId)) {
              setCategoryId(match.categoryId);
          }
          
          if (match.subCategoryId && (!subCategoryId || subCategoryId !== match.subCategoryId)) {
              setSubCategoryId(match.subCategoryId || '');
          }
          return true;
      }
      return false;
  };

  // Aplica mapeamento ao sair do campo
  const handleDescriptionBlur = () => {
      if (!initialData) {
          applyMapping(description);
      }
  };

  // Auto-calculate Total Amount for Investments
  useEffect(() => {
      if (type === TransactionType.INVESTMENT) {
          if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(invEvent)) {
              const gross = parseFloat(invGrossAmount) || 0;
              const tax = parseFloat(invTax) || 0;
              const rate = invCurrency === 'USD' ? (parseFloat(invPtax) || forexRate || 0) : 1;
              const net = (gross - tax) * (rate > 0 ? rate : 0);
              setAmount(net.toFixed(2));
              return;
          }

          if (['SPLIT', 'MERGE', 'TICKER_UPDATE'].includes(invEvent)) {
              setAmount('0.00'); 
              return;
          }

          const qty = parseFloat(invQuantity) || 0;
          const price = parseFloat(invPrice) || 0;
          const fees = parseFloat(invFees) || 0;
          const tax = parseFloat(invTax) || 0;
          
          let subtotal = (qty * price);
          let feesBRL = fees;
          let taxBRL = tax;
          
          if (invCurrency === 'USD') {
              const rate = parseFloat(invPtax) || forexRate || 1;
              subtotal = subtotal * rate;
              feesBRL = fees * rate;
              taxBRL = tax * rate;
          }
          
          const total = subtotal + (invEvent === 'BUY' ? (feesBRL + taxBRL) : -(feesBRL + taxBRL));
          if (total >= 0) setAmount(total.toFixed(2));
      }
  }, [invQuantity, invPrice, invFees, invTax, type, invCurrency, forexRate, invEvent, invPtax, invGrossAmount]);

  useEffect(() => {
    if (initialData && initialData.id !== lastInitializedId.current) {
      lastInitializedId.current = initialData.id;
      setType(initialData.type);
      
      let totalValue = initialData.amount;
      const numInstallments = initialData.totalInstallments || 1;
      
      // If it has installments (regardless of payment method), multiply back to total
      if (numInstallments > 1) {
          totalValue = totalValue * numInstallments;
          if (initialData.paymentMethod === PaymentMethod.DEBIT_CASH) {
              setIsRecurringDebit(true);
          }
      }
      
      if (initialData.isShared) {
          totalValue = totalValue * 2;
      }

      setAmount(totalValue.toFixed(2));
      
      let cleanDesc = initialData.description;
      cleanDesc = cleanDesc.replace(/\s\(\d+\/\d+\)$/, ''); 
      cleanDesc = cleanDesc.replace(/\s\((Minha Parte|Parte Nathy)\)$/i, ''); 
      setDescription(cleanDesc.trim());

      setDate(initialData.date.split('T')[0]);
      
      // Carregar data de competência manual se existir
      if (initialData.manualAccountingDate) {
          setUseCompetenceDate(true);
          setCompetenceMonth(initialData.manualAccountingDate.slice(0, 7)); // YYYY-MM
      } else {
          setUseCompetenceDate(false);
          setCompetenceMonth('');
      }

      setCategoryId(initialData.categoryId);
      setSubCategoryId(initialData.subCategoryId || '');
      setPaymentMethod(initialData.paymentMethod);
      setCreditCardId(initialData.creditCardId || '');
      setIsPaid(initialData.isPaid);
      setIsShared(initialData.isShared || false);
      setIsFixed(initialData.isFixed || false);
      setFundedByResgate(initialData.fundedByResgate || false);
      setExcludeFromBudget(initialData.excludeFromBudget || false);
      setInstallments(initialData.totalInstallments || 1);
      if (initialData.tags) setTagsInput(initialData.tags.join(', '));
      
      if (initialData.investmentDetails) {
          const det = initialData.investmentDetails;
          setInvTicker(det.ticker);
          setInvEvent(det.event);
          setInvQuantity(det.quantity.toString());
          setInvPrice(det.price.toString());
          setInvFees(det.fees?.toString() || '');
          setInvBroker(det.broker || '');
          setInvTax(det.tax?.toString() || '');
          setInvCurrency(det.currency || 'BRL');
          setInvYieldRate(det.yieldRate || '');
          
          if (det.yieldRate) {
              if (det.yieldRate.includes('CDI')) {
                  setFixedIncomeIndexer('CDI');
                  setFixedIncomeRate(det.yieldRate.replace('% CDI', '').replace(' CDI', '').trim());
              } else if (det.yieldRate.includes('IPCA')) {
                  setFixedIncomeIndexer('IPCA');
                  setFixedIncomeRate(det.yieldRate.replace('IPCA +', '').replace('%', '').trim());
              } else if (det.yieldRate.includes('PRE') || det.yieldRate.includes('a.a.')) {
                  setFixedIncomeIndexer('PRE');
                  setFixedIncomeRate(det.yieldRate.replace('% a.a.', '').trim());
              } else if (det.yieldRate.includes('SELIC')) {
                  setFixedIncomeIndexer('SELIC');
                  setFixedIncomeRate(det.yieldRate.replace('% SELIC', '').replace(' SELIC', '').trim());
              } else {
                  setFixedIncomeIndexer('CUSTOM');
              }
          }

          setInvNewTicker(det.newTicker || '');
          setInvBonusRatio(det.bonusRatio?.toString() || '');
          setInvGrossAmount(det.grossAmount?.toString() || '');
          setInvMaturityDate(det.maturityDate || '');
          setInvProfitabilityType(det.profitabilityType || '');
          setInvIsTotalRedemption(det.isTotalRedemption || false);
          if (det.currency === 'USD' && det.ptax) {
              setInvPtax(det.ptax.toString());
          } else {
              setInvPtax('');
          }
      }
    } else if (!initialData) {
        lastInitializedId.current = null;
    }
  }, [initialData]);

  const handleSharedChange = () => {
      const nextSharedState = !isShared;
      setIsShared(nextSharedState);
      if (nextSharedState && categoryId) {
          const currentCatName = categories.find(c => c.id === categoryId)?.name.toLowerCase();
          if (currentCatName === 'nathy') {
              setCategoryId(''); 
              setSubCategoryId('');
          }
      }
  };

  const handleTotalRedemptionChange = (checked: boolean) => {
      setInvIsTotalRedemption(checked);
  };

  // Auto-detect and set currency/category from previous transactions of the same ticker to avoid manual selection mistakes
  useEffect(() => {
      if (type === TransactionType.INVESTMENT && invTicker && transactions && !initialData) {
          const matchedTx = transactions.find(t => t.type === 'INVESTMENT' && t.investmentDetails?.ticker?.toUpperCase() === invTicker.trim().toUpperCase());
          if (matchedTx && matchedTx.investmentDetails) {
              if (matchedTx.investmentDetails.currency) {
                  setInvCurrency(matchedTx.investmentDetails.currency);
              }
              if (matchedTx.categoryId) {
                  setCategoryId(matchedTx.categoryId);
              }
              if (matchedTx.subCategoryId) {
                  setSubCategoryId(matchedTx.subCategoryId);
              }
          }
      }
  }, [invTicker, type, transactions, initialData]);

  // Recalculate total redemption values dynamically when inputs change
  useEffect(() => {
      if (type === TransactionType.INVESTMENT && invIsTotalRedemption && invTicker && transactions) {
          let currentQty = 0;
          let currentCost = 0;
          let currentNativeCost = 0;
          
          const assetTxs = transactions.filter(t => t.type === 'INVESTMENT' && t.investmentDetails?.ticker === invTicker);
          assetTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          assetTxs.forEach(t => {
              const ev = t.investmentDetails?.event;
              const q = t.investmentDetails?.quantity || 0;
              const amt = t.amount;
              const nativePrice = t.investmentDetails?.price || 0;
              
              if (ev === 'BUY') {
                  currentQty += q;
                  currentCost += amt;
                  currentNativeCost += (q * nativePrice);
              } else if (ev === 'SELL') {
                  const isFull = Math.abs(q - currentQty) < 0.000001 || t.investmentDetails?.isTotalRedemption;
                  if (isFull) {
                      currentQty = 0;
                      currentCost = 0;
                      currentNativeCost = 0;
                  } else {
                      const avgPrice = currentQty > 0 ? currentCost / currentQty : 0;
                      const avgNativePrice = currentQty > 0 ? currentNativeCost / currentQty : 0;
                      currentCost -= q * avgPrice;
                      currentNativeCost -= q * avgNativePrice;
                      currentQty -= q;
                  }
              } else if (ev === 'BONUS') {
                  currentQty += q;
                  const bonusCostNative = (q * nativePrice);
                  currentCost += bonusCostNative;
                  currentNativeCost += bonusCostNative;
              } else if (ev === 'SPLIT') {
                  currentQty *= q;
              } else if (ev === 'MERGE') {
                  currentQty /= q;
              }
          });
          
          if (currentQty > 0) {
              const useNative = invCurrency === 'USD';
              
              if (isFixedIncome) {
                  // For fixed income, to avoid quantity multiplier issue later (subtotal = q * p),
                  // if we put the total cost in price, we MUST set quantity to 1.
                  setInvQuantity("1");
                  setInvPrice(useNative ? currentNativeCost.toFixed(2) : currentCost.toFixed(2));
              } else {
                  setInvQuantity(currentQty.toString());
                  const avgPrice = (useNative ? currentNativeCost : currentCost) / currentQty;
                  setInvPrice(avgPrice.toFixed(4));
              }
              setDate(new Date().toISOString().split('T')[0]);
          } else {
              setInvQuantity("");
              setInvPrice("");
          }
      }
  }, [invIsTotalRedemption, invTicker, invCurrency, isFixedIncome, type, transactions]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const filteredSubCategories = subCategories.filter(s => s.categoryId === categoryId);

  const handleFetchForex = async () => {
      if (!date) return;
      setLoadingForex(true);
      setFormError(null);
      try {
          const rate = await BrapiService.fetchPtaxForDate(date);
          if (rate) {
              const ptaxValue = invEvent === 'SELL' ? rate.compra : rate.venda;
              setForexRate(ptaxValue);
              setInvPtax(ptaxValue.toString());
          }
          else setFormError("Cotação PTAX não encontrada para esta data.");
      } catch (e) { 
        setFormError("Erro ao buscar cotação PTAX.");
      } finally { setLoadingForex(false); }
  };

  useEffect(() => {
      // Validate if current category matches the type, if not reset it
      if (categoryId) {
          const cat = categories.find(c => c.id === categoryId);
          if (cat && cat.type !== type) {
              setCategoryId('');
              setSubCategoryId('');
          }
      }
  }, [type, categories, categoryId]);

  useEffect(() => {
      if (type === TransactionType.INVESTMENT && invCurrency === 'USD' && date) {
          handleFetchForex();
      }
  }, [date, invCurrency, type, invEvent]);

  const handleProcessSubmit = async (e: React.FormEvent | React.MouseEvent, shouldClose: boolean) => {
    e.preventDefault();
    if (!categoryId) {
        setFormError("Selecione a categoria.");
        return;
    }
    
    const finalTicker = invTicker.trim().toUpperCase();
    
    if (type === TransactionType.INVESTMENT && !['SPLIT', 'MERGE', 'TICKER_UPDATE', 'BONUS'].includes(invEvent)) {
        if (!amount || parseFloat(amount) <= 0) {
            setFormError("Preencha um valor válido.");
            return;
        }
        if (invCurrency === 'USD' && (!invPtax || parseFloat(invPtax) <= 0)) {
            setFormError("Informe o PTAX para operações em Dólar.");
            return;
        }
    } else if (type !== TransactionType.INVESTMENT) {
        // PERMITE VALORES NEGATIVOS (ESTORNOS), BLOQUEIA APENAS ZERO
        if (!amount || parseFloat(amount) === 0) {
            setFormError("Preencha um valor válido.");
            return;
        }
    }
    
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);

    // Tratamento de Data de Competência (Manual Accounting Date)
    let manualAccountingDate = undefined;
    if (type === TransactionType.INCOME && useCompetenceDate && competenceMonth) {
        const [cy, cm] = competenceMonth.split('-').map(Number);
        // Define como dia 1 do mês de competência para garantir que caia no mês certo
        const compDate = new Date(cy, cm - 1, 1, 12, 0, 0);
        manualAccountingDate = compDate.toISOString();
    }

    // Determine final installments count
    const finalInstallments = (paymentMethod === PaymentMethod.CREDIT_CARD || isRecurringDebit) ? installments : 1;

    const payload = {
      description,
      amount: parseFloat(amount) || 0,
      date: dateObj.toISOString(),
      originalDay: d, // Atualiza o originalDay com o novo dia
      manualAccountingDate, // Adiciona o campo
      type,
      paymentMethod,
      creditCardId: paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardId : undefined,
      totalInstallments: finalInstallments,
      isPaid: type === TransactionType.INCOME ? true : (paymentMethod === PaymentMethod.CREDIT_CARD ? false : isPaid),
      categoryId,
      subCategoryId: type === TransactionType.INCOME ? null : (subCategoryId || null),
      isShared,
      isFixed,
      fundedByResgate: type === TransactionType.EXPENSE ? fundedByResgate : undefined,
      excludeFromBudget: type === TransactionType.INCOME ? excludeFromBudget : undefined,
      tags: tagsInput.split(',').map(t => t.trim()).filter(t => t),
      investmentDetails: type === TransactionType.INVESTMENT ? {
          ticker: finalTicker,
          event: invEvent,
          quantity: parseFloat(invQuantity) || 0,
          price: parseFloat(invPrice) || 0,
          fees: parseFloat(invFees) || 0,
          broker: invBroker,
          tax: parseFloat(invTax) || 0,
          grossAmount: parseFloat(invGrossAmount) || 0,
          currency: invCurrency,
          yieldRate: isFixedIncome ? invYieldRate : undefined,
          ptax: invCurrency === 'USD' ? (parseFloat(invPtax) || 0) : undefined,
          newTicker: invNewTicker ? invNewTicker.toUpperCase() : undefined,
          bonusRatio: invBonusRatio !== '' ? parseFloat(invBonusRatio) : null,
          maturityDate: isFixedIncome ? invMaturityDate : undefined,
          profitabilityType: isFixedIncome ? (invProfitabilityType || undefined) : undefined,
          isTotalRedemption: invEvent === 'SELL' ? invIsTotalRedemption : undefined
      } : undefined
    };

    setShouldCloseAfterSave(shouldClose);

    // Verificação de Recorrência (Parcelado ou Fixo) para Edição
    const isRecurringOrShared = initialData && (
      initialData.installmentId || 
      initialData.fixedGroupId || 
      initialData.sharedId ||
      initialData.isFixed ||
      initialData.isShared
    );
    console.log("isRecurringOrShared:", isRecurringOrShared, "initialData:", initialData);

    if (isRecurringOrShared) {
        setPendingPayload(payload);
        setShowUpdateModal(true);
        return;
    }

    setIsSubmitting(true);
    try {
        await onSave(payload, 'single');
        if (shouldClose) {
            onClose();
        } else {
            resetForm();
        }
    } catch (error) {
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmUpdate = async (mode: 'single' | 'future' | 'all') => {
      if (pendingPayload) {
          setIsSubmitting(true);
          try {
              await onSave(pendingPayload, mode);
              if (shouldCloseAfterSave) {
                  onClose();
              } else {
                  resetForm();
              }
              setShowUpdateModal(false);
              setPendingPayload(null);
          } catch (error) {
              console.error(error);
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  const resetForm = () => {
        setAmount('');
        setDescription('');
        setInstallments(1);
        setIsFixed(false);
        setIsShared(false);
        setIsRecurringDebit(false);
        setExcludeFromBudget(false);
        setTagsInput('');
        setCompetenceMonth('');
        setUseCompetenceDate(false);
        
        setInvTicker('');
        setInvQuantity('');
        setInvPrice('');
        setInvFees('');
        setInvTax('');
        setInvGrossAmount('');
        setInvMaturityDate('');
        setInvProfitabilityType('');
        setInvIsTotalRedemption(false);
        
        setFormError(null);
        // Visual feedback
        const btn = document.getElementById('save-new-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = 'Salvo!';
            setTimeout(() => btn.innerText = originalText, 1000);
        }
  };

  const installmentValuePreview = useMemo(() => {
      const total = parseFloat(amount || '0');
      if (total === 0) return 0;
      let divisor = installments;
      if (isShared) divisor = divisor * 2; 
      return isShared ? (total / 2) / installments : total / installments;
  }, [amount, installments, isShared]);

  const isDividendEvent = ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(invEvent);
  const isNegativeExpense = type === TransactionType.EXPENSE && parseFloat(amount) < 0;

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200 relative border border-zinc-200/50 dark:border-zinc-700">
        
        {/* UPDATE MODE MODAL OVERLAY */}
        {showUpdateModal && (
            <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                <div className="bg-blue-50 p-5 rounded-full text-blue-600 mb-6 shadow-inner border border-blue-100">
                    <Repeat size={36} />
                </div>
                <h3 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 mb-3 text-center tracking-tight">Editar Recorrência</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-10 max-w-xs leading-relaxed">
                    Esta é uma transação <span className="font-semibold text-zinc-700 dark:text-zinc-300">{initialData?.installmentId ? 'parcelada' : (initialData?.fixedGroupId ? 'fixa' : 'compartilhada')}</span>. Como deseja aplicar as alterações?
                </p>
                <div className="space-y-4 w-full max-w-sm">
                    <button onClick={() => handleConfirmUpdate('single')} className="w-full flex items-center p-4 border border-zinc-200/60 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left gap-4 group hover:border-blue-200 hover:shadow-sm shadow-zinc-200/5">
                        <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm shadow-zinc-200/5 text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors"><FileText size={20} /></div>
                        <div>
                            <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 group-hover:text-blue-700 transition-colors">Apenas esta</span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Alterar somente este lançamento.</span>
                        </div>
                    </button>
                    <button onClick={() => handleConfirmUpdate('future')} className="w-full flex items-center p-4 border border-blue-200 bg-blue-50/50 rounded-2xl hover:bg-blue-50 transition-all text-left gap-4 group ring-2 ring-blue-500/20 shadow-sm shadow-zinc-200/5">
                        <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-blue-200 shadow-sm shadow-zinc-200/5 text-blue-600"><FastForward size={20} /></div>
                        <div>
                            <span className="block text-sm font-semibold text-blue-900 dark:text-blue-100">Esta e futuras</span>
                            <span className="block text-xs text-blue-600/80 mt-0.5">Alterar desta data em diante.</span>
                        </div>
                    </button>
                    <button onClick={() => handleConfirmUpdate('all')} className="w-full flex items-center p-4 border border-zinc-200/60 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left gap-4 group hover:border-blue-200 hover:shadow-sm shadow-zinc-200/5">
                        <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm shadow-zinc-200/5 text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors"><Layers size={20} /></div>
                        <div>
                            <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 group-hover:text-blue-700 transition-colors">Todas</span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Alterar toda a série.</span>
                        </div>
                    </button>
                </div>
                <button onClick={() => setShowUpdateModal(false)} className="mt-8 text-zinc-500 dark:text-zinc-400 text-sm hover:text-zinc-800 dark:hover:text-zinc-100 font-semibold tracking-wide uppercase transition-colors">Cancelar</button>
            </div>
        )}

        <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{initialData ? 'Editar Registro' : 'Novo Lançamento'}</h2>
          <button onClick={onClose} className="p-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm shadow-zinc-200/5 hover:text-zinc-800 dark:hover:text-zinc-100"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-8 custom-scrollbar">
          {formError && (
              <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-top-2 shadow-sm shadow-zinc-200/5">
                  <AlertCircle size={18} className="shrink-0" /> {formError}
              </div>
          )}

          <div className="flex gap-2 mb-8">
            <button onClick={() => setType(TransactionType.EXPENSE)} className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${type === TransactionType.EXPENSE ? 'bg-rose-600 text-white shadow-md shadow-rose-200 dark:shadow-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>Despesa</button>
            <button onClick={() => setType(TransactionType.INCOME)} className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${type === TransactionType.INCOME ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>Receita</button>
            <button onClick={() => setType(TransactionType.INVESTMENT)} className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${type === TransactionType.INVESTMENT ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>Investimento</button>
          </div>

          <form id="transaction-form" className="space-y-6">
            {/* ... Form Content ... */}
            {type === TransactionType.INVESTMENT ? (
              // ... Investment Form Content (Unchanged) ...
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                   <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={14} className="text-blue-400"/> Data da Operação</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5" />
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Landmark size={14} className="text-blue-400"/> Corretora</label>
                     <input type="text" value={invBroker} onChange={(e) => setInvBroker(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="XP, BTG, NuInvest..." />
                   </div>
                </div>

                {/* DADOS DO ATIVO COM AUTOCOMPLETE E EVENTO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-blue-400"/> Ativo / Título</label>
                    <input 
                      type="text" 
                      required 
                      value={invTicker} 
                      onChange={(e) => {
                        setInvTicker(e.target.value.toUpperCase());
                        setShowTickerSuggestions(true);
                      }}
                      onFocus={() => setShowTickerSuggestions(true)}
                      onBlur={normalizeTickerName}
                      className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-50 font-semibold uppercase transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 placeholder:font-medium" 
                      placeholder="PETR4, Tesouro Selic..." 
                      autoComplete="off"
                    />
                    
                    {/* DROPDOWN DE SUGESTÕES */}
                    {showTickerSuggestions && filteredTickerSuggestions.length > 0 && (
                        <ul className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 custom-scrollbar animate-in fade-in slide-in-from-top-2 ring-1 ring-zinc-900/5">
                            {filteredTickerSuggestions.map(suggestion => (
                                <li 
                                    key={suggestion}
                                    onMouseDown={() => selectSuggestedTicker(suggestion)}
                                    className="px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors"
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">Evento</label>
                    <select 
                        value={invEvent} 
                        onChange={(e) => setInvEvent(e.target.value as any)} 
                        className="w-full px-4 py-3 bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700 rounded-xl outline-none text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    >
                        <option value="BUY">Compra (Aplicação)</option>
                        <option value="SELL">Venda (Resgate)</option>
                        
                        
                        
                        <option value="AMORTIZACAO">Amortização</option>
                        <option value="BONUS">Bonificação</option>
                        <option value="SPLIT">Desdobramento (S)</option>
                        <option value="MERGE">Grupamento (I)</option>
                        <option value="TICKER_UPDATE">Atualização Ticker</option>
                        
                    </select>
                  </div>
                </div>


                {isDividendEvent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Globe size={14} className="text-blue-400"/> Moeda</label>
                            <select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm shadow-zinc-200/5">
                                <option value="BRL">BRL (R$)</option>
                                <option value="USD">USD (U$)</option>
                            </select>
                        </div>
                    </div>
                )}

                {invEvent === 'BONUS' && (
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 animate-in fade-in mt-5 shadow-sm shadow-zinc-200/5">
                        <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><RefreshCcw size={14}/> Razão da Bonificação (%)</label>
                        <input type="number" step="0.000001" value={invBonusRatio} onChange={(e) => setInvBonusRatio(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-blue-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-50 font-semibold transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Ex: 10 para 10%" />
                        <p className="text-[10px] text-blue-500/80 mt-3 font-medium leading-relaxed">Informe a porcentagem exata (ex: 10 para 10%). Isso garante o cálculo correto do preço nominal no histórico.</p>
                    </div>
                )}

                {invEvent === 'TICKER_UPDATE' && (
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 animate-in fade-in mt-5 shadow-sm shadow-zinc-200/5">
                        <label className="block text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><RefreshCcw size={14}/> Novo Código (Ticker)</label>
                        <input type="text" required value={invNewTicker} onChange={(e) => setInvNewTicker(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-900 dark:text-zinc-50 font-semibold uppercase transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Novo Ticker..." />
                        <p className="text-[10px] text-emerald-600/80 mt-3 font-medium leading-relaxed">Os dados de custo e quantidade serão migrados do Ticker antigo para o Novo.</p>
                    </div>
                )}

                {!isDividendEvent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className={invEvent === 'SPLIT' || invEvent === 'MERGE' || invEvent === 'TICKER_UPDATE' ? 'sm:col-span-2' : 'col-span-1'}>
                            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                                {invEvent === 'SPLIT' || invEvent === 'MERGE' ? 'Fator (Ex: 3 para 1:3)' : (invEvent === 'TICKER_UPDATE' ? 'Proporção (Ex: 1 para 1:1, 0.5 para 2:1)' : 'Quantidade')}
                            </label>
                            <input type="number" step="0.000001" required value={invQuantity} onChange={(e) => setInvQuantity(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium" placeholder={invEvent === 'SPLIT' ? "Ex: 2 (para 1:2)" : (invEvent === 'TICKER_UPDATE' ? "Ex: 1" : "0,00")} />
                        </div>
                        
                        {invEvent !== 'SPLIT' && invEvent !== 'MERGE' && invEvent !== 'TICKER_UPDATE' && (
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">{invEvent === 'BONUS' ? 'Custo Atribuído (Unit.)' : 'Preço Unitário'}</label>
                                <div className="relative flex items-center">
                                <select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value)} className="absolute left-2 text-[10px] bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700 rounded-xl px-2 font-semibold h-8 outline-none text-zinc-600 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20"><option value="BRL">R$</option><option value="USD">U$</option></select>
                                <input type="number" step="0.0001" required value={invPrice} onChange={(e) => setInvPrice(e.target.value)} className="w-full pl-16 pr-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl outline-none font-semibold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 placeholder:font-medium" placeholder="0,00" />
                                </div>
                            </div>
                        )}
                        
                        {invEvent === 'SELL' && (
                            <div className="col-span-1 sm:col-span-2 flex items-center gap-3 pt-2 pb-2">
                                <input type="checkbox" checked={invIsTotalRedemption} onChange={(e) => handleTotalRedemptionChange(e.target.checked)} className="w-5 h-5 text-blue-600 border-zinc-300 rounded-md focus:ring-blue-500 transition-colors cursor-pointer" />
                                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 cursor-pointer select-none" onClick={() => handleTotalRedemptionChange(!invIsTotalRedemption)}>Resgate Total (Zerar Posição)</label>
                            </div>
                        )}
                    </div>
                )}

                {(invEvent === 'BUY' || invEvent === 'SELL' || invEvent === 'AMORTIZACAO') && (
                    <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 flex justify-between items-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-zinc-800/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div className="relative z-10">
                            <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-widest block mb-1.5">Total Operação (BRL)</span>
                            <p className="text-[10px] text-blue-300 font-medium">Rendimentos e Taxas inclusos</p>
                        </div>
                        <div className="text-right flex flex-col items-end relative z-10">
                            <span className="text-4xl font-light tracking-tight">R$ {(parseFloat(amount || '0') || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                )}

                {invCurrency === 'USD' && (
                  <div className="bg-zinc-50/80 dark:bg-zinc-800/40 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-700 flex flex-col gap-4 shadow-sm shadow-zinc-200/5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Globe size={16} className="text-zinc-400 dark:text-zinc-500"/>
                            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">PTAX da Operação</span>
                        </div>
                        <button type="button" onClick={handleFetchForex} disabled={loadingForex} className="bg-white dark:bg-zinc-900 text-zinc-600 px-4 py-2 rounded-2xl text-[10px] font-semibold shadow-sm shadow-zinc-200/5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 transition-all hover:border-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50">
                            {loadingForex ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar Online
                        </button>
                    </div>
                    <div className="relative flex items-center">
                        <span className="absolute left-4 text-xs font-semibold text-zinc-400 dark:text-zinc-500">R$</span>
                        <input 
                            type="number" 
                            step="0.0001" 
                            required 
                            value={invPtax} 
                            onChange={(e) => setInvPtax(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 placeholder:font-medium bg-white dark:bg-zinc-900" 
                            placeholder="Ex: 5.2045"
                        />
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">* Usado para conversão dos valores em Dólar para Reais.</p>
                  </div>
                )}

                {isDividendEvent && (
                    <div className="bg-zinc-50/80 dark:bg-zinc-800/40 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-700 space-y-5 animate-in fade-in shadow-sm shadow-zinc-200/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Valor Bruto ({invCurrency})</label>
                                <input type="number" step="0.01" required value={invGrossAmount} onChange={(e) => setInvGrossAmount(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="0,00" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Imposto ({invCurrency})</label>
                                <input type="number" step="0.01" value={invTax} onChange={(e) => setInvTax(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-600 font-semibold transition-all shadow-sm shadow-zinc-200/5 placeholder:text-rose-300 dark:placeholder:text-rose-700" placeholder="0,00" />
                            </div>
                        </div>
                        
                        <div className="pt-5 border-t border-zinc-200/80 dark:border-zinc-700 flex justify-between items-end">
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex flex-col gap-1">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Valor Líquido {invCurrency === 'USD' && '(Convertido)'}</span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">(Entrada no Caixa em BRL)</span>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-light text-emerald-600 tracking-tight">
                                    R$ {(parseFloat(amount || '0') || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                                {invCurrency === 'USD' && (
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg inline-block">
                                        = ( {parseFloat(invGrossAmount || '0').toFixed(2)} - {parseFloat(invTax || '0').toFixed(2)} ) x {parseFloat(invPtax || '0').toFixed(4)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Exibe Rentabilidade APENAS se for Renda Fixa */}
                {!isDividendEvent && isFixedIncome && (
                    <div className="space-y-5 animate-in fade-in bg-zinc-50/40 dark:bg-zinc-800/30 p-5 rounded-3xl border border-zinc-200/60 dark:border-zinc-700">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Percent size={14} className="text-blue-400"/> Indexador</label>
                                <select value={fixedIncomeIndexer} onChange={(e) => setFixedIncomeIndexer(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer">
                                    <option value="CDI">% do CDI</option>
                                    <option value="IPCA">IPCA +</option>
                                    <option value="PRE">Pré-fixado (% a.a.)</option>
                                    <option value="SELIC">% da SELIC</option>
                                    <option value="CUSTOM">Outro (Livre)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Percent size={14} className="text-blue-400"/> Taxa / Valor</label>
                                {fixedIncomeIndexer === 'CUSTOM' ? (
                                    <input type="text" value={invYieldRate} onChange={(e) => setInvYieldRate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Ex: 100% CDI" />
                                ) : (
                                    <div className="relative">
                                        <input type="number" step="0.01" value={fixedIncomeRate} onChange={(e) => setFixedIncomeRate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Ex: 110" />
                                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                            <span className="text-zinc-400 dark:text-zinc-500 text-sm font-semibold">%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={14} className="text-blue-400"/> Vencimento</label>
                                <input type="date" value={invMaturityDate} onChange={(e) => setInvMaturityDate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5" />
                            </div>
                        </div>
                    </div>
                )}
                
                {!isDividendEvent && invEvent !== 'SPLIT' && invEvent !== 'MERGE' && invEvent !== 'TICKER_UPDATE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calculator size={14} className="text-blue-400"/> Taxas (Na moeda orig.)</label>
                            <input type="number" step="0.01" value={invFees} onChange={(e) => setInvFees(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="0,00" />
                        </div>
                        {/* Oculta IRRF se for compra, pois não há imposto retido na fonte na aquisição */}
                        {invEvent !== 'BUY' && (
                            <div className="animate-in fade-in">
                                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ShieldCheck size={14} className="text-rose-400"/> IRRF/Imposto (BRL)</label>
                                <input type="number" step="0.01" value={invTax} onChange={(e) => setInvTax(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold text-rose-600 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-rose-300 dark:placeholder:text-rose-700" placeholder="0,00" />
                            </div>
                        )}
                    </div>
                )}


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-zinc-50/50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 mt-5">
                   <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Layers size={14} className="text-blue-400"/> Categoria de Investimento</label>
                    <select required value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId(''); }} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer">
                      <option value="">Selecione...</option>
                      {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                   </div>
                   <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Layers size={14} className="text-blue-400"/> Subcategoria</label>
                    <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} disabled={!categoryId || filteredSubCategories.length === 0} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer">
                      <option value="">Nenhuma</option>
                      {filteredSubCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText size={14} className="text-blue-400"/> Observação (Opcional)</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none resize-none h-24 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Detalhes..."></textarea>
                </div>
              </div>
            ) : (
              // ... Existing EXPENSE/INCOME Form content ...
              <div className="space-y-6">
                
                {/* VALOR TOTAL - LABEL ENFATIZADO */}
                <div className="bg-zinc-50/40 dark:bg-zinc-800/30 p-5 rounded-3xl border border-zinc-200/60 dark:border-zinc-700 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                  <div className="relative z-10 flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Valor Total {type === TransactionType.INCOME ? 'Recebido' : 'da Compra'}</label>
                    {installments > 1 && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/50 px-2.5 py-1 rounded-lg border border-blue-200/50">
                        Sua Parcela Mensal: R$ {(installmentValuePreview || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <div className="relative z-10">
                    <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-medium text-3xl ${type === TransactionType.EXPENSE ? 'text-rose-500' : 'text-emerald-500'}`}>R$</span>
                    <input 
                        type="number" 
                        step="0.01" 
                        required 
                        value={amount} 
                        readOnly={type === TransactionType.INVESTMENT}
                        onChange={(e) => setAmount(e.target.value)} 
                        className={`w-full pl-20 pr-5 py-6 text-4xl font-medium bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-600 ${type === TransactionType.INVESTMENT ? 'bg-slate-50 cursor-not-allowed opacity-80' : ''}`} 
                        placeholder="0,00" 
                    />
                  </div>
                  {isNegativeExpense && (
                      <div className="mt-4 text-[10px] text-emerald-600 font-semibold flex items-center gap-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-100 animate-in fade-in relative z-10 shadow-sm shadow-zinc-200/5">
                          <ArrowRightLeft size={14} className="shrink-0" /> Valor negativo detectado. Será registrado como estorno/reembolso.
                      </div>
                  )}
                  {isShared && type === TransactionType.EXPENSE && (
                      <div className="mt-4 text-[10px] text-blue-600 font-semibold flex flex-col gap-1.5 bg-blue-50 p-3 rounded-2xl border border-blue-100 relative z-10 shadow-sm shadow-zinc-200/5">
                          <span className="flex items-center gap-2"><Info size={14} className="shrink-0" /> Compra compartilhada (50/50).</span>
                          <span className="pl-5">Você pagará: R$ {((parseFloat(amount || '0') / 2) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no total.</span>
                      </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText size={14} className="text-blue-400" /> Descrição</label>
                  <input 
                    id="desc-input"
                    list="description-suggestions" // Link to datalist
                    type="text" 
                    required 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur} 
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" 
                    placeholder="Ex: Uber, Mercado..." 
                    autoComplete="new-password"
                  />
                  {/* DATALIST PARA SUGESTÕES */}
                  <datalist id="description-suggestions">
                      {descriptionSuggestions.map((item, idx) => (
                          <option key={`${item}-${idx}`} value={item} />
                      ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className={type === TransactionType.INCOME ? "col-span-1 sm:col-span-2" : "col-span-1"}>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Layers size={14} className="text-blue-400" /> Categoria</label>
                    <select required value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId(''); }} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer">
                      <option value="">Selecione</option>
                      {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {type !== TransactionType.INCOME && (
                    <div className="col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ChevronDown size={14} className="text-blue-400" /> Subcategoria</label>
                      <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} disabled={!categoryId || filteredSubCategories.length === 0} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed">
                        <option value="">Nenhuma</option>
                        {filteredSubCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={14} className="text-blue-400" /> Data</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag size={14} className="text-blue-400" /> Tags</label>
                    <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-50 transition-all shadow-sm shadow-zinc-200/5 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Ex: #viagem, Uber..." />
                  </div>
                </div>

                {type === TransactionType.INCOME && (
                    <div className="space-y-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-700 mt-4">
                        <div className="flex items-center gap-2.5">
                            <input 
                                type="checkbox" 
                                id="useCompetence" 
                                checked={useCompetenceDate} 
                                onChange={(e) => setUseCompetenceDate(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500/20 transition-all cursor-pointer"
                            />
                            <label htmlFor="useCompetence" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                                Selecionar Mês de Referência (Competência)
                            </label>
                        </div>
                        
                        {useCompetenceDate && (
                            <div className="animate-in slide-in-from-top-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                                <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Clock size={14} /> Mês de Competência
                                </label>
                                <input 
                                    type="month" 
                                    value={competenceMonth} 
                                    onChange={(e) => setCompetenceMonth(e.target.value)} 
                                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-blue-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-blue-900 dark:text-blue-100 shadow-sm shadow-zinc-200/5 transition-all"
                                />
                                <p className="text-[10px] text-blue-500/80 mt-2 font-medium flex items-center gap-1.5">
                                    <Info size={12} /> Útil para salários recebidos no dia 5 referente ao mês anterior.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {type === TransactionType.EXPENSE && (
                   <div className="space-y-5 pt-3">
                        <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Forma de Pagamento</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setPaymentMethod(PaymentMethod.DEBIT_CASH); setInstallments(1); setIsRecurringDebit(false); }} className={`flex-1 py-3 text-xs font-semibold rounded-full transition-all flex items-center justify-center gap-2 ${paymentMethod === PaymentMethod.DEBIT_CASH ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Banknote size={16} /> Débito / Dinheiro</button>
                            <button type="button" onClick={() => setPaymentMethod(PaymentMethod.CREDIT_CARD)} className={`flex-1 py-3 text-xs font-semibold rounded-full transition-all flex items-center justify-center gap-2 ${paymentMethod === PaymentMethod.CREDIT_CARD ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><CardIcon size={16} /> Cartão Crédito</button>
                        </div>

                        {paymentMethod === PaymentMethod.DEBIT_CASH && (
                            <div className="flex items-center gap-2.5 pt-1 animate-in slide-in-from-top-1">
                                <input 
                                    type="checkbox" 
                                    id="recurring-debit" 
                                    checked={isRecurringDebit} 
                                    onChange={(e) => { setIsRecurringDebit(e.target.checked); setInstallments(1); }}
                                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500/20 transition-all cursor-pointer"
                                />
                                <label htmlFor="recurring-debit" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                                    Repetir Lançamento? (Parcelar no Débito)
                                </label>
                            </div>
                        )}

                        {(paymentMethod === PaymentMethod.CREDIT_CARD || isRecurringDebit) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in slide-in-from-top-2">
                                {paymentMethod === PaymentMethod.CREDIT_CARD && (
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Cartão</label>
                                        <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} required className="w-full px-4 py-3 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-900 font-semibold text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5 appearance-none cursor-pointer">
                                            <option value="">Selecione...</option>
                                            {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className={paymentMethod === PaymentMethod.CREDIT_CARD ? "col-span-1" : "col-span-1 sm:col-span-2"}>
                                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">{isRecurringDebit ? 'Número de Vezes' : 'Parcelas'}</label>
                                    <div className="relative">
                                        <Repeat className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                                        <input type="number" min="1" max="99" value={installments} onChange={(e) => setInstallments(parseInt(e.target.value) || 1)} className="w-full pl-11 pr-4 py-3 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-900 font-semibold text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-zinc-200/5" />
                                    </div>
                                </div>
                            </div>
                        )}
                   </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                    {type === TransactionType.EXPENSE && (
                        <>
                            <button type="button" onClick={() => setIsFixed(!isFixed)} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-xs transition-all ${isFixed ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm shadow-zinc-200/5' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                <Repeat size={16} className={isFixed ? 'text-amber-500' : ''} /> Despesa Fixa
                            </button>
                            <button type="button" onClick={handleSharedChange} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-xs transition-all ${isShared ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm shadow-zinc-200/5' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                <Users size={16} className={isShared ? 'text-blue-500' : ''} /> Dividir (50/50)
                            </button>
                            <button type="button" onClick={() => setFundedByResgate(!fundedByResgate)} className={`col-span-2 flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-xs transition-all ${fundedByResgate ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm shadow-zinc-200/5' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                <ArrowDownRight size={16} className={fundedByResgate ? 'text-purple-500' : ''} /> Custeada por Resgate de Investimento
                            </button>
                        </>
                    )}
                    {paymentMethod !== PaymentMethod.CREDIT_CARD && type === TransactionType.EXPENSE && (
                        <button type="button" onClick={() => setIsPaid(!isPaid)} className={`col-span-2 flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-xs transition-all ${isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-zinc-200/5' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm shadow-zinc-200/5'}`}>
                            {isPaid ? <><CheckCircle2 size={16} className="text-emerald-500" /> Lançamento Pago</> : <><Info size={16} className="text-rose-500" /> Lançamento Pendente</>}
                        </button>
                    )}
                    {type === TransactionType.INCOME && (
                        <button type="button" onClick={() => setExcludeFromBudget(!excludeFromBudget)} className={`col-span-2 flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-xs transition-all ${excludeFromBudget ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm shadow-zinc-200/5' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                            <Target size={16} className={excludeFromBudget ? 'text-rose-500' : ''} /> {excludeFromBudget ? 'Fora do Cálculo da Meta' : 'Incluir no Cálculo da Meta'}
                        </button>
                    )}
                </div>

              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-zinc-200/80 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors">Cancelar</button>
          
          {!initialData && (
              <button 
                id="save-new-btn"
                type="button" 
                onClick={(e) => handleProcessSubmit(e, false)} 
                className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300 rounded-2xl transition-all active:scale-95 flex items-center gap-2 shadow-sm shadow-zinc-200/5"
              >
                  <Save size={16} className="text-zinc-400 dark:text-zinc-500" /> Salvar e Novo
              </button>
          )}

          <button 
            type="button" 
            onClick={(e) => handleProcessSubmit(e, true)}
            className={`px-8 py-3 text-sm font-semibold text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${type === TransactionType.INCOME ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : (type === TransactionType.INVESTMENT ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20')}`}
          >
              <CheckCircle2 size={16} className="opacity-80" /> Salvar Registro
          </button>
        </div>
      </div>
    </div>
  );
};
