
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  getDocs,
  getDoc,
  deleteField
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Transaction, Category, SubCategory, CreditCard, TransactionType, UserSettings, DescriptionMap, AssetPrice } from '../types';

export interface AssetHistory {
    id: string; // ticker
    ticker: string;
    userId: string;
    adjustForSplits?: boolean; // New field to control split adjustments
    history: {
        date: string; // YYYY-MM
        quantity: number;
        avgPrice: number;
        openingPrice: number;
        closingPrice: number;
    }[];
    nominalHistory?: {
        date: string; // YYYY-MM
        closingPrice: number;
    }[];
    lastUpdated: string;
}

const cleanData = (data: any): any => {
  // Return primitives and null as is
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // Handle arrays by mapping over them recursively
  if (Array.isArray(data)) {
    return data.map(item => cleanData(item));
  }

  // Handle objects by iterating keys and recursively cleaning
  const newObj = { ...data };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    } else {
      newObj[key] = cleanData(newObj[key]);
    }
  });
  return newObj;
};

const getUserId = () => {
    if (!auth.currentUser) throw new Error("User not authenticated");
    return auth.currentUser.uid;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Alimentação', type: TransactionType.EXPENSE, icon: 'utensils', color: '#f97316' },
  { id: 'c2', name: 'Transporte', type: TransactionType.EXPENSE, icon: 'car', color: '#eab308' },
  { id: 'c3', name: 'Moradia', type: TransactionType.EXPENSE, icon: 'home', color: '#ef4444' },
  { id: 'c4', name: 'Lazer', type: TransactionType.EXPENSE, icon: 'gamepad', color: '#8b5cf6' },
  { id: 'c5', name: 'Saúde', type: TransactionType.EXPENSE, icon: 'activity', color: '#14b8a6' },
  { id: 'c6', name: 'Danilo', type: TransactionType.EXPENSE, icon: 'user', color: '#3b82f6' },
  { id: 'c7', name: 'Nathy', type: TransactionType.EXPENSE, icon: 'user', color: '#ec4899' },
  { id: 'c8', name: 'Outros', type: TransactionType.EXPENSE, icon: 'circle', color: '#64748b' },
  { id: 'c9', name: 'Pet', type: TransactionType.EXPENSE, icon: 'dog', color: '#a855f7' },
  { id: 'c10', name: 'Salário', type: TransactionType.INCOME, icon: 'banknote', color: '#10b981' },
  { id: 'c11', name: 'Investimentos', type: TransactionType.INVESTMENT, icon: 'trending-up', color: '#0ea5e9' },
];

const DEFAULT_SUBCATEGORIES: SubCategory[] = [
  { id: 'sc1', categoryId: 'c1', name: 'Bar e Restaurante' },
  { id: 'sc2', categoryId: 'c1', name: 'Padaria' },
  { id: 'sc3', categoryId: 'c1', name: 'Aplicativo' },
  { id: 'sc4', categoryId: 'c1', name: 'Lanchonete/Conveniência' },
  { id: 'sc5', categoryId: 'c1', name: 'Outros' },
  { id: 'sc6', categoryId: 'c2', name: 'Combustível' },
  { id: 'sc7', categoryId: 'c2', name: 'Taxas/Impostos e Seguro' },
  { id: 'sc8', categoryId: 'c2', name: 'Lavagem e Estacionamento' },
  { id: 'sc9', categoryId: 'c2', name: 'Manutenção e Outros' },
  { id: 'sc10', categoryId: 'c2', name: 'Aplicativos' },
  { id: 'sc11', categoryId: 'c3', name: 'Aluguel e Condomínio' },
  { id: 'sc12', categoryId: 'c3', name: 'Financiamento' },
  { id: 'sc13', categoryId: 'c3', name: 'Contas' },
  { id: 'sc14', categoryId: 'c3', name: 'Outras Compras e Despesas' },
  { id: 'sc15', categoryId: 'c3', name: 'Supermercado' },
  { id: 'sc16', categoryId: 'c3', name: 'Bebida' },
  { id: 'sc17', categoryId: 'c4', name: 'Viagem' },
  { id: 'sc18', categoryId: 'c4', name: 'Festas/Confraternização' },
  { id: 'sc19', categoryId: 'c4', name: 'Esportes' },
  { id: 'sc20', categoryId: 'c4', name: 'Outros' },
  { id: 'sc21', categoryId: 'c5', name: 'Plano de Saúde' },
  { id: 'sc22', categoryId: 'c5', name: 'Farmácia' },
  { id: 'sc23', categoryId: 'c5', name: 'Academia' },
  { id: 'sc24', categoryId: 'c5', name: 'Consultas' },
  { id: 'sc25', categoryId: 'c5', name: 'Suplementos' },
  { id: 'sc26', categoryId: 'c6', name: 'Compras Nacionais' },
  { id: 'sc27', categoryId: 'c6', name: 'Compras Internacionais' },
  { id: 'sc28', categoryId: 'c6', name: 'Despesas Pessoais' },
  { id: 'sc29', categoryId: 'c8', name: 'Presentes' },
  { id: 'sc30', categoryId: 'c9', name: 'Banho' },
  { id: 'sc31', categoryId: 'c9', name: 'Ração e Petiscos' },
  { id: 'sc32', categoryId: 'c9', name: 'Hospedagem' },
  { id: 'sc33', categoryId: 'c9', name: 'Veterinário' },
];

