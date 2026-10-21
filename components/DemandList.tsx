import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Demand } from '../types';
import { EditIcon, ViewIcon, TrashIcon, HammerIcon, FormIcon, SummarizeIcon, AlarmClockIcon, SearchIcon, AlertIcon, CheckCircleIcon } from './icons';
import { generateTceLink, generateFiscalizacaoLink } from '../utils/linkGenerators';
import StatusBadge from './StatusBadge';
import { getDemandDeadlineInfo, parseObservations } from '../utils/deadlineUtils';
import { normalizeYear } from '../utils/helpers';
import { MultiSelectDropdown } from './MultiSelectDropdown';

interface DemandListProps {
    demands: Demand[];
    totalDemandsCount: number;
    filteredCount: number;
    itemsPerPage: number;
    setItemsPerPage: (count: number) => void;
    deadlineFilter: string;
    setDeadlineFilter: (filter: string) => void;
    deadlineCounts: { critical: number; warning: number; normal: number };
    isLoading: boolean;
    onDeleteRequest: (id: string) => void;
    onEdit: (demand: Demand) => void;
    onView: (demand: Demand, options?: { scrollToSummary?: boolean }) => void;
    onSearchChange: (value: string) => void;
    onAnalysisClick?: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    filterOptions: {
        years: string[];
        municipios: string[];
        temas: string[];
        statuses: string[];
    };
    selectedYears: string[];
    setSelectedYears: (value: string[]) => void;
    selectedMunicipios: string[];
    setSelectedMunicipios: (value: string[]) => void;
    selectedTemas: string[];
    setSelectedTemas: (value: string[]) => void;
    selectedStatuses: string[];
    setSelectedStatuses: (value: string[]) => void;
    onClearFilters: () => void;
    /** Changing this value remounts (and therefore empties) the uncontrolled search input */
    searchInputKey?: number;
}

