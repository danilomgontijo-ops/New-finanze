import DOMPurify from "dompurify";

import React, { useState, useEffect } from 'react';
import { Demand, AutocompleteOptions, RelatorioArquivoItem } from '../types';
import { 
    MinusCircleIcon, 
    PlusCircleIcon, 
    SummarizeIcon, 
    CalendarIcon, 
    DocumentArrowDownIcon, 
    SparklesIcon, 
    FormIcon, 
    TagIcon, 
    HammerIcon, 
    TrashIcon, 
    PencilIcon, 
    CheckIcon, 
    DownloadIcon, 
    UploadIcon,
    LoaderIcon,
    CheckCircleIcon,
    AlertIcon
} from './icons';
import { extractTextFromFile } from '../utils/fileExtractor';
import { summarizeReport } from '../services/geminiService';
import { AddObservationModal } from './modals/AddObservationModal';
import { addAndSortNewObservation, parseObservations, serializeObservationsToHtml } from '../utils/deadlineUtils';
import { uploadReportFile, downloadReportAttachment, formatBytes } from '../services/storageService';
import { MUNICIPIOS_PR } from '../constants';
import { parseBRNumber } from '../utils/formatters';

interface DemandFormProps {
    onSubmit: (data: Omit<Demand, 'id' | 'createdAt'>) => void;
    onUpdate: (data: Demand) => void;
    editingDemand: Demand | null;
    onCancelEdit: () => void;
    autocompleteOptions: AutocompleteOptions;
    onOpenSummarizeModal: (demand: Demand) => void;
}

