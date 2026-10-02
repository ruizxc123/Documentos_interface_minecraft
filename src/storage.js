const DB_NAME = 'livro-documentos';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const FALLBACK_KEY = 'livro:documents:v1';
const RECOVERY_PREFIX = 'livro:recovery:';
const TOMBSTONE_PREFIX = 'livro:deleted:';
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const EPOCH = new Date(0).toISOString();

let databasePromise;

function normalizeTimestamp(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function normalizeDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.id !== 'string' || !VALID_ID.test(value.id)) return null;
  if (value.title !== undefined && typeof value.title !== 'string') return null;
  if (value.content !== undefined && typeof value.content !== 'string') return null;
  const createdAt = normalizeTimestamp(value.createdAt, EPOCH);
  return {
    id: value.id,
    title: (value.title || 'Documento sem título').slice(0, 120),
    content: value.content || '',
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  };
}

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
  return Array.isArray(value) ? value.map(normalizeDocument).filter(Boolean) : [];
}

function readRecoveryDocuments() {
  const recovered = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(RECOVERY_PREFIX)) continue;
      const item = normalizeDocument(safeRead(key));
      if (item) recovered.push(item);
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
    for (const candidate of group) {
      const doc = normalizeDocument(candidate);
      if (!doc) continue;
      const previous = byId.get(doc.id);
      if (!previous || Date.parse(doc.updatedAt) >= Date.parse(previous.updatedAt)) {
        byId.set(doc.id, doc);
      }
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
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
  if (typeof id !== 'string' || !VALID_ID.test(id) || isTombstoned(id)) return null;
  try {
    const indexed = await readOneIndexed(id);
    const recovery = safeRead(`${RECOVERY_PREFIX}${id}`);
    const fallback = readFallbackDocuments().find((doc) => doc.id === id);
    return mergeByFreshness([indexed].filter(Boolean), [recovery].filter(Boolean), [fallback].filter(Boolean))[0] || null;
  } catch {
    return mergeByFreshness(
      readFallbackDocuments().filter((doc) => doc.id === id),
      [safeRead(`${RECOVERY_PREFIX}${id}`)].filter(Boolean),
    )[0] || null;
  }
}

export function storeRecovery(document) {
  const normalized = normalizeDocument(document);
  return normalized ? safeWrite(`${RECOVERY_PREFIX}${normalized.id}`, normalized) : false;
}

export function clearRecovery(id) {
  if (typeof id !== 'string' || !VALID_ID.test(id)) return;
  try {
    localStorage.removeItem(`${RECOVERY_PREFIX}${id}`);
  } catch {
    // Retain the draft if browser storage is temporarily unavailable.
  }
}

export async function saveDocument(document) {
  const normalized = normalizeDocument(document);
  if (!normalized) throw new TypeError('Documento inválido: confira o identificador, o título e o conteúdo.');
  const saved = {
    ...normalized,
    createdAt: normalizeTimestamp(document.createdAt, new Date().toISOString()),
    updatedAt: normalizeTimestamp(document.updatedAt, new Date().toISOString()),
  };
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
    const error = new Error(indexedError?.message || 'Não foi possível salvar o documento neste navegador.');
    if (indexedError) error.cause = indexedError;
    throw error;
  }
}

export async function deleteDocument(id) {
  if (typeof id !== 'string' || !VALID_ID.test(id)) throw new TypeError('Identificador de documento inválido.');
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
  const fallbackCleaned = safeWrite(FALLBACK_KEY, remaining);
  clearRecovery(id);
  if (!indexedError && fallbackCleaned) clearTombstone(id);
  // If the primary delete failed, only a durable tombstone can prevent the stale IDB row reappearing.
  if (indexedError && !tombstoneStored) throw indexedError;
  if (!indexedError && !fallbackCleaned && !tombstoneStored) {
    throw new Error('Não foi possível confirmar a exclusão em todas as cópias locais.');
  }
}
