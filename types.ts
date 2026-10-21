
export interface RelatorioArquivoItem {
  nome: string;
  texto: string;
  url?: string;
  storagePath?: string;
  tamanho?: number;
  tipo?: string;
  base64Data?: string;
  dataUpload?: string;
}

export interface Demand {
  id: string;
  ano: number | string;
  nFiscalizacao?: string;
  municipio: string;
  modalidade?: string;
  tema?: string;
  valor?: number | string;
  status: 'Pendente' | 'Fiscalização em Curso' | 'Aguardando Manifestação' | 'Concluído' | 'Revogado' | 'Suspenso' | 'Sem Fiscalização';
  representacaoExterna: string[];
  dataReqExterno?: string;
  requerimentoExterno?: string;
  encaminhamentoProcessual?: string;
  numeroProcesso?: string;
  objeto?: string;
  observacoes?: string;
  resumoRelatorio?: string;
  relatorioTextoCompleto?: string;
  relatorioNomeArquivo?: string;
  relatorioArquivos?: RelatorioArquivoItem[];
  createdAt: any; // Firestore Timestamp
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AutocompleteOptions {
  modalidade: string[];
  tema: string[];
  municipio: string[];
}

export type ActivityActionType = 'cadastrada' | 'inclusao_nota' | 'exclusao_nota' | 'conclusao_nota' | 'exclusao_fiscalizacao' | 'atualizada' | 'edicao_fiscalizacao';

export interface ActivityLogItem {
  id: string;
  demandId?: string;
  municipio: string;
  nFiscalizacao?: string;
  ano?: number | string;
  status?: string;
  actionType: ActivityActionType;
  title: string;
  details?: string;
  timestamp: string;
  isoDate?: string;
}

export interface SavedFinding {
  id: string;
  titulo: string;
  conteudoHtml: string;
  createdAt: string;
  tema?: string;
  tags?: string[];
}

export interface SavedConsultation {
  id: string;
  pergunta: string;
  respostaHtml: string;
  createdAt: string;
  totalDemandsContext?: number;
}

export interface SavedPresentation {
  id: string;
  title: string;
  savedAt: string;
  periodText: string;
  startDateIso: string;
  endDateIso: string;
  eventTypes: {
    showNew: boolean;
    showConcluded: boolean;
    showNotes: boolean;
    showOngoing?: boolean;
    hideMinorEdits: boolean;
  };
  selectedDemandIds: string[];
  demandsCount: number;
}
