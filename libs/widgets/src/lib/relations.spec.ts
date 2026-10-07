import { createForm, createMemoryDataSource, type Field, type FieldNode, type Form, type Page } from '@fieldia/core';
import { createWidget, type WidgetDialogs } from './widgets';
import { WIDGET_LABELS } from './labels';

const page = {
  fieldia: '0.1',
  id: 'rel',
  data: { kind: 'record', model: 'partner' },
  fields: {
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    region_id: { type: 'many2one', label: 'Region', relation: 'region', filter: [{ field: 'country_id', op: '=', valueFrom: 'country_id' }] },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    origin: { type: 'reference', label: 'Origin', models: [{ value: 'lead', label: 'Lead' }, { value: 'ticket', label: 'Ticket' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'n-country', field: 'country_id' },
      { type: 'field', id: 'n-region', field: 'region_id' },
      { type: 'field', id: 'n-tags', field: 'tag_ids' },
      { type: 'field', id: 'n-tag-boxes', field: 'tag_ids', widget: 'checkboxes' },
      { type: 'field', id: 'n-origin', field: 'origin' },
    ],
  },
} as unknown as Page;

function source() {
  return createMemoryDataSource({
    records: {
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Japan' } },
      region: { 1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } }, 2: { name: 'Giza', country_id: { id: 1, label: 'Egypt' } }, 3: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } } },
      tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' }, 12: { name: 'Export' } },
      lead: { 1: { name: 'Hotel fit-out' } },
      ticket: { 7: { name: 'Broken kettle' } },
    },
  });
}

function mount(nodeId: string, form: Form = createForm({ page, dataSource: source() }), readonly = false) {
  const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === nodeId) as FieldNode;
  const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: `fd-${nodeId}`, document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () =>
    widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 260));
const options = (el: Element) => [...el.querySelectorAll('[role=option]')].map((o) => o.textContent);
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('many2one', () => {
  it('keeps the list closed when a search still on its way comes back after Escape', async () => {
    const { el } = mount('n-country');
    const input = el.querySelector('input') as HTMLInputElement;
    type(input, 'Ja');
    key(input, 'Escape'); // before the search has answered
    await settle();
    expect((el.querySelector('[role=listbox]') as HTMLElement).hidden).toBe(true);
  });

  it('shows the chosen record and finds others as you type', async () => {
    const { form, el } = mount('n-country');
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    expect(input.value).toBe('Egypt');
    type(input, 'ja');
    await settle();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options(el)).toEqual(['Japan', 'Create “ja”']);
  });

  it('chooses with the arrow keys and Enter', async () => {
    const { form, el } = mount('n-country');
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'j');
    await settle();
    expect(options(el)).toEqual(['Jordan', 'Japan', 'Create “j”']);
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(el.querySelectorAll('[role=option]')[1].id);
    key(input, 'Enter');
    expect(form.getState().values['country_id']).toEqual({ id: 3, label: 'Japan' });
    expect(input.value).toBe('Japan');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the choice the arrow keys reached when a later search answers with it still in the list', async () => {
    const { form, el } = mount('n-country');
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'j');
    await settle();
    // More typed, and the arrows move on the list still showing, before its search answers.
    type(input, 'ja');
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    await settle();
    expect(options(el)).toEqual(['Japan', 'Create “ja”']);
    expect(input.getAttribute('aria-activedescendant')).toBe(el.querySelectorAll('[role=option]')[0].id);
    key(input, 'Enter');
    expect(form.getState().values['country_id']).toEqual({ id: 3, label: 'Japan' });
    // A choice the answer no longer lists is let go.
    type(input, 'j');
    await settle();
    key(input, 'ArrowDown');
    type(input, 'jap');
    await settle();
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('chooses with the mouse, keeping focus in the box', async () => {
    const { form, el } = mount('n-country');
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'egy');
    await settle();
    const option = el.querySelector('[role=option]') as HTMLElement;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    option.click();
    expect(form.getState().values['country_id']).toEqual({ id: 1, label: 'Egypt' });
  });

  it('puts the chosen name back on Escape, and clears with an emptied box', async () => {
    // A data source that only searches: nothing found is just "No results".
    const searchOnly = source();
    const { form, el } = mount('n-country', createForm({ page, dataSource: { search: (request) => searchOnly.search(request) } }));
    form.setValue('country_id', { id: 2, label: 'Jordan' });
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'zz');
    await settle();
    expect(options(el)).toEqual([]);
    expect(el.querySelector('.fd-empty')?.textContent).toBe('No results');
    key(input, 'Escape');
    expect(input.value).toBe('Jordan');
    type(input, '');
    input.dispatchEvent(new FocusEvent('blur'));
    expect(form.getState().values['country_id']).toBeNull();
  });

  it('has a clear button, hidden when there is nothing to clear', () => {
    const { form, el } = mount('n-country');
    const clear = el.querySelector('.fd-combo-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(true);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect(clear.hidden).toBe(false);
    expect(clear.getAttribute('aria-label')).toBe('Clear Country');
    clear.click();
    expect(form.getState().values['country_id']).toBeNull();
  });

  it('only offers records its filter allows', async () => {
    const form = createForm({ page, dataSource: source() });
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const { el } = mount('n-region', form);
    type(el.querySelector('input[role=combobox]') as HTMLInputElement, '');
    await settle();
    expect(options(el)).toEqual(['Cairo', 'Giza']);
  });

  it('cannot be changed when readonly', () => {
    const form = createForm({ page, dataSource: source() });
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const { el } = mount('n-country', form, true);
    expect((el.querySelector('input[role=combobox]') as HTMLInputElement).readOnly).toBe(true);
    expect((el.querySelector('.fd-combo-clear') as HTMLButtonElement).hidden).toBe(true);
  });
});

