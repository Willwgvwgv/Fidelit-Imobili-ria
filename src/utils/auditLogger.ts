import { supabase } from '../../supabase';

export interface AuditLogPayload {
  action: string;
  table_name?: string;
  record_id?: string | null;
  // Compatibilidade com entity_type / entity_id legados:
  entity_type?: string;
  entity_id?: string | null;
  agency_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  changed_fields?: string[] | null;
  ip_address?: string | null;
  user_agent?: string | null;
  // Objeto legado details (será mesclado em new_data caso new_data não seja fornecido)
  details?: Record<string, any> | null;
}

// Regex to test if a string is a standard UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

/**
 * Insere um registro estruturado na tabela audit_log do Supabase.
 * Usa as colunas reais do schema: action, table_name, record_id, agency_id,
 * user_id, user_email, old_data, new_data, changed_fields, user_agent, ip_address.
 */
export async function logAuditEvent(params: AuditLogPayload): Promise<boolean> {
  if (!supabase) {
    console.warn('[AUDIT_LOG] Supabase não inicializado, pulando registro de auditoria.');
    return false;
  }

  try {
    const {
      action,
      table_name,
      entity_type,
      record_id,
      entity_id,
      user_id,
      agency_id,
      user_email,
      old_data,
      new_data,
      changed_fields,
      ip_address,
      user_agent,
      details
    } = params;

    const finalTableName = table_name || entity_type || 'unknown';
    const finalRecordId = record_id !== undefined ? record_id : (entity_id !== undefined ? entity_id : null);

    // Constrói new_data preservando dados legados de details caso new_data não tenha sido informado
    let finalNewData: Record<string, any> | null = new_data ? { ...new_data } : null;
    if (!finalNewData && details) {
      finalNewData = { ...details };
    }

    // Determina changed_fields automaticamente caso não tenha sido passado
    let finalChangedFields: string[] = [];
    if (Array.isArray(changed_fields)) {
      finalChangedFields = changed_fields;
    } else if (finalNewData && old_data) {
      const allKeys = new Set([...Object.keys(old_data), ...Object.keys(finalNewData)]);
      finalChangedFields = Array.from(allKeys).filter(
        key => JSON.stringify(old_data[key]) !== JSON.stringify(finalNewData![key])
      );
    } else if (finalNewData) {
      finalChangedFields = Object.keys(finalNewData);
    }

    // Se o user_email não foi passado explicitamente, tenta pegar do session atual
    let finalUserEmail = user_email || null;
    let finalUserId = isValidUUID(user_id) ? user_id : null;

    if (!finalUserId || !finalUserEmail) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user;
        if (sessionUser) {
          if (!finalUserId && isValidUUID(sessionUser.id)) {
            finalUserId = sessionUser.id;
          }
          if (!finalUserEmail && sessionUser.email) {
            finalUserEmail = sessionUser.email;
          }
        }
      } catch {
        // Ignora erro ao obter sessão
      }
    }

    const browserUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    // Prepara o payload usando ESTRITAMENTE as colunas reais da tabela audit_log
    const dbPayload: Record<string, any> = {
      action,
      table_name: finalTableName,
      record_id: finalRecordId !== null && finalRecordId !== undefined ? String(finalRecordId) : null,
      agency_id: agency_id !== null && agency_id !== undefined ? String(agency_id) : null,
      user_id: finalUserId,
      user_email: finalUserEmail,
      old_data: old_data || null,
      new_data: finalNewData || null,
      changed_fields: finalChangedFields,
      ip_address: ip_address || null,
      user_agent: user_agent || browserUserAgent
    };

    const { error } = await supabase
      .from('audit_log')
      .insert([dbPayload]);

    if (error) {
      console.error('[AUDIT_LOG_ERROR] Falha ao registrar log de auditoria no Supabase:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payloadSent: dbPayload
      });
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[AUDIT_LOG_EXCEPTION] Exceção inesperada ao gravar audit_log:', {
      message: err?.message || err,
      stack: err?.stack,
      params
    });
    return false;
  }
}

