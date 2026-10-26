import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { windowDefaults, type WindowGeometry } from './list-window';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A list's rows windowed (list-window.ts; the performance audit's H1): past a hundred rows shown, only those near the
 * view are in the page. Held here by an oracle: for generated lists — plain, loaded as they are scrolled, rows under
 * their parent, rows opened to their details, cells changed in place — and random scrolls, ticks, folds, sorts, keys
 * and edits, every row the windowed list draws is the row the same list drawn whole draws (a full draw), in the same
 * order, with the same choice, counts and focus; and every row is drawn for paper. jsdom lays nothing out: the view and
 * the rows' heights are this test's own (`geometry`). The browser's side — the view, scroll anchoring, a phone, WebKit —
 * is driven in e2e/list-window.spec.ts.
 */

const random = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

/** The view, as tall as a phone's, where the test has scrolled it, from the rows' top. */
const VIEW = 600;
let scrolled = 0;
/** How tall each row is in this test: by its record, so heights differ; what opened under it, as tall as it is. */
const tall = (node: Element): number => {
  if (node.classList.contains('fd-list-row')) return node.hasAttribute('data-new') ? 40 : 30 + (Number(node.getAttribute('data-id')) % 4) * 10;
  if (node.classList.contains('fd-list-detail')) return 120;
  if (node.classList.contains('fd-list-note')) return (node as HTMLElement).hidden ? 0 : 24;
  return 0;
};
const geometry: WindowGeometry = {
  view: (body) => (body.isConnected ? { top: scrolled, bottom: scrolled + VIEW } : null),
  height: (nodes) => nodes.reduce((sum, node) => sum + tall(node), 0),
  top: () => null,
};

type Kind = 'plain' | 'endless' | 'tree' | 'detail' | 'editable';

function made(pick: () => number, kind: Kind) {
  const n = 50 + Math.floor(pick() * 70);
  const people: Record<number, Values> = {};
  for (let i = 1; i <= n; i++) {
    people[i] = {
      name: `Person ${String(Math.floor(pick() * 1000)).padStart(3, '0')} ${i}`,
      city: ['cairo', 'giza', 'luxor'][i % 3],
      credit: Math.round(pick() * 100000),
      visits: Math.floor(pick() * 40),
      active: pick() < 0.6,
      // Under a parent: the first fifth are parents, the rest under one of them (a few loops of parents too).
      ...(kind === 'tree' ? { parent_id: i <= n / 5 ? (i % 7 === 0 ? { id: i + 1, label: `P${i + 1}` } : null) : { id: 1 + Math.floor(pick() * (n / 5)), label: 'P' } } : {}),
    };
  }
  const visits: Record<number, Values> = {};
  if (kind === 'detail') for (let i = 1; i <= n * 2; i++) visits[i] = { person_id: { id: 1 + (i % n), label: `P${i}` }, when: `2026-0${1 + (i % 9)}-1${i % 9}`, note: `Visit ${i}` };
  const page = {
    fieldia: '0.13',
    id: 'people',
    title: 'People',
    data: { kind: 'record', model: 'person' },
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }, { value: 'luxor', label: 'Luxor' }] },
      credit: { type: 'monetary', label: 'Credit', currency: 'EGP' },
      visits: { type: 'integer', label: 'Visits', min: 0 },
      active: { type: 'boolean', label: 'Active' },
      ...(kind === 'tree' ? { parent_id: { type: 'many2one', label: 'Parent', relation: 'person' } } : {}),
    },
    layout: {
      type: 'list',
      id: 'people-list',
      columns: ['name', 'city', 'credit', 'visits', 'active'],
      sort: [{ field: 'name' }],
      pageSize: kind === 'endless' ? 50 : 500,
      rowTones: [{ tone: 'muted', when: 'not active' }],
      ...(kind === 'endless' ? { endless: true } : {}),
      ...(kind === 'tree' ? { parentField: 'parent_id' } : {}),
      ...(kind === 'detail' ? { detail: { model: 'visit', field: 'person_id', title: 'Visits', fields: { when: { type: 'date', label: 'When' }, note: { type: 'char', label: 'Note' } }, columns: ['when', 'note'], limit: 3 } } : {}),
      ...(kind === 'editable' ? { editable: true } : {}),
    },
  } as unknown as Page;
  return { page, records: { person: people, visit: visits } };
}

/** Mounted in a host of its own, windowed as `from` says. */
async function mounted(page: Page, records: Record<string, Record<number, Values>>, from: number) {
  const host = document.createElement('div');
  document.body.append(host);
  windowDefaults.from = from;
  windowDefaults.geometry = geometry;
  const handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: JSON.parse(JSON.stringify(records)) as never }) });
  windowDefaults.from = 100;
  delete windowDefaults.geometry;
  await until(() => host.querySelectorAll('.fd-list-row').length > 0);
  return { host, handle };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  await frame();
  await frame();
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

const body = (host: Element) => host.querySelector('.fd-list-table > tbody') as HTMLTableSectionElement;
const keyOf = (tr: Element) => tr.getAttribute('data-new') ?? tr.getAttribute('data-id') ?? '';
const rowsIn = (host: Element) => [...body(host).querySelectorAll<HTMLTableRowElement>(':scope > tr.fd-list-row')];

