import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CirclePlus, Presentation, Check, BellOff, RotateCcw } from 'lucide-react';
import { Demand, ActivityLogItem } from '../types';
import { PlusCircleIcon, FormIcon, XMarkIcon, Bars3Icon, FolderIcon, SparklesIcon } from './icons';
import { parseObservations, computeNoteDeadline } from '../utils/deadlineUtils';

interface SidebarMenuProps {
  onOpenCreateModal: () => void;
  onOpenDashboardModal: () => void;
  onOpenAnalysisModal?: () => void;
  onOpenFortnightReportModal?: () => void;
  onOpenSavedFindingsModal: () => void;
  onOpenReportFindingsModal: () => void;
  onOpenUserDataModal?: () => void;
  onSelectDemand?: (demand: Demand) => void;
  onConcludeNoteFromDemand?: (demand: Demand, noteId: string) => void;
  demands: Demand[];
  activityLogs?: ActivityLogItem[];
  currentUser?: any;
  onSignOut?: () => void;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  onOpenCreateModal,
  onOpenDashboardModal,
  onOpenAnalysisModal,
  onOpenFortnightReportModal,
  onOpenSavedFindingsModal,
  onOpenReportFindingsModal,
  onOpenUserDataModal,
  onSelectDemand,
  onConcludeNoteFromDemand,
  demands,
  activityLogs = [],
  currentUser,
  onSignOut,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Per-user storage key so users sharing a browser don't hide each other's alerts
  const dismissedStorageKey = `tcepr_dismissed_sidebar_alerts_${currentUser?.uid || 'anon'}`;