describe('many2many', () => {
  it('shows tags that can be removed, and adds from the search', async () => {
    const { form, el } = mount('n-tags');
    form.setValue('tag_ids', [{ id: 10, label: 'VIP' }]);
    expect([...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent)).toEqual(['VIP']);
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, '');
    await settle();
    expect(options(el)).toEqual(['Wholesale', 'Export']); // VIP is already chosen
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }, { id: 11, label: 'Wholesale' }]);
    (el.querySelector('[aria-label="Remove VIP"]') as HTMLButtonElement).click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 11, label: 'Wholesale' }]);
  });

  it('removes the last tag with Backspace in an empty box', () => {
    const { form, el } = mount('n-tags');
    form.setValue('tag_ids', [{ id: 10, label: 'VIP' }, { id: 12, label: 'Export' }]);
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    input.focus();
    key(input, 'Backspace');
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }]);
  });

  it('can be a list of checkboxes instead', async () => {
    const { form, el } = mount('n-tag-boxes');
    await settle();
    const boxes = [...el.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual(['VIP', 'Wholesale', 'Export']);
    boxes[2].focus();
    boxes[2].click();
    expect(document.activeElement).toBe(boxes[2]); // the same box: the list is not rebuilt
    boxes[0].click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 12, label: 'Export' }, { id: 10, label: 'VIP' }]);
    boxes[2].click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }]);
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
  });
});

