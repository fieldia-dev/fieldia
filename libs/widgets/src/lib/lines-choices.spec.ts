import { createForm, type DataSource, type Field, type FieldNode, type Line, type Option, type OptionsRequest, type Page, type Values } from '@fieldia/core';
// The widgets first: lines.ts and widgets.ts import each other, and the table is found among the widgets once both are in.
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { plainLinesWidget } from './lines-plain';
import { lineForm } from './lines';

/**
 * A table's lines with choices from the app's lists: an agent's tools, each line's from the connection on it — its
 * own choices in its cell, asked again as its connection changes, a tool the new one does not offer cleared and said
 * under the cell; a block pasted reads a tool by its line's choices, the connection pasted beside it first.
 */

const TOOLS: Record<string, Option[]> = {
  gmail: [
    { value: 'send_email', label: 'Send email' },
    { value: 'read_inbox', label: 'Read inbox' },
  ],
  slack: [
    { value: 'post_message', label: 'Post message' },
    { value: 'read_inbox', label: 'Read channel' },
  ],
};

const page = {
  fieldia: '0.12',
  id: 'agent',
  data: { kind: 'record', model: 'agent' },
  fields: {
    tools: {
      type: 'one2many',
      label: 'Tools',
      relation: 'agent.tool',
      fields: {
        connection: { type: 'selection', label: 'Connection', options: [{ value: 'gmail', label: 'Gmail' }, { value: 'slack', label: 'Slack' }] },
        tool: { type: 'selection', label: 'Tool', options: [], optionsFrom: { list: 'tools', dependsOn: ['connection'] } },
        note: { type: 'char', label: 'Note' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-tools', field: 'tools', columns: ['note', 'connection', 'tool'] }] },
} as unknown as Page;

function mount(lines: Line[], answer: (request: OptionsRequest) => Promise<Option[]> = async (request) => TOOLS[request.values['connection'] as string] ?? []) {
  const asked: OptionsRequest[] = [];
  const dataSource: DataSource = {
    options: (request) => {
      asked.push(request);
      return answer(request);
    },
  };
  const form = createForm({ page, dataSource, values: { tools: lines } as Values });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'tools', field: page.fields['tools'] as Field, node, id: 'fd-tools', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['tools'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, asked };
}

const row = (el: Element, n: number) => el.querySelectorAll('tbody tr')[n] as HTMLTableRowElement;
const input = (el: Element, n: number, column: string) => row(el, n).querySelector(`td[data-column="${column}"] input`) as HTMLInputElement;
const select = (el: Element, n: number, column: string) => row(el, n).querySelector(`td[data-column="${column}"] select`) as HTMLSelectElement;
const offered = (el: Element, n: number) => [...select(el, n, 'tool').options].map((option) => option.textContent).filter(Boolean);
const said = (el: Element, n: number) => [...row(el, n).querySelectorAll('td[data-column="tool"] [role=status]')].filter((s) => !(s as HTMLElement).hidden).map((s) => s.textContent);
const values = (form: ReturnType<typeof createForm>) => (form.getState().values['tools'] as Line[]).map((line) => line.values);
const choose = (box: HTMLSelectElement, label: string) => {
  box.value = String([...box.options].findIndex((option) => option.textContent === label) - 1);
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
/** A paste reads names and choices before anything is written: its writes come a moment after. */
const pasted = () => new Promise((resolve) => setTimeout(resolve, 0));
function paste(target: HTMLElement, text: string) {
  target.focus();
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : '') } });
  target.dispatchEvent(event);
}

describe('a table line’s choices from the app’s lists', () => {
  it('offers each line its connection’s tools, asked once for lines alike', async () => {
    const { form, el, asked } = mount([
      { key: 'a', values: { connection: 'gmail', tool: 'send_email' } },
      { key: 'b', values: { connection: 'slack', tool: null } },
      { key: 'c', values: { connection: 'gmail', tool: null } },
    ]);
    await form.settled();
    // Each line drawn once: a cell asking for its choices as it is drawn never draws its table again inside that drawing.
    expect([...el.querySelectorAll('tbody tr')].map((tr) => (tr as HTMLElement).dataset['line'])).toEqual(['a', 'b', 'c']);
    expect(asked.map((request) => request.values['connection'])).toEqual(['gmail', 'slack']);
    expect(offered(el, 0)).toEqual(['Send email', 'Read inbox']);
    expect(offered(el, 1)).toEqual(['Post message', 'Read channel']);
    expect(offered(el, 2)).toEqual(['Send email', 'Read inbox']);
    expect(select(el, 0, 'tool').selectedOptions[0].textContent).toBe('Send email');
  });

  it('asks again as a line’s connection changes, and says the tool it took out until another is chosen', async () => {
    const { form, el } = mount([
      { key: 'a', values: { connection: 'gmail', tool: 'send_email' } },
      { key: 'b', values: { connection: 'gmail', tool: 'read_inbox' } },
    ]);
    await form.settled();
    choose(select(el, 0, 'connection'), 'Slack');
    await form.settled();
    expect(values(form)[0]).toEqual({ connection: 'slack', tool: null });
    expect(offered(el, 0)).toEqual(['Post message', 'Read channel']);
    expect(said(el, 0)).toEqual(['Send email is no longer offered, so it was taken out']);
    // The other line is as it was.
    expect(values(form)[1]['tool']).toBe('read_inbox');
    expect(said(el, 1)).toEqual([]);
    choose(select(el, 0, 'tool'), 'Post message');
    expect(values(form)[0]['tool']).toBe('post_message');
    expect(said(el, 0)).toEqual([]);
  });

  it('keeps a tool its connection still offers when the connection changes', async () => {
    const { form, el } = mount([{ key: 'a', values: { connection: 'gmail', tool: 'read_inbox' } }]);
    await form.settled();
    choose(select(el, 0, 'connection'), 'Slack');
    await form.settled();
    expect(values(form)[0]['tool']).toBe('read_inbox');
    expect(select(el, 0, 'tool').selectedOptions[0].textContent).toBe('Read channel');
    expect(said(el, 0)).toEqual([]);
  });

  it('gives a cell the line’s own choices through the form it sees', async () => {
    const { form } = mount([
      { key: 'a', values: { connection: 'gmail' } },
      { key: 'b', values: { connection: 'slack' } },
    ]);
    await form.settled();
    expect(lineForm(form, 'tools', 'b').getState().choices).toEqual({ tool: { options: TOOLS['slack'] } });
  });

  it('reads a tool pasted by the connection pasted beside it, and names one that connection does not offer', async () => {
    const { form, el } = mount([
      { key: 'a', values: { connection: 'gmail', tool: null } },
      { key: 'b', values: { connection: 'gmail', tool: null } },
    ]);
    await form.settled();
    // From the note, as a spreadsheet's rows: a note, a connection, a tool.
    paste(input(el, 0, 'note'), 'Daily digest\tSlack\tPost message\nWeekly\tGmail\tPost message\nNew line\tSlack\tRead channel\n');
    await pasted();
    await form.settled();
    expect(values(form)).toEqual([
      { connection: 'slack', tool: 'post_message', note: 'Daily digest' },
      { connection: 'gmail', tool: null, note: 'Weekly' },
      expect.objectContaining({ connection: 'slack', tool: 'read_inbox', note: 'New line' }),
    ]);
    expect(el.querySelector('.fd-lines-paste-note')?.textContent).toBe(
      'Pasted into 8 cells. 1 line added. Not pasted: Tool, line 2 (Tool: nothing is called “\u2068Post message\u2069”; pick one from the list)'
    );
  });

  it('spreads a block pasted on a dropdown cell as on a text cell, its choices read by their words', async () => {
    const { form, el } = mount([
      { key: 'a', values: { connection: 'gmail', tool: null } },
      { key: 'b', values: { connection: 'slack', tool: null } },
    ]);
    await form.settled();
    // Ctrl+V on the dropdown: the table's own box out of sight takes the paste, as the browser sends it there.
    const box = select(el, 0, 'connection');
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true }));
    const catcher = el.querySelector('.fd-lines-paste-catcher') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(catcher);
    paste(catcher, 'Slack\tPost message\nGmail\tRead inbox\n');
    expect(document.activeElement).toBe(box);
    await pasted();
    await form.settled();
    expect(values(form).map((line) => [line['connection'], line['tool']])).toEqual([
      ['slack', 'post_message'],
      ['gmail', 'read_inbox'],
    ]);
    expect(el.querySelector('.fd-lines-paste-note')?.textContent).toBe('Pasted into 4 cells.');
    // One value on a dropdown: the choice so called.
    const tool = select(el, 1, 'tool');
    tool.focus();
    tool.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true, cancelable: true }));
    paste(catcher, 'Send email');
    await pasted();
    await form.settled();
    expect(values(form)[1]['tool']).toBe('send_email');
  });

  it('says a tool pasted could not be looked up when the choices could not be asked', async () => {
    const { form, el } = mount([{ key: 'a', values: { connection: 'gmail', tool: null } }], async () => {
      throw new Error('The server is away');
    });
    await form.settled();
    paste(input(el, 0, 'note'), 'Daily\tSlack\tPost message\n');
    await pasted();
    await form.settled();
    expect(values(form)[0]).toEqual({ connection: 'slack', tool: null, note: 'Daily' });
    expect(el.querySelector('.fd-lines-paste-note')?.textContent).toBe('Pasted into 2 cells. Not pasted: Tool, line 1 (Tool: “\u2068Post message\u2069” could not be looked up)');
  });

  it('says a line’s tool by its label in the plain words drawn before the lines part', async () => {
    const { form } = mount([{ key: 'a', values: { connection: 'slack', tool: 'read_inbox' } }]);
    await form.settled();
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const plain = plainLinesWidget({ form, name: 'tools', field: page.fields['tools'] as Field, node, id: 'fd-plain', document, labels: WIDGET_LABELS.en, locale: 'en' });
    plain.update({ value: form.getState().values['tools'], values: form.getState().values, readonly: true, required: false, invalid: false });
    expect(plain.element.textContent).toBe('Slack · Read channel');
    expect(plain.element.textContent).not.toContain('read_inbox');
  });
});

