import React, { useState, useMemo } from 'react';
import { Category, SubCategory, DescriptionMap, Transaction } from '../../types';
import { StorageService } from '../../services/storageService';
import { DuplicateRulesAnalyzerModal } from '../DuplicateRulesAnalyzerModal';
import {
  Replace, Sparkles, Search, X, CheckSquare, Square, MinusSquare, Edit3, Trash2,
  ChevronDown, ChevronRight, Pencil, Save, Plus, RefreshCw, ArrowRight, Check,
  AlertCircle, Folder, Tag, PlusCircle, Layers, CheckCircle2, SlidersHorizontal,
  AlertTriangle
} from 'lucide-react';

interface MappingSettingsProps {
  categories: Category[];
  subCategories: SubCategory[];
  transactions: Transaction[];
  mappings: DescriptionMap;
  setMappings: (m: DescriptionMap) => void;
}

interface AglutinatedRuleGroup {
  id: string; // unique key for group (normalized target + category)
  targetDescription: string;
  categoryId?: string;
  subCategoryId?: string;
  originalKeys: string[];
  totalOriginals: number;
}

export const MappingSettings: React.FC<MappingSettingsProps> = ({
  categories,
  subCategories,
  transactions,
  mappings,
  setMappings,
}) => {
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // New Single / Master Rule Form Drawer State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formOriginals, setFormOriginals] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSubCategoryId, setFormSubCategoryId] = useState('');
  const [formIsPattern, setFormIsPattern] = useState(false);

  // Quick Add Inline Variation to an existing group
  const [quickAddInputs, setQuickAddInputs] = useState<Record<string, string>>({});

  // Editing Group Modal / State
  const [editingGroup, setEditingGroup] = useState<AglutinatedRuleGroup | null>(null);
  const [editGroupTarget, setEditGroupTarget] = useState('');
  const [editGroupCategoryId, setEditGroupCategoryId] = useState('');
  const [editGroupSubCategoryId, setEditGroupSubCategoryId] = useState('');

  // Editing Individual Variation State
  const [editingVariation, setEditingVariation] = useState<{ originalKey: string; group: AglutinatedRuleGroup } | null>(null);
  const [editVariationText, setEditVariationText] = useState('');
  const [editVariationIsPattern, setEditVariationIsPattern] = useState(false);

  // Batch Update Modal State
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState('');
  const [batchCategory, setBatchCategory] = useState('');
  const [batchSubCategory, setBatchSubCategory] = useState('');

  // In-App Confirm Delete Modal State (Elimina qualquer risco de window.confirm bloqueado)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'single-group' | 'batch-groups' | 'variation';
    group?: AglutinatedRuleGroup;
    variationKey?: string;
    count?: number;
    title: string;
    description: string;
  } | null>(null);

  // AI Modal & Sync Feedback
  const [isDuplicateAnalyzerOpen, setIsDuplicateAnalyzerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Helper to test if a category is "Nathy"
  const isNathyCategory = (catId?: string) => {
    if (!catId) return false;
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name.toLowerCase().includes('nathy') : false;
  };

  // 1. Aglutinate mappings into groups by Autopreenchimento Target (and primary non-nathy category)
  const aglutinatedGroups = useMemo(() => {
    const rawEntries = Object.entries(mappings) as [string, DescriptionMap[string]][];
    const targetMap: Record<string, {
      targetDescription: string;
      categoryCounts: Record<string, number>;
      subCategoryCounts: Record<string, number>;
      originalKeys: string[];
    }> = {};

    rawEntries.forEach(([originalKey, mapData]) => {
      if (!mapData || !mapData.targetDescription) return;
      const target = mapData.targetDescription.trim();
      const normTargetKey = target.toLowerCase();

      if (!targetMap[normTargetKey]) {
        targetMap[normTargetKey] = {
          targetDescription: target,
          categoryCounts: {},
          subCategoryCounts: {},
          originalKeys: [],
        };
      }

      targetMap[normTargetKey].originalKeys.push(originalKey);

      if (mapData.categoryId) {
        targetMap[normTargetKey].categoryCounts[mapData.categoryId] =
          (targetMap[normTargetKey].categoryCounts[mapData.categoryId] || 0) + 1;
      }
      if (mapData.subCategoryId) {
        targetMap[normTargetKey].subCategoryCounts[mapData.subCategoryId] =
          (targetMap[normTargetKey].subCategoryCounts[mapData.subCategoryId] || 0) + 1;
      }
    });

    const groups: AglutinatedRuleGroup[] = Object.entries(targetMap).map(([normKey, data]) => {
      // Pick best category: strictly prefer NON-NATHY categories
      let bestCatId: string | undefined = undefined;
      let maxNonNathyCount = -1;
      let bestNathyCatId: string | undefined = undefined;
      let maxNathyCount = -1;

      Object.entries(data.categoryCounts).forEach(([catId, count]) => {
        if (isNathyCategory(catId)) {
          if (count > maxNathyCount) {
            maxNathyCount = count;
            bestNathyCatId = catId;
          }
        } else {
          if (count > maxNonNathyCount) {
            maxNonNathyCount = count;
            bestCatId = catId;
          }
        }
      });

      // Only fallback to Nathy if NO other category exists
      const finalCategoryId = bestCatId || bestNathyCatId;

      // Pick best subcategory corresponding to the chosen category
      let bestSubCatId: string | undefined = undefined;
      let maxSubCount = -1;
      Object.entries(data.subCategoryCounts).forEach(([subId, count]) => {
        const sub = subCategories.find(s => s.id === subId);
        if (finalCategoryId && sub && sub.categoryId !== finalCategoryId) return;
        if (count > maxSubCount) {
          maxSubCount = count;
          bestSubCatId = subId;
        }
      });

      return {
        id: normKey,
        targetDescription: data.targetDescription,
        categoryId: finalCategoryId,
        subCategoryId: bestSubCatId,
        originalKeys: data.originalKeys.sort((a, b) => a.localeCompare(b)),
        totalOriginals: data.originalKeys.length,
      };
    });

    return groups.sort((a, b) => a.targetDescription.localeCompare(b.targetDescription));
  }, [mappings, categories, subCategories]);

  // 2. Filtered Aglutinated Groups
  const filteredGroups = useMemo(() => {
    const search = searchQuery.toLowerCase().trim();

    return aglutinatedGroups.filter(group => {
      const cat = categories.find(c => c.id === group.categoryId);
      const sub = subCategories.find(s => s.id === group.subCategoryId);

      const matchesSearch = !search ||
        group.targetDescription.toLowerCase().includes(search) ||
        (cat && cat.name.toLowerCase().includes(search)) ||
        (sub && sub.name.toLowerCase().includes(search)) ||
        group.originalKeys.some(key => key.toLowerCase().includes(search));

      const matchesCat = !filterCategory || group.categoryId === filterCategory;
      const matchesSub = !filterSubCategory || group.subCategoryId === filterSubCategory;

      return matchesSearch && matchesCat && matchesSub;
    });
  }, [aglutinatedGroups, searchQuery, filterCategory, filterSubCategory, categories, subCategories]);

  // Total original variations covered
  const totalOriginalVariationsCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.totalOriginals, 0);
  }, [filteredGroups]);

  // Detect missing rules from transaction history
  const detectedRulesFromHistory = useMemo(() => {
    const targetMap: Record<string, {
      target: string;
      originalKeys: Set<string>;
      categoryCounts: Record<string, number>;
      subCategoryCounts: Record<string, number>;
    }> = {};

    transactions.forEach(t => {
      const orig = (t.originalDescription || '').trim();
      const target = (t.description || '').trim();
      if (!orig || !target) return;

      const normTarget = target.toLowerCase();
      if (!targetMap[normTarget]) {
        targetMap[normTarget] = {
          target: target,
          originalKeys: new Set(),
          categoryCounts: {},
          subCategoryCounts: {},
        };
      }

      targetMap[normTarget].originalKeys.add(orig);

      if (t.categoryId) {
        targetMap[normTarget].categoryCounts[t.categoryId] =
          (targetMap[normTarget].categoryCounts[t.categoryId] || 0) + 1;
      }
      if (t.subCategoryId) {
        targetMap[normTarget].subCategoryCounts[t.subCategoryId] =
          (targetMap[normTarget].subCategoryCounts[t.subCategoryId] || 0) + 1;
      }
    });

    const result: DescriptionMap = {};

    Object.values(targetMap).forEach(group => {
      let bestCatId: string | undefined = undefined;
      let maxNonNathyCount = -1;
      let bestNathyCatId: string | undefined = undefined;
      let maxNathyCount = -1;

      Object.entries(group.categoryCounts).forEach(([catId, count]) => {
        if (isNathyCategory(catId)) {
          if (count > maxNathyCount) {
            maxNathyCount = count;
            bestNathyCatId = catId;
          }
        } else {
          if (count > maxNonNathyCount) {
            maxNonNathyCount = count;
            bestCatId = catId;
          }
        }
      });

      const finalCategoryId = bestCatId || bestNathyCatId;

      let bestSubCatId: string | undefined = undefined;
      let maxSubCount = -1;
      Object.entries(group.subCategoryCounts).forEach(([subId, count]) => {
        const sub = subCategories.find(s => s.id === subId);
        if (finalCategoryId && sub && sub.categoryId !== finalCategoryId) return;
        if (count > maxSubCount) {
          maxSubCount = count;
          bestSubCatId = subId;
        }
      });

      group.originalKeys.forEach(orig => {
        result[orig] = {
          targetDescription: group.target,
          categoryId: finalCategoryId,
          subCategoryId: bestSubCatId,
        };
      });
    });

    return result;
  }, [transactions, categories, subCategories]);

  const missingRulesCount = useMemo(() => {
    const existingKeys = new Set(Object.keys(mappings).map(k => k.trim().toLowerCase()));
    let count = 0;
    Object.keys(detectedRulesFromHistory).forEach(k => {
      if (!existingKeys.has(k.trim().toLowerCase())) {
        count++;
      }
    });
    return count;
  }, [mappings, detectedRulesFromHistory]);

  // --- Handlers ---

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleToggleExpandAll = () => {
    if (expandedGroupIds.length === filteredGroups.length && filteredGroups.length > 0) {
      setExpandedGroupIds([]);
    } else {
      setExpandedGroupIds(filteredGroups.map(g => g.id));
    }
  };

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(filteredGroups.map(g => g.id));
    }
  };

  // Save new rule from top form
  const handleSaveNewRule = async () => {
    if (!formOriginals.trim() || !formTarget.trim()) return;

    const newMappings = { ...mappings };
    const rawKeys = formOriginals
      .split(/[\n,]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (rawKeys.length === 0) return;

    rawKeys.forEach(k => {
      newMappings[k] = {
        targetDescription: formTarget.trim(),
        categoryId: formCategoryId || undefined,
        subCategoryId: formSubCategoryId || undefined,
        isPattern: formIsPattern,
      };
    });

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);

    setFormOriginals('');
    setFormTarget('');
    setFormCategoryId('');
    setFormSubCategoryId('');
    setFormIsPattern(false);
    setShowAddForm(false);
    setSyncFeedback(`Regra "${formTarget.trim()}" cadastrada com sucesso!`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Quick inline add a new variation to an existing group
  const handleQuickAddVariation = async (group: AglutinatedRuleGroup) => {
    const rawText = (quickAddInputs[group.id] || '').trim();
    if (!rawText) return;

    const newMappings = { ...mappings };
    newMappings[rawText] = {
      targetDescription: group.targetDescription,
      categoryId: group.categoryId || undefined,
      subCategoryId: group.subCategoryId || undefined,
    };

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);

    setQuickAddInputs(prev => ({ ...prev, [group.id]: '' }));
    if (!expandedGroupIds.includes(group.id)) {
      setExpandedGroupIds(prev => [...prev, group.id]);
    }
  };

  // Solicita confirmação in-app para exclusão de variação
  const promptDeleteVariation = (originalKey: string) => {
    setDeleteConfirmation({
      type: 'variation',
      variationKey: originalKey,
      title: 'Remover Variação',
      description: `Deseja remover a redação "${originalKey}" do mapeamento de autopreenchimento?`,
    });
  };

  // Solicita confirmação in-app para exclusão de grupo
  const promptDeleteGroup = (group: AglutinatedRuleGroup) => {
    setDeleteConfirmation({
      type: 'single-group',
      group,
      title: 'Excluir Regra Completa',
      description: `Deseja excluir a regra "${group.targetDescription}" e todas as suas ${group.totalOriginals} variações de extrato cadastradas?`,
    });
  };

  // Solicita confirmação in-app para exclusão em lote
  const promptBatchDeleteGroups = () => {
    if (selectedGroupIds.length === 0) return;
    const totalVariations = selectedGroupIds.reduce((sum, gId) => {
      const g = aglutinatedGroups.find(x => x.id === gId);
      return sum + (g ? g.totalOriginals : 0);
    }, 0);

    setDeleteConfirmation({
      type: 'batch-groups',
      count: selectedGroupIds.length,
      title: 'Excluir Regras Selecionadas',
      description: `Deseja excluir as ${selectedGroupIds.length} regras selecionadas (${totalVariations} variações de texto no total)? Esta ação é imediata.`,
    });
  };

  // EXECUTA A EXCLUSÃO CONFIRMADA (Garante persistência atômica no Firestore e no State)
  const handleExecuteDeleteConfirmation = async () => {
    if (!deleteConfirmation) return;

    const newMappings = { ...mappings };

    if (deleteConfirmation.type === 'variation' && deleteConfirmation.variationKey) {
      delete newMappings[deleteConfirmation.variationKey];
      setMappings(newMappings);
      await StorageService.replaceMappings(newMappings);
      setSyncFeedback(`Variação "${deleteConfirmation.variationKey}" removida com sucesso.`);
    } else if (deleteConfirmation.type === 'single-group' && deleteConfirmation.group) {
      const grp = deleteConfirmation.group;
      grp.originalKeys.forEach(k => {
        delete newMappings[k];
      });
      setMappings(newMappings);
      await StorageService.replaceMappings(newMappings);
      setSelectedGroupIds(prev => prev.filter(id => id !== grp.id));
      setExpandedGroupIds(prev => prev.filter(id => id !== grp.id));
      setSyncFeedback(`Regra "${grp.targetDescription}" e ${grp.totalOriginals} variações excluídas.`);
    } else if (deleteConfirmation.type === 'batch-groups') {
      let totalDeleted = 0;
      selectedGroupIds.forEach(groupId => {
        const grp = aglutinatedGroups.find(g => g.id === groupId);
        if (grp) {
          grp.originalKeys.forEach(k => {
            delete newMappings[k];
            totalDeleted++;
          });
        }
      });
      setMappings(newMappings);
      await StorageService.replaceMappings(newMappings);
      const count = selectedGroupIds.length;
      setSelectedGroupIds([]);
      setSyncFeedback(`${count} regras selecionadas (${totalDeleted} variações) foram excluídas com sucesso.`);
    }

    setDeleteConfirmation(null);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Edit single variation text
  const handleSaveEditedVariation = async () => {
    if (!editingVariation || !editVariationText.trim()) return;
    const { originalKey, group } = editingVariation;

    const newMappings = { ...mappings };
    delete newMappings[originalKey];
    newMappings[editVariationText.trim()] = {
      targetDescription: group.targetDescription,
      categoryId: group.categoryId || undefined,
      subCategoryId: group.subCategoryId || undefined,
      isPattern: editVariationIsPattern,
    };

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    setEditingVariation(null);
    setEditVariationText('');
    setEditVariationIsPattern(false);
  };

  // Edit entire group
  const handleOpenEditGroup = (group: AglutinatedRuleGroup) => {
    setEditingGroup(group);
    setEditGroupTarget(group.targetDescription);
    setEditGroupCategoryId(group.categoryId || '');
    setEditGroupSubCategoryId(group.subCategoryId || '');
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup || !editGroupTarget.trim()) return;

    const newMappings = { ...mappings };
    editingGroup.originalKeys.forEach(key => {
      newMappings[key] = {
        targetDescription: editGroupTarget.trim(),
        categoryId: editGroupCategoryId || undefined,
        subCategoryId: editGroupSubCategoryId || undefined,
      };
    });

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    setEditingGroup(null);
  };

  // Batch update categories/target of selected groups
  const handleBatchUpdateGroups = async () => {
    if (selectedGroupIds.length === 0) return;
    if (!batchCategory && !batchTarget && !batchSubCategory) return;

    const newMappings = { ...mappings };
    selectedGroupIds.forEach(groupId => {
      const grp = aglutinatedGroups.find(g => g.id === groupId);
      if (grp) {
        grp.originalKeys.forEach(key => {
          if (newMappings[key]) {
            newMappings[key] = {
              targetDescription: batchTarget ? batchTarget.trim() : newMappings[key].targetDescription,
              categoryId: batchCategory || newMappings[key].categoryId,
              subCategoryId: batchSubCategory || newMappings[key].subCategoryId,
            };
          }
        });
      }
    });

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    setIsBatchEditOpen(false);
    setSelectedGroupIds([]);
    setBatchTarget('');
    setBatchCategory('');
    setBatchSubCategory('');
  };

  // Smart Sync from transaction history
  const handleSyncFromHistory = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const combined: DescriptionMap = { ...detectedRulesFromHistory, ...mappings };
      setMappings(combined);
      await StorageService.replaceMappings(combined);
      setSyncFeedback(`Sincronização concluída! ${Object.keys(combined).length} regras e variações consolidadas com sucesso.`);
    } catch (e: any) {
      console.error(e);
      setSyncFeedback(`Erro ao sincronizar: ${e?.message || 'Falha desconhecida'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
      {/* 1. Header Card with Summary & Main Actions */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Replace size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <span>Mapeamento & Autopreenchimento</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                  {aglutinatedGroups.length} regras ({Object.keys(mappings).length} variações)
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Aglutine textos brutos de extratos e faturas em descrições amigáveis com categoria e subcategoria automáticas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {missingRulesCount > 0 && (
              <button
                type="button"
                onClick={handleSyncFromHistory}
                disabled={isSyncing}
                title="Detecta e aglutina regras dos lançamentos existentes, priorizando categorias oficiais"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Sincronizar do Histórico (+{missingRulesCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDuplicateAnalyzerOpen(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Analisar com IA</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={15} />
              <span>{showAddForm ? 'Fechar Cadastro' : 'Nova Regra'}</span>
            </button>
          </div>
        </div>

        {/* Sync Feedback Alert */}
        {syncFeedback && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Expandable "Nova Regra" Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                <PlusCircle size={15} className="text-blue-600" />
                <span>Cadastrar Nova Regra de Mapeamento</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xs"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                  Textos Originais do Extrato (Variações)
                </label>
                <textarea
                  rows={3}
                  value={formOriginals}
                  onChange={(e) => setFormOriginals(e.target.value)}
                  placeholder="Ex: UBER *TRIP, UBER TRIP 123, PAG*UBER (separe por vírgula ou quebra de linha)"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-zinc-50 font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50/50 dark:bg-zinc-800/50"
                />
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                    Descrição Limpa de Autopreenchimento
                  </label>
                  <input
                    type="text"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="Ex: Uber"
                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50/50 dark:bg-zinc-800/50 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                      Categoria Automática
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => {
                        setFormCategoryId(e.target.value);
                        setFormSubCategoryId('');
                      }}
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50/50 dark:bg-zinc-800/50"
                    >
                      <option value="">Selecione...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                      Subcategoria
                    </label>
                    <select
                      value={formSubCategoryId}
                      onChange={(e) => setFormSubCategoryId(e.target.value)}
                      disabled={!formCategoryId}
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50/50 dark:bg-zinc-800/50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/20"
                    >
                      <option value="">Selecione...</option>
                      {subCategories
                        .filter(s => s.categoryId === formCategoryId)
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="formIsPattern"
                    checked={formIsPattern}
                    onChange={(e) => setFormIsPattern(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                  />
                  <label htmlFor="formIsPattern" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium flex flex-col select-none">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Mapeamento por padrão (Curinga/Contém)</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      Permite usar asteriscos (Ex: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-[9px]">*UBER*</code> ou <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-[9px]">IFOOD*</code>) para correspondência flexível.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewRule}
                disabled={!formOriginals.trim() || !formTarget.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save size={14} /> Salvar Regra
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Bar & Quick Stats */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por descrição, texto original do extrato ou categoria..."
              className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setFilterSubCategory('');
              }}
              className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {filterCategory && (
              <select
                value={filterSubCategory}
                onChange={(e) => setFilterSubCategory(e.target.value)}
                className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">Todas as Subcategorias</option>
                {subCategories
                  .filter(s => s.categoryId === filterCategory)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            )}

            {(filterCategory || filterSubCategory || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterCategory('');
                  setFilterSubCategory('');
                }}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl border border-zinc-200 dark:border-zinc-700"
                title="Limpar filtros"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Action Header: Selection & Expand/Collapse All */}
        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {filteredGroups.length} regras encontradas
            </span>
            <span>·</span>
            <span>{totalOriginalVariationsCount} redações de extrato cobertas</span>
          </div>

          <button
            type="button"
            onClick={handleToggleExpandAll}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {expandedGroupIds.length === filteredGroups.length && filteredGroups.length > 0 ? (
              <>
                <ChevronDown size={14} /> Recolher Todas as Variações
              </>
            ) : (
              <>
                <ChevronRight size={14} /> Expandir Todas as Variações
              </>
            )}
          </button>
        </div>

        {/* Batch Action Toolbar when items are selected */}
        {selectedGroupIds.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl flex items-center justify-between border border-blue-200 dark:border-blue-900/60 animate-in fade-in">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <CheckSquare size={16} className="text-blue-600" />
              <span>{selectedGroupIds.length} regra(s) selecionada(s)</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatchTarget('');
                  setBatchCategory('');
                  setBatchSubCategory('');
                  setIsBatchEditOpen(true);
                }}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 size={13} /> Alterar em Lote
              </button>
              <button
                type="button"
                onClick={promptBatchDeleteGroups}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 size={13} /> Excluir Selecionadas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Aglutinated Mapping Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Table Column Headers */}
        <div className="bg-zinc-50 dark:bg-zinc-800/70 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={handleSelectAllGroups}
              className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              title="Selecionar todos"
            >
              {selectedGroupIds.length > 0 && selectedGroupIds.length === filteredGroups.length ? (
                <CheckSquare size={16} className="text-blue-600" />
              ) : selectedGroupIds.length > 0 ? (
                <MinusSquare size={16} className="text-blue-600" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span className="truncate">Descrição de Autopreenchimento</span>
          </div>

          <div className="hidden md:flex items-center gap-8 justify-end w-2/5 shrink-0 text-right pr-2">
            <span className="w-28 text-left">Categoria</span>
            <span className="w-28 text-left">Subcategoria</span>
            <span className="w-24 text-center">Variações</span>
            <span className="w-16 text-center">Ações</span>
          </div>
        </div>

        {/* Rows List */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {filteredGroups.map(group => {
            const isExpanded = expandedGroupIds.includes(group.id);
            const isSelected = selectedGroupIds.includes(group.id);
            const cat = categories.find(c => c.id === group.categoryId);
            const sub = subCategories.find(s => s.id === group.subCategoryId);
            const quickInputVal = quickAddInputs[group.id] || '';

            return (
              <div
                key={group.id}
                className={`transition-colors ${
                  isSelected
                    ? 'bg-blue-50/40 dark:bg-blue-950/20'
                    : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                }`}
              >
                {/* Main Row Bar */}
                <div
                  onClick={() => toggleExpandGroup(group.id)}
                  className="px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  {/* Left: Checkbox + Expand Indicator + Autopreenchimento Description */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectGroup(group.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                    >
                      {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>

                    <div className="p-0.5 text-zinc-400 hover:text-blue-600 transition-transform duration-200 shrink-0">
                      {isExpanded ? (
                        <ChevronDown size={17} className="text-blue-600" />
                      ) : (
                        <ChevronRight size={17} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">
                          {group.targetDescription}
                        </span>

                        {/* Mobile visible badges */}
                        <span className="md:hidden text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {group.totalOriginals} {group.totalOriginals === 1 ? 'variação' : 'variações'}
                        </span>
                      </div>

                      {/* Subtitle on mobile */}
                      <div className="md:hidden flex items-center gap-1.5 pt-1 text-[11px]">
                        {cat ? (
                          <span
                            className="font-bold text-xs"
                            style={{ color: cat.color || '#3b82f6' }}
                          >
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Sem categoria</span>
                        )}
                        {sub && (
                          <span className="text-zinc-400">· {sub.name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Desktop Columns (Category, Subcategory, Count, Actions) */}
                  <div className="hidden md:flex items-center gap-8 justify-end w-2/5 shrink-0 text-right pr-2">
                    {/* Categoria */}
                    <div className="w-28 text-left truncate">
                      {cat ? (
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border"
                          style={{
                            backgroundColor: cat.color ? `${cat.color}15` : undefined,
                            borderColor: cat.color ? `${cat.color}40` : undefined,
                            color: cat.color || '#2563eb',
                          }}
                        >
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Sem Categoria</span>
                      )}
                    </div>

                    {/* Subcategoria */}
                    <div className="w-28 text-left truncate">
                      {sub ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
                          {sub.name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">-</span>
                      )}
                    </div>

                    {/* Variações Vinculadas */}
                    <div className="w-24 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                        <Layers size={12} />
                        <span>{group.totalOriginals}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="w-16 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditGroup(group)}
                        className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Editar regra de autopreenchimento e categoria"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeleteGroup(group)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Excluir regra e todas as suas variações"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Panel: All Original Raw Texts Transformed by this Rule */}
                {isExpanded && (
                  <div className="px-6 pb-4 pt-1 bg-zinc-50/70 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 animate-in slide-in-from-top-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                          Descrições Originais Mapeadas ({group.totalOriginals}):
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          (Qualquer uma destas redações no extrato será convertida para "{group.targetDescription}")
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEditGroup(group)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Editar Categoria / Destino do Grupo</span>
                      </button>
                    </div>

                    {/* Chips / Cards of Original Variations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.originalKeys.map(origKey => {
                        const isPat = !!(mappings[origKey]?.isPattern || origKey.includes('*'));
                        return (
                          <div
                            key={origKey}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs group/item"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200 font-semibold truncate" title={origKey}>
                                  {origKey}
                                </p>
                                {isPat && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50 shrink-0 select-none">
                                    Padrão
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/item:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVariation({ originalKey: origKey, group });
                                  setEditVariationText(origKey);
                                  setEditVariationIsPattern(isPat);
                                }}
                                className="p-1 text-zinc-400 hover:text-blue-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                title="Editar texto original"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => promptDeleteVariation(origKey)}
                                className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                title="Remover esta variação do mapeamento"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Inline Quick Add Variation Input */}
                    <div className="pt-2 flex items-center gap-2">
                      <div className="relative flex-1 max-w-md">
                        <input
                          type="text"
                          value={quickInputVal}
                          onChange={(e) => setQuickAddInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddVariation(group);
                            }
                          }}
                          placeholder={`Adicionar outra redação de extrato para "${group.targetDescription}"...`}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAddVariation(group)}
                        disabled={!quickInputVal.trim()}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Variação</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredGroups.length === 0 && (
            <div className="text-center py-16 text-zinc-400 dark:text-zinc-500 space-y-2">
              <AlertCircle size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm font-semibold">Nenhuma regra de mapeamento encontrada.</p>
              <p className="text-xs text-zinc-400">
                {searchQuery || filterCategory
                  ? 'Tente ajustar os filtros ou termo de busca.'
                  : 'Cadastre uma nova regra ou sincronize do seu histórico de lançamentos.'}
              </p>
              {missingRulesCount > 0 && (
                <button
                  type="button"
                  onClick={handleSyncFromHistory}
                  className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Sincronizar {missingRulesCount} regras dos seus lançamentos</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Group Modal (Autopreenchimento & Category for all variations) */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <Edit3 size={18} className="text-blue-600" />
                <span>Editar Regra Cadastrada</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Esta alteração atualizará a descrição de autopreenchimento e as categorias para todas as{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">{editingGroup.totalOriginals} variações</strong>{' '}
              vinculadas a esta regra.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                  Descrição de Autopreenchimento (Nome Limpo)
                </label>
                <input
                  type="text"
                  value={editGroupTarget}
                  onChange={(e) => setEditGroupTarget(e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={editGroupCategoryId}
                  onChange={(e) => {
                    setEditGroupCategoryId(e.target.value);
                    setEditGroupSubCategoryId('');
                  }}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 cursor-pointer"
                >
                  <option value="">Selecione a categoria...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                  Subcategoria
                </label>
                <select
                  value={editGroupSubCategoryId}
                  onChange={(e) => setEditGroupSubCategoryId(e.target.value)}
                  disabled={!editGroupCategoryId}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 cursor-pointer"
                >
                  <option value="">Selecione a subcategoria...</option>
                  {subCategories
                    .filter(s => s.categoryId === editGroupCategoryId)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="flex-1 py-2 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveGroupEdit}
                disabled={!editGroupTarget.trim()}
                className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} /> Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Individual Variation Modal */}
      {editingVariation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
              Editar Descrição Original
            </h3>

            <p className="text-xs text-zinc-500">
              Altere o texto bruto capturado do extrato/fatura para a regra{' '}
              <strong>"{editingVariation.group.targetDescription}"</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Texto do Extrato
                </label>
                <input
                  type="text"
                  value={editVariationText}
                  onChange={(e) => setEditVariationText(e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editVariationIsPattern"
                  checked={editVariationIsPattern}
                  onChange={(e) => setEditVariationIsPattern(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                />
                <label htmlFor="editVariationIsPattern" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium flex flex-col select-none">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Mapeamento por padrão (Curinga/Contém)</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                    Ativa a correspondência flexível com asteriscos.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingVariation(null)}
                className="flex-1 py-2 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditedVariation}
                disabled={!editVariationText.trim()}
                className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Edit Modal */}
      {isBatchEditOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
              Editar {selectedGroupIds.length} Regras Selecionadas
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Novo Autopreenchimento (Opcional)
                </label>
                <input
                  type="text"
                  value={batchTarget}
                  onChange={(e) => setBatchTarget(e.target.value)}
                  placeholder="Mantenha vazio para preservar"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Nova Categoria
                </label>
                <select
                  value={batchCategory}
                  onChange={(e) => {
                    setBatchCategory(e.target.value);
                    setBatchSubCategory('');
                  }}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Nova Subcategoria
                </label>
                <select
                  value={batchSubCategory}
                  onChange={(e) => setBatchSubCategory(e.target.value)}
                  disabled={!batchCategory}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {subCategories.filter(s => s.categoryId === batchCategory).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchEditOpen(false)}
                className="flex-1 py-2 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchUpdateGroups}
                className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (100% Seguro, sem window.confirm) */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
                  {deleteConfirmation.title}
                </h3>
                <p className="text-xs text-zinc-500">Confirmação de exclusão</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {deleteConfirmation.description}
            </p>

            <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 py-2 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteConfirmation}
                className="flex-1 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Duplicate Analyzer Modal */}
      {isDuplicateAnalyzerOpen && (
        <DuplicateRulesAnalyzerModal
          isOpen={isDuplicateAnalyzerOpen}
          onClose={() => setIsDuplicateAnalyzerOpen(false)}
          mappings={mappings}
          categories={categories}
          subCategories={subCategories}
          onSaveMappings={async (updatedMappings) => {
            setMappings(updatedMappings);
            await StorageService.replaceMappings(updatedMappings);
          }}
        />
      )}
    </div>
  );
};
