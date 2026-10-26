import { validatePage } from '../format/validate';
import { checkPage } from '../format/check-page';
import { translatePage, pageWords } from '../format/translate';
import type { Page } from '../format/page';
import { createForm } from './form';
import type { ActionHost } from './run';
import { orderPage, orderSource, recordingHost } from './test-steps';

/**
 * A record on paper: a `print` step, which the gear menu's built-in Print is, asks the host to print; the app's own
 * report hands back a file the host shows or saves (`ActionResult.file`); and a page's `print` setting — the words
 * and the logo a printout carries — is checked and translated as the rest of its words are.
 */

/** A host that prints and shows files, saying when. */
function printingHost(): ActionHost & { calls: unknown[][] } {
  const host = recordingHost();
  return Object.assign(host, {
    print: () => void host.calls.push(['print']),
    file: (file: unknown) => void host.calls.push(['file', file]),
  });
}

/** The order page with a gear menu: the built-in Print, and the app's invoice under Print. */
function menuPage(): Page {
  const page = orderPage();
  if (page.layout.type !== 'sheet') throw new Error('a sheet');
  page.layout.toolbar = { menu: [{ id: 'm-print', builtin: 'print' }, { id: 'm-invoice', label: 'Invoice', group: 'print', action: 'print_invoice' }] };
  return page;
}

describe('form.run — print', () => {
  it('asks the host to print, and goes on once it has', async () => {
    const host = printingHost();
    const form = createForm({ page: orderPage(), host, values: { name: 'SO007' } });
    expect(await form.run([{ do: 'print' }, { do: 'say', message: 'Printed' }])).toEqual({ done: true });
    expect(host.calls).toEqual([['print'], ['say', 'Printed', 'info']]);
  });

  it('waits for the host’s printing before the next step', async () => {
    const calls: string[] = [];
    let done: () => void = () => undefined;
    let asked: () => void = () => undefined;
    const printing = new Promise<void>((resolve) => (asked = resolve));
    const host = {
      ...recordingHost(),
      print: () => {
        asked();
        return new Promise<void>((resolve) => (done = resolve)).then(() => void calls.push('printed'));
      },
      say: (message: string) => void calls.push(message),
    };
    const running = createForm({ page: orderPage(), host }).run([{ do: 'print' }, { do: 'say', message: 'after' }]);
    await printing;
    expect(calls).toEqual([]);
    done();
    expect(await running).toEqual({ done: true });
    expect(calls).toEqual(['printed', 'after']);
  });

  it('cannot without a host that prints', async () => {
    expect(await createForm({ page: orderPage(), host: recordingHost() }).run([{ do: 'print' }])).toMatchObject({ done: false, reason: 'cannot', message: expect.stringMatching(/print/) });
  });

  it('is the gear menu’s built-in Print, which asks nothing first and needs no right', async () => {
    const host = printingHost();
    const form = createForm({ page: menuPage(), host, dataSource: orderSource(), recordId: 7 });
    await form.load();
    // Even where the person may not change the record: printing is no change.
    expect(await form.runAction('m-print')).toEqual({ done: true });
    expect(host.calls).toEqual([['print']]);
  });

  it('is a step a page may give its own button, checked as every step is', () => {
    const page = orderPage({ buttons: [{ type: 'button', id: 'b-print', label: 'Print', steps: [{ do: 'print' }] }] });
    expect(validatePage(page).ok).toBe(true);
    // A setting a print step does not have: refused where pages are made and, from 0.36, as one is shown.
    const wrong = JSON.parse(JSON.stringify(page));
    wrong.layout.buttons[0].steps[0].copies = 2;
    expect(validatePage(wrong).ok).toBe(false);
    expect(checkPage(wrong).ok).toBe(false);
  });
});

describe('an action’s file', () => {
  it('is handed to the host to show, after the words the answer says', async () => {
    const host = printingHost();
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const form = createForm({
      page: menuPage(),
      host,
      dataSource: orderSource(),
      recordId: 7,
      onAction: (request) => ({ file: { name: `${String(request.values['name'])}.pdf`, type: 'application/pdf', bytes }, say: 'Ready' }),
    });
    await form.load();
    expect(await form.runAction('m-invoice')).toEqual({ done: true });
    expect(host.calls).toEqual([['say', 'Ready', 'info'], ['file', { name: 'SO007.pdf', type: 'application/pdf', bytes }]]);
  });

  it('cannot be shown without a host that shows files: said, never dropped', async () => {
    const form = createForm({ page: menuPage(), host: recordingHost(), onAction: () => ({ file: { name: 'a.pdf', url: '/a.pdf' } }) });
    expect(await form.runAction('m-invoice')).toMatchObject({ done: false, reason: 'cannot', message: expect.stringMatching(/a\.pdf/) });
  });
});

describe('a page’s print setting', () => {
  const printed = (print: unknown): Page => ({ ...orderPage(), print } as Page);

  it('takes a header, a footer and the app’s logo', () => {
    expect(validatePage(printed({ header: 'Nile Traders · Cairo', footer: 'Paid within 30 days', logo: 'https://example.com/logo.svg' })).ok).toBe(true);
    for (const logo of ['/brand/logo.png', 'logo.png', './logo.svg', 'data:image/png;base64,iVBORw0KGgo=']) expect(validatePage(printed({ logo })).ok).toBe(true);
  });

  it('refuses a logo that is no image’s address, and words it does not know', () => {
    for (const logo of ['javascript:alert(1)', 'data:text/html,<b>', '']) expect(validatePage(printed({ logo })).ok).toBe(false);
    expect(validatePage(printed({ header: 'Hi', margins: 10 })).ok).toBe(false);
  });

  it('is translated as the page’s other words are, and listed among them; its logo is no word', () => {
    const page = printed({ header: 'Thank you', footer: 'Terms', logo: '/logo.svg' });
    expect(pageWords(page)).toEqual(expect.arrayContaining(['Thank you', 'Terms']));
    expect(pageWords(page)).not.toContain('/logo.svg');
    const french = translatePage(page, (text) => ({ 'Thank you': 'Merci', Terms: 'Conditions' })[text] ?? text);
    expect(french.print).toEqual({ header: 'Merci', footer: 'Conditions', logo: '/logo.svg' });
  });

  it('a list’s Print is off unless true', () => {
    const list: Page = {
      fieldia: '0.13',
      id: 'orders',
      data: { kind: 'record', model: 'sale.order' },
      fields: { name: { type: 'char', label: 'Name' } },
      layout: { type: 'list', id: 'l', columns: ['name'], print: true },
    };
    expect(validatePage(list).ok).toBe(true);
    expect(validatePage({ ...list, layout: { ...list.layout, print: 'yes' } } as never).ok).toBe(false);
  });
});
