import * as XLSX from 'xlsx';
import { Category, ExpenseItem, ExpenseType } from '../types';

export interface ImportResult {
  success: boolean;
  importedCount: number;
  items: ExpenseItem[];
  errors: string[];
}

export async function importExpensesFromExcel(
  file: File,
  competenceId: string,
  existingCategories: Category[]
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
        });

        if (!jsonRows || jsonRows.length === 0) {
          return resolve({
            success: false,
            importedCount: 0,
            items: [],
            errors: ['O arquivo Excel está vazio ou não possui linhas válidas.'],
          });
        }

        const categoryMap = new Map(
          existingCategories.map((c) => [c.name.toLowerCase().trim(), c.id])
        );
        const defaultCategoryId = existingCategories[0]?.id || 'cat-1';

        const importedItems: ExpenseItem[] = [];
        const errors: string[] = [];

        jsonRows.forEach((row, index) => {
          // Flexible key lookup
          const keys = Object.keys(row);
          const findVal = (possibleNames: string[]): string => {
            const foundKey = keys.find((k) =>
              possibleNames.some((p) => k.toLowerCase().trim().includes(p))
            );
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const desc = findVal(['descrição', 'descricao', 'nome', 'item', 'historico']);
          const valStr = findVal(['valor', 'valor (r$)', 'quantia', 'preco']);
          const catName = findVal(['categoria', 'grupo']);
          const supplier = findVal(['fornecedor', 'beneficiario', 'empresa']);
          const typeStr = findVal(['tipo', 'natureza']);
          const dueDateStr = findVal(['vencimento', 'data', 'data de vencimento']);
          const obs = findVal(['observação', 'observacao', 'obs', 'notas']);
          const statusStr = findVal(['status', 'situacao', 'pago']);

          if (!desc) {
            errors.push(`Linha ${index + 2}: Descrição ausente, ignorada.`);
            return;
          }

          // Parse Amount
          let numericAmount = 0;
          if (valStr) {
            const cleaned = valStr
              .replace('R$', '')
              .replace(/\./g, '')
              .replace(',', '.')
              .trim();
            numericAmount = parseFloat(cleaned) || 0;
          }

          if (numericAmount <= 0) {
            errors.push(`Linha ${index + 2} (${desc}): Valor inválido ou zerado.`);
            return;
          }

          // Category match
          let matchedCatId = defaultCategoryId;
          if (catName) {
            const lowerCat = catName.toLowerCase().trim();
            if (categoryMap.has(lowerCat)) {
              matchedCatId = categoryMap.get(lowerCat)!;
            }
          }

          // Type
          const type: ExpenseType =
            typeStr.toLowerCase().includes('fixa') ? 'FIXA' : 'VARIAVEL';

          // Due date fallback
          let dueDate = new Date().toISOString().split('T')[0];
          if (dueDateStr) {
            // Check if formatted like DD/MM/YYYY or YYYY-MM-DD
            if (dueDateStr.includes('/')) {
              const parts = dueDateStr.split('/');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                dueDate = `${year}-${month}-${day}`;
              }
            } else if (dueDateStr.includes('-')) {
              dueDate = dueDateStr;
            }
          }

          const newItem: ExpenseItem = {
            id: `item-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            competenceId,
            type,
            description: desc,
            categoryId: matchedCatId,
            supplier: supplier || 'Importado via Excel',
            amount: numericAmount,
            dueDate,
            status: statusStr.toLowerCase().includes('pago') ? 'PAGO' : 'PENDENTE',
            observation: obs ? `[Importado Excel] ${obs}` : '[Importado via Excel]',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          importedItems.push(newItem);
        });

        resolve({
          success: importedItems.length > 0,
          importedCount: importedItems.length,
          items: importedItems,
          errors,
        });
      } catch (err) {
        resolve({
          success: false,
          importedCount: 0,
          items: [],
          errors: [`Erro ao processar planilha: ${(err as Error).message}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        importedCount: 0,
        items: [],
        errors: ['Não foi possível ler o arquivo enviado.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}
