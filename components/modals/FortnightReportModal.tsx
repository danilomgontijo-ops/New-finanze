import DOMPurify from "dompurify";
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Filter,
  CheckSquare,
  Square,
  Eye,
  AlertCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Save,
  Bookmark,
  Trash2,
  Clock,
  CheckCircle2,
  PlusCircle,
  FileText,
  Download,
  Info
} from 'lucide-react';
import { collection, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { Demand, SavedPresentation } from '../../types';
import { parseObservations, ParsedObservationNote, parsePtBrDate, formatPtBrDate, formatIsoInputDate } from '../../utils/deadlineUtils';
import { XMarkIcon, FormIcon, DocumentArrowDownIcon, SparklesIcon, CalendarIcon } from '../icons';
import StatusBadge from '../StatusBadge';
import { parseBRNumber } from '../../utils/formatters';
import { getCreatedAtMillis } from '../../utils/helpers';

interface FortnightReportModalProps {
  demands: Demand[];
  db?: any;
  currentUser?: any;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onClose: () => void;
  onViewDemand: (demand: Demand) => void;
}

type PeriodType = '15d' | '30d' | 'month' | 'custom';
type TabView = 'report' | 'slides' | 'copy' | 'saved';

interface FortnightDemandItem {
  demand: Demand;
  recentNotes: ParsedObservationNote[];
  relevantNotes: ParsedObservationNote[];
  minorEditNotes: ParsedObservationNote[];
  isNewInPeriod: boolean;
  isConcludedInPeriod: boolean;
  hasNotesInPeriod: boolean;
  isOngoingActive: boolean;
  latestNoteInPeriod?: ParsedObservationNote;
  latestSubstantiveNote?: ParsedObservationNote;
  latestHistoricalNote?: ParsedObservationNote;
  hasMinorEditOnly: boolean;
  eventCategories: ('iniciada' | 'concluida' | 'nota' | 'em_andamento')[];
}

// Helper to identify minor text corrections/edits
function isMinorTextEditNote(note: ParsedObservationNote): boolean {
  if (!note) return false;
  const titleLower = (note.title || '').toLowerCase();
  const bodyClean = (note.bodyHtml || '').replace(/<[^>]*>/g, '').toLowerCase().trim();
  const textCombine = `${titleLower} ${bodyClean}`;

  const minorKeywords = [
    'correção',
    'correcão',
    'corrigid',
    'ajuste de texto',
    'erro de digita',
    'digitação',
    'digitacao',
    'edição simples',
    'edicao simples',
    'revisão de texto',
    'revisao de texto',
    'alteração de texto',
    'alteracao de texto',
    'grafia',
    'corrigido texto',
    'apenas texto',
    'ajuste simples',
    'pequena alteração',
    'pequena alteracao',
    'formatação',
    'formatacao',
    'correção ortográfica',
    'ajuste pontual'
  ];

  return minorKeywords.some((kw) => textCombine.includes(kw));
}

// Convert YYYY-MM-DD to PT-BR Date
function parseIsoToDate(isoStr: string): Date {
  if (!isoStr) return new Date();
  const parts = isoStr.split('-');
  if (parts.length !== 3) return new Date();
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

const formatDateToIsoInput = formatIsoInputDate;

// "DD/MM/YYYY HH:mm" -> "YYYY-MM-DD HH:mm" so saved presentations sort chronologically
function savedAtSortKey(savedAt?: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/.exec((savedAt || '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}${match[4]}` : savedAt || '';
}

export const FortnightReportModal: React.FC<FortnightReportModalProps> = ({
  demands,
  db,
  currentUser,
  addToast,
  onClose,
  onViewDemand,
}) => {
  const [activeTab, setActiveTab] = useState<TabView>('report');
  const [periodType, setPeriodType] = useState<PeriodType>('15d');
  
  // Custom date picker states (default to last 15 days)
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return formatDateToIsoInput(d);
  }, []);
  const defaultEnd = useMemo(() => formatDateToIsoInput(new Date()), []);

  const [customStartDate, setCustomStartDate] = useState<string>(defaultStart);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultEnd);

  // Event Type Filter Controls (User requested full control)
  const [showNew, setShowNew] = useState<boolean>(true); // Iniciadas no período
  const [showConcluded, setShowConcluded] = useState<boolean>(true); // Finalizadas no período
  const [showNotes, setShowNotes] = useState<boolean>(true); // Novas notas no período
  const [showOngoing, setShowOngoing] = useState<boolean>(true); // Fiscalizações em andamento (estoque ativo)
  const [hideMinorTextEdits, setHideMinorTextEdits] = useState<boolean>(true); // Omitir simples correções
  const [ignoreImportedWithoutNotes, setIgnoreImportedWithoutNotes] = useState<boolean>(true); // Ignorar data de importação antiga

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Per-demand manual selection
  const [selectedDemandIds, setSelectedDemandIds] = useState<Record<string, boolean>>({});

  // Slide deck state
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  // Saved Presentations list & Save dialog state
  const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [presentationTitleInput, setPresentationTitleInput] = useState<string>('');
  const [deletingPresId, setDeletingPresId] = useState<string | null>(null);

  // 1. Calculate cutoff dates based on period selection
  const { startDate, endDate } = useMemo(() => {
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (periodType === '15d') {
      start.setDate(start.getDate() - 15);
      start.setHours(0, 0, 0, 0);
    } else if (periodType === '30d') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (periodType === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (periodType === 'custom') {
      start = parseIsoToDate(customStartDate);
      start.setHours(0, 0, 0, 0);
      end = parseIsoToDate(customEndDate);
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  }, [periodType, customStartDate, customEndDate]);

  // Format date range text for display
  const periodText = useMemo(() => {
    return `${formatPtBrDate(startDate)} a ${formatPtBrDate(endDate)}`;
  }, [startDate, endDate]);

  // Load Saved Presentations from LocalStorage & Firestore
  useEffect(() => {
    let localList: SavedPresentation[] = [];
    try {
      const saved = localStorage.getItem('saved_presentations_snapshots');
      if (saved) {
        localList = JSON.parse(saved);
        setSavedPresentations(localList);
      }
    } catch (e) {}

    if (!db) return;

    try {
      const colPath = currentUser?.uid ? `users/${currentUser.uid}/saved_presentations` : 'saved_presentations';
      const colRef = collection(db, colPath);
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        // The Firestore document id must win over any "id" field stored inside the document,
        // otherwise deleteDoc() targets a non-existent document.
        const list = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        } as SavedPresentation)).sort((a, b) => savedAtSortKey(b.savedAt).localeCompare(savedAtSortKey(a.savedAt)));
        if (list.length > 0) {
          setSavedPresentations(list);
        }
      }, () => {});

      return () => unsubscribe();
    } catch (e) {}
  }, [db, currentUser]);

  // 2. Raw Processed Demands according to period and notes
  const rawFortnightData = useMemo(() => {
    const items: FortnightDemandItem[] = [];

    demands.forEach((demand) => {
      // Parse all observation notes first
      const notes = parseObservations(demand.observacoes);
      // Most recent note by date (notes are stored oldest-first, so notes[0] would be the oldest)
      const latestHistoricalNote = notes.reduce<ParsedObservationNote | undefined>(
        (latest, n) => (!latest || n.date.getTime() >= latest.date.getTime() ? n : latest),
        undefined
      );

      // Filter notes created/dated within period
      const recentNotes = notes.filter((n) => {
        // If note has no explicit date header/text date and user wants to ignore un-dated imports, exclude it from period count
        if (n.hasExplicitDate === false && ignoreImportedWithoutNotes) {
          return false;
        }
        return n.date >= startDate && n.date <= endDate;
      });
      recentNotes.sort((a, b) => b.date.getTime() - a.date.getTime());

      const minorEditNotes = recentNotes.filter(isMinorTextEditNote);
      const relevantNotes = recentNotes.filter((n) => !isMinorTextEditNote(n));
      const hasMinorEditOnly = recentNotes.length > 0 && relevantNotes.length === 0;

      // Determine creation/invalidation date
      const createdMillis = getCreatedAtMillis(demand.createdAt);
      const createdDate: Date | null = createdMillis ? new Date(createdMillis) : null;

      // Check if demand is truly new in period
      let isNewInPeriod = false;
      if (createdDate && createdDate >= startDate && createdDate <= endDate) {
        const isHistoricalConcluded = demand.status === 'Concluído';
        // If user wants to ignore bulk imports without explicit current notes
        if (ignoreImportedWithoutNotes) {
          if (!isHistoricalConcluded && recentNotes.length > 0) {
            isNewInPeriod = true;
          }
        } else {
          isNewInPeriod = !isHistoricalConcluded;
        }
      }

      // A note counts as concluded in the period by its CONCLUSION date (any note, even one created earlier).
      // Legacy notes without a conclusion date fall back to the note date.
      const isConcludedInPeriod = notes.some((n) => {
        if (!n.isConcluded) return false;
        const concludedDate = (n.concludedDateStr && parsePtBrDate(n.concludedDateStr)) || n.date;
        return concludedDate >= startDate && concludedDate <= endDate;
      });

      const hasNotesInPeriod = recentNotes.length > 0;
      const normalizedStatus = (demand.status || '').trim().toLowerCase();
      const isOngoingActive =
        normalizedStatus === 'fiscalização em curso' || normalizedStatus === 'fiscalizacao em curso';

      const eventCategories: ('iniciada' | 'concluida' | 'nota' | 'em_andamento')[] = [];
      if (isNewInPeriod) eventCategories.push('iniciada');
      if (isConcludedInPeriod) eventCategories.push('concluida');
      if (hasNotesInPeriod) eventCategories.push('nota');
      if (isOngoingActive) eventCategories.push('em_andamento');

      // Add to raw list if it matches at least one event type in period OR is active ongoing
      if (isNewInPeriod || isConcludedInPeriod || hasNotesInPeriod || isOngoingActive) {
        items.push({
          demand,
          recentNotes,
          relevantNotes,
          minorEditNotes,
          isNewInPeriod,
          isConcludedInPeriod,
          hasNotesInPeriod,
          isOngoingActive,
          latestNoteInPeriod: recentNotes[0],
          latestSubstantiveNote: relevantNotes[0],
          latestHistoricalNote,
          hasMinorEditOnly,
          eventCategories,
        });
      }
    });

    items.sort((a, b) => {
      // Prioritize demands with active movements in period first
      const aHasPeriodEvent = a.isNewInPeriod || a.isConcludedInPeriod || a.hasNotesInPeriod;
      const bHasPeriodEvent = b.isNewInPeriod || b.isConcludedInPeriod || b.hasNotesInPeriod;

      if (aHasPeriodEvent && !bHasPeriodEvent) return -1;
      if (!aHasPeriodEvent && bHasPeriodEvent) return 1;

      // If both have or don't have period events, sort by latest available note date
      const timeA = a.latestNoteInPeriod
        ? a.latestNoteInPeriod.date.getTime()
        : a.latestHistoricalNote
        ? a.latestHistoricalNote.date.getTime()
        : 0;
      const timeB = b.latestNoteInPeriod
        ? b.latestNoteInPeriod.date.getTime()
        : b.latestHistoricalNote
        ? b.latestHistoricalNote.date.getTime()
        : 0;
      return timeB - timeA;
    });

    return items;
  }, [demands, startDate, endDate, ignoreImportedWithoutNotes]);

  // 3. Filtered data based on event type toggles and text search
  const filteredFortnightData = useMemo(() => {
    return rawFortnightData.filter((item) => {
      // Search filter
      if (searchFilter.trim()) {
        const queryStr = searchFilter.toLowerCase();
        const munMatch = item.demand.municipio?.toLowerCase().includes(queryStr);
        const fiscMatch = item.demand.nFiscalizacao?.toLowerCase().includes(queryStr);
        const temaMatch = item.demand.tema?.toLowerCase().includes(queryStr);
        if (!munMatch && !fiscMatch && !temaMatch) return false;
      }

      // Check event type toggles
      let matchesType = false;

      // 1. Show New (Iniciadas)
      if (showNew && item.isNewInPeriod) {
        matchesType = true;
      }

      // 2. Show Concluded (Finalizadas)
      if (showConcluded && item.isConcludedInPeriod) {
        matchesType = true;
      }

      // 3. Show Notes (Com Novos Andamentos no período)
      if (showNotes && item.hasNotesInPeriod) {
        if (hideMinorTextEdits) {
          if (item.relevantNotes.length > 0 || item.isNewInPeriod || item.isConcludedInPeriod) {
            matchesType = true;
          }
        } else {
          matchesType = true;
        }
      }

      // 4. Show Ongoing Active Demands
      if (showOngoing && item.isOngoingActive) {
        matchesType = true;
      }

      // Strict filter for minor text edits if only notes exist and all are minor and not active ongoing toggle
      if (
        hideMinorTextEdits &&
        item.hasMinorEditOnly &&
        !item.isNewInPeriod &&
        !item.isConcludedInPeriod &&
        !showOngoing
      ) {
        return false;
      }

      return matchesType;
    });
  }, [
    rawFortnightData,
    searchFilter,
    showNew,
    showConcluded,
    showNotes,
    showOngoing,
    hideMinorTextEdits,
  ]);

  // Default selection state initialization
  useEffect(() => {
    setSelectedDemandIds((prev) => {
      const updated = { ...prev };
      filteredFortnightData.forEach((item) => {
        if (updated[item.demand.id] === undefined) {
          updated[item.demand.id] = true;
        }
      });
      return updated;
    });
  }, [filteredFortnightData]);

  // Active items selected by user for presentation
  const activeFortnightData = useMemo(() => {
    return filteredFortnightData.filter((item) => selectedDemandIds[item.demand.id] !== false);
  }, [filteredFortnightData, selectedDemandIds]);

  // Metrics
  const totalUpdated = activeFortnightData.length;
  const totalNewInActive = activeFortnightData.filter((i) => i.isNewInPeriod).length;
  const totalConcludedInActive = activeFortnightData.filter((i) => i.isConcludedInPeriod).length;
  const totalNotesInActive = activeFortnightData.reduce((acc, i) => {
    const notesToCount = hideMinorTextEdits ? i.relevantNotes : i.recentNotes;
    return acc + notesToCount.length;
  }, 0);
  const totalOngoingInActive = activeFortnightData.filter((i) => i.isOngoingActive).length;

  const totalValueInPeriod = activeFortnightData.reduce((acc, i) => {
    if (i.demand.valor) {
      const val = parseBRNumber(i.demand.valor);
      return acc + (isNaN(val) ? 0 : val);
    }
    return acc;
  }, 0);

  // Slides count
  const totalSlides = Math.max(1, activeFortnightData.length + 2);

  // Generate copyable text report
  const copyableText = useMemo(() => {
    let txt = `📋 *RELATÓRIO DE MOVIMENTAÇÕES E PAINEL DE FISCALIZAÇÕES - TCEPR*\n`;
    txt += `🗓️ Período Selecionado: ${periodText}\n`;
    txt += `📊 Resumo: ${totalUpdated} fiscalizações selecionadas | ${totalNewInActive} iniciadas | ${totalConcludedInActive} concluídas | ${totalNotesInActive} novos andamentos | ${totalOngoingInActive} em andamento (estoque ativo)\n`;
    txt += `--------------------------------------------------\n\n`;

    if (activeFortnightData.length === 0) {
      txt += `Nenhuma fiscalização selecionada para a apresentação neste período.\n`;
    } else {
      activeFortnightData.forEach((item, idx) => {
        const d = item.demand;
        txt += `${idx + 1}. *[${d.municipio}]* ${d.nFiscalizacao ? `(Fisc. nº ${d.nFiscalizacao})` : ''}\n`;
        txt += `   • Status Atual: ${d.status}\n`;
        if (d.tema) txt += `   • Tema: ${d.tema}\n`;
        if (d.modalidade) txt += `   • Modalidade: ${d.modalidade}\n`;

        if (item.isNewInPeriod) txt += `   • 🟢 *Iniciada / Cadastrada no período*\n`;
        if (item.isConcludedInPeriod) txt += `   • 🔵 *Nota concluída no período*\n`;
        if (item.isOngoingActive && !item.hasNotesInPeriod && !item.isNewInPeriod) {
          txt += `   • 🟡 *Em Andamento* (Sem nova movimentação na quinzena)\n`;
        }

        const noteToDisplay =
          (hideMinorTextEdits
            ? item.latestSubstantiveNote || item.latestNoteInPeriod
            : item.latestNoteInPeriod) || item.latestHistoricalNote;

        if (noteToDisplay) {
          const noteLabel = item.hasNotesInPeriod
            ? `Último Andamento (${noteToDisplay.dateStr})`
            : `Última Posição Registrada (${noteToDisplay.dateStr})`;
          txt += `   • *${noteLabel}*: ${noteToDisplay.title}\n`;
          const cleanBody = noteToDisplay.bodyHtml.replace(/<[^>]*>/g, '').trim();
          if (cleanBody) {
            const shortBody = cleanBody.length > 220 ? cleanBody.substring(0, 220) + '...' : cleanBody;
            txt += `     "${shortBody}"\n`;
          }
        }
        txt += `\n`;
      });
    }

    txt += `--------------------------------------------------\n`;
    txt += `Gerado via Sistema de Gestão de Fiscalizações - TCEPR em ${formatPtBrDate(new Date())}\n`;
    return txt;
  }, [
    activeFortnightData,
    periodText,
    totalUpdated,
    totalNewInActive,
    totalConcludedInActive,
    totalNotesInActive,
    totalOngoingInActive,
    hideMinorTextEdits,
  ]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(copyableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleSelectDemand = (id: string) => {
    setSelectedDemandIds((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const selectAllDemands = () => {
    const updated: Record<string, boolean> = {};
    filteredFortnightData.forEach((item) => {
      updated[item.demand.id] = true;
    });
    setSelectedDemandIds(updated);
  };

  const deselectAllDemands = () => {
    const updated: Record<string, boolean> = {};
    filteredFortnightData.forEach((item) => {
      updated[item.demand.id] = false;
    });
    setSelectedDemandIds(updated);
  };

  // Save Presentation Handler
  const handleSavePresentation = async () => {
    const title = presentationTitleInput.trim() || `Apresentação ${periodText}`;
    const newSnapshot: SavedPresentation = {
      id: `pres_${Date.now()}`,
      title,
      savedAt: formatPtBrDate(new Date()) + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      periodText,
      startDateIso: startDate.toISOString(),
      endDateIso: endDate.toISOString(),
      eventTypes: {
        showNew,
        showConcluded,
        showNotes,
        showOngoing,
        hideMinorEdits: hideMinorTextEdits,
      },
      selectedDemandIds: Object.keys(selectedDemandIds).filter((id) => selectedDemandIds[id] !== false),
      demandsCount: activeFortnightData.length,
    };

    // 1. LocalStorage
    const updatedList = [newSnapshot, ...savedPresentations];
    setSavedPresentations(updatedList);
    try {
      localStorage.setItem('saved_presentations_snapshots', JSON.stringify(updatedList));
    } catch (e) {}

    // 2. Firestore Sync
    if (db) {
      try {
        const colPath = currentUser?.uid ? `users/${currentUser.uid}/saved_presentations` : 'saved_presentations';
        // Same id locally and in Firestore so delete works on both
        await setDoc(doc(db, colPath, newSnapshot.id), newSnapshot);
      } catch (err) {}
    }

    if (addToast) addToast(`Apresentação "${title}" salva com sucesso!`, 'success');
    setIsSaveModalOpen(false);
    setPresentationTitleInput('');
  };

  // Restore a saved presentation configuration
  const handleLoadSavedPresentation = (pres: SavedPresentation) => {
    try {
      setPeriodType('custom');
      if (pres.startDateIso) {
        setCustomStartDate(formatDateToIsoInput(new Date(pres.startDateIso)));
      }
      if (pres.endDateIso) {
        setCustomEndDate(formatDateToIsoInput(new Date(pres.endDateIso)));
      }

      if (pres.eventTypes) {
        setShowNew(pres.eventTypes.showNew);
        setShowConcluded(pres.eventTypes.showConcluded);
        setShowNotes(pres.eventTypes.showNotes);
        if (pres.eventTypes.showOngoing !== undefined) {
          setShowOngoing(pres.eventTypes.showOngoing);
        }
        setHideMinorTextEdits(pres.eventTypes.hideMinorEdits);
      }

      // Restore selected demand IDs
      const selectionMap: Record<string, boolean> = {};
      if (pres.selectedDemandIds && Array.isArray(pres.selectedDemandIds)) {
        pres.selectedDemandIds.forEach((id) => {
          selectionMap[id] = true;
        });
      }
      setSelectedDemandIds(selectionMap);

      if (addToast) addToast(`Apresentação "${pres.title}" carregada com sucesso!`, 'info');
      setActiveTab('report');
    } catch (e) {
      console.error('Error restoring presentation:', e);
    }
  };

  // Delete saved presentation snapshot
  const handleDeleteSavedPresentation = async (id: string) => {
    if (deletingPresId !== id) {
      setDeletingPresId(id);
      setTimeout(() => setDeletingPresId((prev) => (prev === id ? null : prev)), 4000);
      return;
    }

    const updated = savedPresentations.filter((p) => p.id !== id);
    setSavedPresentations(updated);
    try {
      localStorage.setItem('saved_presentations_snapshots', JSON.stringify(updated));
    } catch (e) {}

    if (db) {
      try {
        const colPath = currentUser?.uid ? `users/${currentUser.uid}/saved_presentations` : 'saved_presentations';
        await deleteDoc(doc(db, colPath, id));
      } catch (e) {}
    }

    if (addToast) addToast('Apresentação removida!', 'info');
    setDeletingPresId(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-white/15 rounded-xl border border-white/20 backdrop-blur-xs shrink-0">
              <SparklesIcon className="h-6 w-6 text-tcepr-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2 truncate">
                Apresentação & Relatório Executivo
                <span className="hidden sm:inline-block px-2 py-0.5 bg-tcepr-500/40 text-tcepr-100 border border-tcepr-400/30 rounded-md text-xs font-semibold">
                  TCEPR
                </span>
              </h2>
              <p className="text-xs text-tcepr-200/90 font-medium truncate">
                Acompanhamento e sintetizador de movimentações por período e tipos de eventos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl border border-emerald-500/50 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Salvar esta configuração e seleção para reutilizar em relatórios"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar Apresentação</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Imprimir ou Salvar PDF"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Period Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl border border-slate-300/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPeriodType('15d')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === '15d'
                  ? 'bg-tcepr-700 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:bg-slate-300/50'
              }`}
            >
              Últimos 15 D
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === '30d'
                  ? 'bg-tcepr-700 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:bg-slate-300/50'
              }`}
            >
              Últimos 30 D
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'month'
                  ? 'bg-tcepr-700 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:bg-slate-300/50'
              }`}
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                periodType === 'custom'
                  ? 'bg-tcepr-700 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:bg-slate-300/50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Personalizado</span>
            </button>
          </div>

          {/* Date Range or Custom Inputs */}
          <div className="flex items-center gap-2">
            {periodType === 'custom' ? (
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-tcepr-300 shadow-xs text-xs font-bold">
                <span className="text-slate-500 text-[11px]">De:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                />
                <span className="text-slate-500 text-[11px]">Até:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <CalendarIcon className="h-4 w-4 text-tcepr-600" />
                <span>
                  Espaço Temporal: <strong className="text-slate-800 font-bold">{periodText}</strong>
                </span>
              </div>
            )}

            {/* Config/Filter Toggle button */}
            <button
              type="button"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                showFilterPanel || hideMinorTextEdits
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-amber-700" />
              <span>Filtro de Tipos & Relevância</span>
              {hideMinorTextEdits && (
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              )}
            </button>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl border border-slate-300/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'bg-white text-tcepr-800 shadow-xs font-extrabold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FormIcon className="h-3.5 w-3.5 text-tcepr-600" />
              <span>Painel Executivo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('slides')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'slides'
                  ? 'bg-white text-tcepr-800 shadow-xs font-extrabold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SparklesIcon className="h-3.5 w-3.5 text-tcepr-600" />
              <span>Modo Slides ({activeFortnightData.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('copy')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'copy'
                  ? 'bg-white text-tcepr-800 shadow-xs font-extrabold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋</span>
              <span>Texto / WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-white text-tcepr-800 shadow-xs font-extrabold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5 text-tcepr-600" />
              <span>Apresentações Salvas ({savedPresentations.length})</span>
            </button>
          </div>
        </div>

        {/* EXPANDABLE RELEVANCE & EVENT TYPES PANEL */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50/90 border-b border-amber-200/80 p-4 shrink-0 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-700" />
                  <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    Controle de Tipos de Movimentação e Filtro de Relevância
                  </h4>
                </div>
                <span className="text-[11px] text-amber-800 font-medium">
                  Marque o que deseja considerar na apresentação no período ({periodText})
                </span>
              </div>

              {/* Event Type Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* 1. Show New (Iniciadas) */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={showNew}
                    onChange={(e) => setShowNew(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-800 block flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Iniciadas no Período
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-tight block mt-0.5">
                      Fiscalizações cadastradas ou com 1ª nota no espaço temporal selecionado.
                    </span>
                  </div>
                </label>

                {/* 2. Show Concluded (Finalizadas) */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={showConcluded}
                    onChange={(e) => setShowConcluded(e.target.checked)}
                    className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 accent-sky-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-800 block flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      Finalizadas / Concluídas
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-tight block mt-0.5">
                      Fiscalizações com nota concluída no período (pela data de conclusão).
                    </span>
                  </div>
                </label>

                {/* 3. Show Notes (Novos Andamentos) */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={showNotes}
                    onChange={(e) => setShowNotes(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-800 block flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Com Novos Andamentos
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-tight block mt-0.5">
                      Notas e movimentações ativas registradas nas datas do período.
                    </span>
                  </div>
                </label>

                {/* 4. Show Ongoing Active (Em Andamento) */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={showOngoing}
                    onChange={(e) => setShowOngoing(e.target.checked)}
                    className="mt-0.5 rounded text-tcepr-600 focus:ring-tcepr-500 accent-tcepr-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-800 block flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-tcepr-500" />
                      Fiscalizações em Curso (Estoque)
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-tight block mt-0.5">
                      Fiscalizações com status &quot;Fiscalização em Curso&quot;, mesmo sem nova movimentação na quinzena.
                    </span>
                  </div>
                </label>

                {/* 5. Hide Minor Text Edits */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hideMinorTextEdits}
                    onChange={(e) => setHideMinorTextEdits(e.target.checked)}
                    className="mt-0.5 rounded text-tcepr-600 focus:ring-tcepr-500 accent-tcepr-700 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-800 block">
                      Omitir Simples Correções
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-tight block mt-0.5">
                      Filtra atualizações que contêm apenas "corregido", "grafia", "ajuste de texto".
                    </span>
                  </div>
                </label>
              </div>

              {/* Advanced toggle: Ignore legacy bulk imports without notes in period */}
              <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-amber-200/80 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ignoreImportedWithoutNotes}
                    onChange={(e) => setIgnoreImportedWithoutNotes(e.target.checked)}
                    className="rounded text-tcepr-600 focus:ring-tcepr-500 accent-tcepr-700 h-4 w-4"
                  />
                  <span className="font-bold text-slate-700">
                    Ignorar dados antigos de importações sem movimentação no período
                  </span>
                </label>
                <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                  Evita que cadastros legados importados apareçam sem haver notas no período
                </span>
              </div>

              {/* Text Search Bar */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Buscar por município, número de fiscalização ou tema..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white text-xs border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tcepr-500"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="text-xs text-amber-800 hover:underline font-bold px-2"
                  >
                    Limpar busca
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Main Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* TAB 1: EXECUTIVE REPORT DASHBOARD */}
          {activeTab === 'report' && (
            <div className="space-y-6">
              {/* Stat Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Selecionadas p/ Apresentação
                  </p>
                  <p className="text-2xl font-black text-tcepr-700">
                    {activeFortnightData.length}
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      / {filteredFortnightData.length}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">fiscalizações no relatório</p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Iniciadas no Período
                  </p>
                  <p className="text-2xl font-black text-emerald-600">{totalNewInActive}</p>
                  <p className="text-[10px] text-slate-500 font-medium">novas demandas</p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Finalizadas no Período
                  </p>
                  <p className="text-2xl font-black text-sky-600">{totalConcludedInActive}</p>
                  <p className="text-[10px] text-slate-500 font-medium">concluídas no espaço temporal</p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Novos Andamentos
                  </p>
                  <p className="text-2xl font-black text-amber-600">{totalNotesInActive}</p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {hideMinorTextEdits ? 'sem edições simples' : 'todas as notas'}
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Em Andamento (Estoque)
                  </p>
                  <p className="text-2xl font-black text-tcepr-600">{totalOngoingInActive}</p>
                  <p className="text-[10px] text-slate-500 font-medium">fiscalizações ativas</p>
                </div>
              </div>

              {/* Selection Bar & Controls */}
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-700">
                    Seleção para Apresentação:
                  </span>
                  <span className="px-2 py-0.5 bg-tcepr-100 text-tcepr-800 rounded-md font-black text-[11px]">
                    {activeFortnightData.length} de {filteredFortnightData.length} marcadas
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllDemands}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-tcepr-600" />
                    <span>Marcar Todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllDemands}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>Desmarcar Todas</span>
                  </button>
                </div>
              </div>

              {/* Demand Cards List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-2">
                    <span>Fiscalizações Identificadas ({periodText})</span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-extrabold text-[11px]">
                      {filteredFortnightData.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Marque as caixas para incluir ou remover slides da apresentação
                  </span>
                </div>

                {filteredFortnightData.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                    <p className="text-sm font-bold text-slate-700">
                      Nenhuma fiscalização atendeu aos critérios de filtro aplicados no período.
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Ajuste o espaço temporal ou modifique os tipos de eventos no painel de filtros.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFortnightData.map((item) => {
                      const d = item.demand;
                      const isSelected = selectedDemandIds[d.id] !== false;
                      const noteToDisplay =
                        (hideMinorTextEdits
                          ? item.latestSubstantiveNote || item.latestNoteInPeriod
                          : item.latestNoteInPeriod) || item.latestHistoricalNote;

                      return (
                        <div
                          key={d.id}
                          className={`bg-white p-4 rounded-2xl border transition-all ${
                            isSelected
                              ? 'border-slate-200 shadow-xs hover:border-tcepr-300'
                              : 'border-slate-200/60 bg-slate-50/70 opacity-60'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                              {/* Checkbox for including in presentation */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectDemand(d.id);
                                }}
                                className={`p-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-tcepr-700 text-white border-tcepr-800'
                                    : 'bg-slate-100 text-slate-400 border-slate-300'
                                }`}
                                title={
                                  isSelected
                                    ? 'Incluído na Apresentação (Clique para remover)'
                                    : 'Removido da Apresentação (Clique para incluir)'
                                }
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                                <span className="text-[10px] font-extrabold pr-1">
                                  {isSelected ? 'Incluído' : 'Omitido'}
                                </span>
                              </button>

                              <span
                                onClick={() => onViewDemand(d)}
                                className="text-sm font-black text-slate-850 hover:text-tcepr-700 transition-colors cursor-pointer"
                              >
                                {d.municipio}
                              </span>

                              {d.nFiscalizacao && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md border border-slate-200">
                                  Fisc. nº {d.nFiscalizacao}
                                </span>
                              )}

                              {/* Event Badges */}
                              {item.isNewInPeriod && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-md border border-emerald-300 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  <span>Iniciada no Período</span>
                                </span>
                              )}

                              {item.isConcludedInPeriod && (
                                <span className="px-2 py-0.5 bg-sky-100 text-sky-800 font-extrabold text-[10px] rounded-md border border-sky-300 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
                                  <span>Concluída / Finalizada</span>
                                </span>
                              )}

                              {item.isOngoingActive && !item.hasNotesInPeriod && !item.isNewInPeriod && (
                                <span className="px-2 py-0.5 bg-tcepr-50 text-tcepr-800 font-extrabold text-[10px] rounded-md border border-tcepr-200 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-tcepr-500" />
                                  <span>Em Andamento (Sem mov. na quinzena)</span>
                                </span>
                              )}

                              {item.hasMinorEditOnly && (
                                <span
                                  className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded-md border border-amber-300 inline-flex items-center gap-1"
                                  title="Apenas correções simples de texto foram feitas nesta fiscalização."
                                >
                                  <AlertCircle className="h-3 w-3 text-amber-700" />
                                  <span>Correção de Texto</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge status={d.status} />
                              <button
                                type="button"
                                onClick={() => onViewDemand(d)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-tcepr-50 text-slate-700 hover:text-tcepr-800 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-slate-200"
                              >
                                Detalhes
                              </button>
                            </div>
                          </div>

                          {/* Details Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Tema / Objeto
                              </span>
                              <span className="font-semibold text-slate-700">
                                {d.tema || 'Não informado'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Modalidade
                              </span>
                              <span className="font-semibold text-slate-700">
                                {d.modalidade || 'Não informada'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Valor Estimado
                              </span>
                              <span className="font-bold text-slate-800">
                                {d.valor
                                  ? typeof d.valor === 'number'
                                    ? d.valor.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })
                                    : d.valor
                                  : 'Não informado'}
                              </span>
                            </div>
                          </div>

                          {/* Latest Note / Historical Note Box */}
                          {noteToDisplay ? (
                            <div className="mt-3 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-amber-600">📌</span>
                                  <span>
                                    {item.hasNotesInPeriod
                                      ? `Andamento no Período: ${noteToDisplay.title}`
                                      : `Posição Registrada Anteriormente: ${noteToDisplay.title}`}
                                  </span>
                                </span>
                                <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-mono">
                                  {noteToDisplay.dateStr}
                                </span>
                              </div>
                              <div
                                className="text-xs text-amber-950/90 line-clamp-2 prose prose-xs max-w-none font-normal"
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(noteToDisplay.bodyHtml || noteToDisplay.headerHtml),
                                }}
                              />
                            </div>
                          ) : (
                            <div className="mt-3 bg-slate-100 p-2.5 rounded-xl text-xs text-slate-500 italic">
                              Fiscalização em andamento sem movimentações descritivas cadastradas.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE SLIDES DECK MODE */}
          {activeTab === 'slides' && (
            <div className="space-y-4">
              {/* Slide Deck Container */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-10 min-h-[460px] flex flex-col justify-between shadow-2xl relative overflow-hidden border border-slate-800">
                {/* Top Slide Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-tcepr-600 text-white flex items-center justify-center font-black text-xs">
                      TC
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                        Apresentação de Status de Fiscalizações
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Tribunal de Contas do Estado do Paraná
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    Slide {currentSlideIndex + 1} de {totalSlides}
                  </div>
                </div>

                {/* SLIDE CONTENT AREA */}
                <div className="py-6 flex-1 flex flex-col justify-center">
                  {/* SLIDE 1: COVER / EXECUTIVE OVERVIEW */}
                  {currentSlideIndex === 0 && (
                    <div className="space-y-6 max-w-3xl mx-auto text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-tcepr-900/80 text-tcepr-300 border border-tcepr-700/50 rounded-full text-xs font-bold">
                        <SparklesIcon className="h-3.5 w-3.5" />
                        <span>Resumo Executivo ({periodText})</span>
                      </div>

                      <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                        Panorama de Ações e Fiscalizações
                      </h2>

                      <p className="text-sm text-slate-300 max-w-xl mx-auto font-medium">
                        Apresentação quinzenal customizada contendo fiscalizações iniciadas, concluídas e movimentações relevantes no período.
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-left">
                        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Selecionadas
                          </span>
                          <span className="text-2xl font-black text-tcepr-300">
                            {totalUpdated}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            no relatório
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Iniciadas
                          </span>
                          <span className="text-2xl font-black text-emerald-400">
                            {totalNewInActive}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            novas no período
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Concluídas
                          </span>
                          <span className="text-2xl font-black text-sky-400">
                            {totalConcludedInActive}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            finalizadas
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Andamentos
                          </span>
                          <span className="text-2xl font-black text-amber-400">
                            {totalNotesInActive}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            registros
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DEMAND SLIDES (Slide 1 to activeFortnightData.length) */}
                  {currentSlideIndex >= 1 && currentSlideIndex <= activeFortnightData.length && (
                    (() => {
                      const item = activeFortnightData[currentSlideIndex - 1];
                      const d = item.demand;
                      const noteToDisplay =
                        (hideMinorTextEdits
                          ? item.latestSubstantiveNote || item.latestNoteInPeriod
                          : item.latestNoteInPeriod) || item.latestHistoricalNote;

                      return (
                        <div className="space-y-5 max-w-3xl mx-auto w-full">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                            <div>
                              <span className="text-[10px] font-extrabold text-tcepr-400 uppercase tracking-widest block">
                                Fiscalização {currentSlideIndex} de {activeFortnightData.length}
                              </span>
                              <h3 className="text-xl sm:text-2xl font-black text-white">
                                {d.municipio} {d.nFiscalizacao ? `- Fisc. nº ${d.nFiscalizacao}` : ''}
                              </h3>
                            </div>
                            <StatusBadge status={d.status} />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/60">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                Tema
                              </span>
                              <span className="text-slate-200 font-semibold">
                                {d.tema || 'Não informado'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                Modalidade
                              </span>
                              <span className="text-slate-200 font-semibold">
                                {d.modalidade || 'Não informada'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                Valor Fiscalizado
                              </span>
                              <span className="text-slate-100 font-bold">
                                {d.valor
                                  ? typeof d.valor === 'number'
                                    ? d.valor.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })
                                    : d.valor
                                  : 'Não informado'}
                              </span>
                            </div>
                          </div>

                          {/* Recent / Historical Note Highlight Box */}
                          {noteToDisplay ? (
                            <div className="bg-slate-800/90 border border-tcepr-500/40 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-tcepr-300">
                                <span>
                                  {item.hasNotesInPeriod
                                    ? `📌 Andamento no Período: ${noteToDisplay.title}`
                                    : `📌 Posição Registrada Anteriormente: ${noteToDisplay.title}`}
                                </span>
                                <span className="bg-tcepr-900 px-2 py-0.5 rounded-md text-[10px] font-mono border border-tcepr-700">
                                  {noteToDisplay.dateStr}
                                </span>
                              </div>
                              <div
                                className="text-xs text-slate-200 prose prose-invert max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(noteToDisplay.bodyHtml || noteToDisplay.headerHtml),
                                }}
                              />
                            </div>
                          ) : (
                            <div className="bg-slate-800/60 p-4 rounded-2xl text-xs text-slate-400 italic">
                              Fiscalização em andamento sem movimentações descritivas cadastradas.
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* FINAL SLIDE: SYNTHESIS */}
                  {currentSlideIndex === totalSlides - 1 && (
                    <div className="space-y-6 max-w-2xl mx-auto text-center">
                      <div className="p-3 bg-tcepr-900/60 rounded-2xl border border-tcepr-700/50 inline-block">
                        <CheckCircle2 className="h-8 w-8 text-tcepr-300 mx-auto" />
                      </div>
                      <h3 className="text-2xl font-black text-white">
                        Sintese da Apresentação Quinzenal
                      </h3>
                      <p className="text-xs text-slate-300">
                        Acompanhamento concluído para o período de <strong>{periodText}</strong>.
                      </p>
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 text-xs text-slate-300 space-y-2 text-left">
                        <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                          <span>Fiscalizações Ativas Apresentadas:</span>
                          <strong className="text-white">{activeFortnightData.length}</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                          <span>Iniciadas / Novas:</span>
                          <strong className="text-emerald-400">{totalNewInActive}</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                          <span>Finalizadas / Concluídas:</span>
                          <strong className="text-sky-400">{totalConcludedInActive}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Andamentos Relevantes:</span>
                          <strong className="text-amber-400">{totalNotesInActive}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slide Deck Navigation Footer */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      currentSlideIndex === 0
                        ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </button>

                  {/* Dots indicator */}
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] px-2">
                    {Array.from({ length: totalSlides }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === currentSlideIndex
                            ? 'w-6 bg-tcepr-400'
                            : 'w-2 bg-slate-700 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={currentSlideIndex === totalSlides - 1}
                    onClick={() =>
                      setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1))
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      currentSlideIndex === totalSlides - 1
                        ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                        : 'bg-tcepr-600 hover:bg-tcepr-500 text-white'
                    }`}
                  >
                    <span>Próximo</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAIN TEXT / COPY WHATSAPP */}
          {activeTab === 'copy' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Relatório em Texto Formatado (WhatsApp / Email / Documento)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Copie a síntese formatada para envio rápido a diretores e equipes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-tcepr-700 hover:bg-tcepr-800 text-white shadow-xs'
                  }`}
                >
                  {copied ? <span>✓ Copiado!</span> : <span>Copiar Texto</span>}
                </button>
              </div>

              <textarea
                readOnly
                value={copyableText}
                rows={16}
                className="w-full font-mono text-xs p-4 bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {/* TAB 4: SAVED PRESENTATIONS LIST */}
          {activeTab === 'saved' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Apresentações Executivas Salvas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Histórico de instantâneos e seleções de relatórios quinzenais salvos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Salvar Apresentação Atual</span>
                </button>
              </div>

              {savedPresentations.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                  <Bookmark className="h-10 w-10 text-slate-400 mx-auto opacity-70" />
                  <p className="text-sm font-bold text-slate-700">Nenhuma apresentação salva ainda.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ao configurar seus filtros e selecionar fiscalizações para uma reunião ou quinzena, clique em "Salvar Apresentação" para guardá-la.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedPresentations.map((pres) => (
                    <div
                      key={pres.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-extrabold text-slate-800 text-sm">
                            {pres.title}
                          </h4>
                          <span className="px-2 py-0.5 bg-tcepr-100 text-tcepr-800 font-bold text-[10px] rounded-md border border-tcepr-200 shrink-0">
                            {pres.demandsCount} fiscalização(ões)
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 font-medium">
                          🗓️ Período: <strong>{pres.periodText}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Salvo em: {pres.savedAt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedPresentation(pres)}
                          className="px-3 py-1.5 bg-tcepr-700 hover:bg-tcepr-800 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Carregar Esta Apresentação</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSavedPresentation(pres.id)}
                          className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                            deletingPresId === pres.id
                              ? 'bg-rose-600 text-white font-bold px-2'
                              : 'text-rose-500 hover:bg-rose-50'
                          }`}
                        >
                          {deletingPresId === pres.id ? (
                            <span>Excluir?</span>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* SAVE PRESENTATION DIALOG MODAL */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-tcepr-600" />
                <span>Salvar Apresentação Executiva</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome / Título da Apresentação
                </label>
                <input
                  type="text"
                  placeholder={`Ex: Reunião de Diretoria - ${periodText}`}
                  value={presentationTitleInput}
                  onChange={(e) => setPresentationTitleInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-tcepr-500 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-700">Resumo a ser salvo:</p>
                <p className="text-slate-600">
                  • Espaço temporal: <strong>{periodText}</strong>
                </p>
                <p className="text-slate-600">
                  • Fiscalizações marcadas: <strong>{activeFortnightData.length} selecionadas</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePresentation}
                className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>Confirmar e Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FortnightReportModal;
