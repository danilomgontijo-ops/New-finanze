import { Demand, ActivityLogItem } from '../types';

export function getDemandChangesSummary(oldDemand: Demand, newDemand: Demand): {
  hasChanges: boolean;
  title: string;
  details: string;
  changedFieldNames: string[];
} {
  const changes: { field: string; text: string }[] = [];

  // Status
  if ((oldDemand.status || '') !== (newDemand.status || '')) {
    changes.push({
      field: 'Status',
      text: `<strong>Status:</strong> de <span class="text-amber-300 font-bold">"${oldDemand.status || 'Não definido'}"</span> para <span class="text-emerald-300 font-bold">"${newDemand.status || 'Não definido'}"</span>`
    });
  }

  // Município
  if (String(oldDemand.municipio || '').trim() !== String(newDemand.municipio || '').trim()) {
    changes.push({
      field: 'Município',
      text: `<strong>Município:</strong> de "${oldDemand.municipio || '-'}" para "${newDemand.municipio || '-'}"`
    });
  }

  // Nº Fiscalização
  if (String(oldDemand.nFiscalizacao || '').trim() !== String(newDemand.nFiscalizacao || '').trim()) {
    changes.push({
      field: 'Nº Fiscalização',
      text: `<strong>Nº Fiscalização:</strong> de "${oldDemand.nFiscalizacao || 'Sem número'}" para "${newDemand.nFiscalizacao || 'Sem número'}"`
    });
  }

  // Ano
  if (String(oldDemand.ano || '').trim() !== String(newDemand.ano || '').trim()) {
    changes.push({
      field: 'Ano',
      text: `<strong>Ano:</strong> de ${oldDemand.ano || '-'} para ${newDemand.ano || '-'}`
    });
  }

  // Modalidade
  if (String(oldDemand.modalidade || '').trim() !== String(newDemand.modalidade || '').trim()) {
    changes.push({
      field: 'Modalidade',
      text: `<strong>Modalidade:</strong> de "${oldDemand.modalidade || 'Não informada'}" para "${newDemand.modalidade || 'Não informada'}"`
    });
  }

  // Tema / Objeto
  if (String(oldDemand.tema || '').trim() !== String(newDemand.tema || '').trim()) {
    changes.push({
      field: 'Tema/Objeto',
      text: `<strong>Tema / Objeto:</strong> de "${oldDemand.tema || 'Não informado'}" para "${newDemand.tema || 'Não informado'}"`
    });
  }

  // Valor
  if (String(oldDemand.valor || '').trim() !== String(newDemand.valor || '').trim()) {
    const oldVal = oldDemand.valor ? `R$ ${oldDemand.valor}` : 'R$ 0';
    const newVal = newDemand.valor ? `R$ ${newDemand.valor}` : 'R$ 0';
    changes.push({
      field: 'Valor Estimado',
      text: `<strong>Valor Estimado:</strong> de ${oldVal} para ${newVal}`
    });
  }

  // Data Req. Externo / Prazo
  if (String(oldDemand.dataReqExterno || '').trim() !== String(newDemand.dataReqExterno || '').trim()) {
    changes.push({
      field: 'Prazo/Data Req.',
      text: `<strong>Data Req. Externo / Prazo:</strong> de "${oldDemand.dataReqExterno || 'Não informado'}" para "${newDemand.dataReqExterno || 'Não informado'}"`
    });
  }

  // Requerimento Externo
  if (String(oldDemand.requerimentoExterno || '').trim() !== String(newDemand.requerimentoExterno || '').trim()) {
    changes.push({
      field: 'Requerimento Externo',
      text: `<strong>Requerimento Externo:</strong> alterado`
    });
  }

  // Encaminhamento Processual
  if (String(oldDemand.encaminhamentoProcessual || '').trim() !== String(newDemand.encaminhamentoProcessual || '').trim()) {
    changes.push({
      field: 'Encaminhamento Processual',
      text: `<strong>Encaminhamento Processual:</strong> alterado`
    });
  }

  // Representação Externa
  const oldReps = (oldDemand.representacaoExterna || []).slice().sort().join(', ');
  const newReps = (newDemand.representacaoExterna || []).slice().sort().join(', ');
  if (oldReps !== newReps) {
    changes.push({
      field: 'Representação Externa',
      text: `<strong>Representação Externa:</strong> de [${oldReps || 'Nenhuma'}] para [${newReps || 'Nenhuma'}]`
    });
  }

  // Relatório / Anexos
  if (
    String(oldDemand.resumoRelatorio || '') !== String(newDemand.resumoRelatorio || '') ||
    String(oldDemand.relatorioNomeArquivo || '') !== String(newDemand.relatorioNomeArquivo || '') ||
    JSON.stringify(oldDemand.relatorioArquivos || []) !== JSON.stringify(newDemand.relatorioArquivos || [])
  ) {
    changes.push({
      field: 'Relatório/Anexos',
      text: `<strong>Relatório / Anexos:</strong> síntese ou arquivos de relatório atualizados`
    });
  }

  if (changes.length === 0) {
    return {
      hasChanges: false,
      title: 'Dados da Fiscalização Atualizados',
      details: '',
      changedFieldNames: []
    };
  }

  const changedFieldNames = changes.map(c => c.field);
  const title = `Campos Alterados (${changedFieldNames.length}): ${changedFieldNames.join(', ')}`;
  const details = `<ul class="list-disc pl-4 space-y-1 my-1">${changes.map(c => `<li>${c.text}</li>`).join('')}</ul>`;

  return {
    hasChanges: true,
    title,
    details,
    changedFieldNames
  };
}

export function parseLogDate(item: ActivityLogItem): Date | null {
  if (item.isoDate) {
    const d = new Date(item.isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.id) {
    const matchId = item.id.match(/^log_(\d{12,})/);
    if (matchId) {
      const epoch = parseInt(matchId[1], 10);
      if (!isNaN(epoch)) return new Date(epoch);
    }
  }
  if (item.timestamp) {
    const datePart = item.timestamp.split(',')[0].trim();
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}
