import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import { ActivityLogItem } from '../types';
import { SparklesIcon, CheckCircleIcon, ViewIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, ClockIcon, PlusIcon, FormIcon, TagIcon } from './icons';
import { parseLogDate } from '../utils/logUtils';

interface ActivityHistorySectionProps {
  logs: ActivityLogItem[];
  onClearHistory: () => void;
  onDeleteLogItem?: (logId: string) => void;
  onViewDemand?: (demandId: string) => void;
}

export const ActivityHistorySection: React.FC<ActivityHistorySectionProps> = ({
  logs,
  onClearHistory,
  onDeleteLogItem,
  onViewDemand,
}) => {
  // Collapsed by default as explicitly requested
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  if (!logs || logs.length === 0) return null;

  const setPresetPeriod = (preset: 'today' | '7days' | '30days' | 'month') => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setEndDate(formatDate(today));

    if (preset === 'today') {
      setStartDate(formatDate(today));
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(formatDate(past));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(formatDate(past));
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(firstDay));
    }
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredLogs = logs.filter((item) => {
    // Action type filter
    if (filterType === 'inclusoes' && !(item.actionType === 'inclusao_nota' || item.actionType === 'cadastrada')) {
      return false;
    }
    if (filterType === 'exclusoes' && !(item.actionType === 'exclusao_nota' || item.actionType === 'exclusao_fiscalizacao')) {
      return false;
    }
    if (filterType === 'conclusoes' && item.actionType !== 'conclusao_nota') {
      return false;
    }
    if (filterType === 'atualizacoes' && item.actionType !== 'atualizada') {
      return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const logDate = parseLogDate(item);
      if (logDate) {
        if (startDate) {
          const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
          const startDateTime = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
          if (logDate < startDateTime) return false;
        }
        if (endDate) {
          const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
          const endDateTime = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
          if (logDate > endDateTime) return false;
        }
      }
    }

    return true;
  });

  const getBadgeStyle = (actionType: string) => {
    switch (actionType) {
      case 'cadastrada':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Nova Fiscalização',
          icon: <PlusIcon className="h-3.5 w-3.5 text-emerald-600" />
        };
      case 'inclusao_nota':
        return {
          bg: 'bg-tcepr-50 text-tcepr-700 border-tcepr-100',
          label: 'Inclusão de Nota',
          icon: <TagIcon className="h-3.5 w-3.5 text-tcepr-600" />
        };
      case 'exclusao_nota':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'Exclusão de Nota',
          icon: <TrashIcon className="h-3.5 w-3.5 text-rose-600" />
        };
      case 'exclusao_fiscalizacao':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          label: 'Fiscalização Excluída',
          icon: <TrashIcon className="h-3.5 w-3.5 text-rose-700" />
        };
      case 'conclusao_nota':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          label: 'Nota Concluída',
          icon: <CheckCircleIcon className="h-3.5 w-3.5 text-teal-600" />
        };
      case 'atualizada':
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'Fiscalização Atualizada',
          icon: <FormIcon className="h-3.5 w-3.5 text-amber-600" />
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white text-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 mb-6 relative overflow-hidden transition-all duration-300"
    >
      {/* Background Glows */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-tcepr-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-sky-100/35 rounded-full blur-3xl pointer-events-none" />

      {/* Main Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-[260px]"
        >
          <div className="p-2 bg-tcepr-50 text-tcepr-600 rounded-xl border border-tcepr-100">
            <ClockIcon className="h-5 w-5 text-tcepr-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 tracking-tight">
                Histórico de Movimentações e Alterações
              </h3>
              <span className="bg-slate-100 text-slate-600 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200">
                {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 active:scale-95"
          >
            <span>{isCollapsed ? 'Ver Histórico Completo' : 'Ocultar Histórico'}</span>
            {isCollapsed ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 pt-4 border-t border-slate-200 relative z-10 space-y-4"
          >
            {/* Date Range Filter / Period Selector */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-tcepr-700">
                <CalendarIcon className="h-4 w-4 text-tcepr-600" />
                <span>Filtrar por Período de Movimentação:</span>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                {/* Date Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 focus-within:border-tcepr-500 transition-colors">
                    <label htmlFor="log-start-date" className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      Data Inicial:
                    </label>
                    <input
                      id="log-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-xs font-medium text-slate-700 focus:outline-hidden w-full cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 focus-within:border-tcepr-500 transition-colors">
                    <label htmlFor="log-end-date" className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      Data Final:
                    </label>
                    <input
                      id="log-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-xs font-medium text-slate-700 focus:outline-hidden w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick Period Presets */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPresetPeriod('today')}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetPeriod('7days')}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetPeriod('30days')}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    Últimos 30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetPeriod('month')}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    Este Mês
                  </button>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={clearDateFilter}
                      className="px-2.5 py-1.5 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                    >
                      Limpar Período
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Tabs & Clear Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-tcepr-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todos ({filteredLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('inclusoes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'inclusoes'
                      ? 'bg-tcepr-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <PlusIcon className="h-3.5 w-3.5 text-tcepr-600" />
                  <span>Inclusões</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('exclusoes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'exclusoes'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <TrashIcon className="h-3.5 w-3.5 text-rose-500" />
                  <span>Exclusões</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('conclusoes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'conclusoes'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircleIcon className="h-3.5 w-3.5 text-teal-600" />
                  <span>Conclusões</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('atualizacoes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'atualizacoes'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FormIcon className="h-3.5 w-3.5 text-amber-500" />
                  <span>Alterações</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClearHistory}
                className="px-2.5 py-1 text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold"
                title="Limpar histórico recente"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span>Limpar Registros</span>
              </button>
            </div>

            {/* List of History Items */}
            {filteredLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs font-semibold">Nenhum registro de movimentação encontrado para os filtros selecionados.</p>
                {(startDate || endDate || filterType !== 'all') && (
                  <button
                    type="button"
                    onClick={() => { clearDateFilter(); setFilterType('all'); }}
                    className="text-xs text-tcepr-600 hover:text-tcepr-800 underline cursor-pointer font-bold"
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredLogs.map((item) => {
                  const badge = getBadgeStyle(item.actionType);
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all space-y-2 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${badge.bg}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>

                          <span className="font-bold text-slate-800 text-xs sm:text-sm">
                            {item.municipio} {item.ano ? `(${item.ano})` : ''}
                          </span>

                          {item.nFiscalizacao && (
                            <span className="text-[10px] font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                              Nº {item.nFiscalizacao}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {item.timestamp}
                          </span>

                          {item.demandId && onViewDemand && item.actionType !== 'exclusao_fiscalizacao' && (
                            <button
                              type="button"
                              onClick={() => onViewDemand(item.demandId!)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
                            >
                              <ViewIcon className="h-3 w-3" />
                              <span>Ver</span>
                            </button>
                          )}

                          {onDeleteLogItem && (
                            <button
                              type="button"
                              onClick={() => onDeleteLogItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir este registro do histórico"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Details snippet */}
                      {item.details && (
                        <div className="text-xs text-slate-600 font-medium">
                          <div
                            className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 line-clamp-3 leading-relaxed [&_strong]:text-tcepr-700 font-medium"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.details) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActivityHistorySection;
