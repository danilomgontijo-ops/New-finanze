import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { XMarkIcon, PlusCircleIcon, ClockIcon, TagIcon, SparklesIcon, TrashIcon, PencilIcon } from '../icons';
import TiptapEditor from '../tiptap/TiptapEditor';
import { formatIsoInputDate, formatPtBrDate, parsePtBrDate, serializeObservationsToHtml } from '../../utils/deadlineUtils';

export interface EditingNoteData {
  index: number;
  date?: Date;
  dateStr?: string;
  title?: string;
  prazoDias?: number | null;
  bodyHtml?: string;
  isConcluded?: boolean;
  concludedDateStr?: string;
}

interface AddObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddObservation: (formattedHtml: string) => void;
  editingNote?: EditingNoteData | null;
}

const DEFAULT_TITLES = [
  'Solicitação de Documentos e Informações',
  'Diligência no Município',
  'Notificação de Irregularidades',
  'Análise de Justificativas e Parecer',
  'Envio de Ofício Requisitório',
  'Aguardando Resposta do Órgão Auditado'
];

const DEFAULT_DEADLINES = [15, 20, 30, 45, 60];

const TITLES_STORAGE_KEY = 'fiscalizacao_saved_obs_titles';
const DEADLINES_STORAGE_KEY = 'fiscalizacao_saved_obs_deadlines';

