/**
 * Code coloured for reading, in fieldia.dev's docs (at build time) and the
 * demos' Code drawer (in the browser): keys, strings, numbers and literals
 * in JSON; keywords, strings, numbers, comments in TypeScript and
 * JavaScript; tags and their attributes in TSX, Vue and HTML; properties in
 * CSS; comments and strings in a shell. A few rules, no grammar: enough to
 * read a sample by, never a parser. The text comes back escaped, each
 * coloured piece a <span class="tok-…">.
 *
 *   import { highlight } from './highlight.mjs';
 *   pre.innerHTML = highlight('tsx', source);
 */

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (kind, text) => `<span class="tok-${kind}">${escape(text)}</span>`;

const KEYWORDS = new Set(
  'import export from default as function return const let var new class extends implements interface type enum await async if else for of in while do switch case break continue throw try catch finally typeof instanceof void readonly public private protected static keyof satisfies declare namespace this super yield delete'.split(' ')
);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

/** Each rule: a pattern tried at the place reached, and what it makes of what it matches. */
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y;
const NUMBER = /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy;
const WORD = /[A-Za-z_$][\w$]*/y;
const LINE_COMMENT = /\/\/[^\n]*/y;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//y;
const HTML_COMMENT = /<!--[\s\S]*?-->/y;
const HASH_COMMENT = /#[^\n]*/y;
/** A tag opening or closing, in TSX, Vue and HTML, its attributes after it up to its end. */
const TAG = /<\/?[A-Za-z][\w.:-]*/y;
const ATTRIBUTE = /[:@#]?[\w.:\[\]()-]+(?==)/y;

const at = (pattern, text, i) => {
  pattern.lastIndex = i;
  const found = pattern.exec(text);
  return found ? found[0] : null;
};

/** The source, coloured: `lang` one of json, ts, js, tsx, jsx, vue, html, css, sh; any other comes back escaped only. */
export function highlight(lang, text) {
  const tags = lang === 'tsx' || lang === 'jsx' || lang === 'vue' || lang === 'html';
  const script = lang === 'ts' || lang === 'js' || lang === 'tsx' || lang === 'jsx' || lang === 'vue';
  let out = '';
  let plain = '';
  let inTag = false;
  const flush = () => {
    out += escape(plain);
    plain = '';
  };
  const put = (kind, piece) => {
    flush();
    out += span(kind, piece);
    return piece.length;
  };
  for (let i = 0; i < text.length; ) {
    let piece;
    // The character before, in the source: what decides whether a tag or a number can start here.
    const before = i ? text[i - 1] : ' ';
    if (lang === 'json') {
      if ((piece = at(STRING, text, i))) {
        // A string followed by a colon is a key.
        const key = /^\s*:/.test(text.slice(i + piece.length, i + piece.length + 8));
        i += put(key ? 'key' : 'string', piece);
      } else if ((piece = at(NUMBER, text, i))) i += put('number', piece);
      else if ((piece = at(WORD, text, i))) i += LITERALS.has(piece) ? put('literal', piece) : ((plain += piece), piece.length);
      else plain += text[i++];
      continue;
    }
    if (lang === 'sh') {
      if ((piece = at(HASH_COMMENT, text, i)) && (i === 0 || /\s/.test(text[i - 1]))) i += put('comment', piece);
      else if ((piece = at(STRING, text, i))) i += put('string', piece);
      else plain += text[i++];
      continue;
    }
    if (lang === 'css') {
      if ((piece = at(BLOCK_COMMENT, text, i))) i += put('comment', piece);
      else if ((piece = at(STRING, text, i))) i += put('string', piece);
      else if ((piece = at(/[\w-]+(?=\s*:[^:])/y, text, i)) && /[{;\s]/.test(before)) i += put('key', piece);
      else if ((piece = at(/#[0-9a-f]{3,8}\b|-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg)?/iy, text, i))) i += put('number', piece);
      else plain += text[i++];
      continue;
    }
    // TypeScript, JavaScript, and the markup of TSX, Vue and HTML.
    if (inTag) {
      if ((piece = at(/\/?>/y, text, i))) {
        inTag = false;
        i += put('tag', piece);
      } else if ((piece = at(STRING, text, i))) i += put('string', piece);
      else if ((piece = at(ATTRIBUTE, text, i))) i += put('attr', piece);
      else plain += text[i++];
      continue;
    }
    if ((piece = at(HTML_COMMENT, text, i)) && tags) i += put('comment', piece);
    else if (script && (piece = at(LINE_COMMENT, text, i))) i += put('comment', piece);
    else if (script && (piece = at(BLOCK_COMMENT, text, i))) i += put('comment', piece);
    // A tag where markup can start, never a type's `Promise<void>`: after a space, a bracket or a line's start.
    else if (tags && (piece = at(TAG, text, i)) && /[\s(>{}=?:,]/.test(before)) {
      inTag = true;
      i += put('tag', piece);
    } else if ((piece = at(STRING, text, i))) i += put('string', piece);
    else if ((piece = at(NUMBER, text, i)) && !/[\w$]/.test(before)) i += put('number', piece);
    else if ((piece = at(WORD, text, i))) {
      if (script && KEYWORDS.has(piece) && text[i - 1] !== '.') i += put('keyword', piece);
      else if (LITERALS.has(piece)) i += put('literal', piece);
      else {
        plain += piece;
        i += piece.length;
      }
    } else plain += text[i++];
  }
  flush();
  return out;
}