const DemandList: React.FC<DemandListProps> = ({ 
    demands, 
    totalDemandsCount,
    filteredCount,
    itemsPerPage,
    setItemsPerPage,
    deadlineFilter,
    setDeadlineFilter,
    deadlineCounts,
    isLoading, 
    onDeleteRequest, 
    onEdit, 
    onView, 
    onSearchChange, 
    onAnalysisClick, 
    currentPage, 
    totalPages, 
    onPageChange,
    filterOptions,
    selectedYears,
    setSelectedYears,
    selectedMunicipios,
    setSelectedMunicipios,
    selectedTemas,
    setSelectedTemas,
    selectedStatuses,
    setSelectedStatuses,
    onClearFilters,
    searchInputKey = 0,
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const statusBorders: { [key in Demand['status']]: string } = {
        'Pendente': 'border-l-amber-500',
        'Fiscalização em Curso': 'border-l-sky-500',
        'Aguardando Manifestação': 'border-l-sky-400',
        'Sem Fiscalização': 'border-l-orange-500',
        'Concluído': 'border-l-emerald-500',
        'Suspenso': 'border-l-slate-400',
        'Revogado': 'border-l-rose-500',
    };

    const getStatusBorder = (status: Demand['status'] | string): string => {
        const s = (status || '').trim() as Demand['status'];
        return statusBorders[s] || 'border-l-slate-300';
    };

    // demands is already filtered globally in App.tsx (including deadlineFilter)
    const displayedDemands = demands;

    const handleClearAllFilters = () => {
        setDeadlineFilter('');
        onClearFilters();
    };

    const hasAnyActiveFilter = Boolean(
        selectedYears.length > 0 ||
        selectedMunicipios.length > 0 ||
        selectedTemas.length > 0 ||
        selectedStatuses.length > 0 ||
        deadlineFilter
    );

    return (
        <div className="bg-white border border-slate-200 shadow-xs rounded-3xl overflow-hidden p-6 md:p-8 text-slate-800">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <span>Portfólio de Fiscalizações</span>
                    </h2>
                    <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full border border-slate-200 w-fit">
                        {filteredCount === totalDemandsCount 
                            ? `${totalDemandsCount} cadastradas` 
                            : `${filteredCount} de ${totalDemandsCount} exibidas`}
                    </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <input 
                            key={searchInputKey}
                            type="text" 
                            placeholder="Buscar por município, tema, status..." 
                            onChange={(e) => onSearchChange(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-sm focus:outline-none transition-all placeholder:text-slate-400 text-slate-800" 
                            aria-label="Search demands" 
                        />
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <SearchIcon className="h-5 w-5" />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Seção de Seletores e Filtros Avançados + Filtro de Alerta de Prazos */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <MultiSelectDropdown
                        label="Ano"
                        placeholder="Todos os Anos"
                        options={filterOptions?.years || []}
                        selectedValues={selectedYears}
                        onChange={(vals) => { setSelectedYears(vals); onPageChange(1); }}
                    />
                    <MultiSelectDropdown
                        label="Município"
                        placeholder="Todos os Municípios"
                        options={filterOptions?.municipios || []}
                        selectedValues={selectedMunicipios}
                        onChange={(vals) => { setSelectedMunicipios(vals); onPageChange(1); }}
                    />
                    <MultiSelectDropdown
                        label="Tema"
                        placeholder="Todos os Temas"
                        options={filterOptions?.temas || []}
                        selectedValues={selectedTemas}
                        onChange={(vals) => { setSelectedTemas(vals); onPageChange(1); }}
                    />
                    <MultiSelectDropdown
                        label="Status"
                        placeholder="Todos os Status"
                        options={filterOptions?.statuses || []}
                        selectedValues={selectedStatuses}
                        onChange={(vals) => { setSelectedStatuses(vals); onPageChange(1); }}
                    />

                    {/* Filtro de Prazos por Última Observação */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <AlarmClockIcon className="h-3.5 w-3.5 text-tcepr-600" />
                            <span>Alerta de Prazos</span>
                        </label>
                        <select
                            value={deadlineFilter}
                            onChange={(e) => { setDeadlineFilter(e.target.value); onPageChange(1); }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none transition-all cursor-pointer font-bold ${
                                deadlineFilter === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                deadlineFilter === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                deadlineFilter === 'normal' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                'bg-white border-slate-200 text-slate-700'
                            }`}
                        >
                            <option value="">Todos os Prazos</option>
                            <option value="critical">{"Vencidos (prazo da nota esgotado) (" + deadlineCounts.critical + ")"}</option>
                            <option value="warning">{"Atenção (≥ 2/3 do prazo) (" + deadlineCounts.warning + ")"}</option>
                            <option value="normal">{"Em Dia (< 2/3 do prazo) (" + deadlineCounts.normal + ")"}</option>
                        </select>
                    </div>
                </div>

                {/* Info banner when filters hide demands */}
                {filteredCount < totalDemandsCount && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span>
                            ⚠️ Exibindo <strong>{filteredCount}</strong> de <strong>{totalDemandsCount}</strong> fiscalizações. <strong>{totalDemandsCount - filteredCount}</strong> estão ocultas pelos filtros selecionados ou pela busca.
                        </span>
                        <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer text-xs"
                        >
                            Limpar Filtros e Ver Todas
                        </button>
                    </div>
                )}

                {/* Active filter pills */}
                {hasAnyActiveFilter && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtros ativos:</span>
                        {selectedYears.map(y => (
                            <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-tcepr-50 text-tcepr-800 border border-tcepr-200">
                                Ano: {y}
                                <button type="button" onClick={() => { setSelectedYears(selectedYears.filter(v => v !== y)); onPageChange(1); }} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                            </span>
                        ))}
                        {selectedMunicipios.map(m => (
                            <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Mun: {m}
                                <button type="button" onClick={() => { setSelectedMunicipios(selectedMunicipios.filter(v => v !== m)); onPageChange(1); }} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                            </span>
                        ))}
                        {selectedTemas.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                Tema: {t}
                                <button type="button" onClick={() => { setSelectedTemas(selectedTemas.filter(v => v !== t)); onPageChange(1); }} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                            </span>
                        ))}
                        {selectedStatuses.map(s => (
                            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Status: {s}
                                <button type="button" onClick={() => { setSelectedStatuses(selectedStatuses.filter(v => v !== s)); onPageChange(1); }} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                            </span>
                        ))}
                        {deadlineFilter && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                Prazo: {deadlineFilter === 'critical' ? 'Vencidos' : deadlineFilter === 'warning' ? 'Atenção (≥ 2/3 do prazo)' : 'Em Dia'}
                                <button type="button" onClick={() => { setDeadlineFilter(''); onPageChange(1); }} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="px-2.5 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border border-rose-200 rounded-lg text-xs transition-colors ml-auto cursor-pointer"
                        >
                            Limpar Filtros ✕
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="space-y-3.5 py-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-slate-100 h-14 rounded-xl"></div>)}
                </div>
            ) : displayedDemands.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <SearchIcon className="h-10 w-10 text-slate-400 mx-auto" />
                    <p className="text-slate-600 font-medium text-sm">Nenhuma fiscalização encontrada para os filtros selecionados.</p>
                    {totalDemandsCount > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="px-4 py-2 bg-tcepr-600 hover:bg-tcepr-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                        >
                            Limpar Filtros e Exibir Todas ({totalDemandsCount})
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3 px-3 border-l-2 border-l-transparent">Exercício</th>
                                    <th className="py-3 px-3">Município</th>
                                    <th className="py-3 px-3">Tema</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3">Última Observação / Prazo</th>
                                    <th className="py-3 px-3">Processos / Ficha</th>
                                    <th className="py-3 px-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {displayedDemands.map((demand) => {
                                    const isExpanded = expandedId === demand.id;
                                    const borderClass = getStatusBorder(demand.status);
                                    const deadlineInfo = getDemandDeadlineInfo(demand);
                                    const notes = parseObservations(demand.observacoes);
                                    const encaminhamentoStr = demand.encaminhamentoProcessual ? String(demand.encaminhamentoProcessual).trim() : '';
                                    const nFiscalizacaoStr = demand.nFiscalizacao ? String(demand.nFiscalizacao).trim() : '';
                                    const encaminhamentoLink = encaminhamentoStr
                                        ? (encaminhamentoStr.startsWith('http') ? encaminhamentoStr : generateTceLink(encaminhamentoStr, demand.ano))
                                        : null;
                                    const fiscalizacaoLink = nFiscalizacaoStr
                                        ? (nFiscalizacaoStr.startsWith('http') ? nFiscalizacaoStr : generateFiscalizacaoLink(nFiscalizacaoStr))
                                        : null;

                                    return (
                                        <motion.tr 
                                            key={demand.id} 
                                            className="hover:bg-slate-50/80 transition-colors group"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            <td className={`py-4 px-3 font-extrabold text-slate-700 whitespace-nowrap border-l-2 ${borderClass}`}>
                                                <span>{normalizeYear(demand.ano) || demand.ano}</span>
                                            </td>
                                            <td className="py-4 px-3 font-bold text-slate-900">
                                                <div className="flex flex-col">
                                                    <span>{demand.municipio}</span>
                                                    {demand.nFiscalizacao && (
                                                        <span className="text-[10px] text-slate-500 font-normal">Fisc. nº {demand.nFiscalizacao}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-3 text-slate-600 font-medium">
                                                {demand.tema || <span className="text-slate-300 italic">Não Classificado</span>}
                                            </td>
                                            <td className="py-4 px-3 whitespace-nowrap">
                                                <StatusBadge status={demand.status} />
                                            </td>
                                            <td className="py-4 px-3 min-w-[210px] max-w-[280px]">
                                                {notes.length === 0 ? (
                                                    <span className="text-[11px] text-slate-400 italic">Sem obs (Sem prazo)</span>
                                                ) : deadlineInfo.mostCriticalNote ? (
                                                    <div className="space-y-1">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                                            deadlineInfo.mostCriticalNote.status === 'normal'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                : deadlineInfo.mostCriticalNote.status === 'warning'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                : 'bg-rose-50 text-rose-800 border-rose-200'
                                                        }`}>
                                                            {deadlineInfo.mostCriticalNote.status === 'normal' ? '✓ Em dia' : deadlineInfo.mostCriticalNote.status === 'warning' ? '⚠️ Atenção' : '⏰ Vencido'} ({deadlineInfo.mostCriticalNote.daysElapsed}d / {deadlineInfo.mostCriticalNote.note.prazoDias}d)
                                                        </span>
                                                        {deadlineInfo.mostCriticalNote.note.title && (
                                                            <div className="text-[11px] text-slate-700 font-medium line-clamp-1" title={deadlineInfo.mostCriticalNote.note.title}>
                                                                {deadlineInfo.mostCriticalNote.note.title}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                                                            {demand.status === 'Concluído' || (deadlineInfo.latestTitle && /finalizado|conclu/i.test(deadlineInfo.latestTitle)) ? (
                                                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    Finalizado
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 font-medium">Sem prazo ativo</span>
                                                            )}
                                                        </span>
                                                        {deadlineInfo.latestTitle && !/finalizado/i.test(deadlineInfo.latestTitle) && (
                                                            <div className="text-[11px] text-slate-600 line-clamp-1" title={deadlineInfo.latestTitle}>
                                                                {deadlineInfo.latestTitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-3">
                                                <div className="flex items-center gap-2">
                                                    {encaminhamentoStr ? (
                                                        encaminhamentoLink ? (
                                                            <a href={encaminhamentoLink} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-tcepr-700 hover:bg-slate-100 rounded-lg transition-colors" title={`Encaminhamento Processual: ${encaminhamentoStr}`}>
                                                                <HammerIcon className="h-5 w-5" />
                                                            </a>
                                                        ) : (
                                                            <span className="p-1 text-slate-500 hover:text-tcepr-700 rounded-lg transition-colors cursor-help" title={`Encaminhamento Processual: ${encaminhamentoStr}`}>
                                                                <HammerIcon className="h-5 w-5" />
                                                            </span>
                                                        )
                                                    ) : null}
                                                    {nFiscalizacaoStr ? (
                                                        fiscalizacaoLink ? (
                                                            <a href={fiscalizacaoLink} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-tcepr-700 hover:bg-tcepr-50 rounded-lg transition-colors" title={`Informações e Ficha de Fiscalização nº ${nFiscalizacaoStr}`}>
                                                                <FormIcon className="h-5 w-5" />
                                                            </a>
                                                        ) : (
                                                            <span className="p-1 text-slate-500 rounded-lg transition-colors cursor-help" title={`Fiscalização nº ${nFiscalizacaoStr}`}>
                                                                <FormIcon className="h-5 w-5" />
                                                            </span>
                                                        )
                                                    ) : null}
                                                    {!encaminhamentoStr && !nFiscalizacaoStr && (
                                                        <span className="text-slate-300 font-mono text-xs">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-3 text-right">
                                                <div className="flex justify-end items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {demand.resumoRelatorio && (
                                                        <button onClick={() => onView(demand, { scrollToSummary: true })} className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-slate-100 rounded-lg transition-colors" title="Resumo Inteligente (IA)">
                                                            <SummarizeIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => onView(demand)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors" title="Ver Detalhes">
                                                        <ViewIcon className="h-5 w-5" />
                                                    </button>
                                                    <button onClick={() => onEdit(demand)} className="p-1 text-slate-400 hover:text-tcepr-700 hover:bg-slate-100 rounded-lg transition-colors" title="Editar Informações">
                                                        <EditIcon className="h-5 w-5" />
                                                    </button>
                                                    <button onClick={() => onDeleteRequest(demand.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors" title="Excluir Registro">
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Controls: Items per page + Pagination */}
                    <div className="mt-6 pt-5 border-t border-slate-200 flex flex-wrap gap-4 justify-between items-center text-sm font-medium">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                            <span>Exibir:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); onPageChange(1); }}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-tcepr-500 cursor-pointer shadow-2xs"
                            >
                                <option value={10}>10 por página</option>
                                <option value={25}>25 por página</option>
                                <option value={50}>50 por página</option>
                                <option value={100}>100 por página</option>
                                <option value={-1}>Todas ({filteredCount})</option>
                            </select>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => onPageChange(currentPage - 1)} 
                                    disabled={currentPage === 1} 
                                    className="px-3.5 py-1.5 text-slate-600 bg-white hover:bg-slate-50 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-colors active:scale-95 cursor-pointer border border-slate-200 shadow-xs text-xs font-semibold"
                                >
                                    Anterior
                                </button>
                                <span className="text-slate-500 text-xs">
                                    Página <strong className="text-slate-800 font-bold">{currentPage}</strong> de <strong className="text-slate-800 font-bold">{totalPages}</strong>
                                </span>
                                <button 
                                    onClick={() => onPageChange(currentPage + 1)} 
                                    disabled={currentPage === totalPages} 
                                    className="px-3.5 py-1.5 text-slate-600 bg-white hover:bg-slate-50 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-colors active:scale-95 cursor-pointer border border-slate-200 shadow-xs text-xs font-semibold"
                                >
                                    Próxima
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default DemandList;
