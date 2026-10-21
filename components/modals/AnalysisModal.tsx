import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import SharedMarkdownRenderer from '../MarkdownRenderer';
import { useSavedFindings } from '../../hooks/useSavedFindings';
import { copyFormattedHtml } from '../../utils/clipboard';
import { Demand, SavedFinding, SavedConsultation } from '../../types';
import { analyzeDemands, generateAuditFinding } from '../../services/geminiService';
import { extractTextFromFile, ExtractedFileResult, estimateTokens, calculateEstimatedCostBRL } from '../../utils/fileExtractor';
import { 
  LightbulbIcon, 
  XMarkIcon, 
  SparklesIcon, 
  DocumentArrowDownIcon, 
  SearchIcon, 
  ViewIcon, 
  TrashIcon, 
  CopyIcon, 
  FormIcon, 
  TagIcon,
  FolderIcon,
  CheckIcon,
  PencilIcon
} from '../icons';

interface AnalysisModalProps {
  demands: Demand[];
  db?: any;
  currentUser?: any;
  onClose: () => void;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ANALYSIS_MARKDOWN_CLASS = "prose max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed space-y-3 text-justify [&_h3]:text-tcepr-900 [&_h3]:font-bold [&_h3]:text-sm sm:[&_h3]:text-base [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-tcepr-800 [&_h4]:font-bold [&_h4]:text-xs sm:[&_h4]:text-sm [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:bg-slate-100 [&_th]:p-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-700 [&_th]:border [&_th]:border-slate-200 [&_td]:p-2.5 [&_td]:border [&_td]:border-slate-200 [&_a]:text-tcepr-600 [&_a]:font-bold [&_a:hover]:underline";

const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => (
  <SharedMarkdownRenderer text={text} className={ANALYSIS_MARKDOWN_CLASS} />
);

const AnalysisModal: React.FC<AnalysisModalProps> = ({ demands, db, currentUser, onClose, addToast }) => {
  const [activeTab, setActiveTab] = useState<'consultoria' | 'achado' | 'consultas_salvas' | 'achados_salvos'>('consultoria');
  const [question, setQuestion] = useState('');
  const [situation, setSituation] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Persistent Saved Consultations State (Directly in Firestore linked to user)
  const [savedConsultations, setSavedConsultations] = useState<SavedConsultation[]>([]);
  const [consultationSaved, setConsultationSaved] = useState(false);
  const [searchConsultationTerm, setSearchConsultationTerm] = useState('');
  const [selectedSavedConsultation, setSelectedSavedConsultation] = useState<SavedConsultation | null>(null);
  const [deletingConsultationId, setDeletingConsultationId] = useState<string | null>(null);

  // Persistent Saved Audit Findings State (Directly in Firestore linked to user)
  const { findings: savedFindings, createFinding, updateFindingTitle, deleteFinding } = useSavedFindings(db, currentUser);
  const [searchFindingTerm, setSearchFindingTerm] = useState('');
  const [selectedSavedFinding, setSelectedSavedFinding] = useState<SavedFinding | null>(null);
  const [deletingFindingId, setDeletingFindingId] = useState<string | null>(null);
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [editingFindingTitle, setEditingFindingTitle] = useState('');

  // Referenced Saved Consultations for New Query
  const [referencedConsultationIds, setReferencedConsultationIds] = useState<string[]>([]);
  const [showSavedConsultationPicker, setShowSavedConsultationPicker] = useState(false);

  // Filtering State (Default: 'ALL')
  const availableThemes = Array.from(new Set(demands.map(d => d.tema).filter((t): t is string => Boolean(t))));
  const [selectedThemes, setSelectedThemes] = useState<string[]>(['ALL']);
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>(['ALL']);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // File Upload State for Multiple Reports
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFileResult[]>([]);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [useOnlyTeamAnalysis, setUseOnlyTeamAnalysis] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitleInput, setSaveTitleInput] = useState('');

  // Load Saved Consultations directly linked to authenticated user in Firestore
  useEffect(() => {
    if (!db || !currentUser?.uid) return;

    try {
      const userConsultationsPath = `users/${currentUser.uid}/saved_consultations`;
      const colRef = collection(db, userConsultationsPath);
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const list = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            pergunta: data.pergunta,
            respostaHtml: data.respostaHtml,
            createdAt: data.createdAt,
            totalDemandsContext: data.totalDemandsContext,
            createdAtDoc: data.createdAtDoc,
          } as SavedConsultation;
        }).sort((a, b) => {
          const timeA = (a as any).createdAtDoc?.toMillis?.() || ((a as any).createdAtDoc ? new Date((a as any).createdAtDoc).getTime() : 0);
          const timeB = (b as any).createdAtDoc?.toMillis?.() || ((b as any).createdAtDoc ? new Date((b as any).createdAtDoc).getTime() : 0);
          if (timeA && timeB) return timeB - timeA;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setSavedConsultations(list);
      }, (err) => {
        console.warn('Firestore saved_consultations sync warning:', err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Error setting up saved_consultations listener:', e);
    }
  }, [db, currentUser]);

