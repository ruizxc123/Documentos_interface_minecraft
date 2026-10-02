# Plano — Livro, documentos em forma de livro

## Produto e limites

Aplicação web em português com uma biblioteca moderna de documentos e um editor cuja página é o próprio campo de escrita, visualmente inspirado no livro Book and Quill de Minecraft. A HUD e o restante do jogo não fazem parte. O primeiro protótipo é local, sem autenticação, banco remoto, compartilhamento, colaboração, exportação ou busca da biblioteca. IndexedDB é a persistência principal; armazenamento local oferece recuperação e fallback. Os dados são próprios deste navegador, sem sincronização entre dispositivos.

## Direção visual

O movimento escolhido é editorial digital contemporâneo com materialidade de livro impresso e detalhes de pixel art. Os princípios são: priorizar conteúdo e livro; manter controles externos discretos; evocar a referência sem copiar a tela do jogo; preservar leitura confortável. A paleta combina entorno neutro de biblioteca, tinta verde-musgo como cor exclusiva de marca (#315b46) e papel marfim quente. Contrastes escuros mantêm legibilidade; o papel não escurece com o tema externo.

A biblioteca usa uma prateleira editorial responsiva. No editor há barra compacta, livro aberto dominante no palco e paginação/estado abaixo; no celular uma página aparece por vez. Motivos recorrentes são o emblema geométrico de livro aberto, a lombada central e o número de fólio. Criar, abrir e escrever são ações diretas; salvar comunica estado sem interromper a digitação. Viradas, se aplicáveis, são suaves e respeitam `prefers-reduced-motion`. A interface usa sans-serif de sistema e serif editorial; a escrita utiliza a fonte local Minecraft-Font de Idrees Hassan (faixa Latin-1 com acentos portugueses), distribuída sob SIL Open Font License 1.1, com `fonts/LICENSE-Minecraft.txt` e atribuição em `THIRD_PARTY_NOTICES.md`. O projeto não é afiliado à Mojang/Minecraft. Posicionamento: “um caderno digital que transforma cada documento em livro para escrever sem distrações”; personalidade tátil, tranquila e imaginativa. Voz curta e acolhedora: “Uma ideia merece um livro.” e “Salvo por aqui — continue quando quiser.” O wordmark “livro.” usa serif editorial com ícone original de páginas/lombada pixelada (`favicon.svg`).

## Implementação

Aplicação estática sem dependências de runtime ou serviços externos: HTML semântico, CSS responsivo e módulos JavaScript ES; serviço de desenvolvimento estático na porta Manus 3000, vinculado a `0.0.0.0`. A única rota de página é `/`; documentos são identificados por estado de hash e o manifesto da rota fica em `manus-routes.json` na raiz estática.

O conteúdo canônico é uma string de texto simples, separado da apresentação. IndexedDB armazena múltiplos documentos (`id`, `title`, `content`, timestamps); uma cópia local de recuperação reduz perdas em fechamento inesperado e oferece fallback quando IndexedDB não está disponível. Autosave com debounce, botão Salvar, estados acessíveis e tentativa de gravação ao ocultar/fechar.

A edição acontece diretamente em folhas `contenteditable`. As quebras visuais são faixas virtuais calculadas pela largura das palavras medida em Canvas com a fonte/tamanho correntes e pela altura disponível; as quebras manuais permanecem caracteres do documento. A interface mostra duas páginas em telas grandes e uma página por vez em celular. Recalcular não insere caracteres no conteúdo; palavras longas são quebradas em pontos de grafema apenas quando não cabem. A seleção/cursor é traduzida para offsets globais antes de repaginar. Escrita normal, colagem em texto simples, setas, atalhos, desfazer/refazer e seleção abrangendo as páginas atuam sobre uma única string; uma pilha de snapshots mantém undo/redo funcional quando os nós visuais são reorganizados. Zoom é apenas visual.

## Estrutura do projeto

- `index.html` — casca semântica, metadados e carregamento do módulo principal.
- `src/main.js` — bootstrap, navegação por hash, fluxo da biblioteca e modais.
- `src/library.js` — biblioteca, cartões, criação, renomeação, exclusão e prévias.
- `src/book-editor.js` — entrada direta, cursor/seleção, histórico, navegação, autosave e ciclo de edição.
- `src/pagination.js` — paginação por medição de texto/canvas e faixas sem mutação do conteúdo.
- `src/storage.js` — IndexedDB, fallback/recuperação local e operações de gravação.
- `src/styles.css` — identidade visual, folhas/lombada, estados, movimento reduzido e breakpoints.
- `fonts/Minecraft.otf` e `fonts/LICENSE-Minecraft.txt` — fonte local e licença.
- `manus-routes.json` — manifesto da única página real (`/`).
- `favicon.svg` — marca do navegador e imagem de logotipo da plataforma.
- `app.config.ts` — URL HTTPS literal do logotipo usado pelo metadado da plataforma.
- `tests/pagination.test.mjs` e `tests/storage.test.mjs` — verificações determinísticas de paginação e persistência local.

## Forma de servir

Servir os arquivos estáticos a partir da raiz do projeto, com ES modules na porta configurada 3000 e bind em `0.0.0.0`; não há API/backend. Confirmar que `/manus-routes.json` responde JSON estático em vez de fallback SPA. A prévia usa armazenamento do navegador; publicar é uma operação separada e não está presumida pelo pedido.
