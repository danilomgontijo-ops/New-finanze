
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, Category, SubCategory, UserSettings, PaymentMethod, CreditCard } from '../types';
import { 
  ArrowUpCircle, ArrowDownCircle, Wallet, Pencil, Trash2, CreditCard as CardIcon, Repeat, Users,
  ChevronDown, ChevronRight, Calendar, Filter, X, Check, Search, ChevronUp, AlertTriangle, AlertCircle, Target, 
  ArrowUp, ArrowDown, ChevronLeft, Sparkles, Banknote, List, CheckCircle2, Layers,
  Utensils, Car, Home, Gamepad, Activity, User, Dog, TrendingUp, Circle, ShoppingBag, Coffee, Smartphone, Hammer, Plane, Music, Gift, Wifi, Zap, Book, Briefcase, Shirt,
  Landmark, DollarSign, Euro, Bitcoin, Gem, Rocket, Star, Heart, Shield, Lock, Key, Globe, Map as MapIcon, Navigation, Flag, Crown, Trophy, Award, ShoppingCart, Truck, Package, Ghost, Smile, ThumbsUp, Tag, Hash, CheckSquare, Square, Save, Loader2, Table, Eye, EyeOff
} from 'lucide-react';
import { StorageService } from '../services/storageService';

// Full Icon Mapping for Transactions List
const IconRenderer = ({ iconName, className }: { iconName: string; className?: string }) => {
  const icons: any = {
    utensils: Utensils, car: Car, home: Home, gamepad: Gamepad, activity: Activity, user: User, dog: Dog, banknote: Banknote,
    'trending-up': TrendingUp, circle: Circle, 'shopping-bag': ShoppingBag, coffee: Coffee, smartphone: Smartphone, hammer: Hammer,
    plane: Plane, music: Music, gift: Gift, wifi: Wifi, zap: Zap, book: Book, briefcase: Briefcase, shirt: Shirt, landmark: Landmark,
    'credit-card': CardIcon, wallet: Wallet, 'dollar-sign': DollarSign, euro: Euro, bitcoin: Bitcoin, gem: Gem, rocket: Rocket,
    star: Star, heart: Heart, shield: Shield, lock: Lock, key: Key, globe: Globe, map: MapIcon, navigation: Navigation, flag: Flag,
    crown: Crown, trophy: Trophy, award: Award, 'shopping-cart': ShoppingCart, truck: Truck, package: Package, ghost: Ghost,
    smile: Smile, 'thumbs-up': ThumbsUp
  };

  const IconComponent = icons[iconName] || Circle;
  return <IconComponent className={className} />;
};

