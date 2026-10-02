# Segurança

## Escopo e modelo de ameaça

O Livro é uma aplicação estática executada no navegador. O conteúdo dos documentos fica no armazenamento local do navegador e não é transmitido a um serviço de backend pelo código deste repositório. Qualquer pessoa ou script que já consiga executar código na mesma origem do site pode, contudo, acessar esse armazenamento.

A aplicação não oferece criptografia dos documentos, autenticação, sincronização, backup remoto ou proteção contra malware, extensões maliciosas, perfis compartilhados ou acesso físico à sessão do navegador. Não armazene segredos ou informações sensíveis sem uma proteção adicional apropriada.

## Medidas atuais

- Política CSP declarada na entrada HTML para restringir scripts e recursos à própria origem, bloquear objetos e limitar formulários.
- Conteúdo do editor tratado como texto simples; colagem e arraste de HTML são bloqueados.
- Dados lidos do IndexedDB e do armazenamento local são validados e normalizados antes de serem usados.
- Títulos, prévias e identificadores inseridos nos cartões da biblioteca são escapados.
- Não há dependências de produção de terceiros.

A CSP precisa ser revisada caso sejam adicionados scripts, fontes, imagens ou serviços externos. A permissão `style-src 'unsafe-inline'` é usada porque a paginação aplica dimensões responsivas via estilos dinâmicos. A diretiva `frame-ancestors` não pode ser aplicada por uma tag `meta`; configure-a como cabeçalho HTTP na hospedagem.

## Recomendações para hospedagem

Publique somente por HTTPS e configure cabeçalhos HTTP adequados no provedor. Considere, no mínimo, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, uma `Permissions-Policy` restritiva e `Content-Security-Policy` com `frame-ancestors 'none'`. Mantenha os cabeçalhos consistentes com os recursos realmente usados pelo site e teste a aplicação após alterações.

## Reportar uma vulnerabilidade

Não publique detalhes exploráveis em uma issue pública. Envie um relato privado ao mantenedor pelo canal privado de segurança disponibilizado pelo proprietário do repositório (por exemplo, GitHub Security Advisories, se habilitado). Inclua passos mínimos para reproduzir, impacto observado e uma forma segura de contato. Não inclua dados pessoais ou documentos reais nos exemplos.
