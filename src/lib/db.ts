// Local voice-note history (IndexedDB). No auth, no server storage.

export interface VoiceNote {
  id: string;
  audio: Blob;
  durationMs: number;
  transcript: string;
  answer: string;
  sources: Array<{ title: string; uri: string }>;
  searched: boolean;
  createdAt: number;
}

const DB_NAME = "voicesearch";
const STORE = "notes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const saveNote = (note: VoiceNote) => tx("readwrite", (s) => s.put(note));

export const deleteNote = (id: string) => tx("readwrite", (s) => s.delete(id));

export async function listNotes(limit = 20): Promise<VoiceNote[]> {
  const all = await tx<VoiceNote[]>("readonly", (s) => s.getAll() as IDBRequest<VoiceNote[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