const formatCurrency = (val: number) => 
  (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function calculateEffectiveDate(t: Transaction, creditCards: CreditCard[], settings: UserSettings): Date {
    if (t.manualAccountingDate) {
        const mDate = new Date(t.manualAccountingDate);
        if (!isNaN(mDate.getTime())) return mDate;
    }
    let date = new Date(t.date);
    if (isNaN(date.getTime())) date = new Date();
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

const PaymentConfirmationModal = ({ isOpen, onClose, transaction, onConfirm }: { isOpen: boolean, onClose: () => void, transaction: Transaction | null, onConfirm: (t: Transaction) => void }) => {
    if (!isOpen || !transaction) return null;
    return (
        <div className="fixed inset-0 bg-white dark:bg-zinc-900/80 dark:bg-zinc-900/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Confirmar Pagamento?</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-2 mb-1 px-4">
                        Deseja marcar <strong>"{transaction.description}"</strong> como pago neste mês?
                    </p>
                    <p className="text-lg font-semibold text-emerald-600 mt-2">R$ {(transaction.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex border-t border-zinc-200 dark:border-zinc-800">
                    <button onClick={onClose} className="flex-1 py-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 transition-colors">Cancelar</button>
                    <div className="w-px bg-zinc-100 dark:bg-zinc-800"></div>
                    <button onClick={() => onConfirm(transaction)} className="flex-1 py-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

const DuplicateResolverModal = ({ isOpen, onClose, duplicateGroups, onDelete }: { isOpen: boolean, onClose: () => void, duplicateGroups: Transaction[][], onDelete: (id: string) => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-white dark:bg-zinc-900/80 dark:bg-zinc-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle size={24} /></div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Resolver Duplicatas</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">Encontramos transações idênticas neste mês.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:bg-amber-100 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
                    {duplicateGroups.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500"><Check size={48} className="mx-auto mb-4 text-emerald-500" /><p>Tudo limpo! Nenhuma duplicata restante.</p></div>
                    ) : (
                        duplicateGroups.map((group, idx) => (
                            <div key={idx} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm shadow-zinc-200/5">
                                <div className="bg-zinc-50 dark:bg-zinc-950 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Grupo {idx + 1}</span>
                                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">{group[0].date.split('T')[0]}</span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {group.map((t, tIdx) => (
                                        <div key={t.id} className="p-4 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 transition-colors">
                                            <div><p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{t.description}</p><p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">R$ {t.amount.toFixed(2)} • {t.paymentMethod === PaymentMethod.CREDIT_CARD ? 'Crédito' : 'Débito'}</p></div>
                                            <div className="flex items-center gap-3">{tIdx === 0 ? (<span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">Manter</span>) : (<button onClick={() => onDelete(t.id)} className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100"><Trash2 size={14} /> Apagar</button>)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-right"><button onClick={onClose} className="px-6 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors shadow-sm shadow-zinc-200/5">Concluído</button></div>
            </div>
        </div>
    );
};

interface TransactionGroupProps { 
    title: string | React.ReactNode; 
    items: Transaction[]; 
    icon?: React.ReactNode; 
    colorClass?: string; 
    total: number; 
    secondaryTotal?: number; 
    renderRow: (t: Transaction) => React.ReactNode;
    selectedIds: string[];
    onToggleSelectAll: (items: Transaction[]) => void;
}

const TransactionGroup: React.FC<TransactionGroupProps> = ({ 
    title, items, icon, colorClass, total, secondaryTotal, renderRow, selectedIds, onToggleSelectAll
}) => {
    const [isOpen, setIsOpen] = useState(true);
    if (items.length === 0) return null;

    const allSelected = items.length > 0 && items.every(i => selectedIds.includes(i.id));

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800/60 dark:border-zinc-800/80 overflow-hidden mb-4">
            <div 
                className="w-full bg-white dark:bg-zinc-900 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 transition-colors border-b border-zinc-200 dark:border-zinc-800"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleSelectAll(items); }}
                        className={`p-1 rounded-md transition-all ${allSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500'}`}
                        title={allSelected ? "Desmarcar Todos" : "Marcar Todos do Grupo"}
                    >
                        {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className={`flex items-center gap-2 ${colorClass}`}>
                        {icon}
                        <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{title}</span>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-zinc-700 dark:text-zinc-300" /> : <ChevronDown size={14} className="text-zinc-700 dark:text-zinc-300" />}
                </div>
                <div className="text-right">
                    <span className={`font-medium text-sm ${colorClass}`}>R$ {(total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    {secondaryTotal !== undefined && Math.abs(secondaryTotal - total) > 0.01 && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium block">Minha parte: R$ {(secondaryTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    )}
                </div>
            </div>
            
            {isOpen && (
                <div className="p-2 space-y-2 bg-zinc-50 dark:bg-zinc-950/30 animate-in slide-in-from-top-1">
                    {items.map(t => renderRow(t))}
                </div>
            )}
        </div>
    );
};

const YearlyView = ({ transactions, categories, subCategories, creditCards, settings, year }: { transactions: Transaction[], categories: Category[], subCategories: SubCategory[], creditCards: CreditCard[], settings: UserSettings, year: number }) => {
    const [viewType, setViewType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
    
    const toggleCat = (id: string) => { 
        if (viewType === TransactionType.INCOME || viewType === TransactionType.INVESTMENT) return; 
        const next = new Set(expandedCats); 
        if (next.has(id)) next.delete(id); else next.add(id); 
        setExpandedCats(next); 
    };

    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // 1. Calculate Aggregated Yearly Summary (Income, Expense, Investment, Balance)
    const yearlySummary = useMemo(() => {
        const summary = Array(12).fill(null).map(() => ({ income: 0, expense: 0, investment: 0, balance: 0 }));
        
        transactions.forEach(t => {
            const effDate = calculateEffectiveDate(t, creditCards, settings);
            if (effDate.getFullYear() !== year) return;
            const m = effDate.getMonth();
            
            if (t.type === TransactionType.INCOME) summary[m].income += t.amount;
            else if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) summary[m].expense += t.amount;
            else if (t.type === TransactionType.INVESTMENT) {
                const ev = t.investmentDetails?.event;
                if (ev === 'BUY' || ev === 'BONUS') summary[m].investment += t.amount;
                else if (['SELL', 'AMORTIZACAO', 'DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(ev || '')) summary[m].investment -= t.amount;
            }
        });

        // Calculate Balance
        summary.forEach(month => {
            month.balance = month.income - month.expense; 
        });

        return summary;
    }, [transactions, creditCards, settings, year]);

    // 2. Existing Category Logic
    const monthlyLookup = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(t => {
            if (t.type !== viewType) return;
            const effDate = calculateEffectiveDate(t, creditCards, settings);
            const y = effDate.getFullYear(); const m = effDate.getMonth();
            const catKey = `${y}-${m}-${t.categoryId}-all`;
            const subKey = (viewType === TransactionType.EXPENSE && t.subCategoryId) ? `${y}-${m}-${t.categoryId}-${t.subCategoryId}` : null;
            
            let amountToAdd = t.amount;
            if (viewType === TransactionType.INVESTMENT) {
                const ev = t.investmentDetails?.event;
                if (['SELL', 'AMORTIZACAO', 'DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(ev || '')) {
                    amountToAdd = -t.amount;
                } else if (!['BUY', 'BONUS'].includes(ev || '')) {
                    amountToAdd = 0;
                }
            }

            map.set(catKey, (map.get(catKey) || 0) + amountToAdd);
            if (subKey) map.set(subKey, (map.get(subKey) || 0) + amountToAdd);
        });
        return map;
    }, [transactions, creditCards, settings, viewType, year]);

    const getPriorAverage = (targetYear: number, targetMonthIndex: number, catId: string, subId: string = 'all') => {
        let sum = 0; let count = 0;
        for (let i = 1; i <= 6; i++) {
            const d = new Date(targetYear, targetMonthIndex - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}-${catId}-${subId}`;
            const val = monthlyLookup.get(key);
            if (val !== undefined) { sum += val; count++; } else { count++; }
        }
        return count > 0 ? sum / count : 0;
    };
    
    const matrix = useMemo(() => {
        const data: any = {}; const monthlyTotals = new Array(12).fill(0);
        categories.filter(c => c.type === viewType).forEach(c => {
            data[c.id] = { id: c.id, name: c.name, icon: c.icon, color: c.color, total: 0, months: new Array(12).fill(null).map(() => ({ val: 0, avg: 0 })), subcats: {} };
        });
        transactions.forEach(t => {
            const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
            if (effectiveDate.getFullYear() !== year || t.type !== viewType) return;
            const month = effectiveDate.getMonth(); const catId = t.categoryId;
            if (data[catId]) {
                let amountToAdd = t.amount;
                if (viewType === TransactionType.INVESTMENT) {
                    const ev = t.investmentDetails?.event;
                    if (['SELL', 'AMORTIZACAO', 'DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(ev || '')) {
                        amountToAdd = -t.amount;
                    } else if (!['BUY', 'BONUS'].includes(ev || '')) {
                        amountToAdd = 0; // Ignore SPLIT, MERGE, etc. for totals
                    }
                }

                data[catId].months[month].val += amountToAdd; data[catId].total += amountToAdd; monthlyTotals[month] += amountToAdd;
                
                if (viewType === TransactionType.EXPENSE) {
                    let subId = 'uncategorized'; 
                    if (t.subCategoryId) { 
                        const sub = subCategories.find(s => s.id === t.subCategoryId); 
                        if (sub && sub.categoryId === catId) subId = t.subCategoryId; 
                    }
                    if (!data[catId].subcats[subId]) { 
                        const subName = subCategories.find(s => s.id === subId)?.name || '...'; 
                        data[catId].subcats[subId] = { name: subId === 'uncategorized' ? 'Sem Subcategoria' : subName, total: 0, months: new Array(12).fill(null).map(() => ({ val: 0, avg: 0 })) }; 
                    }
                    data[catId].subcats[subId].total += amountToAdd; 
                    data[catId].subcats[subId].months[month].val += amountToAdd;
                }
            }
        });
        Object.values(data).forEach((cat: any) => { 
            for (let m = 0; m < 12; m++) { 
                cat.months[m].avg = getPriorAverage(year, m, cat.id, 'all'); 
                Object.keys(cat.subcats).forEach(subId => { 
                    const realSubId = subId === 'uncategorized' ? null : subId; 
                    if (realSubId) cat.subcats[subId].months[m].avg = getPriorAverage(year, m, cat.id, realSubId); 
                }); 
            } 
        });
        return { items: Object.values(data).sort((a: any, b: any) => b.total - a.total), monthlyTotals };
    }, [transactions, categories, subCategories, creditCards, settings, year, monthlyLookup, viewType]);

    const renderCell = (val: number, avg: number, isSub = false) => {
        if (val === 0) return <span className="text-zinc-800 dark:text-zinc-200">-</span>;
        let icon = null; 
        if (avg > 0) { 
            if (val > avg * 1.05) icon = <ArrowUp size={isSub ? 8 : 10} className={viewType === TransactionType.INCOME ? "text-emerald-500 shrink-0" : "text-red-500 shrink-0"} strokeWidth={3} />; 
            else if (val < avg * 0.95) icon = <ArrowDown size={isSub ? 8 : 10} className={viewType === TransactionType.INCOME ? "text-red-500 shrink-0" : "text-emerald-500 shrink-0"} strokeWidth={3} />; 
        }
        return (<div className="flex items-center justify-end gap-1 w-full">{icon}<span className={isSub ? "" : "font-medium"}>{(Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>);
    };

    return (
        <div className="space-y-6">
            {/* Yearly Financial Summary Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800/60 dark:border-zinc-800/80 overflow-hidden animate-in fade-in">
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
                    <Table size={16} className="text-zinc-900 dark:text-zinc-100" />
                    <h3 className="text-xs font-medium text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">Resumo Financeiro Anual</h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-950/50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium">
                                <th className="px-3 py-2 text-left w-32 sticky left-0 bg-zinc-50 dark:bg-zinc-950 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">Tipo</th>
                                <th className="px-2 py-2 text-right font-medium bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 min-w-[80px]">Total</th>
                                {MONTHS.map(m => <th key={m} className="px-1 py-2 text-center min-w-[70px]">{m}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Receitas */}
                            <tr className="hover:bg-emerald-50/30 transition-colors">
                                <td className="px-3 py-2.5 font-semibold text-emerald-600 sticky left-0 bg-white dark:bg-zinc-900 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-2">
                                    <ArrowUpCircle size={14} /> Receitas
                                </td>
                                <td className="px-2 py-2.5 text-right font-medium text-emerald-700 bg-zinc-50 dark:bg-zinc-950/30">
                                    {(yearlySummary.reduce((acc, m) => acc + m.income, 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                                </td>
                                {yearlySummary.map((m, i) => (
                                    <td key={i} className="px-1 py-2.5 text-center text-emerald-600 font-medium">
                                        {m.income > 0 ? (m.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </td>
                                ))}
                            </tr>
                            
                            {/* Despesas */}
                            <tr className="hover:bg-red-50/30 transition-colors">
                                <td className="px-3 py-2.5 font-medium text-red-600 sticky left-0 bg-white dark:bg-zinc-900 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-2">
                                    <ArrowDownCircle size={14} /> Despesas
                                </td>
                                <td className="px-2 py-2.5 text-right font-medium text-red-700 bg-zinc-50 dark:bg-zinc-950/30">
                                    {(yearlySummary.reduce((acc, m) => acc + m.expense, 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                                </td>
                                {yearlySummary.map((m, i) => (
                                    <td key={i} className="px-1 py-2.5 text-center text-red-600 font-medium">
                                        {m.expense > 0 ? (m.expense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </td>
                                ))}
                            </tr>

                            {/* Investimentos */}
                            <tr className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-3 py-2.5 font-medium text-blue-600 sticky left-0 bg-white dark:bg-zinc-900 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-2">
                                    <TrendingUp size={14} /> Investido
                                </td>
                                <td className="px-2 py-2.5 text-right font-medium text-blue-700 bg-zinc-50 dark:bg-zinc-950/30">
                                    {(yearlySummary.reduce((acc, m) => acc + m.investment, 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                                </td>
                                {yearlySummary.map((m, i) => (
                                    <td key={i} className="px-1 py-2.5 text-center text-blue-600 font-medium">
                                        {m.investment > 0 ? (m.investment || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </td>
                                ))}
                            </tr>

                            {/* Saldo */}
                            <tr className="bg-zinc-50 dark:bg-zinc-950 font-medium border-t border-zinc-200 dark:border-zinc-800">
                                <td className="px-3 py-2.5 text-zinc-800 dark:text-zinc-200 sticky left-0 bg-zinc-50 dark:bg-zinc-950 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-2">
                                    <Wallet size={14} /> Saldo
                                </td>
                                <td className="px-2 py-2.5 text-right text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950">
                                    {(yearlySummary.reduce((acc, m) => acc + m.balance, 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                                </td>
                                {yearlySummary.map((m, i) => (
                                    <td key={i} className={`px-1 py-2.5 text-center ${m.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {m.balance !== 0 ? (m.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Existing Category Detailed View */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800/60 dark:border-zinc-800/80 overflow-hidden animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-center border-b border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-950/50 dark:bg-zinc-950/50 gap-3">
                    <div className="flex items-center gap-2">
                        <List size={16} className="text-zinc-900 dark:text-zinc-100" />
                        <h3 className="text-xs font-medium text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">Detalhamento por Categoria</h3>
                    </div>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full">
                        <button onClick={() => setViewType(TransactionType.EXPENSE)} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${viewType === TransactionType.EXPENSE ? 'bg-white dark:bg-zinc-900 shadow text-red-600' : 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200'}`}>Despesas</button>
                        <button onClick={() => setViewType(TransactionType.INCOME)} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${viewType === TransactionType.INCOME ? 'bg-white dark:bg-zinc-900 shadow text-emerald-600' : 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200'}`}>Receitas</button>
                        <button onClick={() => setViewType(TransactionType.INVESTMENT)} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${viewType === TransactionType.INVESTMENT ? 'bg-white dark:bg-zinc-900 shadow text-blue-600' : 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200'}`}>Investimentos</button>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                        <thead><tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium"><th className="px-2 py-2 text-left w-40 sticky left-0 bg-zinc-50 dark:bg-zinc-950 z-10 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">Categoria</th><th className="px-2 py-2 text-right bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-medium min-w-[70px]">Total</th>{MONTHS.map(m => (<th key={m} className="px-1 py-2 text-center min-w-[60px]">{m}</th>))}</tr></thead>
                        <tbody>
                            <tr className="bg-zinc-50 dark:bg-zinc-950 font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800"><td className="px-2 py-2 sticky left-0 bg-zinc-50 dark:bg-zinc-950 z-10 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">TOTAL</td><td className="px-2 py-2 text-right text-zinc-900 dark:text-zinc-100 truncate">{(Number(matrix.items.reduce((acc: number, item: any) => acc + item.total, 0)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>{matrix.monthlyTotals.map((val: number, i: number) => (<td key={i} className="px-1 py-2 text-center text-[10px]">{val > 0 ? (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>))}</tr>
                            {(matrix.items as any[]).map(cat => (
                                <React.Fragment key={cat.id}>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 cursor-pointer transition-colors group" onClick={() => toggleCat(cat.id)}>
                                        <td className="px-2 py-2 sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 z-10 shadow-[1px_0_2px_rgba(0,0,0,0.05)] flex items-center gap-1.5 h-full">
                                            <div className="w-4 h-4 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"><span className="text-[8px]" style={{color: cat.color}}>●</span></div>
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{cat.name}</span>
                                            {viewType === TransactionType.EXPENSE && (expandedCats.has(cat.id) ? <ChevronDown size={12} className="ml-auto text-zinc-500 dark:text-zinc-400 dark:text-zinc-500"/> : <ChevronRight size={12} className="ml-auto text-zinc-500 dark:text-zinc-400 dark:text-zinc-500"/>)}
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/30 truncate">{(Number(cat.total) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        {cat.months.map((m: any, i: number) => (<td key={i} className={`px-1 py-2 text-center text-[10px] ${m.val === 0 ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-300'}`}>{renderCell(m.val, m.avg)}</td>))}
                                    </tr>
                                    {expandedCats.has(cat.id) && Object.entries(cat.subcats).map(([subId, sub]: [string, any]) => (<tr key={subId} className="bg-zinc-50 dark:bg-zinc-950/30 text-[10px] border-b border-zinc-200 dark:border-zinc-800"><td className="px-2 py-1 pl-8 sticky left-0 bg-zinc-50 dark:bg-zinc-950 z-10 shadow-[1px_0_2px_rgba(0,0,0,0.05)] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 italic truncate">{sub.name}</td><td className="px-2 py-1 text-right text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium truncate">{(Number(sub.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>{sub.months.map((m: any, i: number) => (<td key={i} className="px-1 py-1 text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">{renderCell(m.val, m.avg, true)}</td>))}</tr>))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  currentDate: Date;
  settings: UserSettings;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string, mode?: 'single' | 'future' | 'all') => void;
  onDateChange: (date: Date) => void;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({ 
    transactions, categories, subCategories, creditCards, currentDate, settings, 
    onEditTransaction, onDeleteTransaction, onDateChange
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]); 
  const [creditCardFilter, setCreditCardFilter] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCardFilterOpen, setIsCardFilterOpen] = useState(false);
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterOnlyInstallments, setFilterOnlyInstallments] = useState(false);
  const [filterOnlyShared, setFilterOnlyShared] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [isNathyExpanded, setIsNathyExpanded] = useState(true);
  const [showDuplicateResolver, setShowDuplicateResolver] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false); // Estado para controlar se o alerta foi ignorado

  // Payment Confirmation State
  const [paymentConfirmationTx, setPaymentConfirmationTx] = useState<Transaction | null>(null);

  // Batch Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchEditDescription, setBatchEditDescription] = useState('');
  const [batchEditCategoryId, setBatchEditCategoryId] = useState('');
  const [batchEditSubCategoryId, setBatchEditSubCategoryId] = useState('');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Investment Details Toggle
  const [showMonthInvestments, setShowMonthInvestments] = useState(false);

  const toggleCategoryFilter = (catId: string) => { setCategoryFilter(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]); };
  const toggleCreditCardFilter = (cardId: string) => { setCreditCardFilter(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]); };
  const clearFilter = () => { setCategoryFilter([]); setCreditCardFilter([]); setFilterStartDate(''); setFilterEndDate(''); setFilterOnlyInstallments(false); setFilterOnlyShared(false); setFilterTag(''); setCatSearchTerm(''); setSelectedIds([]); };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleSelectAllGroup = (items: Transaction[]) => {
    const itemIds = items.map(i => i.id);
    const allInSelected = itemIds.every(id => selectedIds.includes(id));
    if (allInSelected) {
        setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
        setSelectedIds(prev => [...new Set([...prev, ...itemIds])]);
    }
  };

  const handleConfirmPayment = async (t: Transaction) => {
      await StorageService.updateTransaction({ ...t, isPaid: true }, 'single');
      setPaymentConfirmationTx(null);
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.length === 0) return;
    if (!batchEditDescription && !batchEditCategoryId && !batchEditSubCategoryId) {
        alert("Preencha ao menos um campo para atualizar.");
        return;
    }

    setIsBatchUpdating(true);
    try {
        const promises = selectedIds.map(id => {
            const t = transactions.find(tx => tx.id === id);
            if (!t) return Promise.resolve();
            const updates: Partial<Transaction> = {};
            if (batchEditDescription) updates.description = batchEditDescription;
            if (batchEditCategoryId) updates.categoryId = batchEditCategoryId;
            if (batchEditSubCategoryId) updates.subCategoryId = batchEditSubCategoryId;
            return StorageService.updateTransaction({ ...t, ...updates });
        });
        await Promise.all(promises);
        setSelectedIds([]);
        setBatchEditDescription('');
        setBatchEditCategoryId('');
        setBatchEditSubCategoryId('');
        alert(`${selectedIds.length} lançamentos atualizados.`);
    } catch (e) {
        console.error(e);
        alert("Erro ao atualizar lançamentos.");
    } finally {
        setIsBatchUpdating(false);
    }
  };

  // Date Navigation Handlers
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

  const currentMonthTransactions = useMemo(() => {
      const isCustomRangeActive = filterStartDate || filterEndDate;

      return transactions.filter(t => {
          // A) Restrição Temporal
          if (isCustomRangeActive) {
              const tDateStr = t.date.split('T')[0];
              if (filterStartDate && tDateStr < filterStartDate) return false;
              if (filterEndDate && tDateStr > filterEndDate) return false;
          } else {
              const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
              if (effectiveDate.getMonth() !== currentDate.getMonth() || 
                  effectiveDate.getFullYear() !== currentDate.getFullYear()) {
                  return false;
              }
          }

          // B) Busca por Tag ou Descrição
          if (filterTag) {
              const term = filterTag.toLowerCase();
              if (term.startsWith('#')) {
                  const tagOnly = term.slice(1).trim();
                  const hasTag = t.tags?.some(tag => tag.toLowerCase().includes(tagOnly));
                  if (!hasTag) return false;
              } else {
                  const hasTag = t.tags?.some(tag => tag.toLowerCase().includes(term));
                  const hasDesc = t.description.toLowerCase().includes(term);
                  if (!hasTag && !hasDesc) return false;
              }
          }

          // C) Outros filtros
          if (categoryFilter.length > 0 && !categoryFilter.includes(t.categoryId)) return false;
          if (creditCardFilter.length > 0 && (!t.creditCardId || !creditCardFilter.includes(t.creditCardId))) return false;
          if (filterOnlyInstallments && (!t.totalInstallments || t.totalInstallments <= 1)) return false;
          if (filterOnlyShared && !t.isShared) return false;
          
          // We now exclude investments from the main list to avoid duplication
          if (t.type === TransactionType.INVESTMENT) return false;

          return true;
      });
  }, [transactions, currentDate, creditCards, settings, categoryFilter, creditCardFilter, filterStartDate, filterEndDate, filterOnlyInstallments, filterOnlyShared, filterTag]);

  // Investment Summary Calculation (For Widget)
  const investmentSummary = useMemo(() => {
      let invested = 0;
      let dividends = 0;
      let redeemed = 0;
      let income = 0;

      transactions.forEach(t => {
          const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
          const isMatch = viewMode === 'monthly' 
              ? (effectiveDate.getMonth() === currentDate.getMonth() && effectiveDate.getFullYear() === currentDate.getFullYear())
              : (effectiveDate.getFullYear() === selectedYear);

          if (isMatch) {
              if (t.type === TransactionType.INVESTMENT) {
                  const ev = t.investmentDetails?.event;
                  if (ev === 'BUY' || ev === 'BONUS') {
                      invested += t.amount;
                  } else if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(ev || '')) {
                      dividends += t.amount;
                  } else if (['SELL', 'AMORTIZACAO'].includes(ev || '')) {
                      redeemed += t.amount;
                  }
              }
              if (t.type === TransactionType.INCOME) income += t.amount;
          }
      });
      const targetPct = Math.max(0, 100 - settings.monthlyBudgetPercentage);
      const targetAmount = income * (targetPct / 100);
      
      return { invested: invested - redeemed - dividends, dividends, redeemed, targetAmount, targetPct };
  }, [transactions, currentDate, selectedYear, viewMode, creditCards, settings]);

  const monthlyInvestments = useMemo(() => {
      const buys: Transaction[] = [];
      const divs: Transaction[] = [];
      const sells: Transaction[] = [];
      const corporate: Transaction[] = [];

      transactions.forEach(t => {
          if (t.type !== TransactionType.INVESTMENT) return;
          const effectiveDate = calculateEffectiveDate(t, creditCards, settings);
          const isMatch = viewMode === 'monthly' 
              ? (effectiveDate.getMonth() === currentDate.getMonth() && effectiveDate.getFullYear() === currentDate.getFullYear())
              : (effectiveDate.getFullYear() === selectedYear);

          if (isMatch) {
              const ev = t.investmentDetails?.event;
              if (ev === 'BUY' || ev === 'BONUS') buys.push(t);
              else if (['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(ev || '')) divs.push(t);
              else if (['SELL', 'AMORTIZACAO'].includes(ev || '')) sells.push(t);
              else if (['SPLIT', 'MERGE', 'TICKER_UPDATE'].includes(ev || '')) corporate.push(t);
          }
      });

      const sortFn = (a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime();
      return {
          buys: buys.sort(sortFn),
          divs: divs.sort(sortFn),
          sells: sells.sort(sortFn),
          corporate: corporate.sort(sortFn)
      };
  }, [transactions, currentDate, creditCards, settings]);

  const yearlyFilteredTransactions = useMemo(() => {
      return transactions.filter(t => {
          if (categoryFilter.length > 0 && !categoryFilter.includes(t.categoryId)) return false;
          if (creditCardFilter.length > 0 && (!t.creditCardId || !creditCardFilter.includes(t.creditCardId))) return false;
          if (filterOnlyInstallments && (!t.totalInstallments || t.totalInstallments <= 1)) return false;
          if (filterOnlyShared && !t.isShared) return false;
          if (filterTag) {
              const tagLower = filterTag.toLowerCase();
              const hasTag = t.tags?.some(tag => tag.toLowerCase().includes(tagLower));
              const hasDesc = t.description.toLowerCase().includes(tagLower);
              if (!hasTag && !hasDesc) return false;
          }
          return true;
      });
  }, [transactions, categoryFilter, creditCardFilter, filterOnlyInstallments, filterOnlyShared, filterTag]);

  const estimatedFixedExpenses = useMemo(() => {
      const now = new Date();
      const viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const realNow = new Date(now.getFullYear(), now.getMonth(), 1);
      const isFuture = viewDate > realNow;
      
      const estimates: Record<string, number> = {};
      if (isFuture) {
          currentMonthTransactions.forEach(t => {
              if (t.isFixed && t.fixedGroupId) {
                  const txDate = new Date(t.date);
                  const lookbackDate = new Date(txDate);
                  lookbackDate.setMonth(lookbackDate.getMonth() - 6);

                  const pastOccurrences = transactions.filter(pt => 
                      pt.fixedGroupId === t.fixedGroupId && 
                      new Date(pt.date) < txDate && 
                      new Date(pt.date) >= lookbackDate
                  );

                  if (pastOccurrences.length > 0) {
                      const sortedPast = pastOccurrences.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      const recent = sortedPast.slice(0, 6);
                      const avg = recent.reduce((sum, item) => sum + item.amount, 0) / recent.length;
                      const lastOccurrence = sortedPast[0];
                      const isCopy = Math.abs(t.amount - lastOccurrence.amount) < 0.01;

                      if (isCopy && Math.abs(avg - t.amount) > 0.01) {
                          estimates[t.id] = avg;
                      }
                  }
              }
          });
      }
      return estimates;
  }, [currentMonthTransactions, transactions, currentDate]);

  const potentialDuplicateGroups = useMemo(() => {
      const groups: Record<string, Transaction[]> = {};
      currentMonthTransactions.forEach(t => {
          const cleanDesc = t.description.trim().toLowerCase();
          const dateKey = t.date.split('T')[0];
          const key = `${dateKey}|${t.amount}|${cleanDesc}|${t.categoryId}|${t.type}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(t);
      });
      return Object.values(groups).filter(g => g.length > 1);
  }, [currentMonthTransactions]);

  const { mainTransactions, nathyTransactions } = useMemo(() => {
      const nathyId = categories.find(c => c.name.toLowerCase() === 'nathy')?.id;
      const main: Transaction[] = []; const nathy: Transaction[] = [];
      currentMonthTransactions.forEach(t => {
          const isNathyCategory = nathyId && t.categoryId === nathyId;
          const isNathyDesc = t.description.toLowerCase().includes('(parte nathy)');
          if (isNathyCategory || isNathyDesc) nathy.push(t); else main.push(t);
      });
      return { mainTransactions: main, nathyTransactions: nathy };
  }, [currentMonthTransactions, categories]);

  const groupTransactionsByCard = (txs: Transaction[], allTxs: Transaction[]) => {
      const nathyCategoryId = categories.find(c => c.name.toLowerCase() === 'nathy')?.id;
      const sortTransactions = (a: Transaction, b: Transaction) => {
          const aIsI = (a.totalInstallments || 1) > 1; const bIsI = (b.totalInstallments || 1) > 1;
          if (aIsI && !bIsI) return -1; if (!aIsI && bIsI) return 1;
          if (a.isFixed && !b.isFixed) return -1; if (!a.isFixed && b.isFixed) return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      };
      const credits = txs.filter(t => t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD);
      const debits = txs.filter(t => t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.DEBIT_CASH);
      const incomes = txs.filter(t => t.type === TransactionType.INCOME);
      const investments = txs.filter(t => t.type === TransactionType.INVESTMENT);
      const allCredits = allTxs.filter(t => t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD);
      const groupedCredit = creditCards.map(card => {
          const items = credits.filter(t => t.creditCardId === card.id);
          const totalItems = allCredits.filter(t => t.creditCardId === card.id);
          if (items.length === 0 && totalItems.length === 0) return null;
          const totalInvoice = totalItems.reduce((sum, t) => sum + (estimatedFixedExpenses[t.id] !== undefined ? estimatedFixedExpenses[t.id] : t.amount), 0);
          const myPart = totalItems.reduce((sum, t) => { 
              const isNathy = (nathyCategoryId && t.categoryId === nathyCategoryId) || t.description.toLowerCase().includes('(parte nathy)'); 
              const amountToUse = estimatedFixedExpenses[t.id] !== undefined ? estimatedFixedExpenses[t.id] : t.amount;
              if (t.isShared) {
                  return sum + (amountToUse / 2);
              } else if (isNathy) {
                  return sum;
              } else {
                  return sum + amountToUse;
              }
          }, 0);
          return { id: card.id, name: card.name, color: card.color, total: totalInvoice, myTotal: myPart, items: items.sort(sortTransactions) };
      }).filter(Boolean) as { id: string, name: string, color: string, total: number, myTotal: number, items: Transaction[] }[];
      
      return { 
          groupedCredit, 
          debits: debits.sort(sortTransactions), 
          incomes: incomes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          investments: investments.sort(sortTransactions)
      };
  };

  const myGrouped = groupTransactionsByCard(mainTransactions, currentMonthTransactions);
  const nathyGrouped = groupTransactionsByCard(nathyTransactions, currentMonthTransactions);

  const handleDeleteRequest = (t: Transaction) => {
      setDeletingTransaction(t);
  };

  const renderTransactionRow = (t: Transaction) => {
    const isI = (t.totalInstallments || 1) > 1; 
    const category = categories.find(c => c.id === t.categoryId); 
    const sub = subCategories.find(s => s.id === t.subCategoryId);
    const catColor = category?.color || '#cbd5e1'; 
    const isEst = estimatedFixedExpenses[t.id] !== undefined; 
    const amountToD = isEst ? estimatedFixedExpenses[t.id] : t.amount;
    
    // Row background logic
    let rowBg = 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'; 
    if (t.isFixed) rowBg = 'bg-amber-50/40 border-amber-100 hover:bg-amber-100/50';
    else if (isI) rowBg = 'bg-purple-50/40 border-purple-100 hover:bg-purple-100/50';
    
    const isSelected = selectedIds.includes(t.id);
    const finalClass = isSelected ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700' : rowBg;
    
    return (
        <div key={t.id} className={`px-4 py-3 flex items-center justify-between rounded-xl border transition-all group cursor-pointer ${finalClass}`} onClick={() => onEditTransaction(t)}>
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                {/* Selection */}
                <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleSelection(t.id); }}
                    className={`p-1 -ml-2 rounded-full transition-all ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:bg-zinc-700'}`}
                >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {/* Date & Icon */}
                <div className="flex flex-col items-center justify-center min-w-[32px]">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 leading-none">
                        {(() => {
                            let d = new Date(t.date);
                            if (isNaN(d.getTime())) d = new Date();
                            return d.getUTCDate().toString().padStart(2, '0');
                        })()}
                    </span>
                    <span className="text-[9px] font-medium text-zinc-700 dark:text-zinc-300 uppercase leading-none mt-0.5">
                        {(() => {
                            let d = new Date(t.date);
                            if (isNaN(d.getTime())) d = new Date();
                            return d.toLocaleDateString('pt-BR', {month: 'short'}).replace('.','');
                        })()}
                    </span>
                </div>

                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-zinc-200/5 text-white`} style={{ backgroundColor: catColor }}>
                    <IconRenderer iconName={category?.icon || 'circle'} className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex flex-col min-w-0 pr-2">
                    <p className={`font-medium text-sm truncate ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker 
                            ? <><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t.investmentDetails.ticker}</span> - {t.description.replace(t.investmentDetails.ticker, '').replace(/^-/, '').trim()}</>
                            : t.description.replace(/\s\(\d+\/\d+\)$/, '')
                        }
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-medium truncate max-w-[120px]" style={{ color: catColor }}>
                            {category?.name || 'Sem categoria'}
                        </span>
                        {sub && <span className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium truncate">› {sub.name}</span>}
                        {isI && <span className="text-[9px] font-medium bg-purple-100 text-purple-700 px-1.5 rounded flex items-center gap-0.5 h-4"><Repeat size={8}/> {t.installmentIndex}/{t.totalInstallments}</span>}
                        {t.isFixed && <span className="text-[9px] font-medium bg-amber-100 text-amber-700 px-1.5 rounded flex items-center gap-0.5 h-4">FIXO</span>}
                        {t.fundedByResgate && <span className="text-[9px] font-medium bg-purple-100 text-purple-700 px-1.5 rounded flex items-center gap-0.5 h-4">RESGATE</span>}
                        {t.excludeFromBudget && <span className="text-[9px] font-medium bg-rose-100 text-rose-700 px-1.5 rounded flex items-center gap-0.5 h-4"><Target size={8} /> FORA DA META</span>}
                        {!t.isPaid && t.type === TransactionType.EXPENSE && t.paymentMethod !== PaymentMethod.CREDIT_CARD && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setPaymentConfirmationTx(t); }}
                                className="text-[9px] font-medium bg-amber-100 text-amber-700 px-1.5 rounded border border-amber-200 uppercase flex items-center gap-1 hover:bg-amber-200 transition-colors h-4"
                            >
                                <AlertCircle size={8} /> Pendente
                            </button>
                        )}
                        {t.isPaid && t.type === TransactionType.EXPENSE && t.paymentMethod !== PaymentMethod.CREDIT_CARD && (
                            <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 rounded h-4 flex items-center">Pago</span>
                        )}
                        {t.tags?.map((tag, i) => <span key={i} className="text-[9px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1 rounded h-4 flex items-center">#{tag}</span>)}
                    </div>
                </div>
            </div>

            {/* Amount & Actions */}
            <div className="flex flex-col items-end gap-1">
                <span className={`font-medium text-sm tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-600' : (t.amount < 0 ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100')}`}>
                    {t.type === TransactionType.INCOME ? '+' : (t.type === TransactionType.EXPENSE ? '-' : '')} R$ {(amountToD || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEditTransaction(t); }} className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 dark:text-zinc-100 p-1 hover:bg-zinc-200 dark:bg-zinc-700 rounded-md transition-colors"><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(t); }} className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-red-600 p-1 hover:bg-zinc-200 dark:bg-zinc-700 rounded-md transition-colors"><Trash2 size={14} /></button>
                </div>
            </div>
        </div>
    );
  };

  const filteredCategories = categories.filter(c => 
      c.name.toLowerCase().includes(catSearchTerm.toLowerCase())
  );

  const activeFilterCount = (categoryFilter.length > 0 ? 1 : 0) + (creditCardFilter.length > 0 ? 1 : 0) + (filterStartDate ? 1 : 0) + (filterEndDate ? 1 : 0) + (filterOnlyInstallments ? 1 : 0) + (filterOnlyShared ? 1 : 0) + (filterTag ? 1 : 0);

  // Quick Summary Stats for current Filter
  const quickStats = useMemo(() => {
      let inc = 0, exp = 0;
      const nathyId = categories.find(c => c.name.toLowerCase() === 'nathy')?.id;

      currentMonthTransactions.forEach(t => {
          // Check if it belongs to Nathy (Category or Description)
          const isNathyCat = nathyId && t.categoryId === nathyId;
          const isNathyDesc = t.description.toLowerCase().includes('(parte nathy)');
          
          // Exclude Nathy from Top Summary Stats
          if (isNathyCat || isNathyDesc) return;

          if (t.type === TransactionType.INCOME) inc += t.amount;
          else if (t.type === TransactionType.EXPENSE && !t.fundedByResgate) exp += t.amount;
      });
      return { inc, exp, bal: inc - exp };
  }, [currentMonthTransactions, categories]);

  const paymentMethodSummary = useMemo(() => {
      const summary: Record<string, number> = {};
      currentMonthTransactions.forEach(t => {
          if (t.type !== TransactionType.EXPENSE) return;
          const key = t.paymentMethod || PaymentMethod.DEBIT_CASH;
          let name = 'Outros';
          if (key === PaymentMethod.CREDIT_CARD) {
              const card = t.creditCardId ? creditCards.find(c => c.id === t.creditCardId) : null;
              name = card ? `Cartão ${card.name}` : 'Cartão de Crédito';
          } else if (key === PaymentMethod.DEBIT_CASH) {
              name = 'Débito / Dinheiro';
          }
          
          summary[name] = (summary[name] || 0) + t.amount;
      });
      return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [currentMonthTransactions, creditCards]);

    return (
    <div className="space-y-6 animate-in fade-in pb-24">
        {/* TOP CONTROL DECK */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-zinc-200/5 p-4 space-y-4">
            {/* Row 1: Summary & Main Controls */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
                {/* View Switcher & Date */}
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full shrink-0">
                        <button onClick={() => setViewMode('monthly')} className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${viewMode === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200'}`}>Mês</button>
                        <button onClick={() => setViewMode('yearly')} className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${viewMode === 'yearly' ? 'bg-blue-600 text-white shadow' : 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200'}`}>Ano</button>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 lg:flex-none justify-center">
                        {viewMode === 'monthly' ? (
                            <>
                                <button onClick={handlePrevMonth} className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"><ChevronLeft size={16}/></button>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-wide min-w-[100px] text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={handleNextMonth} className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"><ChevronRight size={16}/></button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setSelectedYear(y => y - 1)} className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center justify-center text-zinc-500 dark:text-zinc-400"><ChevronLeft size={16}/></button>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 min-w-[60px] text-center">{selectedYear}</span>
                                <button onClick={() => setSelectedYear(y => y + 1)} className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center justify-center text-zinc-500 dark:text-zinc-400"><ChevronRight size={16}/></button>
                            </>
                        )}
                    </div>
                </div>

                {/* Quick Stats Strip */}
                {viewMode === 'monthly' && (
                    <div className="flex items-center gap-6 text-sm flex-1 justify-center lg:justify-end border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800 pt-3 lg:pt-0 w-full lg:w-auto">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-medium text-emerald-500 uppercase tracking-wider">Receitas</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(quickStats.inc)}</span>
                        </div>
                        <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-medium text-red-500 uppercase tracking-wider">Despesas</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(quickStats.exp)}</span>
                        </div>
                        <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Saldo</span>
                            <span className={`font-medium ${quickStats.bal >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-600'}`}>{formatCurrency(quickStats.bal)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 2: Filters */}
            <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500" />
                    <input 
                        type="text" 
                        value={filterTag} 
                        onChange={(e) => setFilterTag(e.target.value)} 
                        placeholder="Buscar..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-semibold focus:ring-2 focus:ring-blue-600/30 outline-none"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 pb-1 md:pb-0">
                    <div className="relative">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)} 
                            className={`flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs font-semibold whitespace-nowrap transition-all ${categoryFilter.length > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}
                        >
                            <Filter size={14} /> {categoryFilter.length > 0 ? `${categoryFilter.length} Categorias` : 'Categorias'}
                        </button>
                        {isFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setIsFilterOpen(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                        <button onClick={() => setCategoryFilter([])} className="w-full text-left px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg">Limpar Seleção</button>
                                        {categories.map(cat => (
                                            <button key={cat.id} onClick={() => toggleCategoryFilter(cat.id)} className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg ${categoryFilter.includes(cat.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: cat.color}}></div>
                                                    <span className="truncate max-w-[150px]">{cat.name}</span>
                                                </div>
                                                {categoryFilter.includes(cat.id) && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsCardFilterOpen(!isCardFilterOpen)} 
                            className={`flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs font-semibold whitespace-nowrap transition-all ${creditCardFilter.length > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}
                        >
                            <CardIcon size={14} /> {creditCardFilter.length > 0 ? `${creditCardFilter.length} Cartões` : 'Cartões'}
                        </button>
                        {isCardFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setIsCardFilterOpen(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                        <button onClick={() => setCreditCardFilter([])} className="w-full text-left px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg">Limpar Seleção</button>
                                        {creditCards.map(card => (
                                            <button key={card.id} onClick={() => toggleCreditCardFilter(card.id)} className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg ${creditCardFilter.includes(card.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: card.color}}></div>
                                                    <span className="truncate max-w-[150px]">{card.name}</span>
                                                </div>
                                                {creditCardFilter.includes(card.id) && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setFilterOnlyInstallments(!filterOnlyInstallments)}
                        className={`flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filterOnlyInstallments ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}
                    >
                        <Repeat size={14} /> Parcelados
                    </button>

                    <button
                        onClick={() => setFilterOnlyShared(!filterOnlyShared)}
                        className={`flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filterOnlyShared ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950'}`}
                    >
                        <Users size={14} /> Divididos
                    </button>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-full text-xs font-semibold focus:ring-2 focus:ring-blue-600/30 outline-none text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                title="Data Inicial"
                            />
                        </div>
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs hidden sm:inline">até</span>
                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-full text-xs font-semibold focus:ring-2 focus:ring-blue-600/30 outline-none text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                title="Data Final"
                            />
                        </div>
                    </div>

                    {(activeFilterCount > 0) && (
                        <button onClick={clearFilter} className="px-3.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-full transition-colors whitespace-nowrap">
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* PAYMENT METHOD SUMMARY WIDGET */}
            {paymentMethodSummary.length > 0 && (
                <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 pb-1">
                    <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Resumo por Forma de Pagamento</h4>
                    <div className="flex flex-wrap gap-3">
                        {paymentMethodSummary.map(([method, total]) => (
                            <div key={method} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-2 flex items-center justify-between min-w-[140px] flex-1 sm:flex-none">
                                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 line-clamp-1 mr-3" title={method}>{method}</span>
                                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* INVESTMENT SUMMARY WIDGET */}
        {viewMode === 'monthly' && (
            <>
                <div 
                    className="bg-gradient-to-r from-blue-50/70 to-zinc-50/70 dark:from-blue-950/20 dark:to-zinc-900/20 border border-blue-100 dark:border-blue-900/30 rounded-3xl p-4 flex items-center justify-between shadow-sm shadow-zinc-200/5 animate-in slide-in-from-top-2 cursor-pointer hover:shadow-md transition-all group"
                    onClick={() => setShowMonthInvestments(!showMonthInvestments)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 p-2.5 rounded-xl shadow-sm shadow-zinc-200/5 group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-blue-900 dark:text-blue-300 text-xs uppercase tracking-wide">Investimento do Mês</h3>
                            <p className="text-[10px] text-blue-700/70 dark:text-blue-400/70 font-semibold mt-0.5">Meta: {formatCurrency(investmentSummary.targetAmount)} ({investmentSummary.targetPct}%)</p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <span className="text-xl font-bold text-blue-800 dark:text-blue-400 block">{formatCurrency(investmentSummary.invested)}</span>
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">Total Aportado</span>
                                {showMonthInvestments ? <ChevronUp size={12} className="text-blue-600 dark:text-blue-400" /> : <ChevronDown size={12} className="text-blue-600 dark:text-blue-400" />}
                            </div>
                            {investmentSummary.dividends > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold bg-white dark:bg-zinc-900/60 px-1.5 rounded border border-emerald-100 dark:border-emerald-900/40 mt-1 shadow-sm shadow-zinc-200/5">
                                    + {formatCurrency(investmentSummary.dividends)} Proventos
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {showMonthInvestments && (
                    <div className="animate-in slide-in-from-top-2 space-y-4">
                        <TransactionGroup 
                            title="Novos Aportes" 
                            items={monthlyInvestments.buys} 
                            icon={<TrendingUp size={18}/>} 
                            colorClass="text-blue-800" 
                            total={monthlyInvestments.buys.reduce((a,b) => a + b.amount, 0)} 
                            renderRow={renderTransactionRow} 
                            selectedIds={selectedIds} 
                            onToggleSelectAll={handleToggleSelectAllGroup} 
                        />
                        <TransactionGroup 
                            title="Proventos Recebidos" 
                            items={monthlyInvestments.divs} 
                            icon={<Gift size={18}/>} 
                            colorClass="text-emerald-700" 
                            total={monthlyInvestments.divs.reduce((a,b) => a + b.amount, 0)} 
                            renderRow={renderTransactionRow} 
                            selectedIds={selectedIds} 
                            onToggleSelectAll={handleToggleSelectAllGroup} 
                        />
                        <TransactionGroup 
                            title="Resgates / Vendas" 
                            items={monthlyInvestments.sells} 
                            icon={<Banknote size={18}/>} 
                            colorClass="text-zinc-700 dark:text-zinc-300" 
                            total={monthlyInvestments.sells.reduce((a,b) => a + b.amount, 0)} 
                            renderRow={renderTransactionRow} 
                            selectedIds={selectedIds} 
                            onToggleSelectAll={handleToggleSelectAllGroup} 
                        />
                        <TransactionGroup 
                            title="Eventos Corporativos" 
                            items={monthlyInvestments.corporate} 
                            icon={<Layers size={18}/>} 
                            colorClass="text-amber-700" 
                            total={0} 
                            renderRow={renderTransactionRow} 
                            selectedIds={selectedIds} 
                            onToggleSelectAll={handleToggleSelectAllGroup} 
                        />
                    </div>
                )}
            </>
        )}

        {/* RESULTS SECTION */}
        {viewMode === 'yearly' ? ( 
            <YearlyView transactions={yearlyFilteredTransactions} categories={categories} subCategories={subCategories} creditCards={creditCards} settings={settings} year={selectedYear} /> 
        ) : (
            <div className="space-y-6">
                {potentialDuplicateGroups.length > 0 && !dismissedDuplicates && (
                    <div className="bg-amber-50/10 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 rounded-3xl p-4 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl text-amber-500 shadow-sm shadow-zinc-200/5"><AlertCircle size={20} /></div>
                            <div>
                                <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-xs uppercase">Atenção Necessária</h3>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">{potentialDuplicateGroups.length} possíveis duplicatas detectadas.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setDismissedDuplicates(true)} className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 px-3 py-2 rounded-xl transition-all">Ignorar</button>
                            <button onClick={() => setShowDuplicateResolver(true)} className="bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm shadow-zinc-200/5 border border-amber-200 dark:border-amber-700/50">Resolver</button>
                        </div>
                    </div>
                )}
                
                <div className="space-y-6">
                    <TransactionGroup 
                        title={<span>Entradas <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 ml-1">({myGrouped.incomes.length})</span></span>} 
                        items={myGrouped.incomes} 
                        icon={<ArrowUpCircle size={20}/>} 
                        colorClass="text-emerald-700" 
                        total={myGrouped.incomes.reduce((a,b) => a + b.amount, 0)} 
                        renderRow={renderTransactionRow} 
                        selectedIds={selectedIds} 
                        onToggleSelectAll={handleToggleSelectAllGroup} 
                    />
                    
                    <TransactionGroup 
                        title={<span>Débito & Dinheiro <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 ml-1">({myGrouped.debits.length})</span></span>} 
                        items={myGrouped.debits} 
                        icon={<Banknote size={20}/>} 
                        colorClass="text-zinc-800 dark:text-zinc-200" 
                        total={myGrouped.debits.reduce((a,b) => a + b.amount, 0)} 
                        renderRow={renderTransactionRow} 
                        selectedIds={selectedIds} 
                        onToggleSelectAll={handleToggleSelectAllGroup} 
                    />
                    
                    {myGrouped.groupedCredit.map(group => (
                        <TransactionGroup 
                            key={group.id} 
                            title={
                                <div className="flex items-center gap-2">
                                    <span style={{ color: group.color }}>{group.name}</span>
                                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">({group.items.length})</span>
                                </div>
                            } 
                            items={group.items} 
                            icon={<CardIcon size={18} style={{ color: group.color }} />}
                            total={group.total} 
                            secondaryTotal={group.myTotal} 
                            renderRow={renderTransactionRow} 
                            selectedIds={selectedIds} 
                            onToggleSelectAll={handleToggleSelectAllGroup} 
                        />
                    ))}

                    {myGrouped.incomes.length === 0 && myGrouped.debits.length === 0 && myGrouped.groupedCredit.length === 0 && myGrouped.investments.length === 0 && nathyTransactions.length === 0 && (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            <Wallet className="mx-auto mb-4 text-zinc-800 dark:text-zinc-200" size={48} />
                            <p className="font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">Nenhuma transação encontrada.</p>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">Ajuste os filtros ou o mês.</p>
                        </div>
                    )}
                </div>

                {nathyTransactions.length > 0 && (
                    <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => setIsNathyExpanded(!isNathyExpanded)} className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-zinc-200/5 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="bg-pink-100 text-pink-600 p-2 rounded-xl group-hover:bg-pink-200 transition-colors"><Users size={20} /></div>
                                <div className="text-left">
                                    <h3 className="font-medium text-zinc-800 dark:text-zinc-200 text-sm uppercase tracking-wide">Área da Nathy (Divididos)</h3>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium">{nathyTransactions.length} lançamentos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-pink-600">R$ {(nathyTransactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE && !t.fundedByResgate ? t.amount : 0), 0) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                {isNathyExpanded ? <ChevronUp className="text-zinc-700 dark:text-zinc-300" size={16} /> : <ChevronDown className="text-zinc-700 dark:text-zinc-300" size={16} />}
                            </div>
                        </button>
                        {isNathyExpanded && (
                            <div className="mt-4 space-y-4 pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2">
                                <TransactionGroup title="Entradas (Nathy)" items={nathyGrouped.incomes} icon={<ArrowUpCircle size={18}/>} colorClass="text-pink-700" total={nathyGrouped.incomes.reduce((a,b) => a + b.amount, 0)} renderRow={renderTransactionRow} selectedIds={selectedIds} onToggleSelectAll={handleToggleSelectAllGroup} />
                                <TransactionGroup title="Débito (Nathy)" items={nathyGrouped.debits} icon={<Banknote size={18}/>} colorClass="text-pink-700" total={nathyGrouped.debits.reduce((a,b) => a + b.amount, 0)} renderRow={renderTransactionRow} selectedIds={selectedIds} onToggleSelectAll={handleToggleSelectAllGroup} />
                                {nathyGrouped.groupedCredit.map(group => (<TransactionGroup key={group.id} title={`Cartão: ${group.name}`} items={group.items} icon={<CardIcon size={16}/>} colorClass="text-pink-700" total={group.items.reduce((acc, t) => acc + t.amount, 0)} renderRow={renderTransactionRow} selectedIds={selectedIds} onToggleSelectAll={handleToggleSelectAllGroup} />))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* BATCH EDIT PANEL */}
        {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-3xl shadow-2xl z-50 p-4 border border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom-8 ring-1 ring-black/5">
                {isBatchUpdating ? (
                    <div className="flex items-center justify-center gap-3 py-2 text-zinc-900 dark:text-zinc-100">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="font-medium text-sm">Atualizando...</span>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-1.5 rounded-lg">
                                    <CheckSquare size={16} />
                                </div>
                                <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{selectedIds.length} selecionados</span>
                            </div>
                            <button onClick={() => setSelectedIds([])} className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:text-zinc-300"><X size={18}/></button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <input 
                                type="text" 
                                value={batchEditDescription}
                                onChange={(e) => setBatchEditDescription(e.target.value)}
                                placeholder="Nova Descrição..." 
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-gray-900 outline-none"
                            />
                            <select 
                                value={batchEditCategoryId}
                                onChange={(e) => {
                                    setBatchEditCategoryId(e.target.value);
                                    setBatchEditSubCategoryId('');
                                }}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-gray-900 outline-none"
                            >
                                <option value="">Alterar Categoria...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select 
                                value={batchEditSubCategoryId}
                                onChange={(e) => setBatchEditSubCategoryId(e.target.value)}
                                disabled={!batchEditCategoryId}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-gray-900 outline-none disabled:opacity-50"
                            >
                                <option value="">Alterar Subcategoria...</option>
                                {subCategories.filter(s => s.categoryId === batchEditCategoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <button 
                            onClick={handleBatchUpdate}
                            disabled={!batchEditDescription && !batchEditCategoryId && !batchEditSubCategoryId}
                            className="w-full bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 disabled:opacity-50 text-zinc-900 dark:text-zinc-100 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-zinc-200/5"
                        >
                            <Save size={14} /> Aplicar Alterações em Lote
                        </button>
                    </>
                )}
            </div>
        )}

        {/* SMART DELETION MODAL */}
        {deletingTransaction && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center bg-rose-50">
                      <div className="p-4 bg-rose-100 text-rose-600 rounded-3xl mb-6">
                          <Trash2 size={32} />
                      </div>
                      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Excluir Lançamento?</h2>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-2 italic">"{deletingTransaction.description}"</p>
                      <div className="flex gap-2 mt-4">
                        {deletingTransaction.installmentId && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-medium px-2.5 py-1 rounded-full uppercase tracking-widest border border-purple-200">Parcelado</span>
                        )}
                        {deletingTransaction.fixedGroupId && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-medium px-2.5 py-1 rounded-full uppercase tracking-widest border border-amber-200">Fixo</span>
                        )}
                      </div>
                  </div>
                  
                  <div className="p-6 space-y-3">
                      {(deletingTransaction.installmentId || deletingTransaction.fixedGroupId) ? (
                        <>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-widest mb-4">Escolha o modo de exclusão:</p>
                          
                          <button 
                              onClick={() => { onDeleteTransaction(deletingTransaction.id, 'single'); setDeletingTransaction(null); }}
                              className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-800 transition-all text-left group"
                          >
                              <div>
                                  <span className="block font-semibold text-zinc-900 dark:text-zinc-100 text-sm uppercase">Apenas este mês</span>
                                  <span className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">Excluir somente esta data específica do histórico.</span>
                              </div>
                              <ChevronRight size={18} className="text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500" />
                          </button>

                          <button 
                              onClick={() => { onDeleteTransaction(deletingTransaction.id, 'future'); setDeletingTransaction(null); }}
                              className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 hover:bg-amber-50 rounded-3xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-200 transition-all text-left group"
                          >
                              <div>
                                  <span className="block font-medium text-amber-700 text-sm uppercase">Este e próximos</span>
                                  <span className="block text-[10px] font-medium text-amber-500 mt-0.5">Apagar este lançamento e todos os posteriores desta série.</span>
                              </div>
                              <ChevronRight size={18} className="text-zinc-700 dark:text-zinc-300 group-hover:text-amber-500" />
                          </button>

                          <button 
                              onClick={() => { onDeleteTransaction(deletingTransaction.id, 'all'); setDeletingTransaction(null); }}
                              className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 hover:bg-rose-50 rounded-3xl border border-zinc-200 dark:border-zinc-800 hover:border-rose-200 transition-all text-left group"
                          >
                              <div>
                                  <span className="block font-medium text-rose-700 text-sm uppercase">Série Completa</span>
                                  <span className="block text-[10px] font-medium text-rose-600 mt-0.5">Remover TODO o histórico (passado e futuro) desta série.</span>
                              </div>
                              <ChevronRight size={18} className="text-zinc-700 dark:text-zinc-300 group-hover:text-rose-500" />
                          </button>
                        </>
                      ) : (
                        <>
                           <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center mb-6 px-4">
                               Esta ação é definitiva. Deseja realmente remover este lançamento permanentemente?
                           </p>
                           <button 
                              onClick={() => { onDeleteTransaction(deletingTransaction.id, 'single'); setDeletingTransaction(null); }}
                              className="w-full flex items-center justify-between p-5 bg-rose-600 hover:bg-rose-700 text-white rounded-3xl shadow-lg transition-all text-left group"
                           >
                              <div>
                                  <span className="block font-medium text-sm uppercase">Sim, Excluir</span>
                                  <span className="block text-[10px] font-medium opacity-80 mt-0.5">Remover lançamento do banco de dados agora.</span>
                              </div>
                              <Trash2 size={20} />
                           </button>
                        </>
                      )}
                  </div>

                  <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 dark:bg-zinc-950/50 text-center">
                      <button 
                          onClick={() => setDeletingTransaction(null)}
                          className="px-8 py-2 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium hover:text-zinc-800 dark:hover:text-zinc-200 dark:text-zinc-200 text-xs uppercase tracking-widest"
                      >
                          {deletingTransaction.installmentId || deletingTransaction.fixedGroupId ? 'Manter Lançamento' : 'Cancelar'}
                      </button>
                  </div>
              </div>
          </div>
        )}

        <DuplicateResolverModal isOpen={showDuplicateResolver} onClose={() => setShowDuplicateResolver(false)} duplicateGroups={potentialDuplicateGroups} onDelete={(id) => onDeleteTransaction(id, 'single')} />
        <PaymentConfirmationModal isOpen={!!paymentConfirmationTx} onClose={() => setPaymentConfirmationTx(null)} transaction={paymentConfirmationTx} onConfirm={handleConfirmPayment} />
    </div>
  );
};
