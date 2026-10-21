import { Demand } from '../types';
import { normalizeForSearch } from './helpers';

export interface FindingItem {
  id: string;
  title: string;
  status: 'sanado' | 'nao_sanado' | 'nao_confirmado';
  snippet?: string;
}

export interface DemandFindingsSummary {
  demand: Demand;
  demandId: string;
  nFiscalizacao?: string;
  municipio: string;
  tema?: string;
  hasReport: boolean;
  reportName?: string;
  totalAchados: number;
  sanados: number;
  naoSanados: number;
  naoConfirmados: number;
  items: FindingItem[];
}

export interface GroupedFindingsSummary {
  groupName: string; // Nome do Tema ou Município
  demandsCount: number;
  demandsWithReportCount: number;
  totalAchados: number;
  sanados: number;
  naoSanados: number;
  naoConfirmados: number;
  demands: DemandFindingsSummary[];
}

// Normaliza o texto removendo acentos para facilitarmos checagens de palavras-chave
const normalizeText = normalizeForSearch;

// Formas negadas que precisam ser testadas ANTES das palavras positivas (ex.: "n\u00e3o atendido" cont\u00e9m "atendid")
const NEGATED_POSITIVE_TERMS = [
  'nao sanad',
  'nao atendid',
  'nao esclarecid',
  'nao corrigid',
  'nao regularizad',
  'nao acolhid',
];

/**
 * Determina o status de um bloco de texto de achado
 */
export function determineFindingStatus(text: string): 'sanado' | 'nao_sanado' | 'nao_confirmado' {
  const norm = normalizeText(text);

  // 1. PRIORIDADE MÁXIMA: Linha explícita de Conclusão / Desfecho
  // Exemplos: "- CONCLUSÃO: Achado Não Sanado", "CONCLUSÃO: Achado Sanado", "- Conclusão: Achado Parcialmente Sanado"
  const conclusionMatch = text.match(/(?:conclus[aã]o|desfecho|resultado|decis[aã]o)\s*[:\-–]\s*([^\n\r]+)/i);
  if (conclusionMatch && conclusionMatch[1]) {
    const conc = normalizeText(conclusionMatch[1]);
    
    // Conclusão explicitamente Não Sanado ou Parcialmente Sanado
    if (
      NEGATED_POSITIVE_TERMS.some(t => conc.includes(t)) ||
      conc.includes('parcialmente sanad') ||
      conc.includes('irregularidade mantida') ||
      conc.includes('mantid') ||
      conc.includes('irregular')
    ) {
      return 'nao_sanado';
    }

    // Conclusão explicitamente Sanado
    if (
      conc.includes('sanad') ||
      conc.includes('regularizad') ||
      conc.includes('acolhid') ||
      conc.includes('corrigid') ||
      conc.includes('esclarecid') ||
      conc.includes('atendid')
    ) {
      return 'sanado';
    }

    // Conclusão explicitamente Não Confirmado / Descaracterizado / Afastado / Perda de Objeto
    if (
      conc.includes('nao confirmad') ||
      conc.includes('descaracterizad') ||
      conc.includes('afastad') ||
      conc.includes('perda de objeto') ||
      conc.includes('perda do objeto') ||
      conc.includes('improcedent') ||
      conc.includes('insubsistent')
    ) {
      return 'nao_confirmado';
    }
  }

  // 2. SEGUNDA PRIORIDADE: Encerramento do parágrafo / últimas linhas da análise da equipe
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const endSection = lines.slice(-3).join(' ');
  const normEnd = normalizeText(endSection);

  // Se o final do texto indica que a irregularidade persistiu / não foi sanada
  if (
    normEnd.includes('nao sanad') ||
    normEnd.includes('parcialmente sanad') ||
    normEnd.includes('irregularidade mantida') ||
    normEnd.includes('achado mantido') ||
    normEnd.includes('irregularidade persistiu') ||
    normEnd.includes('falha persistiu') ||
    normEnd.includes('persistiram as irregularidades') ||
    normEnd.includes('insuficiente para sanar') ||
    normEnd.includes('insuficientes para sanar') ||
    normEnd.includes('nao foram suficientes para sanar') ||
    normEnd.includes('nao foi suficiente para sanar')
  ) {
    return 'nao_sanado';
  }

  // Se o final do texto indica saneamento completo
  if (
    normEnd.includes('suficiente para sanar') ||
    normEnd.includes('foram suficientes para sanar') ||
    normEnd.includes('sanada a questao') ||
    normEnd.includes('sanada a irregularidade') ||
    normEnd.includes('achado sanado')
  ) {
    return 'sanado';
  }

  // 3. TERCEIRA PRIORIDADE: Expressões específicas no texto completo
  // Importante: NÃO usar palavras genéricas soltas como 'desconsiderada' ou 'improcedente',
  // pois no texto da fiscalização a equipe frequentemente diz: "a justificativa do gestor foi desconsiderada/improcedente",
  // o que significa que o achado FOI MANTIDO (Não Sanado), e NÃO que o achado foi "não confirmado"!
  
  // Expressões estritas para Achado Não Confirmado / Afastado:
  if (
    norm.includes('achado nao confirmado') ||
    norm.includes('achado descaracterizado') ||
    norm.includes('irregularidade descaracterizada') ||
    norm.includes('achado improcedente') ||
    norm.includes('irregularidade afastada') ||
    norm.includes('apontamento afastado') ||
    norm.includes('afastada a irregularidade') ||
    norm.includes('perda de objeto') ||
    norm.includes('perda do objeto') ||
    norm.includes('descaracterizou o achado') ||
    norm.includes('descaracterizou a irregularidade') ||
    norm.includes('nao se confirmou a irregularidade') ||
    norm.includes('nao restou confirmada a irregularidade')
  ) {
    return 'nao_confirmado';
  }

  // Expressões para Não Sanado
  if (
    NEGATED_POSITIVE_TERMS.some(t => norm.includes(t)) ||
    norm.includes('parcialmente sanad') ||
    norm.includes('irregularidade mantida') ||
    norm.includes('mantido o achado') ||
    norm.includes('mantida a irregularidade') ||
    norm.includes('justificativa considerada improcedente') ||
    norm.includes('alegacoes consideradas improcedentes') ||
    norm.includes('rejeitada a justificativa') ||
    norm.includes('justificativas nao acolhidas') ||
    norm.includes('irregularidade persistiu')
  ) {
    return 'nao_sanado';
  }

  // Expressões para Sanado
  if (
    norm.includes('sanad') ||
    norm.includes('regularizad') ||
    norm.includes('acolhida a justificativa') ||
    norm.includes('justificativa acolhida') ||
    norm.includes('justificativas acolhidas') ||
    norm.includes('esclarecido') ||
    norm.includes('atendido') ||
    norm.includes('sanou')
  ) {
    return 'sanado';
  }

  // Por padrão, se não foi afastado nem comprovadamente sanado, permanece como 'não sanado'
  return 'nao_sanado';
}

