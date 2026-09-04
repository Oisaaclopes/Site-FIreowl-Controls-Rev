import { getSupabaseClient } from './supabaseClient';

export const FIELD_PHOTO_BUCKET = 'field-photos';
export type FieldPhotoAsset = 'original' | 'evidence' | 'markup';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string): string {
  if (!UUID_RE.test(value)) throw new Error(`${label} inválido para caminho de foto de campo`);
  return value.toLowerCase();
}

/** Caminho estável: a primeira pasta é sempre o usuário autenticado. */
export function buildFieldPhotoPath(input: {
  technicianId: string;
  sessionClientUuid: string;
  photoClientUuid: string;
  asset: FieldPhotoAsset;
  extension?: 'jpg' | 'jpeg' | 'png';
}): string {
  const extension = input.extension === 'png' ? 'png' : 'jpg';
  return `${requireUuid(input.technicianId, 'Técnico')}/${requireUuid(input.sessionClientUuid, 'Sessão')}/${requireUuid(input.photoClientUuid, 'Foto')}/${input.asset}.${extension}`;
}

export async function uploadFieldPhotoAsset(input: {
  path: string;
  file: Blob;
  contentType?: string;
}): Promise<string> {
  const supabase = getSupabaseClient() as any;
  // O path é determinístico. upsert torna retry idempotente e requer policy UPDATE própria.
  const { error } = await supabase.storage.from(FIELD_PHOTO_BUCKET).upload(input.path, input.file, {
    upsert: true,
    contentType: input.contentType || input.file.type || 'image/jpeg',
  });
  if (error) throw error;
  return input.path;
}

/**
 * Resolve storage_paths de fotos de campo (bucket privado) para data URIs, para
 * embutir no React-PDF (que não acessa o bucket privado por URL). Falhas
 * individuais são ignoradas. Reaproveita a assinatura de URL existente.
 */
export async function resolveFieldPhotoDataUrls(paths: (string | undefined)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter((p): p is string => !!p && p.trim().length > 0)));
  if (uniq.length === 0) return {};
  const { blobToDataUrl } = await import('./propostaCapa');
  const signed = await signedFieldPhotoUrls(uniq).catch(() => ({} as Record<string, string>));
  const out: Record<string, string> = {};
  await Promise.all(uniq.map(async (p) => {
    try {
      const url = signed[p];
      if (!url) return;
      const resp = await fetch(url);
      out[p] = await blobToDataUrl(await resp.blob());
    } catch { /* ignora esta foto */ }
  }));
  return out;
}

/** Remove assets do bucket privado (best-effort; ignora caminhos vazios). */
export async function removeFieldPhotoAssets(paths: (string | undefined)[]): Promise<void> {
  const clean = paths.filter((p): p is string => !!p && p.trim().length > 0);
  if (clean.length === 0) return;
  const supabase = getSupabaseClient() as any;
  await supabase.storage.from(FIELD_PHOTO_BUCKET).remove(clean);
}

export async function signedFieldPhotoUrl(path: string, seconds = 900): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(FIELD_PHOTO_BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl as string;
}

/** Assina vários caminhos numa única requisição (grid da galeria). Falhas isoladas viram null. */
export async function signedFieldPhotoUrls(paths: string[], seconds = 900): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(FIELD_PHOTO_BUCKET).createSignedUrls(unique, seconds);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data || []) {
    if (row?.path && row?.signedUrl && !row.error) map[row.path as string] = row.signedUrl as string;
  }
  return map;
}
