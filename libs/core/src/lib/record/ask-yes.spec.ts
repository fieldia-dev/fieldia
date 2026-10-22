import type { Page } from '../format/page';
import { FORMAT_VERSION } from '../format/version';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';
import type { ActionHost, AskHow } from './run';

/**
 * A question whose Yes does something says what in its Yes: a button's `confirm` is answered by the button's own
 * words, Archive and Delete by Archive and Delete, an `ask` step by what was pressed — never a bare OK. The owner's walk
 * of 0.29 met "Paste 40 rows: change 7 and add 33?" answered by OK; the rule is the same for every question.
 */

const order: Page = {
  fieldia: FORMAT_VERSION,
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: { name: { type: 'char', label: 'Name' }, active: { type: 'boolean', label: 'Active' }, state: { type: 'char', label: 'State' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    buttons: [
      { type: 'button', id: 'b-send', label: 'Send the quote', confirm: 'Send it to the customer now?', steps: [{ do: 'set', field: 'state', value: "'sent'" }] },
      { type: 'button', id: 'b-cancel', label: 'Cancel the order', steps: [{ do: 'ask', message: 'The customer is told. Go on?' }, { do: 'set', field: 'state', value: "'cancel'" }] },
      { type: 'button', id: 'b-trash', label: 'Throw away', icon: 'trash', iconOnly: true, confirm: 'Throw it away?', steps: [] },
    ],
    toolbar: {
      menu: [
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-delete', builtin: 'delete' },
        { id: 'm-retire', label: 'Retire', builtin: 'archive' },
      ],
    },
    children: [{ type: 'field', id: 'f-name', field: 'name' }],
  },
};

const source = () => createMemoryDataSource({ records: { 'sale.order': { 1: { name: 'S00012', active: true, state: 'draft' }, 2: { name: 'S00013', active: true, state: 'draft' } } } });

/** A host that writes down each question and how it was asked, and answers Yes. */
function asking() {
  const asked: { message: string; how?: AskHow }[] = [];
  const host: ActionHost = { open: async () => ({ saved: false }), say: () => undefined, ask: async (message, how) => (asked.push({ message, ...(how ? { how } : {}) }), true) };
  return { host, asked };
}

describe('a question’s Yes names what it does', () => {
  it('a button’s confirm: Yes is the button’s own words, an icon-only button’s its name', async () => {
    const { host, asked } = asking();
    const form = createForm({ page: order, dataSource: source(), recordId: 1, host });
    await form.load();
    await form.runAction('b-send');
    await form.runAction('b-trash');
    expect(asked).toEqual([
      { message: 'Send it to the customer now?', how: { yes: 'Send the quote' } },
      { message: 'Throw it away?', how: { yes: 'Throw away' } },
    ]);
  });

  it('an ask step of a pressed button: Yes goes on with the press, so it says the button’s words', async () => {
    const { host, asked } = asking();
    const form = createForm({ page: order, dataSource: source(), recordId: 1, host });
    await form.load();
    await form.runAction('b-cancel');
    expect(asked).toEqual([{ message: 'The customer is told. Go on?', how: { yes: 'Cancel the order' } }]);
    expect(form.getState().values['state']).toBe('cancel');
  });

  it('steps run by the app: the words it gives for what they do, else a plain question', async () => {
    const { host, asked } = asking();
    const form = createForm({ page: order, dataSource: source(), recordId: 1, host });
    await form.load();
    await form.run([{ do: 'ask', message: 'Mark it won?' }], { id: 'won', yes: 'Mark as won' });
    await form.run([{ do: 'ask', message: 'Go on?' }]);
    expect(asked).toEqual([{ message: 'Mark it won?', how: { yes: 'Mark as won' } }, { message: 'Go on?' }]);
  });

  it('the gear menu’s Archive and Delete: Yes says Archive and Delete, in the page’s language; an item’s own label wins', async () => {
    const { host, asked } = asking();
    for (const item of ['m-archive', 'm-retire', 'm-delete']) {
      // Each on a record not archived yet: an archived one is offered no Archive.
      const form = createForm({ page: order, dataSource: source(), recordId: 1, host });
      await form.load();
      await form.runAction(item);
    }
    expect(asked).toEqual([
      { message: MESSAGES.en.archiveConfirm, how: { yes: 'Archive' } },
      { message: MESSAGES.en.archiveConfirm, how: { yes: 'Retire' } },
      { message: MESSAGES.en.deleteConfirm, how: { yes: 'Delete' } },
    ]);
    const arabic = asking();
    const inArabic = createForm({ page: order, dataSource: source(), recordId: 2, host: arabic.host, messages: MESSAGES.ar });
    await inArabic.load();
    await inArabic.runAction('m-delete');
    expect(arabic.asked).toEqual([{ message: MESSAGES.ar.deleteConfirm, how: { yes: MESSAGES.ar.deleteYes } }]);
    expect(MESSAGES.ar.deleteYes).not.toBe('Delete');
  });

  it('a save’s beforeSave question: Yes says what set the save off — a button’s words, the app’s, else plainly', async () => {
    const { host, asked } = asking();
    const page: Page = {
      ...order,
      on: { beforeSave: [{ do: 'ask', message: 'Send the order?' }] },
      layout: { ...(order.layout as object), buttons: [{ type: 'button', id: 'b-confirm', label: 'Confirm the order', steps: [{ do: 'set', field: 'state', value: "'sale'" }, { do: 'save' }] }] } as Page['layout'],
    };
    const form = createForm({ page, dataSource: source(), recordId: 1, host });
    await form.load();
    await form.runAction('b-confirm');
    form.setValue('name', 'S00012-B');
    await form.save({ yes: 'Submit' });
    form.setValue('name', 'S00012-C');
    await form.save();
    expect(asked).toEqual([
      { message: 'Send the order?', how: { yes: 'Confirm the order' } },
      { message: 'Send the order?', how: { yes: 'Submit' } },
      { message: 'Send the order?' },
    ]);
  });

  it('with no host, the app’s own confirm is told the same words', async () => {
    const asked: [string, AskHow | undefined][] = [];
    const form = createForm({ page: order, dataSource: source(), recordId: 1, confirm: (message, how) => (asked.push([message, how]), false) });
    await form.load();
    await form.runAction('b-send');
    await form.runAction('m-archive');
    expect(asked).toEqual([
      ['Send it to the customer now?', { yes: 'Send the quote' }],
      [MESSAGES.en.archiveConfirm, { yes: 'Archive' }],
    ]);
  });
});
