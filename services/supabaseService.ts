
import { supabase } from '../supabase';
import { Sale, User, BrokerSplit, CommissionStatus, SplitRole, FinancialAccount, FinancialCategory, FinancialTransaction, TransactionStatus, BrokerEntry } from '../types';

export interface FinancialAccountInsert {
  agency_id: string;
  name: string;
  bank_name?: string;
  account_type?: string;
  initial_balance: number;
  current_balance: number;
  color?: string;
  is_default?: boolean;
  type?: string;
  credit_limit?: number;
  is_active?: boolean;
  bank_code?: string | null;
}

export const mapUiRoleToDbRole = (uiRole: string): string => {
  if (!uiRole) return 'BROKER';
  if (['BROKER', 'CAPTURER', 'PARTNER', 'AGENCY', 'MANAGER'].includes(uiRole)) {
    return uiRole;
  }
  switch (uiRole) {
    case 'Corretor': return 'BROKER';
    case 'Captador': return 'CAPTURER';
    case 'Sócio': return 'PARTNER';
    case 'Agência': return 'AGENCY';
    case 'Gerente': return 'MANAGER';
    default: return 'BROKER';
  }
};

export const mapDbRoleToUiRole = (dbRole: string): SplitRole => {
  if (!dbRole) return SplitRole.BROKER;
  if (Object.values(SplitRole).includes(dbRole as SplitRole)) {
    return dbRole as SplitRole;
  }
  switch (dbRole) {
    case 'BROKER': return SplitRole.BROKER;
    case 'CAPTURER': return SplitRole.CAPTURER;
    case 'PARTNER': return SplitRole.PARTNER;
    case 'AGENCY': return SplitRole.AGENCY;
    case 'MANAGER': return SplitRole.MANAGER;
    default: return SplitRole.BROKER;
  }
};

