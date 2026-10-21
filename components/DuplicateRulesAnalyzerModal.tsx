import React, { useState, useMemo, useEffect } from 'react';
import { DescriptionMap, Category, SubCategory } from '../types';
import {
  Sparkles, CheckCircle2, Layers, ArrowRight, Trash2, CheckSquare, Square,
  X, Filter, Search, ChevronDown, ChevronRight, Info, Check, EyeOff,
  RotateCcw, SlidersHorizontal, AlertCircle
} from 'lucide-react';

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
  selectedRuleKeys: string[]; // Chaves marcadas para serem unificadas nesta regra
}

// Helpers para normalização de texto e similaridade rápida
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

  if (minLen / maxLen < threshold) return 0;

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
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.85);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingClusters, setPendingClusters] = useState<RuleCluster[]>([]);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
  const [expandedClusterIds, setExpandedClusterIds] = useState<string[]>([]);
  const [resolvedClusterIds, setResolvedClusterIds] = useState<string[]>([]);
  const [dismissedClusterIds, setDismissedClusterIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper para verificar categoria Nathy
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

  // 1. Gera os clusters iniciais a partir do mapeamento quando o modal abre ou a sensibilidade muda
  const detectClusters = useMemo(() => {
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

    // Passo 1: Agrupamento por Target normalizado
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

    // Grupos com mesmo destino normalizado
    Object.entries(normTargetMap).forEach(([normTarget, group]) => {
      if (group.length > 1) {
        const uniqueTargets = new Set(group.map(g => g.targetDescription.trim()));
        const uniqueCats = new Set(group.map(g => `${g.categoryId || ''}|${g.subCategoryId || ''}`));

        // IMPORTANTE: Só é duplicidade/conflito se houver divergência no destino (ex: "Uber" vs "Uber BR") ou nas categorias/subcategorias associadas!
        // Se todas as regras já têm o mesmo destino e mesma categoria/subcategoria, já estão perfeitamente unificadas e NÃO devem ser listadas como pendência!
        if (uniqueTargets.size > 1 || uniqueCats.size > 1) {
          group.forEach(g => visited.add(g.key));

          let reason = "Variações de maiúsculas, minúsculas ou espaços no destino";
          if (uniqueTargets.size > 1) {
            reason = "Mesmo destino com grafias ligeiramente diferentes";
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
            selectedRuleKeys: group.map(g => g.key), // Todas marcadas por padrão
          });
        }
      }
    });

    // Passo 2: Grupos com mesma chave normalizada
    Object.entries(normKeyMap).forEach(([normKey, group]) => {
      if (group.length > 1) {
        const unvisitedGroup = group.filter(g => !visited.has(g.key));
        if (unvisitedGroup.length > 1) {
          const uniqueTargets = new Set(unvisitedGroup.map(g => g.targetDescription.trim()));
          const uniqueCats = new Set(unvisitedGroup.map(g => `${g.categoryId || ''}|${g.subCategoryId || ''}`));
          const uniqueKeys = new Set(unvisitedGroup.map(g => g.key.trim()));

          if (uniqueTargets.size > 1 || uniqueCats.size > 1 || uniqueKeys.size < unvisitedGroup.length) {
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
              selectedRuleKeys: unvisitedGroup.map(g => g.key),
            });
          }
        }
      }
    });

    // Passo 3: Similaridade difusa (Fuzzy)
    const remainingItems = items.filter(i => !visited.has(i.key));

    for (let i = 0; i < remainingItems.length; i++) {
      const itemA = remainingItems[i];
      if (visited.has(itemA.key)) continue;

      const matchedGroup: RuleItem[] = [itemA];

      for (let j = i + 1; j < remainingItems.length; j++) {
        const itemB = remainingItems[j];
        if (visited.has(itemB.key)) continue;

        const targetSim = getSimilarity(itemA.targetDescription, itemB.targetDescription, similarityThreshold);
        const keySim = getSimilarity(itemA.key, itemB.key, similarityThreshold);

        if (targetSim >= similarityThreshold || keySim >= similarityThreshold) {
          matchedGroup.push(itemB);
        }
      }

      if (matchedGroup.length > 1) {
        const uniqueTargets = new Set(matchedGroup.map(g => g.targetDescription.trim()));
        const uniqueCats = new Set(matchedGroup.map(g => `${g.categoryId || ''}|${g.subCategoryId || ''}`));

        if (uniqueTargets.size > 1 || uniqueCats.size > 1) {
          matchedGroup.forEach(g => visited.add(g.key));
          const master = pickBestMaster(matchedGroup);

          foundClusters.push({
            id: `fuzzy_${itemA.key}_${i}`,
            title: master.targetDescription.trim() || master.key,
            reason: `Destino ou chave com alta similaridade (≥ ${Math.round(similarityThreshold * 100)}%)`,
            rules: matchedGroup,
            selectedMasterKey: master.key,
            customTargetDescription: master.targetDescription.trim(),
            customCategoryId: master.categoryId || '',
            customSubCategoryId: master.subCategoryId || '',
            deduplicateKeys: true,
            selectedRuleKeys: matchedGroup.map(g => g.key),
          });
        }
      }
    }

    return foundClusters;
  }, [mappings, similarityThreshold, isOpen]);

  // Inicializa ou atualiza a lista de clusters pendentes
  useEffect(() => {
    if (isOpen) {
      const activeClusters = detectClusters.filter(
        c => !resolvedClusterIds.includes(c.id) && !dismissedClusterIds.includes(c.id)
      );
      setPendingClusters(activeClusters);
      setSelectedClusterIds(activeClusters.map(c => c.id));
      setExpandedClusterIds(activeClusters.map(c => c.id));
    }
  }, [detectClusters, isOpen, similarityThreshold]);

  // Filtro de busca textual dentro do modal
  const filteredClusters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingClusters;

    return pendingClusters.filter(cluster => {
      const matchTitle = cluster.title.toLowerCase().includes(q);
      const matchTarget = cluster.customTargetDescription.toLowerCase().includes(q);
      const matchRules = cluster.rules.some(r =>
        r.key.toLowerCase().includes(q) || r.targetDescription.toLowerCase().includes(q)
      );
      return matchTitle || matchTarget || matchRules;
    });
  }, [pendingClusters, searchQuery]);

  if (!isOpen) return null;

  // --- Handlers de Seleção e Configuração dos Clusters ---

  const toggleSelectAll = () => {
    if (selectedClusterIds.length === filteredClusters.length) {
      setSelectedClusterIds([]);
    } else {
      setSelectedClusterIds(filteredClusters.map(c => c.id));
    }
  };

  const toggleSelectCluster = (id: string) => {
    setSelectedClusterIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const toggleExpandCluster = (id: string) => {
    setExpandedClusterIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const updateClusterField = (clusterId: string, field: keyof RuleCluster, value: any) => {
    setPendingClusters(prev =>
      prev.map(c => (c.id === clusterId ? { ...c, [field]: value } : c))
    );
  };

  // Toggle de inclusão de uma descrição individual na regra do cluster
  const toggleRuleKeyInclusion = (clusterId: string, ruleKey: string) => {
    setPendingClusters(prev =>
      prev.map(c => {
        if (c.id !== clusterId) return c;
        const exists = c.selectedRuleKeys.includes(ruleKey);
        const newSelected = exists
          ? c.selectedRuleKeys.filter(k => k !== ruleKey)
          : [...c.selectedRuleKeys, ruleKey];
        return { ...c, selectedRuleKeys: newSelected };
      })
    );
  };

  // Marcar todas as descrições do cluster
  const selectAllRulesInCluster = (clusterId: string) => {
    setPendingClusters(prev =>
      prev.map(c => {
        if (c.id !== clusterId) return c;
        return { ...c, selectedRuleKeys: c.rules.map(r => r.key) };
      })
    );
  };

  // Desmarcar todas as descrições do cluster
  const deselectAllRulesInCluster = (clusterId: string) => {
    setPendingClusters(prev =>
      prev.map(c => {
        if (c.id !== clusterId) return c;
        return { ...c, selectedRuleKeys: [] };
      })
    );
  };

  // Selecionar Regra Mestra
  const handleSelectMasterRule = (clusterId: string, masterRuleKey: string) => {
    setPendingClusters(prev =>
      prev.map(c => {
        if (c.id !== clusterId) return c;
        const master = c.rules.find(r => r.key === masterRuleKey);
        if (!master) return c;

        // Garante que a regra mestra fique marcada
        const newSelected = c.selectedRuleKeys.includes(masterRuleKey)
          ? c.selectedRuleKeys
          : [...c.selectedRuleKeys, masterRuleKey];

        return {
          ...c,
          selectedMasterKey: masterRuleKey,
          customTargetDescription: master.targetDescription.trim(),
          customCategoryId: master.categoryId || '',
          customSubCategoryId: master.subCategoryId || '',
          selectedRuleKeys: newSelected,
        };
      })
    );
  };

  // Excluir definitivamente uma variação indesejada do mapeamento
  const handleDeleteRuleDirectly = async (clusterId: string, ruleKey: string) => {
    const updatedMappings = { ...mappings };
    delete updatedMappings[ruleKey];
    await onSaveMappings(updatedMappings);

    // Atualiza o cluster removendo a regra
    setPendingClusters(prev =>
      prev
        .map(c => {
          if (c.id !== clusterId) return c;
          const remainingRules = c.rules.filter(r => r.key !== ruleKey);
          return {
            ...c,
            rules: remainingRules,
            selectedRuleKeys: c.selectedRuleKeys.filter(k => k !== ruleKey),
          };
        })
        .filter(c => c.rules.length > 1) // Se sobrou apenas 1 ou 0, remove o cluster
    );
  };

  // Ignorar / Descartar grupo da análise (some da lista sem alterar nada)
  const handleDismissCluster = (clusterId: string) => {
    setDismissedClusterIds(prev => [...prev, clusterId]);
    setPendingClusters(prev => prev.filter(c => c.id !== clusterId));
    setSelectedClusterIds(prev => prev.filter(id => id !== clusterId));
  };

  // 2. SALVAR E APLICAR UM CLUSTER INDIVIDUAL - Some da lista imediatamente ao salvar!
  const handleSaveCluster = async (cluster: RuleCluster) => {
    if (cluster.selectedRuleKeys.length === 0) {
      // Se nenhuma variação estiver marcada, apenas remove da lista
      handleDismissCluster(cluster.id);
      return;
    }

    setIsProcessing(true);
    try {
      const updatedMappings = { ...mappings };
      const target = cluster.customTargetDescription.trim() || cluster.title;
      const catId = cluster.customCategoryId || undefined;
      const subCatId = cluster.customSubCategoryId || undefined;

      // 1. Aplica a padronização APENAS para as variações selecionadas
      cluster.selectedRuleKeys.forEach(ruleKey => {
        if (updatedMappings[ruleKey]) {
          updatedMappings[ruleKey] = {
            targetDescription: target,
            categoryId: catId,
            subCategoryId: subCatId,
          };
        } else {
          // Caso a chave tenha sido normalizada
          updatedMappings[ruleKey] = {
            targetDescription: target,
            categoryId: catId,
            subCategoryId: subCatId,
          };
        }
      });

      // 2. Opcionalmente desduplica chaves que diferem apenas por espaços
      if (cluster.deduplicateKeys) {
        const seenTrimmed: Record<string, string> = {};
        cluster.selectedRuleKeys.forEach(ruleKey => {
          const trimmed = ruleKey.trim();
          if (seenTrimmed[trimmed] && seenTrimmed[trimmed] !== ruleKey) {
            delete updatedMappings[ruleKey];
          } else {
            seenTrimmed[trimmed] = ruleKey;
            if (trimmed !== ruleKey && updatedMappings[ruleKey]) {
              const ruleVal = updatedMappings[ruleKey];
              delete updatedMappings[ruleKey];
              updatedMappings[trimmed] = ruleVal;
            }
          }
        });
      }

      // 3. Registra como resolvido e remove o cluster salvo imediatamente da lista de pendências
      setResolvedClusterIds(prev => [...prev, cluster.id]);
      setPendingClusters(prev => prev.filter(c => c.id !== cluster.id));
      setSelectedClusterIds(prev => prev.filter(id => id !== cluster.id));

      await onSaveMappings(updatedMappings);

      setSuccessMessage(`Regra "${target}" salva com ${cluster.selectedRuleKeys.length} descrições vinculadas!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar cluster:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. SALVAR E AGLUTINAR TODOS OS CLUSTERS SELECIONADOS EM LOTE - Todos os salvos somem da lista!
  const handleSaveSelectedClusters = async () => {
    if (selectedClusterIds.length === 0) return;
    setIsProcessing(true);
    try {
      const updatedMappings = { ...mappings };
      const clustersToProcess = pendingClusters.filter(c => selectedClusterIds.includes(c.id));

      let totalMappedVariations = 0;

      clustersToProcess.forEach(cluster => {
        if (cluster.selectedRuleKeys.length === 0) return;

        const target = cluster.customTargetDescription.trim() || cluster.title;
        const catId = cluster.customCategoryId || undefined;
        const subCatId = cluster.customSubCategoryId || undefined;

        cluster.selectedRuleKeys.forEach(ruleKey => {
          updatedMappings[ruleKey] = {
            targetDescription: target,
            categoryId: catId,
            subCategoryId: subCatId,
          };
          totalMappedVariations++;
        });

        if (cluster.deduplicateKeys) {
          const seenTrimmed: Record<string, string> = {};
          cluster.selectedRuleKeys.forEach(ruleKey => {
            const trimmed = ruleKey.trim();
            if (seenTrimmed[trimmed] && seenTrimmed[trimmed] !== ruleKey) {
              delete updatedMappings[ruleKey];
            } else {
              seenTrimmed[trimmed] = ruleKey;
              if (trimmed !== ruleKey && updatedMappings[ruleKey]) {
                const ruleVal = updatedMappings[ruleKey];
                delete updatedMappings[ruleKey];
                updatedMappings[trimmed] = ruleVal;
              }
            }
          });
        }
      });

      const savedIds = clustersToProcess.map(c => c.id);
      setResolvedClusterIds(prev => [...prev, ...savedIds]);
      setPendingClusters(prev => prev.filter(c => !savedIds.includes(c.id)));
      setSelectedClusterIds([]);

      await onSaveMappings(updatedMappings);

      setSuccessMessage(`${clustersToProcess.length} grupos (${totalMappedVariations} descrições) unificados com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar selecionados:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* 1. HEADER DO MODAL */}
        <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/40">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg tracking-tight">
                  Análise Inteligente & Aglutinação de Regras
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {pendingClusters.length} {pendingClusters.length === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Escolha quais descrições do extrato entram na regra unificada. Ao salvar, os grupos processados saem da lista.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Fechar análise"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. BARRA DE FILTROS & BUSCA INTELIGENTE */}
        <div className="px-4 sm:px-6 py-3 bg-zinc-100/70 dark:bg-zinc-950/90 border-b border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap gap-3 items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar grupos por descrição ou texto..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <SlidersHorizontal size={14} className="text-blue-500" />
              <span className="font-semibold text-zinc-600 dark:text-zinc-400 hidden sm:inline">Sensibilidade:</span>
              <select
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={0.95}>Quase Idênticos (95%)</option>
                <option value={0.85}>Alta (Recomendado - 85%)</option>
                <option value={0.75}>Média (75%)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-500">
              {filteredClusters.length} de {pendingClusters.length} exibidos
            </span>
          </div>
        </div>

        {/* 3. MENSAGEM DE SUCESSO (TOAST) */}
        {successMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 4. LISTA DE GRUPOS IDENTIFICADOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {pendingClusters.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-base">
                  Análise Concluída com Sucesso!
                </h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Não há mais grupos de duplicações pendentes. Suas regras de mapeamento estão limpas, padronizadas e otimizadas.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Concluir e Voltar
              </button>
            </div>
          ) : filteredClusters.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 space-y-2">
              <AlertCircle size={28} className="mx-auto text-zinc-400" />
              <p className="text-xs font-semibold">Nenhum grupo encontrado com o termo "{searchQuery}".</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <>
              {/* BARRA DE SELEÇÃO EM LOTE */}
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 transition-colors"
                >
                  {selectedClusterIds.length === filteredClusters.length && filteredClusters.length > 0 ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : (
                    <Square size={16} className="text-zinc-400" />
                  )}
                  <span>Selecionar Todos ({selectedClusterIds.length}/{filteredClusters.length})</span>
                </button>

                <span className="text-[11px] text-zinc-400 font-medium">
                  {selectedClusterIds.length} selecionados para unificação em lote
                </span>
              </div>

              {/* CARDS DE CLUSTERS */}
              {filteredClusters.map((cluster) => {
                const isSelected = selectedClusterIds.includes(cluster.id);
                const isExpanded = expandedClusterIds.includes(cluster.id);
                const selectedRulesCount = cluster.selectedRuleKeys.length;
                const totalRulesCount = cluster.rules.length;

                return (
                  <div 
                    key={cluster.id} 
                    className={`bg-white dark:bg-zinc-900/90 rounded-2xl border transition-all overflow-hidden ${
                      isSelected 
                        ? 'border-blue-300 dark:border-blue-800/80 shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    {/* CABEÇALHO DO CARD DO GRUPO */}
                    <div className="p-3.5 sm:p-4 bg-zinc-50/70 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectCluster(cluster.id)}
                          className="text-zinc-400 hover:text-blue-600 transition-colors shrink-0 p-0.5"
                          title={isSelected ? 'Desmarcar grupo' : 'Marcar grupo para salvar em lote'}
                        >
                          {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                        </button>

                        <div 
                          className="cursor-pointer min-w-0 flex-1"
                          onClick={() => toggleExpandCluster(cluster.id)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                              {cluster.title}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                              {selectedRulesCount}/{totalRulesCount} descrições elencadas
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {cluster.reason}
                          </p>
                        </div>
                      </div>

                      {/* AÇÕES RÁPIDAS NO TOPO DO CARD */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDismissCluster(cluster.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1"
                          title="Ignorar este grupo (manter as regras separadas como estão)"
                        >
                          <EyeOff size={14} />
                          <span className="hidden md:inline text-[11px]">Ignorar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveCluster(cluster)}
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                          title="Salvar esta regra unificada e remover este grupo da lista de análise"
                        >
                          <Check size={14} />
                          <span>Salvar e Unificar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpandCluster(cluster.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* CORPO EXPANSÍVEL DO CLUSTER COM ESCOLHA DETALHADA */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 text-xs">
                        
                        {/* 1. SELEÇÃO DE QUAIS DESCRIÇÕES VÃO OU NÃO PARA A REGRA */}
                        <div className="bg-zinc-50/80 dark:bg-zinc-950/60 rounded-2xl p-3.5 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Descrições Identificadas para esta Regra:
                              </span>
                              <p className="text-[10px] text-zinc-500">
                                Marque ou desmarque para escolher exatamente quais textos entram nesta regra unificada.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllRulesInCluster(cluster.id)}
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                Marcar Todas
                              </button>
                              <span className="text-zinc-300">|</span>
                              <button
                                type="button"
                                onClick={() => deselectAllRulesInCluster(cluster.id)}
                                className="text-[10px] font-bold text-zinc-500 hover:underline"
                              >
                                Desmarcar Todas
                              </button>
                            </div>
                          </div>

                          {/* Lista das Descrições com Checkbox + Rádio Mestra + Ação Excluir */}
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {cluster.rules.map((rule) => {
                              const isChecked = cluster.selectedRuleKeys.includes(rule.key);
                              const isMaster = cluster.selectedMasterKey === rule.key;
                              const catName = categories.find(c => c.id === rule.categoryId)?.name || 'Sem Categoria';
                              const subCatName = subCategories.find(s => s.id === rule.subCategoryId)?.name;

                              return (
                                <div 
                                  key={rule.key}
                                  className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                    isChecked
                                      ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70' 
                                      : 'bg-white dark:bg-zinc-900/60 border-zinc-200/70 dark:border-zinc-800/70 opacity-75'
                                  }`}
                                >
                                  {/* Checkbox de Inclusão + Radio de Mestra + Textos */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Toggle de Inclusão */}
                                    <button
                                      type="button"
                                      onClick={() => toggleRuleKeyInclusion(cluster.id, rule.key)}
                                      className="text-zinc-400 hover:text-blue-600 transition-colors shrink-0"
                                      title={isChecked ? 'Desmarcar (não elencar para esta regra)' : 'Elencar para esta regra'}
                                    >
                                      {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                    </button>

                                    {/* Radio Mestra */}
                                    <label 
                                      className="flex items-center gap-1.5 cursor-pointer shrink-0"
                                      title="Definir esta redação como modelo/mestra para a regra"
                                    >
                                      <input 
                                        type="radio" 
                                        name={`master_${cluster.id}`} 
                                        checked={isMaster} 
                                        onChange={() => handleSelectMasterRule(cluster.id, rule.key)}
                                        className="text-blue-600 focus:ring-blue-500" 
                                      />
                                      {isMaster && (
                                        <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded tracking-wide">
                                          Mestra
                                        </span>
                                      )}
                                    </label>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/60 dark:border-zinc-700/60 truncate" title={rule.key}>
                                          "{rule.key}"
                                        </span>
                                        <ArrowRight size={12} className="text-zinc-400 shrink-0" />
                                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                                          "{rule.targetDescription}"
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Categoria + Status + Excluir Variação */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-600 dark:text-zinc-400">
                                      {catName} {subCatName ? `› ${subCatName}` : ''}
                                    </span>

                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isChecked
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                    }`}>
                                      {isChecked ? 'Elencada' : 'Ignorada'}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRuleDirectly(cluster.id, rule.key)}
                                      className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                      title="Excluir esta descrição do mapeamento geral"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. FORMULÁRIO DE CONFIGURAÇÃO DA REGRA UNIFICADA */}
                        <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-3">
                          <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 block">
                            Configuração da Regra Unificada (Resultado Final):
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                                Descrição Final de Autopreenchimento
                              </label>
                              <input 
                                type="text"
                                value={cluster.customTargetDescription}
                                onChange={(e) => updateClusterField(cluster.id, 'customTargetDescription', e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Descrição padronizada..."
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                                Categoria
                              </label>
                              <select
                                value={cluster.customCategoryId}
                                onChange={(e) => {
                                  updateClusterField(cluster.id, 'customCategoryId', e.target.value);
                                  updateClusterField(cluster.id, 'customSubCategoryId', '');
                                }}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                              >
                                <option value="">Sem Categoria</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                                Subcategoria
                              </label>
                              <select
                                value={cluster.customSubCategoryId}
                                onChange={(e) => updateClusterField(cluster.id, 'customSubCategoryId', e.target.value)}
                                disabled={!cluster.customCategoryId}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 cursor-pointer"
                              >
                                <option value="">Sem Subcategoria</option>
                                {cluster.customCategoryId && subCategories
                                  .filter(s => s.categoryId === cluster.customCategoryId)
                                  .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center gap-2">
                            <input 
                              type="checkbox"
                              id={`dedup_${cluster.id}`}
                              checked={cluster.deduplicateKeys}
                              onChange={(e) => updateClusterField(cluster.id, 'deduplicateKeys', e.target.checked)}
                              className="text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`dedup_${cluster.id}`} className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium cursor-pointer">
                              Normalizar e remover gatilhos redundantes com diferenças apenas de espaços em branco
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

        {/* 5. FOOTER COM AÇÕES EM LOTE E FECHAMENTO */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Info size={14} className="text-blue-500 shrink-0" />
            <span>Ao salvar, as regras selecionadas são aplicadas e o grupo é removido da lista de pendências.</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Fechar
            </button>

            {pendingClusters.length > 0 && (
              <button
                type="button"
                onClick={handleSaveSelectedClusters}
                disabled={selectedClusterIds.length === 0 || isProcessing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Layers size={15} />
                <span>Salvar Selecionados ({selectedClusterIds.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
