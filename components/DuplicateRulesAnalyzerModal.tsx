import React, { useState, useMemo } from 'react';
import { DescriptionMap, Category, SubCategory } from '../types';
import { Sparkles, CheckCircle2, Layers, AlertTriangle, ArrowRight, Trash2, CheckSquare, Square, X, RefreshCw, Filter, Sliders, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface DuplicateRulesAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: DescriptionMap;
  categories: Category[];
  subCategories: SubCategory[];
  onSaveMappings: (updatedMappings: DescriptionMap) => Promise<void>;
}

export interface RuleItem {
  key: string;
  targetDescription: string;
  categoryId?: string;
  subCategoryId?: string;
}

export interface RuleCluster {
  id: string;
  title: string;
  reason: string;
  rules: RuleItem[];
  selectedMasterKey: string;
  customTargetDescription: string;
  customCategoryId: string;
  customSubCategoryId: string;
  deduplicateKeys: boolean;
}

// Helpers for text normalization & similarity
const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const getSimilarity = (str1: string, str2: string, threshold = 0.75) => {
  const n1 = normalizeText(str1);
  const n2 = normalizeText(str2);
  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0;

  const len1 = n1.length;
  const len2 = n2.length;
  const maxLen = Math.max(len1, len2);
  const minLen = Math.min(len1, len2);

  // Fast length pruning: if length difference is too big, similarity cannot reach threshold
  if (minLen / maxLen < threshold) return 0;

  // Single-row Levenshtein calculation for high performance
  let prevRow = new Int32Array(len2 + 1);
  let currRow = new Int32Array(len2 + 1);

  for (let j = 0; j <= len2; j++) prevRow[j] = j;

  for (let i = 1; i <= len1; i++) {
    currRow[0] = i;
    const char1 = n1.charCodeAt(i - 1);
    let minInRow = i;

    for (let j = 1; j <= len2; j++) {
      const cost = char1 === n2.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost
      );
      currRow[j] = val;
      if (val < minInRow) minInRow = val;
    }

    if (minInRow / maxLen > (1 - threshold)) return 0;

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  const dist = prevRow[len2];
  return Math.max(0, 1 - dist / maxLen);
};

