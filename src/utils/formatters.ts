const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || 'Mês Inválido';
}

export function getCompetenceLabel(year: number, month: number): string {
  return `${getMonthName(month)}/${year}`;
}

export function getCompetenceKey(year: number, month: number): string {
  const m = String(month).padStart(2, '0');
  return `${year}-${m}`;
}

export function parseCompetenceKey(key: string): { year: number; month: number } {
  const [yearStr, monthStr] = key.split('-');
  return {
    year: parseInt(yearStr, 10) || new Date().getFullYear(),
    month: parseInt(monthStr, 10) || new Date().getMonth() + 1,
  };
}

export function calculateDueDate(year: number, month: number, dueDay: number): string {
  const m = String(month).padStart(2, '0');
  // Handle edge cases like February 30th -> clamp to max days in month
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const validDay = Math.min(Math.max(1, dueDay), lastDayOfMonth);
  const d = String(validDay).padStart(2, '0');
  return `${year}-${m}-${d}`;
}
