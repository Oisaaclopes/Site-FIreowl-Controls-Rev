import { idbDelete, idbGetAll, idbUpdate, STORE_OFFLINE_JOBS } from './idb';

export type OfflineJobStatus = 'PENDING' | 'SYNCING' | 'ERROR';
export type OfflineDomain = 'REPORT' | 'FIELD_PHOTO_SESSION' | 'FIELD_PHOTO';

export interface OfflineJob<T = unknown> {
  id: string;
  domain: OfflineDomain;
  entityClientUuid: string;
  payload: T;
  status: OfflineJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  nextAttemptAt?: string;
  /** Lease curto: evita duas abas executarem o mesmo job simultaneamente. */
  leaseUntil?: string;
  leaseOwner?: string;
}

export type OfflineHandler<T = unknown> = (job: OfflineJob<T>) => Promise<void>;
const handlers = new Map<OfflineDomain, OfflineHandler>();
let flushing = false;
const LEASE_MS = 30_000;

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `offline_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

export function registerOfflineHandler<T>(domain: OfflineDomain, handler: OfflineHandler<T>): void {
  handlers.set(domain, handler as OfflineHandler);
}

/** Enfileira por chave de entidade: repetir o mesmo comando atualiza o mesmo job e preserva Blobs. */
export async function enqueueOfflineJob<T>(input: Omit<OfflineJob<T>, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'lastError' | 'leaseUntil'>): Promise<string> {
  const id = `${input.domain}:${input.entityClientUuid}`;
  const now = new Date().toISOString();
  await idbUpdate<OfflineJob<T>>(STORE_OFFLINE_JOBS, id, (current) => ({
    id,
    domain: input.domain,
    entityClientUuid: input.entityClientUuid,
    payload: input.payload,
    status: 'PENDING',
    attempts: current?.attempts || 0,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  }));
  return id;
}

export async function listOfflineJobs(domain?: OfflineDomain): Promise<OfflineJob[]> {
  const jobs = await idbGetAll<OfflineJob>(STORE_OFFLINE_JOBS);
  return jobs.filter((job) => !domain || job.domain === domain).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOfflineJob(id: string): Promise<void> {
  await idbDelete(STORE_OFFLINE_JOBS, id);
}

async function claimJob(job: OfflineJob): Promise<OfflineJob | undefined> {
  const now = Date.now();
  const owner = newId();
  const claimed = await idbUpdate<OfflineJob>(STORE_OFFLINE_JOBS, job.id, (current) => {
    if (!current ||
      (current.status === 'SYNCING' && Date.parse(current.leaseUntil || '') > now) ||
      (current.nextAttemptAt && Date.parse(current.nextAttemptAt) > now)) return current;
    return { ...current, status: 'SYNCING', leaseOwner: owner, leaseUntil: new Date(now + LEASE_MS).toISOString(), updatedAt: new Date(now).toISOString() };
  });
  return claimed?.leaseOwner === owner ? claimed : undefined;
}

async function failJob(job: OfflineJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await idbUpdate<OfflineJob>(STORE_OFFLINE_JOBS, job.id, (current) => current && ({
    ...current,
    status: 'ERROR',
    attempts: current.attempts + 1,
    lastError: message.slice(0, 500),
    nextAttemptAt: new Date(Date.now() + Math.min(300_000, 30_000 * 2 ** Math.min(current.attempts, 3))).toISOString(),
    leaseUntil: undefined,
    leaseOwner: undefined,
    updatedAt: new Date().toISOString(),
  }));
}

export async function flushOfflineJobs(isOnline: () => boolean): Promise<{ synced: number; failed: number; pending: number }> {
  if (flushing || !isOnline()) return { synced: 0, failed: 0, pending: (await listOfflineJobs()).length };
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const job of await listOfflineJobs()) {
      const claimed = await claimJob(job);
      if (!claimed) continue;
      const handler = handlers.get(claimed.domain);
      if (!handler) {
        await failJob(claimed, new Error(`Handler offline ausente: ${claimed.domain}`));
        failed++;
        continue;
      }
      try {
        await handler(claimed);
        await removeOfflineJob(claimed.id);
        synced++;
      } catch (error) {
        await failJob(claimed, error);
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, failed, pending: (await listOfflineJobs()).length };
}
