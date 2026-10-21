
export const debounce = <F extends (...args: any[]) => any>(func: F, wait: number): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const normalizeYear = (year: any): string => {
  if (year === null || year === undefined) return '';
  const s = String(year).trim();
  if (s.length === 2 && !isNaN(Number(s))) return `20${s}`;
  if (s.length === 3 && s.startsWith('0') && !isNaN(Number(s))) return `2${s}`;
  return s;
};

export const normalizeForSearch = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * A demand "has a report" when it has an AI summary, extracted report text or any attached report file.
 */
export const demandHasReport = (d: {
  resumoRelatorio?: string;
  relatorioTextoCompleto?: string;
  relatorioNomeArquivo?: string;
  relatorioArquivos?: unknown[];
}): boolean => Boolean(
  d.resumoRelatorio?.trim() ||
  d.relatorioTextoCompleto?.trim() ||
  d.relatorioNomeArquivo ||
  (d.relatorioArquivos && d.relatorioArquivos.length > 0)
);

/**
 * Converts a createdAt value (Firestore Timestamp, {seconds}, Date, ISO string or epoch) to epoch millis.
 * Returns 0 when missing or invalid.
 */
export const getCreatedAtMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
};

