
/**
 * Parses numbers typed in either pt-BR ("1.234,56") or plain ("1234.56") format.
 * Returns NaN for empty or invalid values.
 */
export const parseBRNumber = (value: string | number | undefined | null): number => {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return NaN;
  let s = String(value).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) {
    // pt-BR: dots are thousand separators, comma is the decimal separator
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // "1.234.567" -> thousand separators only
    s = s.replace(/\./g, '');
  }
  return Number(s);
};

export const formatCurrency = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '-';
  const number = parseBRNumber(value);
  if (isNaN(number)) return String(value);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

export const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString || '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};
