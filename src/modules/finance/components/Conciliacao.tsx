import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  Check, 
  XCircle, 
  PlusCircle, 
  Link2, 
  Sparkles, 
  Building2, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter,
  DollarSign
} from 'lucide-react';
import { FinancialAccount, User, FinancialTransaction } from '../../../../types';
import { useBankTransactions, BankTransaction } from '../../../hooks/useBankTransactions';
import { supabase } from '../../../../supabase';
import { TransferBadge } from '../../../components/TransferBadge';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';
import { isCreditTransaction, getTransactionValueColor } from '../utils/currency';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

interface RentInstallmentItem {
  id: string;
  contract_id: string;
  due_date: string;
  expected_amount: number;
  expected_fee: number;
  status: string;
  tenant_name?: string;
  property_address?: string;
}

interface BrokerSplitItem {
  id: string;
  sale_id: string;
  broker_name: string;
  calculated_value: number;
  due_date?: string;
  status: string;
  buyer_name?: string;
  buyer_document?: string;
  property_address?: string;
}

interface ConciliacaoProps {
  currentUser: User;
  accounts: FinancialAccount[];
  transactions?: FinancialTransaction[];
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onOpenNewExpenseModal?: (data: { 
    description: string; 
    amount: number; 
    date: string;
    type?: string;
    account_id?: string;
    category_id?: string;
    status?: string;
    bank_transaction_id?: string;
    payment_date?: string;
  }) => void;
  categories?: any[];
}

