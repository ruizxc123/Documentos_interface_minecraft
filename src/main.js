import { mountBookEditor } from './book-editor.js';
import { renderLibrary } from './library.js';
import { deleteDocument, getDocument, listDocuments, saveDocument, storeRecovery } from './storage.js';

const app = document.getElementById('app');
let controller = null;
let currentId = null;
let routeGeneration = 0;

function announce(message) {
  const region = document.getElementById('announcer');
  if (region) region.textContent = message;
}

function toast(message, kind = 'info') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = 'toast';
  item.dataset.kind = kind;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 4400);
  announce(message);
}

function documentIdFromHash() {
  const match = window.location.hash.match(/^#doc=([^&]+)$/u);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function showDialog({ title, message, inputValue, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <h2></h2><p></p>
        ${inputValue !== undefined ? '<input class="dialog-input" type="text" maxlength="120" aria-label="Novo título" />' : ''}
        <div class="dialog-actions">
          <button class="secondary-button" value="cancel">Cancelar</button>
          <button class="${danger ? 'danger-button' : 'primary-button'}" value="confirm"></button>
        </div>
      </form>`;
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = message;
    dialog.querySelector('[value="confirm"]').textContent = confirmLabel;
    const input = dialog.querySelector('.dialog-input');
    if (input) input.value = inputValue;
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? (input ? input.value.trim() : true) : null);
      dialog.remove();
    }, { once: true });
    dialog.addEventListener('cancel', () => resolve(null), { once: true });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      const accepted = window.confirm(message);
      resolve(accepted ? (input ? window.prompt(title, inputValue) : true) : null);
      dialog.remove();
    }
    input?.focus();
    input?.select();
  });
}

async function enterDocument(id, updateHash = false) {
  if (controller && currentId === id) return;
  if (controller) {
    const canClose = await controller.close();
    if (!canClose) return;
    controller.destroy();
    controller = null;
  }
  if (updateHash) window.location.hash = `doc=${encodeURIComponent(id)}`;
  const documentRecord = await getDocument(id);
  if (!documentRecord) {
    toast('Não encontramos esse documento neste navegador.', 'error');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    currentId = null;
    await drawLibrary();
    return;
  }
  currentId = id;
  document.title = `${documentRecord.title || 'Documento sem título'} — Livro`;
  controller = mountBookEditor(app, documentRecord, {
    onBack: () => { window.location.hash = ''; },
    onDocumentUpdated: (updated) => { if (updated.title) document.title = `${updated.title} — Livro`; },
  });
}

async function drawLibrary() {
  const documents = await listDocuments();
  renderLibrary(app, documents, {
    onNew: async () => {
      const now = new Date().toISOString();
      const id = globalThis.crypto?.randomUUID?.() || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const documentRecord = { id, title: 'Documento sem título', content: '', createdAt: now, updatedAt: now };
      try {
        await saveDocument(documentRecord);
      } catch {
        storeRecovery(documentRecord);
        toast('O navegador não conseguiu salvar ainda. Uma cópia local foi preservada.', 'error');
      }
      window.location.hash = `doc=${encodeURIComponent(id)}`;
    },
    onOpen: (id) => { window.location.hash = `doc=${encodeURIComponent(id)}`; },
    onRename: async (id) => {
      const item = await getDocument(id);
      if (!item) return;
      const title = await showDialog({ title: 'Renomear livro', message: 'Escolha um nome que ajude a encontrar esta ideia depois.', inputValue: item.title || 'Documento sem título', confirmLabel: 'Salvar nome' });
      if (typeof title !== 'string' || !title) return;
      item.title = title;
      item.updatedAt = new Date().toISOString();
      try { await saveDocument(item); }
      catch { storeRecovery(item); toast('Não foi possível salvar o novo nome. Ele foi mantido para recuperação.', 'error'); }
      await drawLibrary();
    },
    onDelete: async (id) => {
      const item = await getDocument(id);
      if (!item) return;
      const confirmed = await showDialog({ title: 'Excluir documento?', message: `“${item.title || 'Documento sem título'}” será removido deste navegador. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir livro', danger: true });
      if (!confirmed) return;
      try {
        await deleteDocument(id);
        toast('Livro removido da estante.');
      } catch {
        toast('Não foi possível excluir este documento agora.', 'error');
      }
      await drawLibrary();
    },
  });
  document.title = 'Meus documentos — Livro';
}

async function route() {
  const generation = ++routeGeneration;
  const id = documentIdFromHash();
  if (id) {
    await enterDocument(id);
  } else {
    if (controller) {
      const canClose = await controller.close();
      if (!canClose) {
        window.history.replaceState(null, '', `#doc=${encodeURIComponent(currentId)}`);
        return;
      }
      controller.destroy();
      controller = null;
      currentId = null;
    }
    if (generation === routeGeneration) await drawLibrary();
  }
}

window.addEventListener('hashchange', () => { void route(); });
void route();
