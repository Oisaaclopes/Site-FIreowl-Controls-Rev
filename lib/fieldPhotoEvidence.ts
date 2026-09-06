import { evidenceLines, FieldPhoto, FieldPhotoSession } from './fieldPhotos';
import { gpsLabel } from './fieldPhotoGeo';

export const EVIDENCE_HAS_FIREOWL_LOGO = true;
async function loadLogo():Promise<ImageBitmap|undefined>{try{const r=await fetch('/icons/icon-192.png');if(!r.ok)return;return await createImageBitmap(await r.blob());}catch{return undefined}}

export interface EvidenceLayout { font: number; padding: number; overlayHeight: number; }
/**
 * Layout PROPORCIONAL (§8.6) — tudo derivado de min(width,height), nunca de
 * coordenadas mágicas de uma resolução. Funciona em portrait e landscape. A
 * altura do overlay reserva a ZONA da logo (cabeçalho) + as linhas de texto,
 * limitada a 34% da altura para não engolir a foto.
 */
export const evidenceLayout = (width: number, height: number, lineCount: number): EvidenceLayout => {
  const unit = Math.max(12, Math.min(width, height) * 0.032);
  // 5.6 unidades de base (padding + cabeçalho da logo + timestamp + cliente) +
  // ~1.15 por linha adicional (detalhe/local/técnico), no máx. 3.
  return { font: unit, padding: Math.round(unit * 0.9), overlayHeight: Math.min(Math.round(height * 0.34), Math.round(unit * (5.6 + Math.min(lineCount, 3) * 1.15))) };
};

/** Rótulo de MODO a partir do CONTEXTO já conhecido da captura (§8.5) — nunca
 *  inventa: só usa dados presentes na foto. */
function modeLabel(photo: Pick<FieldPhoto, 'marcador' | 'evidenceMoment' | 'deviceId' | 'technicalSurveyId'>): string | undefined {
  const m = photo.evidenceMoment;
  if (m === 'ANTES') return 'ANTES';
  if (m === 'DURANTE') return 'DURANTE';
  if (m === 'DEPOIS') return 'DEPOIS';
  if (m === 'CENTRAL_ANTES') return 'CENTRAL · ANTES';
  if (m === 'CENTRAL_DEPOIS') return 'CENTRAL · DEPOIS';
  if (photo.marcador) return photo.marcador.toUpperCase();
  if (photo.technicalSurveyId) return 'LEVANTAMENTO';
  if (photo.deviceId) return 'BASE TÉCNICA';
  return undefined;
}

/**
 * Carimbo Fireowl aplicado à versão DERIVADA (o original permanece intacto,
 * §8.7). Zonas ESTRUTURADAS (§8.4): o cabeçalho (logo + "FIREOWL CONTROLS" +
 * tag de MODO) fica isolado; o horário e as demais linhas começam SEMPRE ABAIXO
 * da logo — o horário nunca é posicionado sobre a logo. Timestamp usa
 * capturado_em real (§8.7), nunca upload/sync/generation time.
 */
export async function createFireowlEvidence(
  original: Blob,
  photo: Pick<FieldPhoto, 'capturadoEm' | 'notaRapida' | 'marcador' | 'geo' | 'evidenceMoment' | 'deviceId' | 'technicalSurveyId'>,
  session: Pick<FieldPhotoSession, 'localSetor' | 'tecnicoNome'>,
  clientName: string,
): Promise<Blob> {
  const bitmap = await createImageBitmap(original);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar evidência.');
  ctx.drawImage(bitmap, 0, 0); bitmap.close?.();

  const data = evidenceLines(photo, session, clientName);
  const note = data.note ? data.note.slice(0, 140) : '';
  const location = gpsLabel(photo.geo);
  const detail = [data.localSetor, note].filter(Boolean).join(' · ');
  // Linhas do CORPO (além de timestamp + cliente): detalhe, local, técnico.
  const bodyExtra = [detail, location, data.technician].filter(Boolean).length;
  const layout = evidenceLayout(canvas.width, canvas.height, bodyExtra + 1);
  const { font, padding, overlayHeight } = layout;
  const top = canvas.height - overlayHeight;

  // Fundo do overlay.
  ctx.fillStyle = 'rgba(10, 20, 40, .82)';
  ctx.fillRect(0, top, canvas.width, overlayHeight);
  ctx.textBaseline = 'alphabetic';

  // ---- ZONA 1: cabeçalho (logo + título + tag de MODO) ----
  const logo = await loadLogo();
  const logoSize = Math.round(font * 1.9);
  const headerTop = top + padding;
  if (logo) { ctx.drawImage(logo, padding, headerTop, logoSize, logoSize); logo.close?.(); }
  const titleX = padding + (logo ? logoSize + Math.round(font * 0.5) : 0);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${font}px sans-serif`;
  // Título verticalmente centrado à logo.
  ctx.fillText('FIREOWL CONTROLS', titleX, headerTop + logoSize * 0.5 + font * 0.35);

  // Tag de MODO no canto superior direito (pílula), sem sobrepor o título.
  const mode = modeLabel(photo);
  if (mode) {
    ctx.font = `700 ${Math.round(font * 0.62)}px sans-serif`;
    const tw = ctx.measureText(mode).width;
    const padX = Math.round(font * 0.45);
    const pillH = Math.round(font * 1.1);
    const pillW = Math.round(tw + padX * 2);
    const pillX = canvas.width - padding - pillW;
    const pillY = headerTop + Math.round((logoSize - pillH) / 2);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    const r = Math.round(pillH / 2);
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
    ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
    ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
    ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mode, pillX + padX, pillY + pillH * 0.5 + font * 0.22);
  }

  // ---- ZONA 2: corpo (SEMPRE abaixo da logo — o horário nunca a sobrepõe) ----
  let y = headerTop + logoSize + font * 0.95;
  ctx.fillStyle = '#d8e0ec';
  ctx.font = `500 ${Math.round(font * 0.72)}px sans-serif`;
  ctx.fillText(`${data.date} · ${data.time}`, padding, y);
  y += font * 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(font * 0.82)}px sans-serif`;
  ctx.fillText(data.clientName, padding, y);
  y += font * 0.95;
  if (detail) {
    ctx.fillStyle = '#d8e0ec';
    ctx.font = `500 ${Math.round(font * 0.7)}px sans-serif`;
    ctx.fillText(detail.slice(0, 180), padding, y);
    y += font * 0.9;
  }
  if (location) {
    ctx.fillStyle = '#d8e0ec';
    ctx.font = `500 ${Math.round(font * 0.62)}px sans-serif`;
    ctx.fillText(`📍 ${location}`.slice(0, 190), padding, y);
    y += font * 0.85;
  }
  if (data.technician) {
    ctx.fillStyle = '#d8e0ec';
    ctx.font = `500 ${Math.round(font * 0.65)}px sans-serif`;
    ctx.fillText(`${data.technician} · Técnico`, padding, y);
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a evidência.')), 'image/jpeg', .88));
}
