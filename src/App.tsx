import React, { useState, useEffect, useMemo } from 'react';
import {
  Category,
  CompanySettings,
  Competence,
  ExpenseItem,
  FixedExpense,
  ReceiptAttachment,
} from './types';
import { storageService } from './services/storageService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { CompetenceDetailPage } from './pages/CompetenceDetailPage';
import { CompetenciesPage } from './pages/CompetenciesPage';
import { FixedExpensesPage } from './pages/FixedExpensesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

// Modals
import { ExpenseModal } from './components/modals/ExpenseModal';
import { FixedExpenseModal } from './components/modals/FixedExpenseModal';
import { CategoryModal } from './components/modals/CategoryModal';
import { NewCompetenceModal } from './components/modals/NewCompetenceModal';
import { ExcelImportModal } from './components/modals/ExcelImportModal';
import { ReceiptsModal } from './components/modals/ReceiptsModal';
import { ComissioneModal } from './components/modals/ComissioneModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { Breadcrumb } from './components/Breadcrumb';
import { LoadingSkeleton } from './components/LoadingSkeleton';

import { exportCompetencePDF } from './utils/pdfExporter';
import { exportCompetenceExcel } from './utils/excelExporter';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prestacao_contas_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('prestacao_contas_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('prestacao_contas_theme', 'light');
    }
  }, [darkMode]);

  // Core Data States
  const [settings, setSettings] = useState<CompanySettings>(() => storageService.getSettings());
  const [categories, setCategories] = useState<Category[]>(() => storageService.getCategories());
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => storageService.getFixedExpenses());
  const [competencies, setCompetencies] = useState<Competence[]>(() => storageService.getCompetencies());
  const [allItems, setAllItems] = useState<ExpenseItem[]>(() => storageService.getExpenseItems());

  // Active Navigation & Competence
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeCompetenceId, setActiveCompetenceId] = useState<string>(() => competencies[0]?.id || '2026-07');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals Visibility
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isFixedExpenseModalOpen, setIsFixedExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isNewCompetenceModalOpen, setIsNewCompetenceModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);
  const [isComissioneModalOpen, setIsComissioneModalOpen] = useState(false);

  // Custom Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Targets for editing
  const [editingExpenseItem, setEditingExpenseItem] = useState<ExpenseItem | null>(null);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [receiptTargetItem, setReceiptTargetItem] = useState<ExpenseItem | null>(null);

  // Sync competence selector
  useEffect(() => {
    if (competencies.length > 0 && !competencies.some((c) => c.id === activeCompetenceId)) {
      setActiveCompetenceId(competencies[0].id);
    }
  }, [competencies, activeCompetenceId]);

  const activeCompetence = useMemo(
    () => competencies.find((c) => c.id === activeCompetenceId) || competencies[0] || null,
    [competencies, activeCompetenceId]
  );

  // Expense items for current competence
  const activeCompetenceItems = useMemo(() => {
    let list = allItems.filter((item) => item.competenceId === activeCompetenceId);
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q) ||
          i.observation?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allItems, activeCompetenceId, globalSearch]);

  // Unique suppliers list
  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.supplier) set.add(i.supplier);
    });
    fixedExpenses.forEach((f) => {
      if (f.supplier) set.add(f.supplier);
    });
    return Array.from(set).sort();
  }, [allItems, fixedExpenses]);

  // --- HANDLERS ---

  // Competence Creation
  const handleCreateCompetence = (year: number, month: number, notes?: string) => {
    const newComp = storageService.createCompetence(year, month, notes);
    setCompetencies(storageService.getCompetencies());
    setAllItems(storageService.getExpenseItems());
    setActiveCompetenceId(newComp.id);
  };

  const handleDeleteCompetence = (compKey: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Competência',
      message: 'Tem certeza que deseja excluir esta competência e todas as suas despesas lançadas?',
      variant: 'danger',
      onConfirm: () => {
        storageService.deleteCompetence(compKey);
        const updatedComps = storageService.getCompetencies();
        setCompetencies(updatedComps);
        setAllItems(storageService.getExpenseItems());
        if (activeCompetenceId === compKey) {
          setActiveCompetenceId(updatedComps[0]?.id || '');
        }
      },
    });
  };

  // Expense Item Save (Add/Edit)
  const handleSaveExpenseItem = (itemData: Partial<ExpenseItem>) => {
    const saved = storageService.saveExpenseItem({
      ...itemData,
      competenceId: activeCompetenceId,
    } as Partial<ExpenseItem> & { competenceId: string; description: string; amount: number; categoryId: string });

    setAllItems(storageService.getExpenseItems());
    setEditingExpenseItem(null);
  };

  const handleDeleteExpenseItem = (item: ExpenseItem) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Despesa',
      message: `Tem certeza que deseja excluir a despesa "${item.description}"?`,
      variant: 'danger',
      onConfirm: () => {
        storageService.deleteExpenseItem(item.id);
        setAllItems(storageService.getExpenseItems());
      },
    });
  };

  const handleDuplicateExpenseItem = (item: ExpenseItem) => {
    storageService.duplicateExpenseItem(item.id);
    setAllItems(storageService.getExpenseItems());
  };

  const handleToggleItemStatus = (item: ExpenseItem) => {
    const nextStatus = item.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    storageService.saveExpenseItem({
      ...item,
      status: nextStatus,
    });
    setAllItems(storageService.getExpenseItems());
  };

  const handleSaveReceipts = (itemId: string, receipts: ReceiptAttachment[]) => {
    const target = allItems.find((i) => i.id === itemId);
    if (target) {
      storageService.saveExpenseItem({
        ...target,
        receipts,
      });
      setAllItems(storageService.getExpenseItems());
      if (receiptTargetItem?.id === itemId) {
        setReceiptTargetItem({ ...target, receipts });
      }
    }
  };

  // Fixed Expense Save
  const handleSaveFixedExpense = (fixedData: Partial<FixedExpense>) => {
    storageService.saveFixedExpense(fixedData as Partial<FixedExpense> & { name: string; categoryId: string; defaultAmount: number });
    setFixedExpenses(storageService.getFixedExpenses());
    setEditingFixedExpense(null);
  };

  const handleDeleteFixedExpense = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Despesa Fixa',
      message: 'Excluir esta despesa fixa do cadastro matriz? As competências passadas permanecerão intactas.',
      variant: 'danger',
      onConfirm: () => {
        storageService.deleteFixedExpense(id);
        setFixedExpenses(storageService.getFixedExpenses());
      },
    });
  };

  const handleToggleFixedExpenseActive = (id: string) => {
    storageService.toggleFixedExpenseActive(id);
    setFixedExpenses(storageService.getFixedExpenses());
  };

  // Category Save
  const handleSaveCategory = (catData: Partial<Category> & { name: string; color: string }) => {
    storageService.saveCategory(catData);
    setCategories(storageService.getCategories());
    setEditingCategory(null);
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Excluir esta categoria? As despesas já associadas permanecerão com o histórico salvo.',
      variant: 'warning',
      onConfirm: () => {
        storageService.deleteCategory(id);
        setCategories(storageService.getCategories());
      },
    });
  };

  // Settings Save
  const handleSaveSettings = (newSettings: CompanySettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Excel Import Completed
  const handleImportExcelCompleted = (newItems: ExpenseItem[]) => {
    storageService.batchSaveExpenseItems(newItems);
    setAllItems(storageService.getExpenseItems());
  };

  // Exports
  const handleGeneratePDF = () => {
    if (!activeCompetence) return;
    exportCompetencePDF(settings, activeCompetence.label, activeCompetenceItems, categories);
  };

  const handleGenerateExcel = () => {
    if (!activeCompetence) return;
    exportCompetenceExcel(settings, activeCompetence.label, activeCompetenceItems, categories);
  };

  // Backup & Reset
  const handleExportBackup = () => {
    const jsonStr = storageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_prestacao_contas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonStr: string): boolean => {
    const ok = storageService.importAllData(jsonStr);
    if (ok) {
      setSettings(storageService.getSettings());
      setCategories(storageService.getCategories());
      setFixedExpenses(storageService.getFixedExpenses());
      setCompetencies(storageService.getCompetencies());
      setAllItems(storageService.getExpenseItems());
    }
    return ok;
  };

  const handleResetData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Restaurar Dados Iniciais',
      message: 'Deseja resetar o sistema e carregar os dados de demonstração novamente? Quaisquer alterações feitas serão substituídas.',
      variant: 'danger',
      onConfirm: () => {
        storageService.resetToDefault();
        setSettings(storageService.getSettings());
        setCategories(storageService.getCategories());
        setFixedExpenses(storageService.getFixedExpenses());
        setCompetencies(storageService.getCompetencies());
        setAllItems(storageService.getExpenseItems());
      },
    });
  };

  return (
    <div className="flex h-screen bg-[#F6F8FB] text-[#1E293B] font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'comissione') {
            setIsComissioneModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        activeCompetenceLabel={activeCompetence?.label || 'Julho/2026'}
        onNewCompetence={() => setIsNewCompetenceModalOpen(true)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          settings={settings}
          activeCompetence={activeCompetence}
          competencies={competencies}
          onSelectCompetence={(key) => setActiveCompetenceId(key)}
          globalSearch={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
          onGeneratePDF={handleGeneratePDF}
          onGenerateExcel={handleGenerateExcel}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <Breadcrumb
            currentTab={currentTab}
            activeCompetenceLabel={activeCompetence?.label}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />

          {currentTab === 'dashboard' && (
            <DashboardPage
              settings={settings}
              activeCompetence={activeCompetence}
              allCompetencies={competencies}
              allItems={allItems}
              categories={categories}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onNewCompetence={() => setIsNewCompetenceModalOpen(true)}
              onNewExpense={() => {
                setEditingExpenseItem(null);
                setIsExpenseModalOpen(true);
              }}
              onImportExcel={() => setIsExcelImportModalOpen(true)}
              onGeneratePDF={handleGeneratePDF}
              onGenerateExcel={handleGenerateExcel}
            />
          )}

          {currentTab === 'competence_detail' && (
            <CompetenceDetailPage
              activeCompetence={activeCompetence}
              items={activeCompetenceItems}
              categories={categories}
              suppliers={suppliersList}
              onNewExpense={() => {
                setEditingExpenseItem(null);
                setIsExpenseModalOpen(true);
              }}
              onImportExcel={() => setIsExcelImportModalOpen(true)}
              onGeneratePDF={handleGeneratePDF}
              onGenerateExcel={handleGenerateExcel}
              onOpenComissione={() => setIsComissioneModalOpen(true)}
              onEditItem={(item) => {
                setEditingExpenseItem(item);
                setIsExpenseModalOpen(true);
              }}
              onDuplicateItem={handleDuplicateExpenseItem}
              onDeleteItem={handleDeleteExpenseItem}
              onToggleStatus={handleToggleItemStatus}
              onManageReceipts={(item) => {
                setReceiptTargetItem(item);
                setIsReceiptsModalOpen(true);
              }}
            />
          )}

          {currentTab === 'competencies' && (
            <CompetenciesPage
              competencies={competencies}
              allItems={allItems}
              settings={settings}
              categories={categories}
              activeCompetenceId={activeCompetenceId}
              onSelectCompetence={(id) => setActiveCompetenceId(id)}
              onNewCompetence={() => setIsNewCompetenceModalOpen(true)}
              onDeleteCompetence={handleDeleteCompetence}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'fixed_expenses' && (
            <FixedExpensesPage
              fixedExpenses={fixedExpenses}
              categories={categories}
              onNewFixedExpense={() => {
                setEditingFixedExpense(null);
                setIsFixedExpenseModalOpen(true);
              }}
              onEditFixedExpense={(exp) => {
                setEditingFixedExpense(exp);
                setIsFixedExpenseModalOpen(true);
              }}
              onDeleteFixedExpense={handleDeleteFixedExpense}
              onToggleActive={handleToggleFixedExpenseActive}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesPage
              categories={categories}
              allItems={allItems}
              onNewCategory={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              onEditCategory={(cat) => {
                setEditingCategory(cat);
                setIsCategoryModalOpen(true);
              }}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              competencies={competencies}
              allItems={allItems}
              categories={categories}
              settings={settings}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onResetData={handleResetData}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}
        </main>
      </div>

      {/* --- ALL SYSTEM MODALS --- */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpenseItem}
        initialData={editingExpenseItem}
        categories={categories}
        competenceId={activeCompetenceId}
      />

      <FixedExpenseModal
        isOpen={isFixedExpenseModalOpen}
        onClose={() => setIsFixedExpenseModalOpen(false)}
        onSave={handleSaveFixedExpense}
        initialData={editingFixedExpense}
        categories={categories}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        initialData={editingCategory}
      />

      <NewCompetenceModal
        isOpen={isNewCompetenceModalOpen}
        onClose={() => setIsNewCompetenceModalOpen(false)}
        onCreate={handleCreateCompetence}
        activeFixedCount={fixedExpenses.filter((f) => f.active).length}
      />

      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        competenceId={activeCompetenceId}
        categories={categories}
        onImportComplete={handleImportExcelCompleted}
      />

      <ReceiptsModal
        isOpen={isReceiptsModalOpen}
        onClose={() => setIsReceiptsModalOpen(false)}
        item={receiptTargetItem}
        onSaveReceipts={handleSaveReceipts}
      />

      <ComissioneModal
        isOpen={isComissioneModalOpen}
        onClose={() => setIsComissioneModalOpen(false)}
        settings={settings}
        competence={activeCompetence}
        items={activeCompetenceItems}
        categories={categories}
      />

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
      />
    </div>
  );
}
