import { createForm, type Field, type FieldNode, type Line, type Page, type RelatedRecord, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { openLineDialog } from './lines';
import type { WidgetDialogs } from './widgets';
import { createWidget } from './widgets';

/**
 * What is typed in a line is part of it. A line's × with `confirmDelete` asks over a line holding only text that does
 * not read, or a name still being looked up, as over one holding a value. A line's dialog opened while a name typed in
 * it is looked up waits for it, and shows the line as it reads: its Save & Close never writes back what the typing
 * replaced.
 */

const page = {
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'responses' },
  fields: {
    steps: { type: 'one2many', label: 'Milestones', relation: 'step', fields: { hours: { type: 'float', label: 'Hours' }, owner_id: { type: 'many2one', label: 'Owner', relation: 'person' } } },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'steps', options: { confirmDelete: true } }] },
} as unknown as Page;

function mount() {
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'steps', field: page.fields['steps'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['steps'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const lines = () => (form.getState().values['steps'] as Line[] | null) ?? [];
  return { form, el: widget.element, lines, node };
}

describe('a line holding only text typed', () => {
  it('asks before its × takes it away, as a line holding a value does', () => {
    const { form, el, lines } = mount();
    const key = form.addLine('steps');
    form.setUnread(`steps.${key}.hours`, { text: '1x5', message: 'Hours: “1x5” is not a number' });
    (el.querySelector(`tr[data-line="${key}"] .fd-line-delete`) as HTMLButtonElement).click();
    expect(lines()).toHaveLength(1);
    expect((el.querySelector('.fd-file-confirm') as HTMLElement).hidden).toBe(false);
  });

  it('asks over a name still being looked up in it', () => {
    const { form, el, lines } = mount();
    const key = form.addLine('steps');
    // A cell's reader, its name still on its way: kept unread at once, "still looking for".
    form.settling(() => {
      form.setUnread(`steps.${key}.owner_id`, { text: 'Narnia', message: 'Owner: still looking for “Narnia”' });
      return new Promise(() => undefined);
    });
    (el.querySelector(`tr[data-line="${key}"] .fd-line-delete`) as HTMLButtonElement).click();
    expect(lines()).toHaveLength(1);
    expect((el.querySelector('.fd-file-confirm') as HTMLElement).hidden).toBe(false);
  });
});

describe('a line’s dialog opened while a name typed in it is looked up', () => {
  it('waits for it, and shows the line as it reads', async () => {
    const { form, lines, node } = mount();
    const key = form.addLine('steps', { owner_id: { id: 1, label: 'Mona' } });
    let found: (() => void) | null = null;
    form.settling(() => {
      if (!form.getState().unread[`steps.${key}.owner_id`] && found === null) {
        form.setUnread(`steps.${key}.owner_id`, { text: 'Omar', message: 'Owner: still looking for “Omar”' });
        return new Promise<void>((done) => {
          found = () => {
            form.setUnread(`steps.${key}.owner_id`, null);
            form.updateLine('steps', key, 'owner_id', { id: 2, label: 'Omar' });
            done();
          };
        });
      }
      return undefined;
    });
    const shown: Values[] = [];
    const dialogs = {
      canOpen: () => false,
      openRecord: async () => null,
      searchMore: async () => null,
      editValues: async (request: { values: Values }) => (shown.push(request.values), request.values),
    } as unknown as WidgetDialogs;
    const opening = openLineDialog(form, 'steps', node, lines()[0], dialogs, false);
    await Promise.resolve();
    expect(shown).toEqual([]);
    (found as unknown as () => void)();
    await opening;
    expect((shown[0]['owner_id'] as RelatedRecord).label).toBe('Omar');
    expect((lines()[0].values['owner_id'] as RelatedRecord).label).toBe('Omar');
  });
});
