import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Category, SubCategory, CreditCard, UserSettings, AssetPrice, TransactionType } from '../types';
import { GeminiService, FinancialAssistantPayload } from '../services/geminiService';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  TrendingUp, 
  PieChart, 
  CreditCard as CardIcon, 
  HelpCircle, 
  Check, 
  Copy, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  Calendar,
  Wallet,
  Coins,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AiFinancialAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  assetPrices: AssetPrice[];
  settings: UserSettings;
  currentDate: Date;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export const AiFinancialAssistantModal: React.FC<AiFinancialAssistantModalProps> = ({
  isOpen,
  onClose,
  transactions = [],
  categories = [],
  subCategories = [],
  creditCards = [],
  assetPrices = [],
  settings,
  currentDate
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisScope, setAnalysisScope] = useState<'current_month' | 'last_3_months' | 'all'>('current_month');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Quick Suggested Questions
  const quickQuestions = [
    {
      icon: TrendingUp,
      title: "Resumo do Mês",
      query: "Faça um raio-X completo das minhas receitas, despesas e taxa de poupança no mês selecionado."
    },
    {
      icon: Coins,
      title: "Onde Economizar?",
      query: "Quais categorias ou despesas representam a maior fatia dos meus gastos e onde posso economizar?"
    },
    {
      icon: CardIcon,
      title: "Faturas de Cartão",
      query: "Quanto gastei em cada cartão de crédito e quais são os maiores parcelamentos ativos?"
    },
    {
      icon: Users,
      title: "Divisão com a Nathy",
      query: "Como está a divisão de gastos da Nathy vs Minha Parte? Quanto foi gasto em despesas compartilhadas?"
    },
    {
      icon: PieChart,
      title: "Carteira & Investimentos",
      query: "Analise a distribuição e saldo da minha carteira de investimentos com base nos ativos cadastrados."
    },
    {
      icon: HelpCircle,
      title: "Alertas & Anomalias",
      query: "Existem gastos atípicos, compras duplicadas ou estou perto de estourar o orçamento do mês?"
    }
  ];

  // Helper to compile filtered financial dataset summary for Gemini
  const prepareFinancialContext = (): FinancialAssistantPayload['financialSummary'] => {
    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth();

    // Filter transactions by scope
    const filteredTransactions = transactions.filter(t => {
      if (analysisScope === 'all') return true;
      const tDate = new Date(t.date);
      if (analysisScope === 'current_month') {
        return tDate.getFullYear() === curYear && tDate.getMonth() === curMonth;
      }
      if (analysisScope === 'last_3_months') {
        const startWindow = new Date(curYear, curMonth - 2, 1);
        const endWindow = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
        return tDate >= startWindow && tDate <= endWindow;
      }
      return true;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let totalNathyExpenses = 0;
    let sharedTransactionsCount = 0;

    const categoryMap: Record<string, { name: string; amount: number; type: string }> = {};

    filteredTransactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const catName = cat?.name || 'Outros';
      const descLower = (t.description || '').toLowerCase();
      const isCardOriginAdd = (t.cardOrigin || '').toUpperCase() === 'ADDITIONAL' || (t.cardOrigin || '').toUpperCase() === 'ADICIONAL';
      const isNathy = !descLower.includes('(minha parte)') && !descLower.includes('minha parte') && (descLower.includes('(parte nathy)') || descLower.includes('parte nathy') || catName.toLowerCase().includes('nathy') || cat?.isAdditionalCard || isCardOriginAdd);

      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        totalExpense += t.amount;
        if (isNathy) {
          totalNathyExpenses += t.amount;
        }
      }

      if (t.isShared) {
        sharedTransactionsCount++;
      }

      const key = `${catName}_${t.type}`;
      if (!categoryMap[key]) {
        categoryMap[key] = { name: catName, amount: 0, type: t.type };
      }
      categoryMap[key].amount += t.amount;
    });

    const categoryBreakdown = Object.values(categoryMap).map(c => ({
      name: c.name,
      amount: c.amount,
      type: c.type,
      percentageOfExpense: totalExpense > 0 && c.type === TransactionType.EXPENSE ? Number(((c.amount / totalExpense) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.amount - a.amount);

    // Cards summary
    const cardsSummary = creditCards.map(c => {
      const cardExpenses = filteredTransactions
        .filter(t => t.paymentMethod === 'CREDIT_CARD' && t.cardId === c.id && t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        name: c.name,
        limit: c.limit,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
        estimatedCurrentBill: cardExpenses
      };
    });

    // Investments summary
    const holdings: Record<string, { quantity: number; totalCost: number; category?: string }> = {};
    const sortedInv = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedInv.forEach(t => {
      if (t.type === TransactionType.INVESTMENT && t.investmentDetails) {
        const { ticker, quantity, event, unitPrice = 0 } = t.investmentDetails;
        if (!holdings[ticker]) holdings[ticker] = { quantity: 0, totalCost: 0 };

        if (event === 'BUY') {
          holdings[ticker].quantity += quantity;
          holdings[ticker].totalCost += (quantity * unitPrice);
        } else if (event === 'SELL') {
          holdings[ticker].quantity -= quantity;
        } else if (event === 'SPLIT') {
          holdings[ticker].quantity *= quantity;
        } else if (event === 'MERGE') {
          holdings[ticker].quantity /= quantity;
        }
      }
    });

    let totalInvested = 0;
    let estimatedValue = 0;
    const assetsList = Object.entries(holdings)
      .filter(([_, data]) => data.quantity > 0)
      .map(([ticker, data]) => {
        const priceInfo = assetPrices.find(p => p.ticker.toUpperCase() === ticker.toUpperCase());
        const currentP = priceInfo ? priceInfo.currentPrice : (data.quantity > 0 ? data.totalCost / data.quantity : 0);
        const val = data.quantity * currentP;
        
        totalInvested += data.totalCost;
        estimatedValue += val;

        return {
          ticker,
          quantity: Number(data.quantity.toFixed(4)),
          avgPrice: Number((data.quantity > 0 ? data.totalCost / data.quantity : 0).toFixed(2)),
          currentPrice: Number(currentP.toFixed(2)),
          totalValue: Number(val.toFixed(2))
        };
      });

    // Sample of recent transactions for granular Q&A
    const recentSample = filteredTransactions.slice(-60).map(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const sub = subCategories.find(s => s.id === t.subCategoryId);
      return {
        date: t.date.split('T')[0],
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: cat?.name || 'Outros',
        subCategory: sub?.name,
        paymentMethod: t.paymentMethod,
        isShared: t.isShared
      };
    });

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const periodLabel = analysisScope === 'current_month'
      ? `${monthNames[curMonth]} de ${curYear}`
      : analysisScope === 'last_3_months'
      ? `Últimos 3 meses até ${monthNames[curMonth]}/${curYear}`
      : 'Todo o histórico de lançamentos cadastrados';

    return {
      period: periodLabel,
      metrics: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        monthlyBudgetLimit: (totalIncome * (settings.monthlyBudgetPercentage || 80)) / 100,
        savingsRate: totalIncome > 0 ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)) : 0
      },
      categoryBreakdown,
      nathySummary: {
        totalNathyExpenses,
        userNetExpenses: totalExpense - totalNathyExpenses,
        sharedTransactionsCount
      },
      creditCards: cardsSummary,
      investments: {
        totalInvested,
        estimatedValue,
        assets: assetsList
      },
      recentTransactionsSample: recentSample
    };
  };

  // Handle Question Submission
  const handleAskQuestion = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: cleanQuery,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const financialSummary = prepareFinancialContext();
      const historyPayload = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text
      }));

      const answer = await GeminiService.askFinances({
        question: cleanQuery,
        financialSummary,
        history: historyPayload
      });

      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: answer,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ **Não foi possível obter a resposta da IA no momento.**\n\nMotivo: ${err.message || 'Erro de conexão ou serviço indisponível.'}\n\n*Por favor, verifique se a chave GEMINI_API_KEY está configurada no painel de configurações ou tente novamente em alguns segundos.*`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const totalRegisteredTrans = transactions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="ai-financial-assistant-modal"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  FinanZe AI Advisor
                </h2>
                <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Gemini 3.7
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Análise inteligente instantânea sobre seus dados financeiros cadastrados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scope Selector */}
            <div className="hidden sm:flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <button
                onClick={() => setAnalysisScope('current_month')}
                className={`px-2.5 py-1 rounded-lg transition-all ${analysisScope === 'current_month' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => setAnalysisScope('last_3_months')}
                className={`px-2.5 py-1 rounded-lg transition-all ${analysisScope === 'last_3_months' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                3 Meses
              </button>
              <button
                onClick={() => setAnalysisScope('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${analysisScope === 'all' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                Tudo
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Status / Data Context Badge */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="flex items-center gap-1 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
              <Layers size={13} className="text-blue-500" />
              {totalRegisteredTrans} lançamentos
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="shrink-0">{categories.length} categorias</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="shrink-0">{creditCards.length} cartões</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="shrink-0">
              Foco: {analysisScope === 'current_month' ? 'Mês Selecionado' : analysisScope === 'last_3_months' ? 'Últimos 3 Meses' : 'Histórico Total'}
            </span>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 shrink-0"
              title="Limpar histórico da conversa"
            >
              <RefreshCw size={11} /> Limpar Chat
            </button>
          )}
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
              <div className="w-16 h-16 rounded-3xl bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-sm">
                <Bot size={32} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                Olá! Como posso analisar seus dados hoje?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-md">
                Pergunte qualquer coisa sobre seus gastos, rendimentos, investimentos cadastrados, contas da Nathy ou faturas de cartão.
              </p>

              {/* Quick Questions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {quickQuestions.map((q, idx) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAskQuestion(q.query)}
                      className="p-3.5 bg-white dark:bg-zinc-800/80 hover:bg-blue-50/80 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 hover:border-blue-300 dark:hover:border-blue-500 rounded-2xl transition-all text-left group shadow-xs"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        <Icon size={14} className="text-blue-500 shrink-0" />
                        {q.title}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {q.query}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <Sparkles size={16} />
                  </div>
                )}

                <div className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 relative group text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10'
                    : 'bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/60 rounded-tl-none shadow-sm'
                }`}>
                  {/* Message content formatted */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {formatMarkdownContent(msg.text)}
                  </div>

                  {msg.role === 'model' && (
                    <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
                        title="Copiar resposta"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-emerald-500" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles size={16} className="animate-spin" />
              </div>
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span>FinanZe AI está consultando e analisando seus lançamentos cadastrados...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(inputQuery);
            }}
            className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 focus-within:border-blue-500 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Pergunte algo sobre seus gastos, receitas, cartões ou investimentos..."
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center shadow-xs"
              title="Enviar Pergunta"
            >
              <Send size={16} />
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span>Dica: Experimente perguntar *"Quanto gastei com mercado este mês?"* ou *"Qual o rendimento da minha carteira?"*</span>
            <span className="hidden sm:inline">Pressione Enter para enviar</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Markdown formatting helper for clean display
function formatMarkdownContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    // Heading 3
    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-2 mb-1">
          {line.replace('### ', '')}
        </h4>
      );
    }
    // Heading 2 / 1
    if (line.startsWith('## ') || line.startsWith('# ')) {
      return (
        <h3 key={index} className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-3 mb-1 border-b border-zinc-100 dark:border-zinc-700 pb-1">
          {line.replace(/^#+\s/, '')}
        </h3>
      );
    }
    // Bullet points
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const clean = line.trim().replace(/^[\*\-]\s/, '');
      return (
        <div key={index} className="flex items-start gap-2 ml-2 my-1">
          <span className="text-blue-500 font-bold mt-0.5">•</span>
          <span className="flex-1">{renderInlineStyles(clean)}</span>
        </div>
      );
    }
    // Empty line
    if (!line.trim()) {
      return <div key={index} className="h-1.5" />;
    }
    // Regular line
    return (
      <p key={index} className="my-0.5">
        {renderInlineStyles(line)}
      </p>
    );
  });
}

function renderInlineStyles(text: string): React.ReactNode {
  // Bold formatting **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
