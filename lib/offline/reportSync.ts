import { ReportInstance, ReportTipo, Pendencia, GeoPoint, ReportSignature } from '../types';
import { createReport, updateReport, upsertAnswer, insertMedia } from '../reports';
import { uploadReportPhoto } from '../reportMedia';
import { uploadSignaturePng, insertSignature } from '../signatures';
import { updateOrdemServicoStatus } from '../ordensServico';
import { marcarTesteFuncional } from '../devices';
import { insertPendencia, updatePendenciaStatus } from '../pendencias';
import { PendenciaStatus } from '../types';
import { fetchCicloAtivo, registrarTestesNoCiclo } from '../ciclos';
import { idbPut, idbGetAll, idbDelete, idbCount, idbAvailable, STORE_OUTBOX } from './idb';

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

/* ------------------------------ Persistência ------------------------------ */

/**
 * Replica um bundle no Supabase, na mesma ordem do fluxo online. Idempotente
 * pelo client_uuid: se o relatório já existe, devolve { duplicate: true }.
 */
export async function persistReportBundle(b: ReportBundle): Promise<{ reportId?: string; duplicate?: boolean }> {
  let report: ReportInstance;
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
    if (isUniqueViolation(e)) return { duplicate: true };
    throw e;
  }

  const pathById: Record<string, string> = {};
  let seq = 0;

  for (const m of b.media) {
    const path = await uploadReportPhoto({
      file: m.blob,
      reportId: report.id,
      clienteId: b.report.clienteId,
      tipo: m.tipo,
      seq: `${Date.now()}_${seq++}`,
    });
    pathById[m.photoId] = path;
    let markedPath: string | undefined;
    if (m.markedBlob) {
      markedPath = await uploadReportPhoto({
        file: m.markedBlob,
        reportId: report.id,
        clienteId: b.report.clienteId,
        tipo: `${m.tipo}_marcado`,
        seq: `${Date.now()}_${seq++}`,
      });
    }
    await insertMedia({
      id: '',
      reportId: report.id,
      tipo: m.tipo,
      storagePathOriginal: path,
      storagePathMarcado: markedPath,
      notaRapida: m.notaRapida,
      geo: m.geo || undefined,
    });
  }

  for (const s of b.signatures) {
    const path = await uploadSignaturePng(report.id, s.blob, s.papel, `${Date.now()}_${seq++}`);
    pathById[s.sigId] = path;
    await insertSignature({
      id: '',
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
  for (const a of b.answers) {
    await upsertAnswer({ id: '', reportId: report.id, secao: a.secao, fieldKey: a.fieldKey, valor: clean(a.valor) });
  }

  for (const p of b.pendencias) {
    await insertPendencia({ ...p, reportOrigemId: report.id });
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

  return { reportId: report.id };
}

/* -------------------------------- Outbox ---------------------------------- */

export async function enqueueBundle(b: ReportBundle): Promise<void> {
  await idbPut(STORE_OUTBOX, b, b.clientUuid);
}

export async function listBundles(): Promise<ReportBundle[]> {
  return idbGetAll<ReportBundle>(STORE_OUTBOX);
}

export async function removeBundle(clientUuid: string): Promise<void> {
  await idbDelete(STORE_OUTBOX, clientUuid);
}

export async function pendingCount(): Promise<number> {
  return idbCount(STORE_OUTBOX);
}

let flushing = false;

/** Replica todos os bundles pendentes. Remove os sincronizados/duplicados. */
export async function flushOutbox(): Promise<{ synced: number; failed: number; pending: number }> {
  if (flushing || !isOnline() || !offlineAvailable()) {
    return { synced: 0, failed: 0, pending: await pendingCount().catch(() => 0) };
  }
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    const bundles = await listBundles();
    for (const b of bundles) {
      try {
        await persistReportBundle(b);
        await removeBundle(b.clientUuid);
        synced++;
      } catch (e) {
        console.warn('Sincronização de relatório falhou (mantido na fila):', e);
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, failed, pending: await pendingCount() };
}
