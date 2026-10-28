import type { Page } from '@fieldia/core';

/**
 * A part a page can be drawn without, plainly, that draws itself in place as it comes (`DRAWN_IN_PLACE`: the classic
 * formatted text's toolbar, a sheet's furniture) is waited for only beside the page's other parts: a page that waits
 * for others anyway is drawn whole at once, as ever; one that would wait for it alone is drawn at once without it — no
 * page drawn later for it (0.37) — and it is drawn in its place as it comes. Its tags (`partFiles`) say the same. Where
 * it cannot come, the page works without it, said. This file starts with no part loaded; every case with fresh modules.
 */

/** How many times the sheet part fails as it is asked for. */
let mockSheetFails = 0;
jest.mock('./sheet-part', () => {
  if (mockSheetFails > 0) {
    mockSheetFails--;
    throw new Error('Loading chunk fieldia.sheet.js failed');
  }
  return jest.requireActual('./sheet-part');
});

beforeEach(() => {
  jest.resetModules();
  mockSheetFails = 0;
  document.body.replaceChildren();
  document.head.replaceChildren();
});

const note = (more: Page['fields'] = {}, nodes: object[] = []): Page =>
  ({
    fieldia: '0.14',
    id: 'note',
    title: 'Note',
    data: { kind: 'responses' },
    fields: { title: { type: 'char', label: 'Title' }, body: { type: 'html', label: 'Body' }, ...more },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-title', field: 'title' }, { type: 'field', id: 'f-body', field: 'body' }, ...nodes] },
  }) as Page;

async function mount(page: Page, more: Record<string, unknown> = {}) {
  const { mountViewer } = await import('./viewer');
  const host = document.createElement('div');
  document.body.append(host);
  return { host, handle: mountViewer(host, { page, ...more }) };
}

/** A lease's sheet: its ribbon, a stat button, a badge and an alert — its furniture — round plain fields. */
const lease = (more: Page['fields'] = {}, nodes: object[] = []): Page =>
  ({
    fieldia: '0.14',
    id: 'lease',
    title: 'Lease',
    data: { kind: 'record', model: 'lease' },
    fields: { name: { type: 'char', label: 'Tenant' }, rent: { type: 'integer', label: 'Rent' }, ...more },
    layout: {
      type: 'sheet',
      id: 'root',
      title: { field: 'name' },
      ribbon: { id: 'r-late', label: 'Late', tone: 'danger', invisible: 'rent < 100' },
      statButtons: [{ id: 's-rent', label: 'Rent', field: 'rent', steps: [{ do: 'set', field: 'rent', value: 'rent + 1' }] }],
      badges: [{ id: 'b-new', label: 'New' }],
      alerts: [{ id: 'a-due', message: 'Rent is due', tone: 'warning' }],
      children: [{ type: 'field', id: 'f-rent', field: 'rent' }, ...nodes],
    },
  }) as Page;
/** A lease's sheet whose only furniture is its ribbon, over its card's corner: it takes no room. */
const ribboned = (): Page =>
  ({
    ...lease(),
    layout: { type: 'sheet', id: 'root', title: { field: 'name' }, ribbon: { id: 'r-late', label: 'Late', tone: 'danger', invisible: 'rent < 100' }, children: [{ type: 'field', id: 'f-rent', field: 'rent' }] },
  }) as Page;
