import { getSupabaseClient } from './supabaseClient';
import { FieldPhotoMarker, FieldPhotoSyncStatus, isUnclassifiedFieldPhoto } from './fieldPhotos';
import { listOfflineJobs } from './offline/outbox';
import type { FieldPhotoPayload } from './offline/fieldPhotoSync';
import type { Client } from './types';

/* =====================================================================
 * Gestão de Fotos de Campo (Fase 3.1 — Passada 4)
 * Camada de leitura/vínculo que unifica fotos locais (outbox/IndexedDB) e
 * remotas (Supabase), sem duplicar arquivos nem criar novo modelo de dados.
 * As regras puras (dedup, filtros, busca) ficam isoladas para teste.
 * ===================================================================== */

export type FieldPhotoSource = 'local' | 'remote';

/** Vínculos possíveis de uma foto (um de cada tipo — espelha o schema 0064). */
export interface FieldPhotoLinks {
  reportId?: string;
  osId?: string;
  pendenciaId?: string;
}

/** Foto unificada para a tela de gestão (origem local ou remota). */
export interface GalleryPhoto extends FieldPhotoLinks {
  /** Identidade estável e chave de dedup local×remoto. */
  clientUuid: string;
  /** id do banco (igual ao id local, que vira o id da linha ao sincronizar). */
  id: string;
  source: FieldPhotoSource;
  sessionId: string;
  clientId: string;
  clientName?: string;
  localSetor?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  capturadoEm: string;
  marcador?: FieldPhotoMarker;
  notaRapida?: string;
  syncStatus: FieldPhotoSyncStatus;
  /** Tentativas/erro do job local (apenas source==='local'). */
  attempts?: number;
  lastError?: string;
  storagePathOriginal?: string;
  storagePathEvidencia?: string;
  storagePathMarkup?: string;
  /** Blobs locais para prévia sem rede (apenas source==='local'). */
  localOriginal?: Blob;
  localEvidence?: Blob;
  localMarkup?: Blob;
}

export interface FieldPhotoFilters {
  clientId?: string;
  tecnicoId?: string;
  marcador?: FieldPhotoMarker;
  syncStatus?: FieldPhotoSyncStatus;
  /** ISO date (YYYY-MM-DD) inclusivo. */
  from?: string;
  to?: string;
  search?: string;
  unclassifiedOnly?: boolean;
}

/* ------------------------------- helpers puros ------------------------------- */

