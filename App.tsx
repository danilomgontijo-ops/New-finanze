
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, type User, signOut, auth } from './services/firebase';
import { StorageService, AssetHistory } from './services/storageService';
import { Transaction, Category, SubCategory, CreditCard, UserSettings, ImportedTransaction, TransactionType, PaymentMethod, AssetPrice } from './types';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { TransactionForm } from './components/TransactionForm';
import { InvoiceImporter } from './components/InvoiceImporter';
import { Analytics } from './components/Analytics';
import { ReportGenerator } from './components/ReportGenerator';
import { TransactionsList } from './components/TransactionsList';
import { Investments } from './components/Investments';
import { InvestmentBulkImporter } from './components/InvestmentBulkImporter';
import { 
  LayoutDashboard, 
  PieChart, 
  Settings as SettingsIcon, 
  LogOut, 
  Plus, 
  Upload, 
  FileText,
  Menu,
  X,
  List,
  TrendingUp,
  Sun,
  Moon,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [assetPrices, setAssetPrices] = useState<AssetPrice[]>([]); // New state for prices
  const [assetHistory, setAssetHistory] = useState<Record<string, AssetHistory>>({}); // New state for asset history
  const [settings, setSettings] = useState<UserSettings>({
    monthlyBudgetPercentage: 80,
    salaryDay: 1,
    salaryShift: 0
  });
  
  // Date State
  const [currentDate, setCurrentDate] = useState(new Date());

  // UI State
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'analytics' | 'investments' | 'settings'>('dashboard');
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isBulkInvOpen, setIsBulkInvOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubTrans = StorageService.subscribeToTransactions(setTransactions);
    const unsubCats = StorageService.subscribeToCategories(setCategories);
    const unsubSubs = StorageService.subscribeToSubCategories(setSubCategories);
    const unsubCards = StorageService.subscribeToCreditCards(setCreditCards);
    const unsubSettings = StorageService.subscribeToSettings(setSettings);
    const unsubPrices = StorageService.subscribeToAssetPrices(setAssetPrices);
    const unsubHistory = StorageService.subscribeToAssetHistory(setAssetHistory);

    return () => {
      unsubTrans();
      unsubCats();
      unsubSubs();
      unsubCards();
      unsubSettings();
      unsubPrices();
      unsubHistory();
    };
  }, [user]);

  const handleSaveTransaction = async (data: any, mode: 'single' | 'future' | 'all' = 'single') => {
    const totalValue = data.amount; // Valor Total da Compra (cheio)
    const installments = data.totalInstallments || 1;
    const isShared = data.isShared;

    // LÓGICA DE EDIÇÃO ROBUSTA
    if (editingTransaction) {
        const wasShared = editingTransaction.isShared || false;
        const wasInstallments = editingTransaction.totalInstallments || 1;
        const wasPaymentMethod = editingTransaction.paymentMethod;

        const structuralChange = 
            wasShared !== isShared || 
            wasInstallments !== installments || 
            wasPaymentMethod !== data.paymentMethod;

        if (structuralChange) {
            console.log("Structural change detected, recreating transaction series");
            // Se mudou a estrutura (ex: era parcelado e virou à vista), apaga tudo antigo e recria
            await StorageService.deleteTransaction(editingTransaction.id, 'all');
            data.id = undefined; 
        } 
        else {
            console.log("Simple edit detected, updating with mode:", mode);
            
            // O valor que vem do form (data.amount) é o TOTAL da compra.
            // Precisamos calcular o valor da parcela individual para salvar no banco.
            let baseTotal = isShared ? totalValue / 2 : totalValue;
            let finalInstallmentValue = baseTotal;
            
            if (installments > 1) {
                finalInstallmentValue = baseTotal / installments;
            }

            await StorageService.updateTransaction({ 
                ...editingTransaction, 
                ...data, 
                amount: finalInstallmentValue, 
                id: editingTransaction.id 
            }, mode);
            return;
        }
    }

    // --- LÓGICA DE CRIAÇÃO (OU RECRIACAO) ---
    if (isShared && data.type === TransactionType.EXPENSE) {
        const halfTotal = totalValue / 2;
        const nathyCategoryId = categories.find(c => c.name.toLowerCase() === 'nathy')?.id || data.categoryId;
        const sharedId = generateId();

        const userPart = { 
            ...data, 
            amount: halfTotal, 
            description: `${data.description} (Minha Parte)`,
            sharedId 
        };

        const nathyPart = { 
            ...data, 
            amount: halfTotal, 
            categoryId: nathyCategoryId,
            description: `${data.description} (Parte Nathy)`,
            sharedId 
        };

        if (installments > 1) {
            await StorageService.addInstallmentTransaction(userPart, installments);
            await StorageService.addInstallmentTransaction(nathyPart, installments);
        } else {
            await StorageService.addTransaction(userPart);
            await StorageService.addTransaction(nathyPart);
        }
    } 
    else {
        if (installments > 1) {
            await StorageService.addInstallmentTransaction({ ...data, amount: totalValue }, installments);
        } else {
            await StorageService.addTransaction({ ...data, amount: totalValue });
        }
    }
  };

  const handleBulkInvestmentImport = async (bulkTransactions: any[]) => {
      for (const t of bulkTransactions) {
          await StorageService.addTransaction(t);
      }
  };

  const handleImportTransactions = async (imported: ImportedTransaction[], cardId?: string, paymentMethod?: PaymentMethod) => {
    for (const t of imported) {
        if (!t.selected) continue;
        
        const baseData: any = {
            description: t.description,
            originalDescription: t.originalDescription,
            amount: t.amount,
            date: t.date, 
            originalDay: parseInt(t.date.split('-')[2], 10),
            type: TransactionType.EXPENSE, 
            categoryId: t.categoryId,
            subCategoryId: t.subCategoryId || undefined,
            paymentMethod: paymentMethod,
            creditCardId: cardId,
            isPaid: paymentMethod !== PaymentMethod.CREDIT_CARD,
            isFixed: false,
            isShared: false, 
            tags: t.tags || []
        };

        if (t.installments > 1 && cardId) {
             const groupKey = `${t.originalDescription}-${t.amount * t.installments}-${t.installments}`;
             baseData.installmentIndex = t.installmentIndex || 1; 
             baseData.totalInstallments = t.installments;
             
             // Check if this installment group already exists in the database
             const existing = transactions.find(tx => 
                 tx.installmentId && 
                 tx.totalInstallments === t.installments &&
                 Math.abs(tx.amount - t.amount) < 0.05 &&
                 (tx.description.includes(t.originalDescription) || t.originalDescription.includes(tx.description.replace(/\s\(\d+\/\d+\)$/, '')))
             );

             if (existing && existing.installmentId) {
                 // If it exists, we just add this single one (though it should have been caught as duplicate)
                 // Or we can just skip it, but let's add it with the same ID just in case
                 baseData.installmentId = existing.installmentId;
                 await StorageService.addTransaction({
                     ...baseData,
                     description: `${t.description.replace(/\s\(\d+\/\d+\)$/, '')} (${t.installmentIndex}/${t.installments})`
                 });
             } else {
                 // If it's a new installment purchase, generate ALL installments!
                 // We need to pass the TOTAL amount to addInstallmentTransaction
                 const totalAmount = t.amount * t.installments;
                 await StorageService.addInstallmentTransaction({ ...baseData, amount: totalAmount }, t.installments);
             }
        } else {
             await StorageService.addTransaction(baseData);
        }
    }
  };

  const handleLogout = () => {
      signOut();
  };

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div></div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} font-sans flex flex-col md:flex-row selection:bg-indigo-100 selection:text-indigo-900 transition-all duration-300 relative overflow-hidden`}>
       {/* Ambient glow mesh overlay for elite fintech aesthetics */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
           <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-200/20 dark:bg-indigo-500/4 blur-[120px] transition-all duration-700" />
           <div className="absolute top-[30%] -left-40 w-[500px] h-[500px] rounded-full bg-emerald-200/10 dark:bg-emerald-500/3 blur-[120px] transition-all duration-700" />
           <div className="absolute -bottom-40 right-20 w-[400px] h-[400px] rounded-full bg-violet-200/10 dark:bg-indigo-500/2 blur-[100px] transition-all duration-700" />
       </div>

       {/* Mobile Header */}
       <div className="md:hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 border-b border-zinc-200/50 dark:border-zinc-800/60 flex justify-between items-center sticky top-0 z-20">
           <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg flex items-center justify-center shadow-sm">
                   <Wallet size={16} strokeWidth={2.5} />
               </div>
               <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">FinanZe</h1>
           </div>
           <div className="flex items-center gap-2">
               <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Alternar Tema">
                   {isDarkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
               </button>
               <button onClick={() => { setIsReportOpen(true); }} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                   <FileText size={20} />
               </button>
               <button onClick={() => { setIsImporterOpen(true); }} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                   <Upload size={20} />
               </button>
           </div>
       </div>

       {/* Top/Side Navigation - Floating Glassmorphic Workspace Dock */}
       <aside className={`hidden md:flex md:m-4 md:mr-0 md:rounded-3xl z-30 w-64 backdrop-blur-xl bg-white/60 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 flex-col shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-zinc-200/50 dark:border-zinc-800/40`}>
           <div className="p-6 flex flex-col items-center border-b border-zinc-100/80 dark:border-zinc-800/80">
               <div className="w-12 h-12 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl flex items-center justify-center mb-3 shadow-md shadow-indigo-200/50 dark:shadow-indigo-950/20">
                   <Wallet size={24} strokeWidth={2} />
               </div>
               <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 tracking-tight">FinanZe</h1>
               <p className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em]">Workspace</p>
           </div>
           
           <nav className="flex-1 mt-6 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
               <button 
                onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${currentView === 'dashboard' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
               >
                   {currentView === 'dashboard' && (
                       <motion.div layoutId="sidebarActivePill" className="absolute inset-0 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl z-0 ring-1 ring-indigo-100/50 dark:ring-indigo-900/50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                   )}
                   <LayoutDashboard size={18} className={`relative z-10 ${currentView === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                   <span className="relative z-10">Dashboard</span>
               </button>
               <button 
                onClick={() => { setCurrentView('transactions'); setIsSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${currentView === 'transactions' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
               >
                   {currentView === 'transactions' && (
                       <motion.div layoutId="sidebarActivePill" className="absolute inset-0 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl z-0 ring-1 ring-indigo-100/50 dark:ring-indigo-900/50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                   )}
                   <List size={18} className={`relative z-10 ${currentView === 'transactions' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                   <span className="relative z-10">Lançamentos</span>
               </button>
               <button 
                onClick={() => { setCurrentView('analytics'); setIsSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${currentView === 'analytics' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
               >
                   {currentView === 'analytics' && (
                       <motion.div layoutId="sidebarActivePill" className="absolute inset-0 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl z-0 ring-1 ring-indigo-100/50 dark:ring-indigo-900/50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                   )}
                   <PieChart size={18} className={`relative z-10 ${currentView === 'analytics' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                   <span className="relative z-10">Análises</span>
               </button>
               <button 
                onClick={() => { setCurrentView('investments'); setIsSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${currentView === 'investments' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
               >
                   {currentView === 'investments' && (
                       <motion.div layoutId="sidebarActivePill" className="absolute inset-0 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl z-0 ring-1 ring-indigo-100/50 dark:ring-indigo-900/50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                   )}
                   <TrendingUp size={18} className={`relative z-10 ${currentView === 'investments' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                   <span className="relative z-10">Investimentos</span>
               </button>
               <button 
                onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${currentView === 'settings' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
               >
                   {currentView === 'settings' && (
                       <motion.div layoutId="sidebarActivePill" className="absolute inset-0 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl z-0 ring-1 ring-indigo-100/50 dark:ring-indigo-900/50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                   )}
                   <SettingsIcon size={18} className={`relative z-10 ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                   <span className="relative z-10">Configurações</span>
               </button>
           </nav>

           <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
               <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all"><span className="flex items-center gap-3">{isDarkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-500" />}{isDarkMode ? "Tema Claro" : "Tema Escuro"}</span><span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{isDarkMode ? "Dark" : "Light"}</span></button>
              <div className="space-y-1">
                  <button 
                   onClick={() => { setIsReportOpen(true); setIsSidebarOpen(false); }}
                   className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                      <FileText size={16} /> Relatórios
                  </button>
                  <button 
                   onClick={() => { setIsImporterOpen(true); setIsSidebarOpen(false); }}
                   className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                      <Upload size={16} /> Importar Extrato
                  </button>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2 mx-2"></div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                      <LogOut size={16} /> Sair
                  </button>
              </div>
          </div>
       </aside>
       
       {/* Main Content Pane - Framed to support floating island sidebar perfectly */}
       <main className="flex-1 p-4 pb-28 md:pb-8 md:p-8 overflow-y-auto h-screen bg-transparent custom-scrollbar relative z-10">
           <div className="max-w-6xl mx-auto">
               
               {/* Floating Icon permanante para adicionar novo lançamento */}
               <button 
                onClick={() => { setEditingTransaction(null); setIsTransactionFormOpen(true); }}
                className="fixed bottom-24 md:bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-200 flex items-center justify-center z-40 hover:scale-105 hover:bg-indigo-700 transition-all ring-4 ring-white group"
                title="Novo Lançamento"
               >
                   <Plus size={28} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
               </button>

               {/* Header Actions (Desktop) */}
               <div className="hidden md:flex justify-end mb-8">
                   <button 
                    onClick={() => { setEditingTransaction(null); setIsTransactionFormOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
                   >
                       <Plus size={18} /> Nova Transação
                   </button>
               </div>

               <AnimatePresence mode="wait">
                   <motion.div
                     key={currentView}
                     initial={{ opacity: 0, y: 12 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -12 }}
                     transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                   >
                       {currentView === 'dashboard' && (
                   <Dashboard 
                     transactions={transactions}
                     categories={categories}
                     subCategories={subCategories}
                     creditCards={creditCards}
                     assetPrices={assetPrices}
                     settings={settings}
                     currentDate={currentDate}
                     onDateChange={setCurrentDate}
                     onEditTransaction={(t) => { setEditingTransaction(t); setIsTransactionFormOpen(true); }}
                     onDeleteTransaction={(id, mode) => StorageService.deleteTransaction(id, mode)}
                   />
               )}

               {currentView === 'transactions' && (
                   <TransactionsList 
                     transactions={transactions}
                     categories={categories}
                     subCategories={subCategories}
                     creditCards={creditCards}
                     settings={settings}
                     currentDate={currentDate}
                     onDateChange={setCurrentDate}
                     onEditTransaction={(t) => { setEditingTransaction(t); setIsTransactionFormOpen(true); }}
                     onDeleteTransaction={(id, mode) => StorageService.deleteTransaction(id, mode)}
                   />
               )}

               {currentView === 'analytics' && (
                   <Analytics 
                     transactions={transactions}
                     categories={categories}
                     subCategories={subCategories}
                     creditCards={creditCards}
                     settings={settings}
                     currentDate={currentDate}
                     onDateChange={setCurrentDate}
                   />
               )}

               {currentView === 'investments' && (
                   <Investments 
                     transactions={transactions}
                     categories={categories}
                     subCategories={subCategories}
                     creditCards={creditCards}
                     settings={settings}
                     currentDate={currentDate}
                     assetPrices={assetPrices}
                     onDateChange={setCurrentDate}
                     onEditTransaction={(t) => { setEditingTransaction(t); setIsTransactionFormOpen(true); }}
                     onDeleteTransaction={(id, mode) => StorageService.deleteTransaction(id, mode)}
                     onOpenBulkImport={() => setIsBulkInvOpen(true)}
                   />
               )}

               {currentView === 'settings' && (
                   <Settings 
                     categories={categories}
                     setCategories={setCategories}
                     subCategories={subCategories}
                     setSubCategories={setSubCategories}
                     creditCards={creditCards}
                     setCreditCards={setCreditCards}
                     settings={settings}
                     setSettings={setSettings}
                     transactions={transactions}
                     onSaveCategories={StorageService.saveCategories}
                     onSaveSubCategories={StorageService.saveSubCategories}
                     onSaveCards={StorageService.saveCreditCards}
                     onSaveSettings={StorageService.saveSettings}
                     onDeleteCategory={StorageService.deleteCategory}
                     onDeleteSubCategory={StorageService.deleteSubCategory}
                     onDeleteCard={StorageService.deleteCreditCard}
                     onUpdateCategory={StorageService.updateCategory}
                     onUpdateSubCategory={StorageService.updateSubCategory}
                   />
               )}
                   </motion.div>
               </AnimatePresence>
           </div>
       </main>

       {/* Mobile Bottom Navigation */}
       <nav className="md:hidden fixed bottom-5 left-4 right-4 mx-auto max-w-[480px] rounded-[1.75rem] border border-zinc-200/50 dark:border-zinc-800/60 backdrop-blur-lg bg-white/75 dark:bg-zinc-950/70 z-30 flex justify-around p-1.5 shadow-[0_10px_30px_rgba(24,24,27,0.08)] dark:shadow-none">
           <button 
               onClick={() => setCurrentView('dashboard')}
               className={`relative flex flex-col items-center justify-center w-14 space-y-0.5 p-2 rounded-[1.25rem] transition-all ${currentView === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
           >
               {currentView === 'dashboard' && (
                   <motion.div layoutId="mobileNavPill" className="absolute inset-1 bg-indigo-50/70 rounded-xl z-0" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
               )}
               <LayoutDashboard size={20} className={`relative z-10 ${currentView === 'dashboard' ? 'svg-solid text-indigo-600' : 'text-zinc-400'}`} />
               <span className="text-[9px] uppercase tracking-wide relative z-10">Início</span>
           </button>
           <button 
               onClick={() => setCurrentView('transactions')}
               className={`relative flex flex-col items-center justify-center w-14 space-y-0.5 p-2 rounded-[1.25rem] transition-all ${currentView === 'transactions' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
           >
               {currentView === 'transactions' && (
                   <motion.div layoutId="mobileNavPill" className="absolute inset-1 bg-indigo-50/70 rounded-xl z-0" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
               )}
               <List size={20} className={`relative z-10 ${currentView === 'transactions' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
               <span className="text-[9px] uppercase tracking-wide relative z-10">Lanç.<span className="hidden sm:inline">amentos</span></span>
           </button>
           <button 
               onClick={() => setCurrentView('analytics')}
               className={`relative flex flex-col items-center justify-center w-14 space-y-0.5 p-2 rounded-[1.25rem] transition-all ${currentView === 'analytics' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
           >
               {currentView === 'analytics' && (
                   <motion.div layoutId="mobileNavPill" className="absolute inset-1 bg-indigo-50/70 rounded-xl z-0" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
               )}
               <PieChart size={20} className={`relative z-10 ${currentView === 'analytics' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
               <span className="text-[9px] uppercase tracking-wide relative z-10">Análises</span>
           </button>
           <button 
               onClick={() => setCurrentView('investments')}
               className={`relative flex flex-col items-center justify-center w-14 space-y-0.5 p-2 rounded-[1.25rem] transition-all ${currentView === 'investments' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
           >
               {currentView === 'investments' && (
                   <motion.div layoutId="mobileNavPill" className="absolute inset-1 bg-indigo-50/70 rounded-xl z-0" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
               )}
               <TrendingUp size={20} className={`relative z-10 ${currentView === 'investments' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
               <span className="text-[9px] uppercase tracking-wide relative z-10">Invest.<span className="hidden sm:inline">imentos</span></span>
           </button>
           <button 
               onClick={() => setCurrentView('settings')}
               className={`relative flex flex-col items-center justify-center w-14 space-y-0.5 p-2 rounded-[1.25rem] transition-all ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
           >
               {currentView === 'settings' && (
                   <motion.div layoutId="mobileNavPill" className="absolute inset-1 bg-indigo-50/70 rounded-xl z-0" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
               )}
               <SettingsIcon size={20} className={`relative z-10 ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
               <span className="text-[9px] uppercase tracking-wide relative z-10">Ajustes</span>
           </button>
       </nav>

       {/* Modals */}
       {isTransactionFormOpen && (
           <TransactionForm 
             onClose={() => { setIsTransactionFormOpen(false); setEditingTransaction(null); }}
             onSave={handleSaveTransaction}
             initialData={editingTransaction}
             categories={categories}
             subCategories={subCategories}
             creditCards={creditCards}
             transactions={transactions}
           />
       )}

       {isImporterOpen && (
           <InvoiceImporter 
             isOpen={isImporterOpen}
             onClose={() => setIsImporterOpen(false)}
             categories={categories}
             subCategories={subCategories}
             creditCards={creditCards}
             transactions={transactions}
             onImport={handleImportTransactions}
           />
       )}

       {isBulkInvOpen && (
         <InvestmentBulkImporter 
            isOpen={isBulkInvOpen}
            onClose={() => setIsBulkInvOpen(false)}
            categories={categories}
            subCategories={subCategories}
            transactions={transactions}
            onImport={handleBulkInvestmentImport}
         />
       )}

       {isReportOpen && (
           <ReportGenerator 
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            transactions={transactions}
            categories={categories}
            subCategories={subCategories}
            creditCards={creditCards}
            settings={settings}
           />
       )}

    </div>
  );
};

export default App;
