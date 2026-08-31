import { getSupabaseClient } from './supabaseClient';
import type { GalleryPhoto } from './fieldPhotosGallery';

/* =====================================================================
 * Comparações Antes × Depois (Fase 3.2 — Passada 2).
 * Uma comparação é uma RELAÇÃO entre duas field_photos existentes — nunca
 * duplica imagem, path ou metadata. As field_photos continuam a fonte de
 * verdade. Regras puras (mesmo cliente, dedup A+B==B+A, contexto, ordenação)
 * ficam isoladas para teste. Requer a migração 0067.
 * ===================================================================== */

export type ComparisonResult = 'corrigido' | 'parcial' | 'pendente';
export const RESULT_LABEL: Record<ComparisonResult, string> = {
  corrigido: 'Corrigido', parcial: 'Parcialmente corrigido', pendente: 'Pendente',
};

export interface FieldPhotoComparison {
  id: string;
  beforePhotoId: string;
  afterPhotoId: string;
  clientId: string;
  reportId?: string;
  osId?: string;
  pendenciaId?: string;
  titulo?: string;
  descricao?: string;
  resultado?: ComparisonResult;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------- helpers puros ------------------------------- */

export type PairPhoto = Pick<GalleryPhoto, 'id' | 'clientId' | 'source' | 'osId' | 'reportId' | 'pendenciaId'>;

export type PairInvalid = 'quantidade' | 'iguais' | 'cliente' | 'sync';

/** Valida se duas fotos podem formar uma comparação (regras §5/§21/§27). */
export function validateComparisonPair(photos: PairPhoto[]): { ok: boolean; reason?: PairInvalid } {
  if (photos.length !== 2) return { ok: false, reason: 'quantidade' };
  const [a, b] = photos;
  if (a.id === b.id) return { ok: false, reason: 'iguais' };
  if (a.clientId !== b.clientId) return { ok: false, reason: 'cliente' }; // hard rule §27
  // Comparação persistente exige as duas fotos sincronizadas (têm id no banco, §21).
  if (a.source !== 'remote' || b.source !== 'remote') return { ok: false, reason: 'sync' };
  return { ok: true };
}

export const PAIR_INVALID_MESSAGE: Record<PairInvalid, string> = {
  quantidade: 'Selecione exatamente 2 fotos para comparar.',
  iguais: 'Selecione duas fotos diferentes.',
  cliente: 'A comparação deve conter fotos do mesmo cliente.',
  sync: 'Sincronize as duas fotos antes de criar a comparação.',
};

const same = (x?: string, y?: string) => (x && y && x === y ? x : undefined);

/** Contexto operacional herdado só quando AMBAS compartilham (§28). */
export function sharedContext(before: PairPhoto, after: PairPhoto): { osId?: string; reportId?: string; pendenciaId?: string } {
  return {
    osId: same(before.osId, after.osId),
    reportId: same(before.reportId, after.reportId),
    pendenciaId: same(before.pendenciaId, after.pendenciaId),
  };
}

/** Chave não-ordenada da dupla: A+B e B+A são a mesma comparação (§20). */
export function pairKey(id1: string, id2: string): string {
  return [id1, id2].sort().join('|');
}

export function hasDuplicate(existing: Pick<FieldPhotoComparison, 'beforePhotoId' | 'afterPhotoId'>[], beforeId: string, afterId: string): boolean {
  const key = pairKey(beforeId, afterId);
  return existing.some((c) => pairKey(c.beforePhotoId, c.afterPhotoId) === key);
}

/** Monta a linha da comparação a partir das fotos e da escolha de qual é "antes". */
export function buildComparison(
  a: PairPhoto, b: PairPhoto, beforeIsA: boolean,
  extra: { titulo?: string; descricao?: string; resultado?: ComparisonResult } = {},
): Omit<FieldPhotoComparison, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {
  const before = beforeIsA ? a : b;
  const after = beforeIsA ? b : a;
  const ctx = sharedContext(before, after);
  return {
    beforePhotoId: before.id,
    afterPhotoId: after.id,
    clientId: before.clientId,
    osId: ctx.osId,
    reportId: ctx.reportId,
    pendenciaId: ctx.pendenciaId,
    titulo: extra.titulo?.trim() || undefined,
    descricao: extra.descricao?.trim() || undefined,
    resultado: extra.resultado,
  };
}

export function sortComparisons<T extends { createdAt?: string }>(list: T[]): T[] {
  return [...list].sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
}

/** Comparação já resolvida contra as fotos carregadas (antes/depois presentes). */
export interface ResolvedComparison { comparison: FieldPhotoComparison; before: GalleryPhoto; after: GalleryPhoto }

/** Junta as comparações às fotos já carregadas; descarta as que não têm as duas acessíveis. */
export function resolveComparisons(list: FieldPhotoComparison[], photoById: Map<string, GalleryPhoto>): ResolvedComparison[] {
  const out: ResolvedComparison[] = [];
  for (const c of list) {
    const before = photoById.get(c.beforePhotoId);
    const after = photoById.get(c.afterPhotoId);
    if (before && after) out.push({ comparison: c, before, after });
  }
  return out;
}

/* --------------------------------- data layer --------------------------------- */

function rowToComparison(r: any): FieldPhotoComparison {
  return {
    id: String(r.id),
    beforePhotoId: String(r.before_photo_id),
    afterPhotoId: String(r.after_photo_id),
    clientId: String(r.client_id),
    reportId: r.report_id ?? undefined,
    osId: r.os_id ?? undefined,
    pendenciaId: r.pendencia_id ?? undefined,
    titulo: r.titulo ?? undefined,
    descricao: r.descricao ?? undefined,
    resultado: (r.resultado ?? undefined) as ComparisonResult | undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function toRow(c: Partial<FieldPhotoComparison>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.beforePhotoId !== undefined) row.before_photo_id = c.beforePhotoId;
  if (c.afterPhotoId !== undefined) row.after_photo_id = c.afterPhotoId;
  if (c.clientId !== undefined) row.client_id = c.clientId;
  if ('osId' in c) row.os_id = c.osId ?? null;
  if ('reportId' in c) row.report_id = c.reportId ?? null;
  if ('pendenciaId' in c) row.pendencia_id = c.pendenciaId ?? null;
  if ('titulo' in c) row.titulo = c.titulo ?? null;
  if ('descricao' in c) row.descricao = c.descricao ?? null;
  if ('resultado' in c) row.resultado = c.resultado ?? null;
  return row;
}

export async function listComparisons(): Promise<FieldPhotoComparison[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('field_photo_comparisons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToComparison);
}

export async function createComparison(input: Omit<FieldPhotoComparison, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<FieldPhotoComparison> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('field_photo_comparisons').insert(toRow(input)).select().single();
  if (error) throw error;
  return rowToComparison(data);
}

export async function updateComparison(id: string, patch: Partial<FieldPhotoComparison>): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('field_photo_comparisons').update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Remove SOMENTE o vínculo — as fotos permanecem (§19). */
export async function deleteComparison(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('field_photo_comparisons').delete().eq('id', id);
  if (error) throw error;
}
