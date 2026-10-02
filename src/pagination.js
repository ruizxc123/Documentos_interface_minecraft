let measuringContext;

function getContext() {
  if (measuringContext) return measuringContext;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  measuringContext = canvas.getContext('2d');
  return measuringContext;
}

function measureText(text, font) {
  const context = getContext();
  if (!context) return text.length * 9;
  // Medir cada candidato com a fonte efetiva evita tratar caracteres largos e estreitos como equivalentes.
  context.font = font || '16px monospace';
  return context.measureText(text).width;
}

function graphemes(value) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(value)];
  }
  return [...value].map((segment, index) => ({ segment, index }));
}

function wrapParagraph(text, start, end, width, font) {
  if (start === end) return [{ start, end }];
  const source = text.slice(start, end);
  const tokens = [...source.matchAll(/[\t ]+|[^\t ]+/gu)];
  const lines = [];
  let lineStart = start;
  let line = '';

  const flush = (at) => {
    lines.push({ start: lineStart, end: at });
    lineStart = at;
    line = '';
  };

  for (const tokenMatch of tokens) {
    const token = tokenMatch[0];
    const tokenStart = start + tokenMatch.index;
    const candidate = line + token;
    if (measureText(candidate, font) <= width || !line) {
      if (measureText(candidate, font) <= width) {
        line = candidate;
        continue;
      }
    } else {
      flush(tokenStart);
    }

    // A single unusually long word is split by grapheme only when it cannot fit a line.
    const pieces = graphemes(token);
    let pieceOffset = tokenStart;
    for (const piece of pieces) {
      const part = piece.segment;
      if (line && measureText(line + part, font) > width) flush(pieceOffset);
      if (!line) lineStart = pieceOffset;
      line += part;
      pieceOffset += part.length;
    }
  }

  if (line || !lines.length) lines.push({ start: lineStart, end });
  else if (lines.at(-1).end < end) lines.push({ start: lines.at(-1).end, end });
  return lines;
}

function layoutLines(text, width, font) {
  const lines = [];
  let paragraphStart = 0;
  while (paragraphStart <= text.length) {
    const newline = text.indexOf('\n', paragraphStart);
    const paragraphEnd = newline === -1 ? text.length : newline;
    const paragraphLines = wrapParagraph(text, paragraphStart, paragraphEnd, width, font);
    if (newline !== -1 && paragraphLines.length) {
      paragraphLines.at(-1).end = newline + 1;
    }
    lines.push(...paragraphLines);
    if (newline === -1) break;
    paragraphStart = newline + 1;
    if (paragraphStart === text.length) {
      lines.push({ start: text.length, end: text.length });
      break;
    }
  }
  return lines.length ? lines : [{ start: 0, end: 0 }];
}

/**
 * Pages are visual ranges into one canonical string. Soft wraps affect only these
 * ranges; they never insert characters into the stored document.
 */
export function paginateText(text, options = {}) {
  const content = String(text ?? '');
  const width = Math.max(40, Number(options.width) || 240);
  const lineHeight = Math.max(12, Number(options.lineHeight) || 25);
  const height = Math.max(lineHeight * 4, Number(options.height) || lineHeight * 19);
  const font = options.font || '16px monospace';
  const maxLines = Math.max(4, Math.floor(height / lineHeight));
  const lines = layoutLines(content, width, font);
  const pages = [];
  let pageStart = 0;
  let pageEnd = 0;
  let usedLines = 0;

  for (const line of lines) {
    if (usedLines >= maxLines && line.start >= pageStart) {
      pages.push({ start: pageStart, end: line.start, text: content.slice(pageStart, line.start) });
      pageStart = line.start;
      usedLines = 0;
    }
    pageEnd = line.end;
    usedLines += 1;
  }

  if (!pages.length || pageStart < content.length || pageEnd >= pageStart) {
    pages.push({ start: pageStart, end: Math.max(pageStart, pageEnd), text: content.slice(pageStart, Math.max(pageStart, pageEnd)) });
  }
  return pages;
}

export function pageIndexAt(pages, offset) {
  if (!pages.length) return 0;
  const bounded = Math.max(0, Math.min(offset, pages.at(-1).end));
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (bounded < page.end || index === pages.length - 1 || page.start === page.end) return index;
  }
  return pages.length - 1;
}
