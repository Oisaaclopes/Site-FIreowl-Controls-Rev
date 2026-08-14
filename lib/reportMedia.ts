import { getSupabaseClient } from './supabaseClient';

const BUCKET = 'report-media';

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

/** Remove um arquivo do bucket (usado ao descartar rascunho). */
export async function removeReportPhoto(path: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
