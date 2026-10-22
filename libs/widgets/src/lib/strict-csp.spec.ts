import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanPasted, keepCells, putHtml } from './pasted-html';
import { decorateLinks } from './formatted-text';
import { htmlToMarkdown, markdownLoses, markdownToHtml } from './markdown';
import { sanitizeHtml } from './sanitize';
import { appendHtml, givenHtml, heldHtml, renameAttribute, showHtml } from './style-attributes';
import { fieldiaStyle, styleNonce, useStyleNonce } from './style-nonce';
import { installPartStyles, installStyles, PART_RANK } from './styles';

/**
 * A strict Content-Security-Policy — `style-src 'nonce-…'`, no 'unsafe-inline': every <style> Fieldia adds carries the
 * page's nonce, and no HTML Fieldia hands the browser to read holds a style attribute, which such a policy refuses
 * (and Chromium does not even read in a template). A formatted text's looks are kept in its value all the same.
 * e2e/csp.spec.ts serves pages under such a policy in every engine.
 */

const fresh = () => document.implementation.createHTMLDocument('page');

describe('the nonce on every <style> Fieldia adds', () => {
  it('none until one is given; the one given after', () => {
    const doc = fresh();
    expect(styleNonce(doc)).toBeUndefined();
    expect(fieldiaStyle(doc, '.a{}').nonce).toBeFalsy();
    useStyleNonce(doc, 'r4nd0m');
    const style = fieldiaStyle(doc, '.a { color: red }', 'mine');
    expect([style.id, style.nonce, style.textContent]).toEqual(['mine', 'r4nd0m', '.a { color: red }']);
    // An empty one leaves it as it was.
    useStyleNonce(doc, '');
    expect(styleNonce(doc)).toBe('r4nd0m');
  });

  it("the page's csp-nonce meta, as Vite writes it, where none is given", () => {
    const doc = fresh();
    doc.head.innerHTML = '<meta property="csp-nonce" nonce="from-meta">';
    expect(styleNonce(doc)).toBe('from-meta');
    useStyleNonce(doc, 'given');
    expect(styleNonce(doc)).toBe('given');
  });

  it("Fieldia's own sheet and every part's", () => {
    const doc = fresh();
    useStyleNonce(doc, 'n0nce');
    installStyles(doc);
    installPartStyles(doc, 'fd-test-part', '.x{}', PART_RANK.lines);
    const sheets = [...doc.querySelectorAll('style')];
    expect(sheets.map((sheet) => sheet.id)).toEqual(['fieldia-styles', 'fd-test-part', 'fieldia-styles-looks']);
    expect(sheets.every((sheet) => sheet.nonce === 'n0nce')).toBe(true);
  });
});

