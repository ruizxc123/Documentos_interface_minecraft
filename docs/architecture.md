# Arquitetura do Livro

## Visão geral

Livro é uma aplicação web estática, em português, para organizar documentos em uma biblioteca e editá-los em uma interface visual de livro. O escopo atual é local e individual: não há autenticação, backend, sincronização, colaboração, exportação ou busca na biblioteca.

## Princípios de implementação

- **Conteúdo simples:** cada documento tem um título e uma única string de texto. A apresentação paginada não altera o conteúdo armazenado.
- **Sem dependências de produção:** HTML, CSS e módulos JavaScript nativos são servidos como arquivos estáticos.
- **Privacidade local:** documentos são mantidos no navegador e não enviados a um serviço remoto pela aplicação.
- **Acessibilidade e leitura:** controles semânticos, estados acessíveis, foco visível e layout responsivo.

## Módulos

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Metadados, política CSP, estilos e carregamento do módulo principal. |
| `src/main.js` | Inicialização, navegação por hash, ações da biblioteca e diálogos. |
| `src/library.js` | Estante, cartões, prévias e ações dos documentos. |
| `src/book-editor.js` | Edição, seleção, histórico, paginação visual, salvamento e recuperação. |
| `src/pagination.js` | Cálculo de linhas e páginas a partir da string canônica. |
| `src/storage.js` | IndexedDB, fallback local, recuperação e validação dos registros. |
| `src/styles.css` | Identidade visual, layout responsivo, estados e movimento reduzido. |
| `eslint.config.js` | Regras recomendadas para detectar erros JavaScript antes da publicação. |
| `assets/` | Ícone da aplicação, fonte local e licença da fonte. |
| `tests/` | Testes automatizados de paginação e persistência. |

## Navegação e edição

A aplicação tem uma página principal. A biblioteca e o editor são selecionados por um fragmento de URL com identificador do documento. A edição ocorre numa área de texto simples. Quebras visuais são calculadas em Canvas de acordo com as dimensões disponíveis; quebras manuais continuam fazendo parte do conteúdo. Telas grandes exibem duas páginas e telas estreitas, uma de cada vez.

A seleção é traduzida para posições na string canônica antes de cada repaginação. Digitação, colagem em texto simples, desfazer, refazer e navegação entre páginas operam sobre o mesmo conteúdo. O zoom afeta apenas a apresentação.

## Persistência

O IndexedDB é o armazenamento principal. `localStorage` contém uma cópia de fallback, rascunhos de recuperação e marcadores de exclusão para evitar o reaparecimento de dados removidos. Registros lidos são validados antes de serem usados. O salvamento automático tem atraso curto, e uma tentativa adicional é feita quando a página é ocultada ou fechada.

Formato lógico de um documento:

```text
{
  id: string,
  title: string,
  content: string,
  createdAt: ISO-8601 string,
  updatedAt: ISO-8601 string
}
```

Os dados não são sincronizados, criptografados nem copiados para fora do navegador. Limpar o armazenamento do site pode apagá-los.

## Segurança

- A entrada HTML define uma Content Security Policy restritiva para os recursos usados pela aplicação.
- O editor aceita texto simples e bloqueia colagem/arraste de HTML.
- A camada de armazenamento valida IDs, tipos e datas; os cartões escapam textos dinâmicos.
- A dimensão `style-src 'unsafe-inline'` da CSP é necessária para aplicar medidas de página calculadas em tempo de execução.
- A hospedagem deve usar HTTPS e configurar cabeçalhos HTTP adicionais, incluindo `frame-ancestors`, conforme [SECURITY.md](../SECURITY.md).

## Desenvolvimento e testes

Sirva a raiz do repositório por HTTP. Para desenvolvimento local, use `python3 -m http.server 3000` e abra `http://localhost:3000`.

Execute `npm ci`, `npm run lint`, `npm test` e `npm run check` para instalar dependências fixadas, verificar qualidade estática, executar a suíte automatizada e conferir sintaxe. O workflow em `.github/workflows/quality.yml` executa os mesmos controles em pushes e pull requests para `main`.
