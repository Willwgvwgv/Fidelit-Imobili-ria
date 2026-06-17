
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
  }
};
