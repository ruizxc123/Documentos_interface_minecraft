const DB_NAME = 'livro-documentos';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const FALLBACK_KEY = 'livro:documents:v1';
const RECOVERY_PREFIX = 'livro:recovery:';
const TOMBSTONE_PREFIX = 'livro:deleted:';

let databasePromise;

function safeRead(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local'));
      request.onblocked = () => reject(new Error('O armazenamento está ocupado por outra aba'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha no armazenamento'));
  });
}

async function readAllIndexed() {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  return requestResult(tx.objectStore(STORE_NAME).getAll());
}

async function readOneIndexed(id) {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  return requestResult(tx.objectStore(STORE_NAME).get(id));
}

function readFallbackDocuments() {
  const value = safeRead(FALLBACK_KEY, []);
  return Array.isArray(value) ? value : [];
}

function readRecoveryDocuments() {
  const recovered = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(RECOVERY_PREFIX)) continue;
      const item = safeRead(key);
      if (item?.id) recovered.push(item);
    }
  } catch {
    // A private browsing mode may block access; IndexedDB continues to work when available.
  }
  return recovered;
}

function isTombstoned(id) {
  try {
    return localStorage.getItem(`${TOMBSTONE_PREFIX}${id}`) === '1';
  } catch {
    return false;
  }
}

function markDeleted(id) {
  try {
    localStorage.setItem(`${TOMBSTONE_PREFIX}${id}`, '1');
    return true;
  } catch {
    return false;
  }
}

function clearTombstone(id) {
  try {
    localStorage.removeItem(`${TOMBSTONE_PREFIX}${id}`);
  } catch {
    // A failed browser cleanup should not prevent a successful IndexedDB write.
  }
}

function mergeByFreshness(...groups) {
  const byId = new Map();
  for (const group of groups) {
    for (const doc of group) {
      if (!doc?.id) continue;
      const previous = byId.get(doc.id);
      if (!previous || Date.parse(doc.updatedAt || 0) >= Date.parse(previous.updatedAt || 0)) {
        byId.set(doc.id, doc);
      }
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
}

export async function listDocuments() {
  let indexed = [];
  try {
    indexed = await readAllIndexed();
  } catch {
    // Recover from the browser-local mirror when IndexedDB is blocked or unavailable.
  }
  return mergeByFreshness(indexed, readFallbackDocuments(), readRecoveryDocuments())
    .filter((doc) => !isTombstoned(doc.id));
}

export async function getDocument(id) {
  if (isTombstoned(id)) return null;
  try {
    const indexed = await readOneIndexed(id);
    const recovery = safeRead(`${RECOVERY_PREFIX}${id}`);
    const fallback = readFallbackDocuments().find((doc) => doc.id === id);
    return mergeByFreshness([indexed].filter(Boolean), [fallback].filter(Boolean), [recovery].filter(Boolean))[0] || null;
  } catch {
    return mergeByFreshness(
      readFallbackDocuments().filter((doc) => doc.id === id),
      [safeRead(`${RECOVERY_PREFIX}${id}`)].filter(Boolean),
    )[0] || null;
  }
}

export function storeRecovery(document) {
  return safeWrite(`${RECOVERY_PREFIX}${document.id}`, document);
}

export function clearRecovery(id) {
  try {
    localStorage.removeItem(`${RECOVERY_PREFIX}${id}`);
  } catch {
    // Retain the draft if browser storage is temporarily unavailable.
  }
}

export async function saveDocument(document) {
  const saved = { ...document, updatedAt: document.updatedAt || new Date().toISOString() };
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(saved);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Falha ao salvar o documento'));
      tx.onabort = () => reject(tx.error || new Error('O salvamento foi cancelado'));
    });
    clearTombstone(saved.id);
    return { document: saved, storage: 'indexeddb' };
  } catch (indexedError) {
    const documents = mergeByFreshness(readFallbackDocuments(), [saved]);
    if (safeWrite(FALLBACK_KEY, documents)) {
      clearTombstone(saved.id);
      return { document: saved, storage: 'local' };
    }
    storeRecovery(saved);
    throw new Error(indexedError?.message || 'Não foi possível salvar o documento neste navegador.');
  }
}

export async function deleteDocument(id) {
  const tombstoneStored = markDeleted(id);
  let indexedError;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Falha ao excluir'));
      tx.onabort = () => reject(tx.error || new Error('A exclusão foi cancelada'));
    });
  } catch (error) {
    indexedError = error;
  }

  const remaining = readFallbackDocuments().filter((doc) => doc.id !== id);
  safeWrite(FALLBACK_KEY, remaining);
  clearRecovery(id);
  // If the primary delete failed, only a durable tombstone can prevent the stale IDB row reappearing.
  if (indexedError && !tombstoneStored) throw indexedError;
}