  // State to track dismissed note alert keys (demandId_date_title) without deleting the note itself
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(dismissedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissAlert = (alertKey: string) => {
    setDismissedAlertKeys(prev => {
      const updated = [...prev, alertKey];
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRestoreDismissedAlerts = () => {
    setDismissedAlertKeys([]);
    try {
      localStorage.removeItem(dismissedStorageKey);
    } catch {}
  };

  // Extract open notes from all demands
  const openNotes = useMemo(() => {
    const list: Array<{
      id: string;
      alertKey: string;
      municipio: string;
      tema: string;
      title: string;
      daysElapsed: number;
      prazoTotal: number | null;
      prazoStr: string;
      status: 'critical' | 'warning' | 'normal' | 'none';
      demand: Demand;
    }> = [];

    demands.forEach(demand => {
      const notes = parseObservations(demand.observacoes);
      notes.forEach(note => {
        // Content-based key: note.id depends on the note's position and shifts when notes are inserted
        const alertKey = `${demand.id}_${note.dateStr}_${note.title}`;
        // Skip if note is concluded OR if the alert has been dismissed from sidebar
        if (!note.isConcluded && !dismissedAlertKeys.includes(alertKey)) {
          const deadline = computeNoteDeadline(note);
          const daysElapsed = deadline ? deadline.daysElapsed : 0;
          const prazoStr = deadline ? `${daysElapsed}d/${note.prazoDias}d` : 'Sem prazo';
          const status: 'critical' | 'warning' | 'normal' | 'none' = deadline ? deadline.status : 'none';

          list.push({
            id: note.id,
            alertKey,
            municipio: demand.municipio,
            tema: demand.tema,
            title: note.title,
            daysElapsed,
            prazoTotal: note.prazoDias,
            prazoStr,
            status,
            demand,
          });
        }
      });
    });

    list.sort((a, b) => {
      const rank = { critical: 4, warning: 3, normal: 2, none: 1 };
      if (rank[b.status] !== rank[a.status]) {
        return rank[b.status] - rank[a.status];
      }
      return b.daysElapsed - a.daysElapsed;
    });

    return list;
  }, [demands, dismissedAlertKeys]);

  // Latest activity log item
  const latestLog = activityLogs.length > 0 ? activityLogs[0] : null;

  const handleAction = (action: () => void) => {
    action();
    setIsMobileOpen(false);
  };

  const menuContent = (
    <div className="flex flex-col h-full justify-between p-4 text-slate-700">
      <div className="space-y-4">
        {/* User Profile / Brand Header at Top */}
        <div className="pb-3 border-b border-slate-200 flex items-center justify-between gap-2 min-w-0">
          {currentUser ? (
            <div
              onClick={onOpenUserDataModal ? () => handleAction(onOpenUserDataModal) : undefined}
              title={onOpenUserDataModal ? 'Meus dados: exportar, importar e backup' : undefined}
              className={`flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 transition-all group min-w-0 ${onOpenUserDataModal ? 'cursor-pointer hover:border-tcepr-300 hover:bg-tcepr-50/60' : ''}`}
            >
              <div className="min-w-0 flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg bg-tcepr-50 border border-tcepr-100 group-hover:border-tcepr-200 flex items-center justify-center font-black text-tcepr-600 group-hover:text-tcepr-700 text-xs shrink-0 transition-colors">
                  {(currentUser.displayName || currentUser.email || 'U').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-tcepr-700 truncate leading-tight transition-colors">
                    {currentUser.displayName || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate leading-tight">
                    {currentUser.email}
                  </p>
                </div>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(onSignOut);
                  }}
                  title="Sair do Sistema"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 shrink-0 cursor-pointer"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 text-xs font-bold text-slate-400">
              Usuário Não Autenticado
            </div>
          )}

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 text-tcepr-600 hover:text-tcepr-800 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-2">
          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => handleAction(onOpenCreateModal)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r from-tcepr-700 via-tcepr-750 to-tcepr-800 hover:from-tcepr-800 hover:to-tcepr-900 text-white font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 text-xs text-left group cursor-pointer border border-tcepr-600/40"
          >
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CirclePlus className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block leading-tight font-extrabold text-white text-xs">Cadastrar Fiscalização</span>
              <span className="block text-[10px] text-tcepr-100/80 font-normal truncate">Novo processo ou demanda</span>
            </div>
          </button>

          {/* Sub Menu: Painel de Indicadores */}
          <button
            type="button"
            onClick={() => handleAction(onOpenDashboardModal)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <FormIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Painel de Indicadores</span>
              <span className="block text-[10px] text-slate-500 font-normal truncate">Metas, gráficos e filtros</span>
            </div>
          </button>

          {/* Sub Menu: Apresentação Quinzenal */}
          {onOpenFortnightReportModal && (
            <button
              type="button"
              onClick={() => handleAction(onOpenFortnightReportModal)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                <Presentation className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Apresentação Quinzenal</span>
                  <span className="px-1.5 py-0.2 bg-tcepr-100 text-tcepr-800 rounded font-mono font-extrabold text-[9px]">15d</span>
                </div>
                <span className="block text-[10px] text-slate-500 font-normal truncate">Slides & resumo p/ reunião</span>
              </div>
            </button>
          )}

          {/* Sub Menu: Consultoria & Inteligência IA */}
          {onOpenAnalysisModal && (
            <button
              type="button"
              onClick={() => handleAction(onOpenAnalysisModal)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                <SparklesIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Consultoria com IA</span>
                <span className="block text-[10px] text-slate-500 font-normal truncate">Perguntas & gerador de achados</span>
              </div>
            </button>
          )}

          {/* Sub Menu: Dados das Fiscalizações */}
          <button
            type="button"
            onClick={() => handleAction(onOpenReportFindingsModal)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <FormIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Dados das Fiscalizações</span>
              <span className="block text-[10px] text-slate-500 font-normal truncate">Achados consolidados (IA)</span>
            </div>
          </button>

          {/* Sub Menu: Minutas Salvas de Achados */}
          <button
            type="button"
            onClick={() => handleAction(onOpenSavedFindingsModal)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <FolderIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Minutas Salvas de Achados</span>
              <span className="block text-[10px] text-slate-500 font-normal truncate">Banco de teses padronizadas</span>
            </div>
          </button>

          {/* Sub Menu: Meus Dados (exportar / importar / duplicidades) */}
          {onOpenUserDataModal && (
            <button
              type="button"
              onClick={() => handleAction(onOpenUserDataModal)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 hover:bg-tcepr-50/70 border border-slate-200/90 hover:border-tcepr-300 rounded-xl text-xs font-bold text-slate-700 hover:text-tcepr-900 transition-all duration-200 active:scale-95 text-left group cursor-pointer shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 group-hover:border-tcepr-200 group-hover:bg-tcepr-100/60 text-tcepr-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                <FolderIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block leading-tight font-bold text-xs text-slate-800 group-hover:text-tcepr-900">Meus Dados & Backup</span>
                <span className="block text-[10px] text-slate-500 font-normal truncate">Exportar, importar e duplicidades</span>
              </div>
            </button>
          )}
        </div>

        {/* Synthetic Open Notes Section */}
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <FormIcon className="h-3 w-3 text-tcepr-600" />
              <span>Notas em Aberto</span>
            </p>
            <div className="flex items-center gap-1.5">
              {dismissedAlertKeys.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreDismissedAlerts}
                  className="text-[10px] text-slate-400 hover:text-tcepr-700 flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Restaurar avisos ocultos do menu"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restaurar</span>
                </button>
              )}
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold ${
                openNotes.length > 0 ? 'bg-amber-100/90 text-amber-900' : 'bg-slate-100 text-slate-500'
              }`}>
                {openNotes.length}
              </span>
            </div>
          </div>

          {openNotes.length > 0 ? (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5 [scrollbar-width:thin]">
              {openNotes.map((item) => (
                <div
                  key={`${item.demand.id}-${item.id}`}
                  onClick={() => onSelectDemand && handleAction(() => onSelectDemand(item.demand))}
                  className="w-full text-left p-2 bg-slate-50 hover:bg-tcepr-50/60 border border-slate-200/80 hover:border-tcepr-200 rounded-xl space-y-1 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <span className="font-bold text-xs text-slate-800 truncate flex-1 group-hover:text-tcepr-800">
                      {item.municipio}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                        item.status === 'critical' ? 'bg-rose-100/90 text-rose-800' :
                        item.status === 'warning' ? 'bg-amber-100/90 text-amber-900' :
                        item.status === 'normal' ? 'bg-emerald-100/90 text-emerald-800' :
                        'bg-slate-200/70 text-slate-700'
                      }`}>
                        {item.prazoStr}
                      </span>
                      {onConcludeNoteFromDemand && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConcludeNoteFromDemand(item.demand, item.id);
                          }}
                          className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 p-0.5 rounded transition-colors cursor-pointer"
                          title="Concluir nota (remove o aviso e marca a nota como concluída)"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissAlert(item.alertKey);
                        }}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 p-0.5 rounded transition-colors cursor-pointer"
                        title="Ocultar apenas o aviso no menu lateral (mantém a nota intacta)"
                      >
                        <BellOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium truncate leading-tight pr-1">
                    {item.tema}
                  </p>
                  {item.title && (
                    <p className="text-[9px] text-slate-400 italic truncate leading-tight pr-1">
                      "{item.title}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
              <p className="text-[10px] text-slate-400 italic">Nenhuma nota em aberto</p>
            </div>
          )}
        </div>

        {/* Activity Logs Quick Info */}
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
            Movimentações & Alterações
          </p>
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">Total de Registros:</span>
              <span className="px-1.5 py-0.5 bg-tcepr-50 text-tcepr-700 border border-tcepr-100 rounded-md font-mono text-[10px] font-bold">
                {activityLogs.length}
              </span>
            </div>
            {latestLog ? (
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-semibold block truncate">Última: {latestLog.title}</span>
                <span className="text-[9px] text-slate-400">{latestLog.timestamp}</span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">Nenhuma alteração recente</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-3 mt-auto border-t border-slate-200 text-center">
        <p className="text-[9px] text-slate-400 font-medium">
          Sistema de Monitoramento TCE-PR
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header Toggle Bar */}
      <div className="lg:hidden sticky top-0 z-[60] bg-white text-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
        >
          <Bars3Icon className="h-5 w-5 text-tcepr-600" />
          <span>Menu Lateral</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-3 py-1.5 bg-tcepr-700 hover:bg-tcepr-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>Nova Fisc.</span>
          </button>
        </div>
      </div>

      {/* Mobile Backdrop & Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[85]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white text-slate-800 z-[90] flex flex-col border-r border-slate-200 shadow-2xl"
            >
              {menuContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Persistent Fixed Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 xl:w-72 bg-white text-slate-800 z-[40] flex-col border-r border-slate-200 shadow-md overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {menuContent}
      </aside>
    </>
  );
};

export default SidebarMenu;