describe('a table line’s option shown by a condition', () => {
  /** A line's mode offered by its own connection, and by the plan of the agent it is on (`parent.`). */
  const ruled = {
    ...page,
    fields: {
      plan: { type: 'selection', label: 'Plan', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
      tools: {
        type: 'one2many',
        label: 'Tools',
        relation: 'agent.tool',
        fields: {
          connection: { type: 'selection', label: 'Connection', options: [{ value: 'gmail', label: 'Gmail' }, { value: 'slack', label: 'Slack' }] },
          mode: {
            type: 'selection',
            label: 'Mode',
            options: [
              { value: 'draft', label: 'Draft only' },
              { value: 'send', label: 'Send', invisible: "connection != 'gmail'" },
              { value: 'auto', label: 'Run by itself', invisible: "parent.plan != 'pro'" },
            ],
          },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-tools', field: 'tools', columns: ['connection', 'mode'] }] },
  } as unknown as Page;

  function mountRuled(values: Values) {
    const form = createForm({ page: ruled, values });
    const node = (ruled.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'tools', field: ruled.fields['tools'] as Field, node, id: 'fd-tools', document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['tools'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element };
  }
  const modes = (el: Element, n: number) => [...select(el, n, 'mode').options].map((option) => option.textContent).filter(Boolean);
  const saidOfMode = (el: Element, n: number) => [...row(el, n).querySelectorAll('td[data-column="mode"] [role=status]')].filter((s) => !(s as HTMLElement).hidden).map((s) => s.textContent);

  it('offers each line the options its own values and its record let be', () => {
    const { el } = mountRuled({ plan: 'pro', tools: [{ key: 'a', values: { connection: 'gmail', mode: null } }, { key: 'b', values: { connection: 'slack', mode: null } }] } as Values);
    expect(modes(el, 0)).toEqual(['Draft only', 'Send', 'Run by itself']);
    expect(modes(el, 1)).toEqual(['Draft only', 'Run by itself']);
  });

  it('takes out one its line’s change hides, said under the cell as a list’s is, until the cell is chosen again', () => {
    const { form, el } = mountRuled({ plan: 'pro', tools: [{ key: 'a', values: { connection: 'gmail', mode: 'send' } }, { key: 'b', values: { connection: 'gmail', mode: 'auto' } }] } as Values);
    choose(select(el, 0, 'connection'), 'Slack');
    expect((form.getState().values['tools'] as Line[]).map((line) => line.values['mode'])).toEqual([null, 'auto']);
    expect(modes(el, 0)).toEqual(['Draft only', 'Run by itself']);
    expect(saidOfMode(el, 0)).toEqual(['Send is no longer offered, so it was taken out']);
    expect(saidOfMode(el, 1)).toEqual([]);
    // The record's change reaches its lines.
    form.setValue('plan', 'free');
    expect(saidOfMode(el, 1)).toEqual(['Run by itself is no longer offered, so it was taken out']);
    choose(select(el, 0, 'mode'), 'Draft only');
    expect(saidOfMode(el, 0)).toEqual([]);
    expect(lineForm(form, 'tools', 'b').getState().takenOut).toEqual({ mode: 'Run by itself is no longer offered, so it was taken out' });
  });
});
