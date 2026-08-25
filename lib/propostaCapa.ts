import { getSupabaseClient } from './supabaseClient';
import { compressImage } from './reportMedia';

/**
 * Imagem opcional da capa da Proposta Técnico-Comercial.
 *
 * Reaproveita o bucket privado `report-media` (mesma lógica das fotos dos
 * relatórios), sob o prefixo `propostas/`. Guardamos apenas o storage_path na
 * proposta (JSONB); na hora de gerar o PDF, buscamos os bytes por URL assinada
 * e entregamos ao @react-pdf/renderer como DATA URI — assim o renderer não
 * precisa fazer fetch cross-origin (evita problemas de CORS no iframe do PDFViewer).
 */

const BUCKET = 'report-media';

export function propostaCapaPath(pedidoId: string): string {
  const year = new Date().getFullYear();
  return `propostas/${pedidoId || 'sem-pedido'}/${year}/capa_${Date.now()}.jpg`;
}

/** Comprime (capa: dimensão/qualidade maiores que fotos de relatório) e sobe. Retorna o storage_path. */
export async function uploadPropostaCapa(file: Blob, pedidoId: string): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const compressed = await compressImage(file, 2000, 0.85);
  const path = propostaCapaPath(pedidoId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: false, contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

/** Busca a imagem da capa e devolve como data URI (pronta para o <Image> do react-pdf). */
export async function propostaCapaDataUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  const resp = await fetch(data.signedUrl as string);
  const blob = await resp.blob();
  return await blobToDataUrl(blob);
}

/** Remove a imagem da capa do Storage (best-effort). */
export async function removePropostaCapa(path: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Lê as dimensões de uma imagem no cliente (para recomendar landscape e avisar
 * sobre baixa resolução antes de fixar na capa).
 */
export function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
