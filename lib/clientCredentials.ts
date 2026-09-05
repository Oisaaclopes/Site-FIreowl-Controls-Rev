/* ===================================================================
 * ETAPA 3D — Credenciais técnicas protegidas (0096, §63–§68/§100/§110).
 * REGRA DE OURO: o SEGREDO nunca trafega em SELECT genérico. A listagem lê APENAS
 * a metadata (label/usuário/vínculo). Gravar o segredo é um write dedicado na
 * tabela isolada; revelar é uma RPC explícita (só ADMIN/GESTOR). O segredo NUNCA
 * entra em PDF, report_answers, technical_attributes, field_photos ou logs.
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import { ClientTechnicalCredential } from './types';

const META = 'client_technical_credentials';
const SECRETS = 'client_technical_credential_secrets';

function rowToCred(r: any): ClientTechnicalCredential {
  return {
    id: String(r.id),
    clienteId: r.cliente_id || '',
    deviceId: r.device_id ?? undefined,
    area: r.area ?? undefined,
    label: r.label || '',
    username: r.username ?? undefined,
    notes: r.notes ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

/** Lista SÓ metadata (sem segredo) — colunas explícitas, nunca `select('*')` que arraste segredo. */
export async function fetchCredentials(clienteId: string): Promise<ClientTechnicalCredential[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(META)
    .select('id,cliente_id,device_id,area,label,username,notes,created_by,created_at')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToCred);
}

/** Cria a metadata da credencial e, opcionalmente, grava o segredo já isolado. */
export async function createCredential(
  meta: Omit<ClientTechnicalCredential, 'id' | 'createdAt' | 'createdBy'>,
  secret?: string,
): Promise<ClientTechnicalCredential> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {
    cliente_id: meta.clienteId,
    device_id: meta.deviceId ?? null,
    area: meta.area ?? null,
    label: meta.label,
    username: meta.username ?? null,
    notes: meta.notes ?? null,
  };
  const { data, error } = await supabase.from(META).insert(row)
    .select('id,cliente_id,device_id,area,label,username,notes,created_by,created_at').single();
  if (error) throw error;
  const cred = rowToCred(data);
  if (secret && secret.trim()) await setCredentialSecret(cred.id, secret);
  return cred;
}

export async function updateCredentialMeta(
  id: string,
  patch: Partial<Pick<ClientTechnicalCredential, 'label' | 'username' | 'notes' | 'area' | 'deviceId'>>,
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.username !== undefined) row.username = patch.username ?? null;
  if (patch.notes !== undefined) row.notes = patch.notes ?? null;
  if (patch.area !== undefined) row.area = patch.area ?? null;
  if (patch.deviceId !== undefined) row.device_id = patch.deviceId ?? null;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from(META).update(row).eq('id', id);
  if (error) throw error;
}

/** Grava/atualiza o segredo na tabela isolada (write-only p/ técnico via RLS). */
export async function setCredentialSecret(credentialId: string, secret: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(SECRETS)
    .upsert({ credential_id: credentialId, secret, updated_at: new Date().toISOString() }, { onConflict: 'credential_id' });
  if (error) throw error;
}

/** Revela o segredo via RPC (só ADMIN/GESTOR; a própria função levanta erro caso contrário). */
export async function revealCredentialSecret(credentialId: string): Promise<string | null> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('reveal_technical_credential', { p_credential_id: credentialId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function deleteCredential(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  // O segredo cai por ON DELETE CASCADE.
  const { error } = await supabase.from(META).delete().eq('id', id);
  if (error) throw error;
}
