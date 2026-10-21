
export const generateTceLink = (value: string | undefined | null, year?: string | number): string | null => {
  if (!value) return null;
  if (!value.includes('/') && year) {
    const number = value.replace(/\D/g, '');
    const yrStr = String(year).replace(/\D/g, '');
    const fullYear = yrStr.length === 2 ? `20${yrStr}` : yrStr;
    if (number && fullYear) {
      return `https://servicos.tce.pr.gov.br/TCEPR/Tribunal/TramiteWeb/Protocolo?nrProtocolo=${fullYear}${number}&priorizarExibicaoProcedimento=N`;
    }
  }
  if (!value.includes('/')) return null;
  const parts = value.split('/');
  const number = parts[0].replace(/\D/g, '');
  const yr = parts[1].replace(/\D/g, '');
  if (!number || !yr) return null;
  const fullYear = yr.length === 2 ? `20${yr}` : yr;
  const protocol = `${fullYear}${number}`;
  return `https://servicos.tce.pr.gov.br/TCEPR/Tribunal/TramiteWeb/Protocolo?nrProtocolo=${protocol}&priorizarExibicaoProcedimento=N`;
};

export const generateFiscalizacaoLink = (value: string | undefined | null): string | null => {
  if (!value || !value.includes('/')) return null;
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const idDemanda = parts[0].replace(/\D/g, '');
  const idAcaoFiscalizacao = parts[1].replace(/\D/g, '');
  if (!idDemanda || !idAcaoFiscalizacao) return null;
  return `https://integra.tce.pr.gov.br/Execucao/AcoesFiscalizacaoFase?idAcaoFiscalizacao=${idAcaoFiscalizacao}&idDemanda=${idDemanda}`;
};
