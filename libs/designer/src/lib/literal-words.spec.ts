import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { literalWords, translatePage, type Page } from '@fieldia/core';
import { createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';
import { mountSurveyEditor } from './survey-editor';

/**
 * A page's words written with `literalWords` in the designer: as written wherever it edits them — its boxes, a
 * question's words, its panels, which show what the page holds — and as the form shows them where it previews the form:
 * the canvas's answer boxes and a question's preview (Try it is the viewer's, its gate literal-words.spec.ts there).
 */

const said = (n: number) => `⟦${n}⟧ {list} \\{x} {{customer}} a\\b |: عميل`;
const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** What the designer shows of the form as the form shows it: the canvas, but for the boxes the words are edited in, and each question's preview. */
function previewed(): string {
  return [...document.querySelectorAll('.fd-canvas-stage, [class*="fd-q-preview"]')]
    .map((area) => {
      const own = area.cloneNode(true) as HTMLElement;
      for (const editing of own.querySelectorAll('input, textarea, select, [contenteditable]')) editing.remove();
      return own.outerHTML;
    })
    .join('\n');
}

it.each(['survey', 'kinds', 'customer', 'work-item-bug', 'training-check', 'real-contact'])('previews the words of %s as the form shows them', async (name) => {
  const page = JSON.parse(readFileSync(join(__dirname, `../../../../examples/pages/${name}.page.json`), 'utf8')) as Page;
  let n = 0;
  const literal = translatePage(page, () => literalWords(said(n++)));
  const host = document.body.appendChild(document.createElement('div'));
  const designer = createDesigner({ page: literal });
  const handle = page.data.kind === 'responses' && page.layout.type === 'wizard' ? mountSurveyEditor(host, { designer }) : mountScreenEditor(host, { designer });
  await flush();
  const read = previewed();
  const wrong = [...read.matchAll(/⟦(\d+)⟧/g)].filter((found) => !read.startsWith(said(Number(found[1])), found.index)).map((found) => read.slice(found.index, found.index + 60));
  expect(wrong).toEqual([]);
  handle.destroy();
  document.body.replaceChildren();
});
