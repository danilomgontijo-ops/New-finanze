
import React from 'react';
import { Demand } from '../types';

interface StatusBadgeProps {
  status: Demand['status'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colors: { [key in Demand['status']]: string } = {
    'Pendente': 'bg-amber-100/80 text-amber-900',
    'Fiscalização em Curso': 'bg-tcepr-100/90 text-tcepr-950 font-extrabold',
    'Aguardando Manifestação': 'bg-sky-100/80 text-sky-900',
    'Sem Fiscalização': 'bg-orange-100/80 text-orange-900',
    'Concluído': 'bg-emerald-100/80 text-emerald-900',
    'Suspenso': 'bg-slate-200/80 text-slate-800',
    'Revogado': 'bg-rose-100/80 text-rose-900',
  };

  const dots: { [key in Demand['status']]: string } = {
    'Pendente': 'bg-amber-500',
    'Fiscalização em Curso': 'bg-sky-500 animate-pulse',
    'Aguardando Manifestação': 'bg-sky-500',
    'Sem Fiscalização': 'bg-orange-500',
    'Concluído': 'bg-emerald-500',
    'Suspenso': 'bg-slate-400',
    'Revogado': 'bg-rose-500',
  };

  return (
    <span className={`px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase rounded-xl whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-colors duration-150 ${colors[status] || colors['Suspenso']}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[status] || 'bg-slate-400'}`} />
      {status}
    </span>
  );
};

export default StatusBadge;
