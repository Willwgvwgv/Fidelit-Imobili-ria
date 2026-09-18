/**
 * BI Financeiro — motor de cálculo.
 *
 * Este arquivo é a ÚNICA fonte de verdade para todas as somas/indicadores do BI.
 * Todas as seções da interface devem chamar estas funções em vez de somar `amount`
 * diretamente, para garantir que a mesma regra de "o que conta como dinheiro real"
 * seja aplicada em todo o dashboard e que nenhum lançamento seja contado duas vezes.
 *
 * Fonte dos dados: tabela `financial_transactions` (via supabaseService.getFinancialTransactions()),
 * que é exatamente a mesma tabela usada pelas telas Extrato / Fluxo de Caixa / Contas Bancárias
 * já existentes no Comissione. Nenhuma outra tabela é usada para os totais do BI.
 *
 * Regra de exclusão de transferências internas entre contas (para não inflar
 * entradas/saídas com dinheiro que só está migrando de uma conta da própria
 * imobiliária para outra): um lançamento é tratado como transferência interna
 * quando `is_transfer === true` OU quando sua categoria tem o nome exato
 * "Transferência entre Contas" (o campo is_transfer está presente em apenas 1
 * das 645 linhas hoje, então o nome da categoria é o sinal confiável).
 * Transferências continuam aparecendo na Tabela de Lançamentos (seção 9),
 * mas são excluídas de todas as somas de entradas/saídas/saldo.
 */

import { FinancialTransaction, FinancialCategory } from '../../../../types';
import { BIFilters, DateRange, FutureWindowResult, CategoriaAnalise, FluxoDia, MesAnalise } from './types';
import { getLocalTodayStr } from '../utils/dates';

export const TRANSFER_CATEGORY_NAME = 'Transferência entre Contas';

// ---------------------------------------------------------------------------
// Status / classificação de um lançamento
// ---------------------------------------------------------------------------

export const isPaid = (tx: FinancialTransaction): boolean => tx.status === 'PAID';
export const isPending = (tx: FinancialTransaction): boolean => tx.status === 'PENDING';

/** Atrasado = PENDING com vencimento estritamente anterior a hoje (regra já usada em FinancialKpiHeaderCards.tsx). */
export const isOverdue = (tx: FinancialTransaction, today: string): boolean =>
  isPending(tx) && !!tx.due_date && tx.due_date < today;

export const isTransfer = (tx: FinancialTransaction, categoriesById: Map<string, FinancialCategory>): boolean => {
  if (tx.is_transfer === true) return true;
  const cat = tx.category_id ? categoriesById.get(tx.category_id) : undefined;
  return cat?.name === TRANSFER_CATEGORY_NAME;
};

/** Valor "realizado" de um lançamento pago: usa paid_amount quando informado, senão o valor original. */
export const realizedAmount = (tx: FinancialTransaction): number => {
  const v = tx.paid_amount != null ? Number(tx.paid_amount) : Number(tx.amount);
  return isNaN(v) ? 0 : v;
};

export const amountOf = (tx: FinancialTransaction): number => {
  const v = Number(tx.amount);
  return isNaN(v) ? 0 : v;
};

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const getTodayStr = getLocalTodayStr;

