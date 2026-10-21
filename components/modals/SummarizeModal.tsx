
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { auth } from '../../services/firebase';
import DOMPurify from 'dompurify';
import { Demand } from '../../types';
import { summarizeReport } from '../../services/geminiService';
import { SummarizeIcon, XMarkIcon } from '../icons';

interface SummarizeModalProps {
    db: any;
    demand: Demand;
    onClose: () => void;
    onSaveSummary: (summary: string) => void;
}

const SummarizeModal: React.FC<SummarizeModalProps> = ({ db, demand, onClose, onSaveSummary }) => {
    const [reportText, setReportText] = useState('');
    const [summary, setSummary] = useState(demand.resumoRelatorio || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        modalRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleGenerateSummary = async () => {
        if (!reportText.trim()) {
            setError("Por favor, cole o texto do relatório para gerar um novo resumo.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const generatedSummary = await summarizeReport(reportText);
            setSummary(generatedSummary);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveChanges = async () => {
        if (!db || !demand) return;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setError("Usuário não autenticado.");
            return;
        }
        try {
            const sanitizedSummary = DOMPurify.sanitize(summary);
            await updateDoc(doc(db, `users/${currentUser.uid}/demands/${demand.id}`), { resumoRelatorio: sanitizedSummary });
            onSaveSummary(sanitizedSummary);
            onClose();
        } catch (e: any) {
            setError(`Falha ao salvar o resumo: ${e.message}`);
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
                ref={modalRef} 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 text-slate-800" 
                tabIndex={-1}
            >
                <div className="p-5 md:p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
                    <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <SummarizeIcon className="text-tcepr-100 h-6 w-6" /> 
                        <span>Resumo do Relatório com IA</span>
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-lg transition-all"><XMarkIcon className="h-5 w-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5">
                    <div className="p-4 bg-tcepr-50 border border-tcepr-100 rounded-xl text-sm text-tcepr-900 leading-relaxed shadow-2xs">
                        <h4 className="font-bold mb-1 text-tcepr-950 flex items-center gap-1.5">Como extrair o texto de um PDF?</h4>
                        <ol className="list-decimal list-inside space-y-1 mt-2 text-tcepr-800 text-xs">
                            <li>Abra o arquivo PDF do relatório da fiscalização.</li>
                            <li>Tecle <kbd className="px-1.5 py-0.5 bg-white border border-tcepr-200 rounded text-xs font-semibold shadow-xs text-slate-800">Ctrl + A</kbd> (ou <kbd className="px-1.5 py-0.5 bg-white border border-tcepr-200 rounded text-xs font-semibold shadow-xs text-slate-800">Cmd + A</kbd>) para selecionar todo o texto.</li>
                            <li>Tecle <kbd className="px-1.5 py-0.5 bg-white border border-tcepr-200 rounded text-xs font-semibold shadow-xs text-slate-800">Ctrl + C</kbd> para copiar.</li>
                            <li>Cole no campo abaixo clicando dentro dele e teclando <kbd className="px-1.5 py-0.5 bg-white border border-tcepr-200 rounded text-xs font-semibold shadow-xs text-slate-800">Ctrl + V</kbd>.</li>
                        </ol>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Texto Bruto do Relatório</label>
                        <textarea 
                            value={reportText} 
                            onChange={(e) => setReportText(e.target.value)} 
                            placeholder="Cole o texto completo do relatório aqui..." 
                            rows={6} 
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 text-sm focus:outline-none transition-all placeholder:text-slate-400 text-slate-800"
                        />
                    </div>

                    <button 
                        onClick={handleGenerateSummary} 
                        disabled={isLoading} 
                        className="w-full px-5 py-3 bg-gradient-to-r from-tcepr-700 to-tcepr-800 hover:from-tcepr-800 hover:to-tcepr-900 text-white font-bold rounded-xl shadow-xs hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Gerando resumo inteligente...</span>
                            </>
                        ) : 'Analisar e Gerar Resumo Estruturado (Gemini)'}
                    </button>

                    <div className="border-t border-slate-200 pt-4 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Resumo Gerado (Você pode editar diretamente)</label>
                        <textarea 
                            value={summary} 
                            onChange={(e) => setSummary(e.target.value)} 
                            rows={7} 
                            className="w-full p-3.5 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 text-sm focus:outline-none transition-all text-slate-800"
                        />
                    </div>
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1.5 shadow-2xs mt-1">
                            <div className="flex items-start gap-1.5 font-bold text-rose-800">
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                            {error.includes('ai.studio/spend') && (
                                <div className="pt-1">
                                    <a
                                        href="https://ai.studio/spend"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                                    >
                                        <span>Ajustar Limite de Gastos em ai.studio/spend</span>
                                        <span className="text-xs">↗</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 rounded-xl text-sm transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveChanges} 
                        className="px-6 py-2 bg-tcepr-700 hover:bg-tcepr-800 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                        Salvar e Fechar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SummarizeModal;
