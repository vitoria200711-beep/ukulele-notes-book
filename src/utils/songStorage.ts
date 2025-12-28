/**
 * Armazenamento de cifra/letra:
 * - IndexedDB (principal): aguenta textos grandes e é bem mais confiável no celular
 * - localStorage (fallback): pode falhar por quota em músicas longas
 */

const LS_PREFIX = 'ukulele-cifra-';
const DB_NAME = 'ukulele-notes-db';
const DB_VERSION = 1;
const STORE = 'cifras';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function lsKey(songId: string) {
  return `${LS_PREFIX}${songId}`;
}

export async function setSongCifra(songId: string, cifra: string) {
  // Tenta IndexedDB primeiro (melhor para mobile)
  try {
    await idbSet(songId, cifra);
    // Mantém um fallback leve também
    try {
      localStorage.setItem(lsKey(songId), cifra);
    } catch {
      // ignore
    }
    return;
  } catch {
    // fallback localStorage
  }

  localStorage.setItem(lsKey(songId), cifra);
}

export async function getSongCifra(songId: string): Promise<string | undefined> {
  try {
    const v = await idbGet(songId);
    if (v) return v;
  } catch {
    // ignore
  }
  try {
    return localStorage.getItem(lsKey(songId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function removeSongCifra(songId: string) {
  try {
    await idbDel(songId);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(lsKey(songId));
  } catch {
    // ignore
  }
}

export async function mergeSongsWithCifra<T extends { id: string }>(
  songs: T[]
): Promise<Array<T & { cifra?: string }>> {
  const merged = await Promise.all(
    songs.map(async (s) => {
      const cifra = await getSongCifra(s.id);
      return { ...s, cifra };
    })
  );
  return merged;
}


