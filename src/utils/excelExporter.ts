import * as XLSX from 'xlsx';
import { Category, CompanySettings, ExpenseItem } from '../types';
import { formatCNPJ, formatCurrency, formatDate } from './formatters';

export function exportCompetenceExcel(
  settings: CompanySettings,
  competenceLabel: string,
  items: ExpenseItem[],
  categories: Category[]
): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Metadata Header rows
  const headerRows = [
    ['PRESTAÇÃO DE CONTAS MENSAL - RELATÓRIO CONTÁBIL'],
    ['Empresa:', settings.name, 'CNPJ:', formatCNPJ(settings.cnpj) || '-'],
    ['Competência:', competenceLabel, 'Emissão:', formatDate(new Date().toISOString())],
    ['Responsável:', settings.responsible, 'Cidade/UF:', `${settings.city}/${settings.state}`],
    ['Contador:', settings.accountantName || '-', 'E-mail Contador:', settings.accountantEmail || '-'],
    [], // Blank line
  ];

  // Table Data Headers
  const tableHeaders = [
    '#',
    'Categoria',
    'Descrição',
    'Fornecedor',
    'Tipo',
    'Vencimento',
    'Status',
    'Valor (R$)',
    'Centro de Custo',
    'Observação',
  ];

  // Data rows
  const dataRows = items.map((item, idx) => [
    idx + 1,
    categoryMap.get(item.categoryId) || 'Geral',
    item.description,
    item.supplier || '-',
    item.type === 'FIXA' ? 'Fixa' : 'Variável',
    formatDate(item.dueDate),
    item.status === 'PAGO' ? 'Pago' : 'Pendente',
    item.amount,
    item.costCenter || '-',
    item.observation || '-',
  ]);

  // Totals calculations
  const totalFixas = items.filter((i) => i.type === 'FIXA').reduce((acc, i) => acc + i.amount, 0);
  const totalVariaveis = items.filter((i) => i.type === 'VARIAVEL').reduce((acc, i) => acc + i.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;

  const totalRows = [
    [],
    ['', '', '', '', '', '', 'TOTAL FIXAS:', totalFixas],
    ['', '', '', '', '', '', 'TOTAL VARIÁVEIS:', totalVariaveis],
    ['', '', '', '', '', '', 'TOTAL GERAL:', totalGeral],
  ];

  const fullContent = [...headerRows, tableHeaders, ...dataRows, ...totalRows];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(fullContent);

  // Column widths
  worksheet['!cols'] = [
    { wch: 5 }, // #
    { wch: 22 }, // Categoria
    { wch: 38 }, // Descrição
    { wch: 28 }, // Fornecedor
    { wch: 12 }, // Tipo
    { wch: 14 }, // Vencimento
    { wch: 12 }, // Status
    { wch: 16 }, // Valor
    { wch: 20 }, // Centro de Custo
    { wch: 35 }, // Observação
  ];

  // Create workbook and append
  const workbook = XLSX.utils.book_new();
  const sheetName = competenceLabel.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'PrestacaoContas');

  // Trigger download
  const cleanFileName = competenceLabel.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `Prestacao_de_Contas_${cleanFileName}.xlsx`);
}
