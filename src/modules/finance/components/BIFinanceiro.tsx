import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { User, FinancialTransaction, FinancialCategory } from '../../../../types';
import { supabaseService } from '../../../../services/supabaseService';
import { getLocalTodayStr } from '../utils/dates';

import { BIFilters, DEFAULT_FILTERS } from '../bi/types';
import {
  buildFilterContext,
  applyBIFilters,
  summarizeByType,
  saldoRealizado,
  saldoProjetado,
  buildFutureWindows,
  buildProjectedCashFlowTable,
  getOverdue,
  analyzeByCategory,
  buildMonthlyAnalysis,
  buildIndicadores,
  buildEvolutionSeries,
  isTransfer,
  isPaid,
  isPending,
  isOverdue,
} from '../bi/calculations';

import { FiltersBar } from '../bi/components/FiltersBar';
import { SummaryCards, SummaryDrillKind } from '../bi/components/SummaryCards';
import { DetalheModal } from '../bi/components/DetalheModal';
import { ReceberPagarSection } from '../bi/sections/ReceberPagarSection';
import { FuturasSection } from '../bi/sections/FuturasSection';
import { AtrasadosSection } from '../bi/sections/AtrasadosSection';
import { CategoriaSection } from '../bi/sections/CategoriaSection';
import { FluxoCaixaSection } from '../bi/sections/FluxoCaixaSection';
import { LancamentosSection } from '../bi/sections/LancamentosSection';
import { MensalSection } from '../bi/sections/MensalSection';
import { IndicadoresSection } from '../bi/sections/IndicadoresSection';

interface BIFinanceiroProps {
  currentUser: User;
}

interface Drill {
  titulo: string;
  transactions: FinancialTransaction[];
}

/**
 * Dashboard Financeiro Gerencial (BI Financeiro).
 *
 * Camada de VISUALIZAÇÃO E ANÁLISE, somente leitura. Não cria, edita nem apaga
 * nenhum lançamento, categoria ou conta — usa exclusivamente os métodos de
 * leitura já existentes em supabaseService (os mesmos usados pelas telas
 * Extrato / Fluxo de Caixa / Contas Bancárias), então não há risco de quebrar
 * nenhuma regra financeira já implementada no sistema.
 */