const DemandForm: React.FC<DemandFormProps> = ({ onSubmit, onUpdate, editingDemand, onCancelEdit, autocompleteOptions, onOpenSummarizeModal }) => {

    const initialFormState: Omit<Demand, 'id' | 'createdAt'> = {
        ano: new Date().getFullYear(),
        municipio: '',
        status: 'Pendente',
        representacaoExterna: [''],
        observacoes: '',
        resumoRelatorio: '',
        relatorioTextoCompleto: '',
        relatorioNomeArquivo: '',
        relatorioArquivos: [],
    };
    interface ProcessingProgress {
        active: boolean;
        step: 'uploading' | 'extracting' | 'summarizing' | 'success' | 'error';
        stageText: string;
        detailText?: string;
        progress: number;
        fileName: string;
    }

    const [processProgress, setProcessProgress] = useState<ProcessingProgress>({
        active: false,
        step: 'uploading',
        stageText: '',
        progress: 0,
        fileName: ''
    });

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isExtractingReport, setIsExtractingReport] = useState(false);
    const [isSummarizingReport, setIsSummarizingReport] = useState(false);
    const [fileExtractError, setFileExtractError] = useState('');
    const [isAddObsModalOpen, setIsAddObsModalOpen] = useState(false);
    const [replaceFileIndex, setReplaceFileIndex] = useState<number | null>(null);
    const replaceFileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingDemand) {
            let arquivos = editingDemand.relatorioArquivos || [];
            if (arquivos.length === 0 && editingDemand.relatorioNomeArquivo && editingDemand.relatorioTextoCompleto) {
                arquivos = [{
                    nome: editingDemand.relatorioNomeArquivo,
                    texto: editingDemand.relatorioTextoCompleto
                }];
            }
            setFormData({
                ...editingDemand,
                relatorioArquivos: arquivos,
                representacaoExterna: Array.isArray(editingDemand.representacaoExterna) && editingDemand.representacaoExterna.length > 0 ? editingDemand.representacaoExterna : [''],
            });
        } else {
            setFormData(initialFormState);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingDemand]);

    const handleReportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsExtractingReport(true);
        setFileExtractError('');
        try {
            const fileList = Array.from(files);
            const newFilesData: RelatorioArquivoItem[] = [];
            let allExtractedTexts: string[] = [];

            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const prefix = fileList.length > 1 ? `[${i + 1}/${fileList.length}] ` : '';

                // Etapa 1: Anexação e Armazenamento do binário
                setProcessProgress({
                    active: true,
                    step: 'uploading',
                    stageText: `${prefix}Anexando e armazenando documento...`,
                    detailText: `${file.name} (${formatBytes(file.size)})`,
                    progress: Math.round(((i * 3 + 1) / (fileList.length * 3)) * 80),
                    fileName: file.name
                });

                const uploadInfo = await uploadReportFile(file, String(formData.nFiscalizacao || formData.municipio || 'fiscalizacao'));

                // Etapa 2: Leitura e extração dos achados
                setProcessProgress({
                    active: true,
                    step: 'extracting',
                    stageText: `${prefix}Lendo conteúdo e seções de achados...`,
                    detailText: `${file.name} — identificando condição, análises e conclusões`,
                    progress: Math.round(((i * 3 + 2) / (fileList.length * 3)) * 80),
                    fileName: file.name
                });

                const result = await extractTextFromFile(file);
                const fileText = result.analiseDaEquipeText || result.fullText || '';
                if (fileText.trim()) {
                    allExtractedTexts.push(fileText);
                }

                newFilesData.push({
                    nome: result.fileName,
                    texto: fileText,
                    url: uploadInfo.url,
                    storagePath: uploadInfo.storagePath,
                    tamanho: uploadInfo.tamanho,
                    tipo: uploadInfo.tipo,
                    base64Data: uploadInfo.base64Data,
                    dataUpload: uploadInfo.dataUpload
                });
            }

            // Anexa os arquivos imediatamente no estado para que fiquem visíveis na hora!
            let combinedNames = '';
            let combinedText = '';

            setFormData(prev => {
                let existingArquivos: RelatorioArquivoItem[] = prev.relatorioArquivos ? [...prev.relatorioArquivos] : [];
                if (existingArquivos.length === 0 && prev.relatorioNomeArquivo && prev.relatorioTextoCompleto) {
                    existingArquivos.push({
                        nome: prev.relatorioNomeArquivo,
                        texto: prev.relatorioTextoCompleto
                    });
                }

                const updatedArquivos = [...existingArquivos, ...newFilesData];
                combinedNames = updatedArquivos.map(a => a.nome).join(', ');
                combinedText = updatedArquivos.map((a, idx) => `=== RELATÓRIO ${idx + 1}: ${a.nome} ===\n${a.texto}`).join('\n\n');

                return {
                    ...prev,
                    relatorioArquivos: updatedArquivos,
                    relatorioNomeArquivo: combinedNames,
                    relatorioTextoCompleto: combinedText
                };
            });

            // Etapa 3: Geração automática do Resumo com IA a partir do relatório anexado
            const textToSummarize = combinedText || allExtractedTexts.join('\n\n') || formData.observacoes || '';

            if (textToSummarize.trim().length > 30) {
                setProcessProgress({
                    active: true,
                    step: 'summarizing',
                    stageText: 'Gerando resumo do relatório com Inteligência Artificial (Gemini)...',
                    detailText: 'Sintetizando achados, manifestação do gestor e parecer da equipe técnica...',
                    progress: 85,
                    fileName: newFilesData.map(f => f.nome).join(', ')
                });
                setIsSummarizingReport(true);

                try {
                    const summary = await summarizeReport(textToSummarize);
                    setFormData(prev => ({
                        ...prev,
                        resumoRelatorio: summary
                    }));

                    setProcessProgress({
                        active: true,
                        step: 'success',
                        stageText: 'Arquivo anexado e resumo gerado com sucesso!',
                        detailText: `${newFilesData.length} arquivo(s) anexado(s) e resumo preenchido automaticamente abaixo.`,
                        progress: 100,
                        fileName: newFilesData.map(f => f.nome).join(', ')
                    });
                } catch (summaryErr: any) {
                    console.warn('Aviso na síntese por IA:', summaryErr);
                    setProcessProgress({
                        active: true,
                        step: 'error',
                        stageText: 'Arquivo anexado com sucesso!',
                        detailText: `Arquivo anexado ao portfólio. (Aviso da IA: ${summaryErr.message || 'Resumo pendente'}. Você pode gerá-lo clicando em "Gerar Resumo (IA)").`,
                        progress: 100,
                        fileName: newFilesData.map(f => f.nome).join(', ')
                    });
                } finally {
                    setIsSummarizingReport(false);
                }
            } else {
                setProcessProgress({
                    active: true,
                    step: 'success',
                    stageText: 'Arquivo anexado com sucesso!',
                    detailText: 'Documento original armazenado. Como o arquivo é digitalizado/imagem, insira ou revise o resumo manualmente.',
                    progress: 100,
                    fileName: newFilesData.map(f => f.nome).join(', ')
                });
            }
        } catch (err: any) {
            setFileExtractError(`Erro ao extrair e anexar arquivo(s): ${err.message}`);
            setProcessProgress({
                active: true,
                step: 'error',
                stageText: 'Erro ao anexar arquivo',
                detailText: err.message,
                progress: 0,
                fileName: ''
            });
        } finally {
            setIsExtractingReport(false);
            e.target.value = '';
        }
    };

    const handleFormDownloadFile = async (fileItem: RelatorioArquivoItem) => {
        try {
            await downloadReportAttachment(fileItem);
        } catch (err: any) {
            setFileExtractError(`Erro ao baixar "${fileItem.nome}": ${err.message}`);
        }
    };

    const handleRemoveSingleFile = (index: number) => {
        setFormData(prev => {
            let currentArquivos = prev.relatorioArquivos ? [...prev.relatorioArquivos] : [];
            if (currentArquivos.length === 0 && prev.relatorioNomeArquivo) {
                currentArquivos.push({ nome: prev.relatorioNomeArquivo, texto: prev.relatorioTextoCompleto || '' });
            }

            currentArquivos.splice(index, 1);

            if (currentArquivos.length === 0) {
                return {
                    ...prev,
                    relatorioArquivos: [],
                    relatorioNomeArquivo: '',
                    relatorioTextoCompleto: ''
                };
            }

            const combinedNames = currentArquivos.map(a => a.nome).join(', ');
            const combinedText = currentArquivos.map((a, idx) => `=== RELATÓRIO ${idx + 1}: ${a.nome} ===\n${a.texto}`).join('\n\n');

            return {
                ...prev,
                relatorioArquivos: currentArquivos,
                relatorioNomeArquivo: combinedNames,
                relatorioTextoCompleto: combinedText
            };
        });
    };

    const handleRemoveAllFiles = () => {
        setFormData(prev => ({
            ...prev,
            relatorioArquivos: [],
            relatorioNomeArquivo: '',
            relatorioTextoCompleto: ''
        }));
    };

    const triggerReplaceFile = (index: number) => {
        setReplaceFileIndex(index);
        if (replaceFileInputRef.current) {
            replaceFileInputRef.current.value = '';
            replaceFileInputRef.current.click();
        }
    };

    const handleReplaceReportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || replaceFileIndex === null) return;

        setIsExtractingReport(true);
        setFileExtractError('');

        setProcessProgress({
            active: true,
            step: 'uploading',
            stageText: 'Substituindo e anexando novo documento...',
            detailText: `${file.name} (${formatBytes(file.size)})`,
            progress: 30,
            fileName: file.name
        });

        try {
            const uploadInfo = await uploadReportFile(file, String(formData.nFiscalizacao || formData.municipio || 'fiscalizacao'));

            setProcessProgress({
                active: true,
                step: 'extracting',
                stageText: 'Lendo e extraindo conteúdo do documento substituído...',
                detailText: file.name,
                progress: 60,
                fileName: file.name
            });

            const result = await extractTextFromFile(file);
            const fileText = result.analiseDaEquipeText || result.fullText || '';

            const replacedItem: RelatorioArquivoItem = {
                nome: result.fileName,
                texto: fileText,
                url: uploadInfo.url,
                storagePath: uploadInfo.storagePath,
                tamanho: uploadInfo.tamanho,
                tipo: uploadInfo.tipo,
                base64Data: uploadInfo.base64Data,
                dataUpload: uploadInfo.dataUpload
            };

            let combinedText = '';

            setFormData(prev => {
                let existing: RelatorioArquivoItem[] = prev.relatorioArquivos ? [...prev.relatorioArquivos] : [];
                if (existing.length === 0 && prev.relatorioNomeArquivo) {
                    existing = [{
                        nome: prev.relatorioNomeArquivo,
                        texto: prev.relatorioTextoCompleto || ''
                    }];
                }
                if (replaceFileIndex >= 0 && replaceFileIndex < existing.length) {
                    existing[replaceFileIndex] = replacedItem;
                } else {
                    existing.push(replacedItem);
                }
                const combinedNames = existing.map(a => a.nome).join(', ');
                combinedText = existing.map((a, idx) => `=== RELATÓRIO ${idx + 1}: ${a.nome} ===\n${a.texto}`).join('\n\n');
                return {
                    ...prev,
                    relatorioArquivos: existing,
                    relatorioNomeArquivo: combinedNames,
                    relatorioTextoCompleto: combinedText
                };
            });

            // Resumo automático com IA
            if (fileText.trim().length > 30) {
                setProcessProgress({
                    active: true,
                    step: 'summarizing',
                    stageText: 'Atualizando resumo com Inteligência Artificial (Gemini)...',
                    detailText: 'Sintetizando novo relatório anexado...',
                    progress: 85,
                    fileName: file.name
                });
                setIsSummarizingReport(true);

                try {
                    const summary = await summarizeReport(fileText);
                    setFormData(prev => ({
                        ...prev,
                        resumoRelatorio: summary
                    }));

                    setProcessProgress({
                        active: true,
                        step: 'success',
                        stageText: 'Arquivo substituído e resumo atualizado com sucesso!',
                        detailText: `O novo arquivo ${file.name} foi gravado e seu resumo preenchido.`,
                        progress: 100,
                        fileName: file.name
                    });
                } catch (summaryErr: any) {
                    setProcessProgress({
                        active: true,
                        step: 'error',
                        stageText: 'Arquivo substituído com sucesso!',
                        detailText: `Aviso da IA: ${summaryErr.message || 'Resumo pendente'}. Clique em "Gerar Resumo (IA)" para tentar novamente.`,
                        progress: 100,
                        fileName: file.name
                    });
                } finally {
                    setIsSummarizingReport(false);
                }
            } else {
                setProcessProgress({
                    active: true,
                    step: 'success',
                    stageText: 'Arquivo substituído com sucesso!',
                    detailText: `${file.name} foi atualizado.`,
                    progress: 100,
                    fileName: file.name
                });
            }
        } catch (err: any) {
            setFileExtractError(`Erro ao substituir arquivo: ${err.message}`);
            setProcessProgress({
                active: true,
                step: 'error',
                stageText: 'Erro ao substituir arquivo',
                detailText: err.message,
                progress: 0,
                fileName: ''
            });
        } finally {
            setIsExtractingReport(false);
            setReplaceFileIndex(null);
            e.target.value = '';
        }
    };

    const handleGenerateSummaryFromAttachedReport = async () => {
        const textToSummarize = formData.relatorioTextoCompleto || formData.observacoes || '';
        if (!textToSummarize || textToSummarize.trim() === '') {
            setFileExtractError('Nenhum texto de relatório ou observação disponível para resumir.');
            return;
        }

        setIsSummarizingReport(true);
        setFileExtractError('');
        setProcessProgress({
            active: true,
            step: 'summarizing',
            stageText: 'Gerando resumo com Inteligência Artificial (Gemini)...',
            detailText: 'Sintetizando tópicos de achados, defesas do gestor e conclusões...',
            progress: 80,
            fileName: formData.relatorioNomeArquivo || 'Relatório Anexado'
        });

        try {
            const summary = await summarizeReport(textToSummarize);
            setFormData(prev => ({
                ...prev,
                resumoRelatorio: summary
            }));
            setProcessProgress({
                active: true,
                step: 'success',
                stageText: 'Resumo gerado com sucesso!',
                detailText: 'A síntese dos achados foi preenchida no campo abaixo.',
                progress: 100,
                fileName: formData.relatorioNomeArquivo || 'Relatório'
            });
        } catch (err: any) {
            setFileExtractError(`Erro ao gerar resumo com IA: ${err.message}`);
            setProcessProgress({
                active: true,
                step: 'error',
                stageText: 'Falha ao gerar resumo',
                detailText: err.message,
                progress: 100,
                fileName: ''
            });
        } finally {
            setIsSummarizingReport(false);
        }
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.ano) newErrors.ano = 'O ano é obrigatório.';
        if (!formData.municipio) newErrors.municipio = 'O município é obrigatório.';
        if (formData.valor && isNaN(parseBRNumber(formData.valor))) {
            newErrors.valor = 'O valor deve ser um número válido.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleRepresentacaoChange = (index: number, value: string) => {
        const newRepresentacoes = [...formData.representacaoExterna];
        newRepresentacoes[index] = value;
        setFormData(prev => ({ ...prev, representacaoExterna: newRepresentacoes }));
    };

    const addRepresentacao = () => {
        setFormData(prev => ({ ...prev, representacaoExterna: [...prev.representacaoExterna, ''] }));
    };

    const removeRepresentacao = (index: number) => {
        if (formData.representacaoExterna.length <= 1) return;
        const newRepresentacoes = formData.representacaoExterna.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, representacaoExterna: newRepresentacoes }));
    };

    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);

    const handleAddObservation = (formattedHtmlNote: string) => {
        if (editingNoteIndex !== null) {
            const currentNotes = parseObservations(formData.observacoes);
            const editedParsed = parseObservations(formattedHtmlNote);
            if (editedParsed.length > 0 && currentNotes[editingNoteIndex]) {
                currentNotes[editingNoteIndex] = editedParsed[0];
                const updatedHtml = serializeObservationsToHtml(currentNotes);
                setFormData(prev => ({ ...prev, observacoes: updatedHtml }));
            }
        } else {
            const updatedHtml = addAndSortNewObservation(formData.observacoes, formattedHtmlNote);
            setFormData(prev => ({ ...prev, observacoes: updatedHtml }));
        }
        setIsAddObsModalOpen(false);
        setEditingNoteIndex(null);
    };

    const handleStartEditNote = (index: number) => {
        setEditingNoteIndex(index);
        setIsAddObsModalOpen(true);
    };

    const handleDeleteNote = (indexToDelete: number) => {
        const currentNotes = parseObservations(formData.observacoes);
        const updated = currentNotes.filter((_, idx) => idx !== indexToDelete);
        const updatedHtml = serializeObservationsToHtml(updated);
        setFormData(prev => ({ ...prev, observacoes: updatedHtml }));
    };

    const parsedNotes = parseObservations(formData.observacoes);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        const demandData = {
            ...formData,
            representacaoExterna: formData.representacaoExterna.filter(rep => rep.trim() !== ''),
            valor: formData.valor ? parseBRNumber(formData.valor).toFixed(2) : '',
            observacoes: formData.observacoes || '',
        };
        if (editingDemand) {
            onUpdate({ ...demandData, id: editingDemand.id, createdAt: editingDemand.createdAt });
        } else {
            onSubmit(demandData);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Card 1: Informações Principais */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-tcepr-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <TagIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                        <span>Informações Principais & Identificação</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                        <Input name="ano" label="Ano" value={formData.ano} onChange={handleChange} required error={errors.ano} type="number" />
                        <Input name="nFiscalizacao" label="Nº Fiscalização (Ação/Demanda)" value={formData.nFiscalizacao || ''} onChange={handleChange} placeholder="Ex: 56.789/24-9" />
                        <AutocompleteInput name="municipio" label="Município" value={formData.municipio} onChange={handleChange} required options={MUNICIPIOS_PR} error={errors.municipio} />
                        <AutocompleteInput name="modalidade" label="Modalidade" value={formData.modalidade || ''} onChange={handleChange} options={autocompleteOptions.modalidade} placeholder="Ex: Auditoria" />
                        <AutocompleteInput name="tema" label="Tema" value={formData.tema || ''} onChange={handleChange} options={autocompleteOptions.tema} placeholder="Ex: Iluminação Pública" />
                        <Input name="valor" label="Valor Estimado (R$)" placeholder="Ex: 154000.00" value={formData.valor || ''} onChange={handleChange} error={errors.valor} />
                        <Select name="status" label="Status Atual" value={formData.status} onChange={handleChange}>
                            <option value="Pendente">Pendente</option>
                            <option value="Fiscalização em Curso">Fiscalização em Curso</option>
                            <option value="Aguardando Manifestação">Aguardando Manifestação</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Revogado">Revogado</option>
                            <option value="Suspenso">Suspenso</option>
                            <option value="Sem Fiscalização">Sem Fiscalização</option>
                        </Select>
                    </div>
                </div>

                {/* Card 2: Documentos e Protocolos Externos */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-tcepr-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span className="text-sm">📄</span>
                        <span>Documentação de Suporte e Protocolos Externos</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                        <DateInput name="dataReqExterno" label="Data do Requisito Externo" value={formData.dataReqExterno || ''} onChange={handleChange} />
                        <Input name="requerimentoExterno" label="Protocolo do Requerimento Externo" placeholder="Ex: 654321/2024" value={formData.requerimentoExterno || ''} onChange={handleChange} />
                        <Input name="encaminhamentoProcessual" label="Encaminhamento Processual" placeholder="Ex: 123456/2023" value={formData.encaminhamentoProcessual || ''} onChange={handleChange} />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Representação Externa</label>
                        <div className="space-y-2">
                            {formData.representacaoExterna?.map((rep, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={rep} 
                                        onChange={(e) => handleRepresentacaoChange(index, e.target.value)} 
                                        placeholder="Ex: 40141-9/23" 
                                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all" 
                                    />
                                    {(formData.representacaoExterna?.length || 0) > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeRepresentacao(index)} 
                                            className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" 
                                            title="Remover"
                                        >
                                            <MinusCircleIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                    {index === (formData.representacaoExterna?.length || 0) - 1 && (
                                        <button 
                                            type="button" 
                                            onClick={addRepresentacao} 
                                            className="p-2 text-tcepr-700 hover:text-tcepr-800 hover:bg-tcepr-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs" 
                                            title="Adicionar Novo"
                                        >
                                            <PlusCircleIcon className="h-5 w-5" />
                                            <span className="hidden sm:inline">Adicionar</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Card 3: Observações e Notas do Processo */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <FormIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                            <h3 className="text-xs font-bold text-tcepr-700 uppercase tracking-wider">
                                Observações e Notas do Processo
                            </h3>
                            {parsedNotes.length > 0 && (
                                <span className="bg-tcepr-50 text-tcepr-750 font-bold text-[10px] px-2 py-0.5 rounded-full border border-tcepr-200">
                                    {parsedNotes.length} {parsedNotes.length === 1 ? 'nota' : 'notas'}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingNoteIndex(null);
                                setIsAddObsModalOpen(true);
                            }}
                            className="text-xs font-bold text-tcepr-700 hover:text-white bg-tcepr-50 hover:bg-tcepr-700 px-3 py-1.5 rounded-xl border border-tcepr-200 hover:border-tcepr-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                            title="Inserir uma nova observação ou nota"
                        >
                            <PlusCircleIcon className="h-4 w-4 text-tcepr-600 group-hover:text-white" />
                            <span>+ Inserir Observação ou Nota</span>
                        </button>
                    </div>

                    {/* Timeline / Saved Notes List */}
                    {parsedNotes.length === 0 ? (
                        <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-250 rounded-xl space-y-2">
                            <p className="text-xs font-bold text-slate-600">Nenhuma observação ou nota cadastrada ainda.</p>
                            <p className="text-[11px] text-slate-500">
                                Para incluir um andamento, prazos ou registros, clique em <strong className="text-tcepr-700">+ Inserir Observação ou Nota</strong> acima.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {parsedNotes.map((note, noteIdx) => (
                                <div key={note.id || noteIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                                    <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="bg-tcepr-700 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-md shadow-2xs">
                                                [{note.dateStr}]
                                            </span>
                                            <span className="font-bold text-xs text-slate-800">
                                                {note.title}
                                            </span>
                                            {note.prazoDias !== null && note.prazoDias !== undefined ? (
                                                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-md">
                                                    Prazo: {note.prazoDias} dias {note.limitDateStr ? `(Limite: ${note.limitDateStr})` : ''}
                                                </span>
                                            ) : (
                                                <span className="bg-slate-200 text-slate-700 font-semibold text-[10px] px-2 py-0.5 rounded-md">
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
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleStartEditNote(noteIdx)}
                                                className="text-slate-400 hover:text-tcepr-700 p-1 rounded-lg hover:bg-tcepr-50 transition-colors cursor-pointer"
                                                title="Editar esta nota"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteNote(noteIdx)}
                                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                                title="Excluir esta nota"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {note.bodyHtml && (
                                        <div
                                            className="observation-note-content font-sans text-xs text-slate-700 leading-relaxed pt-1 space-y-1.5 [&_p]:leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_strong]:font-bold [&_strong]:text-slate-800 [&_b]:font-bold [&_b]:text-slate-800 [&_a]:text-tcepr-700 [&_a]:underline"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.bodyHtml) }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Card 4: Arquivo Principal / Relatórios da Fiscalização */}
                <div className="p-5 md:p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs text-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-tcepr-700 uppercase tracking-wider flex items-center gap-2">
                            <DocumentArrowDownIcon className="h-4 w-4 text-tcepr-600" />
                            <span>Arquivo Principal / Relatórios da Fiscalização</span>
                        </h3>
                        <span className="text-[11px] text-tcepr-700 font-bold bg-tcepr-50 px-2.5 py-0.5 rounded-full border border-tcepr-100">
                            Inserir, substituir e excluir arquivos
                        </span>
                    </div>

                    {/* Hidden input for file replacement */}
                    <input
                        ref={replaceFileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={handleReplaceReportFile}
                        className="hidden"
                    />

                    {/* Componente de Progresso Visual de Anexação e Resumo com IA */}
                    {processProgress.active && (
                        <div className={`p-4 rounded-2xl border transition-all duration-300 shadow-sm ${
                            processProgress.step === 'success' 
                                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' 
                                : processProgress.step === 'error'
                                ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                                : 'bg-gradient-to-r from-sky-50 via-indigo-50/80 to-purple-50/80 border-sky-200 text-slate-800'
                        }`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    {/* Ícone de Progresso Dinâmico */}
                                    <div className={`p-2.5 rounded-xl border shrink-0 transition-transform ${
                                        processProgress.step === 'uploading'
                                            ? 'bg-sky-500 text-white border-sky-400 shadow-sm animate-pulse'
                                            : processProgress.step === 'extracting'
                                            ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm animate-pulse'
                                            : processProgress.step === 'summarizing'
                                            ? 'bg-gradient-to-tr from-amber-500 to-purple-600 text-white border-amber-300 shadow-md animate-pulse'
                                            : processProgress.step === 'success'
                                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                                            : 'bg-amber-500 text-white border-amber-400 shadow-sm'
                                    }`}>
                                        {processProgress.step === 'success' ? (
                                            <CheckCircleIcon className="h-6 w-6 text-white" />
                                        ) : processProgress.step === 'error' ? (
                                            <AlertIcon className="h-6 w-6 text-white" />
                                        ) : processProgress.step === 'summarizing' ? (
                                            <SparklesIcon className="h-6 w-6 text-white animate-spin" />
                                        ) : (
                                            <LoaderIcon className="h-6 w-6 text-white animate-spin" />
                                        )}
                                    </div>

                                    {/* Textos de Andamento */}
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs sm:text-sm font-bold tracking-tight">
                                                {processProgress.stageText}
                                            </span>
                                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
                                                {processProgress.progress}%
                                            </span>
                                        </div>
                                        {processProgress.detailText && (
                                            <p className="text-xs text-slate-600 font-medium mt-0.5 break-words">
                                                {processProgress.detailText}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {(processProgress.step === 'success' || processProgress.step === 'error') && (
                                    <button
                                        type="button"
                                        onClick={() => setProcessProgress(prev => ({ ...prev, active: false }))}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-colors"
                                        title="Fechar status"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Barra de Progresso Animada */}
                            <div className="mt-3 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden shadow-inner">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-500 ease-out ${
                                        processProgress.step === 'success'
                                            ? 'bg-emerald-500'
                                            : processProgress.step === 'error'
                                            ? 'bg-amber-500'
                                            : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600'
                                    }`}
                                    style={{ width: `${processProgress.progress}%` }}
                                />
                            </div>

                            {/* Etapas do Processo */}
                            <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px] font-semibold border-t border-slate-200/60 pt-2.5">
                                <div className={`flex items-center gap-1.5 ${
                                    processProgress.progress >= 20 ? 'text-sky-700 font-bold' : 'text-slate-400'
                                }`}>
                                    {processProgress.progress > 30 ? (
                                        <span className="text-emerald-600 font-bold">✓</span>
                                    ) : processProgress.step === 'uploading' ? (
                                        <LoaderIcon className="h-3 w-3 animate-spin text-sky-600" />
                                    ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    )}
                                    <span className="truncate">1. Anexar Arquivo</span>
                                </div>

                                <div className={`flex items-center gap-1.5 ${
                                    processProgress.progress >= 50 ? 'text-indigo-700 font-bold' : 'text-slate-400'
                                }`}>
                                    {processProgress.progress > 65 ? (
                                        <span className="text-emerald-600 font-bold">✓</span>
                                    ) : processProgress.step === 'extracting' ? (
                                        <LoaderIcon className="h-3 w-3 animate-spin text-indigo-600" />
                                    ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    )}
                                    <span className="truncate">2. Ler Achados</span>
                                </div>

                                <div className={`flex items-center gap-1.5 ${
                                    processProgress.progress >= 75 ? 'text-purple-700 font-bold' : 'text-slate-400'
                                }`}>
                                    {processProgress.step === 'success' ? (
                                        <span className="text-emerald-600 font-bold">✓</span>
                                    ) : processProgress.step === 'summarizing' ? (
                                        <SparklesIcon className="h-3 w-3 animate-spin text-amber-500" />
                                    ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    )}
                                    <span className="truncate">3. Resumo por IA</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {(!formData.relatorioArquivos || formData.relatorioArquivos.length === 0) && !formData.relatorioNomeArquivo ? (
                        <div className="relative border-2 border-dashed border-slate-250 hover:border-tcepr-400 bg-slate-50/60 hover:bg-slate-50 rounded-2xl p-6 text-center transition-all cursor-pointer group shadow-2xs">
                            <input 
                                type="file" 
                                multiple
                                accept=".pdf,.docx,.doc,.txt"
                                onChange={handleReportFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isExtractingReport}
                            />
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-tcepr-50 text-tcepr-600 flex items-center justify-center group-hover:scale-105 transition-transform border border-tcepr-100">
                                    {isExtractingReport || isSummarizingReport ? (
                                        <LoaderIcon className="h-5 w-5 animate-spin text-tcepr-600" />
                                    ) : (
                                        <UploadIcon className="h-5 w-5" />
                                    )}
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-tcepr-750">
                                    {isExtractingReport ? (processProgress.stageText || 'Lendo e anexando arquivo principal...') : 'Inserir Arquivo Principal (PDF ou DOCX)'}
                                </span>
                                <span className="text-[11px] text-slate-400 max-w-md">
                                    Selecione ou arraste o arquivo principal desta fiscalização para armazenar o documento oficial e gerar o resumo automático com IA
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    📂 {formData.relatorioArquivos?.length || 1} Arquivo(s) Principal(is) Anexado(s)
                                </span>
                                <div className="flex items-center gap-2">
                                    <label className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 border border-slate-200 hover:border-slate-300 active:scale-95 shadow-2xs">
                                        <PlusCircleIcon className="h-4 w-4 text-tcepr-600" />
                                        <span>Inserir Mais Arquivo(s)</span>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept=".pdf,.docx,.doc,.txt" 
                                            onChange={handleReportFileUpload} 
                                            className="hidden" 
                                            disabled={isExtractingReport}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSummaryFromAttachedReport}
                                        disabled={isSummarizingReport || isExtractingReport}
                                        className="px-3 py-1.5 bg-tcepr-700 hover:bg-tcepr-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 border border-tcepr-600/20 shadow-xs"
                                    >
                                        <SparklesIcon className="h-3.5 w-3.5 text-amber-300" />
                                        <span>{isSummarizingReport ? 'Sintetizando...' : 'Gerar Resumo (IA)'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemoveAllFiles}
                                        disabled={isExtractingReport}
                                        className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Excluir Todos
                                    </button>
                                </div>
                            </div>

                            {/* List of individual files */}
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {formData.relatorioArquivos && formData.relatorioArquivos.length > 0 ? (
                                    formData.relatorioArquivos.map((fileItem, idx) => {
                                        const isPdf = fileItem.nome.toLowerCase().endsWith('.pdf');
                                        const isDocx = fileItem.nome.toLowerCase().endsWith('.docx') || fileItem.nome.toLowerCase().endsWith('.doc');

                                        return (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 transition-colors gap-2.5 shadow-2xs">
                                                <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                                                    <div className={`p-1.5 rounded-lg shrink-0 font-bold text-[10px] ${
                                                        isPdf ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        isDocx ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                                    }`}>
                                                        {isPdf ? 'PDF' : isDocx ? 'DOCX' : 'TXT'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-slate-800 truncate block">{fileItem.nome}</span>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-0.5">
                                                            {fileItem.tamanho ? <span>{formatBytes(fileItem.tamanho)}</span> : null}
                                                            {fileItem.dataUpload ? <span>• {fileItem.dataUpload}</span> : null}
                                                            {fileItem.url ? (
                                                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[9px] font-semibold">Nuvem</span>
                                                            ) : fileItem.base64Data ? (
                                                                <span className="text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 text-[9px] font-semibold">Salvo</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleFormDownloadFile(fileItem)}
                                                        className="px-2.5 py-1 text-slate-600 hover:text-tcepr-700 hover:bg-tcepr-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-slate-200"
                                                        title="Baixar arquivo original"
                                                    >
                                                        <DownloadIcon className="h-3 w-3 text-tcepr-600" />
                                                        <span>Baixar</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerReplaceFile(idx)}
                                                        disabled={isExtractingReport}
                                                        className="px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-slate-200 disabled:opacity-50"
                                                        title="Substituir este arquivo por outro"
                                                    >
                                                        <UploadIcon className="h-3 w-3 text-amber-600" />
                                                        <span>Substituir</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSingleFile(idx)}
                                                        disabled={isExtractingReport}
                                                        className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-transparent hover:border-rose-200 disabled:opacity-50"
                                                        title="Excluir este arquivo"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5 text-rose-500" />
                                                        <span>Excluir</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                                                <DocumentArrowDownIcon className="h-4 w-4" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-800">{formData.relatorioNomeArquivo}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => triggerReplaceFile(0)}
                                                disabled={isExtractingReport}
                                                className="px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-slate-200"
                                                title="Substituir este arquivo"
                                            >
                                                <UploadIcon className="h-3 w-3 text-amber-600" />
                                                <span>Substituir</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveAllFiles}
                                                disabled={isExtractingReport}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                title="Excluir este arquivo"
                                            >
                                                <TrashIcon className="h-4 w-4 text-rose-500" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {fileExtractError && (
                        <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-850 text-xs space-y-1.5 shadow-2xs">
                            <div className="flex items-start gap-1.5 font-bold text-rose-800">
                                <span>⚠️</span>
                                <span>{fileExtractError}</span>
                            </div>
                            {fileExtractError.includes('ai.studio/spend') && (
                                <div className="pt-1">
                                    <a
                                        href="https://ai.studio/spend"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                                    >
                                        <span>Gerenciar Limite de Gastos em ai.studio/spend</span>
                                        <span className="text-xs">↗</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Resumo do Relatório (IA) field preview */}
                    <div className="pt-2 border-t border-slate-200">
                        <div className="flex flex-wrap justify-between items-center mb-1.5 gap-2">
                            <label className="text-xs font-bold text-tcepr-700 uppercase tracking-wider flex items-center gap-1.5">
                                <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
                                <span>Resumo do Relatório (IA)</span>
                                {isSummarizingReport && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                        <SparklesIcon className="h-3 w-3 text-amber-600 animate-spin" />
                                        <span>IA redigindo resumo narrativo...</span>
                                    </span>
                                )}
                                {formData.resumoRelatorio && !isSummarizingReport && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                                        <span>Resumo preenchido</span>
                                    </span>
                                )}
                            </label>
                        </div>
                        <div className="relative">
                            <textarea
                                value={formData.resumoRelatorio || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, resumoRelatorio: e.target.value }))}
                                placeholder={isSummarizingReport ? "Aguarde: A inteligência artificial está analisando os achados do relatório e gerando o resumo narrativo..." : "Resumo síntese dos achados e constatações deste relatório..."}
                                rows={4}
                                disabled={isSummarizingReport}
                                className={`w-full p-3 bg-white border rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 shadow-inner transition-colors ${
                                    isSummarizingReport ? 'border-amber-400 bg-amber-50/20 animate-pulse' : 'border-slate-200'
                                }`}
                            />
                            {isSummarizingReport && (
                                <div className="absolute right-3 bottom-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-xs rounded-lg border border-amber-300 shadow-xs text-[11px] font-bold text-amber-800">
                                    <LoaderIcon className="h-3.5 w-3.5 animate-spin text-amber-600" />
                                    <span>Processando achados...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-4 border-t border-slate-200">
                    <div>
                        {editingDemand && (
                            <button 
                                type="button" 
                                onClick={() => onOpenSummarizeModal({ ...editingDemand, ...formData, id: editingDemand.id, createdAt: editingDemand.createdAt })} 
                                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-xl shadow-xs border border-cyan-600/20 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
                            >
                                <SummarizeIcon className="h-5 w-5" /> 
                                <span>Revisar e Gerar Resumo com IA</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                        <button 
                            type="button" 
                            onClick={onCancelEdit} 
                            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all active:scale-95 cursor-pointer border border-slate-200"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="px-7 py-2.5 bg-gradient-to-r from-tcepr-700 to-tcepr-600 hover:from-tcepr-600 hover:to-tcepr-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs border border-tcepr-600/20 transition-all active:scale-95 cursor-pointer"
                        >
                            {editingDemand ? 'Salvar Edições' : 'Cadastrar Fiscalização'}
                        </button>
                    </div>
                </div>
            </form>

        <AddObservationModal
            isOpen={isAddObsModalOpen}
            onClose={() => {
                setIsAddObsModalOpen(false);
                setEditingNoteIndex(null);
            }}
            onAddObservation={handleAddObservation}
            editingNote={
                editingNoteIndex !== null && parsedNotes[editingNoteIndex]
                    ? {
                          index: editingNoteIndex,
                          date: parsedNotes[editingNoteIndex].date,
                          dateStr: parsedNotes[editingNoteIndex].dateStr,
                          title: parsedNotes[editingNoteIndex].title,
                          prazoDias: parsedNotes[editingNoteIndex].prazoDias,
                          bodyHtml: parsedNotes[editingNoteIndex].bodyHtml,
                          isConcluded: parsedNotes[editingNoteIndex].isConcluded,
                          concludedDateStr: parsedNotes[editingNoteIndex].concludedDateStr,
                      }
                    : null
            }
        />
    </>
);
};

// Generic Form Components
const Input: React.FC<{ name: string; label: string; error?: string; required?: boolean;[x: string]: any; }> = ({ name, label, required, error, ...props }) => (
    <div className="space-y-1.5">
        <label htmlFor={name} className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label} {required && <span className="text-rose-500">*</span>}</label>
        <input 
            id={name} 
            name={name} 
            {...props} 
            className={`w-full px-3.5 py-2.5 bg-white border rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 ${error ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-200 hover:border-slate-300'}`} 
        />
        {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
    </div>
);

const DateInput: React.FC<{ name: string; label: string; required?: boolean;[x: string]: any; }> = ({ name, label, required, ...props }) => (
    <div className="space-y-1.5">
        <label htmlFor={name} className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label} {required && <span className="text-rose-500">*</span>}</label>
        <div className="relative">
            <input 
                id={name} 
                name={name} 
                type="date" 
                {...props} 
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 appearance-none pr-10" 
            />
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <CalendarIcon className="h-5 w-5" />
            </div>
        </div>
    </div>
);

const Select: React.FC<{ name: string; label: string; required?: boolean; children: React.ReactNode; [x: string]: any; }> = ({ name, label, required, children, ...props }) => (
    <div className="space-y-1.5">
        <label htmlFor={name} className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label} {required && <span className="text-rose-500">*</span>}</label>
        <select 
            id={name} 
            name={name} 
            {...props} 
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800"
        >
            {children}
        </select>
    </div>
);

const AutocompleteInput: React.FC<{ name: string; label: string; required?: boolean; options?: string[]; error?: string; [x: string]: any; }> = ({ name, label, required, options = [], error, ...props }) => {
    const listId = `list-${name}`;
    return (
        <div className="space-y-1.5">
            <label htmlFor={name} className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label} {required && <span className="text-rose-500">*</span>}</label>
            <input 
                id={name} 
                name={name} 
                list={listId} 
                {...props} 
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 focus:outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 ${error ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-200 hover:border-slate-300'}`} 
            />
            <datalist id={listId}>
                {options.map((option, index) => <option key={index} value={option} />)}
            </datalist>
            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
        </div>
    );
};

export default DemandForm;
