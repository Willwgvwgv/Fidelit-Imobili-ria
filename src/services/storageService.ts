import {
  Category,
  CompanySettings,
  Competence,
  ExpenseItem,
  FixedExpense,
} from '../types';
import {
  calculateDueDate,
  getCompetenceKey,
  getCompetenceLabel,
} from '../utils/formatters';

const STORAGE_KEYS = {
  SETTINGS: 'prestacao_contas_settings',
  CATEGORIES: 'prestacao_contas_categories',
  FIXED_EXPENSES: 'prestacao_contas_fixed_expenses',
  COMPETENCIES: 'prestacao_contas_competencies',
  EXPENSE_ITEMS: 'prestacao_contas_expense_items',
  THEME: 'prestacao_contas_theme',
};

// Initial default categories
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Administrativo', color: '#3B82F6', description: 'Despesas administrativas e de escritório' },
  { id: 'cat-2', name: 'Marketing', color: '#EC4899', description: 'Anúncios, portais imobiliários e propaganda' },
  { id: 'cat-3', name: 'Tecnologia', color: '#8B5CF6', description: 'Sistemas, CRM imobiliário e internet' },
  { id: 'cat-4', name: 'Impostos', color: '#EF4444', description: 'Impostos federais, estaduais e municipais' },
  { id: 'cat-5', name: 'Pessoal', color: '#10B981', description: 'Folha, comissões, pró-labore e benefícios' },
  { id: 'cat-6', name: 'Financeiro', color: '#F59E0B', description: 'Tarifas bancárias, maquininhas e juros' },
  { id: 'cat-7', name: 'Jurídico', color: '#6366F1', description: 'Assessoria jurídica e taxas de cartório' },
  { id: 'cat-8', name: 'Operacional', color: '#14B8A6', description: 'Manutenção de imóveis, chaves e vistorias' },
];

// Initial default settings
const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Prime Imóveis & Negócios Imobiliários',
  cnpj: '12345678000190',
  responsible: 'Carlos Eduardo Mendes',
  city: 'Goiânia',
  state: 'GO',
  email: 'contato@primeimoveis.com.br',
  phone: '(62) 3999-8800',
  accountantName: 'Contabilidade Silva & Associados',
  accountantEmail: 'fiscal@contabilidadesilva.com.br',
};

// Initial default fixed expenses
const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [
  {
    id: 'fix-1',
    name: 'Aluguel da Sede Imobiliária',
    categoryId: 'cat-1',
    supplier: 'Administradora de Imóveis Centro',
    defaultAmount: 4500.0,
    dueDay: 10,
    costCenter: 'Matriz - Sede',
    observation: 'Contrato com reajuste anual pelo IGPM',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-2',
    name: 'Condomínio Comercial',
    categoryId: 'cat-1',
    supplier: 'Condomínio Edifício Business Tower',
    defaultAmount: 1250.0,
    dueDay: 15,
    costCenter: 'Matriz - Sede',
    observation: 'Taxa condominial mensal + fundo de reserva',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-3',
    name: 'CRM Imobiliário & Sistema de Vendas',
    categoryId: 'cat-3',
    supplier: 'Superlógica / Vista Software',
    defaultAmount: 890.0,
    dueDay: 5,
    costCenter: 'Tecnologia',
    observation: 'Licença para 12 corretores e equipe administrativa',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-4',
    name: 'Portal ZAP Imóveis & OLX Pro',
    categoryId: 'cat-2',
    supplier: 'Grupo OLX / ZAP VivaReal',
    defaultAmount: 3200.0,
    dueDay: 20,
    costCenter: 'Marketing Vendas',
    observation: 'Pacote 150 anúncios destaques + super destaques',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-5',
    name: 'Honorários Contábeis Mensais',
    categoryId: 'cat-1',
    supplier: 'Contabilidade Silva & Associados',
    defaultAmount: 1400.0,
    dueDay: 25,
    costCenter: 'Administrativo',
    observation: 'Prestação de contas e folha de pagamento',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-6',
    name: 'Internet Fibra Óptica 1GB Dedicada',
    categoryId: 'cat-3',
    supplier: 'Claro Empresas / Vivo Fibra',
    defaultAmount: 350.0,
    dueDay: 12,
    costCenter: 'Tecnologia',
    observation: 'IP Fixo e garantia de banda',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fix-7',
    name: 'Simples Nacional (DAS Mensal)',
    categoryId: 'cat-4',
    supplier: 'Receita Federal do Brasil',
    defaultAmount: 2850.0,
    dueDay: 20,
    costCenter: 'Fiscal',
    observation: 'Apuração mensal de faturamento de intermediação',
    active: true,
    monthlyRecurrence: true,
    createdAt: new Date().toISOString(),
  },
];

class StorageService {
  constructor() {
    this.initDefaultData();
  }

  private initDefaultData(): void {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }

    if (!localStorage.getItem(STORAGE_KEYS.FIXED_EXPENSES)) {
      localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(DEFAULT_FIXED_EXPENSES));
    }

    // Seed current competence (Julho/2026) if empty
    if (!localStorage.getItem(STORAGE_KEYS.COMPETENCIES)) {
      const now = new Date();
      const year = now.getFullYear() < 2026 ? 2026 : now.getFullYear();
      const month = 7; // Julho
      const compKey = getCompetenceKey(year, month);

      const initialCompetence: Competence = {
        id: compKey,
        year,
        month,
        label: getCompetenceLabel(year, month),
        createdAt: new Date().toISOString(),
        closed: false,
        notes: 'Prestação de contas inicial para acompanhamento contábil.',
      };

      localStorage.setItem(STORAGE_KEYS.COMPETENCIES, JSON.stringify([initialCompetence]));

      // Auto generate items for this initial competence
      const fixedExps = DEFAULT_FIXED_EXPENSES.filter((f) => f.active);
      const generatedItems: ExpenseItem[] = fixedExps.map((fix) => ({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        competenceId: compKey,
        type: 'FIXA',
        fixedExpenseId: fix.id,
        description: fix.name,
        categoryId: fix.categoryId,
        supplier: fix.supplier,
        amount: fix.defaultAmount,
        dueDate: calculateDueDate(year, month, fix.dueDay),
        status: 'PAGO',
        costCenter: fix.costCenter,
        observation: fix.observation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Add a couple of variable expenses
      generatedItems.push(
        {
          id: `item-var-1`,
          competenceId: compKey,
          type: 'VARIAVEL',
          description: 'Anúncios Patrocinados Meta Ads (Instagram/Facebook)',
          categoryId: 'cat-2',
          supplier: 'Meta Platforms Ireland',
          amount: 650.0,
          dueDate: calculateDueDate(year, month, 18),
          status: 'PAGO',
          costCenter: 'Marketing Digital',
          observation: 'Campanha de lançamento Residencial Jardins',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `item-var-2`,
          competenceId: compKey,
          type: 'VARIAVEL',
          description: 'Manutenção de Ar-Condicionado Recepção',
          categoryId: 'cat-8',
          supplier: 'ClimaFrio Refrigeração',
          amount: 320.0,
          dueDate: calculateDueDate(year, month, 22),
          status: 'PENDENTE',
          costCenter: 'Manutenção Sede',
          observation: 'Higienização preventiva das 3 unidades de split',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(generatedItems));
    }
  }

  // --- SETTINGS ---
  getSettings(): CompanySettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  }

  saveSettings(settings: CompanySettings): CompanySettings {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return settings;
  }

  // --- CATEGORIES ---
  getCategories(): Category[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
  }

  saveCategory(category: Partial<Category> & { name: string; color: string }): Category {
    const categories = this.getCategories();
    let updatedCategory: Category;

    if (category.id) {
      const index = categories.findIndex((c) => c.id === category.id);
      if (index !== -1) {
        categories[index] = { ...categories[index], ...category } as Category;
        updatedCategory = categories[index];
      } else {
        updatedCategory = { id: `cat-${Date.now()}`, ...category } as Category;
        categories.push(updatedCategory);
      }
    } else {
      updatedCategory = { id: `cat-${Date.now()}`, ...category } as Category;
      categories.push(updatedCategory);
    }

    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    return updatedCategory;
  }

  deleteCategory(id: string): boolean {
    const categories = this.getCategories();
    const filtered = categories.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(filtered));
    return true;
  }

  // --- FIXED EXPENSES ---
  getFixedExpenses(): FixedExpense[] {
    const data = localStorage.getItem(STORAGE_KEYS.FIXED_EXPENSES);
    return data ? JSON.parse(data) : [];
  }

  saveFixedExpense(exp: Partial<FixedExpense> & { name: string; categoryId: string; defaultAmount: number }): FixedExpense {
    const list = this.getFixedExpenses();
    let saved: FixedExpense;

    if (exp.id) {
      const idx = list.findIndex((item) => item.id === exp.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...exp } as FixedExpense;
        saved = list[idx];
      } else {
        saved = {
          id: `fix-${Date.now()}`,
          active: true,
          monthlyRecurrence: true,
          dueDay: 10,
          supplier: '',
          createdAt: new Date().toISOString(),
          ...exp,
        } as FixedExpense;
        list.push(saved);
      }
    } else {
      saved = {
        id: `fix-${Date.now()}`,
        active: true,
        monthlyRecurrence: true,
        dueDay: 10,
        supplier: '',
        createdAt: new Date().toISOString(),
        ...exp,
      } as FixedExpense;
      list.push(saved);
    }

    localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(list));
    return saved;
  }

  deleteFixedExpense(id: string): boolean {
    const list = this.getFixedExpenses().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(list));
    return true;
  }

  toggleFixedExpenseActive(id: string): FixedExpense | null {
    const list = this.getFixedExpenses();
    const target = list.find((item) => item.id === id);
    if (target) {
      target.active = !target.active;
      localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(list));
      return target;
    }
    return null;
  }

  // --- COMPETENCIES ---
  getCompetencies(): Competence[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMPETENCIES);
    const list: Competence[] = data ? JSON.parse(data) : [];
    return list.sort((a, b) => b.id.localeCompare(a.id));
  }

  createCompetence(year: number, month: number, notes?: string): Competence {
    const compKey = getCompetenceKey(year, month);
    const competencies = this.getCompetencies();

    let existing = competencies.find((c) => c.id === compKey);
    if (existing) {
      return existing;
    }

    const newComp: Competence = {
      id: compKey,
      year,
      month,
      label: getCompetenceLabel(year, month),
      createdAt: new Date().toISOString(),
      closed: false,
      notes,
    };

    competencies.push(newComp);
    localStorage.setItem(STORAGE_KEYS.COMPETENCIES, JSON.stringify(competencies));

    // CRITICAL: Copy all active fixed expenses as independent ExpenseItems for this competence
    const fixedExpenses = this.getFixedExpenses().filter((f) => f.active && f.monthlyRecurrence);
    const newItems: ExpenseItem[] = fixedExpenses.map((fix) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      competenceId: compKey,
      type: 'FIXA',
      fixedExpenseId: fix.id,
      description: fix.name,
      categoryId: fix.categoryId,
      supplier: fix.supplier,
      amount: fix.defaultAmount,
      dueDate: calculateDueDate(year, month, fix.dueDay),
      status: 'PENDENTE',
      costCenter: fix.costCenter,
      observation: fix.observation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const allItems = this.getExpenseItems();
    localStorage.setItem(
      STORAGE_KEYS.EXPENSE_ITEMS,
      JSON.stringify([...allItems, ...newItems])
    );

    return newComp;
  }

  deleteCompetence(id: string): boolean {
    const competencies = this.getCompetencies().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COMPETENCIES, JSON.stringify(competencies));

    // Delete related expense items
    const allItems = this.getExpenseItems().filter((item) => item.competenceId !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(allItems));
    return true;
  }

  // --- EXPENSE ITEMS ---
  getExpenseItems(competenceId?: string): ExpenseItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_ITEMS);
    const list: ExpenseItem[] = data ? JSON.parse(data) : [];
    if (competenceId) {
      return list.filter((item) => item.competenceId === competenceId);
    }
    return list;
  }

  saveExpenseItem(item: Partial<ExpenseItem> & { competenceId: string; description: string; amount: number; categoryId: string }): ExpenseItem {
    const all = this.getExpenseItems();
    let saved: ExpenseItem;

    if (item.id) {
      const idx = all.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        all[idx] = {
          ...all[idx],
          ...item,
          updatedAt: new Date().toISOString(),
        } as ExpenseItem;
        saved = all[idx];
      } else {
        saved = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'VARIAVEL',
          supplier: '',
          dueDate: new Date().toISOString().split('T')[0],
          status: 'PENDENTE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...item,
        } as ExpenseItem;
        all.push(saved);
      }
    } else {
      saved = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: item.type || 'VARIAVEL',
        supplier: item.supplier || '',
        dueDate: item.dueDate || new Date().toISOString().split('T')[0],
        status: item.status || 'PENDENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...item,
      } as ExpenseItem;
      all.push(saved);
    }

    localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(all));
    return saved;
  }

  deleteExpenseItem(id: string): boolean {
    const all = this.getExpenseItems().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(all));
    return true;
  }

  duplicateExpenseItem(id: string): ExpenseItem | null {
    const all = this.getExpenseItems();
    const source = all.find((item) => item.id === id);
    if (!source) return null;

    const copy: ExpenseItem = {
      ...source,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      description: `${source.description} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all.push(copy);
    localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(all));
    return copy;
  }

  batchSaveExpenseItems(items: ExpenseItem[]): void {
    const all = this.getExpenseItems();
    const existingIds = new Set(all.map((i) => i.id));
    const toAppend: ExpenseItem[] = [];

    items.forEach((item) => {
      if (existingIds.has(item.id)) {
        const idx = all.findIndex((i) => i.id === item.id);
        all[idx] = item;
      } else {
        toAppend.push(item);
      }
    });

    localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify([...all, ...toAppend]));
  }

  // --- BACKUP & RESTORE ---
  exportAllData(): string {
    return JSON.stringify(
      {
        settings: this.getSettings(),
        categories: this.getCategories(),
        fixedExpenses: this.getFixedExpenses(),
        competencies: this.getCompetencies(),
        expenseItems: this.getExpenseItems(),
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      null,
      2
    );
  }

  importAllData(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
      if (parsed.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(parsed.categories));
      if (parsed.fixedExpenses) localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(parsed.fixedExpenses));
      if (parsed.competencies) localStorage.setItem(STORAGE_KEYS.COMPETENCIES, JSON.stringify(parsed.competencies));
      if (parsed.expenseItems) localStorage.setItem(STORAGE_KEYS.EXPENSE_ITEMS, JSON.stringify(parsed.expenseItems));
      return true;
    } catch (e) {
      console.error('Failed to import backup JSON', e);
      return false;
    }
  }

  resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.FIXED_EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.COMPETENCIES);
    localStorage.removeItem(STORAGE_KEYS.EXPENSE_ITEMS);
    this.initDefaultData();
  }
}

export const storageService = new StorageService();
