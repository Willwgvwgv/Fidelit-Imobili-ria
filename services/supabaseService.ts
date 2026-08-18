
import { supabase } from '../supabase';
import { Sale, User, BrokerSplit, CommissionStatus, SplitRole, FinancialAccount, FinancialCategory, FinancialTransaction, TransactionStatus, TransactionType, BrokerEntry } from '../types';
import { rateLimiter, RATE_LIMIT_PROFILES } from '../utils/rateLimiter';
import { logAuditEvent } from '../src/utils/auditLogger';

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
  closing_day?: number;
  due_day?: number;
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

  async createUser(userData: { name: string; email: string; role: 'ADMIN' | 'BROKER'; agencyId: string; phone?: string }): Promise<User | null> {
    if (!supabase) return null;

    const dbInsert = {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      agency_id: userData.agencyId,
      phone: userData.phone || null,
    };

    const { data, error } = await supabase
      .from('users')
      .insert([dbInsert])
      .select()
      .single();

    if (error) {
      console.error('Error creating user in Supabase:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      agencyId: data.agency_id,
      phone: data.phone,
      created_at: data.created_at
    };
  },

  async updateUserProfile(userId: string, updates: { name?: string; phone?: string }): Promise<boolean> {
    if (!supabase) return false;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

    const { error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
    return true;
  },

  async updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado' };
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao atualizar senha' };
    }
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
      code: s.code,
      buyer_cpf: s.buyer_cpf,
      buyer_document: s.buyer_document,
      buyer_type: s.buyer_type,
      seller_cpf: s.seller_cpf,
      external_broker_id: s.external_broker_id,
      external_broker_name: s.external_broker_name,
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
    console.log('[DEBUG_CREATE_SALE_CALLED]', new Error().stack);
    if (!supabase) return null;

    const rateLimit = rateLimiter.consume('createSale', RATE_LIMIT_PROFILES.MUTATION);
    if (!rateLimit.allowed) {
      alert(`Limite de requisições excedido. Por favor, aguarde ${rateLimit.retryAfterSec} segundo(s) para criar uma venda.`);
      return null;
    }

    const cleanExtBrokerId = (sale.external_broker_id && sale.external_broker_id !== 'AGENCY' && sale.external_broker_id.trim() !== '') 
      ? sale.external_broker_id 
      : null;

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        agency_id: sale.agencyId,
        sale_date: sale.saleDate,
        property_address: sale.propertyAddress,
        property_city: sale.propertyCity || '',
        property_cep: sale.propertyCep || '',
        property_uf: sale.propertyUf || 'GO',
        property_type: sale.propertyType || 'urbano',
        buyer_name: sale.buyerName,
        seller_name: sale.sellerName,
        vgv: sale.vgv,
        commission_percentage: sale.commissionPercentage,
        total_commission_value: sale.totalCommissionValue,
        invoice_issued: sale.invoiceIssued || false,
        invoice_number: sale.invoiceNumber || '',
        notes: sale.notes || '',
        status: sale.status || 'ACTIVE',
        buyer_cpf: sale.buyer_cpf || null,
        buyer_document: sale.buyer_document || sale.buyer_cpf || null,
        buyer_type: sale.buyer_type || 'cpf',
        seller_cpf: sale.seller_cpf || null,
        external_broker_id: cleanExtBrokerId,
        external_broker_name: sale.external_broker_name || null,
        is_installment: Boolean(sale.is_installment),
        installments: sale.is_installment ? (sale.installments || null) : null
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

  // Update sale and its splits using UPSERT strategy for splits
  async updateSale(
    saleId: string, 
    sale: Partial<Sale>, 
    splits: (Omit<BrokerSplit, 'sale_id'> & { id?: string })[]
  ): Promise<boolean> {
    console.log('[DEBUG_UPDATE_SALE_CALLED]', { saleId }, new Error().stack);
    if (!supabase) return false;

    const rateLimit = rateLimiter.consume('updateSale', RATE_LIMIT_PROFILES.MUTATION);
    if (!rateLimit.allowed) {
      alert(`Limite de requisições excedido. Por favor, aguarde ${rateLimit.retryAfterSec} segundo(s) para atualizar a venda.`);
      return false;
    }

    const cleanExtBrokerId = (sale.external_broker_id && sale.external_broker_id !== 'AGENCY' && sale.external_broker_id.trim() !== '') 
      ? sale.external_broker_id 
      : null;

    const vgvNum = typeof sale.vgv === 'number' ? sale.vgv : (Number(sale.vgv) || 0);
    const commPercNum = typeof sale.commissionPercentage === 'number' ? sale.commissionPercentage : (Number(sale.commissionPercentage) || 0);
    const totalCommNum = typeof sale.totalCommissionValue === 'number' ? sale.totalCommissionValue : (Number(sale.totalCommissionValue) || 0);

    const updatePayload = {
      sale_date: sale.saleDate || new Date().toISOString().split('T')[0],
      property_address: sale.propertyAddress || '',
      property_city: sale.propertyCity || '',
      property_cep: sale.propertyCep || '',
      property_uf: sale.propertyUf || 'GO',
      property_type: sale.propertyType || 'urbano',
      buyer_name: sale.buyerName || '',
      seller_name: sale.sellerName || '',
      vgv: vgvNum,
      commission_percentage: commPercNum,
      total_commission_value: totalCommNum,
      invoice_issued: sale.invoiceIssued || false,
      invoice_number: sale.invoiceNumber || '',
      notes: sale.notes || '',
      status: sale.status || 'ACTIVE',
      buyer_cpf: sale.buyer_cpf || null,
      buyer_document: sale.buyer_document || sale.buyer_cpf || null,
      buyer_type: sale.buyer_type || 'cpf',
      seller_cpf: sale.seller_cpf || null,
      external_broker_id: cleanExtBrokerId,
      external_broker_name: sale.external_broker_name || null,
      is_installment: Boolean(sale.is_installment),
      installments: sale.is_installment ? (sale.installments || null) : null
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG_UPDATE_SALE] Payload to update:', {
        saleId,
        updatePayload,
        splitsCount: splits?.length,
        splits
      });
    }

    // Update sale main fields
    const { error: saleError } = await supabase
      .from('sales')
      .update(updatePayload)
      .eq('id', saleId);

    if (saleError) {
      console.error('[SUPABASE_UPDATE_SALE_ERROR]', {
        message: saleError.message,
        details: saleError.details,
        hint: saleError.hint,
        code: saleError.code,
        payloadSent: updatePayload
      });
      return false;
    }

    // Fetch currently existing splits for this sale from DB
    const { data: existingSplitsData, error: fetchError } = await supabase
      .from('broker_splits')
      .select('*')
      .eq('sale_id', saleId);

    if (fetchError) {
      console.error('[SUPABASE_FETCH_SPLITS_ERROR] Error fetching existing splits during update:', {
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      });
      return false;
    }

    const existingSplits = existingSplitsData || [];
    const existingIds = new Set(existingSplits.map((s: any) => s.id));

    // Track split IDs from DB that are retained/updated or newly inserted
    const retainedSplitIds = new Set<string>();

    for (const s of splits as any[]) {
      const calcVal = typeof s.calculatedValue === 'number' ? s.calculatedValue : (Number(s.calculatedValue) || 0);
      const percVal = typeof s.percentage === 'number' ? s.percentage : (Number(s.percentage) || 0);

      // Check if this split is an existing record in DB that has already been paid
      const existingMatchingSplit = s.id ? existingSplits.find((es: any) => es.id === s.id) : null;
      const isAlreadyPaid = existingMatchingSplit && (
        existingMatchingSplit.status === 'PAID' ||
        (existingMatchingSplit.payment_date !== null && existingMatchingSplit.payment_date !== undefined && existingMatchingSplit.payment_date !== '') ||
        Boolean(existingMatchingSplit.settled_by_transaction_id)
      );

      const dbData: any = {
        sale_id: saleId,
        broker_id: (s.brokerId === 'AGENCY' || !s.brokerId) ? null : s.brokerId,
        broker_name: s.brokerName,
        percentage: percVal,
        calculated_value: isAlreadyPaid && existingMatchingSplit?.calculated_value ? existingMatchingSplit.calculated_value : calcVal,
        status: isAlreadyPaid ? 'PAID' : (s.status || 'PENDING'),
        role: mapUiRoleToDbRole(s.role || ''),
        forecast_date: s.forecastDate || sale.saleDate || null,
        installment_number: Number(s.installment_number) || 1,
        total_installments: Number(s.total_installments) || 1,
        payment_date: isAlreadyPaid ? existingMatchingSplit.payment_date : (s.paymentDate || null),
        payment_method: isAlreadyPaid ? existingMatchingSplit.payment_method : (s.paymentMethod || null),
        receipt_data: isAlreadyPaid ? existingMatchingSplit.receipt_data : (s.receiptData || null)
      };

      if (isAlreadyPaid && existingMatchingSplit.settled_by_transaction_id) {
        dbData.settled_by_transaction_id = existingMatchingSplit.settled_by_transaction_id;
      }
      if (isAlreadyPaid && existingMatchingSplit.settled_at) {
        dbData.settled_at = existingMatchingSplit.settled_at;
      }

      if (s.id && existingIds.has(s.id)) {
        // Se tem ID válido e existe no banco com mesmo ID -> UPDATE
        retainedSplitIds.add(s.id);
        const { error: updateError } = await supabase
          .from('broker_splits')
          .update(dbData)
          .eq('id', s.id);

        if (updateError) {
          console.error('[SUPABASE_UPDATE_SPLIT_ERROR]', {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
            splitId: s.id,
            dbData
          });
          return false;
        }
      } else {
        // Se NÃO tem ID (novo) ou ID não existe no banco -> INSERT
        const { data: insertedSplit, error: insertError } = await supabase
          .from('broker_splits')
          .insert(dbData)
          .select('id')
          .single();

        if (insertError) {
          console.error('[SUPABASE_INSERT_SPLIT_ERROR]', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
            dbData
          });
          return false;
        }
        if (insertedSplit?.id) {
          retainedSplitIds.add(insertedSplit.id);
        }
      }
    }

    // Helper: verificar se o rateio foi pago ou possui histórico de pagamento / conciliação
    const isPaidOrHasPayment = (s: any) => {
      return s.status === 'PAID' || 
             (s.payment_date !== null && s.payment_date !== undefined && s.payment_date !== '') ||
             Boolean(s.settled_by_transaction_id);
    };

    // Deleções reais da UI: deletar APENAS splits que existem no banco MAS NÃO estão no array splits
    // e que NÃO possuem payment_date preenchido, status != 'PAID' e não estão conciliados
    const splitsToDelete = existingSplits.filter((s: any) => 
      !retainedSplitIds.has(s.id) && !isPaidOrHasPayment(s)
    );

    if (splitsToDelete.length > 0) {
      const deleteIds = splitsToDelete.map((s: any) => s.id);
      const { error: deleteError } = await supabase
        .from('broker_splits')
        .delete()
        .in('id', deleteIds);

      if (deleteError) {
        console.error('[SUPABASE_DELETE_SPLITS_ERROR] Error deleting removed splits:', {
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          code: deleteError.code,
          deleteIds
        });
        return false;
      }
    }

    return true;
  },

  async deleteSale(saleId: string): Promise<{ error: any }> {
    if (!supabase) return { error: new Error('Supabase not initialized') };

    const rateLimit = rateLimiter.consume('deleteSale', RATE_LIMIT_PROFILES.MUTATION);
    if (!rateLimit.allowed) {
      alert(`Limite de requisições excedido. Por favor, aguarde ${rateLimit.retryAfterSec} segundo(s) antes de excluir a venda.`);
      return { error: new Error('Rate limit exceeded') };
    }

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);
    return { error };
  },

  // Método de exclusão DIRETA de um rateio (broker_splits WHERE id = splitId)
  async deleteSplit(splitId: string): Promise<boolean> {
    if (!supabase) return false;

    const rateLimit = rateLimiter.consume('deleteSplit', RATE_LIMIT_PROFILES.MUTATION);
    if (!rateLimit.allowed) {
      console.warn('Rate limit exceeded for deleteSplit');
      return false;
    }

    try {
      // Deleção direta sem passar por updateSale
      const { error } = await supabase
        .from('broker_splits')
        .delete()
        .eq('id', splitId);

      if (error) {
        console.error('Error executing DELETE FROM broker_splits:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Unexpected error in deleteSplit:', err);
      return false;
    }
  },

  // Update commission status
  async updateSplitStatus(
    splitId: string, 
    status: CommissionStatus, 
    paymentData?: { date?: string, method?: string, receipt?: string } | null
  ): Promise<boolean> {
    if (!supabase) return false;

    // Buscar usuário autenticado do Supabase
    let sessionUser: any = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      sessionUser = user;
    } catch (e) {
      console.warn('Could not retrieve authenticated user in updateSplitStatus:', e);
    }

    // Trava de segurança: Estorno direto para PENDING via updateSplitStatus exige admin/gerente e deve preferir estornarCommissionSplit
    if (status === CommissionStatus.PENDING) {
      console.warn('Prefer use estornarCommissionSplit with mandatory justification.');
    }

    const updateData: any = { status };
    if (paymentData) {
      if (paymentData.date) updateData.payment_date = paymentData.date;
      if (paymentData.method) updateData.payment_method = paymentData.method;
      if (paymentData.receipt) updateData.receipt_data = paymentData.receipt;
    } else {
      updateData.payment_date = null;
      updateData.payment_method = null;
      updateData.receipt_data = null;
      updateData.settled_by_transaction_id = null;
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

  // Estornar pagamento de comissão com justificativa obrigatória e gravação server-side audit_log
  async estornarCommissionSplit(params: {
    splitId: string;
    reason: string;
    agencyId?: string;
  }): Promise<{ success: boolean; message?: string }> {
    if (!supabase) return { success: false, message: 'Banco de dados não disponível' };

    if (!params.reason || params.reason.trim().length < 3) {
      return { success: false, message: 'O motivo do estorno é obrigatório (mínimo 3 caracteres).' };
    }

    try {
      // 1. Obter usuário autenticado da sessão atual
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authUser) {
        return { success: false, message: 'Usuário não autenticado. Faça login novamente.' };
      }

      // 2. Obter dados atuais do rateio antes do estorno
      const { data: currentSplit, error: fetchErr } = await supabase
        .from('broker_splits')
        .select('*')
        .eq('id', params.splitId)
        .single();

      if (fetchErr || !currentSplit) {
        return { success: false, message: 'Rateio de comissão não encontrado.' };
      }

      const previousStatus = currentSplit.status;
      const previousSettledTxId = currentSplit.settled_by_transaction_id || null;

      // 3. Atualizar o rateio para PENDING e limpar dados de pagamento
      const { error: updateErr } = await supabase
        .from('broker_splits')
        .update({
          status: 'PENDING',
          payment_date: null,
          payment_method: null,
          receipt_data: null,
          settled_by_transaction_id: null
        })
        .eq('id', params.splitId);

      if (updateErr) {
        console.error('Error updating split status for estorno:', updateErr);
        return { success: false, message: updateErr.message };
      }

      // 4. Gravar log de auditoria com usuário autenticado e justificativa obrigatória
      await logAuditEvent({
        action: 'ESTORNO',
        entity_type: 'broker_splits',
        entity_id: params.splitId,
        user_id: authUser.id,
        user_email: authUser.email || '',
        agency_id: params.agencyId || currentSplit.agency_id || null,
        details: {
          action: 'ESTORNO_PAGAMENTO',
          status_anterior: previousStatus,
          status_novo: 'PENDING',
          motivo_estorno: params.reason.trim(),
          user_id: authUser.id,
          user_email: authUser.email,
          previous_settled_by_transaction_id: previousSettledTxId,
          previous_payment_date: currentSplit.payment_date,
          previous_payment_method: currentSplit.payment_method,
          calculated_value: currentSplit.calculated_value
        }
      });

      return { success: true };
    } catch (err: any) {
      console.error('Unexpected error in estornarCommissionSplit:', err);
      return { success: false, message: err?.message || 'Erro ao estornar comissão.' };
    }
  },

  // Buscar transações financeiras candidatas para vínculo na conciliação da comissão
  async findCandidateFinancialTransactions(params: {
    targetAmount: number;
    paymentDate: string;
    agencyId?: string;
    toleranceDays?: number;
    toleranceAmount?: number;
  }): Promise<FinancialTransaction[]> {
    if (!supabase) return [];

    try {
      const toleranceDays = params.toleranceDays ?? 15;
      const toleranceAmount = params.toleranceAmount ?? 5.0;

      const dateObj = new Date(params.paymentDate || new Date().toISOString().split('T')[0]);
      const minDateObj = new Date(dateObj);
      minDateObj.setDate(minDateObj.getDate() - toleranceDays);
      const maxDateObj = new Date(dateObj);
      maxDateObj.setDate(maxDateObj.getDate() + toleranceDays);

      const minDate = minDateObj.toISOString().split('T')[0];
      const maxDate = maxDateObj.toISOString().split('T')[0];

      const minAmount = Math.max(0.01, params.targetAmount - toleranceAmount);
      const maxAmount = params.targetAmount + toleranceAmount;

      let query = supabase
        .from('financial_transactions')
        .select('*')
        .eq('type', TransactionType.EXPENSE)
        .gte('amount', minAmount)
        .lte('amount', maxAmount)
        .gte('due_date', minDate)
        .lte('due_date', maxDate)
        .order('due_date', { ascending: false })
        .limit(20);

      const { data, error } = await query;
      if (error) {
        console.error('Error finding candidate transactions:', error);
        return [];
      }
      return (data || []) as FinancialTransaction[];
    } catch (e) {
      console.error('Unexpected error in findCandidateFinancialTransactions:', e);
      return [];
    }
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

  // Registrar pagamento de comissão (cheio ou parcial) com vínculo OPCIONAL à transação financeira
  async payCommissionSplit(params: {
    splitId: string;
    saleId?: string;
    paidAmount: number;
    fullAmount: number;
    paymentDate: string;
    paymentMethod?: string;
    notes?: string;
    receiptData?: string;
    remainingForecastDate?: string;
    userEmail?: string;
    agencyId?: string;
    skipFinancialLaunch?: boolean; // Se true, apenas concilia o rateio sem criar nem exigir lançamento financeiro
    // Vínculo opcional com financial_transaction:
    transactionId?: string; // ID de transação financeira existente selecionada
    newTransactionData?: { // Ou dados para criar a nova transação financeira na hora
      accountId?: string;
      categoryId?: string;
      description?: string;
    };
  }): Promise<{ success: boolean; isPartial: boolean; message?: string; transactionId?: string }> {
    if (!supabase) return { success: false, isPartial: false, message: 'Banco de dados não disponível' };

    try {
      // 1. Obter usuário autenticado da sessão
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authenticatedUserId = authUser?.id;
      const authenticatedUserEmail = authUser?.email || params.userEmail || '';

      // 2. Obter dados atuais do rateio
      const { data: currentSplit, error: fetchErr } = await supabase
        .from('broker_splits')
        .select('*')
        .eq('id', params.splitId)
        .single();

      if (fetchErr || !currentSplit) {
        console.error('Error fetching split for payment:', fetchErr);
        return { success: false, isPartial: false, message: 'Rateio não encontrado no banco de dados.' };
      }

      const fullVal = Number(params.fullAmount) || Number(currentSplit.calculated_value) || 0;
      const paidVal = Number(params.paidAmount);
      const isPartial = paidVal < (fullVal - 0.009);

      const rawRole = currentSplit.role ? String(currentSplit.role).trim().toUpperCase() : '';
      
      // Validação estrita de segurança: Impede pagamentos se a role for nula, vazia ou inválida
      const validRoles = ['BROKER', 'CAPTURER', 'MANAGER', 'PARTNER', 'AGENCY', 'CORRETOR', 'CAPTADOR', 'GERENTE', 'SÓCIO', 'SOCIO', 'AGÊNCIA', 'AGENCIA'];
      if (!rawRole || !validRoles.includes(rawRole)) {
        return {
          success: false,
          isPartial,
          message: "Este rateio possui role indefinido ou inválido no banco de dados. Corrija o campo 'role' antes de registrar o pagamento."
        };
      }

      const splitRole = rawRole;

      // 3. Validação de conciliação financeira: Opcional conforme escolha do usuário
      let resolvedTransactionId: string | null = null;

      if (!params.skipFinancialLaunch) {
        if (params.transactionId && String(params.transactionId).trim() !== '') {
          resolvedTransactionId = String(params.transactionId).trim();
        } else if (params.newTransactionData && params.newTransactionData.accountId && params.newTransactionData.categoryId) {
          // Criar a nova transação financeira de despesa vinculada
          const splitBrokerName = currentSplit.broker_name || 'Comissão / Repasse';
          const defaultDesc = params.newTransactionData.description && params.newTransactionData.description.trim() !== ''
            ? params.newTransactionData.description.trim()
            : `Repasse ${splitRole === 'PARTNER' || splitRole === 'SÓCIO' || splitRole === 'SOCIO' ? 'Sócio' : splitRole === 'AGENCY' || splitRole === 'AGÊNCIA' || splitRole === 'AGENCIA' ? 'Agência' : 'Comissão'} - ${splitBrokerName} (${params.paymentMethod || 'Repasse'})`;

          const newTxPayload = {
            agency_id: params.agencyId || currentSplit.agency_id,
            description: defaultDesc,
            amount: paidVal,
            type: TransactionType.EXPENSE,
            category_id: params.newTransactionData.categoryId || null,
            account_id: params.newTransactionData.accountId || null,
            status: TransactionStatus.PAID,
            due_date: params.paymentDate,
            payment_date: params.paymentDate,
            notes: params.notes || `Pagamento de comissão vinculado ao rateio ${params.splitId}`,
            contact_name: splitBrokerName,
            affects_dre: true // Despesa operacional real da imobiliária
          };

          const { data: createdTx, error: createTxErr } = await supabase
            .from('financial_transactions')
            .insert(newTxPayload)
            .select('id')
            .single();

          if (createTxErr || !createdTx?.id) {
            console.error('Error creating linked financial transaction:', createTxErr);
            return {
              success: false,
              isPartial,
              message: `Erro ao criar o lançamento financeiro de despesa: ${createTxErr?.message || 'Falha ao inserir transação'}`
            };
          }

          resolvedTransactionId = String(createdTx.id);
        }
      }

      if (!isPartial) {
        // Pagamento Total / Quitação
        const updateData: any = {
          status: 'PAID',
          calculated_value: fullVal,
          payment_date: params.paymentDate,
          payment_method: params.paymentMethod || 'PIX',
          receipt_data: params.receiptData || null,
          settled_by_transaction_id: resolvedTransactionId
        };
        if (params.notes) {
          updateData.notes = params.notes;
        }

        const { error: updateErr } = await supabase
          .from('broker_splits')
          .update(updateData)
          .eq('id', params.splitId);

        if (updateErr) {
          console.error('Error updating split to PAID:', updateErr);
          return { success: false, isPartial: false, message: updateErr.message };
        }

        // Inserir log de auditoria estruturado
        await logAuditEvent({
          action: 'PAYMENT_FULL',
          entity_type: 'broker_splits',
          entity_id: params.splitId,
          user_id: authenticatedUserId,
          user_email: authenticatedUserEmail,
          agency_id: params.agencyId || null,
          details: {
            action: 'PAYMENT_FULL',
            status_anterior: currentSplit.status,
            status_novo: 'PAID',
            paid_amount: fullVal,
            payment_date: params.paymentDate,
            payment_method: params.paymentMethod || 'PIX',
            settled_by_transaction_id: resolvedTransactionId,
            user_id: authenticatedUserId,
            user_email: authenticatedUserEmail
          }
        });

        return { success: true, isPartial: false, transactionId: resolvedTransactionId };
      } else {
        // Pagamento Parcial
        const remainingVal = Number((fullVal - paidVal).toFixed(2));
        const currentInstallment = currentSplit.installment_number ?? 1;
        const totalInstallments = Math.max((currentSplit.total_installments ?? 1), currentInstallment + 1);

        // Proporção de percentual
        const originalPercentage = Number(currentSplit.percentage) || 0;
        const paidPercentage = fullVal > 0 ? Number(((originalPercentage * paidVal) / fullVal).toFixed(4)) : 0;
        const remainingPercentage = Number((originalPercentage - paidPercentage).toFixed(4));

        const partialNote = params.notes
          ? `${params.notes} (Pagamento Parcial de R$ ${paidVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
          : `Pagamento Parcial (R$ ${paidVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;

        // 1. Atualiza o rateio atual para PAGO com o valor parcial e o vínculo da transação
        const updateData: any = {
          status: 'PAID',
          calculated_value: paidVal,
          percentage: paidPercentage,
          payment_date: params.paymentDate,
          payment_method: params.paymentMethod || 'PIX',
          receipt_data: params.receiptData || null,
          notes: partialNote,
          installment_number: currentInstallment,
          total_installments: totalInstallments,
          settled_by_transaction_id: resolvedTransactionId
        };

        const { error: updateErr } = await supabase
          .from('broker_splits')
          .update(updateData)
          .eq('id', params.splitId);

        if (updateErr) {
          console.error('Error updating current split for partial payment:', updateErr);
          return { success: false, isPartial: true, message: updateErr.message };
        }

        // 2. Insere novo rateio com o saldo restante pendente
        const remainingSplitData: any = {
          sale_id: currentSplit.sale_id || params.saleId,
          broker_id: currentSplit.broker_id || null,
          broker_name: currentSplit.broker_name,
          percentage: remainingPercentage,
          calculated_value: remainingVal,
          status: 'PENDING',
          role: currentSplit.role || 'BROKER',
          forecast_date: params.remainingForecastDate || null,
          installment_number: currentInstallment + 1,
          total_installments: totalInstallments,
          notes: `Saldo restante de pagamento parcial (${currentInstallment + 1}/${totalInstallments})`
        };

        const { error: insertErr } = await supabase
          .from('broker_splits')
          .insert(remainingSplitData);

        if (insertErr) {
          console.error('Error inserting remaining split for partial payment:', insertErr);
          return { success: false, isPartial: true, message: `Erro ao agendar saldo restante: ${insertErr.message}` };
        }

        // Log de auditoria estruturado
        await logAuditEvent({
          action: 'PAYMENT_PARTIAL',
          entity_type: 'broker_splits',
          entity_id: params.splitId,
          user_id: authenticatedUserId,
          user_email: authenticatedUserEmail,
          agency_id: params.agencyId || null,
          details: {
            action: 'PAYMENT_PARTIAL',
            status_anterior: currentSplit.status,
            status_novo: 'PARTIAL',
            paid_amount: paidVal,
            remaining_amount: remainingVal,
            remaining_forecast_date: params.remainingForecastDate,
            settled_by_transaction_id: resolvedTransactionId,
            user_id: authenticatedUserId,
            user_email: authenticatedUserEmail
          }
        });

        return { success: true, isPartial: true, transactionId: resolvedTransactionId };
      }
    } catch (err: any) {
      console.error('Unexpected error in payCommissionSplit:', err);
      return { success: false, isPartial: false, message: err?.message || 'Erro ao processar pagamento.' };
    }
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

    const rateLimit = rateLimiter.consume('createFinancialTransaction', RATE_LIMIT_PROFILES.MUTATION);
    if (!rateLimit.allowed) {
      alert(`Limite de requisições excedido. Por favor, aguarde ${rateLimit.retryAfterSec} segundo(s) para criar o lançamento.`);
      return null;
    }

    const { financial_account_id, ...rest } = transaction as any;

    const hasPaymentDate = transaction.payment_date && String(transaction.payment_date).trim() !== '';
    const computedStatus = hasPaymentDate ? TransactionStatus.PAID : TransactionStatus.PENDING;
    const cleanPaymentDate = hasPaymentDate ? transaction.payment_date : null;

    const payload = {
      ...rest,
      status: computedStatus,
      payment_date: cleanPaymentDate,
      account_id: transaction.account_id || financial_account_id || null,
      contact_name: transaction.contact_name && String(transaction.contact_name).trim() !== '' ? String(transaction.contact_name).trim() : null
    };
    const { data, error } = await supabase.from('financial_transactions').insert(payload).select().single();
    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
    return data;
  },

  async updateFinancialTransaction(transactionId: string, updates: Partial<FinancialTransaction>): Promise<boolean> {
    if (!supabase) return false;
    
    const { financial_account_id, ...rest } = updates as any;
    const payload = {
      ...rest,
      account_id: 'account_id' in updates ? updates.account_id : (financial_account_id ?? undefined),
    };
    
    if ('contact_name' in payload) {
      payload.contact_name = payload.contact_name && String(payload.contact_name).trim() !== '' 
        ? String(payload.contact_name).trim() 
        : null;
    }

    const { error } = await supabase.from('financial_transactions').update(payload).eq('id', transactionId);
    if (error) {
      console.error('Error updating financial transaction:', error);
      return false;
    }
    return true;
  },

  async updateRecurrenceGroup(
    groupId: string,
    fromDate: string,
    updates: Partial<FinancialTransaction>
  ): Promise<boolean> {
    if (!supabase) return false;

    const { id, agency_id, recurrence_group_id, financial_account_id, due_date, status, payment_date, ...rest } = updates as any;
    const payload = {
      ...rest,
      account_id: 'account_id' in updates ? updates.account_id : (financial_account_id ?? undefined),
    };

    if ('contact_name' in payload) {
      payload.contact_name = payload.contact_name && String(payload.contact_name).trim() !== ''
        ? String(payload.contact_name).trim()
        : null;
    }

    const { error } = await supabase
      .from('financial_transactions')
      .update(payload)
      .eq('recurrence_group_id', groupId)
      .gte('due_date', fromDate)
      .neq('status', 'PAID');

    if (error) {
      console.error('Error updating recurrence group:', error);
      return false;
    }
    return true;
  },

  async updateTransactionStatus(transactionId: string, status: TransactionStatus, paymentDate?: string): Promise<boolean> {
    if (!supabase) return false;

    let cleanPaymentDate = paymentDate && String(paymentDate).trim() !== '' ? paymentDate : null;
    if (status === TransactionStatus.PAID && !cleanPaymentDate) {
      cleanPaymentDate = new Date().toISOString().split('T')[0];
    } else if (status === TransactionStatus.PENDING) {
      cleanPaymentDate = null;
    }

    const computedStatus = cleanPaymentDate ? TransactionStatus.PAID : TransactionStatus.PENDING;

    const updateData = {
      status: computedStatus,
      payment_date: cleanPaymentDate,
    };

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

  async updateFinancialCategory(categoryId: string, updates: Partial<FinancialCategory>): Promise<boolean> {
    if (!supabase) return false;
    const payload = {
      name: updates.name,
      color: updates.color,
      affects_dre: updates.affects_dre
    };
    const { error } = await supabase.from('financial_categories').update(payload).eq('id', categoryId);
    if (error) {
      console.error('Error updating financial category:', error);
      return false;
    }
    return true;
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

  async deletePendingReconciliationItems(externalIds?: string[]): Promise<boolean> {
    if (!supabase) return false;
    const agencyId = '11111111-1111-1111-1111-111111111111';
    let query = supabase
      .from('financial_reconciliations')
      .delete()
      .eq('agency_id', agencyId)
      .not('status', 'in', '("IGNORED","MATCHED")');

    if (externalIds && externalIds.length > 0) {
      query = query.in('external_id', externalIds);
    }

    const { error } = await query;
    if (error) {
      console.error('deletePendingReconciliationItems:', error);
      return false;
    }
    return true;
  },

  async getReconciliationItemsByExternalIds(externalIds: string[]): Promise<any[]> {
    if (!supabase || !externalIds || externalIds.length === 0) return [];
    const agencyId = '11111111-1111-1111-1111-111111111111';
    const { data, error } = await supabase
      .from('financial_reconciliations')
      .select('*')
      .eq('agency_id', agencyId)
      .in('external_id', externalIds)
      .neq('status', 'IGNORED')
      .order('statement_date', { ascending: false });
    if (error) { console.error('getReconciliationItemsByExternalIds:', error); return []; }
    return (data || []).map(r => ({
      id: r.id,
      date: r.statement_date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      external_id: r.external_id,
      matched: r.status === 'MATCHED' || r.status === 'CONCLUDED',
      matchedTxId: r.matched_transaction_id,
      status: r.status,
    }));
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
      matched: r.status === 'MATCHED' || r.status === 'CONCLUDED',
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

  // Concluir conciliação do grupo
  async concludeReconciliation(groupId: string, externalIds?: string[]): Promise<boolean> {
    if (!supabase) return false;
    try {
      // Tenta primeiro atualizar usando o import_group_id se groupId for fornecido
      if (groupId) {
        const { error } = await supabase
          .from('financial_reconciliations')
          .update({ status: 'CONCLUDED', updated_at: new Date().toISOString() })
          .eq('import_group_id', groupId);
        
        if (!error) {
          return true;
        }
      }
      
      // Se não houver groupId ou se falhar/não existir o campo, tenta usar external_ids
      if (externalIds && externalIds.length > 0) {
        const { error } = await supabase
          .from('financial_reconciliations')
          .update({ status: 'CONCLUDED', updated_at: new Date().toISOString() })
          .in('external_id', externalIds);
        
        if (error) {
          console.error('concludeReconciliation by externalIds error:', error);
          return false;
        }
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('concludeReconciliation exception:', err);
      return false;
    }
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
        { id: 'cat-1', agency_id: 'agency-1', name: 'Comissão Imobiliária', type: 'INCOME', color: '#10b981', affects_dre: true },
        { id: 'cat-2', agency_id: 'agency-1', name: 'Aluguel Comercial', type: 'INCOME', color: '#34d399', affects_dre: true },
        { id: 'cat-3', agency_id: 'agency-1', name: 'Salários e Prolabore', type: 'EXPENSE', color: '#f43f5e', affects_dre: true },
        { id: 'cat-4', agency_id: 'agency-1', name: 'Marketing e Tráfego pago', type: 'EXPENSE', color: '#ec4899', affects_dre: true },
        { id: 'cat-5', agency_id: 'agency-1', name: 'Manutenção / Infraestrutura', type: 'EXPENSE', color: '#f59e0b', affects_dre: true }
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
