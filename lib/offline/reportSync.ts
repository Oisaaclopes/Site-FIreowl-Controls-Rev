import { ReportInstance, ReportTipo, Pendencia, GeoPoint, ReportSignature } from '../types';
import { TemplateSchema } from '../reportSchema';
import { createReport, fetchReportByClientUuid, resetIncompleteReportChildren, updateReport, upsertAnswer, insertMedia, attachTemplateSnapshot } from '../reports';
import { uploadReportPhoto } from '../reportMedia';
import { uploadSignaturePng, insertSignature } from '../signatures';
import { updateOrdemServicoStatus } from '../ordensServico';
import { marcarTesteFuncional } from '../devices';
import { fetchPendenciasForReconciliation, insertPendencia, updatePendenciaStatus } from '../pendencias';
import { PendenciaStatus } from '../types';
import { fetchCicloAtivo, registrarTestesNoCiclo } from '../ciclos';
import { replaceSurveyRequirements } from '../surveyRequirements';
import { idbGet, idbGetAll, idbDelete, idbAvailable, idbPut, STORE_OUTBOX, STORE_REPORT_TOMBSTONES } from './idb';
import { canProcessJob, enqueueOfflineJob, flushOfflineJobs, getOutboxOwner, listOfflineJobs, registerOfflineHandler, removeOfflineJob } from './outbox';
// Registra o handler de Fotos de Campo no mesmo núcleo; não cria uma segunda fila.
import './fieldPhotoSync';
import './technicalBaseSync';

/* ---------------------------------------------------------------------------
 * Offline-first do relatório de campo (Parte 4.1). A finalização vira um
 * "bundle" auto-contido (dados + blobs) gravado no IndexedDB ANTES de tocar a
 * rede. Um worker replica o bundle no Supabase quando há conexão. O client_uuid
 * (índice único em reports) garante idempotência — reenvio não duplica.
 * ------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MediaTipo = 'antes' | 'depois' | 'evidencia' | 'geral';

export interface BundleMedia {
  photoId: string; // id transitório referenciado nas respostas
  tipo: MediaTipo;
  blob: Blob;
  markedBlob?: Blob;
  notaRapida?: string;
  geo?: GeoPoint | null;
}

export interface BundleSignature {
  sigId: string;
  papel: ReportSignature['papel'];
  nome: string;
  documento?: string;
  cargo?: string;
  blob: Blob;
  geo?: GeoPoint | null;
}

export interface BundleAnswer {
  secao: string;
  fieldKey: string;
  valor: unknown; // ainda com ids transitórios de foto/assinatura
}

export interface ReportBundle {
  clientUuid: string;
  createdAt: string;
  /** Chave local do atendimento; apagada apenas após sync integral confirmado. */
  draftKey?: string;
  report: {
    templateId?: string;
    templateCodigo: string;
    numero?: string;
    tipo: ReportTipo;
    clienteId?: string;
    clienteNome?: string;
    osId?: string;
    contratoId?: string;
    tecnicoNome?: string;
    titulo?: string;
    geoInicio?: GeoPoint | null;
    /** Versionamento/snapshot congelados no INÍCIO do atendimento (CAMPO 2B).
     *  O sync NUNCA troca para a versão vigente — replica o que foi congelado. */
    templateVersion?: number;
    templateSnapshot?: TemplateSchema;
  };
  answers: BundleAnswer[];
  pendencias: Pendencia[];
  media: BundleMedia[];
  signatures: BundleSignature[];
  geoFim?: GeoPoint | null;
  os?: { id: string };
  deviceTests?: { ids: string[]; dataISO: string; cicloId?: string };
  /** Pendências existentes a atualizar (Corretiva: as marcadas 'Corrigida'). */
  pendenciaUpdates?: { id: string; status: string }[];
  ciclo?: { novos: number };
  pendCount: number;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function offlineAvailable(): boolean {
  return idbAvailable();
}

/** Gera um UUID v4 (crypto quando disponível; fallback simples). */
export function newClientUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && 'randomUUID' in c) return (c as Crypto).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === '23505' || /duplicate key|client_uuid/i.test(err?.message || '');
}

/** UUID estável por bundle/entidade. Evita duplicar children em qualquer retry. */
export function stableBundleUuid(clientUuid: string, entity: string, index: number): string {
  const input = `${clientUuid}:${entity}:${index}`;
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let w = 0; w < words.length; w++) {
    let h = words[w] >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i) + w * 31;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    words[w] = h;
  }
  const hex = words.map((word) => word.toString(16).padStart(8, '0')).join('').split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function pendenciaFingerprint(p: Pendencia): string {
  return JSON.stringify([
    p.clienteId || '', p.deviceId || '', p.grupo || '', p.descricao || '',
    p.acaoRecomendada || '', p.normaReferencia || '', p.local || '',
    Number(p.quantidade || 1), p.unidade || '', p.itemCatalogoId || '',
    p.itemTextoLivre || '', !!p.precisaCadastroCatalogo, p.status || 'aberta',
  ]);
}

