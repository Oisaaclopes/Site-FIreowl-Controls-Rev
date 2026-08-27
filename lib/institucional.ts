import { getSupabaseClient } from './supabaseClient';

/**
 * Logos institucionais (identidade da Fireowl, empresas atendidas, marcas).
 *
 * O @react-pdf/renderer NÃO renderiza SVG em <Image> (testado: gera página
 * vazia). Por isso rasterizamos qualquer upload (SVG ou PNG/JPG) para PNG
 * transparente em alta resolução no cliente, e guardamos apenas o storage_path
 * no bucket privado `report-media` (prefixo institucional/). Na geração do PDF,
 * resolvemos como data URI (reaproveitando propostaCapaDataUrl) — sem CORS.
 */

const BUCKET = 'report-media';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.src = src;
  });
}

/**
 * Rasteriza para PNG transparente. SVG é ampliado para `maxDim` (nitidez de
 * impressão); raster grande é reduzido para `maxDim`. Preserva a proporção.
 */
export async function rasterizeLogoToPng(file: Blob, maxDim = 1000): Promise<Blob> {
  if (typeof document === 'undefined') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    const isSvg = file.type === 'image/svg+xml';
    if (!w || !h) { w = maxDim; h = maxDim; } // SVG sem dimensões intrínsecas
    const maior = Math.max(w, h);
    // SVG: amplia até maxDim; raster: só reduz se passar de maxDim.
    if (maior !== maxDim && (isSvg || maior > maxDim)) {
      const scale = maxDim / maior;
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.clearRect(0, 0, w, h); // fundo transparente
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    return blob || file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Rasteriza e sobe um logo institucional. Retorna o storage_path. */
export async function uploadInstitucionalLogo(file: Blob, slug: string): Promise<string> {
  const supabase = getSupabaseClient() as any;
  const png = await rasterizeLogoToPng(file);
  const year = new Date().getFullYear();
  const safe = (slug || 'logo').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  const path = `institucional/${year}/${safe}_${Date.now()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, png, { upsert: false, contentType: 'image/png' });
  if (error) throw error;
  return path;
}

/** Remove um logo do Storage (best-effort). */
export async function removeInstitucionalLogo(path: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
