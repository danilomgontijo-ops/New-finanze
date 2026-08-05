import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, SubCategory, CreditCard, TransactionType, UserSettings, Transaction, DescriptionMap, PaymentMethod } from '../types';
import { CreditCardManager } from './CreditCardManager';
import { Settings as SettingsIcon, Trash2, Plus, Check, Target, Layers, AlertCircle, Pencil, X,
  Utensils, Car, Home, Gamepad, Activity, User, Dog, Banknote, TrendingUp, Circle, ShoppingBag, Coffee, Smartphone, Hammer, Plane, Music, Gift, Wifi, Zap, Book, Briefcase, Shirt,
  Landmark, CreditCard as CreditCardIcon, Wallet, DollarSign, Euro, Bitcoin, Gem, Rocket, Star, Heart, Shield, Lock, Key, Globe, Map as MapIcon, Navigation, Flag, Crown, Trophy, Award, ShoppingCart, Truck, Package, Ghost, Smile, ThumbsUp, ArrowDownCircle, ArrowUpCircle, Fingerprint, Calendar, ArrowRightCircle, Database, Filter, History, Download, UploadCloud, Loader2, Replace, ArrowRight, Search, CheckSquare, Square, MinusSquare, Edit3, Save, Sparkles, RefreshCcw, ChevronDown, ChevronUp, ChevronRight
} from 'lucide-react';
import { auth } from '../services/firebase';
import { StorageService, AssetHistory } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { DuplicateRulesAnalyzerModal } from './DuplicateRulesAnalyzerModal';

interface SettingsProps {
  categories: Category[];
  setCategories: (c: Category[]) => void;
  subCategories: SubCategory[];
  setSubCategories: (s: SubCategory[]) => void;
  creditCards: CreditCard[];
  setCreditCards: (c: CreditCard[]) => void;
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  onSaveCategories: (c: Category[]) => void;
  onSaveSubCategories: (s: SubCategory[]) => void;
  onSaveCards: (c: CreditCard[]) => void;
  onSaveSettings: (s: UserSettings) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteSubCategory: (id: string) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCategory: (c: Category) => void;
  onUpdateSubCategory: (s: SubCategory) => void;
  transactions: Transaction[];
  assetHistory: Record<string, AssetHistory>;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const AVAILABLE_ICONS = [
  { name: 'utensils', Comp: Utensils },
  { name: 'car', Comp: Car },
  { name: 'home', Comp: Home },
  { name: 'gamepad', Comp: Gamepad },
  { name: 'activity', Comp: Activity },
  { name: 'user', Comp: User },
  { name: 'dog', Comp: Dog },
  { name: 'banknote', Comp: Banknote },
  { name: 'trending-up', Comp: TrendingUp },
  { name: 'shopping-bag', Comp: ShoppingBag },
  { name: 'coffee', Comp: Coffee },
  { name: 'smartphone', Comp: Smartphone },
  { name: 'hammer', Comp: Hammer },
  { name: 'plane', Comp: Plane },
  { name: 'music', Comp: Music },
  { name: 'gift', Comp: Gift },
  { name: 'wifi', Comp: Wifi },
  { name: 'zap', Comp: Zap },
  { name: 'book', Comp: Book },
  { name: 'briefcase', Comp: Briefcase },
  { name: 'shirt', Comp: Shirt },
  { name: 'circle', Comp: Circle },
  { name: 'landmark', Comp: Landmark },
  { name: 'credit-card', Comp: CreditCardIcon },
  { name: 'wallet', Comp: Wallet },
  { name: 'dollar-sign', Comp: DollarSign },
  { name: 'euro', Comp: Euro },
  { name: 'bitcoin', Comp: Bitcoin },
  { name: 'gem', Comp: Gem },
  { name: 'rocket', Comp: Rocket },
  { name: 'star', Comp: Star },
  { name: 'heart', Comp: Heart },
  { name: 'shield', Comp: Shield },
  { name: 'lock', Comp: Lock },
  { name: 'key', Comp: Key },
  { name: 'globe', Comp: Globe },
  { name: 'map', Comp: MapIcon },
  { name: 'navigation', Comp: Navigation },
  { name: 'flag', Comp: Flag },
  { name: 'crown', Comp: Crown },
  { name: 'trophy', Comp: Trophy },
  { name: 'award', Comp: Award },
  { name: 'shopping-cart', Comp: ShoppingCart },
  { name: 'truck', Comp: Truck },
  { name: 'package', Comp: Package },
  { name: 'ghost', Comp: Ghost },
  { name: 'smile', Comp: Smile },
  { name: 'thumbs-up', Comp: ThumbsUp },
];

export const Settings: React.FC<SettingsProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'cards' | 'mappings' | 'data' | 'assets'>('general');
  const [userId, setUserId] = useState<string>('');
  const [assetHistory, setAssetHistory] = useState<Record<string, AssetHistory>>({});

  // Mappings State
  const [mappings, setMappings] = useState<DescriptionMap>({});
  const [mapOriginal, setMapOriginal] = useState('');
  const [mapTarget, setMapTarget] = useState('');
  const [mapCategoryId, setMapCategoryId] = useState('');
  const [mapSubCategoryId, setMapSubCategoryId] = useState('');
  const [editingMappingKey, setEditingMappingKey] = useState<string | null>(null);
  
