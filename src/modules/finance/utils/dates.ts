/**
 * Centralized date parsing, formatting, and calculation utilities.
 */

/**
 * Precise date incrementer for recurrences avoiding date-boundary errors and month hopping
 */
export const addPeriodToDate = (dateStr: string, type: 'WEEKLY' | 'MONTHLY' | 'YEARLY', index: number): string => {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed month
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  if (type === 'WEEKLY') {
    const d = new Date(year, month, day, 12, 0, 0);
    d.setDate(d.getDate() + 7 * index);
    return d.toISOString().split('T')[0];
  } else if (type === 'MONTHLY') {
    const targetMonth = month + index;
    // Get max days in target month
    const testDate = new Date(year, targetMonth, 1, 12, 0, 0);
    const maxDays = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(day, maxDays);
    const resultDate = new Date(testDate.getFullYear(), testDate.getMonth(), targetDay, 12, 0, 0);
    return resultDate.toISOString().split('T')[0];
  } else if (type === 'YEARLY') {
    const targetYear = year + index;
    // Handle leap years (e.g. Feb 29 -> Feb 28)
    const maxDays = new Date(targetYear, month + 1, 0).getDate();
    const targetDay = Math.min(day, maxDays);
    const resultDate = new Date(targetYear, month, targetDay, 12, 0, 0);
    return resultDate.toISOString().split('T')[0];
  }
  return dateStr;
};

/**
 * Retorna a data atual no fuso local no formato YYYY-MM-DD
 */
export const getLocalTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a YYYY-MM-DD date string to Brazilian format DD/MM/YYYY
 */
export const formatDateBR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2].slice(0, 2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

/**
 * Safely parses a date string and returns its epoch timestamp in ms.
 */
export const parseDateSafe = (dStr: string | null | undefined): number => {
  if (!dStr) return 0;
  const date = new Date(
    dStr.includes("T") ? dStr : `${dStr}T00:00:00`
  );
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};
