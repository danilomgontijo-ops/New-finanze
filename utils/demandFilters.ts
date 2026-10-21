import { Demand } from '../types';
import { demandHasReport } from './helpers';

export interface CountedOption {
  value: string;
  label: string;
  count: number;
}

export interface DemandFilterCriteria {
  years: string[];
  statuses: string[];
  temas: string[];
  municipios: string[];
  hasReports: string[]; // 'sim' | 'nao'
  searchTerm: string;
}

export const UNCLASSIFIED_TEMA = 'Não Classificado';

const temaKey = (d: Demand): string => d.tema?.trim() || UNCLASSIFIED_TEMA;

const countBy = (demands: Demand[], keyOf: (d: Demand) => string | undefined): Record<string, number> =>
  demands.reduce((acc, d) => {
    const key = keyOf(d);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

const toOptions = (counts: Record<string, number>, compare: (a: string, b: string) => number): CountedOption[] =>
  Object.keys(counts).sort(compare).map(v => ({ value: v, label: v, count: counts[v] }));

/**
 * Options (with counts) for the multi-select filters shared by the Dashboard and the findings overview.
 */
export const buildDemandFilterOptions = (demands: Demand[]) => {
  const ptCompare = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
  const withReport = demands.filter(demandHasReport).length;

  return {
    yearOptions: toOptions(countBy(demands, d => String(d.ano || '')), (a, b) => Number(b) - Number(a)),
    statusOptions: toOptions(countBy(demands, d => d.status), (a, b) => a.localeCompare(b)),
    temaOptions: toOptions(countBy(demands, temaKey), ptCompare),
    municipioOptions: toOptions(countBy(demands, d => d.municipio?.trim()), ptCompare),
    reportOptions: [
      { value: 'sim', label: 'Com Relatório', count: withReport },
      { value: 'nao', label: 'Sem Relatório', count: demands.length - withReport },
    ] as CountedOption[],
  };
};

/**
 * Applies the multi-select filters and the free-text search.
 */
export const filterDemandsByCriteria = (demands: Demand[], c: DemandFilterCriteria): Demand[] => {
  const term = c.searchTerm.trim().toLowerCase();
  return demands.filter(d => {
    if (c.years.length > 0 && !c.years.includes(String(d.ano))) return false;
    if (c.statuses.length > 0 && !c.statuses.includes(d.status)) return false;
    if (c.temas.length > 0 && !c.temas.includes(temaKey(d))) return false;
    if (c.municipios.length > 0 && !c.municipios.includes(d.municipio?.trim() || '')) return false;

    if (c.hasReports.length > 0) {
      const hasReport = demandHasReport(d);
      const matches = (c.hasReports.includes('sim') && hasReport) || (c.hasReports.includes('nao') && !hasReport);
      if (!matches) return false;
    }

    if (term) {
      const searchable = [d.nFiscalizacao, d.municipio, d.tema, d.status, d.observacoes, d.resumoRelatorio]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(term)) return false;
    }

    return true;
  });
};