export const AddObservationModal: React.FC<AddObservationModalProps> = ({
  isOpen,
  onClose,
  onAddObservation,
  editingNote,
}) => {
  const [dataObs, setDataObs] = useState<string>(() => {
    return formatIsoInputDate();
  });
  const [titulo, setTitulo] = useState<string>('');
  const [prazoDias, setPrazoDias] = useState<number>(30);
  const [semPrazo, setSemPrazo] = useState<boolean>(false);
  const [detalhes, setDetalhes] = useState<string>('');

  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  const [savedDeadlines, setSavedDeadlines] = useState<number[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState<boolean>(false);

  // Load saved memory from localStorage and populate editing values
  useEffect(() => {
    try {
      const storedTitles = localStorage.getItem(TITLES_STORAGE_KEY);
      if (storedTitles) {
        setSavedTitles(JSON.parse(storedTitles));
      } else {
        setSavedTitles(DEFAULT_TITLES);
        localStorage.setItem(TITLES_STORAGE_KEY, JSON.stringify(DEFAULT_TITLES));
      }

      const storedDeadlines = localStorage.getItem(DEADLINES_STORAGE_KEY);
      if (storedDeadlines) {
        setSavedDeadlines(JSON.parse(storedDeadlines));
      } else {
        setSavedDeadlines(DEFAULT_DEADLINES);
        localStorage.setItem(DEADLINES_STORAGE_KEY, JSON.stringify(DEFAULT_DEADLINES));
      }
    } catch (e) {
      setSavedTitles(DEFAULT_TITLES);
      setSavedDeadlines(DEFAULT_DEADLINES);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        const noteDate = editingNote.date && !isNaN(editingNote.date.getTime())
          ? editingNote.date
          : parsePtBrDate(editingNote.dateStr || '');
        setDataObs(formatIsoInputDate(noteDate || new Date()));

        setTitulo(editingNote.title || '');
        if (editingNote.prazoDias !== null && editingNote.prazoDias !== undefined) {
          setSemPrazo(false);
          setPrazoDias(editingNote.prazoDias);
        } else {
          setSemPrazo(true);
          setPrazoDias(30);
        }
        setDetalhes(editingNote.bodyHtml || '');
      } else {
        setDataObs(formatIsoInputDate());
        setTitulo('');
        setSemPrazo(false);
        setPrazoDias(30);
        setDetalhes('');
      }
    }
    // Depend on the note index, not the object: the parent recreates editingNote on every render,
    // which would reset the fields while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingNote?.index]);

  if (!isOpen) return null;

  const handleSelectTitle = (selectedTitle: string) => {
    setTitulo(selectedTitle);
    setShowTitleSuggestions(false);
  };

  const handleSelectDeadline = (days: number | null) => {
    if (days === null) {
      setSemPrazo(true);
    } else {
      setSemPrazo(false);
      setPrazoDias(days);
    }
  };

  const handleRemoveTitleFromMemory = (e: React.MouseEvent, titleToRemove: string) => {
    e.stopPropagation();
    const updated = savedTitles.filter((t) => t !== titleToRemove);
    setSavedTitles(updated);
    try {
      localStorage.setItem(TITLES_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const titleTrimmed = titulo.trim() || 'Nova Observação';
    
    // Format date to DD/MM/YYYY
    let formattedDate = '';
    if (dataObs) {
      const parts = dataObs.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    if (!formattedDate) {
      formattedDate = new Date().toLocaleDateString('pt-BR');
    }

    // Save title to localStorage memory if not present
    if (titleTrimmed && !savedTitles.includes(titleTrimmed)) {
      const updatedTitles = [titleTrimmed, ...savedTitles].slice(0, 15);
      setSavedTitles(updatedTitles);
      try {
        localStorage.setItem(TITLES_STORAGE_KEY, JSON.stringify(updatedTitles));
      } catch (err) {}
    }

    // Save deadline to localStorage memory if not present and not semPrazo
    if (!semPrazo && prazoDias > 0 && !savedDeadlines.includes(prazoDias)) {
      const updatedDeadlines = Array.from(new Set([prazoDias, ...savedDeadlines])).sort((a, b) => a - b);
      setSavedDeadlines(updatedDeadlines);
      try {
        localStorage.setItem(DEADLINES_STORAGE_KEY, JSON.stringify(updatedDeadlines));
      } catch (err) {}
    }

    // Generate formatted structured HTML note
    const cleanDetalhes = (detalhes || '').replace(/<p><\/p>/gi, '').trim();
    const isConcluded = !!editingNote?.isConcluded;
    const concludedDateStr = editingNote?.concludedDateStr || '';
    
    const noteDate = parsePtBrDate(formattedDate) || new Date();
    let formattedLimitDate = '';
    if (!semPrazo) {
      const limitDate = new Date(noteDate);
      limitDate.setDate(limitDate.getDate() + prazoDias);
      formattedLimitDate = formatPtBrDate(limitDate);
    }

    // Single source of truth for the note HTML format (same serializer used when editing/concluding notes)
    const formattedHtml = serializeObservationsToHtml([{
      id: '',
      date: noteDate,
      dateStr: formattedDate,
      title: titleTrimmed,
      prazoDias: semPrazo ? null : prazoDias,
      limitDateStr: formattedLimitDate || undefined,
      isConcluded,
      concludedDateStr: concludedDateStr || undefined,
      headerHtml: '',
      bodyHtml: cleanDetalhes,
      rawBlockHtml: '',
      hasExplicitDate: true,
    }]);

    onAddObservation(formattedHtml);
    onClose();

    // Reset fields
    setTitulo('');
    setDetalhes('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[130] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 text-slate-800"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 text-white rounded-xl border border-white/20 shadow-md">
              {editingNote ? <PencilIcon className="h-5 w-5" /> : <PlusCircleIcon className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white">
                {editingNote ? 'Editar Observação ou Nota' : 'Inserir Observação ou Nota'}
              </h3>
              <p className="text-xs text-tcepr-100/90 font-medium">
                {editingNote ? 'Atualize as informações e detalhes da nota selecionada' : 'Cadastre notas, com ou sem prazo, organizadas em ordem cronológica'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Data + Prazo Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Data da Inclusão</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dataObs}
                onChange={(e) => setDataObs(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Prazo de Resposta (Dias)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setSemPrazo(!semPrazo)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    semPrazo
                      ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-250'
                  }`}
                >
                  {semPrazo ? '✓ Sem Prazo Ativo' : 'Sem Prazo?'}
                </button>
              </div>

              {semPrazo ? (
                <div className="w-full px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
                  <span>🚫 Esta nota não terá contagem de prazo</span>
                </div>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={365}
                  required={!semPrazo}
                  value={prazoDias}
                  onChange={(e) => setPrazoDias(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Atalhos Rápidos de Prazo (Memória/Aconselhados) */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              💡 Atalhos de Prazo Recentes:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectDeadline(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  semPrazo
                    ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                    : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-200'
                }`}
              >
                🚫 Sem Prazo
              </button>

              {savedDeadlines.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleSelectDeadline(days)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    !semPrazo && prazoDias === days
                      ? 'bg-tcepr-600 text-white border-tcepr-700 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-850 border-slate-200'
                  }`}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>

          {/* Título da Observação com Auto-Preenchimento */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TagIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Título da Observação / Movimentação</span>
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-slate-450 font-normal">Memória Automática Ativa</span>
            </label>

            <div className="relative">
              <input
                type="text"
                required
                placeholder="Ex: Diligência no Município, Solicitação de Documentos..."
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  setShowTitleSuggestions(true);
                }}
                onFocus={() => setShowTitleSuggestions(true)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none"
              />
            </div>

            {/* Sugestões salvas anteriormente */}
            {showTitleSuggestions && savedTitles.length > 0 && (
              <div className="mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-10">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between border-b border-slate-100">
                  <span>Sugestões Salvas:</span>
                  <button
                    type="button"
                    onClick={() => setShowTitleSuggestions(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    Fechar ✕
                  </button>
                </div>
                <div className="divide-y divide-slate-100 mt-1">
                  {savedTitles.map((t) => (
                    <div
                      key={t}
                      onClick={() => handleSelectTitle(t)}
                      className="px-2.5 py-2 hover:bg-slate-50 rounded-lg text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer flex items-center justify-between group transition-colors"
                    >
                      <span className="truncate pr-2">{t}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveTitleFromMemory(e, t)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                        title="Remover das sugestões"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detalhes / Conteúdo Livre com Tiptap Rich Text Editor */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <SparklesIcon className="h-3.5 w-3.5 text-slate-500" />
              <span>Detalhes / Conteúdo da Nota (Opcional)</span>
            </label>
            <TiptapEditor
              content={detalhes}
              onChange={(content) => setDetalhes(content)}
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-tcepr-600 hover:bg-tcepr-700 text-white font-bold rounded-xl text-xs shadow-md border border-tcepr-750 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              {editingNote ? <PencilIcon className="h-4 w-4" /> : <PlusCircleIcon className="h-4 w-4" />}
              <span>{editingNote ? 'Salvar Alterações na Nota' : 'Inserir Observação ou Nota'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