const DEFAULT_CARDS: CreditCard[] = [
  { id: 'card_default', name: 'Cartão Principal', brand: 'Mastercard', icon: 'credit-card', limit: 5000, closingDay: 20, dueDay: 10, color: '#4f46e5' }
];

const DEFAULT_SETTINGS: UserSettings = {
  monthlyBudgetPercentage: 80,
  salaryDay: 1,
  salaryShift: 0,
};

const clampDayToMonth = (year: number, monthIndex: number, day: number): Date => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  return new Date(year, monthIndex, safeDay, 12, 0, 0);
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const StorageService = {
  
  subscribeToTransactions: (callback: (data: Transaction[]) => void) => {
    const userId = getUserId();
    const q = query(collection(db, "transactions"), where("userId", "==", userId)); 
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(data);
    }, (error) => {
      console.error("Error subscribing to transactions:", error);
      callback([]); 
    });
  },

  subscribeToAssetPrices: (callback: (data: AssetPrice[]) => void) => {
    const userId = getUserId();
    const q = query(collection(db, "assetPrices"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AssetPrice));
      callback(data);
    }, (error) => {
      console.error("Error subscribing to asset prices:", error);
      callback([]);
    });
  },

  saveAssetPrice: async (priceData: AssetPrice) => {
      const userId = getUserId();
      const docId = `${userId}_${priceData.ticker}`;
      await setDoc(doc(db, "assetPrices", docId), cleanData({ ...priceData, id: docId, userId }));
  },

  saveAssetPriceBatch: async (priceDataArray: AssetPrice[]) => {
      const userId = getUserId();
      const batchOp = writeBatch(db);
      for (const priceData of priceDataArray) {
          const docId = `${userId}_${priceData.ticker}`;
          const docRef = doc(db, "assetPrices", docId);
          batchOp.set(docRef, cleanData({ ...priceData, id: docId, userId }));
      }
      await batchOp.commit();
  },

  saveAssetHistory: async (ticker: string, history: any[], adjustForSplits?: boolean, nominalHistory?: any[]) => {
      const userId = getUserId();
      const docId = `${userId}_${ticker}_history`;
      
      // Try to get existing history to preserve flags
      const existingDoc = await getDoc(doc(db, "assetHistory", docId));
      const existingData = existingDoc.exists() ? existingDoc.data() as AssetHistory : null;

      const data: AssetHistory = {
          id: docId,
          ticker,
          userId,
          adjustForSplits: adjustForSplits !== undefined ? adjustForSplits : (existingData?.adjustForSplits || false),
          history,
          nominalHistory: nominalHistory || existingData?.nominalHistory,
          lastUpdated: new Date().toISOString()
      };

      await setDoc(doc(db, "assetHistory", docId), cleanData(data));
  },

  toggleAssetHistoryAdjustment: async (ticker: string, enabled: boolean) => {
      const userId = getUserId();
      const docId = `${userId}_${ticker}_history`;
      await updateDoc(doc(db, "assetHistory", docId), { adjustForSplits: enabled });
  },

  subscribeToAssetHistory: (callback: (data: Record<string, AssetHistory>) => void) => {
      const userId = getUserId();
      const q = query(collection(db, "assetHistory"), where("userId", "==", userId));
      return onSnapshot(q, (snapshot) => {
          const data: Record<string, AssetHistory> = {};
          snapshot.docs.forEach(doc => {
              const h = doc.data() as AssetHistory;
              data[h.ticker] = h;
          });
          callback(data);
      }, (error) => {
          console.error("Error subscribing to asset history:", error);
          callback({});
      });
  },

  subscribeToCategories: (callback: (data: Category[]) => void) => {
    const userId = getUserId();
    const q = query(collection(db, "categories"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
      if (data.length === 0) StorageService.seedCategories().catch(console.error);
      else callback(data);
    }, (error) => {
      console.error("Error subscribing to categories:", error);
      callback(DEFAULT_CATEGORIES); 
    });
  },

  subscribeToSubCategories: (callback: (data: SubCategory[]) => void) => {
    const userId = getUserId();
    const q = query(collection(db, "subcategories"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubCategory));
      if (data.length === 0) StorageService.seedSubCategories().catch(console.error);
      else callback(data);
    }, (error) => {
      console.error("Error subscribing to subcategories:", error);
      callback(DEFAULT_SUBCATEGORIES);
    });
  },

  subscribeToCreditCards: (callback: (data: CreditCard[]) => void) => {
    const userId = getUserId();
    const q = query(collection(db, "creditCards"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CreditCard));
      if (data.length === 0) StorageService.seedCreditCards().catch(console.error);
      else callback(data);
    }, (error) => {
      console.error("Error subscribing to cards:", error);
      callback(DEFAULT_CARDS);
    });
  },

  subscribeToSettings: (callback: (data: UserSettings) => void) => {
    const userId = getUserId();
    return onSnapshot(doc(db, "settings", userId), (docSnap) => {
      if (docSnap.exists()) callback({ ...DEFAULT_SETTINGS, ...docSnap.data() } as UserSettings);
      else {
        setDoc(doc(db, "settings", userId), cleanData({ ...DEFAULT_SETTINGS, userId })).catch(console.error);
        callback(DEFAULT_SETTINGS);
      }
    }, (error) => {
      console.error("Error subscribing to settings:", error);
      callback(DEFAULT_SETTINGS);
    });
  },

  getMappings: async (): Promise<DescriptionMap> => {
      try {
        const userId = getUserId();
        const docRef = doc(db, "mappings", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data() as DescriptionMap;
        return {};
      } catch (e) { return {}; }
  },

  saveMappings: async (newMappings: DescriptionMap) => {
      const userId = getUserId();
      const docRef = doc(db, "mappings", userId);
      await setDoc(docRef, cleanData(newMappings));
  },

  deleteMappings: async (keys: string[]) => {
      const userId = getUserId();
      const docRef = doc(db, "mappings", userId);
      const current = await StorageService.getMappings();
      keys.forEach(key => delete current[key]);
      await setDoc(docRef, cleanData(current));
  },

  seedCategories: async () => {
    const userId = getUserId();
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach(c => {
      const newId = `${userId}_${c.id}`;
      const ref = doc(db, "categories", newId);
      batch.set(ref, cleanData({ ...c, id: newId, userId }));
    });
    await batch.commit();
  },

  seedSubCategories: async () => {
    const userId = getUserId();
    const batch = writeBatch(db);
    DEFAULT_SUBCATEGORIES.forEach(sc => {
      const newId = `${userId}_${sc.id}`;
      const newCatId = `${userId}_${sc.categoryId}`; 
      const ref = doc(db, "subcategories", newId);
      batch.set(ref, cleanData({ ...sc, id: newId, categoryId: newCatId, userId }));
    });
    await batch.commit();
  },

  seedCreditCards: async () => {
    const userId = getUserId();
    const batch = writeBatch(db);
    DEFAULT_CARDS.forEach(c => {
      const newId = `${userId}_${c.id}`;
      const ref = doc(db, "creditCards", newId);
      batch.set(ref, cleanData({ ...c, id: newId, userId }));
    });
    await batch.commit();
  },

  saveCategories: async (categories: Category[]) => {
    const userId = getUserId();
    const batch = writeBatch(db);
    categories.forEach(c => {
       const docId = c.id.includes(userId) ? c.id : (c.id.includes('_') ? c.id : `${userId}_${c.id}`);
       batch.set(doc(db, "categories", docId), cleanData({ ...c, id: docId, userId }));
    });
    await batch.commit();
  },

  saveSubCategories: async (subs: SubCategory[]) => {
    const userId = getUserId();
    const batch = writeBatch(db);
    subs.forEach(s => {
       const docId = s.id.includes(userId) ? s.id : (s.id.includes('_') ? s.id : `${userId}_${s.id}`);
       batch.set(doc(db, "subcategories", docId), cleanData({ ...s, id: docId, userId }));
    });
    await batch.commit();
  },
  
  updateCategory: async (category: Category) => {
    const userId = getUserId();
    const docRef = doc(db, "categories", category.id);
    await updateDoc(docRef, cleanData({ ...category, userId }));
  },

  updateSubCategory: async (subCategory: SubCategory) => {
    const userId = getUserId();
    const docRef = doc(db, "subcategories", subCategory.id);
    await updateDoc(docRef, cleanData({ ...subCategory, userId }));
  },

  saveCreditCards: async (cards: CreditCard[]) => {
    const userId = getUserId();
    const batch = writeBatch(db);
    cards.forEach(c => {
       const docId = c.id.includes(userId) ? c.id : (c.id.includes('_') ? c.id : `${userId}_${c.id}`);
       batch.set(doc(db, "creditCards", docId), cleanData({ ...c, id: docId, userId }));
    });
    await batch.commit();
  },
  
  updateCreditCard: async (updatedCard: CreditCard) => {
    const userId = getUserId();
    await setDoc(doc(db, "creditCards", updatedCard.id), cleanData({ ...updatedCard, userId }));
  },

  deleteCategory: async (id: string) => { await deleteDoc(doc(db, "categories", id)); },
  deleteSubCategory: async (id: string) => { await deleteDoc(doc(db, "subcategories", id)); },
  deleteCreditCard: async (id: string) => { await deleteDoc(doc(db, "creditCards", id)); },

  saveSettings: async (settings: UserSettings) => {
    const userId = getUserId();
    await setDoc(doc(db, "settings", userId), cleanData({ ...settings, userId }));
  },

  addTransaction: async (transaction: Transaction) => {
    const userId = getUserId();
    if (transaction.isFixed) {
        const batch = writeBatch(db);
        const fixedGroupId = generateId();
        const inputDateStr = transaction.date.split('T')[0];
        const [pYear, pMonth, pDay] = inputDateStr.split('-').map(Number);
        for (let i = 0; i < 12; i++) {
             const newId = generateId();
             const dateObj = clampDayToMonth(pYear, (pMonth - 1) + i, pDay);
             const t = { ...transaction, id: newId, userId, fixedGroupId, date: dateObj.toISOString(), originalDay: pDay };
             if (t.type === TransactionType.INCOME) (t as any).subCategoryId = null;
             batch.set(doc(db, "transactions", newId), cleanData(t));
        }
        await batch.commit();
    } else {
        const newId = transaction.id || generateId();
        const dataToSave = { ...transaction, id: newId, userId, originalDay: new Date(transaction.date).getUTCDate() };
        if (dataToSave.type === TransactionType.INCOME) (dataToSave as any).subCategoryId = null;
        await setDoc(doc(db, "transactions", newId), cleanData(dataToSave));
    }
  },

  addInstallmentTransaction: async (baseTransaction: Transaction, installments: number) => {
    const userId = getUserId();
    const batch = writeBatch(db);
    const installmentGroupId = generateId();
    const inputDateStr = baseTransaction.date.split('T')[0]; 
    const [pYear, pMonth, pDay] = inputDateStr.split('-').map(Number);
    
    // CORREÇÃO: Dividir o valor total pelo número de parcelas
    const installmentAmount = baseTransaction.amount / installments;
    
    const currentIdx = baseTransaction.installmentIndex || 1;
    const startMonthOffset = (pMonth - 1) - (currentIdx - 1);

    for (let i = 0; i < installments; i++) {
      const dateObj = clampDayToMonth(pYear, startMonthOffset + i, pDay);
      
      let manualAccDateObj = undefined;
      if (baseTransaction.manualAccountingDate) {
          const [mYear, mMonth, mDay] = baseTransaction.manualAccountingDate.split('T')[0].split('-').map(Number);
          // Shift the manual accounting date by the same number of months 'i'
          const mDate = clampDayToMonth(mYear, (mMonth - 1) + i, mDay);
          manualAccDateObj = mDate.toISOString();
      }

      const newId = generateId();
      const t = {
        ...baseTransaction,
        id: newId,
        installmentId: installmentGroupId,
        amount: installmentAmount, // Valor já dividido
        date: dateObj.toISOString(),
        manualAccountingDate: manualAccDateObj,
        installmentIndex: i + 1,
        totalInstallments: installments,
        description: `${baseTransaction.description.replace(/\s\(\d+\/\d+\)$/, '')} (${i + 1}/${installments})`,
        isPaid: false,
        userId,
        originalDay: pDay
      };
      if (t.type === TransactionType.INCOME) (t as any).subCategoryId = null;
      batch.set(doc(db, "transactions", newId), cleanData(t));
    }
    await batch.commit();
  },

  updateTransaction: async (updatedTransaction: Transaction, mode: 'single' | 'future' | 'all' = 'single') => {
    const userId = getUserId();
    const groupId = updatedTransaction.installmentId || updatedTransaction.fixedGroupId;
    const sharedId = updatedTransaction.sharedId;
    
    // Se tiver sharedId ou groupId, precisamos buscar os documentos relacionados para atualizar
    if ((groupId || sharedId) && mode !== 'single') {
      let q;
      
      // Determine query scope - Prioritize sharedId to update both sides of a split if recurring
      if (sharedId) {
          q = query(collection(db, "transactions"), where("sharedId", "==", sharedId), where("userId", "==", userId));
      } else if (groupId) {
          if (updatedTransaction.installmentId) {
              q = query(collection(db, "transactions"), where("installmentId", "==", updatedTransaction.installmentId), where("userId", "==", userId));
          } else {
              q = query(collection(db, "transactions"), where("fixedGroupId", "==", updatedTransaction.fixedGroupId), where("userId", "==", userId));
          }
      }

      // If we couldn't determine a group query but mode is not single, we should probably fallback to single update logic for safety,
      // but let's proceed assuming we have a query if we are here.
      
      const snapshot = await getDocs(q!);
      const batch = writeBatch(db);

      // We need the original document to compare dates/indices for 'future' mode
      const originalDoc = snapshot.docs.find(d => d.id === updatedTransaction.id)?.data() as Transaction;
      const originalDateStr = originalDoc ? originalDoc.date.split('T')[0] : updatedTransaction.date.split('T')[0];
      const dateChanged = originalDoc && originalDoc.date.split('T')[0] !== updatedTransaction.date.split('T')[0];
      const manualDateChanged = originalDoc && originalDoc.manualAccountingDate !== updatedTransaction.manualAccountingDate;

      // Prepare target Date/Index for filtering
      const targetDateStr = updatedTransaction.date.split('T')[0];
      const targetIndex = Number(updatedTransaction.installmentIndex || 0);

      snapshot.docs.forEach(docSnap => {
        const t = docSnap.data() as Transaction;
        const docId = docSnap.id;
        
        // --- FILTERING LOGIC ---
        let shouldUpdate = false;
        
        if (mode === 'all') {
            shouldUpdate = true;
        } else if (mode === 'future') {
            if (updatedTransaction.installmentId) {
                // For installments, use index
                const currentIndex = Number(t.installmentIndex || 0);
                if (currentIndex >= targetIndex) shouldUpdate = true;
            } else {
                // For fixed or others, use original date as threshold
                const tDateStr = t.date.split('T')[0];
                if (tDateStr >= originalDateStr) shouldUpdate = true;
            }
        }

        // Always update the specific document being edited (id matches), regardless of filter logic above
        if (docId === updatedTransaction.id) shouldUpdate = true;

        if (!shouldUpdate) return; 
        console.log("Updating document:", docId, "Description:", t.description);
        // -----------------------

        let desc = updatedTransaction.description;
        if (t.installmentId) {
             // Preserva o índice da parcela na descrição
             desc = updatedTransaction.description.replace(/\s\(\d+\/\d+\)$/, '').replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
             
             // Re-adiciona sufixo de parte se existir no original deste documento (não do que está sendo editado)
             if (t.description.includes('(Minha Parte)')) desc += ' (Minha Parte)';
             if (t.description.includes('(Parte Nathy)')) desc += ' (Parte Nathy)';
             
             // Re-adiciona índice
             desc += ` (${t.installmentIndex}/${t.totalInstallments})`;
        } else if (t.isShared) {
             // Re-adiciona sufixo para transações normais compartilhadas
             desc = updatedTransaction.description.replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
             if (t.description.includes('(Minha Parte)')) desc += ' (Minha Parte)';
             if (t.description.includes('(Parte Nathy)')) desc += ' (Parte Nathy)';
        }

        let newDate = t.date;
        let newManualDate = t.manualAccountingDate;

        if (dateChanged || manualDateChanged) {
            const [newY, newM, newD] = updatedTransaction.date.split('T')[0].split('-').map(Number);
            let mY, mM, mD;
            if (updatedTransaction.manualAccountingDate) {
                [mY, mM, mD] = updatedTransaction.manualAccountingDate.split('T')[0].split('-').map(Number);
            }

            if (t.installmentId) {
                // Lógica complexa de data para parcelas: mantém o offset relativo
                const currentIdx = updatedTransaction.installmentIndex || 1; // Índice da que está sendo editada
                
                if (dateChanged) {
                    const startMonthOffset = (newM - 1) - (currentIdx - 1);
                    newDate = clampDayToMonth(newY, startMonthOffset + (t.installmentIndex! - 1), newD).toISOString();
                }

                if (manualDateChanged) {
                    if (updatedTransaction.manualAccountingDate && mY && mM && mD) {
                        const startManualMonthOffset = (mM - 1) - (currentIdx - 1);
                        newManualDate = clampDayToMonth(mY, startManualMonthOffset + (t.installmentIndex! - 1), mD).toISOString();
                    } else {
                        newManualDate = undefined;
                    }
                }
            } else if (t.fixedGroupId) {
                if (dateChanged) {
                    const docMonth = new Date(t.date).getMonth();
                    const docYear = new Date(t.date).getFullYear();
                    newDate = clampDayToMonth(docYear, docMonth, newD).toISOString();
                }
                if (manualDateChanged) {
                    if (updatedTransaction.manualAccountingDate && mY && mM && mD) {
                        const docMonth = new Date(t.manualAccountingDate || t.date).getMonth();
                        const docYear = new Date(t.manualAccountingDate || t.date).getFullYear();
                        newManualDate = clampDayToMonth(docYear, docMonth, mD).toISOString();
                    } else {
                        newManualDate = undefined;
                    }
                }
            } else {
                // Shared simples, data igual para ambos
                if (dateChanged) newDate = updatedTransaction.date; 
                if (manualDateChanged) newManualDate = updatedTransaction.manualAccountingDate;
            }
        }

        // Logic for Category Updates on Shared/Group Transactions:
        // 1. If it's a shared transaction (split), usually only the edited part (e.g. My Part) should update category.
        // 2. If it's not shared (e.g. installments), the category update should propagate to all items.
        // 3. IF we are in 'future' or 'all' mode, we might want to update both sides of shared transaction? 
        //    Current decision: If editing "My Part", update "My Part". If "Nathy Part", update "Nathy Part".
        //    Unless user explicitly wants to change category for the whole split (hard to distinguish in UI).
        //    We stick to: Update category ONLY if this document matches the "side" of the edited document.
        
        let targetCategoryId = t.categoryId;
        let targetSubCategoryId = t.subCategoryId;

        // Check if this doc is the "same side" as the updated transaction
        const isSameSide = 
            (updatedTransaction.description.includes('(Minha Parte)') && t.description.includes('(Minha Parte)')) ||
            (updatedTransaction.description.includes('(Parte Nathy)') && t.description.includes('(Parte Nathy)')) ||
            (!updatedTransaction.description.includes('(Minha Parte)') && !updatedTransaction.description.includes('(Parte Nathy)'));

        if (isSameSide) {
            targetCategoryId = updatedTransaction.categoryId;
            targetSubCategoryId = updatedTransaction.subCategoryId;
        }

        const updates: any = {
           description: desc,
           date: newDate,
           manualAccountingDate: newManualDate,
           categoryId: targetCategoryId, 
           subCategoryId: targetSubCategoryId || null, 
           amount: updatedTransaction.amount, 
           paymentMethod: updatedTransaction.paymentMethod,
           creditCardId: updatedTransaction.creditCardId,
           isShared: updatedTransaction.isShared,
           isFixed: updatedTransaction.isFixed,
           tags: updatedTransaction.tags,
           investmentDetails: updatedTransaction.investmentDetails,
           // Only update isPaid status if it's the specific doc being edited, or if user wants 'all'/'future' 
           // usually isPaid status is unique per month. 
           // Let's decide: 'isPaid' should probably NOT propagate to future transactions in 'future' mode?
           // Actually, typically if I change value/date, I don't necessarily change 'Paid' status of future ones.
           // However, if I change from 'Debit' to 'Credit', 'isPaid' might change for all.
           isPaid: t.id === updatedTransaction.id ? updatedTransaction.isPaid : t.isPaid,
           userId,
           originalDay: updatedTransaction.originalDay || t.originalDay
        };
        
        if (updatedTransaction.type === TransactionType.INCOME) updates.subCategoryId = null;
        batch.update(doc(db, "transactions", docId), cleanData(updates));
      });

      // REGENERATE MISSING INSTALLMENTS (if mode === 'all')
      // This helps fix cases where installments were not correctly created in the past
      if (mode === 'all' && updatedTransaction.installmentId && updatedTransaction.totalInstallments) {
          const existingIndices = snapshot.docs
            .filter(d => (d.data() as Transaction).installmentId === updatedTransaction.installmentId)
            .map(d => (d.data() as Transaction).installmentIndex || 0);
          
          const total = updatedTransaction.totalInstallments;
          const [newY, newM, newD] = updatedTransaction.date.split('T')[0].split('-').map(Number);
          const currentIdx = updatedTransaction.installmentIndex || 1;
          const startMonthOffset = (newM - 1) - (currentIdx - 1);

          for (let i = 1; i <= total; i++) {
              if (!existingIndices.includes(i)) {
                  const newId = generateId();
                  const dateObj = clampDayToMonth(newY, startMonthOffset + (i - 1), newD);
                  
                  let manualAccDateObj = undefined;
                  if (updatedTransaction.manualAccountingDate) {
                      const [mY, mM, mD] = updatedTransaction.manualAccountingDate.split('T')[0].split('-').map(Number);
                      const startManualMonthOffset = (mM - 1) - (currentIdx - 1);
                      manualAccDateObj = clampDayToMonth(mY, startManualMonthOffset + (i - 1), mD).toISOString();
                  }

                  let desc = updatedTransaction.description.replace(/\s\(\d+\/\d+\)$/, '').replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
                  if (updatedTransaction.description.includes('(Minha Parte)')) desc += ' (Minha Parte)';
                  if (updatedTransaction.description.includes('(Parte Nathy)')) desc += ' (Parte Nathy)';
                  desc += ` (${i}/${total})`;

                  const t = {
                      ...updatedTransaction,
                      id: newId,
                      date: dateObj.toISOString(),
                      manualAccountingDate: manualAccDateObj,
                      installmentIndex: i,
                      description: desc,
                      isPaid: false,
                      userId
                  };
                  batch.set(doc(db, "transactions", newId), cleanData(t));
              }
          }
      }

      await batch.commit();
    } else {
      // SINGLE MODE
      // If shared, update the pair as well (the other side of the split for this specific date)
      if (sharedId) {
          const q = query(collection(db, "transactions"), where("sharedId", "==", sharedId), where("userId", "==", userId));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          
          // Filter to find the exact pair (same date/index) - usually query returns all history if recurring shared.
          // We need to filter for THIS specific occurrence.
          const targetDateStr = updatedTransaction.date.split('T')[0];
          
          snapshot.docs.forEach(d => {
              const t = d.data() as Transaction;
              const docId = d.id;
              // Check if this is the "partner" transaction for the same event
              // Conditions: Same Installment Index OR Same Date (if not installment)
              let isPartner = false;
              
              if (updatedTransaction.installmentId) {
                  if (t.installmentId === updatedTransaction.installmentId && t.installmentIndex === updatedTransaction.installmentIndex) isPartner = true;
              } else if (updatedTransaction.fixedGroupId) {
                  // Fixed expenses: Match by date approximately (same month/year)
                  // Actually, fixed expenses usually have different IDs if they are generated 12 times.
                  // If they share `sharedId`, they are pairs.
                  // Check exact ID match or partner ID match.
                  // Simpler: If sharedId matches and date matches.
                  if (t.date.split('T')[0] === targetDateStr) isPartner = true;
              } else {
                  // Simple shared
                  if (t.date.split('T')[0] === targetDateStr) isPartner = true;
              }

              if (isPartner) {
                  console.log("Updating partner document:", docId);
                  // Determine description for partner
                  let desc = t.description; // Keep original description structure
                  const coreDesc = updatedTransaction.description.replace(/\s\(\d+\/\d+\)$/, '').replace(/\s\((Minha Parte|Parte Nathy)\)$/i, '').trim();
                  
                  if (t.description.includes('(Minha Parte)')) desc = `${coreDesc} (Minha Parte)`;
                  else if (t.description.includes('(Parte Nathy)')) desc = `${coreDesc} (Parte Nathy)`;
                  else desc = coreDesc; // Should not happen in shared context

                  if (t.installmentId) desc += ` (${t.installmentIndex}/${t.totalInstallments})`;

                  // Determine Category for partner
                  // If I edit "My Part", "Nathy Part" category should generally remain unless I explicitly change it?
                  // Current logic: If I edit "My Part", only update "My Part" category.
                  let targetCat = t.categoryId;
                  let targetSub = t.subCategoryId;
                  
                  if (docId === updatedTransaction.id) {
                      targetCat = updatedTransaction.categoryId;
                      targetSub = updatedTransaction.subCategoryId;
                  }

                  const updates = {
                      ...updatedTransaction,
                      id: docId, // Keep original ID
                      description: desc,
                      categoryId: targetCat,
                      subCategoryId: targetSub,
                      userId // Ensure userId
                  };
                  if (updates.type === TransactionType.INCOME) (updates as any).subCategoryId = null;
                  
                  batch.update(doc(db, "transactions", docId), cleanData(updates));
              }
          });
          await batch.commit();
      } else {
          // Pure single update
          const updates = { ...updatedTransaction, userId };
          if (updates.type === TransactionType.INCOME) (updates as any).subCategoryId = null;
          await updateDoc(doc(db, "transactions", updatedTransaction.id), cleanData(updates));
      }
    }
  },

  deleteTransaction: async (id: string, mode: 'single' | 'future' | 'all' = 'single') => {
    const userId = getUserId();
    const docRef = doc(db, "transactions", id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    const data = docSnap.data() as Transaction;
    
    // Determina o ID do grupo para exclusão em massa (Prioridade: Shared > Installment > Fixed)
    // Note: SharedId links "My Part" and "Nathy Part". 
    // InstallmentId links "Installment 1" to "Installment 12".
    // A transaction can have BOTH.
    
    // If we have a group ID, we might need to delete multiple docs.
    const hasGroup = data.installmentId || data.fixedGroupId || data.sharedId;
    
    if (hasGroup && mode !== 'single') {
        let q;
        // Logic: Query broadly, filter strictly in memory or via complex queries
        if (data.sharedId) {
             q = query(collection(db, "transactions"), where("sharedId", "==", data.sharedId), where("userId", "==", userId));
        } else if (data.installmentId) {
             q = query(collection(db, "transactions"), where("installmentId", "==", data.installmentId), where("userId", "==", userId));
        } else if (data.fixedGroupId) {
             q = query(collection(db, "transactions"), where("fixedGroupId", "==", data.fixedGroupId), where("userId", "==", userId));
        }

        if (q) {
            const batch = writeBatch(db);
            const snap = await getDocs(q);
            const targetDateStr = data.date.split('T')[0];
            const targetIndex = Number(data.installmentIndex || 0);
            
            snap.docs.forEach(d => {
                const t = d.data() as Transaction;
                let shouldDelete = false;
                
                if (mode === 'all') {
                    shouldDelete = true;
                } else if (mode === 'future') {
                    if (data.installmentId) {
                        const currentIndex = Number(t.installmentIndex || 0);
                        if (currentIndex >= targetIndex) shouldDelete = true;
                    } else { 
                        const tDateStr = t.date.split('T')[0];
                        if (tDateStr >= targetDateStr) shouldDelete = true;
                    }
                }
                
                if (shouldDelete) batch.delete(d.ref);
            });
            await batch.commit();
        }
    } else {
        // Single Mode
        // Special case: If it is shared, we usually want to delete the partner transaction too for the same date?
        // If the user clicks "Delete" on a shared transaction, they usually imply deleting the whole event.
        if (data.sharedId) {
             const q = query(collection(db, "transactions"), where("sharedId", "==", data.sharedId), where("userId", "==", userId));
             const snap = await getDocs(q);
             const batch = writeBatch(db);
             snap.docs.forEach(d => {
                 const t = d.data() as Transaction;
                 // Delete if it matches the same date (approx) or is the same ID
                 if (t.date.split('T')[0] === data.date.split('T')[0]) {
                     batch.delete(d.ref);
                 }
             });
             await batch.commit();
        } else {
            await deleteDoc(docRef);
        }
    }
  },

  batchDeleteTransactions: async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      const chunks = chunkArray(ids, 450);
      for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(id => { 
              batch.delete(doc(db, "transactions", id)); 
          });
          await batch.commit();
      }
  },

  restoreBackup: async (data: { 
    categories?: Category[], 
    subCategories?: SubCategory[], 
    creditCards?: CreditCard[], 
    transactions?: Transaction[],
    settings?: UserSettings 
  }) => {
    const userId = getUserId();
    
    if (data.settings) {
        await setDoc(doc(db, "settings", userId), cleanData({ ...data.settings, userId }));
    }

    const collectionsToRestore: { name: string, items: any[] }[] = [
        { name: "categories", items: data.categories || [] },
        { name: "subcategories", items: data.subCategories || [] },
        { name: "creditCards", items: data.creditCards || [] },
        { name: "transactions", items: data.transactions || [] }
    ];

    for (const col of collectionsToRestore) {
        if (col.items.length === 0) continue;
        
        const itemsToSave = col.items.map(item => ({
            ...item,
            id: item.id || generateId(),
            userId
        }));

        const chunks = chunkArray(itemsToSave, 450);
        
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const ref = doc(db, col.name, item.id);
                batch.set(ref, cleanData(item));
            });
            await batch.commit();
        }
    }
  }
};
