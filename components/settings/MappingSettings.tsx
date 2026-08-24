import React, { useState, useMemo } from 'react';
import { Category, SubCategory, DescriptionMap, Transaction } from '../../types';
import { StorageService } from '../../services/storageService';
import { DuplicateRulesAnalyzerModal } from '../DuplicateRulesAnalyzerModal';
import {
  Replace, Sparkles, Search, X, CheckSquare, Square, MinusSquare, Edit3, Trash2,
  ChevronDown, ChevronRight, Pencil, Save, List, Layers, RefreshCw, ArrowRight, Check, AlertCircle
} from 'lucide-react';

interface MappingSettingsProps {
  categories: Category[];
  subCategories: SubCategory[];
  transactions: Transaction[];
  mappings: DescriptionMap;
  setMappings: (m: DescriptionMap) => void;
}

export const MappingSettings: React.FC<MappingSettingsProps> = ({
  categories,
  subCategories,
  transactions,
  mappings,
  setMappings,
}) => {
  // View Mode: 'list' (all rules individually) vs 'grouped' (grouped by final description)
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');

  // Form State
  const [mapOriginal, setMapOriginal] = useState('');
  const [mapTarget, setMapTarget] = useState('');
  const [mapCategoryId, setMapCategoryId] = useState('');
  const [mapSubCategoryId, setMapSubCategoryId] = useState('');
  const [editingMappingKey, setEditingMappingKey] = useState<string | null>(null);

  // Filter & Search
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilterCategory, setMappingFilterCategory] = useState('');
  const [mappingFilterSubCategory, setMappingFilterSubCategory] = useState('');
  const [selectedMappingKeys, setSelectedMappingKeys] = useState<string[]>([]);
  const [expandedMappingGroups, setExpandedMappingGroups] = useState<string[]>([]);

  // Batch edit & modals
  const [batchMapTarget, setBatchMapTarget] = useState('');
  const [batchMapCategory, setBatchMapCategory] = useState('');
  const [batchMapSubCategory, setBatchMapSubCategory] = useState('');
  const [isBatchMapEditOpen, setIsBatchMapEditOpen] = useState(false);
  const [isDuplicateAnalyzerOpen, setIsDuplicateAnalyzerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Detect rules from transactions history that can be recovered or synced
  const detectedRulesFromHistory = useMemo(() => {
    const map: DescriptionMap = {};
    transactions.forEach(t => {
      const orig = (t.originalDescription || '').trim();
      const target = (t.description || '').trim();
      if (orig && target) {
        if (!map[orig] || (!map[orig].categoryId && t.categoryId)) {
          map[orig] = {
            targetDescription: target,
            categoryId: t.categoryId || undefined,
            subCategoryId: t.subCategoryId || undefined,
          };
        }
      }
    });
    return map;
  }, [transactions]);

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

  // Handlers
  const handleSaveMapping = async () => {
    if (!mapOriginal.trim() || !mapTarget.trim()) return;

    const newMappings = { ...mappings };

    if (editingMappingKey && editingMappingKey !== mapOriginal.trim()) {
      delete newMappings[editingMappingKey];
    }

    newMappings[mapOriginal.trim()] = {
      targetDescription: mapTarget.trim(),
      categoryId: mapCategoryId || undefined,
      subCategoryId: mapSubCategoryId || undefined,
    };

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);

    // Reset form
    setMapOriginal('');
    setMapTarget('');
    setMapCategoryId('');
    setMapSubCategoryId('');
    setEditingMappingKey(null);
  };

  const handleEditMapping = (key: string) => {
    const m = mappings[key];
    if (!m) return;
    setMapOriginal(key);
    setMapTarget(m.targetDescription);
    setMapCategoryId(m.categoryId || '');
    setMapSubCategoryId(m.subCategoryId || '');
    setEditingMappingKey(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMapping = async (key: string) => {
    const newMappings = { ...mappings };
    delete newMappings[key];
    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    if (editingMappingKey === key) {
      setMapOriginal('');
      setMapTarget('');
      setMapCategoryId('');
      setMapSubCategoryId('');
      setEditingMappingKey(null);
    }
    setSelectedMappingKeys(prev => prev.filter(k => k !== key));
  };

  const toggleMappingSelection = (key: string) => {
    setSelectedMappingKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filtered Mappings
  const filteredMappings = useMemo(() => {
    return (Object.entries(mappings) as [string, DescriptionMap[string]][]).filter(([orig, map]) => {
      if (!map) return false;
      const searchLower = mappingSearch.toLowerCase().trim();
      const cat = categories.find(c => c.id === map.categoryId);
      const sub = subCategories.find(s => s.id === map.subCategoryId);

      const matchesSearch = !searchLower ||
        orig.toLowerCase().includes(searchLower) ||
        (map.targetDescription && map.targetDescription.toLowerCase().includes(searchLower)) ||
        (cat && cat.name.toLowerCase().includes(searchLower)) ||
        (sub && sub.name.toLowerCase().includes(searchLower));

      const matchesCategory = !mappingFilterCategory || map.categoryId === mappingFilterCategory;
      const matchesSubCategory = !mappingFilterSubCategory || map.subCategoryId === mappingFilterSubCategory;

      return matchesSearch && matchesCategory && matchesSubCategory;
    }).sort((a, b) => a[0].localeCompare(b[0]));
  }, [mappings, mappingSearch, mappingFilterCategory, mappingFilterSubCategory, categories, subCategories]);

  // Distinct targets count
  const distinctTargetsCount = useMemo(() => {
    const targets = new Set(filteredMappings.map(([_, m]) => m.targetDescription?.trim().toLowerCase()).filter(Boolean));
    return targets.size;
  }, [filteredMappings]);

  const handleSelectAllMappings = () => {
    if (selectedMappingKeys.length === filteredMappings.length) {
      setSelectedMappingKeys([]);
    } else {
      setSelectedMappingKeys(filteredMappings.map(([key]) => key));
    }
  };

  const handleBatchDeleteMapping = async () => {
    if (selectedMappingKeys.length === 0) return;
    if (!confirm(`Excluir ${selectedMappingKeys.length} regra(s) selecionada(s)?`)) return;

    const newMappings = { ...mappings };
    selectedMappingKeys.forEach(key => delete newMappings[key]);

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    setSelectedMappingKeys([]);
  };

  const handleBatchUpdateMapping = async () => {
    if (selectedMappingKeys.length === 0) return;
    if (!batchMapCategory && !batchMapTarget && !batchMapSubCategory) return;

    const newMappings = { ...mappings };
    selectedMappingKeys.forEach(key => {
      if (newMappings[key]) {
        newMappings[key] = {
          ...newMappings[key],
          targetDescription: batchMapTarget ? batchMapTarget.trim() : newMappings[key].targetDescription,
          categoryId: batchMapCategory || newMappings[key].categoryId,
          subCategoryId: batchMapSubCategory || newMappings[key].subCategoryId,
        };
      }
    });

    setMappings(newMappings);
    await StorageService.replaceMappings(newMappings);
    setIsBatchMapEditOpen(false);
    setSelectedMappingKeys([]);
    setBatchMapTarget('');
    setBatchMapCategory('');
    setBatchMapSubCategory('');
  };

  // Sync / Rebuild rules from transaction history
  const handleSyncFromTransactions = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const combined: DescriptionMap = { ...detectedRulesFromHistory, ...mappings };
      setMappings(combined);
      await StorageService.replaceMappings(combined);
      setSyncFeedback(`Sincronização concluída com sucesso! Total de ${Object.keys(combined).length} regras mapeadas.`);
    } catch (e: any) {
      console.error(e);
      setSyncFeedback(`Erro ao sincronizar: ${e?.message || 'Falha desconhecida'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Toggle expand/collapse all groups
  const handleToggleExpandAllGroups = (allGroupKeys: string[]) => {
    if (expandedMappingGroups.length === allGroupKeys.length) {
      setExpandedMappingGroups([]);
    } else {
      setExpandedMappingGroups(allGroupKeys);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
      {/* 1. Form Card */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 p-5 md:p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Replace size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Regras de Mapeamento Automático
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Padronize nomes brutos de extrato e faturas com categorização automática.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {missingRulesCount > 0 && (
              <button
                onClick={handleSyncFromTransactions}
                disabled={isSyncing}
                title="Sincroniza e recupera regras a partir dos seus lançamentos existentes"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Sincronizar do Histórico (+{missingRulesCount})</span>
              </button>
            )}
            <button
              onClick={() => setIsDuplicateAnalyzerOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 shrink-0"
            >
              <Sparkles size={15} />
              <span>Analisar com IA</span>
            </button>
          </div>
        </div>

        {/* Sync Feedback Message */}
        {syncFeedback && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
                Contém no Original (Extrato/Fatura)
              </label>
              <input
                type="text"
                value={mapOriginal}
                onChange={(e) => {
                  setMapOriginal(e.target.value);
                  const matchingTransactions = transactions.filter(t =>
                    t.description.toLowerCase().includes(e.target.value.toLowerCase()) ||
                    (t.originalDescription && t.originalDescription.toLowerCase().includes(e.target.value.toLowerCase()))
                  );
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
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900 font-mono"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Texto bruto da descrição original.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
                Renomear Para (Descrição Final)
              </label>
              <input
                type="text"
                value={mapTarget}
                onChange={(e) => {
                  setMapTarget(e.target.value);
                  const existingMapping = (Object.values(mappings) as any[]).find(m =>
                    m.targetDescription && m.targetDescription.trim().toLowerCase() === e.target.value.trim().toLowerCase()
                  );
                  if (existingMapping) {
                    if (!mapCategoryId && existingMapping.categoryId) setMapCategoryId(existingMapping.categoryId);
                    if (!mapSubCategoryId && existingMapping.subCategoryId) setMapSubCategoryId(existingMapping.subCategoryId);
                  }
                }}
                placeholder="Ex: Uber Viagem"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Nome amigável exibido no painel.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
                Atribuir Categoria
              </label>
              <select
                value={mapCategoryId}
                onChange={(e) => { setMapCategoryId(e.target.value); setMapSubCategoryId(''); }}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900"
              >
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
                Atribuir Subcategoria
              </label>
              <select
                value={mapSubCategoryId}
                onChange={(e) => setMapSubCategoryId(e.target.value)}
                disabled={!mapCategoryId}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
              >
                <option value="">Selecione...</option>
                {subCategories.filter(s => s.categoryId === mapCategoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {editingMappingKey && (
              <button
                onClick={() => {
                  setMapOriginal('');
                  setMapTarget('');
                  setMapCategoryId('');
                  setMapSubCategoryId('');
                  setEditingMappingKey(null);
                }}
                className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-bold"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSaveMapping}
              disabled={!mapOriginal || !mapTarget}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-colors"
            >
              {editingMappingKey ? 'Atualizar Regra' : 'Adicionar Regra'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. List & Filter Section */}
      <div className="space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center border-b border-zinc-200/80 dark:border-zinc-700/80 pb-3">
          <div>
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>Regras de Mapeamento</span>
              <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                {filteredMappings.length} regras ({distinctTargetsCount} destinos)
              </span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Exibindo regras configuradas para conversão automática em extratos e faturas.
            </p>
          </div>

          {/* View Mode Segmented Control */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
            <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <List size={14} />
                <span>Lista Completa ({filteredMappings.length})</span>
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Layers size={14} />
                <span>Agrupado por Destino ({distinctTargetsCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={mappingSearch}
              onChange={(e) => setMappingSearch(e.target.value)}
              placeholder="Buscar por original, destino ou categoria..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="w-full sm:w-auto flex-1 sm:flex-none">
            <select
              value={mappingFilterCategory}
              onChange={(e) => {
                setMappingFilterCategory(e.target.value);
                setMappingFilterSubCategory('');
              }}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Todas Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="w-full sm:w-auto flex-1 sm:flex-none">
            <select
              value={mappingFilterSubCategory}
              onChange={(e) => setMappingFilterSubCategory(e.target.value)}
              disabled={!mappingFilterCategory}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Todas Subcategorias</option>
              {mappingFilterCategory && subCategories.filter(s => s.categoryId === mappingFilterCategory).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {(mappingSearch || mappingFilterCategory || mappingFilterSubCategory) && (
            <button
              onClick={() => {
                setMappingSearch('');
                setMappingFilterCategory('');
                setMappingFilterSubCategory('');
              }}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors"
              title="Limpar filtros"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Batch Action Toolbar */}
        {selectedMappingKeys.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1 border border-blue-200 dark:border-blue-900/60">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200 ml-1">
              {selectedMappingKeys.length} regra(s) selecionada(s)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBatchMapTarget('');
                  setBatchMapCategory('');
                  setBatchMapSubCategory('');
                  setIsBatchMapEditOpen(true);
                }}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Edit3 size={13} /> Alterar em Lote
              </button>
              <button
                onClick={handleBatchDeleteMapping}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} /> Excluir Selecionadas
              </button>
            </div>
          </div>
        )}

        {/* Select All Bar */}
        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl flex items-center justify-between border border-zinc-200/80 dark:border-zinc-700/60">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSelectAllMappings}
              className="p-0.5 rounded text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 transition-colors"
            >
              {selectedMappingKeys.length > 0 && selectedMappingKeys.length === filteredMappings.length ? (
                <CheckSquare size={16} className="text-blue-600" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Selecionar Todos ({filteredMappings.length})
            </span>
          </div>

          {missingRulesCount > 0 && (
            <button
              onClick={handleSyncFromTransactions}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} />
              <span>Sincronizar {missingRulesCount} regras do histórico</span>
            </button>
          )}
        </div>

        {/* VIEW 1: FULL LIST VIEW (Premissa / Regra por Regra) */}
        {viewMode === 'list' && (
          <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
            {filteredMappings.map(([originalText, map]) => {
              const isSelected = selectedMappingKeys.includes(originalText);
              const cat = categories.find(c => c.id === map.categoryId);
              const sub = subCategories.find(s => s.id === map.subCategoryId);

              return (
                <div
                  key={originalText}
                  className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 hover:shadow-xs transition-all flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                    isSelected
                      ? 'border-blue-400 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-zinc-200/80 dark:border-zinc-800/80'
                  }`}
                >
                  {/* Left: Checkbox + Rule Definition */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => toggleMappingSelection(originalText)}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"
                    >
                      {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Flow: Original -> Target */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-semibold truncate max-w-[280px]"
                          title={originalText}
                        >
                          {originalText}
                        </span>

                        <ArrowRight size={13} className="text-zinc-400 shrink-0" />

                        <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-50 truncate max-w-[200px]">
                          {map.targetDescription}
                        </span>
                      </div>

                      {/* Badges: Category & Subcategory */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                        {cat ? (
                          <span
                            className="px-2 py-0.5 rounded-md border text-zinc-700 dark:text-zinc-300"
                            style={{
                              backgroundColor: cat.color ? `${cat.color}15` : undefined,
                              borderColor: cat.color ? `${cat.color}40` : undefined,
                            }}
                          >
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Sem categoria</span>
                        )}

                        {sub && (
                          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                            {sub.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      onClick={() => handleEditMapping(originalText)}
                      className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                      title="Editar regra"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteMapping(originalText)}
                      className="p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Excluir regra"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMappings.length === 0 && (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 space-y-2">
                <AlertCircle size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" />
                <p className="text-xs font-semibold">Nenhuma regra de mapeamento encontrada.</p>
                {missingRulesCount > 0 && (
                  <button
                    onClick={handleSyncFromTransactions}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    Clique aqui para sincronizar {missingRulesCount} regras dos seus lançamentos
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: GROUPED VIEW (Agrupado por Descrição Final) */}
        {viewMode === 'grouped' && (
          <div className="space-y-3">
            {/* Expand/Collapse All Button */}
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
                const map = val as { targetDescription: string; categoryId?: string; subCategoryId?: string };
                const targetKey = (map.targetDescription || 'Sem Nome').trim().toLowerCase();

                if (!grouped[targetKey]) {
                  grouped[targetKey] = {
                    targetDescription: map.targetDescription?.trim() || 'Sem Nome',
                    totalOriginals: 0,
                    categories: {},
                  };
                }

                grouped[targetKey].totalOriginals += 1;

                const catKey = `${map.categoryId || ''}|${map.subCategoryId || ''}`;
                if (!grouped[targetKey].categories[catKey]) {
                  grouped[targetKey].categories[catKey] = {
                    categoryId: map.categoryId,
                    subCategoryId: map.subCategoryId,
                    originals: [],
                  };
                }

                grouped[targetKey].categories[catKey].originals.push(key);
              });

              const sortedTargets = Object.values(grouped).sort((a, b) => a.targetDescription.localeCompare(b.targetDescription));
              const allGroupKeys = sortedTargets.map(g => g.targetDescription.trim().toLowerCase());
              const isAllExpanded = expandedMappingGroups.length === allGroupKeys.length && allGroupKeys.length > 0;

              return (
                <div className="space-y-2.5">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleToggleExpandAllGroups(allGroupKeys)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {isAllExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{isAllExpanded ? 'Recolher Todos os Grupos' : 'Expandir Todos os Grupos'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                    {sortedTargets.map((group) => {
                      const groupKey = group.targetDescription.trim().toLowerCase();
                      const isExpanded = expandedMappingGroups.includes(groupKey);
                      const toggleExpand = () => {
                        setExpandedMappingGroups(prev =>
                          prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]
                        );
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
                        <div
                          key={groupKey}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-3 hover:shadow-xs transition-all space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                onClick={handleSelectGroup}
                                className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"
                              >
                                {isAllSelected ? (
                                  <CheckSquare size={16} className="text-blue-600" />
                                ) : isSomeSelected ? (
                                  <MinusSquare size={16} className="text-blue-600" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                              <div className="flex-1 cursor-pointer select-none" onClick={toggleExpand}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isExpanded ? <ChevronDown size={15} className="text-zinc-400" /> : <ChevronRight size={15} className="text-zinc-400" />}
                                  <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">{group.targetDescription}</span>
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">
                                    {group.totalOriginals} {group.totalOriginals === 1 ? 'redação' : 'redações'}
                                  </span>
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
                              className="ml-2 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors flex items-center gap-1 shrink-0 shadow-xs"
                            >
                              <Edit3 size={12} /> Editar Grupo
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="pl-7 pt-1 space-y-2.5 animate-in slide-in-from-top-1 fade-in">
                              {Object.values(group.categories).map((catGroup, idx) => {
                                const cat = categories.find(c => c.id === catGroup.categoryId);
                                const sub = subCategories.find(s => s.id === catGroup.subCategoryId);

                                return (
                                  <div key={idx} className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40">
                                        {cat?.name || 'Sem Categoria'}
                                      </span>
                                      {sub && (
                                        <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/40">
                                          {sub.name}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {catGroup.originals.map(org => {
                                        const isSelected = selectedMappingKeys.includes(org);
                                        return (
                                          <div
                                            key={org}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-colors ${
                                              isSelected
                                                ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                                                : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700/60'
                                            }`}
                                          >
                                            <button onClick={() => toggleMappingSelection(org)} className="text-zinc-500 hover:text-zinc-800">
                                              {isSelected ? <CheckSquare size={12} className="text-blue-600" /> : <Square size={12} />}
                                            </button>
                                            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[160px]" title={org}>
                                              {org}
                                            </span>
                                            <div className="flex items-center ml-1 border-l pl-1.5 border-zinc-200 dark:border-zinc-700">
                                              <button onClick={() => handleEditMapping(org)} className="p-0.5 text-zinc-400 hover:text-blue-600" title="Editar">
                                                <Pencil size={11} />
                                              </button>
                                              <button onClick={() => handleDeleteMapping(org)} className="p-0.5 text-zinc-400 hover:text-rose-600 ml-0.5" title="Excluir">
                                                <Trash2 size={11} />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {sortedTargets.length === 0 && (
                      <div className="text-center py-10 text-zinc-400 italic text-xs">Nenhum grupo de mapeamento encontrado.</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Batch Edit Modal */}
      {isBatchMapEditOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
              Editar {selectedMappingKeys.length} Regra(s)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Novo Nome Amigável (Opcional)
                </label>
                <input
                  type="text"
                  value={batchMapTarget}
                  onChange={(e) => setBatchMapTarget(e.target.value)}
                  placeholder="Mantenha vazio para preservar"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Nova Categoria
                </label>
                <select
                  value={batchMapCategory}
                  onChange={(e) => { setBatchMapCategory(e.target.value); setBatchMapSubCategory(''); }}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900"
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
                  value={batchMapSubCategory}
                  onChange={(e) => setBatchMapSubCategory(e.target.value)}
                  disabled={!batchMapCategory}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                >
                  <option value="">Selecione...</option>
                  {subCategories.filter(s => s.categoryId === batchMapCategory).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsBatchMapEditOpen(false)}
                className="flex-1 py-2 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchUpdateMapping}
                className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Modal */}
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
