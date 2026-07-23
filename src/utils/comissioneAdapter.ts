import { Category, CompanySettings, Competence, ExpenseItem } from '../types';

export interface ComissionePayload {
  version: string;
  sourceApp: string;
  timestamp: string;
  company: {
    name: string;
    cnpj: string;
    city: string;
    state: string;
  };
  competence: {
    key: string;
    label: string;
    year: number;
    month: number;
  };
  summary: {
    totalFixedAmount: number;
    totalVariableAmount: number;
    grandTotalAmount: number;
    totalEntriesCount: number;
  };
  expenses: Array<{
    externalId: string;
    type: 'FIXA' | 'VARIAVEL';
    description: string;
    categoryName: string;
    supplierName: string;
    amount: number;
    dueDate: string;
    status: 'PAGO' | 'PENDENTE';
    costCenter?: string;
    notes?: string;
  }>;
}

/**
  Formats accountability expense records into standard Comissione JSON schema
 */
export function formatComissioneIntegrationPayload(
  settings: CompanySettings,
  competence: Competence,
  items: ExpenseItem[],
  categories: Category[]
): ComissionePayload {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const totalFixed = items.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
  const totalVar = items.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);

  return {
    version: '1.0.0',
    sourceApp: 'PrestacaoDeContas-Imobiliaria',
    timestamp: new Date().toISOString(),
    company: {
      name: settings.name,
      cnpj: settings.cnpj,
      city: settings.city,
      state: settings.state,
    },
    competence: {
      key: competence.id,
      label: competence.label,
      year: competence.year,
      month: competence.month,
    },
    summary: {
      totalFixedAmount: totalFixed,
      totalVariableAmount: totalVar,
      grandTotalAmount: totalFixed + totalVar,
      totalEntriesCount: items.length,
    },
    expenses: items.map((item) => ({
      externalId: item.id,
      type: item.type,
      description: item.description,
      categoryName: catMap.get(item.categoryId) || 'Geral',
      supplierName: item.supplier || '',
      amount: item.amount,
      dueDate: item.dueDate,
      status: item.status,
      costCenter: item.costCenter,
      notes: item.observation,
    })),
  };
}
