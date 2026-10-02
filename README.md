# 📖 Livro — Caderno Digital de Documentos

Uma aplicação web inspirada nos livros do Minecraft para criar, escrever, salvar e organizar documentos.

A proposta é trazer a experiência de um editor de documentos para dentro de um livro digital. Em vez de usar um editor tradicional, você escreve diretamente nas páginas, podendo criar diferentes documentos e acessá-los posteriormente.

🌐 **Acesse o projeto:**

[**Documentos Minecraft**](https://ruizxc123.github.io/Documentos_minecraf/)

---

## ✨ Recursos

- 📚 Criar, abrir, renomear e excluir documentos.
- ✏️ Editor paginado e responsivo.
- 🔍 Controle de zoom.
- ↩️ Desfazer e refazer alterações.
- 💾 Salvamento automático.
- 🔄 Recuperação local dos documentos.
- 🗃️ Persistência usando `IndexedDB`, com fallback para `localStorage`.
- ⌨️ Navegação por teclado.
- ♿ Avisos e elementos de interface acessíveis.
- 📋 Colagem e arraste de conteúdo como texto simples.

A aplicação funciona sem backend, contas de usuário ou dependências de produção.

---

## 🛠️ Tecnologias

- HTML
- CSS
- JavaScript
- IndexedDB
- LocalStorage
- Node.js
- ESLint
- GitHub Actions

---

## 📋 Requisitos

Para executar o projeto localmente, você precisa de:

- Um navegador moderno com suporte a módulos JavaScript, IndexedDB e armazenamento local.
- Python 3 ou outro servidor HTTP estático.
- Node.js 22.13 ou superior para executar os testes e verificações.

---

## 🚀 Início rápido

Clone o repositório e, na raiz do projeto, execute:

```bash
python3 -m http.server 3000
```

Depois, abra:

```text
http://localhost:3000
```

O projeto precisa ser executado por HTTP. Abrir o `index.html` diretamente como arquivo pode impedir o carregamento correto dos módulos ES.

---

## 🧪 Testes

Para instalar as dependências e executar as verificações:

```bash
npm ci
npm test
npm run lint
npm run check
```

Os testes utilizam o executor nativo do Node.js.

O ESLint é utilizado apenas durante o desenvolvimento. A aplicação não depende de bibliotecas de terceiros para funcionar em produção.

O GitHub Actions executa automaticamente lint, testes e verificação sintática em pushes e pull requests para a branch `main`.

---

## 📁 Estrutura do projeto

```text
.
├── .github/workflows/       # Automação de qualidade
├── assets/
│   ├── favicon.svg          # Ícone da aplicação
│   └── fonts/               # Fonte local e licença
├── docs/
│   └── architecture.md      # Arquitetura e decisões técnicas
├── eslint.config.js         # Regras de JavaScript
├── src/                     # Código da aplicação
├── tests/                   # Testes de paginação e persistência
├── index.html               # Ponto de entrada
├── package.json             # Scripts e requisitos do Node.js
├── package-lock.json        # Dependências de desenvolvimento
├── SECURITY.md              # Segurança e reporte
└── THIRD_PARTY_NOTICES.md   # Atribuições de terceiros
```

---

## 🔒 Privacidade e armazenamento

Os documentos são armazenados localmente no navegador utilizado para acessar a aplicação.

O projeto não envia os documentos para um backend, não realiza sincronização entre dispositivos e não criptografa os dados.

Por isso, limpar os dados do site pode apagar os documentos permanentemente. Para conteúdos importantes, mantenha cópias externas.

Atualmente, a aplicação não possui exportação ou backup remoto.

---

## 🛡️ Segurança

A aplicação possui medidas de segurança no lado do cliente, incluindo:

- Política de Segurança de Conteúdo.
- Validação dos registros persistidos.
- Renderização do conteúdo do usuário como texto.

Essas medidas ajudam a reduzir riscos no navegador, mas não substituem o uso de HTTPS e de cabeçalhos de segurança na hospedagem.

Mais informações:

- [SECURITY.md](SECURITY.md)
- [Documentação da arquitetura](docs/architecture.md)

---

## 🎮 Fonte utilizada

A fonte incluída no projeto é o **Minecraft-Font**, de Idrees Hassan, distribuído sob a **SIL Open Font License 1.1**.

As informações de atribuição e licença estão disponíveis em:

- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- `assets/fonts/LICENSE-Minecraft.txt`

O projeto é independente e não possui afiliação com a Mojang ou com o Minecraft.

---

## 📄 Licença

O repositório não declara atualmente uma licença para o código da aplicação.

Até que uma licença seja adicionada pelo titular, o código não deve ser presumido como liberado para reutilização, distribuição ou modificação.

---

## 📖 Sobre o projeto

**Livro — Caderno Digital de Documentos** transforma a ideia tradicional de um editor de texto em uma experiência baseada em livros digitais, mantendo recursos de edição e armazenamento local dentro de uma interface inspirada nos livros do Minecraft.
