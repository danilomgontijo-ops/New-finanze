import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

// Configure pdfjs worker safely using Vite-bundled worker URL
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch (e) {
    console.warn('Could not set pdfjs workerSrc:', e);
  }
}

export interface ExtractedFileResult {
  fileName: string;
  fullText: string;
  analiseDaEquipeText: string; // Sections: Condição + Análise da Equipe
  estimatedTokens: number;
  analiseDaEquipeTokens: number;
  totalTokens: number;
}

/**
 * Estimates token count for Portuguese text (approx. 1 token per 3.8 characters)
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
};

/**
 * Calculates estimated cost in R$ (BRL) based on Gemini Flash pricing
 * Input: ~$0.075 / 1M tokens (~R$ 0,45 / 1M)
 * Output: ~$0.30 / 1M tokens (~R$ 1,80 / 1M)
 */
export const calculateEstimatedCostBRL = (inputTokens: number, outputTokens: number = 1500): { inputCost: number; outputCost: number; totalCost: number } => {
  const usdToBrl = 5.80; // approximate exchange rate
  const inputRateUsdPerToken = 0.075 / 1000000;
  const outputRateUsdPerToken = 0.30 / 1000000;

  const inputCost = inputTokens * inputRateUsdPerToken * usdToBrl;
  const outputCost = outputTokens * outputRateUsdPerToken * usdToBrl;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
};

/**
 * Extracts "Condição / Situação Encontrada" and "Análise da Equipe" sections from text
 */
export const filterAnaliseDaEquipe = (text: string): string => {
  if (!text) return '';

  const regexes = [
    // Seções de Condição / Situação Encontrada (incluindo numerações como 1., 2., 3., Item, Quadro, etc.)
    /(?:(?:\d+[\.\s]*)?(?:CONDIÇÃO|SITUAÇÃO ENCONTRADA|DESCRIÇÃO DO ACHADO|DESCRIÇÃO DA IRREGULARIDADE|DETALHAMENTO DO ACHADO|QUADRO DO ACHADO|ACHADO))[\s\S]*?(?=(?:CRITÉRIO|CAUSA|EFEITO|ANÁLISE DA EQUIPE|CONCLUSÃO|RECOMENDAÇÃO|PROPOSTA DE ENCAMINHAMENTO|ACHADO \d+|$))/gi,
    // Seções de Análise da Equipe
    /(?:(?:\d+[\.\s]*)?(?:ANÁLISE DA EQUIPE(?: DE AUDITORIA)?|ANÁLISE DO ACHADO|MANIFESTAÇÃO DA EQUIPE|ANÁLISE DA UNIDADE TÉCNICA|JUSTIFICATIVA DA EQUIPE))[\s\S]*?(?=(?:CONCLUSÃO|ENCAMINHAMENTO|PROPOSTA DE ENCAMINHAMENTO|RECOMENDAÇÃO|ACHADO \d+|PROCESSO \d+|$))/gi,
  ];

  let matches: string[] = [];
  for (const regex of regexes) {
    const found = text.match(regex);
    if (found && found.length > 0) {
      matches.push(...found);
    }
  }

  if (matches.length > 0) {
    return matches.join('\n\n--- [SEÇÃO EXTRAÍDA: CONDIÇÃO E ANÁLISE DA EQUIPE] ---\n\n');
  }

  // If no explicit header pattern match, return full text
  return text;
};

export const extractTextFromFile = async (file: File): Promise<ExtractedFileResult> => {
  const fileName = file.name;
  const fileExt = fileName.split('.').pop()?.toLowerCase();
  let fullText = '';

  try {
    if (fileExt === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const pdf = await loadingTask.promise;
      let textChunks: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items
            .map((item: any) => item.str || '')
            .filter(Boolean)
            .join(' ');
          if (pageStrings.trim()) {
            textChunks.push(pageStrings);
          }
        } catch (pageErr) {
          console.warn(`Aviso ao ler página ${pageNum} de ${fileName}:`, pageErr);
        }
      }

      fullText = textChunks.join('\n\n');
    } else if (fileExt === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      fullText = result.value || '';
    } else if (fileExt === 'txt' || fileExt === 'md' || fileExt === 'csv') {
      fullText = await file.text();
    } else {
      // Tentar leitura como texto genérico
      try {
        fullText = await file.text();
      } catch {
        fullText = '';
      }
    }
  } catch (extractErr) {
    console.warn(`Não foi possível extrair texto completo de ${fileName}:`, extractErr);
    fullText = '';
  }

  const analiseDaEquipeText = filterAnaliseDaEquipe(fullText);
  const totalTokens = estimateTokens(fullText);
  const analiseDaEquipeTokens = estimateTokens(analiseDaEquipeText);
  const estimatedTokens = analiseDaEquipeTokens || totalTokens;

  return {
    fileName,
    fullText,
    analiseDaEquipeText,
    estimatedTokens,
    analiseDaEquipeTokens,
    totalTokens,
  };
};
