import React, { useMemo, useState } from 'react';
import { Demand } from '../types';
import StatusBadge from './StatusBadge';
import { AlarmClockIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, AlertIcon, CalendarIcon, TagIcon } from './icons';
import { getDemandDeadlineInfo, ParsedObservationNote } from '../utils/deadlineUtils';

interface AlertsSectionProps {
  demands: Demand[];
  onViewDemand: (demand: Demand) => void;
  onConcludeNote?: (demand: Demand, noteId: string, noteTitle?: string) => void;
}

interface AlertedNoteItem {
  demand: Demand;
  note: ParsedObservationNote;
  daysElapsed: number;
  daysRemaining: number;
  status: 'critical' | 'warning';
}

export const AlertsSection: React.FC<AlertsSectionProps> = ({ demands, onViewDemand, onConcludeNote }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const alertedNoteItems = useMemo<AlertedNoteItem[]>(() => {
    if (!demands) return [];
    const items: AlertedNoteItem[] = [];

    for (const demand of demands) {
      const info = getDemandDeadlineInfo(demand);
      if (info.isMonitored && info.activeNotes.length > 0) {
        for (const activeNote of info.activeNotes) {
          if (activeNote.status === 'critical' || activeNote.status === 'warning') {
            items.push({
              demand,
              note: activeNote.note,
              daysElapsed: activeNote.daysElapsed,
              daysRemaining: activeNote.daysRemaining,
              status: activeNote.status,
            });
          }
        }
      }
    }

    // Sort by days elapsed descending (most overdue first)
    return items.sort((a, b) => b.daysElapsed - a.daysElapsed);
  }, [demands]);

  if (!alertedNoteItems || alertedNoteItems.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm text-emerald-800 mb-6">
        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 border border-emerald-200 flex items-center justify-center">
          <CheckCircleIcon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-[14px] text-emerald-900">Status de Prazos em Dia</h3>
          <p className="text-xs text-emerald-700 font-medium">Todas as notas de fiscalização cadastradas estão dentro do prazo estipulado ou sem pendências.</p>
        </div>
      </div>
    );
  }

  const criticalCount = alertedNoteItems.filter(item => item.status === 'critical').length;
  const warningCount = alertedNoteItems.filter(item => item.status === 'warning').length;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 mb-6 transition-all duration-300">
      <div 
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 relative">
            <AlarmClockIcon className="h-5 w-5 animate-bounce text-rose-600" />
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              {alertedNoteItems.length}
            </span>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-[15px] tracking-tight flex flex-wrap items-center gap-2">
              <span>Alertas de Prazos por Nota / Observação</span>
              {criticalCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full border border-rose-200 flex items-center gap-1">
                  <AlarmClockIcon className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  <span>{criticalCount} Vencida(s)</span>
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 flex items-center gap-1">
                  <AlertIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>{warningCount} Próxima(s)</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cada nota possui contagem de prazo individual. Conclua individualmente as notas resolvidas para remover o alerta.
            </p>
          </div>
        </div>
        <button 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          aria-label={isCollapsed ? "Expandir Alertas" : "Recolher Alertas"}
        >
          {isCollapsed ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronUpIcon className="h-5 w-5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 animate-in fade-in slide-in-from-top-3 duration-300">
          {alertedNoteItems.map(({ demand, note, daysElapsed, status }) => {
            const isCritical = status === 'critical';
            return (
              <div 
                key={`${demand.id}_${note.id}`} 
                className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  isCritical ? 'border-rose-200 bg-rose-50/50 hover:border-rose-300' : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="text-xs font-extrabold text-slate-800 tracking-tight block truncate max-w-[160px]">
                      {demand.municipio} ({demand.ano})
                    </span>
                    <StatusBadge status={demand.status} />
                  </div>

                  {/* Title of specific note */}
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg mb-2 shadow-xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                      <span>Nota / Movimentação:</span>
                      <span className="text-slate-600 flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-slate-400" />
                        <span>{note.dateStr}</span>
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 flex items-start gap-1.5">
                      <TagIcon className="h-3.5 w-3.5 text-tcepr-600 shrink-0 mt-0.5" />
                      <span>{note.title}</span>
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium mb-2 flex items-center justify-between">
                    <span>Prazo Limite: <strong className="text-slate-700">{note.prazoDias} dias</strong></span>
                    {note.limitDateStr && <span className="text-slate-500">Até: {note.limitDateStr}</span>}
                  </div>
                </div>
                
                <div className="border-t border-slate-200 pt-3 mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                    isCritical ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                  }`}>
                    {isCritical ? (
                      <>
                        <AlarmClockIcon className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span>Vencido ({daysElapsed}d / {note.prazoDias}d)</span>
                      </>
                    ) : (
                      <>
                        <AlarmClockIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Atenção ({daysElapsed}d / {note.prazoDias}d)</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onConcludeNote && (
                      <button 
                        type="button"
                        onClick={() => onConcludeNote(demand, note.id, note.title)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                        title="Marcar esta nota específica como concluída"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Concluir Nota</span>
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => onViewDemand(demand)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                    >
                      Ver
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertsSection;
