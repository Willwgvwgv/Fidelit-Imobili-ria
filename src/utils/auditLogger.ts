import { supabase } from '../../supabase';

export interface AuditLogPayload {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  user_id?: string | null;
  agency_id?: string | null;
  user_email?: string | null;
  details?: Record<string, any> | null;
}

// Regex to test if a string is a standard UUID v4/v1/v5
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

/**
 * Insere um registro estruturado na tabela audit_log do Supabase.
 * Trata incompatibilidades de schema (ex: colunas UUID vs string, campos JSON)
 * e exibe logs de erro detalhados no console com a mensagem real do banco de dados.
 */
export async function logAuditEvent(params: AuditLogPayload): Promise<boolean> {
  if (!supabase) {
    console.warn('[AUDIT_LOG] Supabase não inicializado, pulando registro de auditoria.');
    return false;
  }

  try {
    const {
      action,
      entity_type,
      entity_id,
      user_id,
      agency_id,
      user_email,
      details = {}
    } = params;

    // Constrói objeto details consolidado para manter histórico completo sem quebrar o schema
    const enrichedDetails = {
      ...(details || {}),
      ...(user_email ? { user_email } : {}),
      ...(user_id && !isValidUUID(user_id) ? { raw_user_id: user_id } : {}),
      ...(agency_id && !isValidUUID(agency_id) ? { raw_agency_id: agency_id } : {}),
      ...(entity_id && !isValidUUID(entity_id) ? { raw_entity_id: entity_id } : {}),
      logged_at: new Date().toISOString()
    };

    // Prepara o payload com os tipos esperados pelo banco
    const dbPayload: Record<string, any> = {
      action,
      entity_type,
      // Se a coluna for UUID no banco, passa null se não for UUID válido, preservando no details
      entity_id: entity_id || null,
      user_id: isValidUUID(user_id) ? user_id : null,
      agency_id: isValidUUID(agency_id) ? agency_id : (agency_id || null),
      details: enrichedDetails
    };

    const { data, error } = await supabase
      .from('audit_log')
      .insert([dbPayload])
      .select();

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
