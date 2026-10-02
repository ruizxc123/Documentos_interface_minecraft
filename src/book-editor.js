import { pageIndexAt, paginateText } from './pagination.js';
import { clearRecovery, saveDocument, storeRecovery } from './storage.js';

const MAX_UNDO_STEPS = 120;
const SAVE_DELAY = 720;
const RECOVERY_DELAY = 180;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.2;
const ZOOM_STEP = 0.1;

function formatTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function contentFromNode(node) {
  let value = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      value += child.nodeValue;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') {
        value += '\n';
      } else {
        const isBlock = /^(DIV|P|LI)$/u.test(child.tagName);
        if (isBlock && value && !value.endsWith('\n')) value += '\n';
        value += contentFromNode(child);
        if (isBlock && child.nextSibling && !value.endsWith('\n')) value += '\n';
      }
    }
  }
  return value;
}

function previousBoundary(text, offset) {
  const bounded = Math.max(0, Math.min(offset, text.length));
  if (typeof Intl.Segmenter === 'function') {
    const segments = [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text.slice(0, bounded))];
    return segments.at(-1)?.index ?? 0;
  }
  const code = text.charCodeAt(bounded - 1);
  return code >= 0xdc00 && code <= 0xdfff && bounded > 1 ? bounded - 2 : Math.max(0, bounded - 1);
}

function nextBoundary(text, offset) {
  const bounded = Math.max(0, Math.min(offset, text.length));
  if (typeof Intl.Segmenter === 'function') {
    const next = [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text.slice(bounded))][0];
    return next ? bounded + next.segment.length : text.length;
  }
  const code = text.codePointAt(bounded);
  return bounded + (code && code > 0xffff ? 2 : 1);
}

