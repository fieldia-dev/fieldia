import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog, type FormDialogOptions } from './dialog';
import { BUG, VALUES } from './test-head';

/**
 * A large popup as a work item opens over its backlog: the `inset` size, no
 * dimmed page, ⤢ and a grip; and a page with a head of its own inside it — the
 * dialog draws no title bar and no foot, its ⤢ and × at the end of the head's
 * badge row, named by the badge and the title. Save and Close closes with
 * nothing changed, and saves and closes saved once something has; Escape and ×
 * ask first when there are changes.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement;
const source = () => createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } });
const open = (over: Partial<FormDialogOptions> = {}) => openFormDialog({ page: BUG, dataSource: source(), recordId: 1, title: 'Bug', size: 'inset', backdrop: 'clear', maximise: true, resizable: true, ...over });
const part = (id: string) => dialog().querySelector(`[data-node="${id}"]`) as HTMLElement;
const escape = () => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

let opener: HTMLButtonElement;
beforeEach(() => {
  document.body.replaceChildren();
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener);
  opener.focus();
});

describe('a large popup round a page with a head', () => {
  it('is inset, over a page left clear, with no title bar or foot of its own, its ⤢ and × in the head', async () => {
    void open();
    await flush();
    const box = dialog();
    expect(box.classList.contains('fd-size-inset')).toBe(true);
    expect(box.parentElement?.classList.contains('fd-backdrop-clear')).toBe(true);
    expect(box.querySelector('.fd-form-dialog-head, .fd-form-dialog-foot')).toBeNull();
    const slot = box.querySelector('.fd-head-badge-row .fd-head-window') as HTMLElement;
    expect([...slot.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Maximise', 'Close']);
    // Named by its badge and its title.
    const names = (box.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(names).toEqual(['BUG 4127', VALUES.title]);
    // It opens at rest, holding the focus itself: no field is entered for the person.
    expect(document.activeElement).toBe(box);
  });

  it('closes at once with nothing changed: Save and Close, ×, Escape', async () => {
    const dataSource = source();
    let result = open({ dataSource });
    await flush();
    (part('b-save-close').querySelector('button') as HTMLButtonElement).click();
    expect((await result).saved).toBe(false);
    expect(dataSource.calls.filter((call) => call.method === 'save')).toEqual([]);
    expect(document.activeElement).toBe(opener);
    result = open();
    await flush();
    escape();
    expect((await result).saved).toBe(false);
    result = open();
    await flush();
    (dialog().querySelector('.fd-head-window button[aria-label="Close"]') as HTMLButtonElement).click();
    expect((await result).saved).toBe(false);
  });

  it('saves and closes saved once something changed, Save and Close primary meanwhile', async () => {
    const dataSource = source();
    const result = open({ dataSource });
    await flush();
    const area = part('f-area').querySelector('input') as HTMLInputElement;
    area.value = 'Warehouse';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    const main = part('b-save-close').querySelector('button') as HTMLButtonElement;
    expect(main.classList.contains('fd-button-primary')).toBe(true);
    main.click();
    const done = await result;
    expect(done.saved).toBe(true);
    expect(dataSource.records['work.item'][1]['area']).toBe('Warehouse');
  });

  it('asks before Escape or × drop changes: Cancel keeps the dialog, Discard closes it', async () => {
    const result = open();
    await flush();
    const area = part('f-area').querySelector('input') as HTMLInputElement;
    area.value = 'Warehouse';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    opener.focus();
    escape();
    await flush();
    const question = dialog().querySelector('[role="alertdialog"]') as HTMLElement;
    expect(question.textContent).toContain('Discard your changes?');
    (question.querySelector('button') as HTMLButtonElement).click();
    expect(dialog()).not.toBeNull();
    (dialog().querySelector('.fd-head-window button[aria-label="Close"]') as HTMLButtonElement).click();
    await flush();
    const again = dialog().querySelector('[role="alertdialog"]') as HTMLElement;
    ([...again.querySelectorAll('button')].find((b) => b.textContent === 'Discard') as HTMLButtonElement).click();
    expect((await result).saved).toBe(false);
  });

  it('maximises and restores, its button named for what it does', async () => {
    void open();
    await flush();
    const max = dialog().querySelector('.fd-dialog-max') as HTMLButtonElement;
    max.click();
    expect(dialog().hasAttribute('data-maximised')).toBe(true);
    expect(max.getAttribute('aria-label')).toBe('Restore');
    expect(max.querySelector('.fd-icon')?.getAttribute('data-icon')).toBe('restore');
    max.click();
    expect(dialog().hasAttribute('data-maximised')).toBe(false);
    expect(max.getAttribute('aria-label')).toBe('Maximise');
  });

  it('resizes by its grip’s arrow keys, sixteen pixels a press, the way the page reads', async () => {
    void open();
    await flush();
    const box = dialog();
    box.getBoundingClientRect = () => ({ left: 96, top: 46, right: 896, bottom: 646, width: 800, height: 600, x: 96, y: 46, toJSON: () => ({}) });
    const grip = box.querySelector('.fd-dialog-grip') as HTMLButtonElement;
    expect(grip.getAttribute('aria-label')).toBe('Resize');
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(box.style.width).toBe('816px');
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(box.style.height).toBe('584px');
    expect(box.hasAttribute('data-resized')).toBe(true);
    expect(box.style.left).toBe('96px');
  });

  it('keeps a title bar and foot for a page with no head, with ⤢ beside ×', async () => {
    const plain = { ...BUG, layout: { ...(BUG.layout as object), head: undefined, statusbar: undefined, badges: undefined, children: [] } } as unknown as Page;
    void openFormDialog({ page: plain, dataSource: source(), recordId: 1, title: 'Bug', maximise: true });
    await flush();
    const head = dialog().querySelector('.fd-form-dialog-head') as HTMLElement;
    expect([...head.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Maximise', 'Close']);
    expect(dialog().querySelector('.fd-form-dialog-foot')).not.toBeNull();
    expect(dialog().querySelector('.fd-dialog-grip')).toBeNull();
  });
});