export const DuplicateRulesAnalyzerModal: React.FC<DuplicateRulesAnalyzerModalProps> = ({
  isOpen,
  onClose,
  mappings,
  categories,
  subCategories,
  onSaveMappings,
}) => {
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.85); // 85% default
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
  const [clusterConfigs, setClusterConfigs] = useState<Record<string, { masterKey: string; target: string; catId: string; subCatId: string; deduplicateKeys: boolean }>>({});
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Analyze mappings and build clusters
  const clusters = useMemo(() => {
    if (!isOpen) return [];
    const allKeys = Object.keys(mappings);
    if (allKeys.length < 2) return [];

    const items: RuleItem[] = allKeys.map(k => ({
      key: k,
      targetDescription: mappings[k].targetDescription || '',
      categoryId: mappings[k].categoryId,
      subCategoryId: mappings[k].subCategoryId,
    }));

    const visited = new Set<string>();
    const foundClusters: RuleCluster[] = [];

    // Step 1: Group by exact normalized target or key (spaces / casing / accents differences)
    const normTargetMap: Record<string, RuleItem[]> = {};
    const normKeyMap: Record<string, RuleItem[]> = {};

    items.forEach(item => {
      const nt = normalizeText(item.targetDescription);
      const nk = normalizeText(item.key);

      if (nt) {
        if (!normTargetMap[nt]) normTargetMap[nt] = [];
        normTargetMap[nt].push(item);
      }
      if (nk) {
        if (!normKeyMap[nk]) normKeyMap[nk] = [];
        normKeyMap[nk].push(item);
      }
    });

    const isNathyCategory = (catId?: string) => {
      if (!catId) return false;
      const cat = categories.find(c => c.id === catId);
      return cat ? cat.name.toLowerCase().includes('nathy') : false;
    };

    const pickBestMaster = (rules: RuleItem[]) => {
      const nonNathyWithCat = rules.find(r => r.categoryId && !isNathyCategory(r.categoryId));
      if (nonNathyWithCat) return nonNathyWithCat;
      const withCat = rules.find(r => r.categoryId);
      if (withCat) return withCat;
      return rules[0];
    };

    // Process exact normalized target groups
    Object.entries(normTargetMap).forEach(([normTarget, group]) => {
      if (group.length > 1) {
        const uniqueTargets = new Set(group.map(g => g.targetDescription.trim()));
        const uniqueCats = new Set(group.map(g => `${g.categoryId || ''}|${g.subCategoryId || ''}`));

        // Check if there are variations in target text, whitespace, or category assignment
        if (uniqueTargets.size > 1 || uniqueCats.size > 1 || group.length >= 2) {
          group.forEach(g => visited.add(g.key));
          
          let reason = "Variações de maiúsculas, minúsculas ou espaços no destino";
          if (uniqueTargets.size > 1) {
            reason = "Mesmo destino com grafia ligeiramente diferente";
          } else if (uniqueCats.size > 1) {
            reason = "Mesmo destino associado a categorias diferentes";
          }

          const master = pickBestMaster(group);

          foundClusters.push({
            id: `norm_target_${normTarget}`,
            title: master.targetDescription.trim() || master.key,
            reason,
            rules: group,
            selectedMasterKey: master.key,
            customTargetDescription: master.targetDescription.trim(),
            customCategoryId: master.categoryId || '',
            customSubCategoryId: master.subCategoryId || '',
            deduplicateKeys: true,
          });
        }
      }
    });

    // Step 2: Group by exact normalized keys
    Object.entries(normKeyMap).forEach(([normKey, group]) => {
      if (group.length > 1) {
        const unvisitedGroup = group.filter(g => !visited.has(g.key));
        if (unvisitedGroup.length > 1) {
          unvisitedGroup.forEach(g => visited.add(g.key));
          const master = pickBestMaster(unvisitedGroup);

          foundClusters.push({
            id: `norm_key_${normKey}`,
            title: master.key,
            reason: "Chaves originais idênticas exceto por espaços ou pontuação",
            rules: unvisitedGroup,
            selectedMasterKey: master.key,
            customTargetDescription: master.targetDescription.trim(),
            customCategoryId: master.categoryId || '',
            customSubCategoryId: master.subCategoryId || '',
            deduplicateKeys: true,
          });
        }
      }
    });

    // Step 3: Fuzzy similarity matching for remaining items
    const remainingItems = items.filter(i => !visited.has(i.key));

    for (let i = 0; i < remainingItems.length; i++) {
      const itemA = remainingItems[i];
      if (visited.has(itemA.key)) continue;

      const matchedGroup: RuleItem[] = [itemA];

      for (let j = i + 1; j < remainingItems.length; j++) {
        const itemB = remainingItems[j];
        if (visited.has(itemB.key)) continue;

        const targetSim = getSimilarity(itemA.targetDescription, itemB.targetDescription);
        const keySim = getSimilarity(itemA.key, itemB.key);

        if (targetSim >= similarityThreshold || keySim >= similarityThreshold) {
          matchedGroup.push(itemB);
        }
      }

      if (matchedGroup.length > 1) {
        matchedGroup.forEach(g => visited.add(g.key));
        const master = pickBestMaster(matchedGroup);

        foundClusters.push({
          id: `fuzzy_${itemA.key}`,
          title: master.targetDescription.trim() || master.key,
          reason: `Destino ou chave com alta similaridade (≥ ${Math.round(similarityThreshold * 100)}%)`,
          rules: matchedGroup,
          selectedMasterKey: master.key,
          customTargetDescription: master.targetDescription.trim(),
          customCategoryId: master.categoryId || '',
          customSubCategoryId: master.subCategoryId || '',
          deduplicateKeys: true,
        });
      }
    }

    return foundClusters;
  }, [mappings, similarityThreshold]);

  // Sync cluster selection state
  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedClusterIds(clusters.map(c => c.id));
    setExpandedClusters(clusters.map(c => c.id));
    
    // Initialize cluster configurations
    const initialConfigs: Record<string, { masterKey: string; target: string; catId: string; subCatId: string; deduplicateKeys: boolean }> = {};
    clusters.forEach(c => {
      initialConfigs[c.id] = {
        masterKey: c.selectedMasterKey,
        target: c.customTargetDescription,
        catId: c.customCategoryId,
        subCatId: c.customSubCategoryId,
        deduplicateKeys: c.deduplicateKeys,
      };
    });
    setClusterConfigs(initialConfigs);
  }, [clusters, isOpen]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedClusterIds.length === clusters.length) {
      setSelectedClusterIds([]);
    } else {
      setSelectedClusterIds(clusters.map(c => c.id));
    }
  };

  const toggleSelectCluster = (id: string) => {
    setSelectedClusterIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const toggleExpandCluster = (id: string) => {
    setExpandedClusters(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const updateClusterConfig = (clusterId: string, field: string, value: any) => {
    setClusterConfigs(prev => ({
      ...prev,
      [clusterId]: {
        ...prev[clusterId],
        [field]: value,
      }
    }));
  };

  const handleSelectMasterRule = (cluster: RuleCluster, masterRuleKey: string) => {
    const masterRule = cluster.rules.find(r => r.key === masterRuleKey);
    if (!masterRule) return;

    setClusterConfigs(prev => ({
      ...prev,
      [cluster.id]: {
        ...prev[cluster.id],
        masterKey: masterRuleKey,
        target: masterRule.targetDescription.trim(),
        catId: masterRule.categoryId || '',
        subCatId: masterRule.subCategoryId || '',
      }
    }));
  };

  const handleConsolidateCluster = async (cluster: RuleCluster) => {
    setIsProcessing(true);
    try {
      const config = clusterConfigs[cluster.id] || {
        masterKey: cluster.selectedMasterKey,
        target: cluster.customTargetDescription,
        catId: cluster.customCategoryId,
        subCatId: cluster.customSubCategoryId,
        deduplicateKeys: true,
      };

      const updatedMappings = { ...mappings };

      // Apply master target description & categories to all rules in cluster
      cluster.rules.forEach(rule => {
        if (updatedMappings[rule.key]) {
          updatedMappings[rule.key] = {
            ...updatedMappings[rule.key],
            targetDescription: config.target.trim() || rule.targetDescription,
            categoryId: config.catId || undefined,
            subCategoryId: config.subCatId || undefined,
          };
        }
      });

      // Optionally deduplicate keys if original keys differ only by trailing whitespace/spaces
      if (config.deduplicateKeys) {
        const seenTrimmedKeys: Record<string, string> = {};
        cluster.rules.forEach(rule => {
          const trimmedKey = rule.key.trim();
          if (seenTrimmedKeys[trimmedKey] && seenTrimmedKeys[trimmedKey] !== rule.key) {
            // Remove duplicate space key
            delete updatedMappings[rule.key];
          } else {
            seenTrimmedKeys[trimmedKey] = rule.key;
            // Standardize key by trimming whitespace
            if (trimmedKey !== rule.key && updatedMappings[rule.key]) {
              const ruleVal = updatedMappings[rule.key];
              delete updatedMappings[rule.key];
              updatedMappings[trimmedKey] = ruleVal;
            }
          }
        });
      }

      await onSaveMappings(updatedMappings);
      setSuccessMessage(`Grupo "${cluster.title}" aglutinado com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Erro ao aglutinar grupo:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConsolidateSelected = async () => {
    if (selectedClusterIds.length === 0) return;
    setIsProcessing(true);
    try {
      const updatedMappings = { ...mappings };

      selectedClusterIds.forEach(clusterId => {
        const cluster = clusters.find(c => c.id === clusterId);
        if (!cluster) return;

        const config = clusterConfigs[cluster.id] || {
          masterKey: cluster.selectedMasterKey,
          target: cluster.customTargetDescription,
          catId: cluster.customCategoryId,
          subCatId: cluster.customSubCategoryId,
          deduplicateKeys: true,
        };

        cluster.rules.forEach(rule => {
          if (updatedMappings[rule.key]) {
            updatedMappings[rule.key] = {
              ...updatedMappings[rule.key],
              targetDescription: config.target.trim() || rule.targetDescription,
              categoryId: config.catId || undefined,
              subCategoryId: config.subCatId || undefined,
            };
          }
        });

        if (config.deduplicateKeys) {
          const seenTrimmedKeys: Record<string, string> = {};
          cluster.rules.forEach(rule => {
            const trimmedKey = rule.key.trim();
            if (seenTrimmedKeys[trimmedKey] && seenTrimmedKeys[trimmedKey] !== rule.key) {
              delete updatedMappings[rule.key];
            } else {
              seenTrimmedKeys[trimmedKey] = rule.key;
              if (trimmedKey !== rule.key && updatedMappings[rule.key]) {
                const ruleVal = updatedMappings[rule.key];
                delete updatedMappings[rule.key];
                updatedMappings[trimmedKey] = ruleVal;
              }
            }
          });
        }
      });

      await onSaveMappings(updatedMappings);
      setSuccessMessage(`${selectedClusterIds.length} grupos de regras foram aglutinados com sucesso!`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Erro ao aglutinar grupos selecionados:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/40">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg tracking-tight">Análise de Duplicações e Aglutinação</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Identifique e unifique regras com diferenças de grafia, maiúsculas ou espaços</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* MESSAGES & FILTERS BAR */}
        <div className="px-6 py-3 bg-zinc-100/60 dark:bg-zinc-950/80 border-b border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap gap-4 items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Filter size={14} className="text-blue-500" />
            <span className="font-semibold">Nível de Sensibilidade:</span>
            <select
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={0.95}>Muito Alto (Quase Idênticos)</option>
              <option value={0.85}>Alto (Pequenos erros de digitação / 85%)</option>
              <option value={0.75}>Médio (Grafias semelhantes / 75%)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {clusters.length} {clusters.length === 1 ? 'grupo identificado' : 'grupos identificados'}
            </span>
          </div>
        </div>

        {/* SUCCESS TOAST */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* CONTENT LIST */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 custom-scrollbar">
          {clusters.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/40">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-base">Nenhuma duplicação encontrada!</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">Suas regras de mapeamento estão limpas e organizadas. Não foram detectadas duplicações com o nível de sensibilidade atual.</p>
            </div>
          ) : (
            <>
              {/* SELECT ALL BAR */}
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 transition-colors"
                >
                  {selectedClusterIds.length === clusters.length ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : (
                    <Square size={16} className="text-zinc-400" />
                  )}
                  <span>Selecionar Todos ({selectedClusterIds.length}/{clusters.length})</span>
                </button>
                <span className="text-[11px] text-zinc-400 font-medium">Selecione os grupos para aglutinar em lote</span>
              </div>

              {/* CLUSTER CARDS */}
              {clusters.map((cluster, idx) => {
                const isSelected = selectedClusterIds.includes(cluster.id);
                const isExpanded = expandedClusters.includes(cluster.id);
                const config = clusterConfigs[cluster.id] || {
                  masterKey: cluster.selectedMasterKey,
                  target: cluster.customTargetDescription,
                  catId: cluster.customCategoryId,
                  subCatId: cluster.customSubCategoryId,
                  deduplicateKeys: true,
                };

                return (
                  <div 
                    key={cluster.id} 
                    className={`bg-white dark:bg-zinc-900/90 rounded-2xl border transition-all overflow-hidden ${
                      isSelected 
                        ? 'border-blue-300 dark:border-blue-800/80 shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    {/* CARD HEADER */}
                    <div className="p-4 bg-zinc-50/60 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => toggleSelectCluster(cluster.id)}
                          className="text-zinc-400 hover:text-blue-600 transition-colors shrink-0"
                        >
                          {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                        </button>

                        <div 
                          className="cursor-pointer min-w-0"
                          onClick={() => toggleExpandCluster(cluster.id)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm truncate">{cluster.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                              {cluster.rules.length} regras
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{cluster.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleConsolidateCluster(cluster)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Layers size={13} />
                          <span>Aglutinar Este</span>
                        </button>
                        <button
                          onClick={() => toggleExpandCluster(cluster.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* CARD BODY */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 text-xs">
                        {/* RULES COMPARISON TABLE */}
                        <div className="bg-zinc-50/80 dark:bg-zinc-950/60 rounded-xl p-3 border border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                            Regras Identificadas neste grupo:
                          </span>
                          <div className="space-y-1.5">
                            {cluster.rules.map((rule) => {
                              const isMaster = config.masterKey === rule.key;
                              const catName = categories.find(c => c.id === rule.categoryId)?.name || 'Sem Categoria';
                              const subCatName = subCategories.find(s => s.id === rule.subCategoryId)?.name;

                              return (
                                <div 
                                  key={rule.key}
                                  onClick={() => handleSelectMasterRule(cluster, rule.key)}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    isMaster 
                                      ? 'bg-blue-50/70 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/80' 
                                      : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input 
                                      type="radio" 
                                      name={`master_${cluster.id}`} 
                                      checked={isMaster} 
                                      onChange={() => handleSelectMasterRule(cluster, rule.key)}
                                      className="text-blue-600 focus:ring-blue-500 shrink-0" 
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                          "{rule.key}"
                                        </span>
                                        <ArrowRight size={12} className="text-zinc-400" />
                                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                          "{rule.targetDescription}"
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-600 dark:text-zinc-400">
                                      {catName} {subCatName ? `› ${subCatName}` : ''}
                                    </span>
                                    {isMaster && (
                                      <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded tracking-wide">
                                        Mestra
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* MASTER RULE CUSTOMIZATION FORM */}
                        <div className="p-3.5 bg-blue-50/30 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-3">
                          <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 block">
                            Configurar Redação e Categoria Mestra (Unificada):
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Descrição Destino Final</label>
                              <input 
                                type="text"
                                value={config.target}
                                onChange={(e) => updateClusterConfig(cluster.id, 'target', e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Descrição padronizada..."
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Categoria Mestra</label>
                              <select
                                value={config.catId}
                                onChange={(e) => {
                                  updateClusterConfig(cluster.id, 'catId', e.target.value);
                                  updateClusterConfig(cluster.id, 'subCatId', '');
                                }}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="">Sem Categoria</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Subcategoria Mestra</label>
                              <select
                                value={config.subCatId}
                                onChange={(e) => updateClusterConfig(cluster.id, 'subCatId', e.target.value)}
                                disabled={!config.catId}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                              >
                                <option value="">Sem Subcategoria</option>
                                {config.catId && subCategories.filter(s => s.categoryId === config.catId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center gap-2">
                            <input 
                              type="checkbox"
                              id={`dedup_${cluster.id}`}
                              checked={config.deduplicateKeys}
                              onChange={(e) => updateClusterConfig(cluster.id, 'deduplicateKeys', e.target.checked)}
                              className="text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`dedup_${cluster.id}`} className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium cursor-pointer">
                              Remover gatilhos redundantes com apenas diferenças de espaços vazios no final
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Info size={14} className="text-blue-500 shrink-0" />
            <span>A aglutinação atualizará as regras para padronizar os novos lançamentos e importações.</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            {clusters.length > 0 && (
              <button
                onClick={handleConsolidateSelected}
                disabled={selectedClusterIds.length === 0 || isProcessing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Layers size={15} />
                <span>Aglutinar Selecionados ({selectedClusterIds.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
