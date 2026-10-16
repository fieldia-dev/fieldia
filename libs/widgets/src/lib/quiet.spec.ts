import type { Field, FieldNode } from '@fieldia/core';
import { openOnClick, wearsQuiet } from './quiet';
import { FIELDIA_CSS } from './styles';
import { LOCK_CSS } from './styles-lock';
import { QUIET_CSS } from './styles-quiet';
import { builtInWidgets } from './widgets';

/**
 * Which built-in widgets wear the quiet look and which keep their own face in
 * it, decided for every one of them; a date opening its calendar at a click
 * there; and the stylesheet showing its boxes on hover only where a pointer
 * can hover.
 */

const node = (widget?: string, extra: Partial<FieldNode> = {}): FieldNode => ({ type: 'field', id: 'n', field: 'f', ...(widget ? { widget } : {}), ...extra });
const field = (type: string, extra: Record<string, unknown> = {}) => ({ type, label: 'F', ...(type === 'selection' ? { options: [] } : {}), ...(/^many2/.test(type) ? { relation: 'r' } : {}), ...extra }) as unknown as Field;

describe('the widgets that wear the quiet look', () => {
  it('is decided for every built-in widget: words, numbers, choices, dates, links, tags and formatted text wear it', () => {
    const quiet = Object.keys(builtInWidgets).filter((key) => {
      const [type, widget] = key.split('.');
      return wearsQuiet(field(type), node(widget));
    });
    expect(quiet.sort()).toEqual(
      [
        'char', 'char.email', 'char.phone', 'char.url', 'char.password', 'char.time', 'char.tags', 'char.copy',
        'text', 'text.copy', 'integer', 'float', 'float.duration', 'float.percentage', 'monetary',
        'selection', 'selection.dot', 'selection.tags', 'date', 'date.daterange', 'datetime', 'datetime.daterange',
        'many2one', 'many2one.path', 'many2many', 'many2many.tags', 'reference', 'html', 'json.address', 'properties',
      ].sort()
    );
  });

  it('leaves ticks, a table and a choice of pictures their own face', () => {
    expect(wearsQuiet(field('selection', { multiple: true }), node())).toBe(false);
    expect(wearsQuiet(field('selection', { multiple: true }), node('tags'))).toBe(true);
    expect(wearsQuiet(field('many2many'), node(undefined, { columns: ['name'] }))).toBe(false);
    expect(wearsQuiet(field('many2many'), node('tags', { columns: ['name'] }))).toBe(true);
    for (const [type, widget] of [['boolean', undefined], ['boolean', 'toggle'], ['integer', 'rating'], ['selection', 'radio'], ['selection', 'statusbar'], ['one2many', undefined], ['binary', undefined], ['json', undefined], ['char', 'badge']]) {
      expect([type, widget, wearsQuiet(field(type as string), node(widget))]).toEqual([type, widget, false]);
    }
  });
});

describe('a date clicked in the quiet look', () => {
  const box = (quiet: boolean) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'fd-field';
    wrapper.toggleAttribute('data-quiet', quiet);
    const input = document.createElement('input');
    wrapper.append(input);
    document.body.append(wrapper);
    return input;
  };
  afterEach(() => document.body.replaceChildren());

  it('opens its calendar at once; read-only, or in a box, it does not', () => {
    const open = jest.fn();
    const quiet = box(true);
    openOnClick(quiet, open);
    quiet.click();
    expect(open).toHaveBeenCalledTimes(1);
    quiet.readOnly = true;
    quiet.click();
    expect(open).toHaveBeenCalledTimes(1);
    const boxed = box(false);
    openOnClick(boxed, open);
    boxed.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('is typed in where its calendar cannot be opened', () => {
    const input = box(true);
    openOnClick(input, () => {
      throw new Error('NotAllowedError');
    });
    expect(() => input.click()).not.toThrow();
  });
});

describe('the quiet stylesheet', () => {
  it('draws a box on hover only where a pointer can hover: a touch goes straight to the editor', () => {
    const outside = QUIET_CSS.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}/g, '').replace(/@media \(hover: hover\) \{[^\n]*\}/g, '');
    // A choice's chevron is the one sign drawn on hover outside: under a finger, the box it sits in is the editor already.
    const hovered = outside.split('}').filter((rule) => /:hover/.test(rule) && /border-color|visibility: visible|opacity: 1/.test(rule));
    expect(hovered).toEqual([]);
    expect(outside.split('}').filter((rule) => /:hover/.test(rule)).every((rule) => /select\.fd-input/.test(rule))).toBe(true);
  });

  it('keeps every box’s edge at rest, so pointing never moves a word', () => {
    expect(QUIET_CSS).toMatch(/:is\(\.fd-input:not\(\.fd-tags \*\), \.fd-tags, \.fd-dot-box\) \{\s*border: 1px solid transparent;/);
  });

  // A part loaded the first time a page wears the look (quiet-part.ts): until it comes, nothing in Fieldia's own sheet
  // misses it. What it would style outside a quiet place — a state's words, a field's lock — is Fieldia's own.
  it('styles only what is in a quiet place; a state’s words and a field’s lock are Fieldia’s own sheet’s', () => {
    const selectors = [...QUIET_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map(([, selector]) => selector.trim()).filter((selector) => !selector.startsWith('@'));
    expect(selectors.length).toBeGreaterThan(40);
    /** A selector list's selectors: split at its own commas, never those inside :is() or :has(). */
    const each = (list: string) => {
      const out = [''];
      let depth = 0;
      for (const char of list) {
        depth += char === '(' ? 1 : char === ')' ? -1 : 0;
        if (char === ',' && !depth) out.push('');
        else out[out.length - 1] += char;
      }
      return out.map((one) => one.trim());
    };
    expect(selectors.flatMap(each).filter((one) => !/\[data-(in-)?quiet\]/.test(one))).toEqual([]);
    expect(FIELDIA_CSS).toContain(LOCK_CSS);
    expect(LOCK_CSS).toContain('.fd-dot-label[data-quiet-words] { display: none; }');
    expect(LOCK_CSS).toContain('.fd-lock-wrap {');
    expect(FIELDIA_CSS).not.toContain(QUIET_CSS);
  });
});