export function resolvePeriodoRange(filters: BIFilters, today: string): DateRange {
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(y, m - 1, d, 12, 0, 0);

  switch (filters.periodo) {
    case 'todos':
      return { start: null, end: null };
    case 'hoje':
      return { start: today, end: today };
    case 'semana': {
      const dow = base.getDay(); // 0 = domingo
      const start = new Date(base);
      start.setDate(base.getDate() - dow);
      const end = new Date(base);
      end.setDate(base.getDate() + (6 - dow));
      return { start: toISO(start), end: toISO(end) };
    }
    case 'mes': {
      const start = new Date(y, m - 1, 1, 12, 0, 0);
      const end = new Date(y, m, 0, 12, 0, 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'mes_anterior': {
      const start = new Date(y, m - 2, 1, 12, 0, 0);
      const end = new Date(y, m - 1, 0, 12, 0, 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'proximo_mes': {
      const start = new Date(y, m, 1, 12, 0, 0);
      const end = new Date(y, m + 1, 0, 12, 0, 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'ano': {
      const start = new Date(y, 0, 1, 12, 0, 0);
      const end = new Date(y, 11, 31, 12, 0, 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'personalizado':
      return {
        start: filters.dataInicioCustom || null,
        end: filters.dataFimCustom || null,
      };
    default:
      return { start: null, end: null };
  }
}

const inRange = (dateStr: string | null | undefined, range: DateRange): boolean => {
  if (!dateStr) return false;
  if (range.start && dateStr < range.start) return false;
  if (range.end && dateStr > range.end) return false;
  return true;
};

// ---------------------------------------------------------------------------
// Aplicação combinada dos filtros do BI (seção 2) sobre a lista bruta.
// O filtro de Período é aplicado sobre due_date (vencimento) — a mesma
// convenção já usada pelas telas existentes (ex.: getFinancialTransactions
// com startDate/endDate, FinancialKpiHeaderCards). Isso é documentado nas
// limitações entregues ao usuário.
// ---------------------------------------------------------------------------

export interface FilterContext {
  categoriesById: Map<string, FinancialCategory>;
  today: string;
}

export function buildFilterContext(categories: FinancialCategory[], today: string): FilterContext {
  return {
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    today,
  };
}

export function applyBIFilters(
  transactions: FinancialTransaction[],
  filters: BIFilters,
  ctx: FilterContext,
  opts: { includeTransfers?: boolean; ignorePeriod?: boolean } = {}
): FinancialTransaction[] {
  const range = resolvePeriodoRange(filters, ctx.today);
  const includeTransfers = opts.includeTransfers ?? false;
  const ignorePeriod = opts.ignorePeriod ?? false;

  return transactions.filter((tx) => {
    if (!includeTransfers && isTransfer(tx, ctx.categoriesById)) return false;

    if (!ignorePeriod && (range.start || range.end)) {
      if (!inRange(tx.due_date, range)) return false;
    }

    if (filters.tipo !== 'todos' && tx.type !== filters.tipo) return false;

    if (filters.status !== 'todos') {
      const overdue = isOverdue(tx, ctx.today);
      if (filters.status === 'pago_recebido' && !isPaid(tx)) return false;
      if (filters.status === 'em_aberto' && !(isPending(tx) && !overdue)) return false;
      if (filters.status === 'atrasado' && !overdue) return false;
      if (filters.status === 'pendente' && !isPending(tx)) return false;
    }

    if (filters.categoriaId !== 'todas' && tx.category_id !== filters.categoriaId) return false;

    if (filters.pessoa !== 'todas' && (tx.contact_name || '') !== filters.pessoa) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Resumo Financeiro (seção 1)
// ---------------------------------------------------------------------------

export interface ContasResumo {
  previsto: number;
  recebidoOuPago: number;
  emAberto: number;
  atrasado: number;
  qtdTotal: number;
  qtdAtrasados: number;
}

export function summarizeByType(
  filtered: FinancialTransaction[],
  type: 'INCOME' | 'EXPENSE',
  today: string
): ContasResumo {
  const rows = filtered.filter((t) => t.type === type);
  const previsto = rows.reduce((a, t) => a + amountOf(t), 0);
  const recebidoOuPago = rows.filter(isPaid).reduce((a, t) => a + realizedAmount(t), 0);
  const atrasadoRows = rows.filter((t) => isOverdue(t, today));
  const atrasado = atrasadoRows.reduce((a, t) => a + amountOf(t), 0);
  const emAbertoRows = rows.filter((t) => isPending(t) && !isOverdue(t, today));
  const emAberto = emAbertoRows.reduce((a, t) => a + amountOf(t), 0);
  return {
    previsto,
    recebidoOuPago,
    emAberto,
    atrasado,
    qtdTotal: rows.length,
    qtdAtrasados: atrasadoRows.length,
  };
}

export interface SaldoRealizado {
  entradas: number;
  saidas: number;
  saldo: number;
}

export function saldoRealizado(filtered: FinancialTransaction[]): SaldoRealizado {
  const entradas = filtered.filter((t) => t.type === 'INCOME' && isPaid(t)).reduce((a, t) => a + realizedAmount(t), 0);
  const saidas = filtered.filter((t) => t.type === 'EXPENSE' && isPaid(t)).reduce((a, t) => a + realizedAmount(t), 0);
  return { entradas, saidas, saldo: entradas - saidas };
}

export function saldoProjetado(filtered: FinancialTransaction[], today: string): SaldoRealizado {
  const entradas = filtered
    .filter((t) => t.type === 'INCOME' && isPending(t) && t.due_date >= today)
    .reduce((a, t) => a + amountOf(t), 0);
  const saidas = filtered
    .filter((t) => t.type === 'EXPENSE' && isPending(t) && t.due_date >= today)
    .reduce((a, t) => a + amountOf(t), 0);
  return { entradas, saidas, saldo: entradas - saidas };
}

// ---------------------------------------------------------------------------
// Contas Futuras (seção 5) — sempre a partir de HOJE, independente do filtro de período,
// pois é uma métrica inerentemente prospectiva ("o que vem por aí a partir de agora").
// ---------------------------------------------------------------------------

export function futureWindow(
  allNonTransfer: FinancialTransaction[],
  type: 'INCOME' | 'EXPENSE',
  dias: 7 | 15 | 30 | 60 | 90,
  today: string
): { valor: number; qtd: number } {
  const limit = new Date(today + 'T12:00:00');
  limit.setDate(limit.getDate() + dias);
  const limitStr = toISO(limit);
  const rows = allNonTransfer.filter(
    (t) => t.type === type && isPending(t) && t.due_date >= today && t.due_date <= limitStr
  );
  return { valor: rows.reduce((a, t) => a + amountOf(t), 0), qtd: rows.length };
}

export function buildFutureWindows(allNonTransfer: FinancialTransaction[], today: string): FutureWindowResult[] {
  const janelas: Array<7 | 15 | 30 | 60 | 90> = [7, 15, 30, 60, 90];
  return janelas.map((dias) => {
    const inc = futureWindow(allNonTransfer, 'INCOME', dias, today);
    const exp = futureWindow(allNonTransfer, 'EXPENSE', dias, today);
    return { dias, entradas: inc.valor, saidas: exp.valor, qtdEntradas: inc.qtd, qtdSaidas: exp.qtd };
  });
}

/** Tabela de fluxo de caixa futuro: Data | Entradas previstas | Saídas previstas | Saldo projetado (acumulado). */
export function buildProjectedCashFlowTable(
  allNonTransfer: FinancialTransaction[],
  today: string,
  saldoInicial: number,
  maxDias = 90
): FluxoDia[] {
  const limit = new Date(today + 'T12:00:00');
  limit.setDate(limit.getDate() + maxDias);
  const limitStr = toISO(limit);

  const future = allNonTransfer.filter((t) => isPending(t) && t.due_date >= today && t.due_date <= limitStr);

  const byDay = new Map<string, { entradas: number; saidas: number }>();
  for (const t of future) {
    const cur = byDay.get(t.due_date) || { entradas: 0, saidas: 0 };
    if (t.type === 'INCOME') cur.entradas += amountOf(t);
    else if (t.type === 'EXPENSE') cur.saidas += amountOf(t);
    byDay.set(t.due_date, cur);
  }

  const dates = Array.from(byDay.keys()).sort();
  let acumulado = saldoInicial;
  return dates.map((data) => {
    const { entradas, saidas } = byDay.get(data)!;
    const saldoDoDia = entradas - saidas;
    acumulado += saldoDoDia;
    return { data, entradasPrevistas: entradas, saidasPrevistas: saidas, saldoDoDia, saldoAcumulado: acumulado };
  });
}

// ---------------------------------------------------------------------------
// Atrasados (seção 6)
// ---------------------------------------------------------------------------

export function daysLate(dueDate: string, today: string): number {
  const d1 = new Date(today + 'T12:00:00');
  const d2 = new Date(dueDate + 'T12:00:00');
  return Math.max(0, Math.floor((d1.getTime() - d2.getTime()) / 86400000));
}

export function getOverdue(
  allNonTransfer: FinancialTransaction[],
  type: 'INCOME' | 'EXPENSE',
  today: string
): FinancialTransaction[] {
  return allNonTransfer.filter((t) => t.type === type && isOverdue(t, today));
}

// ---------------------------------------------------------------------------
// Análise por Categoria (seção 7)
// ---------------------------------------------------------------------------

export function analyzeByCategory(
  filtered: FinancialTransaction[],
  categories: FinancialCategory[],
  type: 'INCOME' | 'EXPENSE',
  today: string
): CategoriaAnalise[] {
  const rows = filtered.filter((t) => t.type === type);
  const totalTipo = rows.reduce((a, t) => a + amountOf(t), 0);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const byCat = new Map<string, FinancialTransaction[]>();
  for (const t of rows) {
    const key = t.category_id || '__sem_categoria__';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(t);
  }

  const result: CategoriaAnalise[] = [];
  for (const [catId, txs] of byCat.entries()) {
    const nome = catId === '__sem_categoria__' ? 'Sem categoria' : categoriesById.get(catId)?.name || 'Categoria removida';
    const valorTotal = txs.reduce((a, t) => a + amountOf(t), 0);
    const pagoRecebido = txs.filter(isPaid).reduce((a, t) => a + realizedAmount(t), 0);
    const atrasado = txs.filter((t) => isOverdue(t, today)).reduce((a, t) => a + amountOf(t), 0);
    const emAberto = txs.filter((t) => isPending(t) && !isOverdue(t, today)).reduce((a, t) => a + amountOf(t), 0);
    result.push({
      categoriaId: catId,
      categoriaNome: nome,
      tipo: type,
      valorTotal,
      percentualDoTotal: totalTipo > 0 ? (valorTotal / totalTipo) * 100 : 0,
      quantidadeLancamentos: txs.length,
      pagoRecebido,
      emAberto,
      atrasado,
    });
  }

  return result.sort((a, b) => b.valorTotal - a.valorTotal);
}

// ---------------------------------------------------------------------------
// Análise Mensal (seção 10)
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function buildMonthlyAnalysis(allNonTransfer: FinancialTransaction[], maxMeses = 12): MesAnalise[] {
  const byMonth = new Map<string, FinancialTransaction[]>();
  for (const t of allNonTransfer) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(t);
  }

  const keys = Array.from(byMonth.keys()).sort().slice(-maxMeses);

  return keys.map((chave) => {
    const txs = byMonth.get(chave)!;
    const [y, m] = chave.split('-').map(Number);
    const entradasPrevistas = txs.filter((t) => t.type === 'INCOME').reduce((a, t) => a + amountOf(t), 0);
    const saidasPrevistas = txs.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + amountOf(t), 0);
    const recebido = txs.filter((t) => t.type === 'INCOME' && isPaid(t)).reduce((a, t) => a + realizedAmount(t), 0);
    const pago = txs.filter((t) => t.type === 'EXPENSE' && isPaid(t)).reduce((a, t) => a + realizedAmount(t), 0);
    return {
      chave,
      label: `${MONTH_LABELS[m - 1]}/${y}`,
      entradasPrevistas,
      saidasPrevistas,
      resultadoPrevisto: entradasPrevistas - saidasPrevistas,
      recebido,
      pago,
      resultadoRealizado: recebido - pago,
    };
  });
}

// ---------------------------------------------------------------------------
// Indicadores Gerenciais (seção 11)
// ---------------------------------------------------------------------------

export interface IndicadoresGerenciais {
  totalRecebidoPeriodo: number;
  totalPagoPeriodo: number;
  totalEmAberto: number;
  totalAtrasado: number;
  totalFuturoReceber90d: number;
  totalFuturoPagar90d: number;
  percentualRecebido: number;
  percentualPago: number;
  qtdContasVencidas: number;
  qtdContasEmAberto: number;
}

export function buildIndicadores(
  filtered: FinancialTransaction[],
  allNonTransfer: FinancialTransaction[],
  today: string
): IndicadoresGerenciais {
  const receberResumo = summarizeByType(filtered, 'INCOME', today);
  const pagarResumo = summarizeByType(filtered, 'EXPENSE', today);
  const fut90Receber = futureWindow(allNonTransfer, 'INCOME', 90, today);
  const fut90Pagar = futureWindow(allNonTransfer, 'EXPENSE', 90, today);

  return {
    totalRecebidoPeriodo: receberResumo.recebidoOuPago,
    totalPagoPeriodo: pagarResumo.recebidoOuPago,
    totalEmAberto: receberResumo.emAberto + pagarResumo.emAberto,
    totalAtrasado: receberResumo.atrasado + pagarResumo.atrasado,
    totalFuturoReceber90d: fut90Receber.valor,
    totalFuturoPagar90d: fut90Pagar.valor,
    percentualRecebido: receberResumo.previsto > 0 ? (receberResumo.recebidoOuPago / receberResumo.previsto) * 100 : 0,
    percentualPago: pagarResumo.previsto > 0 ? (pagarResumo.recebidoOuPago / pagarResumo.previsto) * 100 : 0,
    qtdContasVencidas: receberResumo.qtdAtrasados + pagarResumo.qtdAtrasados,
    qtdContasEmAberto:
      filtered.filter((t) => isPending(t) && !isOverdue(t, today)).length,
  };
}

// ---------------------------------------------------------------------------
// Evolução temporal (usado nos gráficos das seções 3, 4 e 8)
// ---------------------------------------------------------------------------

export interface PontoEvolucao {
  data: string;
  valor: number;
  acumulado: number;
}

/** Evolução (por vencimento) do valor pago/recebido, em ordem cronológica, com acumulado. */
export function buildEvolutionSeries(
  filtered: FinancialTransaction[],
  type: 'INCOME' | 'EXPENSE'
): PontoEvolucao[] {
  const rows = filtered.filter((t) => t.type === type && isPaid(t));
  const byDay = new Map<string, number>();
  for (const t of rows) {
    byDay.set(t.due_date, (byDay.get(t.due_date) || 0) + realizedAmount(t));
  }
  const dates = Array.from(byDay.keys()).sort();
  let acumulado = 0;
  return dates.map((data) => {
    const valor = byDay.get(data)!;
    acumulado += valor;
    return { data, valor, acumulado };
  });
}
