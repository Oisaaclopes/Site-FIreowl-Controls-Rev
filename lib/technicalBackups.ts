/* ===================================================================
 * ETAPA 3D.EXTRA — Backups técnicos de equipamentos (0097).
 * Só ARMAZENAMENTO SEGURO + HISTÓRICO + DOWNLOAD. O arquivo original é preservado
 * EXATAMENTE como enviado: nunca interpretamos, executamos, convertemos nem
 * importamos. Bucket PRIVADO; download por signed URL (storage_path nunca vira URL
 * pública). Cada upload é uma nova versão; is_current marca a atual sem apagar as
 * anteriores.
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import { TechnicalBackup } from './types';

export const TECHNICAL_BACKUP_BUCKET = 'technical-backups';
const TABLE = 'technical_backups';

/** Aviso obrigatório exibido junto aos backups (§3D.EXTRA). */
export const BACKUP_DISCLAIMER =
  'Arquivo armazenado para recuperação técnica. O Fireowl Guardian não valida, executa ou garante compatibilidade do conteúdo.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowToBackup(r: any): TechnicalBackup {
  return {
    id: String(r.id),
    clienteId: r.cliente_id || '',
    area: r.area ?? undefined,
    deviceId: r.device_id ?? undefined,
    manufacturer: r.manufacturer ?? undefined,
    model: r.model ?? undefined,
    backupType: r.backup_type ?? undefined,
    originalFilename: r.original_filename || '',
    fileExtension: r.file_extension ?? undefined,
    mimeType: r.mime_type ?? undefined,
    fileSize: r.file_size ?? undefined,
    storagePath: r.storage_path || '',
    fileHash: r.file_hash ?? undefined,
    notes: r.notes ?? undefined,
    backupDate: r.backup_date ?? undefined,
    isCurrent: !!r.is_current,
    uploadedBy: r.uploaded_by ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

/** Chave de agrupamento de versões: mesmo cliente+equipamento (device ou fabricante/modelo). */
function groupKey(b: Pick<TechnicalBackup, 'deviceId' | 'manufacturer' | 'model' | 'area'>): string {
  if (b.deviceId) return `dev:${b.deviceId}`;
  return `mm:${(b.area || '').toLowerCase()}|${(b.manufacturer || '').toLowerCase()}|${(b.model || '').toLowerCase()}`;
}

function extractExtension(filename: string): string {
  const m = /\.([A-Za-z0-9]{1,12})$/.exec(filename.trim());
  return m ? m[1].toLowerCase() : '';
}

async function sha256Hex(file: Blob): Promise<string | undefined> {
  try {
    const subtle = (globalThis.crypto && globalThis.crypto.subtle) || undefined;
    if (!subtle) return undefined;
    const buf = await file.arrayBuffer();
    const digest = await subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return undefined; }
}

export async function fetchBackups(clienteId: string): Promise<TechnicalBackup[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToBackup);
}

/**
 * Faz upload do arquivo ORIGINAL (sem transformar) e registra a versão.
 * Marca as versões anteriores do MESMO equipamento como is_current=false, sem
 * apagá-las (histórico preservado). Retorna a linha criada.
 */
export async function uploadBackup(input: {
  clienteId: string;
  file: Blob;
  originalFilename: string;
  area?: string;
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  backupType?: string;
  notes?: string;
  backupDate?: string;
}): Promise<TechnicalBackup> {
  const supabase = getSupabaseClient() as any;
  if (!input.clienteId) throw new Error('Cliente obrigatório para backup técnico');
  if (!input.originalFilename?.trim()) throw new Error('Nome do arquivo obrigatório');

  const ext = extractExtension(input.originalFilename);
  // ID do objeto no bucket: aleatório, nunca derivado do nome (evita colisão/sobrescrita).
  const objId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const storagePath = `${input.clienteId}/${objId}${ext ? '.' + ext : ''}`;
  const fileHash = await sha256Hex(input.file);

  // Upload SEM upsert: cada versão é um objeto novo; nunca sobrescreve o anterior.
  const { error: upErr } = await supabase.storage.from(TECHNICAL_BACKUP_BUCKET).upload(storagePath, input.file, {
    upsert: false,
    contentType: input.file.type || 'application/octet-stream',
  });
  if (upErr) throw upErr;

  const meta: Pick<TechnicalBackup, 'deviceId' | 'manufacturer' | 'model' | 'area'> = {
    deviceId: input.deviceId, manufacturer: input.manufacturer, model: input.model, area: input.area,
  };

  const row: Record<string, unknown> = {
    cliente_id: input.clienteId,
    area: input.area ?? null,
    device_id: input.deviceId && UUID_RE.test(input.deviceId) ? input.deviceId : null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    backup_type: input.backupType ?? null,
    original_filename: input.originalFilename,
    file_extension: ext || null,
    mime_type: input.file.type || null,
    file_size: (input.file as any).size ?? null,
    storage_path: storagePath,
    file_hash: fileHash ?? null,
    notes: input.notes ?? null,
    backup_date: input.backupDate ?? null,
    is_current: true,
  };

  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    // rollback best-effort do objeto órfão
    await supabase.storage.from(TECHNICAL_BACKUP_BUCKET).remove([storagePath]).catch(() => {});
    throw error;
  }
  const created = rowToBackup(data);

  // Rebaixa versões anteriores do mesmo equipamento (histórico preservado).
  const siblings = (await fetchBackups(input.clienteId)).filter(
    (b) => b.id !== created.id && b.isCurrent && groupKey(b) === groupKey(meta),
  );
  if (siblings.length > 0) {
    await supabase.from(TABLE).update({ is_current: false })
      .in('id', siblings.map((b) => b.id)).catch(() => {});
  }
  return created;
}

/** Marca uma versão como atual e rebaixa as demais do mesmo equipamento. */
export async function markBackupCurrent(clienteId: string, backupId: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const all = await fetchBackups(clienteId);
  const target = all.find((b) => b.id === backupId);
  if (!target) throw new Error('Backup não encontrado');
  const key = groupKey(target);
  const siblings = all.filter((b) => b.id !== backupId && groupKey(b) === key && b.isCurrent);
  await supabase.from(TABLE).update({ is_current: true }).eq('id', backupId);
  if (siblings.length > 0) {
    await supabase.from(TABLE).update({ is_current: false }).in('id', siblings.map((b) => b.id));
  }
}

/** Gera signed URL de download (storage_path nunca é exposto como URL pública). */
export async function signedBackupUrl(storagePath: string, seconds = 300): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(TECHNICAL_BACKUP_BUCKET)
    .createSignedUrl(storagePath, seconds, { download: true });
  if (error) throw error;
  return data.signedUrl as string;
}

/** Exclusão (gestão): remove o objeto do bucket e a linha. */
export async function deleteBackup(backup: Pick<TechnicalBackup, 'id' | 'storagePath'>): Promise<void> {
  const supabase = getSupabaseClient() as any;
  await supabase.storage.from(TECHNICAL_BACKUP_BUCKET).remove([backup.storagePath]).catch(() => {});
  const { error } = await supabase.from(TABLE).delete().eq('id', backup.id);
  if (error) throw error;
}
