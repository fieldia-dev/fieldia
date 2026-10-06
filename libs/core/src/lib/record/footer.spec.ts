import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { recordingHost } from './test-steps';

/** A page's own buttons at its foot, as a wizard's: Flectra's Confirm Loss and Cancel, in place of Save & Close and Discard. */
const lost = {
  fieldia: '0.1',
  id: 'lead-lost',
  title: 'Mark as lost',
  data: { kind: 'record', model: 'crm.lead.lost' },
  fields: { lost_reason_id: { type: 'many2one', label: 'Lost reason', relation: 'crm.lost.reason' }, note: { type: 'text', label: 'Closing note' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'field', id: 'f-reason', field: 'lost_reason_id' }, { type: 'field', id: 'f-note', field: 'note' }],
    footer: [
      { type: 'button', id: 'confirm', label: 'Mark as Lost', style: 'primary', steps: [{ do: 'check' }, { do: 'call', action: 'action_lost_reason_apply' }, { do: 'save' }] },
      { type: 'button', id: 'cancel', label: 'Cancel', steps: [{ do: 'close' }] },
      { type: 'button', id: 'manage', label: 'Reasons', action: 'open_reasons', roles: ['sales_team.group_sale_manager'] },
    ],
  },
} as unknown as Page;

describe('a page’s own buttons at its foot', () => {
  it('are buttons like any: checked as the page is read, run by their id, shown by their roles', async () => {
    expect(validatePage(lost)).toMatchObject({ ok: true });
    const host = recordingHost();
    const form = createForm({ page: lost, host });
    expect(await form.runAction('cancel')).toEqual({ done: true });
    expect(host.calls).toEqual([['close']]);
    expect(form.node('manage').invisible).toBe(true);
    expect(createForm({ page: lost, user: { id: 1, roles: ['sales_team.group_sale_manager'] } }).node('manage').invisible).toBe(false);
  });

  it('are refused when they read a field the page lacks, or take an id already used', () => {
    const footer = (lost.layout as { footer: unknown[] }).footer;
    const bad = (extra: unknown) => validatePage({ ...lost, layout: { ...(lost.layout as object), footer: [...footer, extra] } } as Page);
    expect(bad({ type: 'button', id: 'confirm', label: 'Again', steps: [{ do: 'close' }] }).ok).toBe(false);
    expect(bad({ type: 'button', id: 'x', label: 'X', steps: [{ do: 'set', field: 'nope', value: '1' }] }).ok).toBe(false);
  });
});
