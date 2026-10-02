# Livro — caderno digital de documentos

A ideia é transformar a experiência de um documento do Google em uma interface inspirada nos livros do Minecraft. Em vez de escrever em um editor tradicional, você escreve diretamente nas páginas do livro, podendo criar, salvar e organizar seus documentos como livros digitais.Aplicação web estática para escrever e organizar ideias em uma interface de livro. Funciona sem backend, conta de usuário ou dependências de produção.

## Recursos

- Criar, abrir, renomear e excluir documentos.
- Editor paginado e responsivo com zoom, desfazer e refazer.
- Salvamento automático e recuperação local.
- Persistência no IndexedDB, com fallback para `localStorage`.
- Interface em português, navegação por teclado e avisos acessíveis.
- Colagem e arraste de conteúdo aceitos somente como texto simples.

## Requisitos

- Navegador moderno com suporte a módulos JavaScript, IndexedDB e armazenamento local.
- Python 3 ou outro servidor HTTP estático para desenvolvimento local.
- Node.js 22.13+ para executar testes e verificações.

## Início rápido

Na raiz do repositório, execute:

```bash
python3 -m http.server 3000
```

Acesse <http://localhost:3000>. O projeto precisa ser servido por HTTP; abrir `index.html` como arquivo não carrega os módulos ES corretamente.

## Testes

```bash
npm ci
npm test
npm run lint
npm run check
```

Os testes usam o executor nativo do Node.js. O ESLint é uma dependência apenas de desenvolvimento; a aplicação não precisa de bibliotecas de terceiros em produção. O GitHub Actions executa lint, testes e verificação sintática em pushes e pull requests para `main`.

## Estrutura

```text
.
├── .github/workflows/       # Automação de qualidade
├── assets/
│   ├── favicon.svg          # Ícone local da aplicação
│   └── fonts/               # Fonte local e licença
├── docs/
│   └── architecture.md      # Arquitetura, escopo e decisões técnicas
├── eslint.config.js          # Regras estáticas de JavaScript
├── src/                     # Código da aplicação
├── tests/                   # Testes de paginação e persistência
├── index.html               # Ponto de entrada
├── package.json             # Scripts e requisitos do Node.js
├── package-lock.json         # Dependências de desenvolvimento fixadas
├── SECURITY.md              # Modelo de segurança e reporte
└── THIRD_PARTY_NOTICES.md   # Atribuições de terceiros
```

## Privacidade e armazenamento

Os documentos ficam no armazenamento do navegador usado para acessar a aplicação. O código não envia os documentos a um backend, não sincroniza entre dispositivos e não criptografa os dados. Limpar os dados do site pode apagá-los permanentemente; mantenha cópias externas do conteúdo importante. Não há exportação nem backup remoto.

## Segurança

A aplicação inclui uma política de segurança de conteúdo, valida os registros persistidos e renderiza o conteúdo do usuário como texto. Essas medidas reduzem riscos no cliente, mas não substituem HTTPS e cabeçalhos de segurança na hospedagem. Consulte [SECURITY.md](SECURITY.md) e [a documentação de arquitetura](docs/architecture.md).

## Fonte e licença

A fonte incluída é o projeto Minecraft-Font, de Idrees Hassan, distribuído sob SIL Open Font License 1.1. A atribuição e a licença estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e `assets/fonts/LICENSE-Minecraft.txt`. O projeto é independente e não afiliado à Mojang ou à Minecraft.

O repositório não declara uma licença para o código da aplicação. Até que o titular adicione uma, não presuma que o código esteja liberado para reutilização, distribuição ou modificação.
