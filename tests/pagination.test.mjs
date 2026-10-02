import test from 'node:test';
import assert from 'node:assert/strict';
import { pageIndexAt, paginateText } from '../src/pagination.js';

const layout = { width: 54, height: 42, lineHeight: 10, font: '10px monospace' };

test('divide textos longos em páginas contíguas sem alterar nenhum caractere', () => {
  const source = ('Este é um documento longo com acentos: ação, coração, maçã e programação.\n').repeat(16);
  const pages = paginateText(source, layout);
  assert.ok(pages.length > 3, 'o conteúdo deve ocupar múltiplas páginas');
  assert.equal(pages.map((page) => page.text).join(''), source);
  assert.equal(pages[0].start, 0);
  assert.equal(pages.at(-1).end, source.length);
  for (let index = 1; index < pages.length; index += 1) {
    assert.equal(pages[index - 1].end, pages[index].start, 'as faixas devem ser contíguas');
  }
});

test('preserva pontuação, linhas vazias e a gama portuguesa de caracteres', () => {
  const source = 'Á À Ã Â É Ê Í Ó Ô Õ Ú Ç\ná à ã â é ê í ó ô õ ú ç\n\n?!:;,.()[]{}"\'-_/\\@#%&*';
  const pages = paginateText(source, { ...layout, width: 90, height: 80 });
  assert.equal(pages.map((page) => page.text).join(''), source);
});

test('quebra palavras excepcionalmente longas em faixas finitas', () => {
  const source = 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW';
  const pages = paginateText(source, layout);
  assert.ok(pages.length > 1);
  assert.equal(pages.map((page) => page.text).join(''), source);
  // O fallback sem Canvas mede 9 px por unidade: 6 caracteres × 4 linhas.
  assert.ok(pages.every((page) => page.text.length <= 24));
});

test('mapeia um cursor para a página correta, inclusive após uma quebra de página', () => {
  const pages = paginateText('linha longa com palavras para paginação dinâmica', layout);
  assert.equal(pageIndexAt(pages, 0), 0);
  assert.equal(pageIndexAt(pages, pages[0].end), Math.min(1, pages.length - 1));
  assert.equal(pageIndexAt(pages, pages.at(-1).end), pages.length - 1);
});
