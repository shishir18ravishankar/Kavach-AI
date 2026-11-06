/** Minimal promise wrapper around IndexedDB (browser only). */
const DB_NAME = "kavach-ai";
const DB_VERSION = 1;
export const STORES = ["kv", "docs", "blobs", "grants"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support IndexedDB (private mode?)"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error ?? new Error("Could not open IndexedDB")); };
      req.onblocked = () => reject(new Error("Close other Kavach tabs and reload"));
    });
  }
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? req.error ?? new Error("IndexedDB error"));
        t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (store: StoreName, key: string, value: unknown) => tx(store, "readwrite", (s) => s.put(value, key)).then(() => undefined),
  del: (store: StoreName, key: string) => tx(store, "readwrite", (s) => s.delete(key)).then(() => undefined),
  all: <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  clear: (store: StoreName) => tx(store, "readwrite", (s) => s.clear()).then(() => undefined),
};

export async function wipeAll(): Promise<void> {
  for (const s of STORES) await idb.clear(s);
}
