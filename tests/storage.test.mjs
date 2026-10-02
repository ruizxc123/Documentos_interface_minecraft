import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  clear() { this.#values.clear(); }
}

globalThis.window = {}; // Sem IndexedDB, os testes percorrem o fallback local e o marcador de exclusão.
globalThis.localStorage = new MemoryStorage();
const { clearRecovery, deleteDocument, getDocument, listDocuments, saveDocument, storeRecovery } = await import('../src/storage.js');

const record = (id, title, content, updatedAt) => ({ id, title, content, updatedAt, createdAt: updatedAt });

test('mantém documentos independentes no fallback e a exclusão persiste mesmo com IndexedDB indisponível', async () => {
  localStorage.clear();
  const first = record('doc-1', 'Primeiro livro', 'texto A', '2026-10-01T20:00:00.000Z');
  const second = record('doc-2', 'Segundo livro', 'texto B', '2026-10-01T20:01:00.000Z');
  await saveDocument(first);
  await saveDocument(second);

  assert.deepEqual((await listDocuments()).map((item) => item.id).sort(), ['doc-1', 'doc-2']);
  await deleteDocument(first.id);
  assert.equal(await getDocument(first.id), null);
  assert.deepEqual((await listDocuments()).map((item) => item.id), ['doc-2']);
  assert.equal(localStorage.getItem('livro:deleted:doc-1'), '1', 'sem IndexedDB, o tombstone impede que uma cópia antiga reapareça');
});

test('mantém o tombstone quando a limpeza do fallback falha para que um documento não reapareça', async () => {
  localStorage.clear();
  const saved = record('doc-fallback', 'Rascunho', 'conteúdo local', '2026-10-01T20:00:00.000Z');
  await saveDocument(saved);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    if (key === 'livro:documents:v1') throw new Error('armazenamento cheio');
    originalSetItem(key, value);
  };

  try {
    await deleteDocument(saved.id);
    assert.equal(localStorage.getItem('livro:deleted:doc-fallback'), '1');
    assert.deepEqual(await listDocuments(), []);
    assert.equal(await getDocument(saved.id), null);
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

test('usa a cópia de recuperação mais recente e a remove depois da gravação bem-sucedida', async () => {
  localStorage.clear();
  const saved = record('draft-1', 'Rascunho', 'versão salva', '2026-10-01T20:00:00.000Z');
  const recovered = record('draft-1', 'Rascunho', 'versão recuperada', '2026-10-01T20:02:00.000Z');
  await saveDocument(saved);
  assert.equal(storeRecovery(recovered), true);
  assert.equal((await getDocument('draft-1')).content, recovered.content);
  assert.equal((await listDocuments())[0].content, recovered.content);

  await saveDocument(recovered);
  clearRecovery(recovered.id);
  assert.equal((await getDocument('draft-1')).content, recovered.content);
});

test('ignora registros malformados e rejeita identificadores fora do formato aceito', async () => {
  localStorage.clear();
  localStorage.setItem('livro:documents:v1', JSON.stringify([
    record('doc-valid', 'Documento válido', 'conteúdo', '2026-10-01T20:00:00.000Z'),
    record('<script>alert(1)</script>', 'ID inválido', 'conteúdo', '2026-10-01T20:01:00.000Z'),
    { id: 'doc-object', title: {}, content: 'conteúdo' },
    null,
  ]));

  assert.deepEqual((await listDocuments()).map((item) => item.id), ['doc-valid']);
  assert.equal(await getDocument('<script>alert(1)</script>'), null);
  await assert.rejects(saveDocument(record('<script>', 'Inválido', '', '2026-10-01T20:00:00.000Z')), TypeError);
});
