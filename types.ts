
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  INVESTMENT = 'INVESTMENT'
}

export enum PaymentMethod {
  DEBIT_CASH = 'DEBIT_CASH',
  CREDIT_CARD = 'CREDIT_CARD'
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isAdditionalCard?: boolean;
  linkedCreditCardId?: string;
}

export interface SubCategory {
  id: string;
  userId?: string;
  categoryId: string;
  name: string;
}

export interface CreditCard {
  id: string;
  userId?: string;
  name: string;
  brand?: string; // e.g. Visa, Mastercard (kept for text description)
  icon?: string; // New field for visual icon (Lucide)
  limit: number;
  closingDay: number; // Day of month the invoice is due
  dueDay: number; // Day of month the invoice is due
  color: string;
}

export interface InvestmentDetails {
  ticker: string; // O código do ativo (ex: PETR4, TESOURO IPCA 2035)
  event: 'BUY' | 'SELL' | 'BONUS' | 'SPLIT' | 'MERGE' | 'TICKER_UPDATE' | 'AMORTIZACAO' | 'DIVIDEND' | 'JCP' | 'RENDIMENTO' | 'REEMBOLSO'; 
  quantity: number; // Para Split/Merge, isso representa o FATOR (ex: 3 para 1:3). Para proventos, é a qtd base.
  price: number; // Preço unitário na operação
  fees: number; // Taxas (corretagem, b3)
  broker?: string;
  cnpj?: string; // CNPJ do ativo
  tax?: number; // IRRF
  currency?: string; // BRL, USD
  ptax?: number; // Dólar PTAX utilizado na conversão da operação
  yieldRate?: string; // Rentabilidade Contratada (Ex: 100% CDI, IPCA+5%)
  newTicker?: string; // Usado apenas para evento TICKER_UPDATE (AT)
  bonusRatio?: number | null; // Fator de bonificação (ex: 0.1 para 10%)
  grossAmount?: number; // Valor Bruto (para Proventos)
  maturityDate?: string; // ISO Date string
  profitabilityType?: 'PRE' | 'POS' | 'INDEXED';
  hasDailyLiquidity?: boolean;
  isTotalRedemption?: boolean;
  sourceType?: 'POCKET' | 'PROVENTO' | 'RESGATE';
}

export interface AssetPrice {
  id: string; // usually ticker symbol
  userId?: string;
  ticker: string;
  longName?: string; // Nome da empresa ou fundo
  currentPrice: number; // Preço unitário atual ou Valor Total Atual (para renda fixa sem qtd definida)
  changePercent?: number; // Variação diária em %
  lastUpdated: string;
  manualHistory?: { date: string, price: number }[]; // Historical manual prices (sorted by date)
}

export interface Transaction {
  id: string;
  userId?: string;
  description: string; // The user-friendly description
  originalDescription?: string; // The raw description from bank/invoice
  amount: number;
  date: string; // ISO Date string (Real occurrence date)
  manualAccountingDate?: string; // ISO Date string (The target "Competence" month selected by user)
  type: TransactionType;
  categoryId: string;
  subCategoryId?: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string; // If CREDIT_CARD
  installmentIndex?: number; // 1 of 12
  totalInstallments?: number; // 12
  installmentId?: string; // ID linking all installments of the same purchase
  fixedGroupId?: string; // ID linking replicated fixed expenses
  sharedId?: string; // ID linking shared transactions (My part + Nathy's part) and their series
  isPaid: boolean;
  isShared?: boolean; // Indicates if the expense is split with spouse (Nathy)
  isFixed?: boolean; // Indicates a fixed expense (Rent, Internet, etc.)
  fundedByResgate?: boolean; // Indicates if an expense was funded by an investment redemption
  excludeFromBudget?: boolean; // Indicates if an income should be excluded from the monthly budget calculation
  fullySpendableIncome?: boolean; // Indicates if an income is 100% spendable without applying savings goal reduction
  cardOrigin?: 'TITULAR' | 'ADDITIONAL' | 'titular' | 'adicional'; // Origem do lançamento em cartão (titular vs adicional)
  tags?: string[]; // New field for observations/tags
  investmentDetails?: InvestmentDetails; // Specific fields for investments
  originalDay?: number; // The original day of the month the transaction was set for
}

export interface ImportedTransaction {
  id: string; // Temporary ID for the UI
  description: string; // User Editable
  originalDescription: string; // From File (Read Only)
  amount: number; // Now Editable
  date: string; // ISO Date YYYY-MM-DD
  categoryId: string;
  subCategoryId: string;
  installments: number; // Total installments
  installmentIndex?: number; // Current installment index (e.g. 6 in 06/06)
  tags?: string[]; // New field for tags
  selected: boolean;
  isDuplicate?: boolean; // Indicates if matches existing transaction
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface UserSettings {
  monthlyBudgetPercentage: number; // e.g. 80% of income
  salaryDay: number; // Day of month when the "accounting month" starts for debit/cash
  salaryShift?: number; // 0 = Standard (Day 5 belongs to Next Month), 1 = Advance (Day 25 belongs to Next Month)
  balanceResetDate?: string; // ISO Date string. Transactions before this date are ignored in Accumulated Balance.
  historyStartDate?: string; // ISO Date string. Starting date for detailed monthly history.
  resgatesResetMonth?: string; // YYYY-MM string. Month from which resgates pool is reset to 0.
  monthlySavingsGoal?: number; // Target monthly savings/aporte goal
  patrimonioTarget?: number; // Target total net worth goal
  taxHistoryStartYear?: string; // Ano de início da apuração fiscal / compensação de prejuízos (ex: '2025', 'selected', 'all')
  initialTaxLossCommon?: number; // Prejuízo acumulado inicial em Operações Comuns (Swing Trade Ações/ETFs/BDRs)
  initialTaxLossDayTrade?: number; // Prejuízo acumulado inicial em Day Trade
  initialTaxLossFII?: number; // Prejuízo acumulado inicial em FIIs e FIAGRO
  initialTaxLossExterior?: number; // Prejuízo acumulado inicial em Ativos no Exterior
}

export interface DescriptionMap {
  [originalDescription: string]: {
    targetDescription: string;
    categoryId?: string;
    subCategoryId?: string;
    isPattern?: boolean;
  }
}