export const supabaseService = {
  // Fetch all users
  async getUsers(): Promise<User[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return data.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      agencyId: u.agency_id,
      phone: u.phone,
      created_at: u.created_at
    }));
  },

  // Fetch all sales with their splits
  async getSales(): Promise<Sale[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('sales')
      .select('*, broker_splits(*)');

    if (error) {
      console.error('Error fetching sales:', error);
      return [];
    }

    return data.map(s => ({
      id: s.id,
      agencyId: s.agency_id,
      saleDate: s.sale_date,
      propertyAddress: s.property_address,
      propertyCity: s.property_city || '',
      propertyCep: s.property_cep || '',
      propertyUf: s.property_uf || 'GO',
      propertyType: s.property_type || 'urbano',
      buyerName: s.buyer_name,
      sellerName: s.seller_name,
      vgv: s.vgv,
      commissionPercentage: s.commission_percentage,
      totalCommissionValue: s.total_commission_value,
      invoiceIssued: s.invoice_issued,
      invoiceNumber: s.invoice_number,
      notes: s.notes,
      status: s.status,
      buyer_cpf: s.buyer_cpf,
      seller_cpf: s.seller_cpf,
      is_installment: s.is_installment,
      installments: s.installments,
      created_at: s.created_at,
      splits: (s.broker_splits || []).map((split: any) => ({
        id: split.id,
        sale_id: split.sale_id,
        brokerId: split.broker_id,
        brokerName: split.broker_name,
        percentage: split.percentage,
        calculatedValue: split.calculated_value,
        status: split.status as CommissionStatus,
        role: mapDbRoleToUiRole(split.role),
        paymentDate: split.payment_date,
        paymentMethod: split.payment_method,
        forecastDate: split.forecast_date,
        receiptData: split.receipt_data,
        installment_number: split.installment_number,
        total_installments: split.total_installments,
        notes: split.notes,
        discount_value: split.discount_value
      }))
    }));
  },

  // Create a new sale
  async createSale(sale: Omit<Sale, 'id' | 'splits'>, splits: Omit<BrokerSplit, 'id' | 'sale_id'>[]): Promise<Sale | null> {
    if (!supabase) return null;

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        agency_id: sale.agencyId,
        sale_date: sale.saleDate,
        property_address: sale.propertyAddress,
        property_city: sale.propertyCity,
        property_cep: sale.propertyCep,
        property_uf: sale.propertyUf,
        property_type: sale.propertyType,
        buyer_name: sale.buyerName,
        seller_name: sale.sellerName,
        vgv: sale.vgv,
        commission_percentage: sale.commissionPercentage,
        total_commission_value: sale.totalCommissionValue,
        invoice_issued: sale.invoiceIssued,
        invoice_number: sale.invoiceNumber,
        notes: sale.notes,
        status: sale.status || 'ACTIVE',
        buyer_cpf: sale.buyer_cpf,
        seller_cpf: sale.seller_cpf,
        is_installment: sale.is_installment,
        installments: sale.installments
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return null;
    }

    const saleId = saleData.id;

    const splitsToInsert = splits.map(split => ({
      sale_id: saleId,
      broker_id: (split.brokerId === 'AGENCY' || !split.brokerId) ? null : split.brokerId,
      broker_name: split.brokerName,
      percentage: split.percentage,
      calculated_value: split.calculatedValue,
      status: split.status,
      payment_date: split.paymentDate,
      payment_method: split.paymentMethod,
      forecast_date: split.forecastDate,
      receipt_data: split.receiptData,
      installment_number: split.installment_number,
      total_installments: split.total_installments,
      role: mapUiRoleToDbRole(split.role || ''),
      notes: split.notes || null,
      discount_value: split.discount_value
    }));

    const { error: splitError } = await supabase
      .from('broker_splits')
      .insert(splitsToInsert);

    if (splitError) {
      console.error('Error creating splits:', splitError);
      return null;
    }

    return { ...sale, id: saleId, splits: splits as BrokerSplit[] };
  },

  // Update sale and its splits
  async updateSale(saleId: string, sale: Partial<Sale>, splits: Omit<BrokerSplit, 'id' | 'sale_id'>[]): Promise<boolean> {
    if (!supabase) return false;

    // Update sale main fields
    const { error: saleError } = await supabase
      .from('sales')
      .update({
        sale_date: sale.saleDate,
        property_address: sale.propertyAddress,
        property_city: sale.propertyCity,
        property_cep: sale.propertyCep,
        property_uf: sale.propertyUf,
        property_type: sale.propertyType,
        buyer_name: sale.buyerName,
        seller_name: sale.sellerName,
        vgv: sale.vgv,
        commission_percentage: sale.commissionPercentage,
        total_commission_value: sale.totalCommissionValue,
        invoice_issued: sale.invoiceIssued,
        invoice_number: sale.invoiceNumber,
        notes: sale.notes,
        status: sale.status,
        buyer_cpf: sale.buyer_cpf,
        seller_cpf: sale.seller_cpf,
        is_installment: sale.is_installment,
        installments: sale.installments
      })
      .eq('id', saleId);

    if (saleError) {
      console.error('Error updating sale:', saleError);
      return false;
    }

    // Fetch currently existing splits for this sale
    const { data: existingSplitsData, error: fetchError } = await supabase
      .from('broker_splits')
      .select('*')
      .eq('sale_id', saleId);

    if (fetchError) {
      console.error('Error fetching existing splits during update:', fetchError);
      return false;
    }

    const existingSplits = existingSplitsData || [];

    // Helper to identify if a split is paid or has any payment history
    const isPaidOrHasPayment = (s: any) => {
      return s.status === 'PAID' || 
             (s.payment_date !== null && s.payment_date !== undefined && s.payment_date !== '') ||
             (s.payment_method !== null && s.payment_method !== undefined && s.payment_method !== '') ||
             (s.receipt_data !== null && s.receipt_data !== undefined && s.receipt_data !== '');
    };

    // Deletar todos os splits não pagos desta venda
    const unpaidIds = existingSplits
      .filter(s => !isPaidOrHasPayment(s))
      .map(s => s.id);

    if (unpaidIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('broker_splits')
        .delete()
        .in('id', unpaidIds);

      if (deleteError) {
        console.error('Error deleting unpaid splits:', deleteError);
        return false;
      }
    }

    // Inserir todos os novos splits
    const splitsToInsert = splits.map(s => ({
      sale_id: saleId,
      broker_id: (s.brokerId === 'AGENCY' || !s.brokerId) ? null : s.brokerId,
      broker_name: s.brokerName,
      percentage: s.percentage,
      calculated_value: s.calculatedValue,
      status: s.status || 'PENDING',
      role: mapUiRoleToDbRole(s.role || ''),
      forecast_date: s.forecastDate || null,
      installment_number: s.installment_number ?? 1,
      total_installments: s.total_installments ?? 1,
      payment_date: s.paymentDate || null,
      payment_method: s.paymentMethod || null,
      receipt_data: s.receiptData || null
    }));

    if (splitsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('broker_splits')
        .insert(splitsToInsert);

      if (insertError) {
        console.error('Error inserting new splits:', insertError);
        return false;
      }
    }

    return true;
  },

  async deleteSale(saleId: string): Promise<{ error: any }> {
    if (!supabase) return { error: new Error('Supabase not initialized') };
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);
    return { error };
  },

  // Update commission status
  async updateSplitStatus(
    splitId: string, 
    status: CommissionStatus, 
    paymentData?: { date?: string, method?: string, receipt?: string }
  ): Promise<boolean> {
    if (!supabase) return false;

    const updateData: any = { status };
    if (paymentData) {
      if (paymentData.date) updateData.payment_date = paymentData.date;
      if (paymentData.method) updateData.payment_method = paymentData.method;
      if (paymentData.receipt) updateData.receipt_data = paymentData.receipt;
    }

    const { error } = await supabase
      .from('broker_splits')
      .update(updateData)
      .eq('id', splitId);

    if (error) {
      console.error('Error updating split status:', error);
      return false;
    }
    return true;
  },

  // Update forecast date
  async updateForecastDate(splitId: string, forecastDate: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('broker_splits')
      .update({ forecast_date: forecastDate })
      .eq('id', splitId);

    if (error) {
      console.error('Error updating forecast date:', error);
      return false;
    }
    return true;
  },

  // Financial Methods
  async getFinancialAccounts(): Promise<FinancialAccount[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('financial_accounts').select('*').eq('is_active', true);
    if (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
    return data;
  },

  async getFinancialCategories(): Promise<FinancialCategory[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('financial_categories').select('*');
    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
    return data;
  },

  async getFinancialTransactions(filters?: { accountId?: string, startDate?: string, endDate?: string }): Promise<FinancialTransaction[]> {
    if (!supabase) return [];
    let query = supabase.from('financial_transactions').select('*').order('due_date', { ascending: false });
    
    if (filters?.accountId) query = query.eq('account_id', filters.accountId);
    if (filters?.startDate) query = query.gte('due_date', filters.startDate);
    if (filters?.endDate) query = query.lte('due_date', filters.endDate);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
    return data;
  },

  async createFinancialTransaction(transaction: Omit<FinancialTransaction, 'id' | 'created_at'>): Promise<FinancialTransaction | null> {
    if (!supabase) return null;
    const { financial_account_id, ...rest } = transaction as any;
    const payload = {
      ...rest,
      account_id: transaction.account_id || financial_account_id || null
    };
    const { data, error } = await supabase.from('financial_transactions').insert(payload).select().single();
    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
    return data;
  },

  async updateTransactionStatus(transactionId: string, status: TransactionStatus, paymentDate?: string): Promise<boolean> {
    if (!supabase) return false;
    const updateData: any = { status };
    if (paymentDate) {
      updateData.payment_date = paymentDate;
    } else if (status === TransactionStatus.PAID) {
      updateData.payment_date = new Date().toISOString().split('T')[0];
    } else if (status === TransactionStatus.PENDING) {
      updateData.payment_date = null;
    }

    const { error } = await supabase.from('financial_transactions').update(updateData).eq('id', transactionId);
    if (error) {
      console.error('Error updating transaction status:', error);
      return false;
    }
    return true;
  },

  async createFinancialAccount(account: FinancialAccountInsert): Promise<FinancialAccount | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('financial_accounts').insert(account).select().single();
    if (error) {
      console.error('Error creating account:', error);
      return null;
    }
    return data;
  },

  async createFinancialCategory(category: Omit<FinancialCategory, 'id'>): Promise<FinancialCategory | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('financial_categories').insert(category).select().single();
    if (error) {
      console.error('Error creating category:', error);
      return null;
    }
    return data;
  },

  async updateAccountBalance(accountId: string, newBalance: number): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('financial_accounts').update({ current_balance: newBalance }).eq('id', accountId);
    if (error) {
      console.error('Error updating account balance:', error);
      return false;
    }
    return true;
  },

  async updateFinancialAccount(accountId: string, updates: any): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('financial_accounts').update(updates).eq('id', accountId);
    if (error) {
      console.error('Error updating financial account:', error);
      return false;
    }
    return true;
  },

  async deleteFinancialAccount(accountId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('financial_accounts').update({ is_active: false }).eq('id', accountId);
    if (error) {
      console.error('Error deleting financial account:', error);
      return false;
    }
    return true;
  },

  async deletePendingReconciliationItems(): Promise<boolean> {
    if (!supabase) return false;
    const agencyId = '11111111-1111-1111-1111-111111111111';
    const { error } = await supabase
      .from('financial_reconciliations')
      .delete()
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING');
    if (error) {
      console.error('deletePendingReconciliationItems:', error);
      return false;
    }
    return true;
  },

  // Buscar entradas do extrato de um corretor
  async getBrokerEntries(agencyId: string, brokerId: string): Promise<BrokerEntry[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('broker_entries')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('broker_id', brokerId)
      .order('date', { ascending: false });
    if (error) {
      console.error('Error fetching broker entries:', error);
      return [];
    }
    return data || [];
  },

  // Criar nova entrada manual
  async createBrokerEntry(entry: Omit<BrokerEntry, 'id' | 'created_at'>): Promise<BrokerEntry | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('broker_entries')
      .insert([{ ...entry, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) {
      console.error('Error creating broker entry:', error);
      return null;
    }
    return data;
  },

  // Deletar entrada
  async deleteBrokerEntry(id: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('broker_entries')
      .delete()
      .eq('id', id);
    return !error;
  },

  // Salvar itens do extrato importado
  async saveReconciliationItems(
    items: Array<{
      statement_date: string;
      description: string;
      amount: number;
      type: string;
      external_id?: string;
      account_id?: string;
    }>
  ): Promise<boolean> {
    if (!supabase) return false;
    const agencyId = '11111111-1111-1111-1111-111111111111';
    const rows = items.map(item => ({
      agency_id: agencyId,
      account_id: item.account_id || null,
      statement_date: item.statement_date,
      description: item.description,
      amount: item.amount,
      type: item.type,
      external_id: item.external_id || null,
      status: 'PENDING',
    }));
    // upsert por agency_id + external_id para evitar duplicar FITID
    const { error } = await supabase
      .from('financial_reconciliations')
      .upsert(rows, { onConflict: 'agency_id,external_id', ignoreDuplicates: true });
    if (error) { console.error('saveReconciliationItems:', error); return false; }
    return true;
  },

  // Buscar itens pendentes de conciliação
  async getReconciliationItems(): Promise<any[]> {
    if (!supabase) return [];
    const agencyId = '11111111-1111-1111-1111-111111111111';
    const { data, error } = await supabase
      .from('financial_reconciliations')
      .select('*')
      .eq('agency_id', agencyId)
      .neq('status', 'IGNORED')
      .order('statement_date', { ascending: false });
    if (error) { console.error('getReconciliationItems:', error); return []; }
    return (data || []).map(r => ({
      id: r.id,
      date: r.statement_date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      external_id: r.external_id,
      matched: r.status === 'MATCHED',
      matchedTxId: r.matched_transaction_id,
      status: r.status,
    }));
  },

  // Marcar item como conciliado
  async matchReconciliationItem(
    reconciliationId: string,
    transactionId: string
  ): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('financial_reconciliations')
      .update({
        matched_transaction_id: transactionId,
        status: 'MATCHED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reconciliationId);
    if (error) { console.error('matchReconciliationItem:', error); return false; }
    return true;
  },

  // Conciliar itens em lote (vários itens de uma vez)
  async matchReconciliationItemsBatch(
    pairs: Array<{ reconciliationId: string; transactionId: string; date: string }>
  ): Promise<boolean> {
    if (!supabase) return false;
    try {
      for (const pair of pairs) {
        // Atualiza o item de reconciliação
        const { error: recError } = await supabase
          .from('financial_reconciliations')
          .update({
            matched_transaction_id: pair.transactionId,
            status: 'MATCHED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pair.reconciliationId);
        
        if (recError) {
          console.error('matchReconciliationItemsBatch - reconciliations:', recError);
        }

        // Atualiza o lançamento financeiro correspondente para LIQUIDADO (PAID) e data do pagamento
        const { error: txError } = await supabase
          .from('financial_transactions')
          .update({
            status: 'PAID',
            payment_date: pair.date,
          })
          .eq('id', pair.transactionId);

        if (txError) {
          console.error('matchReconciliationItemsBatch - transactions:', txError);
        }
      }
      return true;
    } catch (err) {
      console.error('matchReconciliationItemsBatch error:', err);
      return false;
    }
  },

  // Marcar item como ignorado
  async ignoreReconciliationItem(reconciliationId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('financial_reconciliations')
      .update({ status: 'IGNORED', updated_at: new Date().toISOString() })
      .eq('id', reconciliationId);
    if (error) { console.error('ignoreReconciliationItem:', error); return false; }
    return true;
  },

  // Seed default data into Supabase if empty
  async seedDefaultData(): Promise<{ success: boolean; message: string }> {
    if (!supabase) return { success: false, message: 'Supabase client is not initialized.' };

    try {
      // 1. Seed Users
      const usersToInsert = [
        { id: 'admin-1', name: 'Williangyn (Administrador)', email: 'williangyn10@gmail.com', role: 'ADMIN', agency_id: 'agency-1', phone: '62999999999' },
        { id: 'broker-1', name: 'Ana Silva (Corretor)', email: 'ana.silva@comissone.com.br', role: 'BROKER', agency_id: 'agency-1', phone: '62988888888' },
        { id: 'broker-2', name: 'Carlos Oliveira (Corretor)', email: 'carlos.oliveira@comissone.com.br', role: 'BROKER', agency_id: 'agency-1', phone: '62977777777' }
      ];

      // Insert users. We use upsert to prevent unique constraint failures.
      const { error: userError } = await supabase.from('users').upsert(usersToInsert);
      if (userError) console.warn('User seeding note:', userError.message);

      // 2. Seed Financial Accounts
      const accountsToInsert = [
        { id: 'acc-1', agency_id: 'agency-1', bank_name: 'Banco do Brasil', account_type: 'Checking', account_number: '12345-6', current_balance: 50000.00, is_active: true },
        { id: 'acc-2', agency_id: 'agency-1', bank_name: 'Caixa Econômica', account_type: 'Savings', account_number: '98765-4', current_balance: 120000.00, is_active: true },
        { id: 'acc-3', agency_id: 'agency-1', bank_name: 'Itaú Unibanco', account_type: 'Checking', account_number: '55443-2', current_balance: 8500.00, is_active: true }
      ];
      await supabase.from('financial_accounts').upsert(accountsToInsert);

      // 3. Seed Financial Categories
      const categoriesToInsert = [
        { id: 'cat-1', agency_id: 'agency-1', name: 'Comissão Imobiliária', type: 'INCOME', color: '#10b981' },
        { id: 'cat-2', agency_id: 'agency-1', name: 'Aluguel Comercial', type: 'INCOME', color: '#34d399' },
         { id: 'cat-3', agency_id: 'agency-1', name: 'Salários e Prolabore', type: 'EXPENSE', color: '#f43f5e' },
        { id: 'cat-4', agency_id: 'agency-1', name: 'Marketing e Tráfego pago', type: 'EXPENSE', color: '#ec4899' },
        { id: 'cat-5', agency_id: 'agency-1', name: 'Manutenção / Infraestrutura', type: 'EXPENSE', color: '#f59e0b' }
      ];
      await supabase.from('financial_categories').upsert(categoriesToInsert);

      // 4. Seed Financial Transactions
      const transactionsToInsert = [
        { id: 'tx-1', agency_id: 'agency-1', description: 'Comissão Venda Loteamento Sol', amount: 35000, type: 'INCOME', category_id: 'cat-1', account_id: 'acc-1', status: 'PAID', due_date: '2026-04-10', payment_date: '2026-04-10' },
        { id: 'tx-2', agency_id: 'agency-1', description: 'Serviços Marketing Abril', amount: 4800, type: 'EXPENSE', category_id: 'cat-4', account_id: 'acc-2', status: 'PAID', due_date: '2026-04-15', payment_date: '2026-04-15' },
        { id: 'tx-a1', agency_id: 'agency-1', description: 'Comissão Venda Apt 402 Ed. Royal', amount: 18500, type: 'INCOME', category_id: 'cat-1', account_id: 'acc-1', status: 'PENDING', due_date: '2026-04-28' },
        { id: 'tx-3', agency_id: 'agency-1', description: 'Aluguel Sede Comercial', amount: 6200, type: 'EXPENSE', category_id: 'cat-5', account_id: 'acc-1', status: 'PENDING', due_date: new Date().toISOString().split('T')[0] },
        { id: 'tx-4', agency_id: 'agency-1', description: 'Plataformas SaaS e Licenças', amount: 1250, type: 'EXPENSE', category_id: 'cat-5', account_id: 'acc-3', status: 'PENDING', due_date: '2026-04-20' },
        { id: 'tx-5', agency_id: 'agency-1', description: 'Prolabore Sócios Integrados', amount: 15000, type: 'EXPENSE', category_id: 'cat-3', account_id: 'acc-3', status: 'PENDING', due_date: '2026-04-05' }
      ];
      await supabase.from('financial_transactions').upsert(transactionsToInsert);

      // 5. Seed Sales
      const salesToInsert = [
        {
          id: 'sale-1',
          agency_id: 'agency-1',
          sale_date: '2026-05-10',
          property_address: 'Av. T-10, Ed. Metropolitan, Ap 1502',
          buyer_name: 'Marcos Souza',
          seller_name: 'Roberto Alves',
          vgv: 850000,
          commission_percentage: 5,
          total_commission_value: 42500,
          invoice_issued: true,
          invoice_number: '00124',
          notes: 'Venda de apartamento de alto padrão no Setor Bueno.',
          status: 'APPROVED'
        },
        {
          id: 'sale-2',
          agency_id: 'agency-1',
          sale_date: '2026-06-01',
          property_address: 'Rua 145, Qd 52, Casa 04, Setor Marista',
          buyer_name: 'Julia Pinheiro',
          seller_name: 'Flavio Mendes',
          vgv: 1200000,
          commission_percentage: 6,
          total_commission_value: 72000,
          invoice_issued: false,
          notes: 'Casa duplex, excelente localização.',
          status: 'APPROVED'
        }
      ];
      const { error: saleSeedError } = await supabase.from('sales').upsert(salesToInsert);
      if (saleSeedError) console.warn('Sales seeding note:', saleSeedError.message);

      // 6. Seed Broker Splits
      const splitsToInsert = [
        {
          id: 'split-1',
          sale_id: 'sale-1',
          broker_id: 'broker-1',
          broker_name: 'Ana Silva',
          percentage: 40,
          calculated_value: 17000,
          status: 'PAID',
          role: 'BROKER',
          payment_date: '2026-05-15',
          payment_method: 'PIX',
          forecast_date: '2026-05-15'
        },
        {
          id: 'split-2',
          sale_id: 'sale-1',
          broker_id: 'broker-2',
          broker_name: 'Carlos Oliveira',
          percentage: 40,
          calculated_value: 17000,
          status: 'PENDING',
          role: 'BROKER',
          forecast_date: '2026-06-30'
        },
        {
          id: 'split-3',
          sale_id: 'sale-2',
          broker_id: 'broker-1',
          broker_name: 'Ana Silva',
          percentage: 50,
          calculated_value: 36000,
          status: 'PENDING',
          role: 'BROKER',
          forecast_date: '2026-07-15'
        }
      ];
      const { error: splitSeedError } = await supabase.from('broker_splits').upsert(splitsToInsert);
      if (splitSeedError) console.warn('Splits seeding note:', splitSeedError.message);

      return { success: true, message: 'Dados padrão inseridos com sucesso no Supabase!' };
    } catch (e: any) {
      console.error('Falha geral no semeador do Supabase:', e);
      return { success: false, message: e.message || 'Falha ao semear banco.' };
    }
  }
};