/**
 * Extrai e estrutura os achados de uma fiscalização especificamente a partir do Resumo do Relatório (IA)
 */
export function extractDemandFindings(demand: Demand): DemandFindingsSummary {
  const resumoText = demand.resumoRelatorio?.trim() || '';
  const reportName = demand.relatorioNomeArquivo || 
    (demand.relatorioArquivos && demand.relatorioArquivos.length > 0 ? demand.relatorioArquivos[0].nome : undefined);

  if (!resumoText) {
    return {
      demand,
      demandId: demand.id,
      nFiscalizacao: demand.nFiscalizacao,
      municipio: demand.municipio,
      tema: demand.tema,
      hasReport: false,
      reportName,
      totalAchados: 0,
      sanados: 0,
      naoSanados: 0,
      naoConfirmados: 0,
      items: [],
    };
  }

  // Pre-processa quebras de linha e HTML
  const cleanText = resumoText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  const items: FindingItem[] = [];

  // Tenta identificar tópicos/achados estruturados (ex: "ACHADO 1:", "TÓPICO 2:", "APONTAMENTO 3")
  const achadoRegex = /(?:ACHADO|TÓPICO|APONTAMENTO)\s*[\d\w/]*\s*[:\-–]/gi;
  const matches = Array.from(cleanText.matchAll(achadoRegex));

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].index || 0;
      const endIdx = i + 1 < matches.length ? (matches[i + 1].index || cleanText.length) : cleanText.length;
      const blockText = cleanText.substring(startIdx, endIdx).trim();

      const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
      let title = lines[0] || `Achado ${i + 1}`;
      title = title.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();

      // Se o título for apenas "ACHADO 1:" e houver linha seguinte, combina o nome
      if (/^(?:ACHADO|TÓPICO|APONTAMENTO)\s*\d*\s*[:\-–]?$/i.test(title) && lines.length > 1) {
        title = `${title} ${lines[1].replace(/\*\*/g, '')}`;
      }

      const status = determineFindingStatus(blockText);
      const snippet = lines.slice(1, 3).join(' ').replace(/\*\*/g, '').slice(0, 180);

      items.push({
        id: `${demand.id}-finding-${i + 1}`,
        title: title.slice(0, 130),
        status,
        snippet: snippet ? `${snippet}...` : undefined,
      });
    }
  } else {
    // Se não há cabeçalhos "ACHADO X:", extrai itens por marcadores de tópicos (listas / marcadores)
    const bulletRegex = /(?:^|\n)(?:\d+\.|\-|\*|•)\s*(.+)/g;
    const bulletMatches = Array.from(cleanText.matchAll(bulletRegex));

    if (bulletMatches.length > 0) {
      bulletMatches.forEach((bm, idx) => {
        const bulletText = bm[1].trim();
        if (bulletText.length > 15) {
          const status = determineFindingStatus(bulletText);
          const cleanTitle = bulletText.replace(/\*\*/g, '').slice(0, 130);
          items.push({
            id: `${demand.id}-item-${idx + 1}`,
            title: cleanTitle,
            status,
          });
        }
      });
    }

    // Se ainda assim não identificou marcadores, trata o resumo como 1 achado sintético
    if (items.length === 0 && cleanText.length > 0) {
      const status = determineFindingStatus(cleanText);
      const title = cleanText.replace(/\*\*/g, '').slice(0, 120);
      items.push({
        id: `${demand.id}-synthetic-1`,
        title,
        status,
      });
    }
  }

  const sanados = items.filter(i => i.status === 'sanado').length;
  const naoSanados = items.filter(i => i.status === 'nao_sanado').length;
  const naoConfirmados = items.filter(i => i.status === 'nao_confirmado').length;

  return {
    demand,
    demandId: demand.id,
    nFiscalizacao: demand.nFiscalizacao,
    municipio: demand.municipio,
    tema: demand.tema,
    hasReport: true,
    reportName,
    totalAchados: items.length,
    sanados,
    naoSanados,
    naoConfirmados,
    items,
  };
}