// Conciliação bancária de bank_transactions (Sicoob/OFX/CSV)
export const Conciliacao: React.FC<ConciliacaoProps> = ({
  currentUser,
  accounts,
  transactions = [],
  showToast,
  onOpenNewExpenseModal,
  categories = [],
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const {
    bankTransactions,
    loading,
    fetchTransactions,
    matchTransaction,
    ignoreTransaction,
    reconcileTransaction,
  } = useBankTransactions(currentUser.agencyId, selectedAccountId);

  const [rentInstallments, setRentInstallments] = useState<RentInstallmentItem[]>([]);
  const [brokerSplits, setBrokerSplits] = useState<BrokerSplitItem[]>([]);
  const [manualTransactions, setManualTransactions] = useState<FinancialTransaction[]>([]);
  const [loadingPendingItems, setLoadingPendingItems] = useState(false);

  // Modal de Reconciliação com confirmação
  const [reconcileTargetTx, setReconcileTargetTx] = useState<BankTransaction | null>(null);
  const [fetchedCategories, setFetchedCategories] = useState<any[]>([]);

  useEffect(() => {
    if (supabase && (!categories || categories.length === 0)) {
      supabase
        .from('financial_categories')
        .select('*')
        .then(({ data }) => {
          if (data) setFetchedCategories(data);
        });
    }
  }, [categories]);

  const inferCategoryId = (description: string, type: string) => {
    if (!description) return '';
    const desc = description.toLowerCase();
    const catList = categories && categories.length > 0 ? categories : fetchedCategories;

    // 1. NFS-e ou taxa
    if (desc.includes('nfs-e') || desc.includes('taxa') || desc.includes('tarifa') || desc.includes('imposto') || desc.includes('bancá') || desc.includes('bancaria') || desc.includes('iof')) {
      const match = catList.find(c =>
        (c.type === type || !c.type) && (
          c.name.toLowerCase().includes('taxa') ||
          c.name.toLowerCase().includes('tarifa') ||
          c.name.toLowerCase().includes('imposto') ||
          c.name.toLowerCase().includes('bancá')
        )
      );
      if (match) return match.id;
    }

    // 2. Pix & débito
    if (desc.includes('pix') && (type === 'EXPENSE' || type === 'debit')) {
      const match = catList.find(c =>
        (c.type === type || !c.type) && (
          c.name.toLowerCase().includes('transferência') ||
          c.name.toLowerCase().includes('transferencia') ||
          c.name.toLowerCase().includes('pagamento') ||
          c.name.toLowerCase().includes('pix') ||
          c.name.toLowerCase().includes('outras despesas') ||
          c.name.toLowerCase().includes('despesas diversas')
        )
      );
      if (match) return match.id;
    }

    // 3. Cobrança recebida / aluguel / receita
    if (desc.includes('cobrança') || desc.includes('cobranca') || desc.includes('aluguel') || desc.includes('recebido') || desc.includes('recebida')) {
      const match = catList.find(c =>
        (c.type === type || !c.type) && (
          c.name.toLowerCase().includes('aluguel') ||
          c.name.toLowerCase().includes('receita') ||
          c.name.toLowerCase().includes('loca')
        )
      );
      if (match) return match.id;
    }

    // Fallback: primeira categoria do tipo correto se houver
    const defaultForType = catList.find(c => c.type === type);
    if (defaultForType) return defaultForType.id;

    return '';
  };

  const handleLancarFromBankTx = (tx: BankTransaction) => {
    const txType = tx.type === 'credit' ? 'INCOME' : 'EXPENSE';
    const categoryId = inferCategoryId(tx.description, txType);
    const targetAccountId = tx.account_id || (selectedAccountId !== 'ALL' ? selectedAccountId : (accounts[0]?.id || ''));

    if (onOpenNewExpenseModal) {
      onOpenNewExpenseModal({
        description: tx.description,
        amount: Math.abs(Number(tx.amount || 0)),
        date: tx.date,
        payment_date: tx.date,
        type: txType,
        account_id: targetAccountId,
        category_id: categoryId,
        status: 'PAID',
        bank_transaction_id: tx.id,
      });
    }
  };

  // Modal de Vínculo
  const [linkingBankTx, setLinkingBankTx] = useState<BankTransaction | null>(null);
  const [selectedMatchTarget, setSelectedMatchTarget] = useState<{ type: 'rent' | 'broker_split' | 'expense' | 'other'; id: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreatingNewManualTx, setIsCreatingNewManualTx] = useState<boolean>(false);
  const [newManualTxData, setNewManualTxData] = useState({
    description: '',
    amount: 0,
    date: '',
    accountId: '',
  });
  const [isSavingManualTx, setIsSavingManualTx] = useState<boolean>(false);

  // Fetch pending rent installments, broker splits and manual transactions
  const loadPendingItems = async () => {
    if (!supabase) return;
    setLoadingPendingItems(true);

    try {
      // 1. Fetch pending rent installments with contract details
      const { data: instData } = await supabase
        .from('rent_installments')
        .select(`
          id,
          contract_id,
          due_date,
          expected_amount,
          expected_fee,
          status,
          rent_contracts (
            tenant_name,
            property_address
          )
        `)
        .in('status', ['pending', 'overdue']);

      const formattedInst: RentInstallmentItem[] = (instData || []).map((item: any) => ({
        id: item.id,
        contract_id: item.contract_id,
        due_date: item.due_date,
        expected_amount: Number(item.expected_amount),
        expected_fee: Number(item.expected_fee),
        status: item.status,
        tenant_name: item.rent_contracts?.tenant_name || 'Inquilino',
        property_address: item.rent_contracts?.property_address || 'Imóvel',
      }));
      setRentInstallments(formattedInst);

      // 2. Fetch ALL broker splits (including PENDING and PAID) with sale details
      try {
        const { data: splitData, error: splitErr } = await supabase
          .from('broker_splits')
          .select(`
            id,
            sale_id,
            calculated_value,
            status,
            forecast_date,
            payment_date,
            broker_name,
            sales (
              buyer_name,
              buyer_document,
              property_address,
              code
            )
          `);

        if (splitErr) {
          console.warn('Aviso ao carregar comissões (broker_splits):', splitErr.message);
        } else if (splitData) {
          const formattedSplits: BrokerSplitItem[] = splitData.map((item: any) => ({
            id: item.id,
            sale_id: item.sale_id,
            broker_name: item.broker_name || 'Corretor',
            calculated_value: Number(item.calculated_value || 0),
            due_date: item.forecast_date || item.payment_date || new Date().toISOString().split('T')[0],
            status: item.status,
            buyer_name: item.sales?.buyer_name || null,
            buyer_document: item.sales?.buyer_document || null,
            property_address: item.sales?.property_address || null,
          }));
          setBrokerSplits(formattedSplits);
        }
      } catch (err) {
        console.warn('Erro ao carregar comissões:', err);
      }

      // 3. Fetch manual transactions from financial_transactions
      if (transactions && transactions.length > 0) {
        setManualTransactions(transactions);
      } else {
        const { data: txData } = await supabase
          .from('financial_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (txData) {
          setManualTransactions(txData as any);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar itens para conciliação:', err);
    } finally {
      setLoadingPendingItems(false);
    }
  };

  useEffect(() => {
    loadPendingItems();
  }, []);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId || selectedAccountId === 'ALL') return null;
    return accounts.find(a => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Filter bank transactions that are pending and belong to selectedAccountId if specified
  const pendingBankTxs = useMemo(() => {
    return bankTransactions.filter(tx => {
      if (tx.status !== 'pending') return false;
      if (selectedAccountId && selectedAccountId !== 'ALL') {
        return tx.account_id === selectedAccountId;
      }
      return true;
    });
  }, [bankTransactions, selectedAccountId]);

  // Auto-match calculation:
  // For each pending bank_tx, check if there's an exact match in amount and due_date ± 3 days
  const suggestedMatches = useMemo(() => {
    const map = new Map<string, { type: 'rent' | 'broker_split'; id: string; label: string }>();

    for (const tx of pendingBankTxs) {
      const txDate = new Date(tx.date).getTime();

      if (tx.type === 'credit') {
        // Look for rent installment with exact expected_amount and date ± 3 days
        const candidate = rentInstallments.filter(inst => {
          if (Math.abs(inst.expected_amount - tx.amount) > 0.01) return false;
          const instDate = new Date(inst.due_date).getTime();
          const diffDays = Math.abs(txDate - instDate) / (1000 * 3600 * 24);
          return diffDays <= 3;
        });

        if (candidate.length === 1) {
          map.set(tx.id, {
            type: 'rent',
            id: candidate[0].id,
            label: `Aluguel: ${candidate[0].tenant_name} (R$ ${candidate[0].expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          });
        }
      } else if (tx.type === 'debit') {
        // Look for broker split with exact calculated_value and date ± 3 days
        const candidate = brokerSplits.filter(split => {
          if (Math.abs(split.calculated_value - tx.amount) > 0.01) return false;
          if (!split.due_date) return true;
          const splitDate = new Date(split.due_date).getTime();
          const diffDays = Math.abs(txDate - splitDate) / (1000 * 3600 * 24);
          return diffDays <= 3;
        });

        if (candidate.length === 1) {
          const clientLabel = candidate[0].buyer_name ? ` (Cliente: ${candidate[0].buyer_name})` : '';
          map.set(tx.id, {
            type: 'broker_split',
            id: candidate[0].id,
            label: `Comissão: ${candidate[0].broker_name}${clientLabel} (R$ ${candidate[0].calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          });
        }
      }
    }

    return map;
  }, [pendingBankTxs, rentInstallments, brokerSplits]);

  // Filter broker splits for modal real-time search
  const filteredBrokerSplits = useMemo(() => {
    if (!searchTerm.trim()) return brokerSplits;
    const term = searchTerm.trim().toLowerCase();

    // Check if search contains R$ or numeric amount
    let targetAmount: number | null = null;
    if (term.includes('r$')) {
      const cleanNum = term.replace(/r\$/gi, '').trim().replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed)) targetAmount = parsed;
    } else {
      const cleanNum = term.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && !term.includes('/') && !term.includes('-')) {
        targetAmount = parsed;
      }
    }

    return brokerSplits.filter((split) => {
      // 1. Amount match (±R$ 5,00)
      if (targetAmount !== null) {
        if (Math.abs(split.calculated_value - targetAmount) <= 5.00) return true;
      }

      // 2. Broker name match (case-insensitive)
      if (split.broker_name.toLowerCase().includes(term)) return true;

      // 3. Buyer name match
      if (split.buyer_name && split.buyer_name.toLowerCase().includes(term)) return true;

      // 4. Property address match
      if (split.property_address && split.property_address.toLowerCase().includes(term)) return true;

      // 5. Due date match (DD/MM/AAAA or YYYY-MM-DD)
      if (split.due_date) {
        const rawDate = split.due_date;
        const parts = rawDate.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : rawDate;
        if (rawDate.includes(term) || formattedDate.includes(term)) return true;
      }

      return false;
    });
  }, [brokerSplits, searchTerm]);

  // Filter rent installments
  const filteredRentInstallments = useMemo(() => {
    if (!searchTerm.trim()) return rentInstallments;
    const term = searchTerm.trim().toLowerCase();

    let targetAmount: number | null = null;
    if (term.includes('r$')) {
      const cleanNum = term.replace(/r\$/gi, '').trim().replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed)) targetAmount = parsed;
    } else {
      const cleanNum = term.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && !term.includes('/') && !term.includes('-')) {
        targetAmount = parsed;
      }
    }

    return rentInstallments.filter((inst) => {
      if (targetAmount !== null && Math.abs(inst.expected_amount - targetAmount) <= 5.00) return true;
      if (inst.tenant_name?.toLowerCase().includes(term)) return true;
      if (inst.property_address?.toLowerCase().includes(term)) return true;
      if (inst.due_date) {
        const parts = inst.due_date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : inst.due_date;
        if (inst.due_date.includes(term) || formattedDate.includes(term)) return true;
      }
      return false;
    });
  }, [rentInstallments, searchTerm]);

  // Filter manual transactions from financial_transactions
  const filteredManualTransactions = useMemo(() => {
    if (!manualTransactions || manualTransactions.length === 0) return [];
    if (!searchTerm.trim()) return manualTransactions.slice(0, 5);

    const term = searchTerm.trim().toLowerCase();

    let targetAmount: number | null = null;
    if (term.includes('r$')) {
      const cleanNum = term.replace(/r\$/gi, '').trim().replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed)) targetAmount = parsed;
    } else {
      const cleanNum = term.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && !term.includes('/') && !term.includes('-')) {
        targetAmount = parsed;
      }
    }

    const matched = manualTransactions.filter((tx) => {
      if (targetAmount !== null && Math.abs(Number(tx.amount || 0) - targetAmount) <= 5.00) return true;
      if ((tx.description || '').toLowerCase().includes(term)) return true;
      if (tx.due_date) {
        const parts = tx.due_date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : tx.due_date;
        if (tx.due_date.includes(term) || formattedDate.includes(term)) return true;
      }
      return false;
    });

    return matched.slice(0, 5);
  }, [manualTransactions, searchTerm]);

  const handleLinkClick = (tx: BankTransaction) => {
    const suggested = suggestedMatches.get(tx.id);
    setLinkingBankTx(tx);
    setSearchTerm('');
    setIsCreatingNewManualTx(false);
    if (suggested) {
      setSelectedMatchTarget({ type: suggested.type, id: suggested.id });
    } else {
      setSelectedMatchTarget(null);
    }
  };

  const handleStartNewManualTx = (tx: BankTransaction) => {
    setIsCreatingNewManualTx(true);
    setNewManualTxData({
      description: tx.description || '',
      amount: tx.amount || 0,
      date: tx.date || new Date().toISOString().split('T')[0],
      accountId: tx.account_id || (selectedAccountId !== 'ALL' ? selectedAccountId : (accounts[0]?.id || '')),
    });
  };

  const handleSaveAndLinkManualTx = async () => {
    if (!linkingBankTx || !supabase) return;
    if (!newManualTxData.description.trim()) {
      alert('Informe a descrição do lançamento.');
      return;
    }

    setIsSavingManualTx(true);
    try {
      const isDebit = linkingBankTx.type === 'debit';
      const { data: createdTx, error: createErr } = await supabase
        .from('financial_transactions')
        .insert({
          description: newManualTxData.description,
          amount: newManualTxData.amount,
          due_date: newManualTxData.date,
          payment_date: newManualTxData.date,
          account_id: newManualTxData.accountId || accounts[0]?.id || null,
          agency_id: currentUser.agencyId,
          type: isDebit ? 'EXPENSE' : 'INCOME',
          status: 'PAID',
          category: isDebit ? 'Despesas Diversas' : 'Receitas Diversas',
        })
        .select()
        .single();

      if (createErr || !createdTx) throw createErr || new Error('Falha ao criar lançamento.');

      const ok = await matchTransaction(linkingBankTx.id, 'expense', createdTx.id);
      if (ok) {
        if (showToast) showToast('Lançamento criado e conciliação realizada!', 'success');
        setLinkingBankTx(null);
        setSelectedMatchTarget(null);
        setIsCreatingNewManualTx(false);
        setSearchTerm('');
        loadPendingItems();
      } else {
        if (showToast) showToast('Erro ao conciliar.', 'error');
      }
    } catch (err) {
      console.error('Erro ao criar lançamento manual:', err);
      if (showToast) showToast('Erro ao criar e conciliar lançamento manual.', 'error');
    } finally {
      setIsSavingManualTx(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!linkingBankTx || !selectedMatchTarget) return;

    const ok = await matchTransaction(linkingBankTx.id, selectedMatchTarget.type, selectedMatchTarget.id);
    if (ok) {
      if (showToast) showToast('Transação conciliada com sucesso!', 'success');
      setLinkingBankTx(null);
      setSelectedMatchTarget(null);
      loadPendingItems();
    } else {
      if (showToast) showToast('Erro ao conciliar transação.', 'error');
    }
  };

  const handleDirectReconcile = async (txId: string) => {
    const ok = await reconcileTransaction(txId);
    if (ok) {
      if (showToast) showToast('Transação marcada como reconciliada sem vínculo.', 'info');
      loadPendingItems();
    }
  };

  const handleIgnore = async (txId: string) => {
    const ok = await ignoreTransaction(txId);
    if (ok) {
      if (showToast) showToast('Transação ignorada.', 'info');
      loadPendingItems();
    }
  };

  return (
    <div className="space-y-6">
      <FinancialKpiHeaderCards transactions={transactions} />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="text-indigo-600" size={22} />
            Conciliação Bancária
            <HeaderTooltip text="Comparativo e cruzamento automático de extratos bancários importados (OFX/CSV) com lançamentos do sistema." />
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedAccount ? (
              <>
                Vincule extratos importados do <strong className="font-semibold text-slate-700">{selectedAccount.name}</strong> aos recebimentos de aluguel e pagamentos de comissão.
              </>
            ) : (
              <>
                Selecione uma conta bancária para começar a conciliar.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas as Contas Bancárias</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchTransactions()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            title="Atualizar dados"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: 60% Left (Bank Txs) + 40% Right (System Pendings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bank Transactions (7 cols ~60%) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Extrato Bancário Pendente</h3>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200/60">
                {pendingBankTxs.length} para conciliar
              </span>
            </div>
            {suggestedMatches.size > 0 && (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse">
                <Sparkles size={13} />
                {suggestedMatches.size} sugestões automáticas
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Carregando transações do banco...
            </div>
          ) : pendingBankTxs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Tudo Conciliado!</p>
              <p className="text-xs text-slate-400">
                {selectedAccount ? (
                  <>
                    Nenhuma transação pendente para <strong className="font-semibold text-slate-600">{selectedAccount.name}</strong>. Importe um extrato em <span className="font-semibold text-indigo-600">Importar Extrato</span>.
                  </>
                ) : (
                  <>
                    Não há transações pendentes de conciliação no momento. Importe um novo extrato OFX/CSV.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBankTxs.map((tx) => {
                const suggested = suggestedMatches.get(tx.id);
                const isTransfer = Boolean(tx.transfer_id);

                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      isTransfer
                        ? 'bg-slate-50/80 border-slate-200 opacity-90'
                        : suggested
                        ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">{tx.date}</span>
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
                              isCreditTransaction(tx)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isCreditTransaction(tx) ? 'Crédito' : 'Débito'}
                          </span>
                          <TransferBadge transferId={tx.transfer_id} />
                          {tx.ofx_fitid?.startsWith('MANUAL-') && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300/60 inline-flex items-center gap-1">
                              ✎ Lançamento manual
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 mt-1 leading-snug">{tx.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-bold ${getTransactionValueColor(tx)}`}
                        >
                          {tx.transfer_id ? '' : isCreditTransaction(tx) ? '+' : '-'} R${' '}
                          {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Auto-match highlight badge */}
                    {suggested && !isTransfer && (
                      <div className="p-2 bg-amber-100/70 border border-amber-300/60 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles size={14} className="text-amber-600 shrink-0" />
                          <span className="font-semibold text-[11px] truncate">{suggested.label}</span>
                        </div>
                        <button
                          onClick={() => handleLinkClick(tx)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-md transition-all shrink-0 cursor-pointer"
                        >
                          Confirmar Match
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100/80">
                      {!isTransfer ? (
                        <>
                          <button
                            onClick={() => handleLinkClick(tx)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 size={13} />
                            Vincular
                          </button>

                          <button
                            onClick={() => setReconcileTargetTx(tx)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            title="Marcar como conciliado. A transação sai da lista de pendentes mas NÃO cria lançamento no extrato. Use quando a transação já está registrada em outro sistema (ex: contabilidade externa) ou é irrelevante."
                          >
                            <Check size={13} />
                            Reconciliar
                          </button>

                          {onOpenNewExpenseModal && (
                            <button
                              onClick={() => handleLancarFromBankTx(tx)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <PlusCircle size={13} />
                              Lançar
                            </button>
                          )}
                        </>
                      ) : null}

                      <button
                        onClick={() => handleIgnore(tx.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        title="Transferência entre contas, sem impacto em receita/despesa"
                      >
                        <XCircle size={14} />
                        Ignorar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: System Pending Items (5 cols ~40%) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Registros Pendentes no Sistema</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aluguéis a receber e comissões a pagar</p>
          </div>

          {loadingPendingItems ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">Carregando pendências...</div>
          ) : (
            <div className="space-y-5">
              {/* Rent Installments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Building2 size={15} />
                    Aluguéis (imobia.app)
                  </span>
                  <span className="text-slate-400 font-normal">{rentInstallments.length} itens</span>
                </div>

                {rentInstallments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                    Nenhum aluguel pendente de recebimento.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {rentInstallments.map((inst) => (
                      <div key={inst.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 truncate">{inst.tenant_name}</span>
                          <span className="font-mono text-emerald-600 font-bold">
                            R$ {inst.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[180px]">{inst.property_address}</span>
                          <span>Venc: {inst.due_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Broker Splits */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-purple-700">
                    <Users size={15} />
                    Comissões Corretores
                  </span>
                  <span className="text-slate-400 font-normal">{brokerSplits.length} itens</span>
                </div>

                {brokerSplits.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                    Nenhuma comissão pendente de pagamento.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {brokerSplits.map((split) => (
                      <div key={split.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{split.broker_name}</span>
                          <span className="font-mono text-rose-600 font-bold">
                            R$ {split.calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                          <span className="text-slate-600 font-medium truncate max-w-[190px]">
                            {split.buyer_name ? `Cliente: ${split.buyer_name}` : (split.property_address ? `Imóvel: ${split.property_address}` : 'Comissão')}
                          </span>
                          <span className="shrink-0">Prev: {split.due_date || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Vínculo Manual */}
      {linkingBankTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Link2 size={18} className="text-indigo-600" />
                Vincular Transação Bancária
              </h3>
              <button
                onClick={() => {
                  setLinkingBankTx(null);
                  setIsCreatingNewManualTx(false);
                  setSearchTerm('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Extrato Card */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
              <span className="font-bold block uppercase tracking-wider text-[10px] text-indigo-600">Extrato Bancário:</span>
              <p className="font-bold text-sm">{linkingBankTx.description}</p>
              <p className="font-mono">
                {linkingBankTx.date} |{' '}
                <strong className={linkingBankTx.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'}>
                  R$ {linkingBankTx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>

            {isCreatingNewManualTx ? (
              /* Mini-form de Novo Lançamento Manual */
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Criar e Vincular Lançamento Manual</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    Status: PAGO
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição*</label>
                    <input
                      type="text"
                      value={newManualTxData.description}
                      onChange={(e) => setNewManualTxData({ ...newManualTxData, description: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor (R$)*</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newManualTxData.amount}
                        onChange={(e) => setNewManualTxData({ ...newManualTxData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data*</label>
                      <input
                        type="date"
                        value={newManualTxData.date}
                        onChange={(e) => setNewManualTxData({ ...newManualTxData, date: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Conta de Origem</label>
                    <select
                      value={newManualTxData.accountId}
                      onChange={(e) => setNewManualTxData({ ...newManualTxData, accountId: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewManualTx(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-semibold cursor-pointer transition-all"
                  >
                    Voltar para Busca
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndLinkManualTx}
                    disabled={isSavingManualTx}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingManualTx ? 'Salvando...' : 'Salvar e Conciliar'}
                  </button>
                </div>
              </div>
            ) : (
              /* Lista com Busca */
              <div className="space-y-3">
                {/* Campo de Busca no topo do modal */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por corretor, valor ou data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 transition-all"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {linkingBankTx.type === 'credit' ? (
                    /* Créditos: Aluguéis + Lançamentos Manuais */
                    <div className="space-y-3">
                      {filteredRentInstallments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Aluguéis a Receber:</p>
                          {filteredRentInstallments.map((inst) => {
                            const isSelected = selectedMatchTarget?.type === 'rent' && selectedMatchTarget?.id === inst.id;
                            const st = (inst.status || 'PENDING').toUpperCase();
                            const isPaid = st === 'PAID';
                            const isOverdue = st === 'OVERDUE';
                            return (
                              <div
                                key={inst.id}
                                onClick={() => setSelectedMatchTarget({ type: 'rent', id: inst.id })}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{inst.tenant_name}</span>
                                    {isPaid ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                        PAGO
                                      </span>
                                    ) : isOverdue ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                                        ATRASADO
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                        PENDENTE
                                      </span>
                                    )}
                                  </div>
                                  <span>R$ {inst.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{inst.property_address} (Venc: {inst.due_date})</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {filteredManualTransactions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lançamentos Manuais:</p>
                          {filteredManualTransactions.map((tx) => {
                            const isSelected = selectedMatchTarget?.type === 'expense' && selectedMatchTarget?.id === tx.id;
                            return (
                              <div
                                key={tx.id}
                                onClick={() => setSelectedMatchTarget({ type: 'expense', id: tx.id })}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{tx.description}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                      Lançamento Manual
                                    </span>
                                  </div>
                                  <span>R$ {Number(tx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Data: {tx.due_date || tx.created_at?.split('T')[0] || 'N/A'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {filteredRentInstallments.length === 0 && filteredManualTransactions.length === 0 && (
                        <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                          <AlertCircle className="mx-auto text-slate-400" size={24} />
                          <p className="text-xs text-slate-500 font-medium">Nenhum registro encontrado para esta busca.</p>
                          <button
                            type="button"
                            onClick={() => handleStartNewManualTx(linkingBankTx)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <PlusCircle size={14} />
                            Criar Novo Lançamento
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Débitos: Comissões + Lançamentos Manuais */
                    <div className="space-y-3">
                      {filteredBrokerSplits.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Comissões a Pagar:</p>
                          {filteredBrokerSplits.map((split) => {
                            const isSelected = selectedMatchTarget?.type === 'broker_split' && selectedMatchTarget?.id === split.id;
                            const st = (split.status || 'PENDING').toUpperCase();
                            const isPaid = st === 'PAID';
                            const isOverdue = st === 'OVERDUE';
                            return (
                              <div
                                key={split.id}
                                onClick={() => setSelectedMatchTarget({ type: 'broker_split', id: split.id })}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{split.broker_name}</span>
                                    {isPaid ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                        PAGO
                                      </span>
                                    ) : isOverdue ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                                        ATRASADO
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                        PENDENTE
                                      </span>
                                    )}
                                  </div>
                                  <span>R$ {split.calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                  {split.property_address && <p className="font-medium text-slate-700 truncate">Imóvel: {split.property_address}</p>}
                                  <p className="text-slate-600">
                                    Cliente: <strong className="font-semibold text-slate-800">{split.buyer_name || 'Não informado'}</strong>
                                    {split.buyer_document ? ` (${split.buyer_document})` : ''}
                                  </p>
                                  <p className="text-slate-400 text-[10px]">Previsão: {split.due_date || 'N/A'}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {filteredManualTransactions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lançamentos Manuais:</p>
                          {filteredManualTransactions.map((tx) => {
                            const isSelected = selectedMatchTarget?.type === 'expense' && selectedMatchTarget?.id === tx.id;
                            return (
                              <div
                                key={tx.id}
                                onClick={() => setSelectedMatchTarget({ type: 'expense', id: tx.id })}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{tx.description}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                      Lançamento Manual
                                    </span>
                                  </div>
                                  <span>R$ {Number(tx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Data: {tx.due_date || tx.created_at?.split('T')[0] || 'N/A'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {filteredBrokerSplits.length === 0 && filteredManualTransactions.length === 0 && (
                        <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                          <AlertCircle className="mx-auto text-slate-400" size={24} />
                          <p className="text-xs text-slate-500 font-medium">Nenhum registro encontrado para esta busca.</p>
                          <button
                            type="button"
                            onClick={() => handleStartNewManualTx(linkingBankTx)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <PlusCircle size={14} />
                            Criar Novo Lançamento
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isCreatingNewManualTx && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setLinkingBankTx(null);
                    setIsCreatingNewManualTx(false);
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-xl cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmLink}
                  disabled={!selectedMatchTarget}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Confirmar Vínculo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Modal for Reconciliar */}
      <ConfirmModal
        isOpen={!!reconcileTargetTx}
        onClose={() => setReconcileTargetTx(null)}
        onConfirm={async () => {
          if (!reconcileTargetTx) return;
          const txId = reconcileTargetTx.id;
          setReconcileTargetTx(null);
          const ok = await reconcileTransaction(txId);
          if (ok) {
            if (showToast) showToast('Transação marcada como conciliada', 'success');
            loadPendingItems();
          } else {
            if (showToast) showToast('Erro ao conciliar transação.', 'error');
          }
        }}
        title="Marcar como conciliado?"
        description="Esta transação sairá da lista de pendentes. Nenhum lançamento será criado no extrato."
        confirmText="Marcar como Conciliado"
        cancelText="Cancelar"
        variant="info"
      />
    </div>
  );
};