describe('a style attribute held while HTML is read', () => {
  it('renames the attribute in tags alone: never words or other values', () => {
    const html = `<p style="text-align: center" title='style="x"'>style="y" a<b>c</p><SPAN STYLE=color:red data-fd-style="sneaked">x</SPAN>`;
    expect(heldHtml(html)).toBe(`<p data-fd-style="text-align: center" title='style="x"'>style="y" a<b>c</p><SPAN data-fd-style=color:red>x</SPAN>`);
    expect(givenHtml(heldHtml('<p style="a: b">x</p>'))).toBe('<p style="a: b">x</p>');
    expect(renameAttribute('a < b, <br/>, <img src=x style=y/>', 'style', 'k')).toBe('a < b, <br/>, <img src=x k=y/>');
  });

  /** Every piece of HTML handed to the browser to read, as an innerHTML, an insertAdjacentHTML or an insertHTML. */
  function watchParsing() {
    const read: string[] = [];
    const inner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML') as PropertyDescriptor;
    const adjacent = Element.prototype.insertAdjacentHTML;
    const exec = document.execCommand;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get: inner.get,
      set(this: Element, html: string) {
        read.push(String(html));
        inner.set?.call(this, html);
      },
    });
    Element.prototype.insertAdjacentHTML = function (this: Element, where: InsertPosition, html: string) {
      read.push(html);
      return adjacent.call(this, where, html);
    };
    document.execCommand = (command: string, ui?: boolean, value?: string) => {
      if (command === 'insertHTML') read.push(String(value));
      return false;
    };
    return {
      withStyle: () => read.filter((html) => /<[a-z][^>]*\sstyle\s*=/i.test(html)),
      done() {
        Object.defineProperty(Element.prototype, 'innerHTML', inner);
        Element.prototype.insertAdjacentHTML = adjacent;
        document.execCommand = exec;
      },
    };
  }

  it('sanitizing, showing, links, Markdown and pasting never hand the browser a style attribute — and keep the looks', () => {
    const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/clipboard', `${name}.html`), 'utf8');
    const watch = watchParsing();
    try {
      const value = '<p style="text-align: center">Calm <span style="color: #2c8397; background-color: #fff3bf; font-size: 20px">sea</span> <a href="https://example.com">here</a></p><table><tbody><tr><td style="text-align: right">1</td></tr></tbody></table>';
      const clean = sanitizeHtml(value, document);
      expect(clean).toBe(
        '<p style="text-align: center;">Calm <span style="color: rgb(44, 131, 151); background-color: rgb(255, 243, 191); font-size: 20px;">sea</span> <a href="https://example.com">here</a></p><table><tbody><tr><td style="text-align: right;">1</td></tr></tbody></table>'
      );
      // Read again, the same: what is stored is what was kept.
      expect(sanitizeHtml(clean, document)).toBe(clean);
      const box = document.createElement('div');
      showHtml(box, decorateLinks(clean, document));
      expect((box.querySelector('p') as HTMLElement).style.textAlign).toBe('center');
      expect((box.querySelector('span') as HTMLElement).style.fontSize).toBe('20px');
      expect(box.querySelector('[data-fd-style]')).toBeNull();
      // Shown as it is written, its attributes in their order: what reads it back finds the HTML it was given.
      const shown = '<p><span style="color: rgb(19, 101, 217);" data-mention="7">Mona</span></p><table><tbody><tr><td style="text-align: right;" colspan="2">1</td></tr></tbody></table>';
      const again = document.createElement('div');
      showHtml(again, shown);
      expect(again.innerHTML).toBe(shown);
      appendHtml(box, '<p style="text-align: right">more</p>');
      expect((box.lastElementChild as HTMLElement).style.textAlign).toBe('right');
      expect(htmlToMarkdown(clean, document)).toContain('---:');
      expect(markdownLoses(clean, document)).toBe(true);
      expect(markdownLoses(sanitizeHtml(markdownToHtml('a ==marked== word'), document), document)).toBe(false);
      for (const name of ['word-text', 'word-table', 'excel-table', 'google-docs-text', 'google-sheets-table']) cleanPasted(fixture(name), document);
      // Excel's cells aligned by its sheet's classes, and Word's lists, read with their styles held.
      expect(cleanPasted(fixture('excel-table'), document)).toContain('<td style="text-align: right;">');
      expect(cleanPasted(fixture('word-text'), document)).toMatch(/<[ou]l>/);
      const area = document.createElement('div');
      // Under a policy (its nonce known), what is pasted goes in with its styles held.
      useStyleNonce(document, 'r4nd0m');
      putHtml(area, '<table><tbody><tr><td style="text-align: right;">1</td></tr></tbody></table>', document);
      const table = document.createElement('table');
      table.innerHTML = '<tbody><tr><td>1</td></tr></tbody>';
      const as = document.createElement('table');
      as.createTBody().insertRow().insertCell().style.textAlign = 'center';
      keepCells(table, as);
      expect(table.rows[0].cells[0].style.textAlign).toBe('center');
      expect(watch.withStyle()).toEqual([]);
      // What the watch is for: a style attribute handed to the browser is found.
      document.createElement('div').innerHTML = '<p style="color: red">x</p>';
      expect(watch.withStyle()).toHaveLength(1);
    } finally {
      watch.done();
    }
  });
});
