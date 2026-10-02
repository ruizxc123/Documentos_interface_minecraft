import { mountBookEditor } from './book-editor.js';
import { renderLibrary } from './library.js';
import { clearRecovery, deleteDocument, getDocument, listDocuments, saveDocument, storeRecovery } from './storage.js';

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
    region.setAttribute('aria-hidden', 'true');
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
  const dialog = document.createElement('dialog');
  dialog.className = 'modal-dialog';
  if (typeof dialog.showModal !== 'function') {
    const accepted = window.confirm(message);
    if (!accepted) return Promise.resolve(null);
    if (inputValue === undefined) return Promise.resolve(true);
    const value = window.prompt(title, inputValue);
    return Promise.resolve(typeof value === 'string' ? value.trim().slice(0, 120) : null);
  }

  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.setAttribute('aria-describedby', 'dialog-message');
  dialog.innerHTML = `
    <form method="dialog">
      <h2 id="dialog-title"></h2><p id="dialog-message"></p>
      ${inputValue !== undefined ? '<label class="sr-only" for="dialog-input">Nome do documento</label><input id="dialog-input" class="dialog-input" type="text" maxlength="120" aria-describedby="dialog-message" />' : ''}
      <div class="dialog-actions">
        <button class="secondary-button" type="button" data-dialog-cancel>Cancelar</button>
        <button class="${danger ? 'danger-button' : 'primary-button'}" type="submit" value="confirm"></button>
      </div>
    </form>`;
  dialog.querySelector('#dialog-title').textContent = title;
  dialog.querySelector('#dialog-message').textContent = message;
  dialog.querySelector('[value="confirm"]').textContent = confirmLabel;
  const input = dialog.querySelector('.dialog-input');
  if (input) input.value = inputValue;

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? (input ? input.value.trim() : true) : null);
      dialog.remove();
    }, { once: true });
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close('cancel'));
    dialog.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      dialog.close('confirm');
    });
    document.body.append(dialog);
    dialog.showModal();
    input?.focus();
    input?.select();
  });
}

function focusLibraryHeading(generation) {
  if (generation !== routeGeneration) return;
  const heading = app.querySelector('#library-title');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function focusDocumentAction(id, action) {
  const card = [...app.querySelectorAll('.document-card')].find((item) => item.dataset.documentId === id);
  const preferred = card?.querySelector(`[data-action="${action}"]`);
  const fallback = app.querySelector('.document-card [data-action="open"], .new-document-button');
  (preferred || fallback)?.focus();
}

async function drawLibrary(generation = routeGeneration, { focus = false } = {}) {
  const documents = await listDocuments();
  if (generation !== routeGeneration) return;

  renderLibrary(app, documents, {
    onNew: async () => {
      if (generation !== routeGeneration) return;
      const now = new Date().toISOString();
      const id = globalThis.crypto?.randomUUID?.() || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const documentRecord = { id, title: 'Documento sem título', content: '', createdAt: now, updatedAt: now };
      try {
        await saveDocument(documentRecord);
      } catch {
        const recovered = storeRecovery(documentRecord);
        toast(
          recovered
            ? 'O navegador não conseguiu salvar ainda. Uma cópia local foi preservada.'
            : 'Não foi possível salvar nem criar uma cópia local. Verifique o armazenamento do navegador e tente novamente.',
          'error',
        );
        if (!recovered) return;
      }
      if (generation === routeGeneration) window.location.hash = `doc=${encodeURIComponent(id)}`;
    },
    onOpen: (id) => { window.location.hash = `doc=${encodeURIComponent(id)}`; },
    onRename: async (id) => {
      const item = await getDocument(id);
      if (!item || generation !== routeGeneration) return;
      const title = await showDialog({
        title: 'Renomear livro',
        message: 'Escolha um nome que ajude a encontrar esta ideia depois.',
        inputValue: item.title || 'Documento sem título',
        confirmLabel: 'Salvar nome',
      });
      if (typeof title !== 'string' || !title || generation !== routeGeneration) return;
      item.title = title;
      item.updatedAt = new Date().toISOString();
      try {
        await saveDocument(item);
        clearRecovery(item.id);
      } catch {
        const recovered = storeRecovery(item);
        toast(
          recovered
            ? 'Não foi possível salvar o novo nome. Uma cópia local foi preservada para recuperação.'
            : 'Não foi possível salvar nem preservar o novo nome neste navegador.',
          'error',
        );
      }
      if (generation !== routeGeneration) return;
      await drawLibrary(generation);
      focusDocumentAction(id, 'rename');
    },
    onDelete: async (id) => {
      const item = await getDocument(id);
      if (!item || generation !== routeGeneration) return;
      const confirmed = await showDialog({
        title: 'Excluir documento?',
        message: `“${item.title || 'Documento sem título'}” será removido deste navegador. Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir livro',
        danger: true,
      });
      if (!confirmed || generation !== routeGeneration) return;
      let deleted = false;
      try {
        await deleteDocument(id);
        deleted = true;
        toast('Livro removido da estante.');
      } catch {
        toast('Não foi possível confirmar a exclusão. O documento pode continuar salvo neste navegador.', 'error');
      }
      if (generation !== routeGeneration) return;
      await drawLibrary(generation);
      focusDocumentAction(deleted ? '' : id, deleted ? 'open' : 'delete');
    },
  });
  document.title = 'Meus documentos — Livro';
  if (focus) focusLibraryHeading(generation);
}

async function enterDocument(id, generation) {
  if (controller && currentId === id) return;
  const previousController = controller;
  if (previousController) {
    const canClose = await previousController.close();
    if (generation !== routeGeneration) return;
    if (!canClose) {
      if (currentId) window.history.replaceState(null, '', `#doc=${encodeURIComponent(currentId)}`);
      return;
    }
    previousController.destroy();
    if (controller === previousController) controller = null;
    currentId = null;
  }

  const documentRecord = await getDocument(id);
  if (generation !== routeGeneration) return;
  if (!documentRecord) {
    toast('Não encontramos esse documento neste navegador.', 'error');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    currentId = null;
    await drawLibrary(generation, { focus: Boolean(previousController) });
    return;
  }

  currentId = id;
  document.title = `${documentRecord.title || 'Documento sem título'} — Livro`;
  controller = mountBookEditor(app, documentRecord, {
    onBack: () => { window.location.hash = ''; },
    onDocumentUpdated: (updated) => {
      document.title = `${updated.title?.trim() || 'Documento sem título'} — Livro`;
    },
  });
}

async function route() {
  const generation = ++routeGeneration;
  const id = documentIdFromHash();
  if (id) {
    await enterDocument(id, generation);
    return;
  }

  const previousController = controller;
  if (previousController) {
    const canClose = await previousController.close();
    if (generation !== routeGeneration) return;
    if (!canClose) {
      if (currentId) window.history.replaceState(null, '', `#doc=${encodeURIComponent(currentId)}`);
      return;
    }
    previousController.destroy();
    if (controller === previousController) controller = null;
    currentId = null;
  }
  await drawLibrary(generation, { focus: Boolean(previousController) });
}

window.addEventListener('hashchange', () => { void route(); });
void route();
