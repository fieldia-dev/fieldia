import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@fieldia/core';
import { createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';

/**
 * What a key typed in a label costs the designer on a page of 500 fields (the performance audit's M4): its edit made
 * on a draft copies the field, the fields' table and the page — never the page whole — the page made shares the rest
 * with the one before, and nothing stringifies the page whole for it: not the copy, not whether it differs from what
 * was published, not the checks. Counted, not timed.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const big = (): Page => JSON.parse(readFileSync(join(EXAMPLES, 'big.page.json'), 'utf8'));

/** The objects of a page — its parts, lists and their items — each once. */
function objects(value: unknown, seen = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || seen.has(value)) return seen;
  seen.add(value);
  for (const inner of Object.values(value)) objects(inner, seen);
  return seen;
}

/** The longest text JSON.stringify made while `act` ran: a page stringified whole is hundreds of thousands of characters. */
function longestStringified(act: () => void): number {
  const real = JSON.stringify;
  let longest = 0;
  JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => {
    const text = real(...args);
    if (typeof text === 'string') longest = Math.max(longest, text.length);
    return text;
  }) as typeof JSON.stringify;
  try {
    act();
  } finally {
    JSON.stringify = real;
  }
  return longest;
}

afterEach(() => document.body.replaceChildren());

describe('a key typed in a label on a page of 500 fields', () => {
  it('copies the field, the fields and the page, sharing every other part of the page with the one before', () => {
    const designer = createDesigner({ page: big() });
    designer.updateQuestion('f-s13-reference', { label: 'Environment ref' });
    const before = designer.getPage();
    const all = objects(before);
    designer.updateQuestion('f-s13-reference', { label: 'Environment refe' });
    const after = designer.getPage();
    expect(after.fields['s13_reference'].label).toBe('Environment refe');
    // New: the page, its fields' table and the field. Every other object — thousands — the page before's own.
    const fresh = [...objects(after)].filter((one) => !all.has(one));
    expect(fresh).toEqual([after, after.fields, after.fields['s13_reference']]);
    expect(all.size).toBeGreaterThan(1000);
    expect(after.layout).toBe(before.layout);
  });

  it('stringifies nothing of the page whole: not to copy it, nor to say whether it differs from what was published', async () => {
    const page = big();
    const whole = JSON.stringify(page).length;
    const designer = createDesigner({ page, versions: [{ version: 1, publishedAt: '2026-10-01T09:00:00Z', page: big() }] });
    expect(designer.getState().unpublished).toBe(false);
    // The first edit checks the page whole, as it was opened; those after it, what they changed.
    designer.updateQuestion('f-s13-reference', { label: 'E' });
    designer.updateQuestion('f-s13-reference', { label: 'Env' });
    const longest = longestStringified(() => {
      designer.updateQuestion('f-s13-reference', { label: 'Envi' });
      expect(designer.getState().unpublished).toBe(true);
    });
    expect(longest).toBeLessThan(whole / 50);
  });

  it('in the screen editor too: its canvas and panel make no form of the whole page, nor stringify it, for the card typed in', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: big() });
    const editor = mountScreenEditor(host, { designer });
    designer.select('f-s13-reference');
    const label = host.querySelector<HTMLTextAreaElement>('.fd-canvas-field.fd-editing .fd-canvas-label-input') as HTMLTextAreaElement;
    label.focus();
    for (const text of ['Environment refer', 'Environment referenc']) {
      label.value = text;
      label.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const whole = JSON.stringify(designer.getPage()).length;
    const longest = longestStringified(() => {
      label.value = 'Environment reference!';
      label.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(designer.getPage().fields['s13_reference'].label).toBe('Environment reference!');
    expect(longest).toBeLessThan(whole / 50);
    editor.destroy();
  });
});