const leaseSource = async () => (await import('@fieldia/core')).createMemoryDataSource({ records: { lease: { 1: { name: 'Hana Fouad', rent: 120 } } } });
const settle = async () => {
  for (let turn = 0; turn < 8; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('a part drawn in place as it comes', () => {
  it('alone, never waited for: the page drawn at once, its box typed in, the toolbar in its place as it comes', async () => {
    const { host, handle } = await mount(note());
    // Drawn at once: its formatted text's box, typed in, the toolbar's room held over it — nothing in it to press.
    const area = host.querySelector('[data-node="f-body"] .fd-richtext[contenteditable="true"]') as HTMLElement;
    expect(area).not.toBeNull();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.fd-richtext-bar[aria-hidden="true"]')).not.toBeNull();
    expect(host.querySelector('.fd-richtext-bar button')).toBeNull();
    area.innerHTML = '<p>Hello</p>';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    const { htmlPart } = await import('@fieldia/widgets');
    await htmlPart.load();
    await handle.drawn;
    for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('[data-node="f-body"] .fd-richtext-bar [aria-label="Bold"]')).not.toBeNull();
    expect(host.querySelector('[data-node="f-body"] .fd-richtext')?.innerHTML).toBe('<p>Hello</p>');
    expect(handle.form.getState().values['body']).toBe('<p>Hello</p>');
  });

  it('beside other parts, waited for with them: the page drawn whole at once, the toolbar with it', async () => {
    const { host, handle } = await mount(note({ when: { type: 'date', label: 'When' } }, [{ type: 'field', id: 'f-when', field: 'when' }]));
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node="f-body"]')).toBeNull();
    await handle.drawn;
    expect(host.querySelector('[data-node="f-body"] .fd-richtext-bar')).not.toBeNull();
  });

  it("its tags: none for a page that waits for it alone, its own beside the page's others — and a sheet's whose furniture takes room", async () => {
    const { partFiles } = await import('./viewer-parts');
    expect(partFiles(note())).toEqual([]);
    expect(partFiles(note({ when: { type: 'date', label: 'When' } }, [{ type: 'field', id: 'f-when', field: 'when' }])).sort()).toEqual(['fieldia.date.js', 'fieldia.html.js']);
    expect(partFiles(ribboned())).toEqual([]);
    expect(partFiles(lease()).sort()).toEqual(['fieldia.loading.js', 'fieldia.sheet.js']);
    expect(partFiles(lease({ start: { type: 'date', label: 'Start' } }, [{ type: 'field', id: 'f-start', field: 'start' }])).sort()).toEqual(['fieldia.date.js', 'fieldia.loading.js', 'fieldia.sheet.js']);
  });

  it("a sheet whose furniture takes room waits for it, as for any part, drawn whole — its room cannot be held before it is drawn", async () => {
    const { host, handle } = await mount(lease(), { dataSource: await leaseSource(), recordId: 1 });
    // Not drawn before its stat buttons, badges and alerts, which would push it down as they came (the 0.37 walk: 102 px).
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.fd-card [data-node="f-rent"]')).toBeNull();
    await handle.drawn;
    expect(host.querySelector('.fd-card > .fd-stats .fd-stat')).not.toBeNull();
    expect(host.querySelector('.fd-card > .fd-alert')).not.toBeNull();
  });

  it("a sheet whose only furniture is its ribbon, over its card's corner: drawn at once, the ribbon put in place as it comes", async () => {
    const { host, handle } = await mount(ribboned(), { dataSource: await leaseSource(), recordId: 1 });
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.fd-card [data-node="f-rent"]')).not.toBeNull();
    expect(host.querySelector('.fd-ribbon')).toBeNull();
    await handle.form.settled();
    const { sheetPart } = await import('./viewer-parts');
    await sheetPart.load();
    await settle();
    expect((host.querySelector('.fd-card > .fd-ribbon-frame .fd-ribbon') as HTMLElement).hidden).toBe(false);
  });

  it("a sheet waited for: its furniture in its places, working", async () => {
    const { host, handle } = await mount(lease(), { dataSource: await leaseSource(), recordId: 1 });
    await handle.drawn;
    await handle.form.settled();
    await settle();
    // In its places, in the order a sheet draws them: the ribbon's frame, the stat buttons, the alert, the badges, the title.
    const card = host.querySelector('.fd-card') as HTMLElement;
    expect([...card.children].map((child) => child.className).slice(0, 5)).toEqual(['fd-ribbon-frame', 'fd-stats', 'fd-alert fd-tone-warning', 'fd-badges', 'fd-title-row']);
    expect((card.querySelector('.fd-ribbon') as HTMLElement).hidden).toBe(false);
    expect(card.querySelector('.fd-stat-value')?.textContent).toBe('120');
    // Its look first among the parts', right after Fieldia's own.
    const sheets = [...document.head.querySelectorAll('style')].map((style) => style.id);
    expect(sheets.indexOf('fieldia-sheet-styles')).toBe(sheets.indexOf('fieldia-styles') + 1);
    (card.querySelector('.fd-stat') as HTMLElement).click();
    for (let waited = 0; handle.form.getState().values['rent'] !== 121 && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(card.querySelector('.fd-stat-value')?.textContent).toBe('121');
  });

  it("a sheet beside other parts: waited for with them, drawn whole", async () => {
    const { host, handle } = await mount(lease({ start: { type: 'date', label: 'Start' } }, [{ type: 'field', id: 'f-start', field: 'start' }]), { dataSource: await leaseSource(), recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    await handle.drawn;
    expect(host.querySelector('.fd-card > .fd-ribbon-frame')).not.toBeNull();
    expect(host.querySelector('.fd-card > .fd-stats .fd-stat')).not.toBeNull();
  });

  it('where it cannot come: the sheet works whole without its furniture, said over the page', async () => {
    // Waited for, then asked again as the sheet is drawn, as every part a page draws from is: failing both times.
    mockSheetFails = 2;
    const { host, handle } = await mount(lease(), { dataSource: await leaseSource(), recordId: 1 });
    await handle.form.settled();
    await settle();
    expect(host.querySelector('.fd-ribbon, .fd-stat, .fd-badge, .fd-alert')).toBeNull();
    expect(host.querySelector('.fd-parts-unloaded:not([hidden])')?.textContent).toContain('Part of this page could not load');
    const rent = host.querySelector('[data-node="f-rent"] input') as HTMLInputElement;
    rent.value = '130';
    rent.dispatchEvent(new Event('input', { bubbles: true }));
    rent.dispatchEvent(new Event('change', { bubbles: true }));
    expect(handle.form.getState().values['rent']).toBe(130);
    expect(await handle.save()).toBe(true);
  });
});
