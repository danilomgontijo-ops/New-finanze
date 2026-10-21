import React, { useState, useMemo } from 'react';
import { Demand } from '../types';
import { extractDemandFindings, GroupedFindingsSummary } from '../utils/reportFindingsUtils';
import { ChevronDownIcon, ChevronUpIcon, ViewIcon, FormIcon, CheckCircleIcon, AlertIcon, SearchIcon } from './icons';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { buildDemandFilterOptions, filterDemandsByCriteria } from '../utils/demandFilters';

interface ReportFindingsOverviewSectionProps {
  demands: Demand[];
  onViewDemand: (demand: Demand) => void;
}

export const ReportFindingsOverviewSection: React.FC<ReportFindingsOverviewSectionProps> = ({
  demands,
  onViewDemand,
}) => {
  const [groupBy, setGroupBy] = useState<'tema' | 'municipio'>('tema');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Multi-selection filter states
  const [filterYears, setFilterYears] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterTemas, setFilterTemas] = useState<string[]>([]);
  const [filterMunicipios, setFilterMunicipios] = useState<string[]>([]);
  const [filterHasReports, setFilterHasReports] = useState<string[]>([]);
  const [filterFindingStatuses, setFilterFindingStatuses] = useState<string[]>([]);

  // Unique options with counts
  const { yearOptions, statusOptions, temaOptions, municipioOptions, reportOptions } = useMemo(
    () => buildDemandFilterOptions(demands),
    [demands]
  );

  const findingStatusOptions = useMemo(() => {
    return [
      { value: 'sanado', label: 'Sanado', badge: { text: 'Sanado', className: 'bg-emerald-100 text-emerald-800' } },
      { value: 'nao_sanado', label: 'Não Sanado', badge: { text: 'Não Sanado', className: 'bg-rose-100 text-rose-800' } },
      { value: 'nao_confirmado', label: 'Não Confirmado', badge: { text: 'Não Confirmado', className: 'bg-slate-100 text-slate-700' } },
    ];
  }, []);

  const hasActiveFilters = Boolean(
    filterYears.length > 0 ||
    filterStatuses.length > 0 ||
    filterTemas.length > 0 ||
    filterMunicipios.length > 0 ||
    filterHasReports.length > 0 ||
    filterFindingStatuses.length > 0 ||
    searchTerm.trim()
  );

  const resetFilters = () => {
    setFilterYears([]);
    setFilterStatuses([]);
    setFilterTemas([]);
    setFilterMunicipios([]);
    setFilterHasReports([]);
    setFilterFindingStatuses([]);
    setSearchTerm('');
  };

  // 1. Filter demands based on multi-select parameters and search term
  const filteredDemands = useMemo(() => filterDemandsByCriteria(demands, {
    years: filterYears,
    statuses: filterStatuses,
    temas: filterTemas,
    municipios: filterMunicipios,
    hasReports: filterHasReports,
    searchTerm,
  }), [demands, filterYears, filterStatuses, filterTemas, filterMunicipios, filterHasReports, searchTerm]);

  // 2. Aggregate findings by group using filtered demands and findingStatus filter
  const allGrouped: GroupedFindingsSummary[] = useMemo(() => {
    const map = new Map<string, GroupedFindingsSummary>();

    filteredDemands.forEach(d => {
      const key = groupBy === 'tema'
        ? (d.tema?.trim() || 'Não Classificado')
        : (d.municipio?.trim() || 'Não Informado');

      const demandSummary = extractDemandFindings(d);

      // If user filtered by finding status (e.g., only 'nao_sanado'), filter items
      if (filterFindingStatuses.length > 0) {
        demandSummary.items = demandSummary.items.filter(item =>
          filterFindingStatuses.includes(item.status)
        );
        demandSummary.sanados = demandSummary.items.filter(i => i.status === 'sanado').length;
        demandSummary.naoSanados = demandSummary.items.filter(i => i.status === 'nao_sanado').length;
        demandSummary.naoConfirmados = demandSummary.items.filter(i => i.status === 'nao_confirmado').length;
        demandSummary.totalAchados = demandSummary.items.length;

        // If this demand has no findings matching the filter, don't include it in group
        if (demandSummary.totalAchados === 0 && demandSummary.hasReport) {
          return;
        }
      }

      if (!map.has(key)) {
        map.set(key, {
          groupName: key,
          demandsCount: 0,
          demandsWithReportCount: 0,
          totalAchados: 0,
          sanados: 0,
          naoSanados: 0,
          naoConfirmados: 0,
          demands: [],
        });
      }

      const group = map.get(key)!;
      group.demandsCount += 1;
      if (demandSummary.hasReport) {
        group.demandsWithReportCount += 1;
      }
      group.totalAchados += demandSummary.totalAchados;
      group.sanados += demandSummary.sanados;
      group.naoSanados += demandSummary.naoSanados;
      group.naoConfirmados += demandSummary.naoConfirmados;
      group.demands.push(demandSummary);
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort by total findings descending, then name ascending
      if (b.totalAchados !== a.totalAchados) {
        return b.totalAchados - a.totalAchados;
      }
      return a.groupName.localeCompare(b.groupName, 'pt-BR');
    });
  }, [filteredDemands, groupBy, filterFindingStatuses]);

  // Overall totals across filtered demands
  const totals = useMemo(() => {
    return allGrouped.reduce(
      (acc, g) => {
        acc.demandsWithReport += g.demandsWithReportCount;
        acc.totalAchados += g.totalAchados;
        acc.sanados += g.sanados;
        acc.naoSanados += g.naoSanados;
        acc.naoConfirmados += g.naoConfirmados;
        return acc;
      },
      {
        demandsWithReport: 0,
        totalAchados: 0,
        sanados: 0,
        naoSanados: 0,
        naoConfirmados: 0,
      }
    );
  }, [allGrouped]);

  const percentWithReport = filteredDemands.length > 0 
    ? Math.round((totals.demandsWithReport / filteredDemands.length) * 100) 
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 text-slate-800">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h4 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <div className="p-1.5 bg-tcepr-50 text-tcepr-800 rounded-lg border border-tcepr-100">
              <FormIcon className="h-4 w-4" />
            </div>
            <span>Achados do Resumo de Relatório (IA)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas extraídas exclusivamente do quadro <strong>Resumo do Relatório (IA)</strong>: quantidade de achados, sanados, não sanados e não confirmados.
          </p>
        </div>

        {/* Group By Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200/60">
          <button
            onClick={() => { setGroupBy('tema'); setExpandedGroup(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              groupBy === 'tema'
                ? 'bg-white text-tcepr-800 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Tema ({allGrouped.length})
          </button>
          <button
            onClick={() => { setGroupBy('municipio'); setExpandedGroup(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              groupBy === 'municipio'
                ? 'bg-white text-tcepr-800 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Município ({allGrouped.length})
          </button>
        </div>
      </div>

      {/* Parameter Multi-Select Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <SearchIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>Filtros das Fiscalizações com Seleção Múltipla</span>
          </h5>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-rose-200"
            >
              Limpar Filtros ✕
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por município, tema, número da fiscalização ou achado..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-tcepr-500 focus:border-tcepr-500 shadow-2xs"
          />
        </div>

        {/* Dropdowns Grid with Multi-Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            label="Relatório"
            placeholder="Todos"
            options={reportOptions}
            selectedValues={filterHasReports}
            onChange={setFilterHasReports}
            searchable={false}
          />

          <MultiSelectDropdown
            label="Situação Achado"
            placeholder="Todas"
            options={findingStatusOptions}
            selectedValues={filterFindingStatuses}
            onChange={setFilterFindingStatuses}
            searchable={false}
          />
        </div>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">
              Filtros ativos:
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
            {filterFindingStatuses.map(fs => (
              <span key={fs} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                Achado: {fs === 'sanado' ? 'Sanado' : fs === 'nao_sanado' ? 'Não Sanado' : 'Não Confirmado'}
                <button type="button" onClick={() => setFilterFindingStatuses(filterFindingStatuses.filter(v => v !== fs))} className="hover:text-rose-600 font-bold cursor-pointer">×</button>
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

        <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-0.5">
          <span>
            Exibindo <strong>{filteredDemands.length}</strong> de <strong>{demands.length}</strong> fiscalizações filtradas em <strong>{allGrouped.length}</strong> {groupBy === 'tema' ? 'temas' : 'municípios'}.
          </span>
          {hasActiveFilters && (
            <span className="text-tcepr-700 font-bold bg-tcepr-50 border border-tcepr-200 px-2.5 py-0.5 rounded-full text-[11px]">
              Filtros Ativos
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards for Findings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Achados */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
            <span>Total Achados</span>
            <FormIcon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800">{totals.totalAchados}</p>
          <p className="text-[10px] text-slate-500">
            {totals.demandsWithReport} de {filteredDemands.length} fisc. com relatório ({percentWithReport}%)
          </p>
        </div>

        {/* Sanados */}
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span>Sanados</span>
            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{totals.sanados}</p>
          <p className="text-[10px] text-emerald-600/90 font-semibold">
            {totals.totalAchados > 0 ? `${Math.round((totals.sanados / totals.totalAchados) * 100)}% do total` : '0%'}
          </p>
        </div>

        {/* Não Sanados */}
        <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 uppercase tracking-wider">
            <span>Não Sanados</span>
            <AlertIcon className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700">{totals.naoSanados}</p>
          <p className="text-[10px] text-rose-600/90 font-semibold">
            {totals.totalAchados > 0 ? `${Math.round((totals.naoSanados / totals.totalAchados) * 100)}% do total` : '0%'}
          </p>
        </div>

        {/* Não Confirmados */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
            <span>Não Confirmados</span>
            <AlertIcon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-700">{totals.naoConfirmados}</p>
          <p className="text-[10px] text-slate-500 font-semibold">
            {totals.totalAchados > 0 ? `${Math.round((totals.naoConfirmados / totals.totalAchados) * 100)}% do total` : '0%'}
          </p>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-150 text-xs sm:text-sm">
            <thead className="bg-slate-50 sticky top-0 z-[5]">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  {groupBy === 'tema' ? 'Tema' : 'Município'}
                </th>
                <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Fisc. c/ Relatório
                </th>
                <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Total Achados
                </th>
                <th className="px-4 py-3 text-center font-bold text-emerald-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Sanados
                </th>
                <th className="px-4 py-3 text-center font-bold text-rose-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Não Sanados
                </th>
                <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Não Confirmados
                </th>
                <th className="px-4 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-150">
              {allGrouped.length > 0 ? (
                allGrouped.map((group) => {
                  const isExpanded = expandedGroup === group.groupName;

                  return (
                    <React.Fragment key={group.groupName}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50 font-semibold' : ''}`}
                      >
                        <td className="px-4 py-3 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            {groupBy === 'tema' ? (
                              <FormIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                            ) : (
                              <FormIcon className="h-4 w-4 text-tcepr-600 shrink-0" />
                            )}
                            <span>{group.groupName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-medium">
                          {group.demandsWithReportCount} / {group.demandsCount}
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-800">
                          {group.totalAchados}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                            {group.sanados}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200/50">
                            {group.naoSanados}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/50">
                            {group.naoConfirmados}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExpandedGroup(isExpanded ? null : group.groupName)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 border border-slate-200 shadow-xs"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver Fisc.'}</span>
                            {isExpanded ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 bg-slate-50/50 border-b border-slate-200">
                            <div className="p-4 space-y-3">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Fiscalizações do {groupBy === 'tema' ? 'Tema' : 'Município'}: {group.groupName}
                              </h5>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {group.demands.map((ds) => (
                                  <div
                                    key={ds.demandId}
                                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 hover:shadow-xs transition-all"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800 text-xs">
                                          {ds.municipio} {ds.nFiscalizacao ? `(Nº ${ds.nFiscalizacao})` : ''} — {ds.demand.ano}
                                        </span>
                                        {ds.tema && (
                                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200/50">
                                            {ds.tema}
                                          </span>
                                        )}
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium border border-slate-200/50">
                                          {ds.demand.status}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                                            {ds.sanados} sanado(s)
                                          </span>
                                          <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-150">
                                            {ds.naoSanados} não sanado(s)
                                          </span>
                                          {ds.naoConfirmados > 0 && (
                                            <span className="text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-150">
                                              {ds.naoConfirmados} não confirmado(s)
                                            </span>
                                          )}
                                        </div>

                                        <button
                                          onClick={() => onViewDemand(ds.demand)}
                                          className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer transition-all flex items-center gap-1 text-xs font-bold border border-slate-200 shadow-xs bg-white"
                                          title="Abrir Detalhes da Fiscalização"
                                        >
                                          <ViewIcon className="h-4 w-4" />
                                          <span>Abrir</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Extracted Findings Items */}
                                    {ds.items.length > 0 ? (
                                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 mt-1">
                                        {ds.items.map((item) => (
                                          <div key={item.id} className="text-xs flex items-start gap-2">
                                            <span
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 mt-0.5 ${
                                                item.status === 'sanado'
                                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                  : item.status === 'nao_sanado'
                                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                                              }`}
                                            >
                                              {item.status === 'sanado'
                                                ? 'Sanado'
                                                : item.status === 'nao_sanado'
                                                ? 'Não Sanado'
                                                : 'Não Confirmado'}
                                            </span>
                                            <span className="text-slate-700 font-medium leading-snug">
                                              {item.title}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-slate-400 italic">
                                        Nenhum achado cadastrado no Resumo do Relatório (IA) desta demanda.
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Nenhum {groupBy === 'tema' ? 'tema' : 'município'} encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
