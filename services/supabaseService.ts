
import { supabase } from '../supabase';
import { Sale, User, BrokerSplit, CommissionStatus, SplitRole, FinancialAccount, FinancialCategory, FinancialTransaction, TransactionStatus } from '../types';

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
        role: split.role as SplitRole,
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
      broker_id: split.brokerId,
      broker_name: split.brokerName,
      percentage: split.percentage,
      calculated_value: split.calculatedValue,
      status: split.status,
      role: split.role,
      payment_date: split.paymentDate,
      payment_method: split.paymentMethod,
      forecast_date: split.forecastDate,
      receipt_data: split.receiptData,
      installment_number: split.installment_number,
      total_installments: split.total_installments,
      notes: split.notes,
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
    const { data, error } = await supabase.from('financial_transactions').insert(transaction).select().single();
    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
    return data;
  },

  async updateTransactionStatus(transactionId: string, status: TransactionStatus, paymentDate?: string): Promise<boolean> {
    if (!supabase) return false;
    const updateData: any = { status };
    if (paymentDate) updateData.payment_date = paymentDate;
    if (status === TransactionStatus.PAID && !paymentDate) updateData.payment_date = new Date().toISOString();

    const { error } = await supabase.from('financial_transactions').update(updateData).eq('id', transactionId);
    if (error) {
      console.error('Error updating transaction status:', error);
      return false;
    }
    return true;
  },

  async createFinancialAccount(account: Omit<FinancialAccount, 'id'>): Promise<FinancialAccount | null> {
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