/** Normaliza para busca: sem acentos, minúsculo, espaços colapsados. */
export function normalizeText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Código amigável estável derivado do client_uuid (não é sequência global). */
export function friendlyPhotoId(clientUuid: string): string {
  const hex = (clientUuid || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
  return `FOTO #${(hex.slice(0, 6) || '000000').padEnd(6, '0')}`;
}

/** Uma foto é "Não Classificada" quando não aponta para relatório/OS/pendência. */
export function isUnclassified(p: FieldPhotoLinks): boolean {
  return isUnclassifiedFieldPhoto({ reportId: p.reportId, osId: p.osId, pendenciaId: p.pendenciaId });
}

export function hasAnyLink(p: FieldPhotoLinks): boolean {
  return !isUnclassified(p);
}

export function matchesFieldPhotoSearch(p: GalleryPhoto, term?: string): boolean {
  const q = normalizeText(term);
  if (!q) return true;
  const haystack = normalizeText([p.clientName, p.localSetor, p.notaRapida].filter(Boolean).join(' '));
  return haystack.includes(q);
}

export function sortByCapturadoDesc(list: GalleryPhoto[]): GalleryPhoto[] {
  return [...list].sort((a, b) => (b.capturadoEm || '').localeCompare(a.capturadoEm || ''));
}

/**
 * Dedup local×remoto por client_uuid. Quando existir a versão remota
 * (sincronizada) de um mesmo client_uuid, ela vence; o Blob local só
 * permanece se não houver contraparte remota. Ordena por capturado_em desc.
 */
export function mergeFieldPhotos(remote: GalleryPhoto[], local: GalleryPhoto[]): GalleryPhoto[] {
  const byUuid = new Map<string, GalleryPhoto>();
  for (const p of remote) byUuid.set(p.clientUuid, p);
  for (const p of local) if (!byUuid.has(p.clientUuid)) byUuid.set(p.clientUuid, p);
  return sortByCapturadoDesc(Array.from(byUuid.values()));
}

/** Preenche o nome do cliente a partir da base já carregada (client_id é TEXT). */
export function attachClientNames(list: GalleryPhoto[], clients: Client[]): GalleryPhoto[] {
  const nameById = new Map(clients.map((c) => [c.id, c.name] as const));
  return list.map((p) => ({ ...p, clientName: p.clientName || nameById.get(p.clientId) || undefined }));
}

export function applyFieldPhotoFilters(list: GalleryPhoto[], filters: FieldPhotoFilters): GalleryPhoto[] {
  return list.filter((p) => {
    if (filters.unclassifiedOnly && !isUnclassified(p)) return false;
    if (filters.clientId && p.clientId !== filters.clientId) return false;
    if (filters.tecnicoId && p.tecnicoId !== filters.tecnicoId) return false;
    if (filters.marcador && p.marcador !== filters.marcador) return false;
    if (filters.syncStatus && p.syncStatus !== filters.syncStatus) return false;
    if (filters.from && (p.capturadoEm || '').slice(0, 10) < filters.from) return false;
    if (filters.to && (p.capturadoEm || '').slice(0, 10) > filters.to) return false;
    if (!matchesFieldPhotoSearch(p, filters.search)) return false;
    return true;
  });
}

/* ------------------------------ leitura remota ------------------------------ */

function rowToGalleryPhoto(r: any): GalleryPhoto {
  const s = r.field_photo_sessions || r.session || null;
  return {
    clientUuid: String(r.client_uuid),
    id: String(r.id),
    source: 'remote',
    sessionId: String(r.session_id),
    clientId: String(r.client_id),
    localSetor: s?.local_setor ?? undefined,
    tecnicoId: s?.tecnico_id ?? undefined,
    tecnicoNome: s?.tecnico_nome ?? undefined,
    capturadoEm: r.capturado_em,
    marcador: (r.marcador ?? undefined) as FieldPhotoMarker | undefined,
    notaRapida: r.nota_rapida ?? undefined,
    syncStatus: (r.sync_status || 'sincronizado') as FieldPhotoSyncStatus,
    reportId: r.report_id ?? undefined,
    osId: r.os_id ?? undefined,
    pendenciaId: r.pendencia_id ?? undefined,
    storagePathOriginal: r.storage_path_original ?? undefined,
    storagePathEvidencia: r.storage_path_evidencia ?? undefined,
    storagePathMarkup: r.storage_path_markup ?? undefined,
  };
}

/** Lê as fotos remotas acessíveis (RLS decide o escopo por perfil). */
export async function listRemoteFieldPhotos(): Promise<GalleryPhoto[]> {
  const supabase = getSupabaseClient() as any;
  // Preferimos o embed da sessão (traz local/setor e técnico numa só ida ao banco).
  const embedded = await supabase
    .from('field_photos')
    .select('*, field_photo_sessions ( local_setor, tecnico_id, tecnico_nome, iniciado_em )')
    .order('capturado_em', { ascending: false });
  if (!embedded.error) return (embedded.data || []).map(rowToGalleryPhoto);
  // Fallback resiliente: sem embed, as fotos ainda aparecem (sessão resolvida à parte).
  const plain = await supabase.from('field_photos').select('*').order('capturado_em', { ascending: false });
  if (plain.error) throw plain.error;
  return (plain.data || []).map(rowToGalleryPhoto);
}

/* ------------------------------- leitura local ------------------------------- */

/** Fotos ainda na outbox (pendentes/erro): aparecem mesmo sem estar no Supabase. */
export async function listLocalFieldPhotos(): Promise<GalleryPhoto[]> {
  const jobs = await listOfflineJobs('FIELD_PHOTO');
  return jobs.map((job) => {
    const { photo, session, original, evidence, markup } = job.payload as FieldPhotoPayload;
    return {
      clientUuid: photo.clientUuid,
      id: photo.id,
      source: 'local' as const,
      sessionId: photo.sessionId,
      clientId: photo.clientId,
      clientName: (job.payload as FieldPhotoPayload).clientName,
      localSetor: session?.localSetor,
      tecnicoId: session?.tecnicoId,
      tecnicoNome: session?.tecnicoNome,
      capturadoEm: photo.capturadoEm,
      marcador: photo.marcador,
      notaRapida: photo.notaRapida,
      syncStatus: (job.status === 'ERROR' ? 'erro' : 'pendente') as FieldPhotoSyncStatus,
      attempts: job.attempts,
      lastError: job.lastError,
      reportId: photo.reportId,
      osId: photo.osId,
      pendenciaId: photo.pendenciaId,
      storagePathOriginal: photo.storagePathOriginal,
      storagePathEvidencia: photo.storagePathEvidencia,
      storagePathMarkup: photo.storagePathMarkup,
      localOriginal: original,
      localEvidence: evidence,
      localMarkup: markup,
    };
  });
}

/* --------------------------------- vínculo --------------------------------- */

/**
 * Atualiza SOMENTE os relacionamentos da foto existente (não duplica arquivo).
 * `null` num campo remove aquele vínculo. Requer que a linha exista no banco
 * (foto sincronizada); fotos apenas locais devem ser sincronizadas antes.
 */
export async function updateFieldPhotoLinks(id: string, links: FieldPhotoLinks): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = {};
  if ('reportId' in links) patch.report_id = links.reportId ?? null;
  if ('osId' in links) patch.os_id = links.osId ?? null;
  if ('pendenciaId' in links) patch.pendencia_id = links.pendenciaId ?? null;
  const { error } = await supabase.from('field_photos').update(patch).eq('id', id);
  if (error) throw error;
}
