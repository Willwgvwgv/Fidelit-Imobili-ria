import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Category, CompanySettings, ExpenseItem } from '../types';
import { formatCNPJ, formatCurrency, formatDate } from './formatters';

export function exportCompetencePDF(
  settings: CompanySettings,
  competenceLabel: string,
  items: ExpenseItem[],
  categories: Category[]
): void {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Document Colors
  const primaryColor = [30, 41, 59]; // Slate 800
  const secondaryColor = [71, 85, 105]; // Slate 600
  const accentColor = [37, 99, 235]; // Blue 600
  const lightBg = [248, 250, 252]; // Slate 50

  let currentY = 15;

  // Company Logo (if available)
  if (settings.logoBase64) {
    try {
      doc.addImage(settings.logoBase64, 'PNG', 14, currentY, 28, 14);
    } catch {
      // Ignore if image format fails
    }
  }

  // Header Title
  const startX = settings.logoBase64 ? 46 : 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PRESTAÇÃO DE CONTAS MENSAL', startX, currentY + 6);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Empresa: ${settings.name}`, startX, currentY + 12);

  currentY += 18;

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, currentY, 196, currentY);
  currentY += 6;

  // Metadata Box (Two columns)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(14, currentY, 182, 22, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  // Col 1
  doc.text('COMPETÊNCIA:', 18, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(competenceLabel, 48, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', 18, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCNPJ(settings.cnpj) || '-', 48, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('RESPONSÁVEL:', 18, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.responsible || '-', 48, currentY + 18);

  // Col 2
  doc.setFont('helvetica', 'bold');
  doc.text('EMISSÃO:', 110, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(new Date().toISOString()), 135, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('CIDADE/UF:', 110, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.city}/${settings.state}`, 135, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATÁRIO:', 110, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.accountantName || 'Contabilidade', 135, currentY + 18);

  currentY += 28;

  // Prepare table data
  const tableRows = items.map((item, idx) => {
    return [
      String(idx + 1),
      categoryMap.get(item.categoryId) || 'Geral',
      item.description,
      item.supplier || '-',
      item.type === 'FIXA' ? 'Fixa' : 'Variável',
      formatDate(item.dueDate),
      item.status === 'PAGO' ? 'Pago' : 'Pendente',
      formatCurrency(item.amount),
    ];
  });

  // Render Table
  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Categoria', 'Descrição', 'Fornecedor', 'Tipo', 'Vencimento', 'Status', 'Valor (R$)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 46 },
      3: { cellWidth: 32 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Totals calculations
  const totalFixas = items.filter((i) => i.type === 'FIXA').reduce((acc, i) => acc + i.amount, 0);
  const totalVariaveis = items.filter((i) => i.type === 'VARIAVEL').reduce((acc, i) => acc + i.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Check page overflow for summary box
  const pageHeight = doc.internal.pageSize.getHeight();
  let summaryY = finalY;
  if (summaryY + 35 > pageHeight) {
    doc.addPage();
    summaryY = 15;
  }

  // Summary box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(110, summaryY, 86, 32, 2, 2, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Total Despesas Fixas:', 114, summaryY + 8);
  doc.text(formatCurrency(totalFixas), 190, summaryY + 8, { align: 'right' });

  doc.text('Total Despesas Variáveis:', 114, summaryY + 15);
  doc.text(formatCurrency(totalVariaveis), 190, summaryY + 15, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(114, summaryY + 18, 190, summaryY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('TOTAL GERAL DA COMPETÊNCIA:', 114, summaryY + 26);
  doc.text(formatCurrency(totalGeral), 190, summaryY + 26, { align: 'right' });

  // Signature Block at bottom
  let sigY = summaryY + 45;
  if (sigY + 20 > pageHeight) {
    doc.addPage();
    sigY = 30;
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(20, sigY, 90, sigY);
  doc.line(110, sigY, 180, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  doc.text(settings.responsible || 'Responsável Financeiro', 55, sigY + 5, { align: 'center' });
  doc.text('Assinatura / Visto', 55, sigY + 9, { align: 'center' });

  doc.text(settings.accountantName || 'Contabilidade Responsável', 145, sigY + 5, { align: 'center' });
  doc.text('Recebido em ___/___/_____', 145, sigY + 9, { align: 'center' });

  // Save filename
  const cleanLabel = competenceLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Prestacao_de_Contas_${cleanLabel}.pdf`);
}
