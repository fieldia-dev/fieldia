import type { RelatedRecord } from '@fieldia/core';
import { mountKind, press } from './test-kinds';
import type { WidgetDialogs } from './widgets';

/**
 * A many2many as a work item's links: "Add link" — a menu of Existing item
 * and New item, or a search at once — a row for each record linked, and while
 * none is, a light box of help with links in its words, or a link that finds
 * an existing record.
 */

const field = { type: 'many2many', label: 'Related Work', relation: 'work.item' };
const asked: string[] = [];
const dialogs = (found: RelatedRecord | null = { id: 4130, label: 'Invoice total off by one' }, made: RelatedRecord | null = { id: 4200, label: 'Count after release' }): WidgetDialogs => ({
  canOpen: (model) => model === 'work.item',
  openRecord: async (model, request) => (asked.push(`open ${model} ${request.recordId ?? 'new'}`), made),
  searchMore: async (request) => (asked.push(`search ${request.title}`), found),
  editValues: async () => null,
});
const settle = () => new Promise((resolve) => setTimeout(resolve));

beforeEach(() => (asked.length = 0));

describe('a links box', () => {
  it('opens its Add link menu under the button, its end at the button’s: Existing item, then New item', async () => {
    const { el, value } = mountKind(field, { widget: 'links', options: { add: 'menu', emptyLink: 'Add an existing work item as a parent' } }, { dialogs: dialogs() });
    const add = el.querySelector('.fd-links-add') as HTMLButtonElement;
    expect(add.textContent).toBe('Add link');
    expect([add.getAttribute('aria-haspopup'), add.getAttribute('aria-expanded')]).toEqual(['menu', 'false']);
    add.click();
    expect(add.getAttribute('aria-expanded')).toBe('true');
    const menu = document.getElementById(add.getAttribute('aria-controls') as string) as HTMLElement;
    expect(menu.classList.contains('fd-links-menu')).toBe(true);
    const items = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
    expect(items.map((i) => i.textContent)).toEqual(['Existing item', 'New item']);
    expect(items.map((i) => i.querySelector('svg')?.getAttribute('data-icon'))).toEqual(['link', 'edit']);
    expect(document.activeElement).toBe(items[0]);
    press(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    press(items[1], 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    press(items[0], 'Escape');
    expect(add.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(add);
    // ↓ on the button opens it too.
    press(add, 'ArrowDown');
    (menu.querySelectorAll('[role="menuitem"]')[0] as HTMLElement).click();
    await settle();
    expect(asked).toEqual(['search Related Work']);
    expect(value()).toEqual([{ id: 4130, label: 'Invoice total off by one' }]);
    add.click();
    (menu.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click();
    await settle();
    expect(asked).toEqual(['search Related Work', 'open work.item new']);
    expect(value()).toEqual([{ id: 4130, label: 'Invoice total off by one' }, { id: 4200, label: 'Count after release' }]);
  });

  it('offers an existing record from its empty box, and shows each record linked with × to take it away', async () => {
    const { el, value } = mountKind(field, { widget: 'links', options: { add: 'menu', emptyLink: 'Add an existing work item as a parent' } }, { dialogs: dialogs() });
    const empty = el.querySelector('.fd-links-empty') as HTMLElement;
    expect(empty.hidden).toBe(false);
    (empty.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(value()).toEqual([{ id: 4130, label: 'Invoice total off by one' }]);
    expect(empty.hidden).toBe(true);
    const row = el.querySelector('.fd-links-list li') as HTMLElement;
    expect(row.querySelector('.fd-links-name')?.textContent).toBe('Invoice total off by one');
    const remove = row.querySelector('.fd-links-remove') as HTMLButtonElement;
    expect([remove.getAttribute('aria-label'), remove.title]).toEqual(['Remove Invoice total off by one', 'Remove Invoice total off by one']);
    (row.querySelector('.fd-links-name') as HTMLButtonElement).click();
    await settle();
    expect(asked).toContain('open work.item 4130');
    remove.click();
    expect(value()).toEqual([]);
    expect(empty.hidden).toBe(false);
  });

  it('searches at once with add: search, and shows its help with an icon and links while empty', async () => {
    const { el, value } = mountKind(field, { widget: 'links', options: { add: 'search', helpIcon: 'branch', help: 'Link a [commit](https://example.com/help/commit) to see its status.' } }, { dialogs: dialogs() });
    const add = el.querySelector('.fd-links-add') as HTMLButtonElement;
    expect(add.hasAttribute('aria-haspopup')).toBe(false);
    const help = el.querySelector('.fd-links-help') as HTMLElement;
    expect(help.querySelector('svg')?.getAttribute('data-icon')).toBe('branch');
    const link = help.querySelector('a') as HTMLAnchorElement;
    expect([link.textContent, link.getAttribute('href'), link.target]).toEqual(['commit', 'https://example.com/help/commit', '_blank']);
    expect(help.textContent).toBe('Link a commit to see its status.');
    add.click();
    await settle();
    expect(value()).toEqual([{ id: 4130, label: 'Invoice total off by one' }]);
    expect(help.hidden).toBe(true);
  });

  it('words its button as the page says, in the page’s language, and offers nothing to add when read-only or with no dialogs', () => {
    expect((mountKind(field, { widget: 'links', options: { addLabel: 'Link work' } }, { dialogs: dialogs() }).el.querySelector('.fd-links-add') as HTMLElement).textContent).toBe('Link work');
    const fr = mountKind(field, { widget: 'links', options: { add: 'menu' } }, { dialogs: dialogs(), locale: 'fr' });
    expect((fr.el.querySelector('.fd-links-add') as HTMLElement).textContent).toBe('Ajouter un lien');
    const shown = mountKind(field, { widget: 'links', options: { emptyLink: 'Add one' } }, { dialogs: dialogs() });
    shown.refresh({ readonly: true });
    expect((shown.el.querySelector('.fd-links-add') as HTMLElement).hidden).toBe(true);
    expect((shown.el.querySelector('.fd-links-empty') as HTMLElement).hidden).toBe(true);
    expect((mountKind(field, { widget: 'links' }).el.querySelector('.fd-links-add') as HTMLElement).hidden).toBe(true);
  });
});
