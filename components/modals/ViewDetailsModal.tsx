
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import DOMPurify from 'dompurify';
import { Demand, RelatorioArquivoItem } from '../../types';
import StatusBadge from '../StatusBadge';
import MarkdownRenderer from '../MarkdownRenderer';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateTceLink, generateFiscalizacaoLink } from '../../utils/linkGenerators';
import { parseObservations } from '../../utils/deadlineUtils';
import { 
    XMarkIcon, 
    ViewIcon, 
    DocumentArrowDownIcon, 
    SparklesIcon, 
    CalendarIcon, 
    PencilIcon, 
    TagIcon, 
    FormIcon, 
    HammerIcon, 
    CheckIcon, 
    DownloadIcon
} from '../icons';
import { 
    downloadReportAttachment, 
    checkHasOriginalFile, 
    formatBytes 
} from '../../services/storageService';

interface ViewDetailsModalProps {
    demand: Demand;
    onClose: () => void;
    scrollToSummary: boolean;
    onEdit?: (demand: Demand) => void;
    onDemandUpdated?: (demand: Demand) => void;
}

const DetailItem: React.FC<{ label: string, value?: string | number | null, isLink?: boolean, linkHref?: string | null }> = ({ label, value, isLink, linkHref }) => (
    <div className="space-y-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        {isLink && linkHref ? (
            <a href={linkHref} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm font-bold text-tcepr-750 hover:text-tcepr-900 hover:underline break-words inline-flex items-center gap-1">
                <span>{value || '-'}</span>
                <span className="text-[10px] text-tcepr-600">↗</span>
            </a>
        ) : (
            <p className="text-xs sm:text-sm font-bold text-slate-800 break-words">{value || '-'}</p>
        )}
    </div>
);

const DetailCard: React.FC<{ title: string, icon?: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            {icon}
            <span>{title}</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
);