  // Mapping Bulk Actions
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilterCategory, setMappingFilterCategory] = useState('');
  const [mappingFilterSubCategory, setMappingFilterSubCategory] = useState('');
  const [selectedMappingKeys, setSelectedMappingKeys] = useState<string[]>([]);
  const [expandedMappingGroups, setExpandedMappingGroups] = useState<string[]>([]);
  const [batchMapTarget, setBatchMapTarget] = useState('');
  const [batchMapCategory, setBatchMapCategory] = useState('');
  const [batchMapSubCategory, setBatchMapSubCategory] = useState('');
  const [isBatchMapEditOpen, setIsBatchMapEditOpen] = useState(false);
  const [isDuplicateAnalyzerOpen, setIsDuplicateAnalyzerOpen] = useState(false);

  const [isFetchingEvents, setIsFetchingEvents] = useState(false);
  const [eventsMessage, setEventsMessage] = useState('');
  const [pendingCorporateEvents, setPendingCorporateEvents] = useState<any[]>([]);
  const [isReviewingEvents, setIsReviewingEvents] = useState(false);
  
  const uniqueTickers = useMemo(() => {
      const tickers = new Set<string>();
      props.transactions.forEach(t => {
          if (t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker) {
              tickers.add(t.investmentDetails.ticker.trim().toUpperCase());
          }
      });
      return Array.from(tickers).sort();
  }, [props.transactions]);

  const [selectedAssetsToSearch, setSelectedAssetsToSearch] = useState<string[]>([]);

  useEffect(() => {
      if (uniqueTickers.length > 0 && selectedAssetsToSearch.length === 0) {
          setSelectedAssetsToSearch(uniqueTickers);
      }
  }, [uniqueTickers]);

  const handleFetchCorporateEvents = async () => {
    setIsFetchingEvents(true);
    setEventsMessage('Buscando eventos corporativos com IA...');
    setPendingCorporateEvents([]);
    setIsReviewingEvents(false);
    
    try {
      // Find first date and category info for each ticker
      const assetInfoMap = new Map<string, { firstDate: string, categoryId: string, subCategoryId?: string }>();
      props.transactions.forEach(t => {
          if (t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker) {
              const ticker = t.investmentDetails.ticker.trim().toUpperCase();
              if (selectedAssetsToSearch.includes(ticker)) {
                  const current = assetInfoMap.get(ticker);
                  if (!current || t.date < current.firstDate) {
                      assetInfoMap.set(ticker, { 
                          firstDate: t.date.split('T')[0],
                          categoryId: t.categoryId,
                          subCategoryId: t.subCategoryId
                      });
                  }
              }
          }
      });

      const assetsToSearch = Array.from(assetInfoMap.entries()).map(([ticker, info]) => ({ ticker, firstDate: info.firstDate }));

      if (assetsToSearch.length === 0) {
        setEventsMessage('Nenhum ativo encontrado na carteira.');
        setIsFetchingEvents(false);
        return;
      }

      const { events } = await GeminiService.findCorporateEvents(assetsToSearch);
      
      if (events && events.length > 0) {
        const defaultCategoryId = props.categories.find(c => c.type === TransactionType.INVESTMENT)?.id;
        
        const newEvents = [];
        for (const event of events) {
          const cleanTicker = event.ticker.trim().toUpperCase();
          // Check if event already exists
          const exists = props.transactions.some(t => 
            t.investmentDetails?.ticker?.trim().toUpperCase() === cleanTicker && 
            t.investmentDetails?.event === event.event && 
            t.date.startsWith(event.date)
          );

          if (!exists && event.factor && event.ticker && event.date && event.event) {
             const info = assetInfoMap.get(cleanTicker);
             newEvents.push({
                 ...event,
                 selected: true,
                 categoryId: info?.categoryId || defaultCategoryId,
                 subCategoryId: info?.subCategoryId
             });
          }
        }
        
        if (newEvents.length > 0) {
           setPendingCorporateEvents(newEvents);
           setIsReviewingEvents(true);
           setEventsMessage(`Encontrados ${newEvents.length} novos eventos. Por favor, revise abaixo antes de salvar.`);
        } else {
           setEventsMessage('Nenhum evento novo encontrado (todos já estão cadastrados).');
        }
      } else {
        setEventsMessage('Nenhum evento novo encontrado.');
      }
    } catch (error) {
      console.error(error);
      setEventsMessage('Erro ao buscar eventos.');
    } finally {
      setIsFetchingEvents(false);
    }
  };

  const handleConfirmCorporateEvents = async () => {
      setIsFetchingEvents(true);
      setEventsMessage('Salvando eventos...');
      try {
          let addedCount = 0;
          const defaultCategoryId = props.categories.find(c => c.type === TransactionType.INVESTMENT)?.id;

          for (const event of pendingCorporateEvents) {
              if (!event.selected) continue;
              
              const catId = event.categoryId || defaultCategoryId;
              if (!catId) continue;

              const newTx: Transaction = {
                id: generateId(),
                userId,
                description: `${event.event === 'SPLIT' ? 'Desdobramento' : event.event === 'BONUS' ? 'Bonificação' : 'Grupamento'} ${event.ticker}`,
                amount: 0,
                date: `${event.date}T12:00:00.000Z`,
                type: TransactionType.INVESTMENT,
                categoryId: catId,
                subCategoryId: event.subCategoryId,
                paymentMethod: PaymentMethod.DEBIT_CASH,
                isPaid: true,
                investmentDetails: {
                  ticker: event.ticker,
                  event: event.event === 'BONUS' ? 'SPLIT' : event.event as any,
                  quantity: event.event === 'BONUS' ? 1 + event.factor : event.factor,
                  price: 0,
                  fees: 0
                }
              };
              await StorageService.addTransaction(newTx);
              addedCount++;
          }
          setEventsMessage(`Sucesso! ${addedCount} eventos adicionados à sua carteira.`);
          setPendingCorporateEvents([]);
          setIsReviewingEvents(false);
      } catch (error) {
          console.error(error);
          setEventsMessage('Erro ao salvar eventos.');
      } finally {
          setIsFetchingEvents(false);
      }
  };

  useEffect(() => {
    if (auth.currentUser) {
        setUserId(auth.currentUser.uid);
    }
    // Load Mappings
    StorageService.getMappings().then(setMappings);
    StorageService.subscribeToAssetHistory(setAssetHistory);
  }, []);
  
  const [expCatName, setExpCatName] = useState('');
  const [expCatIcon, setExpCatIcon] = useState('circle');
  
  const [incCatName, setIncCatName] = useState('');
  const [incCatIcon, setIncCatIcon] = useState('circle');

  const [invCatName, setInvCatName] = useState('');
  const [invCatIcon, setInvCatIcon] = useState('circle');

  const [selectedCatForSub, setSelectedCatForSub] = useState<string>('');
  const [newSubName, setNewSubName] = useState('');

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [batchMonth, setBatchMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transactionsToDelete = useMemo(() => {
    if (!batchCategoryId || !batchMonth) return [];
    
    return props.transactions.filter(t => {
      const dateMatch = t.date.startsWith(batchMonth);
      const catMatch = t.categoryId === batchCategoryId;
      return dateMatch && catMatch;
    });
  }, [props.transactions, batchMonth, batchCategoryId]);

  const totalValueToDelete = transactionsToDelete.reduce((acc, t) => acc + t.amount, 0);

  const filteredMappings = useMemo(() => {
      const term = mappingSearch.toLowerCase();
      return Object.entries(mappings).filter(([key, val]) => {
          const mappingValue = val as { targetDescription: string, categoryId?: string, subCategoryId?: string };
          
          let matchesCategory = true;
          if (mappingFilterCategory) {
              matchesCategory = mappingValue.categoryId === mappingFilterCategory;
          }
          
          let matchesSubCategory = true;
          if (mappingFilterSubCategory) {
              matchesSubCategory = mappingValue.subCategoryId === mappingFilterSubCategory;
          }

          const matchesSearch = key.toLowerCase().includes(term) || mappingValue.targetDescription.toLowerCase().includes(term);

          return matchesSearch && matchesCategory && matchesSubCategory;
      });
  }, [mappings, mappingSearch, mappingFilterCategory, mappingFilterSubCategory]);

  const handleAddCategory = (type: TransactionType) => {
    let name = '';
    let icon = '';

    if (type === TransactionType.EXPENSE) { name = expCatName; icon = expCatIcon; }
    else if (type === TransactionType.INCOME) { name = incCatName; icon = incCatIcon; }
    else if (type === TransactionType.INVESTMENT) { name = invCatName; icon = invCatIcon; }

    if (!name.trim()) return;

    if (editingCategory) {
        if (editingCategory.type !== type) return; 
        const updated: Category = {
            ...editingCategory,
            name,
            icon
        };
        props.onUpdateCategory(updated);
        cancelEditCategory();
        return;
    }
    
    let color = '#ef4444';
    if (type === TransactionType.INCOME) color = '#10b981';
    if (type === TransactionType.INVESTMENT) color = '#3b82f6';

    const newCat: Category = {
      id: generateId(),
      name: name,
      type: type,
      color: color,
      icon: icon
    };

    const updated = [...props.categories, newCat];
    props.setCategories(updated);
    props.onSaveCategories(updated); 
    
    resetInputs(type);
  };

  const handleEditCategory = (cat: Category) => {
      setEditingCategory(cat);
      if (cat.type === TransactionType.EXPENSE) {
          setExpCatName(cat.name);
          setExpCatIcon(cat.icon);
      } else if (cat.type === TransactionType.INCOME) {
          setIncCatName(cat.name);
          setIncCatIcon(cat.icon);
      } else if (cat.type === TransactionType.INVESTMENT) {
          setInvCatName(cat.name);
          setInvCatIcon(cat.icon);
      }
  };

  const cancelEditCategory = () => {
      setEditingCategory(null);
      setExpCatName('');
      setExpCatIcon('circle');
      setIncCatName('');
      setIncCatIcon('circle');
      setInvCatName('');
      setInvCatIcon('circle');
  };

  const resetInputs = (type: TransactionType) => {
      if (type === TransactionType.EXPENSE) {
        setExpCatName('');
        setExpCatIcon('circle');
    } else if (type === TransactionType.INCOME) {
        setIncCatName('');
        setIncCatIcon('circle');
    } else if (type === TransactionType.INVESTMENT) {
        setInvCatName('');
        setInvCatIcon('circle');
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    
    props.onDeleteCategory(id);
    
    const updated = props.categories.filter(c => c.id !== id);
    props.setCategories(updated);
    
    props.subCategories
        .filter(s => s.categoryId === id)
        .forEach(s => props.onDeleteSubCategory(s.id));
        
    const updatedSubs = props.subCategories.filter(s => s.categoryId !== id);
    props.setSubCategories(updatedSubs);
    
    setDeleteConfirmId(null);
    if (editingCategory?.id === id) cancelEditCategory();
  };

  const handleAddSubCategory = () => {
    if (!newSubName.trim() || (!selectedCatForSub && !editingSubCategory)) return;

    if (editingSubCategory) {
        const updated: SubCategory = {
            ...editingSubCategory,
            name: newSubName,
            categoryId: selectedCatForSub || editingSubCategory.categoryId 
        };
        props.onUpdateSubCategory(updated);
        cancelEditSubCategory();
        return;
    }

    const newSub: SubCategory = {
      id: generateId(),
      categoryId: selectedCatForSub,
      name: newSubName
    };
    const updated = [...props.subCategories, newSub];
    props.setSubCategories(updated);
    props.onSaveSubCategories(updated);
    setNewSubName('');
  };

  const handleEditSubCategory = (sub: SubCategory) => {
      setEditingSubCategory(sub);
      setNewSubName(sub.name);
      setSelectedCatForSub(sub.categoryId);
  };

  const cancelEditSubCategory = () => {
      setEditingSubCategory(null);
      setNewSubName('');
  };

  const handleDeleteSubCategory = (id: string) => {
    props.onDeleteSubCategory(id);
    const updated = props.subCategories.filter(s => s.id !== id);
    props.setSubCategories(updated);
    if (editingSubCategory?.id === id) cancelEditSubCategory();
  };

  const handleAddCard = (card: CreditCard) => {
    const updated = [...props.creditCards, card];
    props.setCreditCards(updated);
    props.onSaveCards(updated);
  };
  
  const handleUpdateCard = (card: CreditCard) => {
    const updated = props.creditCards.map(c => c.id === card.id ? card : c);
    props.setCreditCards(updated);
    props.onSaveCards(updated);
  };

  const handleDeleteCard = (id: string) => {
    props.onDeleteCard(id);
    const updated = props.creditCards.filter(c => c.id !== id);
    props.setCreditCards(updated);
  };

  const handleBatchDelete = async () => {
      if (transactionsToDelete.length === 0) return;
      if (!confirm(`Tem certeza que deseja apagar ${transactionsToDelete.length} lançamentos desta categoria?\nEssa ação é irreversível.`)) return;

      setIsDeletingBatch(true);
      try {
          const ids = transactionsToDelete.map(t => t.id);
          await StorageService.batchDeleteTransactions(ids);
          setBatchCategoryId(''); 
          alert("Lançamentos apagados com sucesso.");
      } catch (e) {
          console.error(e);
          alert("Erro ao apagar lançamentos.");
      } finally {
          setIsDeletingBatch(false);
      }
  };

  // MAPPING FUNCTIONS
  const handleSaveMapping = async () => {
      if (!mapOriginal.trim() || !mapTarget.trim()) return;
      
      const newMappings = { ...mappings };
      
      // If editing key changed, delete old key
      if (editingMappingKey && editingMappingKey !== mapOriginal.trim()) {
          delete newMappings[editingMappingKey];
      }

      newMappings[mapOriginal.trim()] = {
          targetDescription: mapTarget.trim(),
          categoryId: mapCategoryId || undefined,
          subCategoryId: mapSubCategoryId || undefined
      };

      setMappings(newMappings);
      await StorageService.saveMappings(newMappings);
      
      // Reset form
      setMapOriginal('');
      setMapTarget('');
      setMapCategoryId('');
      setMapSubCategoryId('');
      setEditingMappingKey(null);
  };

  const handleEditMapping = (key: string) => {
      const m = mappings[key];
      setMapOriginal(key);
      setMapTarget(m.targetDescription);
      setMapCategoryId(m.categoryId || '');
      setMapSubCategoryId(m.subCategoryId || '');
      setEditingMappingKey(key);
  };

  const handleDeleteMapping = async (key: string) => {
      const newMappings = { ...mappings };
      delete newMappings[key];
      setMappings(newMappings);
      await StorageService.saveMappings(newMappings);
      if (editingMappingKey === key) {
          setMapOriginal('');
          setMapTarget('');
          setMapCategoryId('');
          setMapSubCategoryId('');
          setEditingMappingKey(null);
      }
  };

  const toggleMappingSelection = (key: string) => {
      setSelectedMappingKeys(prev => 
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
  };

  const handleSelectAllMappings = () => {
      if (selectedMappingKeys.length === filteredMappings.length) {
          setSelectedMappingKeys([]);
      } else {
          setSelectedMappingKeys(filteredMappings.map(([key]) => key));
      }
  };

  const handleBatchDeleteMapping = async () => {
      if (selectedMappingKeys.length === 0) return;
      if (!confirm(`Excluir ${selectedMappingKeys.length} regras selecionadas?`)) return;

      const newMappings = { ...mappings };
      selectedMappingKeys.forEach(key => delete newMappings[key]);
      
      setMappings(newMappings);
      await StorageService.saveMappings(newMappings);
      setSelectedMappingKeys([]);
  };

  const handleBatchUpdateMapping = async () => {
      if (selectedMappingKeys.length === 0) return;
      if (!batchMapCategory && !batchMapTarget) return; // Must have at least one change
      
      const newMappings = { ...mappings };
      selectedMappingKeys.forEach(key => {
          if (newMappings[key]) {
              newMappings[key] = {
                  ...newMappings[key],
                  targetDescription: batchMapTarget ? batchMapTarget : newMappings[key].targetDescription,
                  categoryId: batchMapCategory || newMappings[key].categoryId,
                  subCategoryId: batchMapSubCategory || newMappings[key].subCategoryId,
              };
          }
      });

      setMappings(newMappings);
      await StorageService.saveMappings(newMappings);
      setIsBatchMapEditOpen(false);
      setSelectedMappingKeys([]);
      setBatchMapTarget('');
      setBatchMapCategory('');
      setBatchMapSubCategory('');
  };

  // BACKUP FUNCTIONS
  const handleExportBackup = () => {
      const backupData = {
          categories: props.categories,
          subCategories: props.subCategories,
          creditCards: props.creditCards,
          transactions: props.transactions,
          settings: props.settings,
          mappings: mappings, // Include mappings in backup
          exportedAt: new Date().toISOString(),
          version: "1.0"
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `finanze_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      
      const file = e.target.files[0];
      if (!confirm("Atenção: A restauração irá sobrescrever dados existentes com o mesmo ID e adicionar novos dados. Dados não presentes no backup serão mantidos. Deseja continuar?")) {
          e.target.value = ''; // Reset input
          return;
      }

      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              await StorageService.restoreBackup(json);
              
              // Also restore mappings if present
              if (json.mappings) {
                  await StorageService.saveMappings(json.mappings);
                  setMappings(json.mappings);
              }

              alert("Backup restaurado com sucesso! Os dados serão atualizados em instantes.");
          } catch (error) {
              console.error(error);
              alert("Erro ao processar o arquivo de backup. Verifique se é um JSON válido.");
          } finally {
              setIsRestoring(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const renderCategoryList = (type: TransactionType) => {
      const filtered = props.categories.filter(c => c.type === type);
      
      if (filtered.length === 0) {
          return <p className="text-xs text-gray-500 italic p-2">Nenhuma categoria encontrada.</p>;
      }

      return (
        <div className="space-y-2">
            {filtered.map(cat => {
                const IconComp = AVAILABLE_ICONS.find(i => i.name === cat.icon)?.Comp || Circle;
                const isEditing = editingCategory?.id === cat.id;
                
                return (
                <div key={cat.id} className={`flex justify-between items-center p-3 rounded-lg border group transition-colors shadow-sm ${isEditing ? 'bg-gray-50 border-gray-200' : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cat.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : (cat.type === TransactionType.INVESTMENT ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600')}`}>
                            <IconComp size={16} />
                        </div>
                        <span className={`text-sm font-semibold ${isEditing ? 'text-gray-800' : 'text-gray-800'}`}>
                            {cat.name} {isEditing && '(Editando...)'}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {deleteConfirmId === cat.id ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                <span className="text-[10px] text-rose-500 font-bold uppercase">Confirmar?</span>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded"><Check size={16} /></button>
                                <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><AlertCircle size={16} /></button>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={() => handleEditCategory(cat)}
                                    className={`text-gray-700 hover:text-gray-700 transition-all p-1 ${isEditing ? 'text-gray-700' : 'opacity-0 group-hover:opacity-100'}`}
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="text-gray-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                );
            })}
        </div>
      );
  };

  const IconPicker = ({ currentIcon, setIcon, colorClass }: { currentIcon: string, setIcon: (s: string) => void, colorClass: string }) => (
    <div>
        <span className="text-xs text-gray-500 block mb-2 font-medium">Ícone:</span>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-32 overflow-y-auto p-1 bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg custom-scrollbar">
            {AVAILABLE_ICONS.map(({ name, Comp }) => (
                <button
                    key={name}
                    onClick={() => setIcon(name)}
                    type="button"
                    className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                        currentIcon === name 
                        ? `${colorClass} text-gray-900 shadow-md scale-105 ring-2 ring-offset-1` 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title={name}
                >
                    <Comp size={18} />
                </button>
            ))}
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wide">
        <SettingsIcon className="text-zinc-700 dark:text-zinc-300" size={20} /> Configurações
      </h2>

      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0 overflow-x-auto w-fit max-w-full custom-scrollbar">
        {[
          { id: 'general', label: 'Geral & Metas' },
          { id: 'categories', label: 'Categorias' },
          { id: 'cards', label: 'Cartões' },
          { id: 'mappings', label: 'Mapeamento', icon: Replace },
          { id: 'data', label: 'Dados', icon: Database },
          { id: 'assets', label: 'Ativos', icon: TrendingUp }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {tab.icon && <tab.icon size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-lg border border-zinc-200/40 dark:border-zinc-800/60 shadow-zinc-200/5 min-h-[400px]">
        {activeTab === 'assets' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Eventos Corporativos</h3>
                    <p className="text-sm text-gray-500">Busque desdobramentos, grupamentos e bonificações automaticamente com IA.</p>
                  </div>
                  <button
                    onClick={handleFetchCorporateEvents}
                    disabled={isFetchingEvents || selectedAssetsToSearch.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {isFetchingEvents ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Buscar Eventos com IA
                  </button>
                </div>

                {uniqueTickers.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-gray-700">Ativos para buscar:</label>
                      <button 
                        onClick={() => {
                          if (selectedAssetsToSearch.length === uniqueTickers.length) {
                            setSelectedAssetsToSearch([]);
                          } else {
                            setSelectedAssetsToSearch(uniqueTickers);
                          }
                        }}
                        className="text-xs text-blue-600 font-medium hover:underline"
                      >
                        {selectedAssetsToSearch.length === uniqueTickers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      {uniqueTickers.map(ticker => (
                        <label key={ticker} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                            checked={selectedAssetsToSearch.includes(ticker)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssetsToSearch([...selectedAssetsToSearch, ticker]);
                              } else {
                                setSelectedAssetsToSearch(selectedAssetsToSearch.filter(t => t !== ticker));
                              }
                            }}
                          />
                          <span className="font-medium text-gray-700">{ticker}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {eventsMessage && (
                  <div className={`p-3 rounded-lg text-sm ${eventsMessage.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-800'}`}>
                    {eventsMessage}
                  </div>
                )}

                {isReviewingEvents && pendingCorporateEvents.length > 0 && (
                  <div className="mt-4 p-4 border border-gray-200 bg-gray-50/50 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-900">Revisão de Eventos</h4>
                      <button 
                        onClick={() => {
                          const allSelected = pendingCorporateEvents.every(e => e.selected);
                          setPendingCorporateEvents(pendingCorporateEvents.map(e => ({ ...e, selected: !allSelected })));
                        }}
                        className="text-xs text-gray-700 font-medium hover:underline"
                      >
                        {pendingCorporateEvents.every(e => e.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                      {pendingCorporateEvents.map((event, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 text-sm">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                const newEvents = [...pendingCorporateEvents];
                                newEvents[idx].selected = !newEvents[idx].selected;
                                setPendingCorporateEvents(newEvents);
                              }}
                              className="text-gray-700"
                            >
                              {event.selected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${event.event === 'SPLIT' ? 'bg-emerald-100 text-emerald-700' : (event.event === 'BONUS' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700')}`}>
                              {event.event === 'SPLIT' ? 'Desdobramento' : (event.event === 'BONUS' ? 'Bonificação' : 'Grupamento')}
                            </span>
                            <span className="font-bold text-gray-800">{event.ticker}</span>
                            <span className="text-gray-500">{event.date}</span>
                          </div>
                          <div className="font-medium text-gray-800">
                            Fator: {event.factor}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setPendingCorporateEvents([]);
                          setIsReviewingEvents(false);
                          setEventsMessage('Busca cancelada.');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-700 bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmCorporateEvents}
                        disabled={isFetchingEvents}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
                      >
                        {isFetchingEvents ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Confirmar e Salvar
                      </button>
                    </div>
                  </div>
                )}
            </div>
        )}
        {/* ... General Tab (No Changes) ... */}
        {activeTab === 'general' && (
          <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-left-4">
             {/* ... general content ... */}
             <div>
               <div className="flex items-center gap-3 mb-4">
                 <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                    <Target size={24} />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-900">Meta de Gastos</h3>
                    <p className="text-sm text-gray-500">Defina quanto da sua receita mensal você deseja comprometer.</p>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div className="flex justify-between text-sm font-medium">
                   <span>Meta atual</span>
                   <span className="text-gray-700">{props.settings.monthlyBudgetPercentage}% da receita</span>
                 </div>
                 <input 
                    type="range" 
                    min="1" max="100" 
                    value={props.settings.monthlyBudgetPercentage}
                    onChange={(e) => {
                      const newSettings = { ...props.settings, monthlyBudgetPercentage: parseInt(e.target.value) };
                      props.setSettings(newSettings);
                      props.onSaveSettings(newSettings);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
                 />
                 <div className="flex justify-between text-xs text-gray-500">
                   <span>Poupar Tudo (1%)</span>
                   <span>Gastar Tudo (100%)</span>
                 </div>
               </div>
               
               <div className="mt-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                  💡 A regra 50/30/20 sugere gastar no máximo 80% (50% essencial + 30% lazer) e investir 20%.
               </div>
             </div>

             <div className="border-t border-gray-200 pt-8">
                 <div className="flex items-center gap-3 mb-4">
                     <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                         <Calendar size={24} />
                     </div>
                     <div>
                         <h3 className="text-lg font-bold text-gray-900">Dia do Mês Contábil (Salário)</h3>
                         <p className="text-sm text-gray-500">Configure o dia do seu pagamento para organizar os meses.</p>
                     </div>
                 </div>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Dia do Pagamento</label>
                         <div className="flex items-center gap-2">
                             <input 
                                type="number" 
                                min="1" max="31"
                                value={props.settings.salaryDay || 1}
                                onChange={(e) => {
                                    const newDay = Math.min(31, Math.max(1, parseInt(e.target.value) || 1));
                                    const currentShift = props.settings.salaryShift ?? (newDay >= 20 ? 1 : 0);
                                    
                                    const newSettings = { 
                                        ...props.settings, 
                                        salaryDay: newDay,
                                        salaryShift: currentShift 
                                    };
                                    props.setSettings(newSettings);
                                    props.onSaveSettings(newSettings);
                                }}
                                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                             />
                             <span className="text-sm text-gray-700">de cada mês.</span>
                         </div>
                     </div>

                     <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                         <label className="block text-xs font-bold text-gray-500 mb-2">Este dia inicia os lançamentos de qual mês?</label>
                         <div className="flex flex-col gap-2">
                             <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${props.settings.salaryShift === 1 ? 'bg-emerald-50 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-gray-200 hover:border-gray-300'}`}>
                                 <input 
                                    type="radio" 
                                    name="salaryShift"
                                    checked={props.settings.salaryShift === 1}
                                    onChange={() => {
                                        const newSettings = { ...props.settings, salaryShift: 1 };
                                        props.setSettings(newSettings);
                                        props.onSaveSettings(newSettings);
                                    }}
                                    className="mt-1"
                                 />
                                 <div>
                                     <span className="block text-sm font-bold text-gray-900">Do Próximo Mês (Antecipação)</span>
                                     <span className="text-xs text-gray-500">
                                         Ex: Recebo dia <strong>{props.settings.salaryDay || 1}/Nov</strong>, mas este salário paga as contas de <strong>Dezembro</strong>.
                                         <br/>Lançamentos a partir do dia {props.settings.salaryDay || 1} contam para o mês seguinte.
                                     </span>
                                 </div>
                             </label>

                             <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${props.settings.salaryShift === 0 ? 'bg-emerald-50 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-gray-200 hover:border-gray-300'}`}>
                                 <input 
                                    type="radio" 
                                    name="salaryShift"
                                    checked={props.settings.salaryShift === 0 || props.settings.salaryShift === undefined}
                                    onChange={() => {
                                        const newSettings = { ...props.settings, salaryShift: 0 };
                                        props.setSettings(newSettings);
                                        props.onSaveSettings(newSettings);
                                    }}
                                    className="mt-1"
                                 />
                                 <div>
                                     <span className="block text-sm font-bold text-gray-900">Do Próprio Mês (Vigente)</span>
                                     <span className="text-xs text-gray-500">
                                         Ex: Recebo dia <strong>{props.settings.salaryDay || 1}/Dez</strong> e este salário é para as contas de <strong>Dezembro</strong>.
                                         <br/>Lançamentos a partir do dia {props.settings.salaryDay || 1} contam para o próprio mês.
                                     </span>
                                 </div>
                             </label>
                         </div>
                     </div>
                 </div>
             </div>

             <div className="border-t border-gray-200 pt-8">
                 <div className="flex items-center gap-3 mb-4">
                     <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                         <Fingerprint size={24} />
                     </div>
                     <div>
                         <h3 className="text-lg font-bold text-gray-900">Identificação do Usuário</h3>
                         <p className="text-sm text-gray-500">Use este ID para recuperar dados no banco de dados.</p>
                     </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-2">
                     <span className="text-xs font-bold text-gray-500 uppercase">Seu ID Atual</span>
                     <code className="text-xs sm:text-sm font-mono bg-white dark:bg-zinc-900 p-2 rounded border border-gray-200 text-gray-800 break-all select-all">
                         {userId || "Carregando..."}
                     </code>
                     <p className="text-xs text-gray-500 mt-1">
                         * O app mostra apenas transações que contenham o campo <strong>userId</strong> igual a este código.
                     </p>
                 </div>
             </div>

             <div className="border-t border-gray-200 pt-8">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                          <History size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-gray-900">Início do Histórico Mensal</h3>
                          <p className="text-sm text-gray-500">Escolha a partir de qual mês o histórico detalhado deve ser mostrado.</p>
                      </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Mês Inicial</label>
                          <div className="flex items-center gap-2">
                              <input 
                                 type="month" 
                                 value={props.settings.historyStartDate ? props.settings.historyStartDate.slice(0, 7) : ""}
                                 onChange={(e) => {
                                     const val = e.target.value;
                                     const newSettings = { 
                                         ...props.settings, 
                                         historyStartDate: val ? `${val}-01` : undefined 
                                     };
                                     props.setSettings(newSettings);
                                     props.onSaveSettings(newSettings);
                                 }}
                                 className="px-3 py-2 border border-gray-200 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                              />
                              {props.settings.historyStartDate && (
                                  <button 
                                    onClick={() => {
                                        const newSettings = { ...props.settings, historyStartDate: undefined };
                                        props.setSettings(newSettings);
                                        props.onSaveSettings(newSettings);
                                    }}
                                    className="text-xs text-rose-500 font-bold hover:underline"
                                  >
                                    Limpar (Usar todo o histórico)
                                  </button>
                              )}
                          </div>
                      </div>
                      <p className="text-xs text-gray-500">
                          * Se não definido, o app mostrará os últimos 12 meses por padrão.
                      </p>
                  </div>
              </div>

              <div className="border-t border-gray-200 pt-8">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                          <RefreshCcw size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-gray-900">Zerar Saldo de Resgates</h3>
                          <p className="text-sm text-gray-500">Escolha a partir de qual mês e ano o saldo acumulado de resgates será zerado.</p>
                      </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Mês de Zeramento</label>
                          <div className="flex items-center gap-2">
                              <input 
                                 type="month" 
                                 value={props.settings.resgatesResetMonth || ""}
                                 onChange={(e) => {
                                     const val = e.target.value;
                                     const newSettings = { 
                                         ...props.settings, 
                                         resgatesResetMonth: val || undefined 
                                     };
                                     props.setSettings(newSettings);
                                     props.onSaveSettings(newSettings);
                                 }}
                                 className="px-3 py-2 border border-gray-200 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                              />
                              {props.settings.resgatesResetMonth && (
                                  <button 
                                    onClick={() => {
                                        const newSettings = { ...props.settings, resgatesResetMonth: undefined };
                                        props.setSettings(newSettings);
                                        props.onSaveSettings(newSettings);
                                    }}
                                    className="text-xs text-rose-500 font-bold hover:underline"
                                  >
                                    Limpar (Não zerar)
                                  </button>
                              )}
                          </div>
                      </div>
                      <p className="text-xs text-gray-500">
                          * A partir do mês selecionado, o saldo acumulado de resgates de investimentos começará do zero.
                      </p>
                  </div>
              </div>
          </div>
        )}

        {activeTab === 'categories' && (
          // ... categories content ...
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4">
            <div className="space-y-6">
               <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                    <ArrowDownCircle size={20} className="text-rose-500" />
                    <h3 className="font-bold text-rose-700">Despesas</h3>
               </div>

               <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3">
                 <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wide">
                        {editingCategory && editingCategory.type === TransactionType.EXPENSE ? 'Editar Categoria' : 'Nova Categoria de Despesa'}
                    </h4>
                    {editingCategory && editingCategory.type === TransactionType.EXPENSE && (
                        <button onClick={cancelEditCategory} className="text-xs text-rose-500 hover:underline">Cancelar</button>
                    )}
                 </div>
                 <div className="flex gap-2">
                    <input 
                    type="text" 
                    value={expCatName}
                    onChange={(e) => setExpCatName(e.target.value)}
                    placeholder="Nome da categoria..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none text-gray-900"
                    />
                 </div>
                 <IconPicker currentIcon={expCatIcon} setIcon={setExpCatIcon} colorClass="bg-rose-500 ring-rose-300" />
                 <button 
                  onClick={() => handleAddCategory(TransactionType.EXPENSE)}
                  className="w-full bg-rose-600 text-white py-2 rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
                >
                  {editingCategory && editingCategory.type === TransactionType.EXPENSE ? <Check size={16} /> : <Plus size={16} />} 
                  {editingCategory && editingCategory.type === TransactionType.EXPENSE ? 'Atualizar Categoria' : 'Adicionar Despesa'}
                </button>
               </div>

               <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                   {renderCategoryList(TransactionType.EXPENSE)}
               </div>

               <div className="pt-6 border-t border-gray-200 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers size={18} className="text-gray-500 rotate-180"/>
                        <h3 className="font-bold text-gray-800">Subcategorias</h3>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                {editingSubCategory ? 'Editar Subcategoria' : 'Categoria Mãe (Despesa/Investimento)'}
                            </label>
                            {editingSubCategory && (
                                <button onClick={cancelEditSubCategory} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                            )}
                        </div>
                        <select 
                        value={selectedCatForSub}
                        onChange={(e) => setSelectedCatForSub(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-500 text-gray-900"
                        >
                        <option value="">Selecione...</option>
                        {/* Only Expense and Investment categories can have subcategories */}
                        {props.categories.filter(c => c.type === TransactionType.EXPENSE || c.type === TransactionType.INVESTMENT).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1 italic">* Receitas não possuem subcategorias.</p>
                        
                        <div className="flex gap-2 mt-2">
                        <input 
                            type="text" 
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            placeholder="Nome da subcategoria..."
                            disabled={!selectedCatForSub}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-500 outline-none disabled:bg-gray-100 text-gray-900"
                        />
                        <button 
                            onClick={handleAddSubCategory}
                            disabled={!selectedCatForSub}
                            className={`text-white p-2 rounded-lg transition-colors shadow-sm ${editingSubCategory ? 'bg-gray-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300'}`}
                        >
                            {editingSubCategory ? <Check size={20} /> : <Plus size={20} />}
                        </button>
                        </div>
                    </div>

                    <div className="mt-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {selectedCatForSub ? (
                            props.subCategories.filter(s => s.categoryId === selectedCatForSub).length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-2 italic">Nenhuma subcategoria.</p>
                            ) : (
                                props.subCategories.filter(s => s.categoryId === selectedCatForSub).map(sub => {
                                    const isEditingSub = editingSubCategory?.id === sub.id;
                                    return (
                                    <div key={sub.id} className={`flex justify-between items-center p-2 mb-1 rounded border group transition-colors shadow-sm ${isEditingSub ? 'bg-gray-50 border-gray-200' : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 border-gray-200'}`}>
                                        <span className={`text-sm font-medium ${isEditingSub ? 'text-gray-800' : 'text-gray-700'}`}>{sub.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEditSubCategory(sub)}
                                                className={`text-gray-700 hover:text-gray-700 transition-all p-1 ${isEditingSub ? 'text-gray-700' : 'opacity-0 group-hover:opacity-100'}`}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSubCategory(sub.id)}
                                                className="text-gray-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })
                            )
                        ) : (
                            <div className="text-center py-6 text-gray-500 text-xs">Selecione uma categoria acima para gerenciar.</div>
                        )}
                    </div>
               </div>
            </div>

            <div className="space-y-6">
                {/* INCOME SECTION */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                        <ArrowUpCircle size={20} className="text-emerald-500" />
                        <h3 className="font-bold text-emerald-700">Receitas</h3>
                    </div>

                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                                {editingCategory && editingCategory.type === TransactionType.INCOME ? 'Editar Categoria' : 'Nova Categoria de Receita'}
                            </h4>
                            {editingCategory && editingCategory.type === TransactionType.INCOME && (
                                <button onClick={cancelEditCategory} className="text-xs text-emerald-500 hover:underline">Cancelar</button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                            type="text" 
                            value={incCatName}
                            onChange={(e) => setIncCatName(e.target.value)}
                            placeholder="Nome da categoria..."
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900"
                            />
                        </div>
                        <IconPicker currentIcon={incCatIcon} setIcon={setIncCatIcon} colorClass="bg-emerald-500 ring-emerald-300" />
                        <button 
                        onClick={() => handleAddCategory(TransactionType.INCOME)}
                        className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
                        >
                        {editingCategory && editingCategory.type === TransactionType.INCOME ? <Check size={16} /> : <Plus size={16} />} 
                        {editingCategory && editingCategory.type === TransactionType.INCOME ? 'Atualizar Categoria' : 'Adicionar Receita'}
                        </button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {renderCategoryList(TransactionType.INCOME)}
                    </div>
                </div>

                {/* INVESTMENT SECTION */}
                <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                        <TrendingUp size={20} className="text-blue-500" />
                        <h3 className="font-bold text-blue-700">Investimentos</h3>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                                {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? 'Editar Categoria' : 'Nova Categoria de Investimento'}
                            </h4>
                            {editingCategory && editingCategory.type === TransactionType.INVESTMENT && (
                                <button onClick={cancelEditCategory} className="text-xs text-blue-500 hover:underline">Cancelar</button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                            type="text" 
                            value={invCatName}
                            onChange={(e) => setInvCatName(e.target.value)}
                            placeholder="Nome da categoria..."
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                            />
                        </div>
                        <IconPicker currentIcon={invCatIcon} setIcon={setInvCatIcon} colorClass="bg-blue-500 ring-blue-300" />
                        <button 
                        onClick={() => handleAddCategory(TransactionType.INVESTMENT)}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
                        >
                        {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? <Check size={16} /> : <Plus size={16} />} 
                        {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? 'Atualizar Categoria' : 'Adicionar Investimento'}
                        </button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {renderCategoryList(TransactionType.INVESTMENT)}
                    </div>
                </div>
            </div>

          </div>
        )}

        {/* Other Tabs (Cards, Mappings, Data) remain unchanged */}
        {activeTab === 'cards' && (
           <div className="animate-in fade-in slide-in-from-left-4">
             <CreditCardManager 
                cards={props.creditCards}
                transactions={props.transactions}
                onAddCard={handleAddCard}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
             />
           </div>
        )}

        {activeTab === 'mappings' && (
            <div className="animate-in fade-in slide-in-from-left-4 space-y-8 max-w-4xl">
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                                <Replace size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Mapeamento Automático</h3>
                                <p className="text-sm text-gray-500">Defina regras para renomear e categorizar transações automaticamente durante a importação.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsDuplicateAnalyzerOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 shrink-0"
                        >
                            <Sparkles size={16} />
                            <span>Analisar Duplicações</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contém no Original</label>
                                <input 
                                    type="text" 
                                    value={mapOriginal}
                                    onChange={(e) => {
                                        setMapOriginal(e.target.value);
                                        
                                        // Suggest most frequent category/subcategory
                                        const matchingTransactions = props.transactions.filter(t => t.description.toLowerCase().includes(e.target.value.toLowerCase()));
                                        const catCounts: Record<string, number> = {};
                                        const subCatCounts: Record<string, number> = {};
                                        
                                        matchingTransactions.forEach(t => {
                                            if (t.categoryId) catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + 1;
                                            if (t.subCategoryId) subCatCounts[t.subCategoryId] = (subCatCounts[t.subCategoryId] || 0) + 1;
                                        });
                                        
                                        let mostFreqCat = '';
                                        let maxCount = 0;
                                        Object.entries(catCounts).forEach(([catId, count]) => {
                                            if (count > maxCount) { maxCount = count; mostFreqCat = catId; }
                                        });
                                        
                                        let mostFreqSubCat = '';
                                        let maxSubCount = 0;
                                        Object.entries(subCatCounts).forEach(([subCatId, count]) => {
                                            if (count > maxSubCount) { maxSubCount = count; mostFreqSubCat = subCatId; }
                                        });
                                        
                                        if (mostFreqCat && !mapCategoryId) setMapCategoryId(mostFreqCat);
                                        if (mostFreqSubCat && !mapSubCategoryId) setMapSubCategoryId(mostFreqSubCat);
                                    }}
                                    placeholder="Ex: UBER DO BRASIL TECNOLOGIA"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Texto que aparece na fatura ou extrato.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Renomear Para (Descrição Final)</label>
                                <input 
                                    type="text" 
                                    value={mapTarget}
                                    onChange={(e) => {
                                        setMapTarget(e.target.value);
                                        const existingMapping = (Object.values(mappings) as any[]).find(m => m.targetDescription.trim().toLowerCase() === e.target.value.trim().toLowerCase());
                                        if (existingMapping) {
                                            if (!mapCategoryId && existingMapping.categoryId) setMapCategoryId(existingMapping.categoryId);
                                            if (!mapSubCategoryId && existingMapping.subCategoryId) setMapSubCategoryId(existingMapping.subCategoryId);
                                        }
                                    }}
                                    placeholder="Ex: Uber Viagem"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Atribuir Categoria</label>
                                <select 
                                    value={mapCategoryId}
                                    onChange={(e) => { setMapCategoryId(e.target.value); setMapSubCategoryId(''); }}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                                >
                                    <option value="">Selecione...</option>
                                    {props.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Atribuir Subcategoria</label>
                                <select 
                                    value={mapSubCategoryId}
                                    onChange={(e) => setMapSubCategoryId(e.target.value)}
                                    disabled={!mapCategoryId}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900 disabled:bg-gray-100"
                                >
                                    <option value="">Selecione...</option>
                                    {props.subCategories.filter(s => s.categoryId === mapCategoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            {editingMappingKey && (
                                <button onClick={() => {
                                    setMapOriginal('');
                                    setMapTarget('');
                                    setMapCategoryId('');
                                    setMapSubCategoryId('');
                                    setEditingMappingKey(null);
                                }} className="mr-3 text-sm text-gray-500 hover:text-gray-800 font-bold">Cancelar</button>
                            )}
                            <button 
                                onClick={handleSaveMapping}
                                disabled={!mapOriginal || !mapTarget}
                                className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50 transition-colors"
                            >
                                {editingMappingKey ? 'Atualizar Regra' : 'Adicionar Regra'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-end sm:items-center border-b border-gray-200 pb-2">
                        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Regras Ativas ({Object.keys(mappings).length})</h4>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:flex-none">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                                <input type="text" value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} placeholder="Filtrar regras..." className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gray-500/20" />
                            </div>
                            <div className="flex-1 sm:flex-none">
                                <select 
                                    value={mappingFilterCategory} 
                                    onChange={(e) => {
                                        setMappingFilterCategory(e.target.value);
                                        setMappingFilterSubCategory('');
                                    }} 
                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gray-500/20"
                                >
                                    <option value="">Todas Categorias</option>
                                    {props.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex-1 sm:flex-none">
                                <select 
                                    value={mappingFilterSubCategory} 
                                    onChange={(e) => setMappingFilterSubCategory(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gray-500/20 disabled:bg-gray-50"
                                    disabled={!mappingFilterCategory}
                                >
                                    <option value="">Todas Subcategorias</option>
                                    {mappingFilterCategory && props.subCategories.filter(s => s.categoryId === mappingFilterCategory).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            {(mappingSearch || mappingFilterCategory || mappingFilterSubCategory) && (
                                <button 
                                    onClick={() => {
                                        setMappingSearch('');
                                        setMappingFilterCategory('');
                                        setMappingFilterSubCategory('');
                                    }} 
                                    className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                                    title="Limpar filtros"
                                >
                                    <X size={14}/>
                                </button>
                            )}
                        </div>
                    </div>

                    {selectedMappingKeys.length > 0 && (
                        <div className="bg-gray-50 p-2 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                            <span className="text-xs font-bold text-gray-900 ml-2">{selectedMappingKeys.length} selecionados</span>
                            <div className="flex gap-2">
                                <button onClick={() => {
                                    setBatchMapTarget('');
                                    setBatchMapCategory('');
                                    setBatchMapSubCategory('');
                                    setIsBatchMapEditOpen(true);
                                }} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-200 text-gray-800 rounded text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-1"><Edit3 size={12}/> Alterar Regras</button>
                                <button onClick={handleBatchDeleteMapping} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-rose-200 text-rose-600 rounded text-xs font-bold hover:bg-rose-50 transition-colors flex items-center gap-1"><Trash2 size={12}/> Excluir</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 p-2 rounded-t-lg flex items-center gap-3 border-b border-gray-200">
                        <button onClick={handleSelectAllMappings} className={`p-1 rounded transition-colors ${selectedMappingKeys.length > 0 && selectedMappingKeys.length === filteredMappings.length ? 'text-gray-700' : 'text-gray-700 hover:text-gray-500'}`}>
                            {selectedMappingKeys.length > 0 && selectedMappingKeys.length === filteredMappings.length ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Selecionar Todos Filtrados</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {(() => {
                            const grouped: Record<string, {
                                targetDescription: string;
                                totalOriginals: number;
                                categories: Record<string, {
                                    categoryId?: string;
                                    subCategoryId?: string;
                                    originals: string[];
                                }>;
                            }> = {};

                            filteredMappings.forEach(([key, val]) => {
                                const map = val as { targetDescription: string, categoryId?: string, subCategoryId?: string };
                                const targetKey = map.targetDescription.trim().toLowerCase();
                                
                                if (!grouped[targetKey]) {
                                    grouped[targetKey] = {
                                        targetDescription: map.targetDescription.trim(),
                                        totalOriginals: 0,
                                        categories: {}
                                    };
                                }
                                
                                grouped[targetKey].totalOriginals += 1;
                                
                                const catKey = `${map.categoryId || ''}|${map.subCategoryId || ''}`;
                                if (!grouped[targetKey].categories[catKey]) {
                                    grouped[targetKey].categories[catKey] = {
                                        categoryId: map.categoryId,
                                        subCategoryId: map.subCategoryId,
                                        originals: []
                                    };
                                }
                                
                                grouped[targetKey].categories[catKey].originals.push(key);
                            });

                            const sortedTargets = Object.values(grouped).sort((a, b) => a.targetDescription.localeCompare(b.targetDescription));

                            return sortedTargets.map((group) => {
                                const groupKey = group.targetDescription.trim().toLowerCase();
                                
                                const isExpanded = expandedMappingGroups.includes(groupKey);
                                const toggleExpand = () => {
                                    setExpandedMappingGroups(prev => prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]);
                                };

                                const allOriginals = Object.values(group.categories).flatMap(c => c.originals);
                                const isAllSelected = allOriginals.length > 0 && allOriginals.every(org => selectedMappingKeys.includes(org));
                                const isSomeSelected = allOriginals.some(org => selectedMappingKeys.includes(org));

                                const handleSelectGroup = () => {
                                    if (isAllSelected) {
                                        setSelectedMappingKeys(prev => prev.filter(k => !allOriginals.includes(k)));
                                    } else {
                                        setSelectedMappingKeys(prev => {
                                            const next = [...prev];
                                            allOriginals.forEach(org => {
                                                if (!next.includes(org)) next.push(org);
                                            });
                                            return next;
                                        });
                                    }
                                };

                                return (
                                    <div key={groupKey} className="bg-white dark:bg-zinc-900 border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <button onClick={handleSelectGroup} className={`p-1 rounded transition-colors shrink-0 ${isAllSelected ? 'text-gray-700' : isSomeSelected ? 'text-gray-500' : 'text-gray-400 hover:text-gray-600'}`}>
                                                    {isAllSelected ? <CheckSquare size={16} /> : isSomeSelected ? <MinusSquare size={16} /> : <Square size={16} />}
                                                </button>
                                                <div 
                                                    className="flex-1 cursor-pointer select-none"
                                                    onClick={toggleExpand}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                                        <span className="font-bold text-gray-800 break-words">{group.targetDescription}</span>
                                                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">{group.totalOriginals} {group.totalOriginals === 1 ? 'redação' : 'redações'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setSelectedMappingKeys(allOriginals);
                                                    setBatchMapTarget(group.targetDescription);
                                                    
                                                    const catKeys = Object.keys(group.categories);
                                                    if (catKeys.length === 1) {
                                                        const singleCat = group.categories[catKeys[0]];
                                                        setBatchMapCategory(singleCat.categoryId || '');
                                                        setBatchMapSubCategory(singleCat.subCategoryId || '');
                                                    } else {
                                                        setBatchMapCategory('');
                                                        setBatchMapSubCategory('');
                                                    }
                                                    
                                                    setIsBatchMapEditOpen(true);
                                                }}
                                                className="ml-2 px-2 py-1 bg-white dark:bg-zinc-900 border border-gray-200 text-gray-600 rounded text-xs font-bold hover:bg-gray-50 hover:text-emerald-700 transition-colors flex items-center gap-1 shrink-0"
                                            >
                                                <Edit3 size={12}/> Editar Grupo
                                            </button>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="pl-9 pt-2 space-y-3 animate-in slide-in-from-top-2 fade-in">
                                                {Object.values(group.categories).map((catGroup, idx) => {
                                                    const catName = props.categories.find(c => c.id === catGroup.categoryId)?.name || 'Sem Categoria';
                                                    const subName = props.subCategories.find(s => s.id === catGroup.subCategoryId)?.name;
                                                    
                                                    return (
                                                        <div key={idx} className="space-y-1.5">
                                                            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-500">
                                                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">{catName}</span>
                                                                {subName && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">{subName}</span>}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {catGroup.originals.map(org => {
                                                                    const isSelected = selectedMappingKeys.includes(org);
                                                                    return (
                                                                        <div key={org} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors group/item ${isSelected ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                                                            <button onClick={() => toggleMappingSelection(org)} className={`shrink-0 transition-colors ${isSelected ? 'text-gray-700' : 'text-gray-400 hover:text-gray-700'}`}>
                                                                                {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                                                            </button>
                                                                            <span className="font-mono text-gray-600 truncate max-w-[150px]" title={org}>{org}</span>
                                                                            <div className="flex items-center ml-1 border-l pl-1.5 border-gray-200">
                                                                                <button onClick={() => handleEditMapping(org)} className="p-0.5 text-gray-400 hover:text-sky-600 transition-colors" title="Editar"><Pencil size={11}/></button>
                                                                                <button onClick={() => handleDeleteMapping(org)} className="p-0.5 text-gray-400 hover:text-rose-600 transition-colors ml-0.5" title="Excluir"><Trash2 size={11}/></button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                        {filteredMappings.length === 0 && (
                            <div className="text-center py-8 text-gray-500 italic text-sm">Nenhuma regra encontrada.</div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-left-4">
                {/* ... data content ... */}
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                            <History size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Zerar Saldo Acumulado</h3>
                            <p className="text-sm text-gray-500">Defina uma data de corte para reiniciar a contagem do Saldo Acumulado Geral.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={16} className="text-gray-500" /> Reiniciar contagem a partir de:
                        </label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="date" 
                                value={props.settings.balanceResetDate ? props.settings.balanceResetDate.split('T')[0] : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const iso = val ? new Date(val + 'T12:00:00').toISOString() : undefined;
                                    const newSettings = { ...props.settings, balanceResetDate: iso };
                                    props.setSettings(newSettings);
                                    props.onSaveSettings(newSettings);
                                }}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900 w-full max-w-[200px]"
                            />
                            {props.settings.balanceResetDate && (
                                <button 
                                    onClick={() => {
                                        const newSettings = { ...props.settings, balanceResetDate: undefined };
                                        props.setSettings(newSettings);
                                        props.onSaveSettings(newSettings);
                                    }}
                                    className="text-xs text-rose-500 hover:underline font-medium"
                                >
                                    Limpar (Usar todo o histórico)
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Transações anteriores a esta data serão ignoradas no cálculo do "Acumulado Geral" no Dashboard.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-sky-50 border border-sky-100 p-6 rounded-xl flex flex-col items-center text-center space-y-3">
                        <div className="bg-sky-100 p-3 rounded-full text-sky-600">
                            <Download size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Backup dos Dados</h3>
                            <p className="text-[10px] text-gray-500 leading-tight mt-1">Baixe um arquivo JSON com todas as suas informações.</p>
                        </div>
                        <button 
                            onClick={handleExportBackup} 
                            className="w-full py-2 bg-sky-600 text-gray-900 text-xs font-bold rounded-lg hover:bg-sky-700 transition-colors shadow-sm mt-auto"
                        >
                            Baixar Backup
                        </button>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-xl flex flex-col items-center text-center space-y-3">
                        <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                            {isRestoring ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Restaurar</h3>
                            <p className="text-[10px] text-gray-500 leading-tight mt-1">Carregue um backup para recuperar dados antigos.</p>
                        </div>
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isRestoring}
                            className="w-full py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 mt-auto"
                        >
                            {isRestoring ? 'Restaurando...' : 'Carregar Arquivo'}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleRestoreBackup}
                            accept=".json"
                            className="hidden"
                        />
                    </div>
                </div>

                <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Exclusão em Lote</h3>
                            <p className="text-sm text-gray-500">Apague rapidamente transações de um mês e categoria específica.</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                            <Calendar size={16} className="text-gray-500" /> Mês de Referência (Data da Compra)
                        </label>
                        <input 
                            type="month" 
                            value={batchMonth}
                            onChange={(e) => setBatchMonth(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Serão apagadas transações cuja data original seja neste mês.</p>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                            <Filter size={16} className="text-gray-500" /> Categoria
                        </label>
                        <select
                            value={batchCategoryId}
                            onChange={(e) => setBatchCategoryId(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900 font-medium"
                        >
                            <option value="">Selecione a categoria...</option>
                            {props.categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.type === TransactionType.EXPENSE ? 'Despesa' : (c.type === TransactionType.INVESTMENT ? 'Investimento' : 'Receita')})</option>
                            ))}
                        </select>
                    </div>

                    {batchCategoryId && batchMonth && (
                        <div className="bg-white dark:bg-zinc-900 border border-rose-200 rounded-lg p-4 flex justify-between items-center animate-in zoom-in-95">
                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Encontrados</span>
                                <span className="text-lg font-bold text-gray-900">{transactionsToDelete.length} lançamentos</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Valor Total</span>
                                <span className="text-lg font-bold text-rose-600">R$ {(totalValueToDelete || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={handleBatchDelete}
                        disabled={transactionsToDelete.length === 0 || isDeletingBatch}
                        className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isDeletingBatch ? 'Apagando...' : <><Trash2 size={18} /> Apagar Lançamentos</>}
                    </button>
                    
                    {transactionsToDelete.length > 0 && (
                        <p className="text-center text-xs text-rose-600 font-medium">
                            ⚠️ Cuidado: Esta ação não pode ser desfeita.
                        </p>
                    )}
                </div>
            </div>
        )}

      </div>

      {isBatchMapEditOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
                  <h3 className="font-bold text-lg text-gray-900 mb-4">Editar {selectedMappingKeys.length} Regras</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Novo Nome (Opcional)</label>
                          <input 
                              type="text"
                              value={batchMapTarget}
                              onChange={(e) => setBatchMapTarget(e.target.value)}
                              placeholder="Mantenha vazio para não alterar"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Categoria</label>
                          <select 
                              value={batchMapCategory}
                              onChange={(e) => { setBatchMapCategory(e.target.value); setBatchMapSubCategory(''); }}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900"
                          >
                              <option value="">Selecione...</option>
                              {props.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Subcategoria</label>
                          <select 
                              value={batchMapSubCategory}
                              onChange={(e) => setBatchMapSubCategory(e.target.value)}
                              disabled={!batchMapCategory}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-500 outline-none bg-white dark:bg-zinc-900 disabled:bg-gray-100"
                          >
                              <option value="">Selecione...</option>
                              {props.subCategories.filter(s => s.categoryId === batchMapCategory).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                      <button onClick={() => setIsBatchMapEditOpen(false)} className="flex-1 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                      <button onClick={handleBatchUpdateMapping} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"><Save size={16}/> Salvar</button>
                  </div>
              </div>
          </div>
      )}

      {isDuplicateAnalyzerOpen && (
        <DuplicateRulesAnalyzerModal
          isOpen={isDuplicateAnalyzerOpen}
          onClose={() => setIsDuplicateAnalyzerOpen(false)}
          mappings={mappings}
          categories={props.categories}
          subCategories={props.subCategories}
          onSaveMappings={async (updatedMappings) => {
            setMappings(updatedMappings);
            await StorageService.saveMappings(updatedMappings);
          }}
        />
      )}
    </div>
  );
};