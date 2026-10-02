# Livro — editor de documentos em forma de livro

Projeto estático, sem dependências de build ou backend. Os documentos são guardados no armazenamento local do navegador.

## Executar localmente

Com Python 3 instalado, na pasta do projeto:

```sh
python3 -m http.server 3000
```

Abra `http://localhost:3000` no navegador.

## Testes

Com Node.js instalado, execute:

```sh
node --experimental-default-type=module --test tests/pagination.test.mjs tests/storage.test.mjs
```

A fonte e sua licença estão em `fonts/` e a atribuição em `THIRD_PARTY_NOTICES.md`.
