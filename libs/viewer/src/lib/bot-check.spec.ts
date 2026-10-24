import { createMemoryDataSource, type BotReport, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A public page's bot check, as the viewer draws it: a hidden box no person sees, reaches or hears, which a bot
 * filling every box fills; the captcha in the app's own slot, its token handed to the form; and every send telling the
 * app what was seen, never refused for it. And a box the browser fills from a pick in another, read at once.
 */

const signup = (botCheck?: Page['botCheck']): Page => ({
  fieldia: '0.12',
  id: 'signup',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Full name', required: true }, email: { type: 'char', label: 'Email' }, seats: { type: 'integer', label: 'Seats', min: 1 } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name', autocomplete: 'name' },
      { type: 'field', id: 'f-email', field: 'email', widget: 'email' },
      { type: 'field', id: 'f-seats', field: 'seats' },
      { type: 'slot', id: 's-captcha', name: 'captcha' },
    ],
  },
  ...(botCheck ? { botCheck } : {}),
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page, slots: Parameters<typeof mountViewer>[1]['slots'] = {}) {
  const dataSource = createMemoryDataSource();
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource, slots });
  const box = (id: string) => host.querySelector(`[data-node="${id}"] input`) as HTMLInputElement;
  const sent = () => dataSource.responses.map((response) => response.bot);
  return { host, form: handle.form, box, sent, trap: () => host.querySelector('.fd-trap input') as HTMLInputElement | null };
}

/** Chrome's and Safari's autofill: the box written whole, no key pressed, then input and change. */
function fills(box: HTMLInputElement, text: string) {
  box.value = text;
  box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('a public page’s bot check in the viewer', () => {
  it('draws nothing of it on a page without one: as 0.23', async () => {
    const { trap, form, box, sent } = mount(signup());
    expect(trap()).toBeNull();
    box('f-name').value = 'Sara';
    box('f-name').dispatchEvent(new Event('input', { bubbles: true }));
    expect(await form.save()).toBe(true);
    expect(sent()).toEqual([undefined]);
  });

  it('draws a box no person sees, reaches with Tab or hears read out, and no browser fills', () => {
    const { host, trap } = mount(signup({}));
    const box = trap() as HTMLInputElement;
    const holder = box.closest('.fd-trap') as HTMLElement;
    expect([holder.getAttribute('aria-hidden'), holder.hasAttribute('inert'), box.tabIndex, box.getAttribute('autocomplete')]).toEqual(['true', true, -1, 'off']);
    expect(host.querySelector(`label[for="${box.id}"]`)?.textContent).toBe('Leave this box empty');
    // Inside the form a bot reads, which the Submit sends.
    expect(box.closest('form.fd-form')).not.toBeNull();
  });

  it('draws no box where the page turned it off', () => {
    expect(mount(signup({ honeypot: false })).trap()).toBeNull();
  });

  it('tells a send with the box filled — as typed, or written without a word — and never refuses it', async () => {
    const { trap, form, box, sent } = mount(signup({ minSeconds: 0 }));
    box('f-name').value = 'Bot';
    box('f-name').dispatchEvent(new Event('input', { bubbles: true }));
    // A bot that sets the box's value without a word: read as the answers go.
    (trap() as HTMLInputElement).value = 'https://spam.example';
    expect(await form.save()).toBe(true);
    expect(sent()).toEqual([{ honeypot: true, tooFast: false, seconds: expect.any(Number) }]);
  });

  it('hands the captcha’s token from the app’s widget in its slot to the send', async () => {
    let solve: (token: string) => void = () => undefined;
    const { host, form, box, sent } = mount(signup({ captcha: 'captcha', minSeconds: 0 }), {
      captcha: (element, { form: inSlot }) => {
        element.textContent = 'Captcha';
        solve = (token) => inSlot.botCheck({ captcha: token });
      },
    });
    expect(host.querySelector('[data-slot="captcha"]')?.textContent).toBe('Captcha');
    box('f-name').value = 'Sara';
    box('f-name').dispatchEvent(new Event('input', { bubbles: true }));
    solve('0.token');
    expect(await form.save()).toBe(true);
    expect(sent()).toEqual([{ honeypot: false, tooFast: false, seconds: expect.any(Number), captcha: '0.token' }] satisfies (BotReport | undefined)[]);
  });
});

describe('a box the browser fills from a pick in another', () => {
  it('is read at once, as one typed in and left, and its problem said', () => {
    const { host, form, box } = mount(signup());
    box('f-name').focus();
    // Picked in the name's box: the browser fills the others too.
    fills(box('f-name'), 'Sara Hassan');
    fills(box('f-email'), ' sara@example.com ');
    fills(box('f-seats'), 'twelve');
    expect(form.getState().values).toMatchObject({ name: 'Sara Hassan', email: 'sara@example.com', seats: null });
    expect(form.getState().unread['seats']?.text).toBe('twelve');
    expect(host.querySelector('[data-node="f-seats"] .fd-error')?.textContent).toBe(form.getState().unread['seats']?.message);
    // The box picked in is read as it is left, as typing is.
    expect(host.querySelector('[data-node="f-name"] .fd-error:not([hidden])')).toBeNull();
  });
});
