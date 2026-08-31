import { slugArquivo, nomeFantasiaCliente } from './utils';
import { FieldPhotoMarker } from './fieldPhotos';
import type { GalleryPhoto } from './fieldPhotosGallery';

/* =====================================================================
 * Folha de Fotos (Fase 3.2 — Passada 1). Saída documental das evidências
 * de campo já existentes. Estas funções são PURAS (sem rede/DOM) para teste:
 * validação de mesmo cliente, ordenação, numeração, referência automática,
 * nome de arquivo e legenda. Não criam nenhuma entidade.
 * ===================================================================== */

export const MARKER_LABEL: Record<FieldPhotoMarker, string> = {
  antes: 'Antes', depois: 'Depois', falha: 'Falha', corrigido: 'Corrigido', pendente: 'Pendente',
};

export type PhotoSheetOrder = 'selecao' | 'antiga' | 'recente';

/** Configuração do documento (preenchida no modal; nada é inventado). */
export interface PhotoSheetConfig {
  titulo: string;
  subtitulo?: string;
  clienteNome: string;
  localSetor?: string;
  referencia?: string;
  dataEmissao: string; // ISO YYYY-MM-DD
  responsavel?: string;
  observacao?: string;
}

/** Legenda derivada de uma evidência — só campos seguros (sem UUID/path/GPS). */
export interface PhotoLegend {
  numero: string;        // "01"
  titulo: string;        // "EVIDÊNCIA 01"
  local?: string;
  dataHora: string;      // dd/mm/aaaa HH:mm
  marcador?: string;     // rótulo humano
  observacao?: string;
  tecnico?: string;
}

/** Item já pronto para o documento (imagem + legenda). */
export interface PhotoSheetItem extends PhotoLegend {
  clientUuid: string;
  imageDataUrl: string;
}

/** Validação §8: a Folha deve conter fotos de um único cliente. */
export function selectionClient(photos: Pick<GalleryPhoto, 'clientId' | 'clientName'>[]): { ok: boolean; clientId?: string; clientName?: string } {
  const ids = Array.from(new Set(photos.map((p) => p.clientId)));
  if (ids.length === 0) return { ok: true };
  if (ids.length > 1) return { ok: false };
  const withName = photos.find((p) => p.clientName);
  return { ok: true, clientId: ids[0], clientName: withName?.clientName || ids[0] };
}

export function orderPhotos<T extends { capturadoEm: string }>(photos: T[], mode: PhotoSheetOrder): T[] {
  if (mode === 'selecao') return [...photos];
  const asc = [...photos].sort((a, b) => (a.capturadoEm || '').localeCompare(b.capturadoEm || ''));
  return mode === 'antiga' ? asc : asc.reverse();
}

/** Numeração documental (não altera nenhum id). */
export function evidenceNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function allSame(values: (string | undefined)[]): string | undefined {
  if (values.length === 0 || values.some((v) => !v)) return undefined;
  const set = new Set(values);
  return set.size === 1 ? values[0] : undefined;
}

/** Vínculo compartilhado por TODAS as fotos (para preencher a referência). */
export function sharedReference(photos: Pick<GalleryPhoto, 'osId' | 'reportId' | 'pendenciaId'>[]): { osId?: string; reportId?: string; pendenciaId?: string } {
  return {
    osId: allSame(photos.map((p) => p.osId)),
    reportId: allSame(photos.map((p) => p.reportId)),
    pendenciaId: allSame(photos.map((p) => p.pendenciaId)),
  };
}

/** Responsável técnico derivado só quando todas as fotos têm o mesmo. */
export function sharedTechnician(photos: Pick<GalleryPhoto, 'tecnicoNome'>[]): string | undefined {
  return allSame(photos.map((p) => p.tecnicoNome || undefined));
}

const fmtDateHora = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} ${hora}`;
};

/** Legenda de uma evidência (sem dados internos, §16/§37). */
export function buildLegend(photo: Pick<GalleryPhoto, 'localSetor' | 'capturadoEm' | 'marcador' | 'notaRapida' | 'tecnicoNome'>, index: number): PhotoLegend {
  const numero = evidenceNumber(index);
  return {
    numero,
    titulo: `EVIDÊNCIA ${numero}`,
    local: photo.localSetor || undefined,
    dataHora: fmtDateHora(photo.capturadoEm),
    marcador: photo.marcador ? MARKER_LABEL[photo.marcador] : undefined,
    observacao: photo.notaRapida || undefined,
    tecnico: photo.tecnicoNome || undefined,
  };
}

/** Nome do arquivo sanitizado: Folha-de-Fotos_FIREOWL_<Cliente>_<AAAA-MM-DD>.pdf */
export function photoSheetFilename(clienteNome: string | undefined, dataEmissao: string): string {
  const cli = slugArquivo(nomeFantasiaCliente(clienteNome)) || 'Cliente';
  const data = (dataEmissao || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `Folha-de-Fotos_FIREOWL_${cli}_${data}.pdf`;
}

/** Data de emissão padrão (hoje, ISO YYYY-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
