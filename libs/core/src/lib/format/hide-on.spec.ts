import type { Page } from './page';
import { validatePage } from './validate';

/** A part hidden at some widths of the form — on a phone, as Flectra's `d-none d-sm-block`. */
const page = (hideOn: unknown) =>
  ({
    fieldia: '0.1',
    id: 'survey',
    data: { kind: 'record', model: 'survey.survey' },
    fields: { title: { type: 'char', label: 'Title' } },
    layout: {
      type: 'sheet',
      id: 'sheet',
      buttons: [{ type: 'button', id: 'b-live', label: 'Start a live session', action: 'action_start_session', hideOn }],
      children: [
        { type: 'field', id: 'f-title', field: 'title', hideOn },
        { type: 'section', id: 's', title: 'More', hideOn, children: [{ type: 'text', id: 't', text: 'Only on a wide screen', hideOn }] },
      ],
    },
  }) as unknown as Page;

describe('hideOn', () => {
  it('takes the widths a part is hidden at', () => {
    expect(validatePage(page(['narrow']))).toMatchObject({ ok: true });
    expect(validatePage(page(['narrow', 'medium']))).toMatchObject({ ok: true });
  });

  it('refuses a width it does not know, and none at all', () => {
    expect(validatePage(page(['phone'])).ok).toBe(false);
    expect(validatePage(page([])).ok).toBe(false);
  });
});
