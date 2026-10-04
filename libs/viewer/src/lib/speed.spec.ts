import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A key typed on a page of 500 fields redraws what changed, not the page:
 * every part is still brought up to date at each change, but one that shows
 * what it showed already is left alone, so the browser has nothing to lay
 * out again — and what did change still shows.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const big = (): Page => JSON.parse(readFileSync(join(EXAMPLES, 'big.page.json'), 'utf8'));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: big() });
  return { host, form: handle.form };
}
const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** What was written to the page while `act` ran, as the parts written to. */
function written(host: Element, act: () => void): Element[] {
  const watch = new MutationObserver(() => undefined);
  watch.observe(host, { subtree: true, attributes: true, childList: true, characterData: true });
  act();
  const records = watch.takeRecords();
  watch.disconnect();
  return records.map((r) => (r.target.nodeType === Node.TEXT_NODE ? (r.target.parentElement as Element) : (r.target as Element)));
}

describe('a page of 500 fields, filled in', () => {
  it('writes nothing outside the field typed in, for a key typed', () => {
    const { host, form } = mount();
    const box = at(host, 'f-s13-reference').querySelector('input') as HTMLInputElement;
    type(box, 'Nil');
    const parts = written(host, () => type(box, 'Nile'));
    expect(form.getState().values['s13_reference']).toBe('Nile');
    expect(parts.filter((part) => !at(host, 'f-s13-reference').contains(part)).map((p) => p.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('writes only the total a number is worked into, and the number', () => {
    const { host } = mount();
    type(at(host, 'f-s01-headcount').querySelector('input') as HTMLInputElement, '3');
    const total = at(host, 'f-s01-total').querySelector('input') as HTMLInputElement;
    const parts = written(host, () => type(at(host, 'f-s01-budget').querySelector('input') as HTMLInputElement, '100'));
    expect(total.value).toBe('300.00');
    const outside = parts.filter((part) => !at(host, 'f-s01-budget').contains(part) && !at(host, 'f-s01-total').contains(part));
    expect(outside.map((p) => p.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('shows and hides the ten addresses a choice decides, writing only to them', () => {
    const { host } = mount();
    const address = (n: number) => at(host, `f-s${String(n).padStart(2, '0')}-address`);
    expect(address(2).hidden).toBe(true);
    const foreign = at(host, 'f-supplier-type').querySelector('input[value="1"], input[type="radio"]:not(:checked)') as HTMLInputElement;
    const parts = written(host, () => foreign.click());
    for (let n = 2; n <= 11; n++) expect(address(n).hidden).toBe(false);
    expect(address(12).hidden).toBe(false);
    const addresses = Array.from({ length: 10 }, (_, i) => address(i + 2));
    const outside = parts.filter((part) => !at(host, 'f-supplier-type').contains(part) && !addresses.includes(part as HTMLElement));
    expect(outside.map((p) => p.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('still shows each problem when it is sent with fields missing, and clears one put right', async () => {
    const { host } = mount();
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const shown = () => [...host.querySelectorAll('.fd-error:not([hidden])')].map((e) => e.closest('[data-node]')?.getAttribute('data-node'));
    expect(shown()).toHaveLength(25);
    type(at(host, 'f-s07-name').querySelector('input') as HTMLInputElement, 'Seven');
    expect(shown()).toHaveLength(24);
    expect(shown()).not.toContain('f-s07-name');
  });
});
