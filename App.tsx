
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import DOMPurify from 'dompurify';
import { Demand, Toast as ToastType, AutocompleteOptions, ActivityLogItem } from './types';
import { FormIcon, XMarkIcon, TceprLogoIcon } from './components/icons';
import DemandList from './components/DemandList';
import AlertsSection from './components/AlertsSection';
import ActivityHistorySection from './components/ActivityHistorySection';
import ViewDetailsModal from './components/modals/ViewDetailsModal';
import DemandFormModal from './components/modals/DemandFormModal';
import SidebarMenu from './components/SidebarMenu';
import AuthScreen from './components/AuthScreen';
import UserDataModal from './components/modals/UserDataModal';
import { auth, db } from './services/firebase';

import SummarizeModal from './components/modals/SummarizeModal';
import ConfirmationModal from './components/modals/ConfirmationModal';
import AnalysisModal from './components/modals/AnalysisModal';
import DashboardModal from './components/modals/DashboardModal';
import SavedFindingsModal from './components/modals/SavedFindingsModal';
import ReportFindingsModal from './components/modals/ReportFindingsModal';
import FortnightReportModal from './components/modals/FortnightReportModal';
import { ConcludeNoteModal } from './components/modals/ConcludeNoteModal';
import Toast from './components/Toast';
import { debounce, normalizeYear, normalizeForSearch, getCreatedAtMillis } from './utils/helpers';
import { concludeObservationNote, findNewlyAddedOrLatestNote, diffObservationNotes, parseObservations, getDemandDeadlineInfo, formatIsoInputDate } from './utils/deadlineUtils';
import { getDemandChangesSummary } from './utils/logUtils';

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authInitializing, setAuthInitializing] = useState<boolean>(true);
    const [demands, setDemands] = useState<Demand[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [toasts, setToasts] = useState<ToastType[]>([]);
    const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
    const [viewingDemand, setViewingDemand] = useState<Demand | null>(null);
    const [summarizeModalDemand, setSummarizeModalDemand] = useState<Demand | null>(null);
    const [deletingDemandId, setDeletingDemandId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchInputKey, setSearchInputKey] = useState<number>(0);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);
    const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [deadlineFilter, setDeadlineFilter] = useState<string>('');
    const [scrollToSummary, setScrollToSummary] = useState<boolean>(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);
    const [isFortnightReportOpen, setIsFortnightReportOpen] = useState<boolean>(false);
    const [isSavedFindingsOpen, setIsSavedFindingsOpen] = useState<boolean>(false);
    const [isReportFindingsOpen, setIsReportFindingsOpen] = useState<boolean>(false);
    const [isUserDataModalOpen, setIsUserDataModalOpen] = useState<boolean>(false);
    const [concludingNoteTarget, setConcludingNoteTarget] = useState<{ demand: Demand; noteId: string; noteTitle?: string; initialDetails?: string } | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [demandsPerPage, setDemandsPerPage] = useState<number>(25);

    const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);

    // Track Auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setAuthInitializing(false);
            if (user && db) {
                try {
                    await setDoc(doc(db, 'users', user.uid), {
                        email: user.email,
                        displayName: user.displayName || '',
                        lastLoginAt: new Date().toISOString(),
                    }, { merge: true });
                } catch (err) {
                    console.warn('Failed to sync user document:', err);
                }
            } else if (!user) {
                setDemands([]);
                setIsLoading(false);
                setActivityLogs([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Load user activity logs when currentUser changes
    useEffect(() => {
        if (!currentUser) return;
        try {
            const saved = localStorage.getItem(`activity_history_logs_${currentUser.uid}`);
            setActivityLogs(saved ? JSON.parse(saved) : []);
        } catch {
            setActivityLogs([]);
        }
    }, [currentUser]);

    const addActivityLog = (logItem: Omit<ActivityLogItem, 'id' | 'timestamp'>) => {
        if (!currentUser) return;
        const now = new Date();
        const newLog: ActivityLogItem = {
            ...logItem,
            id: `log_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            isoDate: now.toISOString(),
        };
        setActivityLogs(prev => {
            const updated = [newLog, ...prev].slice(0, 50);
            try {
                localStorage.setItem(`activity_history_logs_${currentUser.uid}`, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save activity log', e);
            }
            return updated;
        });
    };

    const handleClearActivityLogs = () => {
        if (!currentUser) return;
        setActivityLogs([]);
        try {
            localStorage.removeItem(`activity_history_logs_${currentUser.uid}`);
        } catch (e) {
            console.error('Failed to clear activity logs', e);
        }
        addToast('Histórico de registros limpo.', 'info');
    };

    const handleDeleteActivityLog = (logId: string) => {
        if (!currentUser) return;
        setActivityLogs(prev => {
            const updated = prev.filter(item => item.id !== logId);
            try {
                localStorage.setItem(`activity_history_logs_${currentUser.uid}`, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to update activity log', e);
            }
            return updated;
        });
        addToast('Registro removido do histórico.', 'info');
    };

    // Real-time listener for user-isolated demands
    useEffect(() => {
        if (!currentUser || !db) return;
        setIsLoading(true);
        const demandsCollectionPath = `users/${currentUser.uid}/demands`;
        // Do NOT use orderBy in Firestore query: Firestore silently drops any document missing that field!
        const colRef = collection(db, demandsCollectionPath);
        const unsubscribe = onSnapshot(colRef, (querySnapshot) => {
            const demandsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Demand));
            setDemands(demandsData);
            setIsLoading(false);
        }, (err: any) => {
            console.error('Error fetching demands:', err);
            setError(`Não foi possível carregar o portfólio de fiscalizações: ${err.message}`);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, db]);

    // Deduplication key generator.
    // Only an explicit identifier (Nº Fiscalização or Nº Processo) can mark two records as the same;
    // records without identifiers are never considered duplicates of each other.
    const getDemandDedupKey = (d: Partial<Demand>): string => {
        const normMun = (d.municipio || '').trim().toLowerCase();
        // keep "/" and "-" so that e.g. 184/26 and 1842/6 stay distinct; drop spaces, dots and leading zeros
        const cleanNFisc = (d.nFiscalizacao || '').trim().toLowerCase().replace(/[\s.]/g, '').replace(/^0+/, '');
        const normAno = normalizeYear(d.ano);
        if (cleanNFisc && cleanNFisc !== '-' && cleanNFisc !== 'sn' && cleanNFisc !== 'nao') {
            return `nf_${cleanNFisc}_${normMun || 'unknown'}_${normAno}`;
        }
        const cleanProc = (d.numeroProcesso || '').trim().toLowerCase().replace(/[\s.]/g, '');
        if (cleanProc) {
            return `proc_${cleanProc}_${normMun || 'unknown'}`;
        }
        return `uniq_${d.id || `${Date.now()}_${Math.random()}`}`;
    };

    // Calculate score for picking the most complete demand among duplicates
    const getDemandScore = (d: Demand): number => {
        let score = 0;
        if (d.resumoRelatorio?.trim()) score += 1000 + d.resumoRelatorio.length;
        if (d.observacoes?.trim()) score += 500 + d.observacoes.length;
        if (d.relatorioTextoCompleto?.trim()) score += 200;
        if (d.relatorioArquivos && d.relatorioArquivos.length > 0) score += 300;
        if (d.representacaoExterna && (Array.isArray(d.representacaoExterna) ? d.representacaoExterna.length > 0 : !!d.representacaoExterna)) score += 50;
        if (d.valor) score += 50;
        if (d.numeroProcesso?.trim()) score += 50;
        score += Math.min(getCreatedAtMillis(d.createdAt) / 1000000000, 100);
        return score;
    };

    // Deduplicated demands in-memory
    const deduplicatedDemands = useMemo<Demand[]>(() => {
        const groups = new Map<string, Demand[]>();
        demands.forEach(d => {
            const key = getDemandDedupKey(d);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(d);
        });

        const result: Demand[] = [];
        groups.forEach(groupDemands => {
            if (groupDemands.length === 1) {
                result.push(groupDemands[0]);
            } else {
                const sorted = [...groupDemands].sort((a, b) => getDemandScore(b) - getDemandScore(a));
                result.push(sorted[0]);
            }
        });
        return result;
    }, [demands]);

    const duplicateDocsCount = Math.max(0, demands.length - deduplicatedDemands.length);
    const isCleaningDuplicatesRef = useRef<boolean>(false);

    // Database deduplication cleanup handler with batch operations
    const handleRemoveDuplicates = async (silent: boolean = false) => {
        if (!currentUser || !db || isCleaningDuplicatesRef.current) return;
        isCleaningDuplicatesRef.current = true;
        try {
            const groups = new Map<string, Demand[]>();
            demands.forEach(d => {
                const key = getDemandDedupKey(d);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(d);
            });

            const idsToDelete: string[] = [];
            groups.forEach(groupDemands => {
                if (groupDemands.length > 1) {
                    const sorted = [...groupDemands].sort((a, b) => getDemandScore(b) - getDemandScore(a));
                    sorted.slice(1).forEach(dup => {
                        if (dup.id) idsToDelete.push(dup.id);
                    });
                }
            });

            if (idsToDelete.length === 0) {
                if (!silent) addToast('Nenhuma fiscalização duplicada encontrada no banco.', 'info');
                return;
            }

            // Delete in Firestore batches (max 400 operations per batch)
            const BATCH_SIZE = 400;
            for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
                const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(id => {
                    batch.delete(doc(db, `users/${currentUser.uid}/demands/${id}`));
                });
                await batch.commit();
            }

            addActivityLog({
                demandId: 'dedup',
                municipio: 'Geral',
                actionType: 'exclusao_fiscalizacao',
                title: `Remoção de ${idsToDelete.length} Duplicidades`,
                details: `Foram removidas ${idsToDelete.length} fiscalizações duplicadas do banco de dados para garantir a integridade dos dados.`,
            });
            if (!silent) {
                addToast(`${idsToDelete.length} fiscalizações duplicadas foram removidas com sucesso!`, 'success');
            }
        } catch (e: any) {
            console.error('Error removing duplicates:', e);
            if (!silent) addToast(`Erro ao remover duplicidades: ${e.message}`, 'error');
        } finally {
            isCleaningDuplicatesRef.current = false;
        }
    };

    const toastIdRef = useRef<number>(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        // Sequential id: Date.now() collides when two toasts are created in the same millisecond
        const id = ++toastIdRef.current;
        setToasts((prev) => [...prev, { id, message, type }]);
    };

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            addToast('Sessão encerrada com sucesso.', 'info');
        } catch (e: any) {
            addToast(`Erro ao encerrar sessão: ${e.message}`, 'error');
        }
    };

    const handleAddDemand = async (demandData: Omit<Demand, 'id' | 'createdAt'>) => {
        if (!db || !currentUser) return;
        try {
            const sanitizedObservacoes = DOMPurify.sanitize(demandData.observacoes || '');
            const newKey = getDemandDedupKey(demandData);

            // Prevent duplicate creation without overwriting the existing record: keep the form open
            const existingDemand = demands.find(d => getDemandDedupKey(d) === newKey);
            if (existingDemand) {
                addToast(`Já existe uma fiscalização com este número em ${existingDemand.municipio} (${existingDemand.ano}). Edite o registro existente.`, 'error');
                return;
            }

            const docRef = await addDoc(collection(db, `users/${currentUser.uid}/demands`), {
                ...demandData,
                observacoes: sanitizedObservacoes,
                createdAt: new Date(),
            });
            setIsFormModalOpen(false);

            addActivityLog({
                demandId: docRef.id,
                municipio: demandData.municipio,
                nFiscalizacao: demandData.nFiscalizacao,
                ano: demandData.ano,
                status: demandData.status,
                actionType: 'cadastrada',
                title: 'Nova Fiscalização Cadastrada',
                details: sanitizedObservacoes ? findNewlyAddedOrLatestNote(sanitizedObservacoes) : undefined
            });

            addToast('Fiscalização cadastrada com sucesso!');
        } catch (e: any) {
            setError(`Erro ao cadastrar fiscalização: ${e.message}`);
            addToast('Falha ao adicionar fiscalização.', 'error');
        }
    };

    const handleUpdateDemand = async (demandData: Demand) => {
        if (!db || !editingDemand || !currentUser) return;
        try {
            const { id, ...dataToUpdate } = demandData;
            dataToUpdate.observacoes = DOMPurify.sanitize(dataToUpdate.observacoes || '');
            await updateDoc(doc(db, `users/${currentUser.uid}/demands/${editingDemand.id}`), dataToUpdate);

            const diff = diffObservationNotes(editingDemand.observacoes, dataToUpdate.observacoes);

            if (diff.addedNotes.length > 0) {
                diff.addedNotes.forEach(note => {
                    addActivityLog({
                        demandId: editingDemand.id,
                        municipio: dataToUpdate.municipio || editingDemand.municipio,
                        nFiscalizacao: dataToUpdate.nFiscalizacao || editingDemand.nFiscalizacao,
                        ano: dataToUpdate.ano || editingDemand.ano,
                        status: dataToUpdate.status || editingDemand.status,
                        actionType: 'inclusao_nota',
                        title: `Inclusão de Nota: "${note.title}" (${note.dateStr})`,
                        details: note.rawBlockHtml
                    });
                });
            }

            if (diff.removedNotes.length > 0) {
                diff.removedNotes.forEach(note => {
                    addActivityLog({
                        demandId: editingDemand.id,
                        municipio: dataToUpdate.municipio || editingDemand.municipio,
                        nFiscalizacao: dataToUpdate.nFiscalizacao || editingDemand.nFiscalizacao,
                        ano: dataToUpdate.ano || editingDemand.ano,
                        status: dataToUpdate.status || editingDemand.status,
                        actionType: 'exclusao_nota',
                        title: `Exclusão de Nota: "${note.title}" (${note.dateStr})`,
                        details: `<p class="text-rose-300">Nota excluída/removida: <strong>${note.title}</strong> (${note.dateStr})</p>`
                    });
                });
            }

            const fieldSummary = getDemandChangesSummary(editingDemand, { id: editingDemand.id, ...dataToUpdate } as Demand);

            if (fieldSummary.hasChanges) {
                addActivityLog({
                    demandId: editingDemand.id,
                    municipio: dataToUpdate.municipio || editingDemand.municipio,
                    nFiscalizacao: dataToUpdate.nFiscalizacao || editingDemand.nFiscalizacao,
                    ano: dataToUpdate.ano || editingDemand.ano,
                    status: dataToUpdate.status || editingDemand.status,
                    actionType: 'atualizada',
                    title: fieldSummary.title,
                    details: fieldSummary.details,
                });
            } else if (diff.addedNotes.length === 0 && diff.removedNotes.length === 0) {
                addActivityLog({
                    demandId: editingDemand.id,
                    municipio: dataToUpdate.municipio || editingDemand.municipio,
                    nFiscalizacao: dataToUpdate.nFiscalizacao || editingDemand.nFiscalizacao,
                    ano: dataToUpdate.ano || editingDemand.ano,
                    status: dataToUpdate.status || editingDemand.status,
                    actionType: 'atualizada',
                    title: 'Dados da Fiscalização Atualizados',
                });
            }

            setEditingDemand(null);
            setIsFormModalOpen(false);
            addToast('Fiscalização atualizada com sucesso!');
        } catch (e: any) {
            setError(`Erro ao atualizar fiscalização: ${e.message}`);
            addToast('Falha ao atualizar fiscalização.', 'error');
        }
    };

    const handleConcludeNote = (demand: Demand, noteId: string, noteTitle?: string) => {
        const notes = parseObservations(demand.observacoes);
        const targetNote = notes.find((n) => n.id === noteId);
        const initialDetails = targetNote?.bodyHtml || '';
        setConcludingNoteTarget({
            demand,
            noteId,
            noteTitle: noteTitle || targetNote?.title || '',
            initialDetails
        });
    };

    const handleConfirmConcludeNote = async (concludedDateStr: string, detailsHtml?: string) => {
        if (!concludingNoteTarget || !db || !currentUser) return;
        const { demand, noteId, noteTitle } = concludingNoteTarget;
        try {
            const updatedHtml = concludeObservationNote(demand.observacoes || '', noteId, concludedDateStr, detailsHtml);
            setDemands((prevDemands) =>
                prevDemands.map((d) => (d.id === demand.id ? { ...d, observacoes: updatedHtml } : d))
            );
            await updateDoc(doc(db, `users/${currentUser.uid}/demands/${demand.id}`), { observacoes: updatedHtml });
            
            if (viewingDemand && viewingDemand.id === demand.id) {
                setViewingDemand(prev => prev ? { ...prev, observacoes: updatedHtml } : null);
            }

            const plainDetails = detailsHtml ? detailsHtml.replace(/<[^>]*>/g, '').trim() : '';
            addActivityLog({
                demandId: demand.id,
                municipio: demand.municipio,
                nFiscalizacao: demand.nFiscalizacao,
                ano: demand.ano,
                status: demand.status,
                actionType: 'conclusao_nota',
                title: `Nota Concluída (${concludedDateStr})`,
                details: plainDetails
                    ? `Nota "${noteTitle || 'Observação'}" concluída em ${concludedDateStr}. Detalhes: ${plainDetails.slice(0, 120)}${plainDetails.length > 120 ? '...' : ''}`
                    : `Nota "${noteTitle || 'Observação'}" da fiscalização do município de ${demand.municipio} (${demand.ano}) marcada como concluída em ${concludedDateStr}.`
            });

            addToast(`Nota concluída com data de ${concludedDateStr}!`);
        } catch (e: any) {
            addToast(`Erro ao concluir nota: ${e.message}`, 'error');
        } finally {
            setConcludingNoteTarget(null);
        }
    };

    const handleDeleteDemand = async (demandId: string) => {
        if (!db || !demandId || !currentUser) return;
        try {
            const target = demands.find(d => d.id === demandId);
            await deleteDoc(doc(db, `users/${currentUser.uid}/demands/${demandId}`));

            if (target) {
                addActivityLog({
                    demandId: demandId,
                    municipio: target.municipio,
                    nFiscalizacao: target.nFiscalizacao,
                    ano: target.ano,
                    status: target.status,
                    actionType: 'exclusao_fiscalizacao',
                    title: `Fiscalização Excluída (${target.municipio})`,
                    details: `<p class="text-rose-300">Ação fiscalizatória do município de <strong>${target.municipio} (${target.ano})</strong> foi removida do sistema.</p>`
                });
            }

            setDeletingDemandId(null);
            addToast('Fiscalização removida com sucesso!');
        } catch (e: any) {
            setError(`Erro ao remover fiscalização: ${e.message}`);
            addToast('Falha ao excluir fiscalização.', 'error');
        }
    };

    const handleExportDemands = async () => {
        try {
            let savedFindings: any[] = [];
            let savedConsultations: any[] = [];
            
            if (db && currentUser) {
                try {
                    const findingsSnap = await getDocs(collection(db, `users/${currentUser.uid}/saved_findings`));
                    savedFindings = findingsSnap.docs.map(d => d.data());
                    
                    const consultationsSnap = await getDocs(collection(db, `users/${currentUser.uid}/saved_consultations`));
                    savedConsultations = consultationsSnap.docs.map(d => d.data());
                } catch (e) {
                    console.warn("Could not fetch additional data for export", e);
                }
            }

            const exportData = {
                exportDate: new Date().toISOString(),
                userEmail: currentUser?.email,
                totalDemands: demands.length,
                totalSavedFindings: savedFindings.length,
                totalSavedConsultations: savedConsultations.length,
                demands: demands.map(({ id, ...rest }) => rest),
                saved_findings: savedFindings,
                saved_consultations: savedConsultations
            };
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', jsonString);
            const dateStr = formatIsoInputDate();
            downloadAnchor.setAttribute('download', `fiscalizacoes_tce_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            addToast('Backup exportado com sucesso!', 'success');
        } catch (err: any) {
            addToast(`Erro ao exportar dados: ${err.message}`, 'error');
        }
    };

    const handleImportDemands = async (importData: { demands: Partial<Demand>[]; savedFindings?: any[]; savedConsultations?: any[] }, replaceExisting: boolean) => {
        if (!db || !currentUser) return;

        const importedCount = importData.demands.length;

        if (replaceExisting) {
            const existingSnap = await getDocs(collection(db, `users/${currentUser.uid}/demands`));
            const deletePromises = existingSnap.docs.map((d) => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            
            // Delete existing findings and consultations as well
            const existingFindingsSnap = await getDocs(collection(db, `users/${currentUser.uid}/saved_findings`));
            await Promise.all(existingFindingsSnap.docs.map((d) => deleteDoc(d.ref)));
            
            const existingConsultationsSnap = await getDocs(collection(db, `users/${currentUser.uid}/saved_consultations`));
            await Promise.all(existingConsultationsSnap.docs.map((d) => deleteDoc(d.ref)));
        }

        // Deduplicate the imported items among themselves first
        const uniqueImportMap = new Map<string, Partial<Demand>>();
        for (const item of importData.demands) {
            const key = getDemandDedupKey(item);
            if (!uniqueImportMap.has(key)) {
                uniqueImportMap.set(key, item);
            }
        }

        const demandsRef = collection(db, `users/${currentUser.uid}/demands`);
        const existingMap = new Map<string, Demand>();
        if (!replaceExisting) {
            demands.forEach(d => {
                existingMap.set(getDemandDedupKey(d), d);
            });
        }

        for (const [key, item] of uniqueImportMap.entries()) {
            if (!replaceExisting && existingMap.has(key)) {
                // If already exists, update rather than duplicating
                const existing = existingMap.get(key)!;
                if (existing.id) {
                    await updateDoc(doc(db, `users/${currentUser.uid}/demands/${existing.id}`), {
                        ...item,
                        updatedAt: new Date(),
                    });
                }
            } else {
                await addDoc(demandsRef, {
                    ...item,
                    createdAt: new Date(),
                });
            }
        }
        
        if (importData.savedFindings?.length) {
             const findingsRef = collection(db, `users/${currentUser.uid}/saved_findings`);
             for (const item of importData.savedFindings) {
                 await addDoc(findingsRef, {
                     ...item,
                     createdAtDoc: new Date(),
                 });
             }
        }
        
        if (importData.savedConsultations?.length) {
             const consultationsRef = collection(db, `users/${currentUser.uid}/saved_consultations`);
             for (const item of importData.savedConsultations) {
                 await addDoc(consultationsRef, {
                     ...item,
                     createdAtDoc: new Date(),
                 });
             }
        }

        addActivityLog({
            demandId: 'import',
            municipio: 'Diversos',
            actionType: 'edicao_fiscalizacao',
            title: `Importação JSON (${importedCount} registros)`,
            details: `Foram importadas ${importedCount} fiscalizações via arquivo JSON (${replaceExisting ? 'substituindo dados anteriores' : 'adicionadas com deduplicação aos dados existentes'}).`,
        });
    };

    const handleClearAllDemands = async () => {
        if (!db || !currentUser) return;

        const existingSnap = await getDocs(collection(db, `users/${currentUser.uid}/demands`));
        const deletePromises = existingSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletePromises);

        addActivityLog({
            demandId: 'clear_all',
            municipio: 'Geral',
            actionType: 'exclusao_fiscalizacao',
            title: 'Exclusão Total de Fiscalizações',
            details: 'Todas as fiscalizações cadastradas para este usuário foram excluídas.',
        });
    };

    const handleEditClick = (demand: Demand) => {
        setEditingDemand(demand);
        setIsFormModalOpen(true);
    };

    const handleViewClick = (demand: Demand, options: { scrollToSummary?: boolean } = {}) => {
        setViewingDemand(demand);
        setScrollToSummary(!!options.scrollToSummary);
    };
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSetSearchTerm = useCallback(
        debounce((value: string) => {
            setSearchTerm(value);
            setCurrentPage(1);
        }, 300),
        []
    );

    const sortedAndFilteredDemands = useMemo(() => {
        const statusOrder = ['Fiscalização em Curso', 'Aguardando Manifestação', 'Pendente', 'Concluído', 'Revogado', 'Suspenso', 'Sem Fiscalização'];
        let filtered = deduplicatedDemands;

        // Apply textual search safely across relevant fields with accent & format flexibility
        if (searchTerm.trim()) {
            const rawTerm = searchTerm.trim();
            const normTerm = normalizeForSearch(rawTerm);
            const termWords = normTerm.split(/\s+/).filter(Boolean);

            filtered = filtered.filter(demand => {
                const rawObs = (demand.observacoes || '').replace(/<[^>]*>/g, ' ');
                const rawResumo = (demand.resumoRelatorio || '').replace(/<[^>]*>/g, ' ');
                const normAno = normalizeYear(demand.ano);
                
                const searchableText = normalizeForSearch([
                    demand.nFiscalizacao,
                    demand.nFiscalizacao ? demand.nFiscalizacao.replace(/\//g, ' ') : '',
                    demand.municipio,
                    demand.tema,
                    demand.status,
                    demand.ano,
                    normAno,
                    normAno === '2026' ? '026 26' : '',
                    demand.modalidade,
                    demand.observacoes,
                    rawObs,
                    rawResumo,
                    demand.relatorioNomeArquivo,
                    demand.numeroProcesso,
                    Array.isArray(demand.representacaoExterna) ? demand.representacaoExterna.join(' ') : demand.representacaoExterna
                ].filter(Boolean).join(' '));

                return termWords.every(word => {
                    if (searchableText.includes(word)) return true;
                    // Special case for year abbreviations
                    if (word === '026' && (searchableText.includes('2026') || normAno === '2026')) return true;
                    if (word === '2026' && (searchableText.includes('026') || normAno === '2026')) return true;
                    const noSlashWord = word.replace(/\//g, '');
                    if (noSlashWord && searchableText.replace(/\//g, '').includes(noSlashWord)) return true;
                    return false;
                });
            });
        }

        // Apply dropdown multi-select filters with normalized comparisons
        if (selectedYears.length > 0) {
            filtered = filtered.filter(demand => {
                const normY = normalizeYear(demand.ano);
                return selectedYears.some(sy => normalizeYear(sy) === normY);
            });
        }
        if (selectedMunicipios.length > 0) {
            filtered = filtered.filter(demand => {
                const normM = (demand.municipio || '').trim().toLowerCase();
                return selectedMunicipios.some(sm => sm.trim().toLowerCase() === normM);
            });
        }
        if (selectedTemas.length > 0) {
            filtered = filtered.filter(demand => {
                const normT = (demand.tema || 'Não Classificado').trim().toLowerCase();
                return selectedTemas.some(st => st.trim().toLowerCase() === normT);
            });
        }
        if (selectedStatuses.length > 0) {
            filtered = filtered.filter(demand => {
                const normS = (demand.status || '').trim().toLowerCase();
                return selectedStatuses.some(ss => ss.trim().toLowerCase() === normS);
            });
        }

        // Apply deadline alert filter before pagination so all matching records are found
        if (deadlineFilter) {
            filtered = filtered.filter(d => {
                const info = getDemandDeadlineInfo(d);
                return info.status === deadlineFilter;
            });
        }

        // Copy before sorting: when no filter is active, "filtered" is the memoized deduplicatedDemands array
        return [...filtered].sort((a, b) => {
            const yearA = Number(normalizeYear(a.ano)) || 0;
            const yearB = Number(normalizeYear(b.ano)) || 0;
            if (yearA !== yearB) return yearB - yearA;
            
            const indexA = statusOrder.indexOf(a.status);
            const indexB = statusOrder.indexOf(b.status);
            if (indexA !== indexB) return indexA - indexB;
            
            return getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt);
        });
    }, [deduplicatedDemands, searchTerm, selectedYears, selectedMunicipios, selectedTemas, selectedStatuses, deadlineFilter]);

    const deadlineCounts = useMemo(() => {
        let critical = 0;
        let warning = 0;
        let normal = 0;
        deduplicatedDemands.forEach(d => {
            const info = getDemandDeadlineInfo(d);
            if (info.status === 'critical') critical++;
            else if (info.status === 'warning') warning++;
            else if (info.status === 'normal') normal++;
        });
        return { critical, warning, normal };
    }, [deduplicatedDemands]);

    const filterOptions = useMemo(() => {
        const years = [...new Set(deduplicatedDemands?.map(d => normalizeYear(d.ano)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
        const municipios = [...new Set(deduplicatedDemands?.map(d => d.municipio?.trim()).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || ''));
        const temas = [...new Set(deduplicatedDemands?.map(d => d.tema?.trim()).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || ''));
        const statuses = ['Pendente', 'Fiscalização em Curso', 'Aguardando Manifestação', 'Sem Fiscalização', 'Concluído', 'Suspenso', 'Revogado'];
        return { years, municipios, temas, statuses };
    }, [deduplicatedDemands]);

    const handleClearFilters = useCallback(() => {
        setSelectedYears([]);
        setSelectedMunicipios([]);
        setSelectedTemas([]);
        setSelectedStatuses([]);
        setDeadlineFilter('');
        setSearchTerm('');
        setSearchInputKey(k => k + 1);
        setCurrentPage(1);
    }, []);

    const paginatedDemands = useMemo(() => {
        if (demandsPerPage === -1) return sortedAndFilteredDemands;
        const startIndex = (currentPage - 1) * demandsPerPage;
        return sortedAndFilteredDemands.slice(startIndex, startIndex + demandsPerPage);
    }, [sortedAndFilteredDemands, currentPage, demandsPerPage]);

    const totalPages = demandsPerPage === -1 
        ? 1 
        : Math.max(1, Math.ceil(sortedAndFilteredDemands.length / demandsPerPage));

    const autocompleteOptions = useMemo<AutocompleteOptions>(() => {
        const uniqueValues = (key: keyof Demand) => [...new Set(deduplicatedDemands?.map(d => d[key]).filter(Boolean))].sort() as string[];
        return {
            modalidade: uniqueValues('modalidade'),
            tema: uniqueValues('tema'),
            municipio: uniqueValues('municipio')
        };
    }, [deduplicatedDemands]);

    if (authInitializing) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800">
                <div className="p-4 bg-white border border-slate-200 text-tcepr-600 rounded-2xl mb-4 animate-pulse shadow-md">
                    <FormIcon className="h-10 w-10 text-tcepr-600" />
                </div>
                <div className="w-6 h-6 border-2 border-tcepr-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 text-sm font-bold tracking-wide">Carregando Sessão do Usuário...</p>
            </div>
        );
    }

    if (!currentUser) {
        return <AuthScreen />;
    }

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 antialiased selection:bg-tcepr-100 selection:text-tcepr-900 flex flex-col lg:flex-row relative overflow-x-hidden">
            {/* Background Decorative Gradients matching TCEPR logo tones */}
            <div className="fixed top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-tcepr-100/45 rounded-full blur-3xl pointer-events-none z-0" />
            <div className="fixed bottom-10 right-10 w-[500px] h-[500px] bg-sky-100/35 rounded-full blur-3xl pointer-events-none z-0" />

            {/* Fixed Lateral Sidebar Menu */}
            <SidebarMenu
                onOpenCreateModal={() => {
                    setEditingDemand(null);
                    setIsFormModalOpen(true);
                }}
                onOpenDashboardModal={() => setIsDashboardOpen(true)}
                onOpenAnalysisModal={() => setIsAnalysisModalOpen(true)}
                onOpenFortnightReportModal={() => setIsFortnightReportOpen(true)}
                onOpenSavedFindingsModal={() => setIsSavedFindingsOpen(true)}
                onOpenReportFindingsModal={() => setIsReportFindingsOpen(true)}
                onOpenUserDataModal={() => setIsUserDataModalOpen(true)}
                onSelectDemand={handleViewClick}
                onConcludeNoteFromDemand={(demand, noteId) => handleConcludeNote(demand, noteId)}
                demands={deduplicatedDemands}
                activityLogs={activityLogs}
                currentUser={currentUser}
                onSignOut={handleSignOut}
            />

            {/* Main Content Area */}
            <div className="flex-1 lg:pl-64 xl:pl-72 flex flex-col min-w-0 z-10">
                <header className="bg-white/90 border-b border-slate-200 py-4 sm:py-5 px-4 sm:px-6 lg:px-8 sticky top-0 z-[30] backdrop-blur-md shadow-sm">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className="p-2 bg-tcepr-50 border border-tcepr-100 rounded-2xl shadow-sm">
                                <TceprLogoIcon className="h-7 w-7 text-tcepr-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-tcepr-800 tracking-tight leading-none sm:text-2xl">
                                    TCEPR <span className="text-tcepr-600">Fiscalização</span>
                                </h1>
                                <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Tribunal de Contas do Estado do Paraná • Acompanhamento de Ações</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-1">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-xl mb-6 flex items-center justify-between shadow-sm">
                            <span className="text-sm font-medium">{error}</span>
                            <button onClick={() => setError('')} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors" aria-label="Fechar mensagem de erro">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    )}

                    <ActivityHistorySection
                        logs={activityLogs}
                        onClearHistory={handleClearActivityLogs}
                        onDeleteLogItem={handleDeleteActivityLog}
                        onViewDemand={(demandId) => {
                            const found = deduplicatedDemands.find(d => d.id === demandId);
                            if (found) setViewingDemand(found);
                        }}
                    />

                    <AlertsSection 
                        demands={deduplicatedDemands} 
                        onViewDemand={handleViewClick} 
                        onConcludeNote={handleConcludeNote}
                    />

                    <DemandList
                        demands={paginatedDemands}
                        totalDemandsCount={deduplicatedDemands.length}
                        filteredCount={sortedAndFilteredDemands.length}
                        itemsPerPage={demandsPerPage}
                        setItemsPerPage={setDemandsPerPage}
                        deadlineFilter={deadlineFilter}
                        setDeadlineFilter={setDeadlineFilter}
                        deadlineCounts={deadlineCounts}
                        isLoading={isLoading}
                        onDeleteRequest={setDeletingDemandId}
                        onEdit={handleEditClick}
                        onView={handleViewClick}
                        onSearchChange={debouncedSetSearchTerm}
                        onAnalysisClick={() => setIsAnalysisModalOpen(true)}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        filterOptions={filterOptions}
                        selectedYears={selectedYears}
                        setSelectedYears={setSelectedYears}
                        selectedMunicipios={selectedMunicipios}
                        setSelectedMunicipios={setSelectedMunicipios}
                        selectedTemas={selectedTemas}
                        setSelectedTemas={setSelectedTemas}
                        selectedStatuses={selectedStatuses}
                        setSelectedStatuses={setSelectedStatuses}
                        onClearFilters={handleClearFilters}
                        searchInputKey={searchInputKey}
                    />
                </main>
            </div>

            {/* Modals & Pop-ups */}
            <DemandFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setEditingDemand(null);
                }}
                onSubmit={handleAddDemand}
                onUpdate={handleUpdateDemand}
                editingDemand={editingDemand}
                autocompleteOptions={autocompleteOptions}
                onOpenSummarizeModal={setSummarizeModalDemand}
            />

            {isAnalysisModalOpen && <AnalysisModal demands={deduplicatedDemands} db={db} currentUser={currentUser} onClose={() => setIsAnalysisModalOpen(false)} addToast={addToast} />}
            {isDashboardOpen && <DashboardModal demands={deduplicatedDemands} onClose={() => setIsDashboardOpen(false)} onViewDemand={handleViewClick} />}
            {isFortnightReportOpen && <FortnightReportModal demands={deduplicatedDemands} db={db} currentUser={currentUser} addToast={addToast} onClose={() => setIsFortnightReportOpen(false)} onViewDemand={handleViewClick} />}
            {isReportFindingsOpen && <ReportFindingsModal demands={deduplicatedDemands} onClose={() => setIsReportFindingsOpen(false)} onViewDemand={handleViewClick} />}
            {isSavedFindingsOpen && <SavedFindingsModal db={db} currentUser={currentUser} onClose={() => setIsSavedFindingsOpen(false)} addToast={addToast} />}
            {summarizeModalDemand && <SummarizeModal db={db} demand={summarizeModalDemand} onClose={() => setSummarizeModalDemand(null)} onSaveSummary={(summary) => {
                const updatedDemand = { ...summarizeModalDemand, resumoRelatorio: summary };
                setEditingDemand(updatedDemand);
            }} />}
            {deletingDemandId && <ConfirmationModal isOpen={!!deletingDemandId} onClose={() => setDeletingDemandId(null)} onConfirm={() => handleDeleteDemand(deletingDemandId)} title="Confirmar Exclusão" message="Tem certeza absoluta de que deseja remover esta ação fiscalizatória do sistema? Esta operação é irreversível e excluirá definitivamente todos os dados relacionados." />}
            {viewingDemand && (
                <ViewDetailsModal 
                    demand={viewingDemand} 
                    onClose={() => setViewingDemand(null)} 
                    scrollToSummary={scrollToSummary} 
                    onEdit={(demandToEdit) => {
                        setEditingDemand(demandToEdit);
                        setIsFormModalOpen(true);
                    }}
                    onDemandUpdated={(updatedDemand) => {
                        setViewingDemand(updatedDemand);
                    }}
                />
            )}
            {concludingNoteTarget && (
                <ConcludeNoteModal
                    isOpen={!!concludingNoteTarget}
                    onClose={() => setConcludingNoteTarget(null)}
                    onConfirm={handleConfirmConcludeNote}
                    noteTitle={concludingNoteTarget.noteTitle}
                    initialDetails={concludingNoteTarget.initialDetails}
                />
            )}

            <UserDataModal
                isOpen={isUserDataModalOpen}
                onClose={() => setIsUserDataModalOpen(false)}
                currentUser={currentUser}
                demands={deduplicatedDemands}
                duplicateDocsCount={duplicateDocsCount}
                onRemoveDuplicates={handleRemoveDuplicates}
                onImportDemands={handleImportDemands}
                onExportDemands={handleExportDemands}
                onClearAllDemands={handleClearAllDemands}
                onSignOut={handleSignOut}
                addToast={addToast}
            />
            
            <div className="fixed bottom-4 right-4 z-[100] space-y-2">
                {toasts.map((toast) => (
                    <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </div>
    );

};

export default App;
