# Livro — caderno digital de documentos

Aplicação web estática para escrever e organizar ideias em uma interface de livro. O projeto foi pensado para ser simples de executar, sem backend, dependências de produção ou conta de usuário.

## Recursos

- Criar, abrir, renomear e excluir documentos.
- Editor paginado com quebra visual responsiva, zoom, desfazer e refazer.
- Salvamento automático e cópia local de recuperação.
- Persistência prioritária no IndexedDB, com fallback para `localStorage`.
- Interface em português, navegação por teclado e avisos acessíveis.
- Colagem e arraste de conteúdo apenas como texto simples.

## Requisitos

- Navegador moderno com suporte a módulos JavaScript, IndexedDB e armazenamento local.
- Python 3 para servir os arquivos localmente (alternativamente, qualquer servidor HTTP estático).
- Node.js 22 ou superior para executar os testes e verificações.

## Executar localmente

Na raiz do repositório, inicie um servidor HTTP:

```bash
python3 -m http.server 3000
```

Acesse <http://localhost:3000>. Não abra `index.html` diretamente como arquivo: os módulos ES precisam ser servidos por HTTP.

## Testes e verificações

```bash
npm test
npm run check
```

Os testes usam o executor nativo do Node.js e não exigem bibliotecas de terceiros. A integração contínua executa os mesmos comandos em pushes e pull requests.

## Estrutura do projeto

```text
.
├── index.html                 # Entrada da aplicação e política CSP
├── src/
│   ├── main.js                # Inicialização, rotas e ações da biblioteca
│   ├── library.js             # Estante e cartões de documentos
│   ├── book-editor.js         # Edição, paginação visual e salvamento
│   ├── pagination.js          # Quebra de texto em páginas
│   ├── storage.js             # IndexedDB, fallback e recuperação
│   └── styles.css             # Estilos e comportamento responsivo
├── tests/                     # Testes de paginação e persistência
├── fonts/                     # Fonte e licença correspondentes
├── SECURITY.md                # Modelo de segurança e reporte de vulnerabilidades
└── THIRD_PARTY_NOTICES.md     # Atribuições de componentes de terceiros
```

## Privacidade e armazenamento

Os documentos permanecem no armazenamento do navegador usado para acessar a aplicação. Eles **não são enviados a um servidor**, sincronizados entre dispositivos nem criptografados pela aplicação. Limpar os dados do site no navegador pode apagá-los permanentemente; mantenha cópias externas de qualquer conteúdo importante. A aplicação não implementa exportação ou backup remoto.

## Segurança

A aplicação aplica uma política de segurança de conteúdo, renderiza títulos e prévias escapados e aceita conteúdo do editor como texto simples. Essas medidas reduzem riscos no cliente, mas não substituem HTTPS e cabeçalhos de segurança configurados no servidor de hospedagem. Consulte [SECURITY.md](SECURITY.md) antes de publicar ou relatar uma vulnerabilidade.

## Fonte e atribuições

A fonte Minecraft-Font incluída no projeto é de Idrees Hassan, sob a SIL Open Font License 1.1. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e `fonts/LICENSE-Minecraft.txt`. O projeto é independente e não afiliado à Mojang ou à Minecraft.

## Licença do projeto

Este repositório não declara uma licença para o código da aplicação. Até que uma licença seja adicionada pelo titular, não presuma que o código esteja liberado para reutilização, distribuição ou modificação. A licença da fonte de terceiros permanece conforme os arquivos de atribuição e licença indicados acima.
