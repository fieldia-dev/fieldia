import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { mountDiscussion } from './discussion';
import { createMemoryChatter } from './memory';
import { chatterSlot } from './slot';

/**
 * A record's discussion, as a work item draws it: a card to write a comment
 * in, then a card for each comment, newest first — never the record's tracked
 * changes. Save with nothing typed says why; Ctrl+Enter saves; Escape asks
 * first when words were typed; the count goes to the page after each load.
 */

const salma = { id: 3, name: 'Salma Nabil' };
const karim = { id: 2, name: 'Karim Fathy', avatar: 'data:image/png;base64,iVBORw0KGgo=' };
const record = { model: 'wi.text', id: 1 };
const chatter = () =>
  createMemoryChatter({
    me: salma,
    people: [salma, karim],
    now: () => new Date('2026-10-12T09:00:00Z'),
    records: {
      'wi.text:1': {
        messages: [
          { id: 501, kind: 'message', author: karim, date: '2026-06-14T10:20:00Z', body: '<p>Need the <a href="https://logs.example/night">night log</a> first.</p>' },
          { id: 500, kind: 'event', author: salma, date: '2026-06-11T08:00:00Z', body: '', tracking: [{ field: 'state', label: 'State', from: 'New', to: 'Active' }] },
          { id: 499, kind: 'message', author: salma, date: '2025-12-01T08:00:00Z', body: '<p>Opened.</p>' },
        ],
      },
    },
  });
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
const typeInto = (area: HTMLElement, html: string) => {
  area.innerHTML = html;
  area.dispatchEvent(new Event('input', { bubbles: true }));
};

function mount(more: Partial<Parameters<typeof mountDiscussion>[1]> = {}) {
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  const counts: number[] = [];
  const source = chatter();
  const handle = mountDiscussion(host, { source, record, me: salma, placeholder: 'Add a comment.', now: () => new Date('2026-10-12T09:00:00Z'), onCount: (n) => counts.push(n), ...more });
  return { host, handle, counts, source, area: () => host.querySelector('.fd-text-area') as HTMLElement, button: (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === name) as HTMLButtonElement };
}

afterEach(() => document.body.replaceChildren());

