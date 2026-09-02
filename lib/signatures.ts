import { getSupabaseClient } from './supabaseClient';
import { ReportSignature } from './types';

const BUCKET = 'report-media';

/* ---- Registro transitório de assinaturas (como o de fotos) ---- */
export interface CapturedSignature {
  blob: Blob;
  previewUrl: string;
  nome: string;
  documento?: string;
  cargo?: string;
  papel: ReportSignature['papel'];
}
const sigRegistry = new Map<string, CapturedSignature>();

export function registerSignature(blob: Blob, meta: Omit<CapturedSignature, 'blob' | 'previewUrl'>): string {
  const id = `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  sigRegistry.set(id, { blob, previewUrl: URL.createObjectURL(blob), ...meta });
  return id;
}
export function getSignature(id: string): CapturedSignature | undefined {
  return sigRegistry.get(id);
}
export function isSignatureId(v: unknown): v is string {
  return typeof v === 'string' && sigRegistry.has(v);
}
export function forgetSignature(id: string): void {
  const s = sigRegistry.get(id);
  if (s) {
    URL.revokeObjectURL(s.previewUrl);
    sigRegistry.delete(id);
  }
}
/** Revoga todas as object URLs e limpa o registro (chamar ao encerrar o form). */
export function clearSignatureRegistry(): void {
  sigRegistry.forEach((s) => URL.revokeObjectURL(s.previewUrl));
  sigRegistry.clear();
}

/** Sobe o PNG da assinatura ao Storage privado. Retorna o storage_path. */
export async function uploadSignaturePng(
  reportId: string,
  blob: Blob,
  papel: string,
  seq: number | string
): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const path = `signatures/${reportId}/${papel}_${seq}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/png' });
  if (error) throw error;
  return path;
}

/* ---- Persistência em report_signatures ---- */
function rowToSignature(r: any): ReportSignature {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    papel: (r.papel || 'cliente') as ReportSignature['papel'],
    nome: r.nome || '',
    documento: r.documento ?? undefined,
    cargo: r.cargo ?? undefined,
    storagePath: r.storage_path ?? undefined,
    assinadoEm: r.assinado_em ?? undefined,
    geo: r.geo ?? undefined,
  };
}

export async function fetchSignatures(reportId: string): Promise<ReportSignature[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('report_signatures').select('*').eq('report_id', reportId);
  if (error) throw error;
  return (data || []).map(rowToSignature);
}

export async function insertSignature(s: ReportSignature): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {
    report_id: s.reportId,
    papel: s.papel,
    nome: s.nome,
    documento: s.documento ?? null,
    cargo: s.cargo ?? null,
    storage_path: s.storagePath ?? null,
    geo: s.geo ?? null,
  };
  if (s.id) row.id = s.id;
  const { error } = await supabase.from('report_signatures').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}