describe('free-text tags', () => {
  const tagPage = {
    fieldia: '0.1',
    id: 'tags',
    data: { kind: 'responses' },
    fields: { materials: { type: 'char', label: 'Materials' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [{ type: 'field', id: 'n-materials', field: 'materials', widget: 'tags', options: { suggestions: ['oak', 'glass', 'steel', 'walnut'] } }],
    },
  } as unknown as Page;
  function mountTags(readonly = false) {
    const form = createForm({ page: tagPage });
    const node = (tagPage.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'materials', field: tagPage.fields['materials'] as Field, node, id: 'fd-materials', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['materials'], values: form.getState().values, readonly, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement };
  }
  const chipText = (el: Element) => [...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent);
  const stored = (form: Form) => form.getState().values['materials'];

  it('adds a typed tag on Enter or at a comma, and keeps them as "a, b" text', () => {
    const { form, el, input } = mountTags();
    type(input, 'Oak');
    key(input, 'Enter');
    expect(stored(form)).toBe('Oak');
    type(input, 'glass,');
    expect(stored(form)).toBe('Oak, glass');
    expect(input.value).toBe('');
    expect(chipText(el)).toEqual(['Oak', 'glass']);
  });

  it('offers its suggestions as you type, leaving out tags already there', async () => {
    const { form, el, input } = mountTags();
    form.setValue('materials', 'oak');
    type(input, 'a');
    await settle();
    expect(options(el)).toEqual(['glass', 'walnut']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(stored(form)).toBe('oak, glass');
  });

  it('never adds the same tag twice, whatever its case', () => {
    const { form, input } = mountTags();
    form.setValue('materials', 'Oak');
    type(input, 'oak');
    key(input, 'Enter');
    expect(stored(form)).toBe('Oak');
  });

  it('takes the last tag away with Backspace in an empty box, or any tag by its button', () => {
    const { form, el, input } = mountTags();
    form.setValue('materials', 'oak, glass, steel');
    key(input, 'Backspace');
    expect(stored(form)).toBe('oak, glass');
    (el.querySelector('[aria-label="Remove oak"]') as HTMLButtonElement).click();
    expect(stored(form)).toBe('glass');
  });

  it('keeps a tag typed and left without Enter', () => {
    const { form, input } = mountTags();
    type(input, 'brass');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(stored(form)).toBe('brass');
  });

  it('shows the tags without buttons or a box when read-only', () => {
    const { form, el } = mountTags(true);
    form.setValue('materials', 'oak, glass');
    expect(chipText(el)).toEqual(['oak', 'glass']);
    expect(el.querySelector('.fd-chip-remove')).toBeNull();
    expect((el.querySelector('.fd-combo') as HTMLElement).hidden).toBe(true);
  });
});

describe('reference', () => {
  it('picks a model, then a record of that model', async () => {
    const { form, el } = mount('n-origin');
    const model = el.querySelector('select') as HTMLSelectElement;
    expect([...model.options].map((o) => o.textContent)).toEqual(['', 'Lead', 'Ticket']);
    model.value = 'ticket';
    model.dispatchEvent(new Event('change', { bubbles: true }));
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'ket');
    await settle();
    expect(options(el)).toEqual(['Broken kettle']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(form.getState().values['origin']).toEqual({ model: 'ticket', id: 7, label: 'Broken kettle' });
  });
});

describe('statusbar', () => {
  const stagePage = (widgetNode: Record<string, unknown>) =>
    ({
      fieldia: '0.1',
      id: 'stages',
      data: { kind: 'record', model: 'project' },
      fields: {
        state: {
          type: 'selection',
          label: 'Status',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
            { value: 'cancel', label: 'Cancelled' },
          ],
        },
        phase_id: { type: 'many2one', label: 'Phase', relation: 'phase' },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', ...widgetNode }] },
    }) as unknown as Page;
  function mountBar(widgetNode: Record<string, unknown>, readonly = false) {
    const page = stagePage(widgetNode);
    const dataSource = createMemoryDataSource({ records: { phase: { 1: { name: 'Survey' }, 2: { name: 'Design' }, 3: { name: 'Build' } } } });
    const form = createForm({ page, dataSource });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: 'fd-bar', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element, refresh };
  }
  const steps = (el: Element) => [...el.querySelectorAll('li')].map((li) => li.textContent);
  const current = (el: Element) => el.querySelector('[aria-current="step"]')?.textContent;

  it('shows a selection’s states with the current one marked, and only lets a click change it when asked', () => {
    const shown = mountBar({ field: 'state', widget: 'statusbar' });
    shown.form.setValue('state', 'open');
    expect(steps(shown.el)).toEqual(['Draft', 'Open', 'Done', 'Cancelled']);
    expect(current(shown.el)).toBe('Open');
    expect(shown.el.querySelector('button')).toBeNull();
    const clickable = mountBar({ field: 'state', widget: 'statusbar', options: { clickable: true } });
    (clickable.el.querySelectorAll('button')[2] as HTMLButtonElement).click();
    expect(clickable.form.getState().values['state']).toBe('done');
  });

  it('leaves out states not listed, unless the record is in one', () => {
    const { form, el } = mountBar({ field: 'state', widget: 'statusbar', options: { visibleStates: ['draft', 'open', 'done'] } });
    expect(steps(el)).toEqual(['Draft', 'Open', 'Done']);
    form.setValue('state', 'cancel');
    expect(steps(el)).toEqual(['Draft', 'Open', 'Done', 'Cancelled']);
  });

  it('shows the records a link may point to, and a click picks one', async () => {
    const { form, el } = mountBar({ field: 'phase_id', widget: 'statusbar', options: { clickable: true } });
    form.setValue('phase_id', { id: 2, label: 'Design' });
    await settle();
    expect(steps(el)).toEqual(['Survey', 'Design', 'Build']);
    expect(current(el)).toBe('Design');
    (el.querySelectorAll('button')[2] as HTMLButtonElement).click();
    expect(form.getState().values['phase_id']).toEqual({ id: 3, label: 'Build' });
  });

  it('searches its steps again when a value its filter reads changes, as when the record loads', async () => {
    const page = {
      fieldia: '0.1',
      id: 'tasks',
      data: { kind: 'record', model: 'task' },
      fields: {
        project_id: { type: 'many2one', label: 'Project', relation: 'project' },
        stage_id: { type: 'many2one', label: 'Stage', relation: 'stage', filter: [{ field: 'project_id', op: '=', valueFrom: 'project_id' }] },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'stage_id', widget: 'statusbar' }] },
    } as unknown as Page;
    const office = { id: 1, label: 'Office' };
    const dataSource = createMemoryDataSource({
      records: {
        task: { 5: { stage_id: { id: 11, label: 'Design' }, project_id: office } },
        stage: { 10: { name: 'Brief', project_id: office }, 11: { name: 'Design', project_id: office }, 20: { name: 'Survey', project_id: { id: 2, label: 'Villa' } } },
      },
    });
    const form = createForm({ page, dataSource, recordId: 5 });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'stage_id', field: page.fields['stage_id'] as Field, node, id: 'fd-bar', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['stage_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    // Drawn before the record is there: its project is not known yet.
    refresh();
    await form.load();
    await settle();
    expect(steps(widget.element)).toEqual(['Brief', 'Design']);
    form.setValue('project_id', { id: 2, label: 'Villa' });
    await settle();
    expect(steps(widget.element)).toEqual(['Survey', 'Design']);
  });

  it('keeps the focus on a step clicked, now the current one, after the bar is drawn again', () => {
    const { form, el } = mountBar({ field: 'state', widget: 'statusbar', options: { clickable: true } });
    const done = el.querySelectorAll('button')[2] as HTMLButtonElement;
    done.focus();
    done.click();
    expect(form.getState().values['state']).toBe('done');
    expect(document.activeElement?.textContent).toBe('Done');
    expect(document.activeElement?.getAttribute('aria-current')).toBe('step');
  });

  it('draws itself again only when its steps, its current one or its lock change: a form that redraws as focus leaves comes to rest', async () => {
    const { el, refresh } = mountBar({ field: 'state', widget: 'statusbar', options: { clickable: true } });
    const before = el.querySelectorAll('button')[1];
    refresh();
    expect(el.querySelectorAll('button')[1]).toBe(before);
    // As the viewer does: focus leaving a field brings it up to date a moment later — once, not for ever.
    let redraws = 0;
    el.addEventListener('focusout', () => queueMicrotask(() => redraws++ < 20 && refresh()));
    const done = el.querySelectorAll('button')[2] as HTMLButtonElement;
    done.focus();
    done.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(redraws).toBeLessThan(3);
    expect(document.activeElement?.textContent).toBe('Done');
  });

  it('cannot be clicked when read-only', () => {
    const { el } = mountBar({ field: 'state', widget: 'statusbar', options: { clickable: true } }, true);
    const buttons = [...el.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons).toHaveLength(4);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});

describe('making a record from a typed name', () => {
  function mountLink(nodeId: string, nodeExtra: Record<string, unknown> = {}) {
    const dataSource = source();
    const form = createForm({ page, dataSource });
    const base = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === nodeId) as FieldNode;
    const node = { ...base, ...nodeExtra } as FieldNode;
    const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: `fd-${nodeId}`, document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, dataSource, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement };
  }

  it('offers to create what was typed when nothing matches it, and points to the new record', async () => {
    const { form, dataSource, el, input } = mountLink('n-country');
    type(input, 'Oman');
    await settle();
    expect(options(el)).toEqual(['Create “Oman”']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    await settle();
    expect(form.getState().values['country_id']).toEqual({ id: 4, label: 'Oman' });
    expect(dataSource.records['country'][4]).toEqual({ name: 'Oman' });
  });

  it('never offers it for a name that is already there, or when the page says no', async () => {
    const exists = mountLink('n-country');
    type(exists.input, 'egypt');
    await settle();
    expect(options(exists.el)).toEqual(['Egypt']);
    const refused = mountLink('n-country', { options: { create: false } });
    type(refused.input, 'Oman');
    await settle();
    expect(options(refused.el)).not.toContain('Create “Oman”');
  });

  it('adds a new tag to a many2many the same way', async () => {
    const { form, el, input } = mountLink('n-tags');
    type(input, 'Retail');
    await settle();
    (([...el.querySelectorAll('[role=option]')].find((o) => o.textContent === 'Create “Retail”') as HTMLElement)).click();
    await settle();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 13, label: 'Retail' }]);
  });
});