describe('a discussion', () => {
  it('shows a comment box with the person’s picture, then each comment as a card, newest first, no changes', async () => {
    const { host, counts } = mount();
    await until(() => host.querySelectorAll('.fd-comment-card[data-message]').length);
    const cards = [...host.querySelectorAll('li.fd-comment-card')];
    expect(cards.map((c) => c.getAttribute('data-message'))).toEqual(['501', '499']);
    expect(cards[0].querySelector('.fd-comment-author')?.textContent).toBe('Karim Fathy');
    expect(cards[0].querySelector('img.fd-discussion-avatar')?.getAttribute('src')).toBe(karim.avatar);
    const date = cards[0].querySelector('.fd-comment-date') as HTMLAnchorElement;
    expect([date.textContent, date.getAttribute('href')]).toEqual(['commented Jun 14', '#comment-501']);
    expect(cards[0].id).toBe('comment-501');
    // Another year says its year.
    expect(cards[1].querySelector('.fd-comment-date')?.textContent).toBe('commented Dec 1, 2025');
    const link = cards[0].querySelector('.fd-comment-body a') as HTMLAnchorElement;
    expect([link.target, link.nextElementSibling?.getAttribute('data-icon')]).toEqual(['_blank', 'external']);
    expect(host.textContent).not.toContain('Active');
    expect(host.querySelector('.fd-discussion-me .fd-discussion-initials')?.textContent).toBe('SN');
    // No messages and notes bar, no followers, no activities.
    expect(host.querySelector('.fd-chatter-bar, .fd-followers, .fd-activities')).toBeNull();
    expect(counts).toEqual([2]);
  });

  it('opens its editor on focus: the toolbar inside, the switch link, Cancel and Save', async () => {
    const { host, area, button } = mount();
    const card = host.querySelector('.fd-composer-card') as HTMLElement;
    expect(area().getAttribute('data-placeholder')).toBe('Add a comment.');
    expect(area().getAttribute('aria-label')).toBe('Comment');
    expect(host.querySelector('.fd-text')?.getAttribute('data-toolbar')).toBe('focus');
    expect(host.querySelector('.fd-text')?.getAttribute('data-switch')).toBe('always');
    expect(host.querySelector('.fd-text-switch')?.textContent).toBe('switch to Markdown editor');
    area().focus();
    expect(card.hasAttribute('data-open')).toBe(true);
    expect([button('Cancel'), button('Save')].every(Boolean)).toBe(true);
    expect(host.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Formatting');
  });

  it('says why Save does nothing with nothing typed, and keeps the box open', async () => {
    const { host, area, button, source } = mount();
    area().focus();
    button('Save').click();
    await until(() => host.querySelector('.fd-discussion-problem')?.textContent);
    expect(host.querySelector('.fd-discussion-problem')?.textContent).toBe('Write a comment first.');
    expect(host.querySelector('.fd-discussion-problem')?.getAttribute('role')).toBe('status');
    expect(source.posted).toEqual([]);
    expect(button('Save').disabled).toBe(false);
    // Drawn idle meanwhile, its tooltip saying why, still a button; itself again once words are typed.
    expect([button('Save').hasAttribute('data-idle'), button('Save').hasAttribute('aria-disabled'), button('Save').title]).toEqual([true, false, 'Write a comment first.']);
    typeInto(area(), '<p>Shelf 4.</p>');
    expect([button('Save').hasAttribute('data-idle'), button('Save').title]).toEqual([false, '']);
  });

  it('saves with Ctrl+Enter: the new comment first, the box empty, the count told', async () => {
    const { host, area, source, counts } = mount();
    await until(() => counts.length);
    area().focus();
    typeInto(area(), '<p>Found it on <b>shelf 4</b>.</p>');
    press(area(), 'Enter', { ctrlKey: true });
    await until(() => host.querySelectorAll('li.fd-comment-card').length === 3);
    expect(source.posted.map((m) => [m.kind, m.body])).toEqual([['message', '<p>Found it on <b>shelf 4</b>.</p>']]);
    expect(host.querySelector('li.fd-comment-card .fd-comment-body')?.innerHTML).toBe('<p>Found it on <b>shelf 4</b>.</p>');
    expect(area().textContent).toBe('');
    expect(counts).toEqual([2, 3]);
  });

  it('cancels with Escape, asking first when words were typed', async () => {
    const { host, area } = mount();
    const card = host.querySelector('.fd-composer-card') as HTMLElement;
    area().focus();
    typeInto(area(), '<p>half a thought</p>');
    press(area(), 'Escape');
    const ask = host.querySelector('.fd-discussion-ask') as HTMLElement;
    expect(ask.hidden).toBe(false);
    expect(ask.textContent).toContain('Discard your comment?');
    (ask.querySelector('button:last-child') as HTMLButtonElement).click();
    expect(area().textContent).toBe('half a thought');
    press(area(), 'Escape');
    (ask.querySelector('button') as HTMLButtonElement).click();
    expect(area().textContent).toBe('');
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('speaks the page’s language', async () => {
    const { host } = mount({ locale: 'fr' });
    await until(() => host.querySelector('.fd-comment-date'));
    expect(host.querySelector('.fd-comment-date')?.textContent).toBe('a commenté le 14 juin');
    expect(host.querySelector('.fd-text-switch')?.textContent).toBe('passer à l’éditeur Markdown');
    expect([...host.querySelectorAll('.fd-discussion-button')].map((b) => b.textContent)).toEqual(['Annuler', 'Enregistrer']);
  });
});

describe('chatterSlot with the discussion look', () => {
  it('draws a page’s slot as a discussion and hands the count to the page', async () => {
    const page: Page = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'examples', 'pages', 'wi-text.page.json'), 'utf8'));
    const host = document.createElement('div');
    document.body.append(host);
    const told: [number, string][] = [];
    const dataSource = createMemoryDataSource({ records: { 'wi.text': { 1: { name: 'Bug 4127' } } } });
    const viewer: ViewerHandle = mountViewer(host, {
      page,
      dataSource,
      recordId: 1,
      slots: { discussion: chatterSlot({ look: 'discussion', source: chatter(), me: salma, onCount: (n, form) => told.push([n, form.page.id]) }) },
    });
    await until(() => host.querySelector('.fd-slot[data-slot="discussion"] li.fd-comment-card'));
    expect(host.querySelector('.fd-slot[data-slot="discussion"] .fd-chatter')).toBeNull();
    // After each load — the record opened, then loaded again — the same count.
    expect(told.length).toBeGreaterThan(0);
    expect(told.every(([n, id]) => n === 2 && id === 'wi-text')).toBe(true);
    viewer.destroy();
  });
});
