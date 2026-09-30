import { backupSchema, emptyPersonalData, MAX_BACKUP_BYTES, MAX_NOTES, personalSchema,
  PersonalError, type PersonalData, type PersonalRepository } from "@/domain/personal";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new PersonalError("storage")); return; }
    let finished = false;
    const timer = setTimeout(() => stop(new PersonalError("blocked")), 5000);
    function stop(error: PersonalError) {
      finished = true; clearTimeout(timer); reject(error);
    }
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open("stocklab-personal", 1); }
    catch { stop(new PersonalError("storage")); return; }
    request.onupgradeneeded = () => {
      if (finished) { request.transaction?.abort(); return; }
      if (!request.result.objectStoreNames.contains("personal")) request.result.createObjectStore("personal");
    };
    request.onblocked = () => stop(new PersonalError("blocked"));
    request.onerror = () => stop(new PersonalError("storage"));
    request.onsuccess = () => {
      if (finished) { request.result.close(); return; }
      finished = true; clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction(change?: (data: PersonalData) => PersonalData): Promise<PersonalData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let result: PersonalData | null = null;
    let failure: unknown = null;
    let tx: IDBTransaction;
    try { tx = db.transaction("personal", "readwrite"); }
    catch { db.close(); reject(new PersonalError("storage")); return; }
    const timeout = setTimeout(() => {
      failure = new PersonalError("storage");
      try { tx.abort(); } catch { /* A finished transaction still reports its completion event. */ }
    }, 10000);
    tx.oncomplete = () => { clearTimeout(timeout); db.close(); if (result) resolve(result); else reject(new PersonalError("storage")); };
    tx.onabort = () => { clearTimeout(timeout); db.close(); reject(failure ?? new PersonalError("storage")); };
    tx.onerror = () => { failure ??= new PersonalError("storage"); };
    const store = tx.objectStore("personal");
    const request = store.get("guest");
    request.onsuccess = () => {
      try {
        const existed = request.result !== undefined;
        const parsed = existed ? personalSchema.safeParse(request.result) : { success: true as const, data: emptyPersonalData() };
        if (!parsed.success) throw new PersonalError("invalid");
        const next = change ? change(parsed.data) : parsed.data;
        if (next.notes.length > MAX_NOTES || new TextEncoder().encode(JSON.stringify(next)).byteLength > MAX_BACKUP_BYTES)
          throw new PersonalError("capacity");
        const validated = personalSchema.safeParse(next);
        if (!validated.success) throw new PersonalError("invalid");
        result = validated.data;
        if (change || !existed) store.put(result, "guest");
      } catch (error) { failure = error; tx.abort(); }
    };
    // No await inside a transaction: compare and put are in the same callback.
    // A put request's success is NOT the commit; resolve only at tx.oncomplete.
  });
}
function expectGeneration(data: PersonalData, generation: string) {
  if (data.generation !== generation) throw new PersonalError("conflict");
}
export const indexedDbRepository: PersonalRepository = {
  load: () => transaction(),
  saveNote: (note, generation, expectedVersion) => transaction((data) => {
    expectGeneration(data, generation);
    const current = data.notes.find((item) => item.id === note.id);
    if ((current?.version ?? 0) !== expectedVersion || (!current && expectedVersion !== 0)) throw new PersonalError("conflict");
    const saved = { ...note, createdAt: current?.createdAt ?? note.createdAt,
      updatedAt: new Date().toISOString(), version: expectedVersion + 1 };
    return { ...data, revision: data.revision + 1,
      notes: [...data.notes.filter((item) => item.id !== note.id), saved] };
  }),
  deleteNote: (id, generation, expectedVersion) => transaction((data) => {
    expectGeneration(data, generation);
    if (data.notes.find((item) => item.id === id)?.version !== expectedVersion) throw new PersonalError("conflict");
    return { ...data, revision: data.revision + 1, notes: data.notes.filter((item) => item.id !== id) };
  }),
  setWatchlist: (watchlist, generation, expectedVersion) => transaction((data) => {
    expectGeneration(data, generation);
    if (data.watchVersion !== expectedVersion) throw new PersonalError("conflict");
    return { ...data, watchlist, watchVersion: data.watchVersion + 1, revision: data.revision + 1 };
  }),
  importBackup: (input, generation, expectedRevision) => transaction((data) => {
    expectGeneration(data, generation);
    if (data.revision !== expectedRevision) throw new PersonalError("conflict");
    const backup = backupSchema.safeParse(input);
    if (!backup.success) throw new PersonalError("invalid");
    // Merge as new copies. Never overwrite an existing note with an imported ID.
    const notes = backup.data.notes.map((note) => ({ ...note, id: crypto.randomUUID(), version: 1 }));
    return { ...data, revision: data.revision + 1, watchVersion: data.watchVersion + 1,
      notes: [...data.notes, ...notes], watchlist: [...new Set([...data.watchlist, ...backup.data.watchlist])] };
  }),
  reset: (generation, expectedRevision) => transaction((data) => {
    expectGeneration(data, generation);
    if (data.revision !== expectedRevision) throw new PersonalError("conflict");
    return { ...emptyPersonalData(), revision: data.revision + 1, watchVersion: data.watchVersion + 1 };
  }),
};
