/* ---------------------------------------------------------------------------
 * Wrapper mínimo de IndexedDB (sem dependências). Usado pela fila offline de
 * relatórios (Parte 4.1). Guarda Blobs nativamente — o navegador faz o
 * structured-clone no put, então os arquivos ficam duráveis sem base64.
 * Só roda no browser; no servidor (SSR) as funções são no-op seguras.
 * ------------------------------------------------------------------------- */

const DB_NAME = 'fireowl-offline';
const DB_VERSION = 1;
export const STORE_OUTBOX = 'report_outbox';
const STORES = [STORE_OUTBOX];

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
