import { createMemoryDataSource, type ActionRequest, type ActionResult } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { shortDate, tabsAround } from './record-head';
import { BUG, VALUES } from './test-head';

/**
 * A record's head, drawn: the kind's strip and badge, the number before the
 * title and Copy title, the row with a field and "1 Comment", the buttons —
 * split, toggled, by their icon alone — and ⋮; the band of fields, their
 * access keys underlined and working, a lock in the lead slot; "Updated by";
 * the tabs in the head with their counts. In Arabic it reads right to left in
 * Arabic words; nothing of the classic header is drawn.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

async function draw(over: { locale?: string; onAction?: (request: ActionRequest) => ActionResult | void } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } });
  handle = mountViewer(host, { page: BUG, dataSource, recordId: 1, ...(over.locale ? { locale: over.locale } : {}), ...(over.onAction ? { onAction: over.onAction } : {}) });
  await handle.form.settled();
  return { host, root: handle.element, part: (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement };
}

const press = (element: Element | null) => (element as HTMLElement).click();
const settled = () => (handle as ViewerHandle).form.settled();

describe('a record head', () => {
  it('draws its kind’s strip and badge, the number before the title, and no classic header', async () => {
    const { host } = await draw();
    const head = host.querySelector('.fd-head') as HTMLElement;
    expect(head.dataset['kind']).toBe('bug');
    expect(head.style.getPropertyValue('--fd-kind')).toBe('#cc293d');
    expect(host.querySelector('.fd-head-badge')?.textContent).toBe('BUG 4127');
    expect(host.querySelector('.fd-head-badge .fd-icon')?.getAttribute('data-icon')).toBe('bug');
    // The number as an id is written, never grouped: then the title's own box.
    const line = host.querySelector('.fd-head-title') as HTMLElement;
    expect(line.querySelector('.fd-head-number')?.textContent).toBe('4127');
    expect((line.querySelector('[data-node="#title"] input') as HTMLInputElement).value).toBe(VALUES.title);
    expect(line.querySelector('.fd-head-copy')?.getAttribute('aria-label')).toBe('Copy title');
    // The classic header bar, statusbar, badges and the gear's own bar are not drawn.
    expect(host.querySelector('.fd-header, .fd-card, .fd-badges, .fd-record-bar')).toBeNull();
    // Another kind, another look.
    handle?.form.setValue('work_type', 'task');
    expect(head.style.getPropertyValue('--fd-kind')).toBe('#f2cb1d');
    expect(host.querySelector('.fd-head-badge')?.textContent).toBe('TASK 4127');
  });

  it('draws one kind named by the head, its strip in its own colour', async () => {
    const page = JSON.parse(JSON.stringify(BUG));
    page.layout.head.kind = { label: 'Bug', colour: '#cc293d', icon: 'bug' };
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } }), recordId: 1 });
    await handle.form.settled();
    const head = host.querySelector('.fd-head') as HTMLElement;
    expect(head.hasAttribute('data-kind')).toBe(true);
    expect(head.style.getPropertyValue('--fd-kind')).toBe('#cc293d');
    // The number is the record's id without a number field.
    expect(host.querySelector('.fd-head-badge')?.textContent).toBe('BUG 1');
  });

  it('draws its row: a field with its label read out, not shown, and “1 Comment” in the plural it needs', async () => {
    const { part } = await draw();
    expect(part('h-assigned').dataset['labels']).toBe('hidden');
    expect(part('h-assigned').querySelector('input')?.getAttribute('placeholder')).toBe('No one selected');
    expect(part('h-comments').textContent).toBe('1 Comment');
    handle?.form.setValues({ comment_count: 2 }, { stored: true });
    expect(part('h-comments').textContent).toBe('2 Comments');
    expect(handle?.form.getState().dirty).toEqual([]);
  });

  it('takes the reader to its target: the tab shown, the group’s first box focused', async () => {
    const { part } = await draw();
    press(part('t-history'));
    expect(part('t-history').getAttribute('aria-selected')).toBe('true');
    press(part('h-comments'));
    expect(part('t-details').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(part('f-notes').querySelector('textarea'));
  });

  it('draws Save and Close as a split button, quiet with nothing changed and primary once something is', async () => {
    const { part } = await draw();
    const split = part('b-save-close');
    expect(split.getAttribute('role')).toBe('group');
    const [main, more] = [...split.querySelectorAll<HTMLButtonElement>(':scope > button')];
    expect(main.textContent).toBe('Save and Close');
    expect(main.classList.contains('fd-button-subtle')).toBe(true);
    expect(more.getAttribute('aria-label')).toBe('Save and Close options');
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    handle?.form.setValue('area', 'Warehouse');
    expect(main.classList.contains('fd-button-primary')).toBe(true);
    expect(more.classList.contains('fd-button-primary')).toBe(true);
    // Its menu: Save, which saves and leaves the record open.
    press(more);
    const save = split.querySelector('[role="menuitem"]') as HTMLButtonElement;
    expect(save.textContent).toBe('Save');
    expect(document.activeElement).toBe(save);
    press(save);
    await settled();
    expect(handle?.form.getState().dirty).toEqual([]);
    expect(main.classList.contains('fd-button-subtle')).toBe(true);
  });

  it('toggles Follow by the app’s answer, the record never changed by it; its gear is a menu named for itself', async () => {
    const asked: string[] = [];
    const { part } = await draw({ onAction: (request) => (asked.push(request.action), { stored: { following: request.values['following'] !== true } }) });
    const follow = part('b-follow');
    const main = follow.querySelector(':scope > button') as HTMLButtonElement;
    expect(main.getAttribute('aria-pressed')).toBe('false');
    press(main);
    await settled();
    expect(main.getAttribute('aria-pressed')).toBe('true');
    expect(main.textContent).toBe('Following');
    expect(handle?.form.getState().dirty).toEqual([]);
    const gear = follow.querySelector('.fd-split-more') as HTMLButtonElement;
    expect(gear.getAttribute('aria-label')).toBe('Notification settings');
    expect(gear.title).toBe('Notification settings');
    expect(gear.querySelector('.fd-icon')?.getAttribute('data-icon')).toBe('gear');
    expect(asked).toEqual(['follow']);
  });

  it('names its icon-only buttons and ⋮, and says why Undo does nothing when nothing changed', async () => {
    const { host, part } = await draw();
    for (const [id, name] of [['b-refresh', 'Refresh'], ['b-undo', 'Revert changes']]) {
      expect(part(id).getAttribute('aria-label')).toBe(name);
      expect(part(id).title).toBe(name);
      expect(part(id).textContent).toBe('');
    }
    const more = host.querySelector('.fd-head-actions .fd-head-more') as HTMLButtonElement;
    expect(more.getAttribute('aria-label')).toBe('More actions');
    press(more);
    expect(host.querySelector('.fd-head-actions .fd-record-actions [role="menuitem"]')?.textContent).toBe('Copy link');
    press(part('b-undo'));
    expect(host.querySelector('.fd-says')?.textContent).toContain('Nothing has changed.');
    // With a change, Undo puts it back.
    handle?.form.setValue('area', 'Warehouse');
    press(part('b-undo'));
    await settled();
    expect(handle?.form.getState().values['area']).toBe('Portal');
  });

  it('draws the band’s fields quiet, labels beside them, the access key underlined, Alt with it focusing the field', async () => {
    const { part } = await draw();
    const state = part('f-state');
    expect(state.dataset['labels']).toBe('beside');
    expect(state.hasAttribute('data-quiet')).toBe(true);
    expect(state.querySelector('.fd-label .fd-access-key')?.textContent).toBe('e');
    expect(state.querySelector('.fd-label')?.textContent).toBe('State');
    expect(part('f-area').querySelector('.fd-access-key')?.textContent).toBe('A');
    expect(part('f-area').querySelector('input')?.getAttribute('aria-keyshortcuts')).toBe('Alt+A');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'å', code: 'KeyA', altKey: true, bubbles: true }));
    expect(document.activeElement).toBe(part('f-area').querySelector('input'));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '€', code: 'KeyE', altKey: true, bubbles: true }));
    expect(state.contains(document.activeElement)).toBe(true);
  });

  it('puts a lock at the value’s start, saying why', async () => {
    const { part } = await draw();
    const reason = part('f-reason');
    expect(reason.dataset['lockAt']).toBe('value');
    const lock = reason.querySelector('.fd-lock-wrap') as HTMLElement;
    expect(lock.hidden).toBe(false);
    expect(lock.nextElementSibling?.matches('input')).toBe(true);
    expect(reason.querySelector('.fd-label .fd-lock')).toBeNull();
    expect(reason.querySelector('.fd-help-bubble')?.textContent).toBe('Set by the workflow');
  });

  it('says who updated it and when, and shows its history at a press', async () => {
    const { host, part } = await draw();
    const updated = host.querySelector('.fd-head-updated') as HTMLButtonElement;
    expect(updated.tagName).toBe('BUTTON');
    expect(updated.textContent).toBe(`Updated by Mona Adel: ${shortDate('2026-08-25T09:40:00', 'en')}`);
    press(updated);
    expect(part('t-history').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(part('t-history'));
  });

  it('puts its tabs at the band’s end and their panels in its body, an icon alone named, a count in its pill and its name', async () => {
    const { host, part } = await draw();
    const strip = host.querySelector('.fd-head-band .fd-head-tabs [role="tablist"]') as HTMLElement;
    expect([...strip.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('data-node'))).toEqual(['t-details', 't-history', 't-links']);
    expect(host.querySelector('.fd-head-body [role="tabpanel"]')).not.toBeNull();
    expect(part('t-history').getAttribute('aria-label')).toBe('History');
    expect(part('t-history').title).toBe('History');
    expect(part('t-links').getAttribute('aria-label')).toBe('Links, 0');
    expect(part('t-links').querySelector('.fd-tab-count')?.textContent).toBe('0');
    handle?.form.setValue('related', [{ id: 2, label: 'Count stock again' }]);
    expect(part('t-links').getAttribute('aria-label')).toBe('Links, 1');
    // The arrows move along them.
    part('t-details').focus();
    part('t-details').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(part('t-history').getAttribute('aria-selected')).toBe('true');
  });

  it('hides the tabs’ strip in the head with them', async () => {
    const page = JSON.parse(JSON.stringify(BUG));
    page.layout.children[0].invisible = 'following';
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } }), recordId: 1 });
    await handle.form.settled();
    const strip = host.querySelector('.fd-head-tabs .fd-tabbar') as HTMLElement;
    expect(strip.hidden).toBe(false);
    handle.form.setValues({ following: true }, { stored: true });
    expect(strip.hidden).toBe(true);
  });

  it('reads in Arabic, right to left, its kind and words translated', async () => {
    const { host, part } = await draw({ locale: 'ar' });
    expect(handle?.element.getAttribute('dir')).toBe('rtl');
    expect(host.querySelector('.fd-head-badge')?.textContent).toBe('خطأ 4127');
    expect(part('h-comments').textContent).toBe('1 تعليق');
    expect(part('b-save-close').querySelector('button')?.textContent).toBe('حفظ وإغلاق');
    expect(part('t-links').getAttribute('aria-label')).toBe('الروابط، 0');
    expect(host.querySelector('.fd-head-copy')?.getAttribute('aria-label')).toBe('نسخ العنوان');
  });

  it('finds the tabs a part stands in, and writes a date as a head says it', () => {
    expect(tabsAround(BUG.layout, 'f-notes')).toEqual(['t-details']);
    expect(tabsAround(BUG.layout, 't-links')).toEqual(['t-links']);
    expect(tabsAround(BUG.layout, 'nowhere')).toEqual([]);
    const now = new Date('2026-10-12T12:00:00');
    expect(shortDate('2026-08-25', 'en', now)).toBe('Aug 25');
    expect(shortDate('2025-08-25T10:00:00', 'en', now)).toBe('Aug 25, 2025');
    expect(shortDate('2026-08-25', 'ar', now)).toMatch(/25/);
  });
});
