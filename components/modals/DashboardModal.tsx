import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CSVLink } from 'react-csv';
import { Demand } from '../../types';
import { XMarkIcon, FormIcon, ChevronDownIcon, ChevronUpIcon, DocumentArrowDownIcon, SearchIcon } from '../icons';
import StatusBadge from '../StatusBadge';
import { parseBRNumber } from '../../utils/formatters';
import { MultiSelectDropdown } from '../MultiSelectDropdown';
import { buildDemandFilterOptions, filterDemandsByCriteria } from '../../utils/demandFilters';
import { demandHasReport } from '../../utils/helpers';

interface DashboardModalProps {
    demands: Demand[];
    onClose: () => void;
    onViewDemand: (demand: Demand) => void;
}

const DashboardModal: React.FC<DashboardModalProps> = ({ demands, onClose, onViewDemand }) => {
    // Multi-selection filter states
    const [filterYears, setFilterYears] = useState<string[]>([]);
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [filterTemas, setFilterTemas] = useState<string[]>([]);
    const [filterMunicipios, setFilterMunicipios] = useState<string[]>([]);
    const [filterHasReports, setFilterHasReports] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [expandedCard, setExpandedCard] = useState<string | null>('details');

    const { yearOptions, statusOptions, temaOptions, municipioOptions, reportOptions } = useMemo(
        () => buildDemandFilterOptions(demands),
        [demands]
    );

    const hasActiveFilters = Boolean(
        filterYears.length > 0 ||
        filterStatuses.length > 0 ||
        filterTemas.length > 0 ||
        filterMunicipios.length > 0 ||
        filterHasReports.length > 0 ||
        searchTerm.trim()
    );

    const resetFilters = () => {
        setFilterYears([]);
        setFilterStatuses([]);
        setFilterTemas([]);
        setFilterMunicipios([]);
        setFilterHasReports([]);
        setSearchTerm('');
    };

    const filteredDemands = useMemo(() => filterDemandsByCriteria(demands, {
        years: filterYears,
        statuses: filterStatuses,
        temas: filterTemas,
        municipios: filterMunicipios,
        hasReports: filterHasReports,
        searchTerm,
    }), [demands, filterYears, filterStatuses, filterTemas, filterMunicipios, filterHasReports, searchTerm]);

    const statusData = useMemo(() => {
        const counts = filteredDemands.reduce((acc, d) => {
            acc[d.status] = (acc[d.status] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredDemands]);

    const csvData = useMemo(() => filteredDemands.map(d => ({
        ID: d.id, Ano: d.ano, "Nº Fiscalização": d.nFiscalizacao, Municipio: d.municipio, Tema: d.tema, Status: d.status, Valor: d.valor
    })), [filteredDemands]);

    const totalValue = filteredDemands.reduce((sum, d) => {
        const val = parseBRNumber(d.valor);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const demandsWithReportCount = useMemo(() => filteredDemands.filter(demandHasReport).length, [filteredDemands]);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex items-center justify-center p-3 sm:p-4"
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 text-slate-800"
            >
                <div className="p-5 md:p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
                    <div>
                        <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                            <FormIcon className="text-tcepr-100 h-6 w-6" /> 
                            <span>Painel Metas e Indicadores</span>
                        </h3>
                        <p className="text-xs text-tcepr-100/90 mt-0.5">
                            Filtre e analise os indicadores gerais de todas as fiscalizações cadastradas com seleção múltipla.
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                        title="Fechar"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                    {/* Filtros Expandidos com Multi-Seleção */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <SearchIcon className="h-3.5 w-3.5 text-slate-500" />
                                <span>Filtros com Seleção Múltipla</span>
                            </h4>
                            {hasActiveFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="text-xs font-bold text-rose-600 hover:text-rose-850 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-rose-200"
                                >
                                    Limpar Filtros ✕
                                </button>
                            )}
                        </div>

                        {/* Search Bar */}
                        <div>
                            <div className="relative">
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Pesquisa geral por palavras-chave (Nº da fiscalização, município, tema, observações...)"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 placeholder:text-slate-400 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Multi-Select Controls Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <MultiSelectDropdown
                                label="Ano"
                                placeholder="Todos os Anos"
                                options={yearOptions}
                                selectedValues={filterYears}
                                onChange={setFilterYears}
                            />

                            <MultiSelectDropdown
                                label="Status"
                                placeholder="Todos os Status"
                                options={statusOptions}
                                selectedValues={filterStatuses}
                                onChange={setFilterStatuses}
                            />

                            <MultiSelectDropdown
                                label="Tema"
                                placeholder={`Todos (${temaOptions.length})`}
                                options={temaOptions}
                                selectedValues={filterTemas}
                                onChange={setFilterTemas}
                            />

                            <MultiSelectDropdown
                                label="Município"
                                placeholder={`Todos (${municipioOptions.length})`}
                                options={municipioOptions}
                                selectedValues={filterMunicipios}
                                onChange={setFilterMunicipios}
                            />

                            <MultiSelectDropdown
                                label="Relatório Anexado"
                                placeholder="Todos"
                                options={reportOptions}
                                selectedValues={filterHasReports}
                                onChange={setFilterHasReports}
                                searchable={false}
                            />
                        </div>

                        {/* Active Filter Pills */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
                                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">
                                    Filtros aplicados:
                                </span>
                                {filterYears.map(y => (
                                    <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-tcepr-50 text-tcepr-800 border border-tcepr-200">
                                        Ano: {y}
                                        <button type="button" onClick={() => setFilterYears(filterYears.filter(v => v !== y))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                ))}
                                {filterStatuses.map(s => (
                                    <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                        Status: {s}
                                        <button type="button" onClick={() => setFilterStatuses(filterStatuses.filter(v => v !== s))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                ))}
                                {filterTemas.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                        Tema: {t}
                                        <button type="button" onClick={() => setFilterTemas(filterTemas.filter(v => v !== t))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                ))}
                                {filterMunicipios.map(m => (
                                    <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Mun: {m}
                                        <button type="button" onClick={() => setFilterMunicipios(filterMunicipios.filter(v => v !== m))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                ))}
                                {filterHasReports.map(r => (
                                    <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                        {r === 'sim' ? 'Com Relatório' : 'Sem Relatório'}
                                        <button type="button" onClick={() => setFilterHasReports(filterHasReports.filter(v => v !== r))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                ))}
                                {searchTerm.trim() && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                                        Termo: "{searchTerm}"
                                        <button type="button" onClick={() => setSearchTerm('')} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Status bar */}
                        <div className="text-xs text-slate-500 font-medium pt-1 flex items-center justify-between">
                            <span>
                                Exibindo <strong>{filteredDemands.length}</strong> de <strong>{demands.length}</strong> fiscalizações.
                            </span>
                            {hasActiveFilters && (
                                <span className="text-tcepr-700 font-bold bg-tcepr-50 border border-tcepr-100 px-2.5 py-0.5 rounded-full text-[11px]">
                                    {filteredDemands.length === 0 ? 'Nenhum resultado' : `${filteredDemands.length} filtradas`}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-tr from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-2xl p-5 shadow-2xs">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Demandas</h4>
                            <p className="text-3xl font-black text-tcepr-700 tracking-tight">{filteredDemands.length}</p>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                {demandsWithReportCount} com relatório ({filteredDemands.length > 0 ? Math.round((demandsWithReportCount / filteredDemands.length) * 100) : 0}%)
                            </p>
                        </div>

                        <div className="bg-gradient-to-tr from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-2xl p-5 shadow-2xs">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Montante Estimado (R$)</h4>
                            <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">Soma dos valores declarados</p>
                        </div>

                        <CSVLink 
                            data={csvData} 
                            filename={`demandas_filtradas_${filterYears.join('_') || 'geral'}.csv`} 
                            className="flex flex-col items-center justify-center gap-1.5 p-5 bg-gradient-to-r from-tcepr-700 to-tcepr-800 hover:from-tcepr-800 hover:to-tcepr-900 text-white font-bold rounded-2xl shadow-xs hover:shadow-md transition-all text-sm active:scale-95 duration-200 cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <DocumentArrowDownIcon className="h-5 w-5" /> 
                                <span>Exportar Base (CSV)</span>
                            </div>
                            <span className="text-[10px] text-tcepr-100/90 font-normal">
                                {filteredDemands.length} registro(s) no arquivo
                            </span>
                        </CSVLink>
                    </div>

                    {/* Gráfico */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 tracking-tight">Demandas por Status Corrente</h4>
                        <div className="w-full" style={{ height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc' }} />
                                    <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detalhamento das Demandas */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden mb-2">
                        <button onClick={() => setExpandedCard(expandedCard === 'details' ? null : 'details')} className="w-full flex justify-between items-center p-5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                            <h4 className="text-sm font-bold text-slate-700 tracking-tight">Detalhamento das Demandas Filtradas ({filteredDemands.length})</h4>
                            {expandedCard === 'details' ? <ChevronUpIcon className="h-5 w-5 text-slate-400" /> : <ChevronDownIcon className="h-5 w-5 text-slate-400" />}
                        </button>
                        {expandedCard === 'details' && (
                            <div className="max-h-72 overflow-y-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-slate-50 sticky top-0 z-[5]">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nº Fiscalização</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Município</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tema</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {filteredDemands.length > 0 ? (
                                            filteredDemands.map(d => (
                                                <tr key={d.id} onClick={() => onViewDemand(d)} className="hover:bg-tcepr-50/50 cursor-pointer transition-colors">
                                                    <td className="px-6 py-4 font-bold text-tcepr-700">{d.nFiscalizacao || '-'}</td>
                                                    <td className="px-6 py-4 text-slate-700 font-semibold">{d.municipio}</td>
                                                    <td className="px-6 py-4 text-slate-600 font-normal">{d.tema || '-'}</td>
                                                    <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Nenhuma demanda atende aos filtros definidos.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default DashboardModal;