/* ------------------------------ Persistência ------------------------------ */

/**
 * Replica um bundle no Supabase, na mesma ordem do fluxo online. Idempotente
 * pelo client_uuid. Encontrar o report não encerra o job: um rascunho pode ser
 * resto de tentativa parcial e precisa ter todos os children reconciliados.
 */
export async function persistReportBundle(b: ReportBundle): Promise<{ reportId?: string; duplicate?: boolean }> {
  let report: ReportInstance;
  let resumed = false;
  try {
    report = await createReport({
      id: '',
      templateId: b.report.templateId,
      templateCodigo: b.report.templateCodigo,
      numero: b.report.numero,
      tipo: b.report.tipo,
      clienteId: b.report.clienteId,
      osId: b.report.osId,
      contratoId: b.report.contratoId,
      tecnicoNome: b.report.tecnicoNome,
      titulo: b.report.titulo,
      status: 'rascunho',
      geoInicio: b.report.geoInicio || undefined,
      clientUuid: b.clientUuid,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const existing = await fetchReportByClientUuid(b.clientUuid);
    if (!existing) throw e;
    // Um report finalizado só é atingido quando todos os awaits obrigatórios
    // abaixo terminaram. O job remanescente pode então ser reconhecido.
    if (existing.status === 'finalizado') return { reportId: existing.id, duplicate: true };
    report = existing;
    resumed = true;
    await resetIncompleteReportChildren(report.id);
  }

  // Congela a DEFINIÇÃO usada (snapshot + versão) no relatório. Best-effort:
  // se a 0075 ainda não foi aplicada, não bloqueia a finalização (fica legado).
  if (b.report.templateSnapshot) {
    const attached = await attachTemplateSnapshot(report.id, b.report.templateVersion, b.report.templateSnapshot);
    if (!attached) throw new Error('Não foi possível confirmar o snapshot do template do relatório.');
  }

  const pathById: Record<string, string> = {};
  for (const [index, m] of b.media.entries()) {
    const mediaId = stableBundleUuid(b.clientUuid, 'media', index);
    const path = await uploadReportPhoto({
      file: m.blob,
      reportId: report.id,
      clienteId: b.report.clienteId,
      tipo: m.tipo,
      seq: `${mediaId}_original`,
    });
    pathById[m.photoId] = path;
    let markedPath: string | undefined;
    if (m.markedBlob) {
      markedPath = await uploadReportPhoto({
        file: m.markedBlob,
        reportId: report.id,
        clienteId: b.report.clienteId,
        tipo: `${m.tipo}_marcado`,
        seq: `${mediaId}_marked`,
      });
    }
    await insertMedia({
      id: mediaId,
      reportId: report.id,
      tipo: m.tipo,
      storagePathOriginal: path,
      storagePathMarcado: markedPath,
      notaRapida: m.notaRapida,
      geo: m.geo || undefined,
    });
  }

  for (const [index, s] of b.signatures.entries()) {
    const signatureId = stableBundleUuid(b.clientUuid, 'signature', index);
    const path = await uploadSignaturePng(report.id, s.blob, s.papel, signatureId);
    pathById[s.sigId] = path;
    await insertSignature({
      id: signatureId,
      reportId: report.id,
      papel: s.papel,
      nome: s.nome,
      documento: s.documento,
      cargo: s.cargo,
      storagePath: path,
      geo: s.geo || undefined,
    });
  }

  // troca ids transitórios pelos storage_path nas respostas
  const mapId = (x: unknown) => (typeof x === 'string' && pathById[x] ? pathById[x] : x);
  const clean = (v: unknown): unknown => {
    if (!Array.isArray(v)) return v;
    return v.map((item) => {
      if (typeof item === 'string') return mapId(item);
      if (item && typeof item === 'object') {
        const obj: Record<string, unknown> = { ...(item as Record<string, unknown>) };
        for (const k of Object.keys(obj)) {
          if (Array.isArray(obj[k])) obj[k] = (obj[k] as unknown[]).map(mapId);
        }
        return obj;
      }
      return item;
    });
  };
  for (const [index, a] of b.answers.entries()) {
    await upsertAnswer({ id: stableBundleUuid(b.clientUuid, 'answer', index), reportId: report.id, secao: a.secao, fieldKey: a.fieldKey, valor: clean(a.valor) });
  }
  if (b.report.tipo === 'LEVANTAMENTO') await replaceSurveyRequirements(report.id, b.answers);

  const existingPendencias = resumed ? await fetchPendenciasForReconciliation(report.id) : [];
  const legacyCounts = new Map<string, number>();
  existingPendencias.forEach((p) => legacyCounts.set(pendenciaFingerprint(p), (legacyCounts.get(pendenciaFingerprint(p)) || 0) + 1));
  for (const [index, p] of b.pendencias.entries()) {
    const fingerprint = pendenciaFingerprint(p);
    const existingCount = legacyCounts.get(fingerprint) || 0;
    if (existingCount > 0) {
      legacyCounts.set(fingerprint, existingCount - 1);
      continue;
    }
    await insertPendencia({ ...p, id: stableBundleUuid(b.clientUuid, 'pendencia', index), reportOrigemId: report.id });
  }

  await updateReport({
    ...report,
    status: 'finalizado',
    finalizadoEm: new Date().toISOString(),
    geoFim: b.geoFim || undefined,
  });

  if (b.os?.id && UUID_RE.test(b.os.id)) {
    try {
      await updateOrdemServicoStatus(b.os.id, 'concluida', {
        reportId: report.id,
        dataConclusao: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      console.warn('OS não vinculada na sincronização:', e);
    }
  }

  if (b.deviceTests?.ids.length) {
    try {
      await marcarTesteFuncional(b.deviceTests.ids, b.deviceTests.dataISO, b.deviceTests.cicloId);
    } catch (e) {
      console.warn('Testes funcionais não gravados na sincronização:', e);
    }
  }
  // Corretiva: conclui as pendências corrigidas (best-effort; admin/gestor na RLS).
  if (b.pendenciaUpdates?.length) {
    const resolvidaEm = new Date().toISOString();
    for (const u of b.pendenciaUpdates) {
      try {
        await updatePendenciaStatus(u.id, u.status as PendenciaStatus, { resolvidaEm });
      } catch (e) {
        console.warn('Pendência não atualizada na sincronização:', e);
      }
    }
  }
  if (b.ciclo && b.report.clienteId) {
    try {
      const fresh = await fetchCicloAtivo(b.report.clienteId);
      if (fresh) await registrarTestesNoCiclo(fresh, b.ciclo.novos);
    } catch (e) {
      console.warn('Ciclo não atualizado na sincronização:', e);
    }
  }

  return { reportId: report.id, duplicate: resumed || undefined };
}

/* -------------------------------- Outbox ---------------------------------- */

export async function enqueueBundle(b: ReportBundle): Promise<void> {
  await enqueueOfflineJob({ domain: 'REPORT', entityClientUuid: b.clientUuid, payload: b });
}

export async function listBundles(): Promise<ReportBundle[]> {
  await migrateLegacyReportBundles();
  return (await listOfflineJobs('REPORT')).map((job) => job.payload as ReportBundle);
}

export async function removeBundle(clientUuid: string): Promise<void> {
  await removeOfflineJob(`REPORT:${clientUuid}`);
  // Compatibilidade com a fila criada antes da versão 2 do IndexedDB.
  await idbDelete(STORE_OUTBOX, clientUuid);
}

export async function isReportTombstoned(clientUuid: string): Promise<boolean> {
  return !!(await idbGet(STORE_REPORT_TOMBSTONES, clientUuid));
}

/** Cancela de forma durável qualquer sync capaz de recriar um report excluído. */
export async function cancelReportBundle(clientUuid?: string): Promise<void> {
  if (!clientUuid || !offlineAvailable()) return;
  await idbPut(STORE_REPORT_TOMBSTONES, { clientUuid, deletedAt: new Date().toISOString() }, clientUuid);
  await removeBundle(clientUuid);
}

/** Limpeza dirigida dos quatro bundles antigos cuja exclusão foi autorizada. */
export async function purgeDeletedLegacyReportBundles(): Promise<void> {
  const deletedNumbers = new Set(['LEV-2026-25460', 'COR-2026-07971', 'LEV-2026-86393', 'LEV-2026-67899']);
  for (const bundle of await listBundles()) {
    if (bundle.report.numero && deletedNumbers.has(bundle.report.numero)) await cancelReportBundle(bundle.clientUuid);
  }
}

export async function pendingCount(): Promise<number> {
  await migrateLegacyReportBundles();
  const owner = getOutboxOwner();
  return (await listOfflineJobs('REPORT')).filter((job) => canProcessJob(job, owner)).length;
}

/** Migra silenciosamente bundles antigos sem serializar Blobs em JSON. */
async function migrateLegacyReportBundles(): Promise<void> {
  const legacy = await idbGetAll<ReportBundle>(STORE_OUTBOX);
  for (const bundle of legacy) {
    await enqueueOfflineJob({ domain: 'REPORT', entityClientUuid: bundle.clientUuid, payload: bundle });
    await idbDelete(STORE_OUTBOX, bundle.clientUuid);
  }
}

registerOfflineHandler<ReportBundle>('REPORT', async (job) => {
  if (await isReportTombstoned(job.entityClientUuid)) return;
  await persistReportBundle(job.payload);
  if (job.payload.draftKey && typeof window !== 'undefined') {
    try { window.localStorage.removeItem(job.payload.draftKey); } catch { /* indisponível */ }
  }
});

/** Replica todos os bundles pendentes. Remove os sincronizados/duplicados. */
export async function flushOutbox(): Promise<{ synced: number; failed: number; pending: number }> {
  if (!offlineAvailable()) return { synced: 0, failed: 0, pending: 0 };
  await migrateLegacyReportBundles();
  const result = await flushOfflineJobs(isOnline);
  return { ...result, pending: await pendingCount() };
}