export function mountBookEditor(root, initialDocument, callbacks = {}) {
  const documentRecord = { ...initialDocument };
  if (!documentRecord.content) documentRecord.content = '';
  if (!documentRecord.title) documentRecord.title = 'Documento sem título';

  root.innerHTML = `
    <div class="editor-shell">
      <header class="editor-topbar">
        <button class="back-button" type="button" data-action="back"><span class="back-arrow" aria-hidden="true">←</span><span>Meus documentos</span></button>
        <div class="editor-title-wrap">
          <span class="editor-brandline">LIVRO · CADERNO DIGITAL</span>
          <input class="title-input" type="text" maxlength="120" aria-label="Título do documento" value="" />
        </div>
        <div class="editor-actions">
          <span class="save-status" data-state="saved" role="status" aria-live="polite">Salvo</span>
          <button class="save-button" type="button" data-action="save">Salvar</button>
        </div>
      </header>
      <main class="editor-main">
        <div class="editor-toolbar">
          <div class="document-kind"><span class="document-kind-icon" aria-hidden="true">✎</span><span>ESCREVENDO NO LIVRO</span></div>
          <div class="zoom-controls" aria-label="Zoom do livro">
            <button type="button" data-action="zoom-out" aria-label="Diminuir zoom">−</button>
            <span class="zoom-value" aria-live="polite">100%</span>
            <button type="button" data-action="zoom-in" aria-label="Aumentar zoom">+</button>
          </div>
        </div>
        <div class="book-stage" id="book-stage">
          <div class="book-viewport" id="book-viewport" aria-label="Livro aberto">
            <div class="book-track" id="book-track" contenteditable="plaintext-only" role="textbox" aria-label="Página do livro. Clique e comece a escrever." aria-multiline="true" spellcheck="true" autocapitalize="sentences"></div>
          </div>
        </div>
        <nav class="page-navigation" aria-label="Navegação entre páginas">
          <button class="page-nav-button" type="button" data-action="previous"><span class="nav-chevron" aria-hidden="true">‹</span> Página anterior</button>
          <span class="page-count" aria-live="polite">Página 1 de 1</span>
          <button class="page-nav-button" type="button" data-action="next">Próxima página <span class="nav-chevron" aria-hidden="true">›</span></button>
        </nav>
        <p class="editor-footnote">Seu texto fica salvo neste navegador <span aria-hidden="true">·</span> Ctrl/Cmd + Z para desfazer</p>
      </main>
    </div>`;

  const track = root.querySelector('#book-track');
  const stage = root.querySelector('#book-stage');
  const viewport = root.querySelector('#book-viewport');
  const titleInput = root.querySelector('.title-input');
  const status = root.querySelector('.save-status');
  const pageCount = root.querySelector('.page-count');
  const zoomValue = root.querySelector('.zoom-value');
  const previousButton = root.querySelector('[data-action="previous"]');
  const nextButton = root.querySelector('[data-action="next"]');
  const undoStack = [];
  const redoStack = [];
  let pages = [];
  let currentPage = 0;
  let zoom = 1;
  let saveTimer;
  let recoveryTimer;
  let retryTimer;
  let savePromise;
  let compositionActive = false;
  let destroyed = false;
  let lastSavedAt = null;
  let isDirty = false;
  let editRevision = 0;
  let reflowing = false;

  titleInput.value = documentRecord.title;

  function announce(message) {
    const region = document.getElementById('announcer');
    if (region) region.textContent = message;
  }

  function setStatus(state, label) {
    status.dataset.state = state;
    status.textContent = label;
    announce(label);
  }

  function activeSide() {
    return window.matchMedia('(max-width: 760px)').matches && currentPage % 2 === 1 ? 'right' : 'left';
  }

  function applyBookSize() {
    const smallScreen = window.matchMedia('(max-width: 760px)').matches;
    const available = Math.max(280, stage.clientWidth - (smallScreen ? 18 : 42));
    const baseWidth = smallScreen ? Math.min(440, available) : Math.min(430, available / 2);
    const pageWidth = Math.max(240, baseWidth * zoom);
    const pageHeight = pageWidth * 1.38;
    const fontSize = Math.max(14, Math.min(17, pageWidth * 0.043));
    stage.style.setProperty('--page-width', `${pageWidth}px`);
    stage.style.setProperty('--page-height', `${pageHeight}px`);
    stage.style.setProperty('--book-font-size', `${fontSize}px`);
    viewport.style.width = `${smallScreen ? pageWidth : pageWidth * 2}px`;
    viewport.style.height = `${pageHeight}px`;
    return { pageWidth, pageHeight, fontSize };
  }

  function measureOptions() {
    const { pageWidth, pageHeight, fontSize } = applyBookSize();
    return {
      width: Math.max(100, pageWidth * 0.73 - 2),
      height: Math.max(100, pageHeight * 0.73 - 7),
      lineHeight: fontSize * 1.64,
      font: `400 ${fontSize}px "Minebook", "Courier New", monospace`,
    };
  }

  function getPageElements() {
    return [...track.querySelectorAll('.page-content[data-page-index]')];
  }

  function updateNavigation() {
    const total = Math.max(1, pages.length);
    currentPage = Math.max(0, Math.min(currentPage, total - 1));
    const smallScreen = window.matchMedia('(max-width: 760px)').matches;
    const first = smallScreen ? currentPage : Math.floor(currentPage / 2) * 2;
    const last = smallScreen ? first : Math.min(first + 1, total - 1);
    pageCount.textContent = smallScreen || last === first
      ? `Página ${first + 1} de ${total}`
      : `Páginas ${first + 1}–${last + 1} de ${total}`;
    previousButton.disabled = smallScreen ? currentPage === 0 : first === 0;
    nextButton.disabled = smallScreen ? currentPage >= total - 1 : first + 2 >= total;
  }

  function moveBookToCurrentPage(animate = true) {
    const smallScreen = window.matchMedia('(max-width: 760px)').matches;
    const width = Number.parseFloat(stage.style.getPropertyValue('--page-width')) || 380;
    const spreadIndex = Math.floor(currentPage / 2);
    const sideOffset = smallScreen && currentPage % 2 === 1 ? width : 0;
    const offset = spreadIndex * width * 2 + sideOffset;
    if (!animate) track.style.transition = 'none';
    for (const spread of track.querySelectorAll('.book-spread')) {
      spread.dataset.activeSide = activeSide();
    }
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    if (!animate) requestAnimationFrame(() => { track.style.transition = ''; });
    updateNavigation();
  }

  function createPage(page, index, side) {
    const pageElement = document.createElement('section');
    pageElement.className = `book-page book-page--${side}${page ? '' : ' book-page--blank'}`;
    pageElement.dataset.folio = page ? String(index + 1).padStart(2, '0') : '';
    pageElement.setAttribute('aria-label', page ? `Página ${index + 1}` : 'Página em branco');

    const content = document.createElement('div');
    content.className = 'page-content';
    content.dataset.pageIndex = String(page ? index : -1);
    content.dataset.start = String(page?.start ?? documentRecord.content.length);
    content.dataset.end = String(page?.end ?? documentRecord.content.length);
    if (page?.text) content.textContent = page.text;
    pageElement.append(content);
    return pageElement;
  }

  function renderPages(selection = null, animate = true) {
    if (destroyed || reflowing) return;
    reflowing = true;
    const options = measureOptions();
    const nextPages = paginateText(documentRecord.content, options);
    pages = nextPages;
    const spreadCount = Math.max(1, Math.ceil(nextPages.length / 2));
    const fragment = document.createDocumentFragment();

    for (let spreadIndex = 0; spreadIndex < spreadCount; spreadIndex += 1) {
      const spread = document.createElement('div');
      spread.className = 'book-spread';
      spread.dataset.spreadIndex = String(spreadIndex);
      spread.dataset.activeSide = activeSide();
      spread.append(createPage(nextPages[spreadIndex * 2], spreadIndex * 2, 'left'));
      spread.append(createPage(nextPages[spreadIndex * 2 + 1], spreadIndex * 2 + 1, 'right'));
      fragment.append(spread);
    }
    track.replaceChildren(fragment);
    currentPage = Math.min(currentPage, nextPages.length - 1);
    moveBookToCurrentPage(animate);
    reflowing = false;
    if (selection) restoreSelection(selection.anchor, selection.focus);
  }

  function globalOffset(container, node, offset) {
    const pageIndex = Number(container.dataset.pageIndex);
    if (pageIndex < 0) return documentRecord.content.length;
    const start = Number(container.dataset.start) || 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.setEnd(node, offset);
      return Math.max(0, Math.min(documentRecord.content.length, start + range.toString().length));
    } catch {
      return start;
    }
  }

  function pageContainerFor(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element !== track) {
      if (element.matches?.('.page-content[data-page-index]')) return element;
      element = element.parentElement;
    }
    return null;
  }

  function captureSelection() {
    // O DOM de cada página é uma faixa da string única; mapear o cursor antes de repaginar preserva sua posição real.
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return { anchor: documentRecord.content.length, focus: documentRecord.content.length };
    const anchorContainer = pageContainerFor(selection.anchorNode);
    const focusContainer = pageContainerFor(selection.focusNode);
    if (!anchorContainer || !focusContainer) return { anchor: documentRecord.content.length, focus: documentRecord.content.length };
    return {
      anchor: globalOffset(anchorContainer, selection.anchorNode, selection.anchorOffset),
      focus: globalOffset(focusContainer, selection.focusNode, selection.focusOffset),
    };
  }

  function nodePosition(container, localOffset) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let remaining = localOffset;
    let last = null;
    while (node) {
      last = node;
      if (remaining <= node.nodeValue.length) return { node, offset: remaining };
      remaining -= node.nodeValue.length;
      node = walker.nextNode();
    }
    if (last) return { node: last, offset: last.nodeValue.length };
    return { node: container, offset: 0 };
  }

  function restoreSelection(anchorOffset, focusOffset = anchorOffset) {
    const selection = window.getSelection();
    if (!selection || !pages.length) return;
    const boundedAnchor = Math.max(0, Math.min(anchorOffset, documentRecord.content.length));
    const boundedFocus = Math.max(0, Math.min(focusOffset, documentRecord.content.length));
    const anchorIndex = pageIndexAt(pages, boundedAnchor);
    const focusIndex = pageIndexAt(pages, boundedFocus);
    const anchorPage = track.querySelector(`.page-content[data-page-index="${anchorIndex}"]`);
    const focusPage = track.querySelector(`.page-content[data-page-index="${focusIndex}"]`);
    if (!anchorPage || !focusPage) return;
    currentPage = focusIndex;
    moveBookToCurrentPage(false);
    const anchor = nodePosition(anchorPage, boundedAnchor - (Number(anchorPage.dataset.start) || 0));
    const focus = nodePosition(focusPage, boundedFocus - (Number(focusPage.dataset.start) || 0));
    try {
      selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
    } catch {
      const range = document.createRange();
      range.setStart(anchor.node, anchor.offset);
      range.setEnd(focus.node, focus.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function setCurrentPage(index, animate = true) {
    currentPage = Math.max(0, Math.min(index, pages.length - 1));
    moveBookToCurrentPage(animate);
  }

  function textForCurrentDOM() {
    return getPageElements()
      .filter((element) => Number(element.dataset.pageIndex) >= 0)
      .map((element) => contentFromNode(element).replace(/\r\n?/gu, '\n'))
      .join('');
  }

  function notifyChanged() {
    documentRecord.updatedAt = new Date().toISOString();
    isDirty = true;
    editRevision += 1;
    setStatus('unsaved', 'Alterações não salvas');
    callbacks.onDocumentUpdated?.({ ...documentRecord });
    clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(() => {
      if (!storeRecovery(documentRecord)) setStatus('error', 'Cópia de segurança indisponível');
    }, RECOVERY_DELAY);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { void saveNow(); }, SAVE_DELAY);
  }

  function remember(previous) {
    const selection = captureSelection() || { anchor: previous.length, focus: previous.length };
    undoStack.push({ content: previous, ...selection });
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack.length = 0;
  }

  function updateContent(nextContent, selection = null, recordHistory = true) {
    if (nextContent === documentRecord.content) {
      if (selection) restoreSelection(selection.anchor, selection.focus);
      return;
    }
    if (recordHistory) remember(documentRecord.content);
    documentRecord.content = nextContent;
    renderPages(selection);
    notifyChanged();
  }

  function deleteRange(start, end, direction) {
    if (start !== end) return [start, end];
    if (direction === 'backward') return [previousBoundary(documentRecord.content, start), end];
    return [start, nextBoundary(documentRecord.content, end)];
  }

  function insertAtSelection(value) {
    const selected = captureSelection();
    const start = Math.min(selected.anchor, selected.focus);
    const end = Math.max(selected.anchor, selected.focus);
    const text = String(value ?? '').replace(/\r\n?/gu, '\n');
    const nextContent = documentRecord.content.slice(0, start) + text + documentRecord.content.slice(end);
    updateContent(nextContent, { anchor: start + text.length, focus: start + text.length });
  }

  function undo() {
    if (!undoStack.length) return;
    const current = documentRecord.content;
    const currentSelection = captureSelection() || { anchor: current.length, focus: current.length };
    const previous = undoStack.pop();
    redoStack.push({ content: current, ...currentSelection });
    documentRecord.content = previous.content;
    renderPages({ anchor: previous.anchor, focus: previous.focus });
    notifyChanged();
  }

  function redo() {
    if (!redoStack.length) return;
    const current = documentRecord.content;
    const currentSelection = captureSelection() || { anchor: current.length, focus: current.length };
    const next = redoStack.pop();
    undoStack.push({ content: current, ...currentSelection });
    documentRecord.content = next.content;
    renderPages({ anchor: next.anchor, focus: next.focus });
    notifyChanged();
  }

  function handleBeforeInput(event) {
    if (!event.cancelable || event.isComposing || compositionActive) return;
    const selection = captureSelection();
    const start = Math.min(selection.anchor, selection.focus);
    const end = Math.max(selection.anchor, selection.focus);
    const inputType = event.inputType;

    if (inputType === 'historyUndo') { event.preventDefault(); undo(); return; }
    if (inputType === 'historyRedo') { event.preventDefault(); redo(); return; }
    if (inputType === 'insertText' || inputType === 'insertReplacementText' || inputType === 'insertFromYank') {
      if (event.data == null) return;
      event.preventDefault();
      insertAtSelection(event.data);
      return;
    }
    if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
      event.preventDefault();
      insertAtSelection('\n');
      return;
    }
    if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
      const text = event.dataTransfer?.getData('text/plain') || event.data || '';
      event.preventDefault();
      insertAtSelection(text);
      return;
    }
    if (inputType === 'deleteContentBackward' || inputType === 'deleteWordBackward' || inputType === 'deleteSoftLineBackward') {
      event.preventDefault();
      let range = deleteRange(start, end, 'backward');
      if (start === end && inputType === 'deleteWordBackward') {
        const prefix = documentRecord.content.slice(0, start);
        const match = prefix.match(/[\s\S]*?([\p{L}\p{N}_]+\s*)$/u);
        if (match) range = [start - match[1].length, end];
      }
      updateContent(documentRecord.content.slice(0, range[0]) + documentRecord.content.slice(range[1]), { anchor: range[0], focus: range[0] });
      return;
    }
    if (inputType === 'deleteContentForward' || inputType === 'deleteWordForward' || inputType === 'deleteSoftLineForward') {
      event.preventDefault();
      let range = deleteRange(start, end, 'forward');
      if (start === end && inputType === 'deleteWordForward') {
        const suffix = documentRecord.content.slice(end);
        const match = suffix.match(/^(\s*[\p{L}\p{N}_]+)/u);
        if (match) range = [start, end + match[1].length];
      }
      updateContent(documentRecord.content.slice(0, range[0]) + documentRecord.content.slice(range[1]), { anchor: range[0], focus: range[0] });
      return;
    }
    if (/^delete/u.test(inputType)) {
      event.preventDefault();
      updateContent(documentRecord.content.slice(0, start) + documentRecord.content.slice(end), { anchor: start, focus: start });
    }
  }

  async function saveNow() {
    // Grava um snapshot imutável e só limpa o estado sujo se nenhuma revisão posterior entrou na fila.
    if (savePromise) {
      return savePromise.then((saved) => saved && isDirty ? saveNow() : saved);
    }
    clearTimeout(saveTimer);
    clearTimeout(retryTimer);
    if (!isDirty && lastSavedAt) {
      setStatus('saved', `Salvo ${formatTimestamp(lastSavedAt)}`);
      return true;
    }
    const snapshot = { ...documentRecord };
    const snapshotRevision = editRevision;
    setStatus('saving', 'Salvando...');
    storeRecovery(snapshot);
    const operation = (async () => {
      try {
        await saveDocument(snapshot);
        lastSavedAt = snapshot.updatedAt;
        if (editRevision === snapshotRevision) {
          clearRecovery(snapshot.id);
          isDirty = false;
          setStatus('saved', `Salvo ${formatTimestamp(lastSavedAt)}`);
          callbacks.onDocumentUpdated?.({ ...documentRecord });
        } else {
          isDirty = true;
          storeRecovery(documentRecord);
          setStatus('unsaved', 'Alterações não salvas');
        }
        return true;
      } catch {
        setStatus('error', 'Não foi possível salvar. Tentando novamente...');
        storeRecovery(documentRecord);
        retryTimer = window.setTimeout(() => { void saveNow(); }, 4000);
        return false;
      }
    })();
    savePromise = operation;
    const saved = await operation;
    if (savePromise === operation) savePromise = null;
    if (saved && isDirty && !destroyed) return saveNow();
    return saved;
  }

  function scheduleReflow() {
    if (destroyed) return;
    const activeSelection = window.getSelection();
    const hasEditorSelection = activeSelection?.rangeCount && pageContainerFor(activeSelection.anchorNode) && pageContainerFor(activeSelection.focusNode);
    const selection = hasEditorSelection ? captureSelection() : null;
    const previousPages = pages;
    renderPages(selection, false);
    if (previousPages.length !== pages.length) announce(`Documento reorganizado em ${pages.length} páginas.`);
  }

  function syncNativeInput() {
    if (compositionActive || destroyed) return;
    const selection = captureSelection();
    const next = textForCurrentDOM();
    if (next !== documentRecord.content) updateContent(next, selection);
  }

  function onSelectionChange() {
    if (destroyed || !track.contains(window.getSelection()?.anchorNode)) return;
    const container = pageContainerFor(window.getSelection().anchorNode);
    if (!container) return;
    const index = Number(container.dataset.pageIndex);
    const nextPage = index < 0 ? Math.max(0, pages.length - 1) : index;
    if (nextPage !== currentPage) setCurrentPage(nextPage, true);
  }

  function onKeyDown(event) {
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && event.shiftKey) { event.preventDefault(); redo(); }
    else if (key === 'z') { event.preventDefault(); undo(); }
    else if (key === 'y') { event.preventDefault(); redo(); }
  }

  function onPaste(event) {
    const text = event.clipboardData?.getData('text/plain');
    event.preventDefault();
    if (text != null) insertAtSelection(text);
  }

  function onDrop(event) {
    event.preventDefault();
    const text = event.dataTransfer?.getData('text/plain');
    if (text != null) insertAtSelection(text);
  }

  function onCopy(event) {
    const selection = captureSelection();
    if (selection.anchor === selection.focus) return;
    const selectedText = documentRecord.content.slice(Math.min(selection.anchor, selection.focus), Math.max(selection.anchor, selection.focus));
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', selectedText);
  }

  function onCut(event) {
    const selection = captureSelection();
    if (selection.anchor === selection.focus) return;
    const start = Math.min(selection.anchor, selection.focus);
    const end = Math.max(selection.anchor, selection.focus);
    if (event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', documentRecord.content.slice(start, end));
    }
    updateContent(documentRecord.content.slice(0, start) + documentRecord.content.slice(end), { anchor: start, focus: start });
  }

  function updateTitle(value) {
    if (documentRecord.title === value) return;
    documentRecord.title = value;
    notifyChanged();
  }

  function onTitleInput() {
    updateTitle(titleInput.value);
  }

  function updateZoom(delta) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((zoom + delta) * 10) / 10));
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    const activeSelection = window.getSelection();
    const hasEditorSelection = activeSelection?.rangeCount && pageContainerFor(activeSelection.anchorNode) && pageContainerFor(activeSelection.focusNode);
    const selection = hasEditorSelection ? captureSelection() : null;
    renderPages(selection, false);
  }

  track.addEventListener('beforeinput', handleBeforeInput);
  track.addEventListener('input', syncNativeInput);
  track.addEventListener('keydown', onKeyDown);
  track.addEventListener('paste', onPaste);
  track.addEventListener('drop', onDrop);
  track.addEventListener('copy', onCopy);
  track.addEventListener('cut', onCut);
  track.addEventListener('compositionstart', () => { compositionActive = true; });
  track.addEventListener('compositionend', () => {
    compositionActive = false;
    window.setTimeout(syncNativeInput, 0);
  });
  track.addEventListener('click', (event) => {
    const container = event.target.closest('.page-content');
    if (!container) return;
    const index = Number(container.dataset.pageIndex);
    setCurrentPage(index < 0 ? pages.length - 1 : index, true);
  });
  document.addEventListener('selectionchange', onSelectionChange);
  titleInput.addEventListener('input', onTitleInput);
  root.querySelector('[data-action="save"]').addEventListener('click', () => { void saveNow(); });
  root.querySelector('[data-action="back"]').addEventListener('click', () => callbacks.onBack?.());
  previousButton.addEventListener('click', () => {
    const step = window.matchMedia('(max-width: 760px)').matches ? 1 : 2;
    setCurrentPage(Math.max(0, Math.floor(currentPage / step) * step - step));
  });
  nextButton.addEventListener('click', () => {
    const step = window.matchMedia('(max-width: 760px)').matches ? 1 : 2;
    setCurrentPage(Math.min(pages.length - 1, Math.floor(currentPage / step) * step + step));
  });
  root.querySelector('[data-action="zoom-out"]').addEventListener('click', () => updateZoom(-ZOOM_STEP));
  root.querySelector('[data-action="zoom-in"]').addEventListener('click', () => updateZoom(ZOOM_STEP));

  const resizeObserver = new ResizeObserver(scheduleReflow);
  resizeObserver.observe(stage);
  const onViewportChange = () => scheduleReflow();
  window.matchMedia('(max-width: 760px)').addEventListener?.('change', onViewportChange);

  function recoverBeforeExit() {
    if (isDirty) {
      storeRecovery(documentRecord);
      void saveNow();
    }
  }
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && isDirty) {
      storeRecovery(documentRecord);
      void saveNow();
    }
  }
  window.addEventListener('pagehide', recoverBeforeExit);
  document.addEventListener('visibilitychange', onVisibilityChange);

  applyBookSize();
  renderPages(null, false);
  if (document.fonts?.ready) document.fonts.ready.then(() => { if (!destroyed) scheduleReflow(); });
  lastSavedAt = documentRecord.updatedAt || null;
  isDirty = false;
  setStatus('saved', lastSavedAt ? `Salvo ${formatTimestamp(lastSavedAt)}` : 'Livro em branco');

  return {
    id: documentRecord.id,
    get document() { return { ...documentRecord }; },
    saveNow,
    async close() {
      if (!isDirty) return true;
      const saved = await saveNow();
      if (saved) return true;
      storeRecovery(documentRecord);
      return window.confirm('O salvamento ainda não terminou. Uma cópia de recuperação foi mantida neste navegador. Deseja voltar mesmo assim?');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(saveTimer);
      clearTimeout(recoveryTimer);
      clearTimeout(retryTimer);
      resizeObserver.disconnect();
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', recoverBeforeExit);
      titleInput.removeEventListener('input', onTitleInput);
      track.removeEventListener('beforeinput', handleBeforeInput);
      track.removeEventListener('input', syncNativeInput);
      track.removeEventListener('paste', onPaste);
      track.removeEventListener('drop', onDrop);
      window.matchMedia('(max-width: 760px)').removeEventListener?.('change', onViewportChange);
    },
  };
}