const ViewDetailsModal: React.FC<ViewDetailsModalProps> = ({ demand, onClose, scrollToSummary, onEdit, onDemandUpdated }) => {
    const summaryRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const [currentDemand, setCurrentDemand] = useState<Demand>(demand);
    const [downloadingFileIndex, setDownloadingFileIndex] = useState<number | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [binaryAvailability, setBinaryAvailability] = useState<Record<number, boolean>>({});

    // Keep currentDemand in sync if the prop changes
    useEffect(() => {
        setCurrentDemand(demand);
    }, [demand]);

    // Normalize attached files
    const attachedFiles: RelatorioArquivoItem[] = React.useMemo(() => {
        if (currentDemand.relatorioArquivos && currentDemand.relatorioArquivos.length > 0) {
            return currentDemand.relatorioArquivos;
        }
        if (currentDemand.relatorioNomeArquivo) {
            return [{
                nome: currentDemand.relatorioNomeArquivo,
                texto: currentDemand.relatorioTextoCompleto || ''
            }];
        }
        return [];
    }, [currentDemand.relatorioArquivos, currentDemand.relatorioNomeArquivo, currentDemand.relatorioTextoCompleto]);

    // Check availability of original binary file (PDF/DOCX) for each item
    useEffect(() => {
        let isMounted = true;
        const checkAll = async () => {
            const map: Record<number, boolean> = {};
            for (let i = 0; i < attachedFiles.length; i++) {
                const item = attachedFiles[i];
                map[i] = await checkHasOriginalFile(item);
            }
            if (isMounted) {
                setBinaryAvailability(map);
            }
        };
        checkAll();
        return () => {
            isMounted = false;
        };
    }, [attachedFiles]);

    const handleDownload = async (fileItem: RelatorioArquivoItem, index: number) => {
        setDownloadingFileIndex(index);
        setDownloadError(null);
        try {
            await downloadReportAttachment(fileItem);
        } catch (err: any) {
            setDownloadError(`Erro ao baixar "${fileItem.nome}": ${err.message}`);
        } finally {
            setDownloadingFileIndex(null);
        }
    };

    const handleDownloadAll = async () => {
        setDownloadError(null);
        let downloadedCount = 0;
        for (let i = 0; i < attachedFiles.length; i++) {
            if (binaryAvailability[i]) {
                setDownloadingFileIndex(i);
                try {
                    await downloadReportAttachment(attachedFiles[i]);
                    downloadedCount++;
                    await new Promise(res => setTimeout(res, 600));
                } catch (err: any) {
                    setDownloadError(`Erro ao baixar "${attachedFiles[i].nome}": ${err.message}`);
                }
            }
        }
        setDownloadingFileIndex(null);
        if (downloadedCount === 0 && attachedFiles.length > 0) {
            setDownloadError('Nenhum dos relatórios listados possui o arquivo original anexado. Para inseri-lo, edite a fiscalização.');
        }
    };

    useEffect(() => {
        if (scrollToSummary && summaryRef.current) {
            summaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [scrollToSummary]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        modalRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex items-center justify-center p-3 sm:p-4"
        >
            <motion.div 
                ref={modalRef} 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 text-slate-850" 
                tabIndex={-1} 
                role="dialog" 
                aria-modal="true"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white p-5 md:p-6 flex justify-between items-center relative overflow-hidden border-b border-slate-200 shrink-0">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-tcepr-400/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex items-center gap-3.5 relative z-10">
                        <div className="p-2.5 bg-white/10 text-tcepr-100 rounded-xl border border-white/20 shrink-0 shadow-md">
                            <ViewIcon className="h-6 w-6 text-tcepr-100" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Detalhes da Fiscalização</h3>
                            <p className="text-xs sm:text-sm text-tcepr-100/95 font-medium mt-1">
                                {demand.municipio || 'Município não informado'} ({demand.ano}) • {demand.tema || 'Geral'}{demand.nFiscalizacao ? ` • nº ${demand.nFiscalizacao}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                        <button 
                            onClick={onClose} 
                            className="p-2 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer" 
                            aria-label="Fechar"
                            title="Fechar"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-5 md:p-7 overflow-y-auto space-y-5">
                    <DetailCard title="Informações Principais" icon={<TagIcon className="h-4 w-4 text-tcepr-600" />}>
                        <DetailItem label="Município" value={demand.municipio} />
                        <DetailItem label="Tema" value={demand.tema} />
                        <div className="flex flex-col justify-center space-y-1">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Atual</p>
                            <div className="self-start"><StatusBadge status={demand.status} /></div>
                        </div>
                    </DetailCard>
 
                    <DetailCard title="Detalhes Técnicos da Ação" icon={<HammerIcon className="h-4 w-4 text-tcepr-600" />}>
                        <DetailItem label="Ano do Exercício" value={demand.ano} />
                        <DetailItem label="Nº da Fiscalização" value={demand.nFiscalizacao} isLink={!!generateFiscalizacaoLink(demand.nFiscalizacao)} linkHref={generateFiscalizacaoLink(demand.nFiscalizacao)} />
                        <DetailItem label="Modalidade" value={demand.modalidade} />
                        <DetailItem label="Valor Estimado (R$)" value={formatCurrency(demand.valor)} />
                    </DetailCard>
 
                    <DetailCard title="Documentação e Protocolos Externos" icon={<DocumentArrowDownIcon className="h-4 w-4 text-tcepr-600" />}>
                        <DetailItem label="Data do Requisito Externo" value={formatDate(demand.dataReqExterno)} />
                        <DetailItem label="Protocolo Requerimento Externo" value={demand.requerimentoExterno} isLink={!!generateTceLink(demand.requerimentoExterno)} linkHref={generateTceLink(demand.requerimentoExterno)} />
                        {demand.representacaoExterna?.map((rep, index) => (
                            <DetailItem key={index} label={`Representação Externa ${index + 1}`} value={rep} isLink={!!generateTceLink(rep)} linkHref={generateTceLink(rep)} />
                        ))}
                        <DetailItem label="Encaminhamento Processual" value={demand.encaminhamentoProcessual} isLink={!!generateTceLink(demand.encaminhamentoProcessual)} linkHref={generateTceLink(demand.encaminhamentoProcessual)} />
                    </DetailCard>
 
                    {demand.observacoes && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <div className="flex items-center justify-between mb-3.5 border-b border-slate-200/60 pb-2.5">
                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                    <FormIcon className="h-4 w-4 text-tcepr-600" />
                                    <span>Observações e Notas do Processo</span>
                                </h4>
                                {parseObservations(demand.observacoes).length > 0 && (
                                    <span className="bg-tcepr-50 text-tcepr-750 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-tcepr-200">
                                        {parseObservations(demand.observacoes).length} {parseObservations(demand.observacoes).length === 1 ? 'nota' : 'notas'}
                                    </span>
                                )}
                            </div>
                            {parseObservations(demand.observacoes).length > 0 ? (
                                <div className="space-y-3">
                                    {parseObservations(demand.observacoes).map((note, noteIdx) => (
                                        <div key={note.id || noteIdx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
                                            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                                                <span className="bg-tcepr-700 text-white font-extrabold text-[11px] px-2.5 py-0.5 rounded-md shadow-2xs tracking-wide">
                                                    [{note.dateStr}]
                                                </span>
                                                <span className="font-bold text-xs sm:text-sm text-slate-800">
                                                    {note.title}
                                                </span>
                                                {note.prazoDias !== null && note.prazoDias !== undefined ? (
                                                    <span className="bg-amber-100/90 text-amber-850 border border-amber-300/80 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md shadow-2xs">
                                                        Prazo: {note.prazoDias} dias {note.limitDateStr ? `(Limite: ${note.limitDateStr})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="bg-slate-200/80 text-slate-700 font-semibold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md">
                                                        Sem prazo
                                                    </span>
                                                )}
                                                {note.isConcluded && (
                                                    <span
                                                        title={note.concludedDateStr ? `Concluído em ${note.concludedDateStr}` : 'Concluído'}
                                                        className="text-emerald-600 inline-flex items-center"
                                                    >
                                                        <CheckIcon className="h-4 w-4 stroke-[2.5]" />
                                                    </span>
                                                )}
                                            </div>
                                            {note.bodyHtml && (
                                                <div
                                                    className="observation-note-content font-sans text-xs sm:text-sm text-slate-700 leading-relaxed pt-1 space-y-2 [&_p]:leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-bold [&_strong]:text-slate-800 [&_b]:font-bold [&_b]:text-slate-800 [&_a]:text-tcepr-700 [&_a]:underline [&_h1]:font-bold [&_h1]:text-base [&_h2]:font-bold [&_h2]:text-sm [&_h3]:font-bold [&_h3]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-tcepr-300 [&_blockquote]:pl-3 [&_blockquote]:italic"
                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.bodyHtml) }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div 
                                    className="observation-note-content bg-white border border-slate-200 rounded-xl p-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 [&_p]:leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_strong]:text-slate-800 [&_a]:text-tcepr-700 [&_a]:underline"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(demand.observacoes) }}
                                />
                            )}
                        </div>
                    )}

                    {/* Relatórios da Fiscalização / Arquivo Principal */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                            <div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <DocumentArrowDownIcon className="h-4 w-4 text-tcepr-600" />
                                    <span>Arquivo Principal / Relatórios ({attachedFiles.length})</span>
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Documentos oficiais da fiscalização com suporte a download do arquivo original (PDF, DOCX)
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {attachedFiles.some((_, i) => binaryAvailability[i]) && attachedFiles.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleDownloadAll}
                                        disabled={downloadingFileIndex !== null}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95 border border-slate-300"
                                    >
                                        <DownloadIcon className="h-3.5 w-3.5 text-slate-600" />
                                        <span>Baixar Todos</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {downloadError && (
                            <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900">
                                <span className="break-words">{downloadError}</span>
                                <button
                                    type="button"
                                    onClick={() => setDownloadError(null)}
                                    className="text-amber-700 hover:text-amber-900 cursor-pointer p-0.5"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}

                        {attachedFiles.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2">
                                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                                    Nenhum arquivo principal anexado a esta fiscalização
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Para inserir, substituir ou excluir arquivos principais, utilize a tela de <strong>Editar Fiscalização</strong>.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attachedFiles.map((fileItem, idx) => {
                                    const isPdf = fileItem.nome.toLowerCase().endsWith('.pdf');
                                    const isDocx = fileItem.nome.toLowerCase().endsWith('.docx') || fileItem.nome.toLowerCase().endsWith('.doc');
                                    const isTxt = fileItem.nome.toLowerCase().endsWith('.txt');
                                    const isDownloading = downloadingFileIndex === idx;
                                    const hasOriginal = binaryAvailability[idx];

                                    return (
                                        <div 
                                            key={idx} 
                                            className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`p-2 rounded-xl shrink-0 font-extrabold text-[11px] ${
                                                    isPdf ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                    isDocx ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}>
                                                    {isPdf ? 'PDF' : isDocx ? 'DOCX' : isTxt ? 'TXT' : 'DOC'}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                                                        {fileItem.nome}
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                                                        {fileItem.tamanho && (
                                                            <span>{formatBytes(fileItem.tamanho)}</span>
                                                        )}
                                                        {fileItem.dataUpload && (
                                                            <span>• Anexado em {fileItem.dataUpload}</span>
                                                        )}
                                                        {hasOriginal ? (
                                                            fileItem.url ? (
                                                                <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                                                                    Arquivo Original (Nuvem)
                                                                </span>
                                                            ) : (
                                                                <span className="bg-sky-50 text-sky-700 font-semibold px-1.5 py-0.2 rounded border border-sky-200 text-[10px]">
                                                                    Arquivo Original (Salvo)
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-300 text-[10px]">
                                                                Arquivo original não anexado
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                                {hasOriginal ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownload(fileItem, idx)}
                                                        disabled={downloadingFileIndex !== null}
                                                        className="px-3.5 py-2 bg-slate-100 hover:bg-tcepr-50 text-slate-700 hover:text-tcepr-750 font-bold text-xs rounded-xl border border-slate-200 hover:border-tcepr-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                                                        title={`Baixar o arquivo original ${fileItem.nome}`}
                                                    >
                                                        <DownloadIcon className="h-3.5 w-3.5 text-tcepr-600" />
                                                        <span>{isDownloading ? 'Baixando...' : 'Baixar Arquivo'}</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 italic">
                                                        Disponível para anexar na edição
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <p className="text-[11px] text-slate-500 pt-1">
                            Para inserir novos arquivos, substituir ou excluir documentos existentes, utilize o botão <strong>Editar Fiscalização</strong>.
                        </p>
                    </div>

                    {currentDemand.resumoRelatorio && (
                        <div ref={summaryRef} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <h4 className="text-xs font-bold text-tcepr-750 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <SparklesIcon className="h-4 w-4 text-amber-500" />
                                <span>Resumo do Relatório (IA)</span>
                            </h4>
                            <div className="text-xs sm:text-sm leading-relaxed text-slate-700 p-4 bg-white rounded-xl border border-slate-200">
                                <MarkdownRenderer text={currentDemand.resumoRelatorio} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                        {onEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onEdit(demand);
                                }}
                                className="px-4 py-2.5 bg-gradient-to-r from-tcepr-700 to-tcepr-600 hover:from-tcepr-600 hover:to-tcepr-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer border border-tcepr-600/30 flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <PencilIcon className="h-4 w-4 text-tcepr-200" />
                                <span>Editar Fiscalização</span>
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer active:scale-95 border border-slate-200"
                    >
                        Fechar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ViewDetailsModal;
