import { evidenceLines, FieldPhoto, FieldPhotoSession } from './fieldPhotos';
import { gpsLabel } from './fieldPhotoGeo';

export const EVIDENCE_HAS_FIREOWL_LOGO = true;
async function loadLogo():Promise<ImageBitmap|undefined>{try{const r=await fetch('/icons/icon-192.png');if(!r.ok)return;return await createImageBitmap(await r.blob());}catch{return undefined}}

export interface EvidenceLayout { font: number; padding: number; overlayHeight: number; }
export const evidenceLayout = (width: number, height: number, lineCount: number): EvidenceLayout => {
  const unit = Math.max(12, Math.min(width, height) * 0.032);
  return { font: unit, padding: Math.round(unit * 0.9), overlayHeight: Math.min(Math.round(height * 0.34), Math.round(unit * (4.8 + Math.min(lineCount, 3) * 1.15))) };
};

export async function createFireowlEvidence(original: Blob, photo: Pick<FieldPhoto, 'capturadoEm' | 'notaRapida' | 'marcador'|'geo'>, session: Pick<FieldPhotoSession, 'localSetor' | 'tecnicoNome'>, clientName: string): Promise<Blob> {
  const bitmap = await createImageBitmap(original);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar evidência.');
  ctx.drawImage(bitmap, 0, 0); bitmap.close?.();
  const data = evidenceLines(photo, session, clientName);
  const note = data.note ? data.note.slice(0, 140) : '';
  const location=gpsLabel(photo.geo);
  const layout = evidenceLayout(canvas.width, canvas.height, note ? 4 : 3);
  ctx.fillStyle = 'rgba(10, 20, 40, .82)'; ctx.fillRect(0, canvas.height - layout.overlayHeight, canvas.width, layout.overlayHeight);
  let y = canvas.height - layout.overlayHeight + layout.padding + layout.font;
  ctx.fillStyle = '#ffffff'; ctx.font = `700 ${layout.font}px sans-serif`;
  const logo=await loadLogo(); if(logo){const size=layout.font*2.2;ctx.drawImage(logo,layout.padding,y-layout.font,size,size);logo.close?.();}
  const textX=layout.padding+(logo?layout.font*2.7:0);ctx.fillText('FIREOWL CONTROLS', textX, y); y += layout.font * 1.25;
  ctx.fillStyle = '#d8e0ec'; ctx.font = `500 ${layout.font * .72}px sans-serif`;
  ctx.fillText(`${data.time}  |  ${data.date}`, layout.padding, y); y += layout.font * 1.1;
  ctx.fillStyle = '#ffffff'; ctx.font = `700 ${layout.font * .82}px sans-serif`;
  ctx.fillText(data.clientName, layout.padding, y); y += layout.font * 1.05;
  const detail = [data.localSetor, photo.marcador?.toUpperCase(), note].filter(Boolean).join(' · ');
  if (detail) { ctx.fillStyle = '#d8e0ec'; ctx.font = `500 ${layout.font * .7}px sans-serif`; ctx.fillText(detail.slice(0, 180), layout.padding, y); y += layout.font; }
  ctx.fillStyle='#d8e0ec';ctx.font=`500 ${layout.font*.62}px sans-serif`;ctx.fillText(`📍 ${location}`.slice(0,190),layout.padding,y);y+=layout.font*.85;
  if (data.technician) { ctx.fillStyle = '#d8e0ec'; ctx.font = `500 ${layout.font * .65}px sans-serif`; ctx.fillText(`${data.technician} · Técnico`, layout.padding, y); }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a evidência.')), 'image/jpeg', .88));
}
