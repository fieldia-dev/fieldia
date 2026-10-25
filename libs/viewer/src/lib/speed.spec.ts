import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputeInFull, workCounts, type Page } from '@fieldia/core';
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
  recomputeInFull(false);
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

/** The work done while `act` ran, counted (`workCounts`): conditions read, values worked out, fields checked, parts brought up to date. */
function work(act: () => void): typeof workCounts {
  const before = { ...workCounts };
  act();
  return { conditions: workCounts.conditions - before.conditions, computes: workCounts.computes - before.computes, checks: workCounts.checks - before.checks, updaters: workCounts.updaters - before.updaters };
}

/**
 * What a key costs on a page of 500 fields, counted — the same on any machine. Since 0.35 a change works out only what
 * reads it: the conditions, the values worked out and the checks that read the field typed in, and the parts that show
 * what changed. Working every change out in full, as before 0.35 (`recomputeInFull`), brings all 550 parts up to date.
 */
describe('a key on a page of 500 fields, counted', () => {
  const box = (host: Element, node: string) => at(host, node).querySelector('input') as HTMLInputElement;

  it('brings up to date the field typed in and the page round it, not the 500 others', () => {
    const { host } = mount();
    type(box(host, 'f-s13-reference'), 'N');
    const done = work(() => type(box(host, 'f-s13-reference'), 'Ni'));
    // The field typed in, and the parts that follow every change: the page's own, and those whose widgets do not say what
    // they draw from (its 5 links, its 2 tables of lines): 16 of 533.
    expect(done.updaters).toBeLessThanOrEqual(18);
    // Nothing reads it: no condition is read again, no value worked out, no other field checked.
    expect(done).toMatchObject({ conditions: 0, computes: 0 });
    expect(done.checks).toBeLessThanOrEqual(1);
  });

  it('works out again only the total a number is worked into, and draws only the two', () => {
    const { host } = mount();
    type(box(host, 'f-s01-headcount'), '3');
    const done = work(() => type(box(host, 'f-s01-budget'), '100'));
    expect((at(host, 'f-s01-total').querySelector('input') as HTMLInputElement).value).toBe('300.00');
    expect(done.computes).toBe(1);
    expect(done.updaters).toBeLessThanOrEqual(20);
  });

  it('reads again only the conditions on the choice changed, and draws only the parts they show or hide', () => {
    const { host } = mount();
    const foreign = at(host, 'f-supplier-type').querySelector('input[type="radio"]:not(:checked)') as HTMLInputElement;
    const done = work(() => foreign.click());
    // The ten addresses that choice shows, and the other parts reading it.
    expect(done.conditions).toBeLessThanOrEqual(12);
    expect(done.updaters).toBeLessThanOrEqual(28);
  });

  it('checks again only the field typed in while the problems found by a send are shown', async () => {
    const { host } = mount();
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    type(box(host, 'f-s13-reference'), 'N');
    const done = work(() => type(box(host, 'f-s13-reference'), 'Ni'));
    expect(done.checks).toBeLessThanOrEqual(1);
    expect(done.updaters).toBeLessThanOrEqual(19);
  });

  it('brings all of them up to date, working everything out in full: as before 0.35', () => {
    recomputeInFull(true);
    const { host } = mount();
    type(box(host, 'f-s13-reference'), 'N');
    const done = work(() => type(box(host, 'f-s13-reference'), 'Ni'));
    expect(done.updaters).toBeGreaterThan(500);
    expect(done.conditions).toBeGreaterThan(80);
  });
});