describe('a link field and its dialogs', () => {
  function mountWithDialogs(dialogs: WidgetDialogs | undefined, dataSource = source()) {
    const form = createForm({ page, dataSource });
    const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === 'n-country') as FieldNode;
    const widget = createWidget({ form, name: 'country_id', field: page.fields['country_id'] as Field, node, id: 'fd-country', document, labels: WIDGET_LABELS.en, dialogs });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['country_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement };
  }
  const fakeDialogs = (answers: Partial<WidgetDialogs>): WidgetDialogs & { calls: unknown[][] } => {
    const calls: unknown[][] = [];
    return {
      calls,
      canOpen: (model) => model === 'country',
      openRecord: async (...args) => {
        calls.push(['openRecord', ...args]);
        return answers.openRecord ? answers.openRecord(...args) : null;
      },
      searchMore: async (request) => {
        calls.push(['searchMore', request.title]);
        return answers.searchMore ? answers.searchMore(request) : null;
      },
      editValues: async () => null,
    };
  };
  const optionNamed = (el: Element, name: string) => [...el.querySelectorAll('[role=option]')].find((o) => o.textContent === name) as HTMLElement;

  /** Twelve countries with an "a" in the name: more than the list shows. */
  const manyCountries = () =>
    createMemoryDataSource({
      records: {
        country: Object.fromEntries(
          ['Algeria', 'Bahrain', 'Canada', 'Denmark', 'Estonia', 'France', 'Ghana', 'Haiti', 'Iran', 'Jamaica', 'Kenya', 'Latvia'].map((name, i) => [i + 1, { name }]),
        ),
      },
    });

  it('shows eight matches and ends with Search more… when more match, which picks from a searchable list', async () => {
    const dialogs = fakeDialogs({ searchMore: async () => ({ id: 12, label: 'Latvia' }) });
    const { form, el, input } = mountWithDialogs(dialogs, manyCountries());
    type(input, 'a');
    await settle();
    expect(options(el)).toEqual(['Algeria', 'Bahrain', 'Canada', 'Denmark', 'Estonia', 'France', 'Ghana', 'Haiti', 'Create “a”', 'Create and edit…', 'Search more…']);
    optionNamed(el, 'Search more…').click();
    await settle();
    expect(dialogs.calls).toEqual([['searchMore', 'Country']]);
    expect(form.getState().values['country_id']).toEqual({ id: 12, label: 'Latvia' });
  });

  it('leaves Search more… out when the list already shows every match', async () => {
    const { el, input } = mountWithDialogs(fakeDialogs({}));
    type(input, 'j');
    await settle();
    expect(options(el)).toEqual(['Jordan', 'Japan', 'Create “j”', 'Create and edit…']);
    const eight = mountWithDialogs(fakeDialogs({}), createMemoryDataSource({ records: { country: Object.fromEntries([...Array(8)].map((_, i) => [i + 1, { name: `Island ${i + 1}` }])) } }));
    type(eight.input, 'island');
    await settle();
    expect(options(eight.el)).not.toContain('Search more…');
    expect(options(eight.el)).toHaveLength(10);
  });

  it('offers Create and edit…, opening the related page with the typed name, and links what was saved', async () => {
    const dialogs = fakeDialogs({ openRecord: async () => ({ id: 9, label: 'Oman' }) });
    const { form, el, input } = mountWithDialogs(dialogs);
    type(input, 'Oman');
    await settle();
    expect(options(el)).toEqual(['Create “Oman”', 'Create and edit…']);
    optionNamed(el, 'Create and edit…').click();
    await settle();
    expect(dialogs.calls).toEqual([['openRecord', 'country', { name: 'Oman', title: 'Country' }]]);
    expect(form.getState().values['country_id']).toEqual({ id: 9, label: 'Oman' });
  });

  it('opens the linked record from a button beside it, and follows a new name', async () => {
    const dialogs = fakeDialogs({ openRecord: async () => ({ id: 1, label: 'Egypt (EG)' }) });
    const { form, el } = mountWithDialogs(dialogs);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const open = el.querySelector('button[aria-label="Open Egypt"]') as HTMLButtonElement;
    expect(open).not.toBeNull();
    open.click();
    await settle();
    expect(dialogs.calls).toEqual([['openRecord', 'country', { recordId: 1, title: 'Egypt' }]]);
    expect(form.getState().values['country_id']).toEqual({ id: 1, label: 'Egypt (EG)' });
  });

  it('offers Create and edit… only for a typed name', async () => {
    const { el, input } = mountWithDialogs(fakeDialogs({}), manyCountries());
    input.focus();
    input.dispatchEvent(new Event('focus'));
    await settle();
    expect(options(el)).toHaveLength(9);
    expect(options(el)).not.toContain('Create and edit…');
    expect(options(el).at(-1)).toBe('Search more…');
  });

  it('opens nothing for a relation the app has no page for', async () => {
    const dialogs = { ...fakeDialogs({}), canOpen: () => false };
    const { form, el, input } = mountWithDialogs(dialogs);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect(el.querySelector('button[aria-label^="Open"]')).toBeNull();
    type(input, 'Oman');
    await settle();
    expect(options(el)).toEqual(['Create “Oman”']);
  });

  it('offers none of them where the app gave no dialogs', async () => {
    const { form, el, input } = mountWithDialogs(undefined);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect(el.querySelector('button[aria-label^="Open"]')).toBeNull();
    type(input, 'Oman');
    await settle();
    expect(options(el)).toEqual(['Create “Oman”']);
  });
});

