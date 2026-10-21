import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { XMarkIcon, CheckCircleIcon, CalendarIcon, TagIcon, SparklesIcon } from '../icons';
import TiptapEditor from '../tiptap/TiptapEditor';
import { formatIsoInputDate } from '../../utils/deadlineUtils';

interface ConcludeNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (concludedDateStr: string, detailsHtml?: string) => void;
  noteTitle?: string;
  initialDetails?: string;
}

export const ConcludeNoteModal: React.FC<ConcludeNoteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  noteTitle,
  initialDetails,
}) => {
  const [concludedDate, setConcludedDate] = useState<string>(() => {
    return formatIsoInputDate();
  });
  const [detalhes, setDetalhes] = useState<string>(() => initialDetails || '');

  useEffect(() => {
    if (isOpen) {
      setDetalhes(initialDetails || '');
      setConcludedDate(formatIsoInputDate());
    }
  }, [isOpen, initialDetails]);

  if (!isOpen) return null;

  const getFormattedDateStr = () => {
    if (concludedDate) {
      const parts = concludedDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date().toLocaleDateString('pt-BR');
  };

  const handleInsertStamp = () => {
    const formatted = getFormattedDateStr();
    const stampHtml = `<p><strong>Conclusão em ${formatted}:</strong> </p>`;
    setDetalhes((prev) => {
      const cleanPrev = prev ? prev.trim() : '';
      if (!cleanPrev || cleanPrev === '<p></p>') {
        return stampHtml;
      }
      return `${cleanPrev}${stampHtml}`;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedDateStr = getFormattedDateStr();
    onConfirm(formattedDateStr, detalhes);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[140] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 text-slate-800"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 text-white rounded-xl border border-white/20">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white">Concluir Nota de Observação</h3>
              <p className="text-xs text-emerald-100/90 font-medium">Informe a data e os detalhes de encerramento da nota</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {noteTitle && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nota Selecionada:
              </p>
              <p className="text-xs font-bold text-slate-800 line-clamp-2 flex items-center gap-1.5">
                <TagIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{noteTitle}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <span>Data da Conclusão</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={concludedDate}
              onChange={(e) => setConcludedDate(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              A nota será marcada como <strong className="text-emerald-700 font-bold">concluída (✓) em {getFormattedDateStr()}</strong>.
            </p>
          </div>

          {/* Detalhes / Conteúdo da Nota com Tiptap Editor */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <SparklesIcon className="h-4 w-4 text-emerald-600" />
                <span>Detalhes / Conteúdo da Nota</span>
                <span className="text-[11px] font-normal text-slate-400 normal-case">(opcional)</span>
              </label>
              <button
                type="button"
                onClick={handleInsertStamp}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                title="Inserir carimbo 'Conclusão em DD/MM/AAAA' no texto"
              >
                <span>+ Carimbo de Conclusão</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2 font-medium">
              Adicione informações, despachos, histórico de atendimento ou justificativa da conclusão. O conteúdo ficará inserido em <strong>Detalhes / Conteúdo da Nota</strong>.
            </p>

            <TiptapEditor
              content={detalhes}
              onChange={(content) => setDetalhes(content)}
              minHeightClass="min-h-[140px]"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>Confirmar Conclusão</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

