function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDate(value) {
  if (!value) return 'Ainda sem edição';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ainda sem edição';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay) return `Hoje, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function cardMarkup(document) {
  const title = escapeHTML(document.title || 'Documento sem título');
  const preview = escapeHTML((document.content || '').replace(/\s+/gu, ' ').trim().slice(0, 110));
  const updated = escapeHTML(formatDate(document.updatedAt || document.createdAt));
  const bookColors = ['fern', 'ink', 'clay', 'moss'];
  const color = bookColors[parseInt(document.id.slice(-1), 16) % bookColors.length] || 'fern';
  return `
    <article class="document-card" data-document-id="${escapeHTML(document.id)}">
      <button class="document-cover cover-${color}" type="button" data-action="open" aria-label="Abrir ${title}">
        <span class="cover-corner" aria-hidden="true"></span>
        <span class="cover-bookmark" aria-hidden="true"></span>
        <span class="cover-ornament" aria-hidden="true">✦</span>
        <span class="cover-title">${title}</span>
        <span class="cover-subtitle">CADERNO DE IDEIAS</span>
        <span class="cover-lines" aria-hidden="true"></span>
      </button>
      <div class="card-info">
        <div class="card-heading">
          <button class="card-title" type="button" data-action="open">${title}</button>
          <div class="card-actions">
            <button class="icon-button card-menu-button" type="button" data-action="rename" aria-label="Renomear ${title}" title="Renomear documento">✎</button>
            <button class="icon-button card-menu-button danger-icon" type="button" data-action="delete" aria-label="Excluir ${title}" title="Excluir documento">×</button>
          </div>
        </div>
        <p class="card-preview">${preview || 'Uma página em branco, pronta para receber sua próxima ideia.'}</p>
        <p class="card-date"><span class="status-dot" aria-hidden="true"></span> Editado ${updated}</p>
      </div>
    </article>`;
}

export function renderLibrary(root, documents, callbacks) {
  const count = documents.length;
  const cards = documents.map(cardMarkup).join('');
  root.innerHTML = `
    <div class="library-shell">
      <header class="library-topbar">
        <a class="brand" href="#" aria-label="Livro — início">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>livro<span class="brand-period">.</span></span>
        </a>
        <div class="topbar-note"><span class="topbar-spark" aria-hidden="true">✦</span> seu espaço de ideias</div>
      </header>
      <main class="library-main">
        <section class="library-heading" aria-labelledby="library-title">
          <div class="heading-copy">
            <p class="eyebrow">SUA ESTANTE DIGITAL <span class="eyebrow-line"></span></p>
            <h1 id="library-title">Meus <em>documentos</em></h1>
            <p class="library-description">Cada ideia merece um lugar para crescer.</p>
          </div>
          <button class="primary-button new-document-button" type="button" data-action="new">
            <span class="button-plus" aria-hidden="true">+</span> Novo documento
          </button>
        </section>
        <div class="library-meta" aria-live="polite">
          <span>${count === 1 ? '1 livro na estante' : `${count} livros na estante`}</span>
          <span class="meta-rule"></span>
          <span class="meta-hint">seus rascunhos ficam neste navegador</span>
        </div>
        ${count ? `<section class="document-shelf" aria-label="Documentos salvos">${cards}<div class="shelf-edge" aria-hidden="true"></div></section>` : `
          <section class="empty-state" aria-labelledby="empty-title">
            <div class="empty-book" aria-hidden="true"><span></span><i></i></div>
            <div class="empty-copy">
              <p class="eyebrow">UM COMEÇO EM BRANCO</p>
              <h2 id="empty-title">Sua próxima ideia<br /><em>começa aqui.</em></h2>
              <p>Abra um livro novo. As palavras ficam guardadas por aqui, prontas para quando você voltar.</p>
              <button class="text-button" type="button" data-action="new">Criar meu primeiro documento <span aria-hidden="true">↗</span></button>
            </div>
            <span class="empty-index" aria-hidden="true">01 / 01</span>
          </section>`}
        <footer class="library-footer"><span>Feito para pensar com calma.</span><span class="footer-mark" aria-hidden="true">◈</span><span>Seus livros, só seus.</span></footer>
      </main>
    </div>`;

  root.querySelector('[data-action="new"]')?.addEventListener('click', callbacks.onNew);
  root.querySelectorAll('.document-card').forEach((card) => {
    const id = card.dataset.documentId;
    card.querySelectorAll('[data-action="open"]').forEach((button) => button.addEventListener('click', () => callbacks.onOpen(id)));
    card.querySelector('[data-action="rename"]')?.addEventListener('click', () => callbacks.onRename(id));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => callbacks.onDelete(id));
  });
}
