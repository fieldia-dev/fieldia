import type { Page } from '@fieldia/core';
import { FIELDIA_CSS } from '@fieldia/widgets';
import { mountViewer, type ViewerHandle } from './viewer';

/** A part hidden at some widths of the form: marked with them, and the stylesheet hides it there. */
let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page = {
  fieldia: '0.1',
  id: 'survey',
  data: { kind: 'record', model: 'survey.survey' },
  fields: { title: { type: 'char', label: 'Title' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    buttons: [{ type: 'button', id: 'b-live', label: 'Start a live session', action: 'action_start_session', hideOn: ['narrow'] }],
    children: [
      { type: 'field', id: 'f-title', field: 'title', hideOn: ['narrow', 'medium'] },
      { type: 'section', id: 's', title: 'More', children: [{ type: 'text', id: 't', text: 'Plain' }] },
    ],
  },
} as unknown as Page;

describe('hideOn', () => {
  it('marks a part, a header’s button too, with the widths it is hidden at', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page });
    expect((host.querySelector('[data-node="b-live"]') as HTMLElement).dataset['hideOn']).toBe('narrow');
    expect((host.querySelector('[data-node="f-title"]') as HTMLElement).dataset['hideOn']).toBe('narrow medium');
    expect((host.querySelector('[data-node="s"]') as HTMLElement).dataset['hideOn']).toBeUndefined();
  });

  it('is hidden by the form’s own width, at each of its widths', () => {
    expect(FIELDIA_CSS).toContain('@container fd-form (max-width: 520px) { .fd-form [data-hide-on~="narrow"] { display: none !important; } }');
    expect(FIELDIA_CSS).toContain('[data-hide-on~="medium"]');
    expect(FIELDIA_CSS).toContain('[data-hide-on~="wide"]');
  });
});