describe('links to records and their dialogs', () => {
  const manyTags = () => createMemoryDataSource({ records: { tag: Object.fromEntries(['Art', 'Bars', 'Cafés', 'Dance', 'Eats', 'Fairs', 'Games', 'Hats', 'Jazz', 'Kayaks'].map((name, i) => [i + 1, { name }])) } });
  function mountTags(dialogs: WidgetDialogs | undefined, dataSource = manyTags()) {
    const form = createForm({ page, dataSource });
    const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === 'n-tags') as FieldNode;
    const widget = createWidget({ form, name: 'tag_ids', field: page.fields['tag_ids'] as Field, node, id: 'fd-tags', document, labels: WIDGET_LABELS.en, dialogs });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['tag_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement };
  }
  const fakeDialogs = (answers: { searchMore?: () => Promise<{ id: number; label: string } | null>; openRecord?: () => Promise<{ id: number; label: string } | null> }) => {
    const calls: unknown[][] = [];
    const dialogs: WidgetDialogs = {
      canOpen: (model) => model === 'tag',
      openRecord: async (...args) => (calls.push(['openRecord', ...args]), answers.openRecord ? answers.openRecord() : null),
      searchMore: async (request) => (calls.push(['searchMore', request.title]), answers.searchMore ? answers.searchMore() : null),
      editValues: async () => null,
    };
    return { dialogs, calls };
  };

  it('shows eight matches and Search more… when more match, which adds the one picked there', async () => {
    const { dialogs, calls } = fakeDialogs({ searchMore: async () => ({ id: 10, label: 'Kayaks' }) });
    const { form, el, input } = mountTags(dialogs);
    form.setValue('tag_ids', [{ id: 1, label: 'Art' }]);
    input.focus();
    input.dispatchEvent(new Event('focus'));
    await settle();
    // Art is chosen already: eight others, and more besides.
    expect(options(el)).toEqual(['Bars', 'Cafés', 'Dance', 'Eats', 'Fairs', 'Games', 'Hats', 'Jazz', 'Search more…']);
    ([...el.querySelectorAll('[role=option]')].find((o) => o.textContent === 'Search more…') as HTMLElement).click();
    await settle();
    expect(calls).toEqual([['searchMore', 'Tags']]);
    expect(form.getState().values['tag_ids']).toEqual([{ id: 1, label: 'Art' }, { id: 10, label: 'Kayaks' }]);
  });

  it('never adds a record twice from the searchable list', async () => {
    const { dialogs } = fakeDialogs({ searchMore: async () => ({ id: 1, label: 'Art' }) });
    const { form, el, input } = mountTags(dialogs);
    form.setValue('tag_ids', [{ id: 1, label: 'Art' }]);
    type(input, 'a');
    await settle();
    ([...el.querySelectorAll('[role=option]')].find((o) => o.textContent === 'Search more…') as HTMLElement).click();
    await settle();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 1, label: 'Art' }]);
  });

  it('opens a linked record from its tag, and follows a new name', async () => {
    const { dialogs, calls } = fakeDialogs({ openRecord: async () => ({ id: 2, label: 'Bars & pubs' }) });
    const { form, el } = mountTags(dialogs);
    form.setValue('tag_ids', [{ id: 1, label: 'Art' }, { id: 2, label: 'Bars' }]);
    const open = el.querySelector('button[aria-label="Open Bars"]') as HTMLButtonElement;
    expect(open.textContent).toBe('Bars');
    open.click();
    await settle();
    expect(calls).toEqual([['openRecord', 'tag', { recordId: 2, title: 'Bars' }]]);
    expect(form.getState().values['tag_ids']).toEqual([{ id: 1, label: 'Art' }, { id: 2, label: 'Bars & pubs' }]);
  });

  it('opens nothing, and searches no more, without dialogs or a page for the records', async () => {
    const { form, el, input } = mountTags(undefined);
    form.setValue('tag_ids', [{ id: 1, label: 'Art' }]);
    expect(el.querySelector('button[aria-label^="Open"]')).toBeNull();
    expect(el.querySelector('.fd-chip-label')?.tagName).toBe('SPAN');
    type(input, 'a');
    await settle();
    expect(options(el)).not.toContain('Search more…');
    const none = mountTags({ ...fakeDialogs({}).dialogs, canOpen: () => false });
    none.form.setValue('tag_ids', [{ id: 1, label: 'Art' }]);
    expect(none.el.querySelector('button[aria-label^="Open"]')).toBeNull();
  });
});