const BIFinanceiro: React.FC<BIFinanceiroProps> = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BIFilters>(DEFAULT_FILTERS);
  const [drill, setDrill] = useState<Drill | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [tx, cats] = await Promise.all([
        supabaseService.getFinancialTransactions(),
        supabaseService.getFinancialCategories(),
      ]);
      if (!active) return;
      setTransactions(tx || []);
      setCategories(cats || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const today = getLocalTodayStr();
  const ctx = useMemo(() => buildFilterContext(categories, today), [categories, today]);
  const categoriesById = ctx.categoriesById;

  // Conjuntos derivados — todos calculados a partir do MESMO array bruto `transactions`,
  // aplicando sempre a mesma função applyBIFilters, para garantir consistência entre seções.
  const filtered = useMemo(() => applyBIFilters(transactions, filters, ctx), [transactions, filters, ctx]);
  const filteredWithTransfers = useMemo(
    () => applyBIFilters(transactions, filters, ctx, { includeTransfers: true }),
    [transactions, filters, ctx]
  );
  const filteredIgnorePeriod = useMemo(
    () => applyBIFilters(transactions, filters, ctx, { ignorePeriod: true }),
    [transactions, filters, ctx]
  );

  const receberResumo = useMemo(() => summarizeByType(filtered, 'INCOME', today), [filtered, today]);
  const pagarResumo = useMemo(() => summarizeByType(filtered, 'EXPENSE', today), [filtered, today]);
  const realizado = useMemo(() => saldoRealizado(filtered), [filtered]);
  const projetado = useMemo(() => saldoProjetado(filteredIgnorePeriod, today), [filteredIgnorePeriod, today]);

  const evolReceber = useMemo(() => buildEvolutionSeries(filtered, 'INCOME'), [filtered]);
  const evolPagar = useMemo(() => buildEvolutionSeries(filtered, 'EXPENSE'), [filtered]);

  const futureWindows = useMemo(() => buildFutureWindows(filteredIgnorePeriod, today), [filteredIgnorePeriod, today]);
  const cashFlowTable = useMemo(
    () => buildProjectedCashFlowTable(filteredIgnorePeriod, today, 0, 90),
    [filteredIgnorePeriod, today]
  );

  const atrasadosReceber = useMemo(() => getOverdue(filteredIgnorePeriod, 'INCOME', today), [filteredIgnorePeriod, today]);
  const atrasadosPagar = useMemo(() => getOverdue(filteredIgnorePeriod, 'EXPENSE', today), [filteredIgnorePeriod, today]);

  const catEntradas = useMemo(() => analyzeByCategory(filtered, categories, 'INCOME', today), [filtered, categories, today]);
  const catSaidas = useMemo(() => analyzeByCategory(filtered, categories, 'EXPENSE', today), [filtered, categories, today]);

  const nonTransferAll = useMemo(() => transactions.filter((t) => !isTransfer(t, categoriesById)), [transactions, categoriesById]);
  const mensal = useMemo(() => buildMonthlyAnalysis(nonTransferAll, 12), [nonTransferAll]);

  const indicadores = useMemo(() => buildIndicadores(filtered, filteredIgnorePeriod, today), [filtered, filteredIgnorePeriod, today]);

  // ---------------------------------------------------------------------
  // Drill-down handlers — cada um reaplica exatamente o mesmo predicado usado
  // no cálculo agregado correspondente, para que o total do modal bata com o card.
  // ---------------------------------------------------------------------

  const openDrillSummary = (kind: SummaryDrillKind) => {
    const map: Record<string, { titulo: string; rows: FinancialTransaction[] }> = {
      'receber-previsto': { titulo: 'Contas a Receber — Previsto', rows: filtered.filter((t) => t.type === 'INCOME') },
      'receber-recebido': { titulo: 'Contas a Receber — Recebido', rows: filtered.filter((t) => t.type === 'INCOME' && isPaid(t)) },
      'receber-aberto': {
        titulo: 'Contas a Receber — Em aberto',
        rows: filtered.filter((t) => t.type === 'INCOME' && isPending(t) && !isOverdue(t, today)),
      },
      'receber-atrasado': {
        titulo: 'Contas a Receber — Atrasado',
        rows: filtered.filter((t) => t.type === 'INCOME' && isOverdue(t, today)),
      },
      'pagar-previsto': { titulo: 'Contas a Pagar — Previsto', rows: filtered.filter((t) => t.type === 'EXPENSE') },
      'pagar-pago': { titulo: 'Contas a Pagar — Pago', rows: filtered.filter((t) => t.type === 'EXPENSE' && isPaid(t)) },
      'pagar-aberto': {
        titulo: 'Contas a Pagar — Em aberto',
        rows: filtered.filter((t) => t.type === 'EXPENSE' && isPending(t) && !isOverdue(t, today)),
      },
      'pagar-atrasado': {
        titulo: 'Contas a Pagar — Atrasado',
        rows: filtered.filter((t) => t.type === 'EXPENSE' && isOverdue(t, today)),
      },
      'realizado-entradas': { titulo: 'Saldo Realizado — Entradas', rows: filtered.filter((t) => t.type === 'INCOME' && isPaid(t)) },
      'realizado-saidas': { titulo: 'Saldo Realizado — Saídas', rows: filtered.filter((t) => t.type === 'EXPENSE' && isPaid(t)) },
      'projetado-entradas': {
        titulo: 'Saldo Projetado — Entradas futuras',
        rows: filteredIgnorePeriod.filter((t) => t.type === 'INCOME' && isPending(t) && t.due_date >= today),
      },
      'projetado-saidas': {
        titulo: 'Saldo Projetado — Saídas futuras',
        rows: filteredIgnorePeriod.filter((t) => t.type === 'EXPENSE' && isPending(t) && t.due_date >= today),
      },
    };
    const found = map[kind];
    if (found) setDrill({ titulo: found.titulo, transactions: found.rows });
  };

  const openDrillReceberPagar = (tipo: 'INCOME' | 'EXPENSE', kind: 'recebido_pago' | 'aberto' | 'atrasado') => {
    const label = tipo === 'INCOME' ? 'Contas a Receber' : 'Contas a Pagar';
    let rows: FinancialTransaction[] = [];
    let sub = '';
    if (kind === 'recebido_pago') {
      rows = filtered.filter((t) => t.type === tipo && isPaid(t));
      sub = tipo === 'INCOME' ? 'Recebido' : 'Pago';
    } else if (kind === 'aberto') {
      rows = filtered.filter((t) => t.type === tipo && isPending(t) && !isOverdue(t, today));
      sub = 'Em aberto';
    } else {
      rows = filtered.filter((t) => t.type === tipo && isOverdue(t, today));
      sub = 'Atrasado';
    }
    setDrill({ titulo: `${label} — ${sub}`, transactions: rows });
  };

  const openDrillWindow = (dias: number, tipo: 'INCOME' | 'EXPENSE') => {
    const limit = new Date(today + 'T12:00:00');
    limit.setDate(limit.getDate() + dias);
    const limitStr = limit.toISOString().split('T')[0];
    const rows = filteredIgnorePeriod.filter(
      (t) => t.type === tipo && isPending(t) && t.due_date >= today && t.due_date <= limitStr
    );
    setDrill({
      titulo: `${tipo === 'INCOME' ? 'A receber' : 'A pagar'} — próximos ${dias} dias`,
      transactions: rows,
    });
  };

  const openDrillDay = (data: string) => {
    const rows = filteredIgnorePeriod.filter((t) => t.due_date === data && isPending(t));
    setDrill({ titulo: `Lançamentos previstos para ${data.split('-').reverse().join('/')}`, transactions: rows });
  };

  const openDrillCategoria = (c: { categoriaId: string; categoriaNome: string; tipo: string }) => {
    const rows = filtered.filter((t) => (t.category_id || '__sem_categoria__') === c.categoriaId && t.type === c.tipo);
    setDrill({ titulo: `Categoria — ${c.categoriaNome}`, transactions: rows });
  };

  const openDrillSingle = (tx: FinancialTransaction) => {
    setDrill({ titulo: 'Detalhes do lançamento', transactions: [tx] });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm">Carregando dados financeiros...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-full -m-4 md:-m-6 p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">BI Financeiro</h1>
            <p className="text-xs text-slate-400">
              Painel analítico da situação financeira da imobiliária — dados reais do Comissione, atualizados agora.
            </p>
          </div>
        </div>

        <FiltersBar filters={filters} onChange={setFilters} categories={categories} transactions={transactions} />

        <SummaryCards receber={receberResumo} pagar={pagarResumo} realizado={realizado} projetado={projetado} onDrill={openDrillSummary} />

        <ReceberPagarSection
          tipo="INCOME"
          resumo={receberResumo}
          evolucao={evolReceber}
          onDrill={(kind) => openDrillReceberPagar('INCOME', kind)}
        />

        <ReceberPagarSection
          tipo="EXPENSE"
          resumo={pagarResumo}
          evolucao={evolPagar}
          onDrill={(kind) => openDrillReceberPagar('EXPENSE', kind)}
        />

        <FuturasSection windows={futureWindows} cashFlowTable={cashFlowTable} onDrillWindow={openDrillWindow} onDrillDay={openDrillDay} />

        <AtrasadosSection
          atrasadosReceber={atrasadosReceber}
          atrasadosPagar={atrasadosPagar}
          categoriesById={categoriesById}
          onRowClick={openDrillSingle}
        />

        <CategoriaSection entradas={catEntradas} saidas={catSaidas} onSelectCategoria={openDrillCategoria} />

        <FluxoCaixaSection realizado={realizado} projetado={projetado} mensal={mensal} />

        <LancamentosSection transactions={filteredWithTransfers} categoriesById={categoriesById} onRowClick={openDrillSingle} />

        <MensalSection meses={mensal} />

        <IndicadoresSection ind={indicadores} />
      </div>

      {drill && (
        <DetalheModal titulo={drill.titulo} transactions={drill.transactions} categoriesById={categoriesById} onClose={() => setDrill(null)} />
      )}
    </div>
  );
};

export default BIFinanceiro;
