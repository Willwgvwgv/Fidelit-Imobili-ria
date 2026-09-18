/**
 * BI Financeiro — tipos exclusivos desta camada de análise.
 * Não reutiliza nem modifica os tipos das telas financeiras existentes;
 * apenas consome FinancialTransaction / FinancialCategory / FinancialAccount já definidos em ../../../../types.
 */

export type PeriodoPreset =
  | 'hoje'
  | 'semana'
  | 'mes'
  | 'mes_anterior'
  | 'proximo_mes'
  | 'ano'
  | 'personalizado'
  | 'todos';

export type TipoFiltro = 'todos' | 'INCOME' | 'EXPENSE';

/**
 * Status "de negócio" exibido nos filtros do BI.
 * Mapeados a partir dos dois únicos status reais existentes no banco (PENDING / PAID) + due_date.
 * Não existe status CANCELLED nos dados reais hoje — ver limitações no relatório final.
 */
export type StatusFiltro = 'todos' | 'pago_recebido' | 'em_aberto' | 'atrasado' | 'pendente';

export interface BIFilters {
  periodo: PeriodoPreset;
  dataInicioCustom: string; // YYYY-MM-DD, usado quando periodo === 'personalizado'
  dataFimCustom: string;
  tipo: TipoFiltro;
  status: StatusFiltro;
  categoriaId: string | 'todas';
  pessoa: string | 'todas';
}

export const DEFAULT_FILTERS: BIFilters = {
  periodo: 'mes',
  dataInicioCustom: '',
  dataFimCustom: '',
  tipo: 'todos',
  status: 'todos',
  categoriaId: 'todas',
  pessoa: 'todas',
};

export interface DateRange {
  start: string | null; // null = sem limite inferior
  end: string | null; // null = sem limite superior
}

/** Janela usada na seção "Contas Futuras" e nos indicadores gerenciais. */
export interface FutureWindowResult {
  dias: 7 | 15 | 30 | 60 | 90;
  entradas: number;
  saidas: number;
  qtdEntradas: number;
  qtdSaidas: number;
}

export interface CategoriaAnalise {
  categoriaId: string;
  categoriaNome: string;
  tipo: 'INCOME' | 'EXPENSE';
  valorTotal: number;
  percentualDoTotal: number;
  quantidadeLancamentos: number;
  pagoRecebido: number;
  emAberto: number;
  atrasado: number;
}

export interface FluxoDia {
  data: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoDoDia: number;
  saldoAcumulado: number;
}

export interface MesAnalise {
  chave: string; // YYYY-MM
  label: string; // "Set/2026"
  entradasPrevistas: number;
  saidasPrevistas: number;
  resultadoPrevisto: number;
  recebido: number;
  pago: number;
  resultadoRealizado: number;
}

/** Motivo pelo qual um conjunto de lançamentos está sendo exibido num drill-down. */
export interface DrillDownContext {
  titulo: string;
  transacaoIds: string[];
}