  /**
   * Single persistence path for consultations (used by the automatic save after each answer and by the
   * "Salvar" button). The same question is never stored twice: an existing record is updated instead.
   * The onSnapshot listener refreshes the list, so no local state update is needed here.
   */
  const upsertConsultation = async (
    qText: string,
    ansHtml: string,
    contextCount: number
  ): Promise<'created' | 'updated' | 'unchanged'> => {
    if (!db || !currentUser?.uid) throw new Error('Usuário não autenticado.');
    const userConsultationsPath = `users/${currentUser.uid}/saved_consultations`;
    const normalizedQuestion = qText.toLowerCase().trim();
    const existing = savedConsultations.find(c => (c.pergunta || '').toLowerCase().trim() === normalizedQuestion);

    if (existing) {
      if (existing.respostaHtml === ansHtml) return 'unchanged';
      await updateDoc(doc(db, userConsultationsPath, existing.id), {
        respostaHtml: ansHtml,
        totalDemandsContext: contextCount,
      });
      return 'updated';
    }

    await addDoc(collection(db, userConsultationsPath), {
      pergunta: qText.trim(),
      respostaHtml: ansHtml,
      createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      totalDemandsContext: contextCount,
      createdAtDoc: new Date(),
    });
    return 'created';
  };

  const handleSaveConsultation = async () => {
    if (!answer || !question || !currentUser?.uid) return;
    try {
      const result = await upsertConsultation(question, answer, filteredDemands.length);
      if (addToast) {
        addToast(
          result === 'unchanged' ? 'Esta consulta já está salva no banco de dados.'
            : result === 'updated' ? 'Consulta existente atualizada com a nova resposta.'
            : 'Consulta salva com sucesso no banco de dados do usuário!',
          result === 'unchanged' ? 'info' : 'success'
        );
      }
      setConsultationSaved(true);
      setTimeout(() => setConsultationSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed to save consultation to database:', err);
      if (addToast) addToast(`Erro ao salvar no banco de dados: ${err.message}`, 'error');
    }
  };

  const handleDeleteConsultation = async (id: string) => {
    if (deletingConsultationId !== id) {
      setDeletingConsultationId(id);
      setTimeout(() => setDeletingConsultationId(prev => prev === id ? null : prev), 4000);
      return;
    }

    if (!db || !currentUser?.uid) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/saved_consultations`, id));
      if (selectedSavedConsultation?.id === id) {
        setSelectedSavedConsultation(null);
      }
      if (addToast) addToast('Consulta removida do banco de dados.', 'info');
    } catch (e: any) {
      console.error('Failed to delete consultation from database:', e);
      if (addToast) addToast(`Erro ao excluir consulta: ${e.message}`, 'error');
    }
    setDeletingConsultationId(null);
  };

  const autoSaveConsultation = async (qText: string, ansHtml: string, contextCount: number) => {
    if (!qText || !ansHtml) return;
    try {
      await upsertConsultation(qText, ansHtml, contextCount);
    } catch (e) {
      console.warn('Could not auto-save consultation to database:', e);
    }
  };

  const handleUpdateFindingTitle = async (id: string) => {
    if (!editingFindingTitle.trim()) return;
    try {
      await updateFindingTitle(id, editingFindingTitle);
      if (addToast) addToast('Título do achado atualizado no banco de dados!', 'success');
    } catch (err: any) {
      if (addToast) addToast(`Erro ao atualizar título: ${err.message}`, 'error');
    }
    setEditingFindingId(null);
    setEditingFindingTitle('');
  };

  const handleDeleteFinding = async (id: string) => {
    // First click arms the delete; a second click within 4s confirms it
    if (deletingFindingId !== id) {
      setDeletingFindingId(id);
      setTimeout(() => setDeletingFindingId(prev => prev === id ? null : prev), 4000);
      return;
    }
    try {
      await deleteFinding(id);
      if (selectedSavedFinding?.id === id) {
        setSelectedSavedFinding(null);
      }
      if (addToast) addToast('Achado removido do banco de dados.', 'info');
    } catch (err: any) {
      if (addToast) addToast(`Erro ao excluir achado: ${err.message}`, 'error');
    }
    setDeletingFindingId(null);
  };

  // Filter demands based on selections
  const demandsAvailableForFilter = demands.filter(d => 
    selectedThemes.includes('ALL') || (d.tema && selectedThemes.includes(d.tema))
  );

  const filteredDemands = demands.filter(demand => {
    const themeMatch = selectedThemes.includes('ALL') || (demand.tema && selectedThemes.includes(demand.tema));
    const demandMatch = selectedDemandIds.includes('ALL') || selectedDemandIds.includes(demand.id);
    return themeMatch && demandMatch;
  });

  const reportsCount = filteredDemands.filter(d => d.resumoRelatorio || d.relatorioTextoCompleto).length;

  const calculatePromptTokens = () => {
    let rawContext = filteredDemands.map(d => 
      `Ano: ${d.ano}, Município: ${d.municipio}, Tema: ${d.tema || 'N/A'}, Resumo: ${d.resumoRelatorio || ''}`
    ).join('\n');
    if (activeTab === 'achado' && uploadedFiles.length > 0) {
      const filesText = uploadedFiles.map(f => (useOnlyTeamAnalysis && f.analiseDaEquipeText) ? f.analiseDaEquipeText : f.fullText).join('\n');
      rawContext += '\n' + filesText;
    }
    return estimateTokens(rawContext + (activeTab === 'consultoria' ? question : situation));
  };

  const estimatedTokensCount = calculatePromptTokens();
  const estimatedCostData = calculateEstimatedCostBRL(estimatedTokensCount, 1500);

  const handleCopyFormatted = async (textToCopy?: string) => {
    if (await copyFormattedHtml(textToCopy || answer)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenSaveModal = () => {
    if (!answer) return;

    let extractedTitle = 'Minuta de Achado de Auditoria';
    const titleMatch = answer.match(/<h3>\s*1\.[^<]*<\/h3>\s*<p>(.*?)<\/p>/i) || answer.match(/<p>(.*?)<\/p>/i);
    if (titleMatch && titleMatch[1]) {
      extractedTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    setSaveTitleInput(extractedTitle);
    setShowSaveModal(true);
  };

  const handleConfirmSaveDraft = async () => {
    if (!answer) return;

    const finalTitle = saveTitleInput.trim() || 'Minuta de Achado de Auditoria';
    setIsSavingDraft(true);
    try {
      await createFinding({
        titulo: finalTitle,
        conteudoHtml: answer,
        createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        tema: selectedThemes.includes('ALL') ? undefined : selectedThemes.join(', '),
      });
      setDraftSaved(true);
      if (addToast) addToast('Minuta de achado salva com sucesso no banco de dados do usuário!', 'success');
      setTimeout(() => setDraftSaved(false), 3000);
      setShowSaveModal(false);
    } catch (e: any) {
      console.error('Failed to save finding draft to database:', e);
      if (addToast) addToast(`Erro ao salvar no banco de dados: ${e.message}`, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const toggleTheme = (theme: string) => {
    if (theme === 'ALL') {
      setSelectedThemes(['ALL']);
      return;
    }
    let newThemes = selectedThemes.filter(t => t !== 'ALL');
    if (newThemes.includes(theme)) {
      newThemes = newThemes.filter(t => t !== theme);
    } else {
      newThemes.push(theme);
    }
    if (newThemes.length === 0 || newThemes.length === availableThemes.length) {
      setSelectedThemes(['ALL']);
    } else {
      setSelectedThemes(newThemes);
    }
  };

  const toggleDemand = (id: string) => {
    if (id === 'ALL') {
      setSelectedDemandIds(['ALL']);
      return;
    }
    let newIds = selectedDemandIds.filter(i => i !== 'ALL');
    if (newIds.includes(id)) {
      newIds = newIds.filter(i => i !== id);
    } else {
      newIds.push(id);
    }
    if (newIds.length === 0 || newIds.length === demandsAvailableForFilter.length) {
      setSelectedDemandIds(['ALL']);
    } else {
      setSelectedDemandIds(newIds);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsExtractingFile(true);
    setError('');
    try {
      const extractedList: ExtractedFileResult[] = [];
      for (const file of files) {
        const extracted = await extractTextFromFile(file);
        extractedList.push(extracted);
      }
      setUploadedFiles(prev => [...prev, ...extractedList]);
    } catch (err: any) {
      setError(`Erro ao ler arquivo(s): ${err.message}`);
    } finally {
      setIsExtractingFile(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalysis = async () => {
    if (activeTab === 'consultoria') {
      if (!question.trim()) {
        setError("Por favor, digite uma dúvida ou pergunta para analisar.");
        return;
      }

      setIsLoading(true);
      setAnswer('');
      setError('');
      try {
        let questionToSubmit = question.trim();

        if (referencedConsultationIds.length > 0) {
          const referencedItems = savedConsultations.filter(sc => referencedConsultationIds.includes(sc.id));
          if (referencedItems.length > 0) {
            const referencesFormatted = referencedItems.map((sc, idx) => {
              const cleanAns = sc.respostaHtml.replace(/<[^>]+>/g, '').trim();
              return `--- CONSULTA ANTERIOR DE REFERÊNCIA ${idx + 1} (${sc.createdAt}) ---\nPERGUNTA ANTERIOR: ${sc.pergunta}\nRESPOSTA ANTERIOR: ${cleanAns}`;
            }).join('\n\n');

            questionToSubmit = `[CONSULTA(S) SALVA(S) ANTERIOR(ES) ANEXADA(S) PELO USUÁRIO COMO REFERÊNCIA DE CONTEXTO]:\n${referencesFormatted}\n\n=========================================\nNOVA PERGUNTA DO USUÁRIO LEVANDO EM CONTA AS CONSULTAS ANTERIORES ACIMA:\n${question.trim()}`;
          }
        }

        const result = await analyzeDemands(questionToSubmit, filteredDemands);
        setAnswer(result);

        // Auto-save consultation directly to user's Firestore database
        await autoSaveConsultation(question.trim(), result, filteredDemands.length);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else if (activeTab === 'achado') {
      if (!situation.trim()) {
        setError("Por favor, descreva a situação encontrada para a elaboração do achado.");
        return;
      }

      setIsLoading(true);
      setAnswer('');
      setError('');
      try {
        let reportTextToPass = '';
        if (uploadedFiles.length > 0) {
          reportTextToPass = uploadedFiles.map(f => {
            const content = (useOnlyTeamAnalysis && f.analiseDaEquipeText) ? f.analiseDaEquipeText : f.fullText;
            return `=== CONTEÚDO DO DOCUMENTO: ${f.fileName} ===\n${content}`;
          }).join('\n\n');
        }

        const result = await generateAuditFinding(situation, filteredDemands, reportTextToPass);
        setAnswer(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex justify-center items-center p-3 sm:p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 text-slate-800"
      >
        {/* Unified Institutional TCE-PR Header */}
        <div className="p-5 md:p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
          <div>
            <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
              <LightbulbIcon className="text-tcepr-100 h-6 w-6" /> 
              <span>Consultoria & Inteligência de Auditoria com IA</span>
            </h3>
            <p className="text-xs text-tcepr-100/90 mt-1">
              Base de dados ativa com <strong className="text-white">{demands.length}</strong> fiscalizações e <strong className="text-white">{reportsCount}</strong> resumos de relatório técnicos vinculados ao usuário.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Unified Sub Menu Tabs Bar */}
        <div className="mx-6 mt-4 space-y-2">
          <div className="flex flex-wrap border border-slate-200/90 bg-slate-100/90 p-1.5 gap-1.5 rounded-xl shadow-2xs">
            <button
              onClick={() => { setActiveTab('consultoria'); setError(''); }}
              className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'consultoria' 
                  ? 'bg-tcepr-700 text-white shadow-xs border border-tcepr-800' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <LightbulbIcon className={`h-4 w-4 ${activeTab === 'consultoria' ? 'text-amber-300' : 'text-amber-500'}`} />
              <span>Análise & Perguntas (IA)</span>
            </button>
            <button
              onClick={() => { setActiveTab('achado'); setError(''); }}
              className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'achado' 
                  ? 'bg-tcepr-700 text-white shadow-xs border border-tcepr-800' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <SparklesIcon className={`h-4 w-4 ${activeTab === 'achado' ? 'text-tcepr-200' : 'text-tcepr-600'}`} />
              <span>Gerador de Achado</span>
            </button>
            <button
              onClick={() => { setActiveTab('consultas_salvas'); setError(''); }}
              className={`flex-1 min-w-[160px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'consultas_salvas' 
                  ? 'bg-emerald-700 text-white shadow-xs border border-emerald-800' 
                  : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50'
              }`}
            >
              <span>📚 Consultas Salvas</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'consultas_salvas' ? 'bg-emerald-200 text-emerald-950' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {savedConsultations.length} no banco
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('achados_salvos'); setError(''); }}
              className={`flex-1 min-w-[160px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'achados_salvos' 
                  ? 'bg-tcepr-750 text-white shadow-xs border border-tcepr-900' 
                  : 'text-tcepr-800 hover:text-tcepr-950 hover:bg-tcepr-50'
              }`}
            >
              <span>📑 Achados Salvos</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'achados_salvos' ? 'bg-amber-200 text-amber-950' : 'bg-tcepr-100 text-tcepr-900'
              }`}>
                {savedFindings.length} no banco
              </span>
            </button>
          </div>

          {/* Context Filter Selector (For consultoria & achado tabs) */}
          {(activeTab === 'consultoria' || activeTab === 'achado') && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-700 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800">Filtro de Contexto:</span>
                  <span className="bg-tcepr-100 text-tcepr-800 font-bold px-2 py-0.5 rounded-full text-[11px]">
                    {filteredDemands.length} de {demands.length} fiscalizações
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                    <SparklesIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>~{estimatedTokensCount.toLocaleString('pt-BR')} tokens</span>
                    <span className="text-emerald-700 font-normal">| Custo est.: R$ {estimatedCostData.totalCost < 0.001 ? '< 0,001' : estimatedCostData.totalCost.toFixed(4)}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    • Armazenamento persistente no Firestore
                  </span>
                </div>
                <button
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className="text-tcepr-700 hover:text-tcepr-900 font-bold text-[11px] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{showFilterPanel ? 'Ocultar Filtros ▲' : 'Filtrar Temas e Fiscalizações ▼'}</span>
                </button>
              </div>

              {showFilterPanel && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
                  <div>
                    <span className="block font-bold text-slate-600 mb-1 text-[11px] uppercase tracking-wider">1. Filtrar por Tema:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => toggleTheme('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${selectedThemes.includes('ALL') ? 'bg-tcepr-700 text-white font-bold' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Todos os Temas ({availableThemes.length})
                      </button>
                      {availableThemes.map(t => {
                        const isSelected = selectedThemes.includes('ALL') || selectedThemes.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => toggleTheme(t)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${isSelected ? 'bg-tcepr-100 text-tcepr-900 border border-tcepr-300 font-semibold' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block font-bold text-slate-600 mb-1 text-[11px] uppercase tracking-wider">
                      2. Filtrar por Fiscalização / Município ({demandsAvailableForFilter.length} disponíveis no tema):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      <button
                        onClick={() => toggleDemand('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${selectedDemandIds.includes('ALL') ? 'bg-tcepr-700 text-white font-bold' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Todas do Tema ({demandsAvailableForFilter.length})
                      </button>
                      {demandsAvailableForFilter.map(d => {
                        const isSelected = selectedDemandIds.includes('ALL') || selectedDemandIds.includes(d.id);
                        const label = `Fisc. ${d.nFiscalizacao || 'S/N'} - ${d.municipio}${d.tema ? ` (${d.tema})` : ''}`;
                        return (
                          <button
                            key={d.id}
                            onClick={() => toggleDemand(d.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${isSelected ? 'bg-tcepr-100 text-tcepr-900 border border-tcepr-300 font-semibold' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'consultoria' ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Faça perguntas de negócio ou auditoria cruzada sobre os dados das demandas registradas. O modelo analisará o contexto completo do banco de dados para gerar respostas técnicas e estruturadas.
              </p>

              {/* Reference Saved Consultations Bar */}
              {savedConsultations.length > 0 && (
                <div className="p-3.5 bg-tcepr-50/70 border border-tcepr-200/80 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-tcepr-950 flex items-center gap-1.5">
                      <TagIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                      <span>Referenciar Consultas Salvas nesta Pergunta:</span>
                      {referencedConsultationIds.length > 0 && (
                        <span className="bg-tcepr-700 text-white font-black text-[10px] px-2 py-0.5 rounded-full">
                          {referencedConsultationIds.length} anexada(s)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSavedConsultationPicker(!showSavedConsultationPicker)}
                      className="text-xs font-bold text-tcepr-700 hover:text-tcepr-900 bg-white hover:bg-tcepr-100/60 px-2.5 py-1 rounded-lg border border-tcepr-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>{showSavedConsultationPicker ? 'Ocultar Seleção ▲' : '+ Selecionar Consulta Salva ▼'}</span>
                    </button>
                  </div>

                  {referencedConsultationIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {referencedConsultationIds.map(id => {
                        const sc = savedConsultations.find(c => c.id === id);
                        if (!sc) return null;
                        return (
                          <div key={id} className="bg-white border border-tcepr-300 text-tcepr-950 text-xs px-2.5 py-1 rounded-lg flex items-center gap-2 font-semibold shadow-2xs">
                            <span className="truncate max-w-[280px]">💬 "{sc.pergunta}"</span>
                            <button
                              type="button"
                              onClick={() => setReferencedConsultationIds(prev => prev.filter(i => i !== id))}
                              className="text-tcepr-400 hover:text-rose-600 font-bold hover:bg-rose-50 rounded px-1 cursor-pointer"
                              title="Remover referência"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showSavedConsultationPicker && (
                    <div className="mt-2 pt-2 border-t border-tcepr-200 space-y-2 animate-in fade-in duration-150">
                      <p className="text-[11px] text-tcepr-800">
                        Marque as consultas salvas que você quer considerar como histórico/contexto para a nova pergunta:
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {savedConsultations.map(sc => {
                          const isAttached = referencedConsultationIds.includes(sc.id);
                          return (
                            <label
                              key={sc.id}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                isAttached
                                  ? 'bg-tcepr-100/90 border-tcepr-400 text-tcepr-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-tcepr-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isAttached}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setReferencedConsultationIds(prev => [...prev, sc.id]);
                                    } else {
                                      setReferencedConsultationIds(prev => prev.filter(i => i !== sc.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-tcepr-600 focus:ring-tcepr-500 h-4 w-4 shrink-0"
                                />
                                <span className="truncate">{sc.pergunta}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">{sc.createdAt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <textarea 
                  value={question} 
                  onChange={(e) => setQuestion(e.target.value)} 
                  placeholder={referencedConsultationIds.length > 0 
                    ? "Digite sua nova pergunta considerando a(s) consulta(s) de referência anexada(s)..." 
                    : "Ex: Tendo em vista as auditorias anteriores, quais fiscalizações possuem apontamentos em educação ou saúde?"} 
                  rows={3} 
                  className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-tcepr-500 focus:border-tcepr-500 text-sm focus:outline-none transition-all placeholder:text-slate-400"
                ></textarea>
              </div>
            </>
          ) : activeTab === 'achado' ? (
            <>
              <div className="p-3.5 bg-tcepr-50 border border-tcepr-100 rounded-xl text-xs text-tcepr-900 leading-relaxed space-y-1">
                <p><strong>💡 Como funciona:</strong> O gerador cria um texto técnico de Achado de Auditoria público e impessoal. Nomes de municípios ou processos anteriores <strong>não</strong> serão citados no texto público; somente as teses técnicas e fundamentações normativas serão aplicadas.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">1. Descreva a Situação / Irregularidade Encontrada</label>
                <textarea 
                  value={situation} 
                  onChange={(e) => setSituation(e.target.value)} 
                  placeholder="Ex: Verificou-se ausência de liquidação prévia de despesas e pagamento antecipado no fornecimento de transporte escolar rural, além de falta de fiscalização do contrato..." 
                  rows={3} 
                  className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-tcepr-500 focus:border-tcepr-500 text-sm focus:outline-none transition-all placeholder:text-slate-400"
                ></textarea>
              </div>

              {/* Multiple Reports Upload Area */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>2. Anexar Relatório(s) em PDF, DOCX ou TXT (Opcional)</span>
                  <span className="text-[10px] text-tcepr-700 font-semibold">Pode anexar múltiplos relatórios</span>
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {uploadedFiles.map((f, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">📄 {f.fileName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {f.analiseDaEquipeText ? (
                              <span className="text-emerald-700 font-semibold">✓ Seção "Análise da Equipe" isolada ({f.analiseDaEquipeTokens.toLocaleString('pt-BR')} tokens)</span>
                            ) : (
                              <span>Texto completo ({f.totalTokens.toLocaleString('pt-BR')} tokens)</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover arquivo"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative border-2 border-dashed border-slate-200 hover:border-tcepr-400 rounded-xl p-4 text-center cursor-pointer transition-colors group">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2">
                    <DocumentArrowDownIcon className="h-5 w-5 text-slate-400 group-hover:text-tcepr-600 transition-colors" />
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-tcepr-700">
                      {isExtractingFile 
                        ? 'Lendo e extraindo texto dos relatórios...' 
                        : uploadedFiles.length > 0 
                          ? '+ Clique para anexar mais documentos (PDF, DOCX, TXT)' 
                          : 'Clique ou arraste um ou mais relatórios em PDF, DOCX ou TXT'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'consultas_salvas' ? (
            /* Tab 3: Consultas Salvas no Banco */
            <div className="space-y-4">
              {/* Firestore User Database Connection Status Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-tcepr-50 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <SparklesIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                        <span>Banco de Dados de Consultas da Auditoria</span>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                          Firestore • Sincronizado
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Vinculado exclusivamente à conta <strong>{currentUser?.email || 'do usuário'}</strong> • Persistência permanente em nuvem
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-100/80">
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100/90 text-center shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Total Gravado no Banco</span>
                    <span className="text-base font-black text-slate-800">{savedConsultations.length}</span>
                    <span className="block text-[9px] text-slate-400">consultas disponíveis</span>
                  </div>
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100/90 text-center shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Status de Armazenamento</span>
                    <span className="text-base font-black text-emerald-700">100% Ativo</span>
                    <span className="block text-[9px] text-slate-400">isolamento por usuário</span>
                  </div>
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100/90 text-center shadow-2xs col-span-2 sm:col-span-1">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Reutilização Imediata</span>
                    <span className="text-base font-black text-tcepr-700">0 Tokens</span>
                    <span className="block text-[9px] text-slate-400">sem novo custo de IA</span>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchConsultationTerm}
                    onChange={(e) => setSearchConsultationTerm(e.target.value)}
                    placeholder="Pesquisar em consultas salvas no banco..."
                    className="pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  {savedConsultations.length} consultas no banco
                </span>
              </div>

              {savedConsultations.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <FormIcon className="h-10 w-10 mx-auto text-emerald-600 opacity-80" />
                  <h4 className="font-bold text-slate-700 text-sm">Nenhuma consulta salva ainda no banco de dados</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ao realizar perguntas na aba <strong>"Análise & Perguntas"</strong>, as consultas são gravadas automaticamente no banco de dados para reconsulta instantânea.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {savedConsultations
                    .filter(c => 
                      c.pergunta.toLowerCase().includes(searchConsultationTerm.toLowerCase()) || 
                      c.respostaHtml.toLowerCase().includes(searchConsultationTerm.toLowerCase())
                    )
                    .map(c => (
                      <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2 hover:border-emerald-300 transition-all">
                        <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                            💬 {c.pergunta}
                          </h4>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {c.createdAt}
                          </span>
                        </div>

                        {/* Preview */}
                        <div 
                          className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-lg font-sans leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.respostaHtml) }}
                        />

                        <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
                          <button 
                            onClick={() => {
                              setSelectedSavedConsultation(c);
                            }}
                            className="text-xs font-bold text-tcepr-600 hover:text-tcepr-800 cursor-pointer flex items-center gap-1"
                          >
                            <ViewIcon className="h-3.5 w-3.5" />
                            <span>Ver Resposta Completa</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (!referencedConsultationIds.includes(c.id)) {
                                  setReferencedConsultationIds(prev => [...prev, c.id]);
                                }
                                setActiveTab('consultoria');
                                if (addToast) addToast(`Consulta anexada como referência para a nova pergunta!`, 'info');
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-tcepr-50 hover:bg-tcepr-100 text-tcepr-800 border border-tcepr-200 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                              title="Usar esta consulta como referência/contexto para uma nova pergunta"
                            >
                              <TagIcon className="h-3.5 w-3.5 text-tcepr-600 shrink-0" />
                              <span>Referenciar na Pergunta</span>
                            </button>
                            <button 
                              onClick={() => {
                                setQuestion(c.pergunta);
                                setAnswer(c.respostaHtml);
                                setActiveTab('consultoria');
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                              title="Carregar resposta no painel principal"
                            >
                              Carregar no Consultor
                            </button>
                            <button 
                              onClick={() => handleDeleteConsultation(c.id)}
                              className={`px-2 py-1 text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center ${
                                deletingConsultationId === c.id 
                                  ? 'bg-rose-600 text-white font-bold animate-pulse px-2' 
                                  : 'text-rose-500 hover:bg-rose-50 p-1.5'
                              }`}
                            >
                              {deletingConsultationId === c.id ? (
                                <span>Excluir?</span>
                              ) : (
                                <TrashIcon className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* Tab 4: Achados Salvos no Banco */
            <div className="space-y-4">
              {/* Firestore User Database Saved Findings Banner */}
              <div className="bg-gradient-to-r from-amber-50 via-tcepr-50 to-slate-50 border border-amber-200/80 rounded-2xl p-4 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <FolderIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                        <span>Banco de Minutas de Achados Salvas</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                          Firestore • Sincronizado
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Vinculado à conta <strong>{currentUser?.email || 'do usuário'}</strong> • Teses técnicas padronizadas e prontas para uso
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-amber-100/80">
                  <div className="bg-white/90 rounded-xl p-2.5 border border-amber-100/90 text-center shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Achados Salvos</span>
                    <span className="text-base font-black text-slate-800">{savedFindings.length}</span>
                    <span className="block text-[9px] text-slate-400">minutas no banco</span>
                  </div>
                  <div className="bg-white/90 rounded-xl p-2.5 border border-amber-100/90 text-center shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Segurança & Nuvem</span>
                    <span className="text-base font-black text-emerald-700">Persistente</span>
                    <span className="block text-[9px] text-slate-400">salvo no banco de dados</span>
                  </div>
                  <div className="bg-white/90 rounded-xl p-2.5 border border-amber-100/90 text-center shadow-2xs col-span-2 sm:col-span-1">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Compatibilidade</span>
                    <span className="text-base font-black text-tcepr-700">Word / Relatório</span>
                    <span className="block text-[9px] text-slate-400">cópia formatada direta</span>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchFindingTerm}
                    onChange={(e) => setSearchFindingTerm(e.target.value)}
                    placeholder="Pesquisar minutas de achados salvas por título ou texto..."
                    className="pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full focus:ring-2 focus:ring-tcepr-500 focus:outline-none"
                  />
                </div>
                <span className="text-xs font-bold text-tcepr-800 bg-tcepr-50 px-3 py-1.5 rounded-lg border border-tcepr-200">
                  {savedFindings.length} achados no banco
                </span>
              </div>

              {savedFindings.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <FolderIcon className="h-10 w-10 mx-auto text-amber-600 opacity-80" />
                  <h4 className="font-bold text-slate-700 text-sm">Nenhum achado salvo ainda no banco de dados</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ao gerar um achado na aba <strong>"Gerador de Achado"</strong>, clique em <strong>"Salvar Minuta Padrão"</strong> para arquivá-lo permanentemente no banco.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {savedFindings
                    .filter(f => 
                      f.titulo.toLowerCase().includes(searchFindingTerm.toLowerCase()) || 
                      f.conteudoHtml.toLowerCase().includes(searchFindingTerm.toLowerCase()) ||
                      (f.tema && f.tema.toLowerCase().includes(searchFindingTerm.toLowerCase()))
                    )
                    .map(f => (
                      <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5 hover:border-amber-300 transition-all">
                        <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                          {editingFindingId === f.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editingFindingTitle}
                                onChange={(e) => setEditingFindingTitle(e.target.value)}
                                className="flex-1 p-1.5 text-xs border border-tcepr-400 rounded-lg font-bold"
                              />
                              <button
                                onClick={() => handleUpdateFindingTitle(f.id)}
                                className="px-2.5 py-1 text-xs bg-emerald-600 text-white font-bold rounded-lg cursor-pointer hover:bg-emerald-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingFindingId(null)}
                                className="px-2.5 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-300"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                                📑 {f.titulo}
                              </h4>
                              <button
                                onClick={() => {
                                  setEditingFindingId(f.id);
                                  setEditingFindingTitle(f.titulo);
                                }}
                                className="text-slate-400 hover:text-tcepr-700 p-0.5 rounded cursor-pointer"
                                title="Editar título"
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {f.tema && (
                              <span className="text-[10px] bg-tcepr-50 text-tcepr-800 px-2 py-0.5 rounded-full border border-tcepr-200 font-bold">
                                {f.tema}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {f.createdAt}
                            </span>
                          </div>
                        </div>

                        {/* Preview */}
                        <div 
                          className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-lg font-sans leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(f.conteudoHtml) }}
                        />

                        <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                          <button 
                            onClick={() => setSelectedSavedFinding(f)}
                            className="text-xs font-bold text-tcepr-600 hover:text-tcepr-800 cursor-pointer flex items-center gap-1"
                          >
                            <ViewIcon className="h-3.5 w-3.5" />
                            <span>Ver Minuta Completa</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyFormatted(f.conteudoHtml)}
                              className="px-2.5 py-1 text-xs font-bold bg-tcepr-50 hover:bg-tcepr-100 text-tcepr-800 border border-tcepr-200 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                              title="Copiar texto formatado para o Microsoft Word"
                            >
                              <CopyIcon className="h-3.5 w-3.5 text-tcepr-600 shrink-0" />
                              <span>Copiar p/ Word</span>
                            </button>
                            <button 
                              onClick={() => {
                                setSituation(f.titulo);
                                setAnswer(f.conteudoHtml);
                                setActiveTab('achado');
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                              title="Carregar achado no Gerador"
                            >
                              Carregar no Gerador
                            </button>
                            <button 
                              onClick={() => handleDeleteFinding(f.id)}
                              className={`px-2 py-1 text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center ${
                                deletingFindingId === f.id 
                                  ? 'bg-rose-600 text-white font-bold animate-pulse px-2' 
                                  : 'text-rose-500 hover:bg-rose-50 p-1.5'
                              }`}
                            >
                              {deletingFindingId === f.id ? (
                                <span>Excluir?</span>
                              ) : (
                                <TrashIcon className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Action Button (Only for Consultoria & Achado) */}
          {(activeTab === 'consultoria' || activeTab === 'achado') && (
            <button 
              onClick={handleAnalysis} 
              disabled={isLoading || isExtractingFile} 
              className={`w-full px-5 py-3 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer ${
                activeTab === 'consultoria' 
                  ? 'bg-tcepr-700 hover:bg-tcepr-800 shadow-tcepr-800/15' 
                  : 'bg-gradient-to-r from-tcepr-700 to-tcepr-900 hover:from-tcepr-800 hover:to-slate-900 shadow-tcepr-800/15'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {activeTab === 'consultoria' ? 'Cruzando dados das demandas com IA...' : 'Sintetizando e Redigindo Achado de Auditoria...'}
                </span>
              ) : activeTab === 'consultoria' ? (
                'Fazer Pergunta ao Consultor de Auditoria'
              ) : (
                'Gerar Texto de Achado de Auditoria'
              )}
            </button>
          )}
          
          {/* Answer Box (For Consultoria & Achado) */}
          {(activeTab === 'consultoria' || activeTab === 'achado') && (
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {activeTab === 'consultoria' ? 'Resposta do Consultor Inteligente' : 'Minuta do Achado de Auditoria (IA)'}
                </label>
                {answer && (
                  <div className="flex items-center gap-2">
                    {activeTab === 'consultoria' && (
                      <button
                        onClick={handleSaveConsultation}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          consultationSaved 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                        title="Salvar consulta no banco de dados para consulta posterior"
                      >
                        <span>{consultationSaved ? '✓ Salva no Banco!' : '💾 Salvar Consulta no Banco'}</span>
                      </button>
                    )}
                    {activeTab === 'achado' && (
                      <button
                        onClick={handleOpenSaveModal}
                        disabled={isSavingDraft}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          draftSaved 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        title="Salvar esta minuta no banco de dados"
                      >
                        <span>{draftSaved ? '✓ Achado Salvo no Banco!' : '💾 Salvar Minuta Padrão no Banco'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyFormatted()}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        copied 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-tcepr-50 hover:bg-tcepr-100 text-tcepr-700 border border-tcepr-200'
                      }`}
                      title="Copia o texto com formatação para o Microsoft Word"
                    >
                      {copied ? (
                        <span>✓ Copiado com Formatação!</span>
                      ) : (
                        <>
                          <CopyIcon className="h-3.5 w-3.5" />
                          <span>Copiar para Word</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5 bg-slate-50/50 rounded-xl border border-slate-200/80 min-h-[200px] max-h-[550px] overflow-y-auto relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col justify-center items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-tcepr-600 border-t-transparent"></div>
                    <span className="text-xs text-slate-400 font-medium animate-pulse">
                      {activeTab === 'consultoria' ? 'Cruzando os dados das demandas no banco...' : 'Analisando relatórios e elaborando fundamentação...'}
                    </span>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2 shadow-2xs">
                    <p className="font-bold text-sm text-rose-700 flex items-center gap-1.5">
                      <span>⚠️ Não foi possível concluir a análise</span>
                    </p>
                    <p className="leading-relaxed font-medium">{error}</p>
                  </div>
                ) : answer ? (
                  <MarkdownRenderer text={answer} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400">
                    <LightbulbIcon className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs">
                      {activeTab === 'consultoria' ? 'Aguardando sua pergunta...' : 'Preencha a situação e clique no botão acima para gerar o achado.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Selected Saved Consultation Full Modal Viewer */}
      {selectedSavedConsultation && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
              <div>
                <h3 className="font-bold text-white text-sm">💬 {selectedSavedConsultation.pergunta}</h3>
                <span className="text-[10px] text-tcepr-200">Salva no banco de dados em {selectedSavedConsultation.createdAt}</span>
              </div>
              <button 
                onClick={() => setSelectedSavedConsultation(null)}
                className="p-1.5 text-tcepr-200 hover:text-white rounded-lg cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <MarkdownRenderer text={selectedSavedConsultation.respostaHtml} />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => handleCopyFormatted(selectedSavedConsultation.respostaHtml)}
                className="px-3 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Copiar p/ Word</span>
              </button>
              <button 
                onClick={() => {
                  if (!referencedConsultationIds.includes(selectedSavedConsultation.id)) {
                    setReferencedConsultationIds(prev => [...prev, selectedSavedConsultation.id]);
                  }
                  setSelectedSavedConsultation(null);
                  setActiveTab('consultoria');
                  if (addToast) addToast(`Consulta anexada como referência para a nova pergunta!`, 'info');
                }}
                className="px-4 py-2 text-xs font-bold bg-tcepr-50 hover:bg-tcepr-100 text-tcepr-800 border border-tcepr-200 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <TagIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                <span>Referenciar na Pergunta</span>
              </button>
              <button 
                onClick={() => {
                  setQuestion(selectedSavedConsultation.pergunta);
                  setAnswer(selectedSavedConsultation.respostaHtml);
                  setSelectedSavedConsultation(null);
                  setActiveTab('consultoria');
                }}
                className="px-4 py-2 text-xs font-bold bg-tcepr-700 text-white rounded-xl hover:bg-tcepr-800 cursor-pointer"
              >
                Carregar no Consultor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Saved Finding Full Modal Viewer */}
      {selectedSavedFinding && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
              <div>
                <h3 className="font-bold text-white text-sm">📑 {selectedSavedFinding.titulo}</h3>
                <span className="text-[10px] text-tcepr-200">Salva no banco de dados em {selectedSavedFinding.createdAt}</span>
              </div>
              <button 
                onClick={() => setSelectedSavedFinding(null)}
                className="p-1.5 text-tcepr-200 hover:text-white rounded-lg cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <MarkdownRenderer text={selectedSavedFinding.conteudoHtml} />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => handleCopyFormatted(selectedSavedFinding.conteudoHtml)}
                className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Copiar p/ Word</span>
              </button>
              <button 
                onClick={() => {
                  setSituation(selectedSavedFinding.titulo);
                  setAnswer(selectedSavedFinding.conteudoHtml);
                  setSelectedSavedFinding(null);
                  setActiveTab('achado');
                }}
                className="px-4 py-2 text-xs font-bold bg-tcepr-700 text-white rounded-xl hover:bg-tcepr-800 cursor-pointer"
              >
                Carregar no Gerador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Draft Custom Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>💾 Salvar Minuta Padrão de Achado no Banco</span>
              </h3>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Defina o título do achado para arquivá-lo no banco de dados e reutilizá-lo em novas auditorias:
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Título do Achado (Item 1):</label>
              <input 
                type="text" 
                value={saveTitleInput}
                onChange={(e) => setSaveTitleInput(e.target.value)}
                placeholder="Ex: Pagamento Antecipado de Despesas sem Liquidação Prévia"
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-tcepr-500 focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmSaveDraft}
                disabled={isSavingDraft}
                className="px-4 py-2 text-xs font-bold bg-tcepr-700 hover:bg-tcepr-800 text-white rounded-xl shadow-md cursor-pointer transition-all"
              >
                {isSavingDraft ? 'Salvando...' : '💾 Salvar no Banco de Dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AnalysisModal;