/** A row and what opened under it, as the person sees it: each element a line, its attributes in one order; ids and the row's place set aside. */
function unit(tr: HTMLTableRowElement): string {
  const lines: string[] = [];
  const walk = (node: Node, depth: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) lines.push(`${'  '.repeat(depth)}"${node.textContent}"`);
      return;
    }
    if (!(node instanceof Element)) return;
    const skip = new Set(['id', 'for', 'aria-describedby', 'aria-labelledby', 'aria-controls', 'aria-rowindex', 'name']);
    const attributes = [...node.attributes].filter((one) => !skip.has(one.name)).map((one) => `${one.name}="${one.value}"`).sort();
    const box = node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
    const value = !box ? '' : node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio') ? ` checked=${node.checked}` : ` value=${JSON.stringify(node.value)}`;
    lines.push(`${'  '.repeat(depth)}<${node.tagName.toLowerCase()} ${attributes.join(' ')}>${value}`);
    for (const child of node.childNodes) walk(child, depth + 1);
  };
  walk(tr, 0);
  for (let next = tr.nextElementSibling; next && !next.classList.contains('fd-list-row') && !next.classList.contains('fd-list-gap'); next = next.nextElementSibling) walk(next, 1);
  return lines.join('\n');
}

/** A row and what opened under it as the browser writes them, and every box's value: its place among the rows set aside. */
function quick(tr: HTMLTableRowElement): string {
  const nodes: Element[] = [tr];
  for (let next = tr.nextElementSibling; next && !next.classList.contains('fd-list-row') && !next.classList.contains('fd-list-gap'); next = next.nextElementSibling) nodes.push(next);
  const values = nodes.flatMap((node) => [...node.querySelectorAll<HTMLInputElement>('input, select, textarea')].map((box) => (box.type === 'checkbox' || box.type === 'radio' ? String(box.checked) : box.value)));
  return `${nodes.map((node) => node.outerHTML.replace(/ aria-rowindex="\d+"/, '')).join('')}${values.join('|')}`;
}

/** What the list says round its rows: its choice, its counts, its pager and whether it holds none. */
function around(host: Element) {
  const all = host.querySelector('.fd-list-check input[type="checkbox"]') as HTMLInputElement | null;
  const words = (selector: string) => {
    const found = host.querySelector(selector) as HTMLElement | null;
    return found ? `${found.hidden || !!found.closest('[hidden]') ? 'hidden' : 'shown'}: ${found.textContent}` : 'none';
  };
  return { all: all ? `${all.checked}/${all.indeterminate}` : 'none', selection: words('.fd-list-selection'), every: words('.fd-list-every'), range: words('.fd-pager-text'), empty: words('.fd-list-empty'), more: words('.fd-list-more-rows') };
}

/** The windowed list draws what the whole one draws: each row drawn the same, in the same order, its place said; the same round them. */
function same(windowed: Element, whole: Element, at: string) {
  const all = rowsIn(whole).filter((tr) => !tr.hidden);
  const byKey = new Map(all.map((tr) => [keyOf(tr), tr]));
  const order = all.map(keyOf);
  const drawn = rowsIn(windowed);
  const table = windowed.querySelector('.fd-list-table') as HTMLTableElement;
  const counted = table.hasAttribute('aria-rowcount');
  let last = -1;
  for (const tr of drawn) {
    const key = keyOf(tr);
    const twin = byKey.get(key);
    expect({ at, key, found: !!twin }).toEqual({ at, key, found: true });
    // As the browser writes them, its place set aside — else, attribute by attribute (the order they were set in, ids, no difference).
    if (quick(tr) !== quick(twin as HTMLTableRowElement)) expect({ at, key, row: unit(tr) }).toEqual({ at, key, row: unit(twin as HTMLTableRowElement) });
    const place = order.indexOf(key);
    expect({ at, key, inOrder: place > last }).toEqual({ at, key, inOrder: true });
    last = place;
    if (counted) expect({ at, key, index: tr.getAttribute('aria-rowindex') }).toEqual({ at, key, index: String(place + 2) });
  }
  if (counted) expect({ at, count: table.getAttribute('aria-rowcount') }).toEqual({ at, count: String(all.length + 1 + (table.tFoot?.rows.length ?? 0)) });
  else expect({ at, drawn: drawn.length }).toEqual({ at, drawn: all.length });
  expect({ at, around: around(windowed) }).toEqual({ at, around: around(whole) });
}

/** A button beside the lists, the focus taken there to leave a row. */
const outside = () => {
  let button = document.getElementById('outside') as HTMLButtonElement | null;
  if (!button) {
    button = document.createElement('button');
    button.id = 'outside';
    document.body.append(button);
  }
  return button;
};
const key = (target: Element, name: string, more: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));

afterEach(() => {
  document.body.replaceChildren();
  scrolled = 0;
});

