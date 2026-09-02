/* ---------------------------------------------------------------------------
 * Wrapper mínimo de IndexedDB (sem dependências). Usado pela fila offline de
 * relatórios (Parte 4.1). Guarda Blobs nativamente — o navegador faz o
 * structured-clone no put, então os arquivos ficam duráveis sem base64.
 * Só roda no browser; no servidor (SSR) as funções são no-op seguras.
 * ------------------------------------------------------------------------- */

const DB_NAME = 'fireowl-offline';
const DB_VERSION = 3;
export const STORE_OUTBOX = 'report_outbox';
/** Fila de jobs por domínio. Blobs são suportados pelo structured clone do IDB. */
export const STORE_OFFLINE_JOBS = 'offline_jobs';
/** Identidades excluídas confirmadas; impede ressurreição por outra aba/retry. */
export const STORE_REPORT_TOMBSTONES = 'report_tombstones';
const STORES = [STORE_OUTBOX, STORE_OFFLINE_JOBS, STORE_REPORT_TOMBSTONES];

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(store: string, value: unknown, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export async function idbGetAll<T = unknown>(store: string): Promise<T[]> {
  if (!hasIDB()) return [];
  const db = await openDB();
  const out = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function idbGet<T = unknown>(store: string, key: IDBValidKey): Promise<T | undefined> {
  if (!hasIDB()) return undefined;
  const db = await openDB();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

/** Atualização atômica por chave; usada para reclamar um job sem corrida óbvia entre abas. */
export async function idbUpdate<T>(store: string, key: IDBValidKey, update: (current: T | undefined) => T | undefined): Promise<T | undefined> {
  const db = await openDB();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const req = objectStore.get(key);
    let next: T | undefined;
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      try {
        next = update(req.result as T | undefined);
        if (next === undefined) objectStore.delete(key);
        else objectStore.put(next, key);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação IndexedDB cancelada'));
  });
  db.close();
  return out;
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbCount(store: string): Promise<number> {
  if (!hasIDB()) return 0;
  const db = await openDB();
  const n = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return n;
}

export function idbAvailable(): boolean {
  return hasIDB();
}
