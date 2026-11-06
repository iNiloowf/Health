import type { AppData } from "./types";

const DB_NAME = "hearth";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local database."));
  });
}

export async function loadState(): Promise<AppData | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get("state");
      request.onsuccess = () => resolve((request.result as AppData | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read saved data."));
    });
  } finally {
    db.close();
  }
}

export async function saveState(data: AppData): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, "state");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save data."));
    });
  } finally {
    db.close();
  }
}