describe('a list’s rows windowed', () => {
  const kinds: Kind[] = ['plain', 'endless', 'tree', 'detail', 'editable'];
  it.each(kinds)('draws, change after change, what the list drawn whole draws: generated %s lists (the oracle)', async (kind) => {
    for (let seed = 1; seed <= 4; seed++) {
      const pick = random(seed * 31 + kinds.indexOf(kind));
      const { page, records } = made(pick, kind);
      const a = await mounted(page, records, 20);
      const b = await mounted(page, records, Infinity);
      const handles: ViewerHandle[] = [a.handle, b.handle];
      await settle();
      same(a.host, b.host, `${kind} ${seed} start`);
      let windowed = 0;
      for (let step = 0; step < 16; step++) {
        // The last step on paper, every row of the view shown drawn for it.
        const what = step === 15 ? 1 : pick() * 0.8;
        const drawn = rowsIn(a.host);
        const one = drawn[Math.floor(pick() * drawn.length)];
        const twin = (host: Element) => rowsIn(host).find((tr) => keyOf(tr) === keyOf(one));
        let did = 'scroll';
        if (what < 0.3) {
          // Scrolled somewhere among its rows: the window draws round the view.
          scrolled = Math.floor(pick() * Math.max(1, drawn.length * 50 + 6000));
          document.dispatchEvent(new Event('scroll'));
        } else if (what < 0.45 && one) {
          did = 'tick';
          for (const host of [a.host, b.host]) (twin(host)?.querySelector('.fd-list-checkbox') as HTMLInputElement | null)?.click();
        } else if (what < 0.5) {
          did = 'select all';
          for (const host of [a.host, b.host]) (host.querySelector('thead .fd-list-checkbox') as HTMLInputElement).click();
        } else if (what < 0.55) {
          did = 'sort';
          for (const host of [a.host, b.host]) (host.querySelector('thead th[data-col="visits"] button') as HTMLButtonElement).click();
        } else if (what < 0.62 && one) {
          did = 'keys';
          // Down from a row, past the rows drawn: the same row reached in each.
          const times = 1 + Math.floor(pick() * 40);
          const reached: string[] = [];
          for (const host of [a.host, b.host]) {
            (twin(host) as HTMLElement).focus();
            for (let i = 0; i < times; i++) key(document.activeElement as Element, 'ArrowDown');
            await settle();
            reached.push(host.contains(document.activeElement) ? keyOf(document.activeElement as Element) : 'elsewhere');
          }
          expect({ at: `${kind} ${seed} step ${step}`, reached: reached[0] }).toEqual({ at: `${kind} ${seed} step ${step}`, reached: reached[1] });
        } else if (what < 0.72 && one && kind === 'tree') {
          did = 'fold';
          const parent = drawn.find((tr) => tr.hasAttribute('data-parent-of'));
          const id = parent?.getAttribute('data-id');
          for (const host of [a.host, b.host]) (rowsIn(host).find((tr) => tr.getAttribute('data-id') === id)?.querySelector('.fd-list-twisty') as HTMLButtonElement | null)?.click();
        } else if (what < 0.72 && one && kind === 'detail') {
          did = 'detail';
          for (const host of [a.host, b.host]) (twin(host)?.querySelector('.fd-list-detail-toggle') as HTMLButtonElement | null)?.click();
        } else if (what < 0.72 && kind === 'endless') {
          did = 'more';
          for (const host of [a.host, b.host]) (host.querySelector('.fd-list-more-rows button') as HTMLButtonElement | null)?.click();
        } else if (what < 0.72 && one && kind === 'editable') {
          did = 'edit';
          const value = String(Math.floor(pick() * 90));
          for (const host of [a.host, b.host]) {
            const cell = twin(host)?.querySelector('td[data-col="visits"][data-edit]') as HTMLElement | null;
            cell?.click();
            await settle();
            const box = cell?.querySelector('input') as HTMLInputElement | null;
            if (!box) continue;
            box.value = value;
            box.dispatchEvent(new Event('input', { bubbles: true }));
            key(box, 'Tab');
            await settle();
            // Left for a button beside the list: the row saved.
            outside().focus();
            await settle();
          }
        } else if (what < 0.8 || step < 15) {
          did = 'reload';
          await Promise.all(handles.map((handle) => handle.reload()));
        } else {
          did = 'paper';
          window.dispatchEvent(new Event('beforeprint'));
          // On paper, every row of the view shown: as the whole list's.
          expect(rowsIn(a.host).filter((tr) => !tr.hidden).map(keyOf)).toEqual(rowsIn(b.host).filter((tr) => !tr.hidden).map(keyOf));
          window.dispatchEvent(new Event('afterprint'));
        }
        await settle();
        same(a.host, b.host, `${kind} ${seed} step ${step} after ${did}`);
        if (rowsIn(a.host).length < rowsIn(b.host).filter((tr) => !tr.hidden).length) windowed++;
      }
      // Rows left out of the page most of the way: the oracle looked at a windowed list, not a whole one.
      expect({ kind, seed, windowedSteps: windowed > 8 }).toEqual({ kind, seed, windowedSteps: true });
      for (const handle of handles) handle.destroy();
      document.body.replaceChildren();
      scrolled = 0;
    }
  }, 120000);
});
