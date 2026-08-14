import { getSupabaseClient } from './supabaseClient';

const BUCKET = 'report-media';

/* ---------------------------------------------------------------------------
 * Registro transitório de fotos capturadas (client-side). Os campos de foto e
 * a captura rápida guardam apenas um ID leve; o arquivo real fica aqui até a
 * finalização, quando é comprimido, enviado ao Storage e vira report_media.
 * ------------------------------------------------------------------------- */
interface CapturedPhoto {
  blob: Blob;
  previewUrl: string;
  tipo?: 'antes' | 'depois' | 'evidencia' | 'geral';
  /** Versão marcada (setas/círculos desenhados pelo técnico). Original é preservado. */
  markedBlob?: Blob;
  markedPreviewUrl?: string;
}
const photoRegistry = new Map<string, CapturedPhoto>();

export function registerPhoto(blob: Blob, tipo?: CapturedPhoto['tipo']): string {
  const id = `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  photoRegistry.set(id, { blob, previewUrl: URL.createObjectURL(blob), tipo });
  return id;
}
export function getCapturedPhoto(id: string): CapturedPhoto | undefined {
  return photoRegistry.get(id);
}
export function getPhotoPreview(id: string): string | undefined {
  const p = photoRegistry.get(id);
  // Mostra a versão marcada quando existir (é o que representa o apontamento).
  return p?.markedPreviewUrl || p?.previewUrl;
}
/** Grava a versão marcada de uma foto (não sobrescreve o original). */
export function setPhotoMarkup(id: string, marked: Blob): void {
  const p = photoRegistry.get(id);
  if (!p) return;
  if (p.markedPreviewUrl) URL.revokeObjectURL(p.markedPreviewUrl);
  p.markedBlob = marked;
  p.markedPreviewUrl = URL.createObjectURL(marked);
}
export function hasMarkup(id: string): boolean {
  return !!photoRegistry.get(id)?.markedBlob;
}
export function forgetPhoto(id: string): void {
  const p = photoRegistry.get(id);
  if (p) {
    URL.revokeObjectURL(p.previewUrl);
    if (p.markedPreviewUrl) URL.revokeObjectURL(p.markedPreviewUrl);
    photoRegistry.delete(id);
  }
}
/** Revoga todas as object URLs e limpa o registro (chamar ao encerrar o form). */
export function clearPhotoRegistry(): void {
  photoRegistry.forEach((p) => {
    URL.revokeObjectURL(p.previewUrl);
    if (p.markedPreviewUrl) URL.revokeObjectURL(p.markedPreviewUrl);
  });
  photoRegistry.clear();
}
/** Um valor é um ID de foto registrada nesta sessão? */
export function isPhotoId(v: unknown): v is string {
  return typeof v === 'string' && photoRegistry.has(v);
}

/**
 * Comprime a imagem no cliente antes de subir (Parte 4.2): máx. 1600px no
 * maior lado, JPEG ~0.7. Uma preventiva de shopping gera 60+ fotos.
 * Só roda no navegador (usa canvas). Se algo falhar, devolve o arquivo original.
 */
export async function compressImage(file: Blob, maxDim = 1600, quality = 0.7): Promise<Blob> {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const maior = Math.max(width, height);
    if (maior > maxDim) {
      const scale = maxDim / maior;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    return blob || file;
  } catch {
    return file;
  }
}

/** Caminho padronizado do arquivo no Storage. */
export function reportMediaPath(opts: {
  clienteId?: string;
  reportId: string;
  tipo?: string;
  seq?: number | string;
}): string {
  const year = new Date().getFullYear();
  const tipo = opts.tipo || 'evidencia';
  const seq = opts.seq ?? Date.now();
  return `reports/${opts.clienteId || 'sem-cliente'}/${year}/${opts.reportId}/${tipo}_${seq}.jpg`;
}

/**
 * Comprime e sobe uma foto do relatório. Retorna o storage_path (não é URL
 * pública — use signedReportUrl para exibir).
 */
export async function uploadReportPhoto(opts: {
  file: Blob;
  reportId: string;
  clienteId?: string;
  tipo?: string;
  seq?: number | string;
}): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const compressed = await compressImage(opts.file);
  const path = reportMediaPath(opts);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: false, contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

/** URL assinada de curta duração para exibir uma foto privada. */
export async function signedReportUrl(path: string, seconds = 3600): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl as string;
}

/** URLs assinadas em lote: retorna mapa { storage_path: signedUrl }. */
export async function signedReportUrls(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, seconds);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((d: any) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

/** É um caminho do Storage de relatórios (não um id transitório)? */
export function isStoragePath(v: unknown): v is string {
  return typeof v === 'string' && (v.startsWith('reports/') || v.startsWith('signatures/'));
}

/** Remove um arquivo do bucket (usado ao descartar rascunho). */
export async function removeReportPhoto(path: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
