import { createMemoryDataSource, type ActionRequest, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { mountViewer, type ViewerHandle } from './viewer';

/** A page's own buttons at its foot, as a Flectra wizard's: Mark as Lost and Cancel, in place of Save and Discard. */
const lost = (): Page =>
  ({
    fieldia: '0.1',
    id: 'lead-lost',
    title: 'Mark as lost',
    data: { kind: 'record', model: 'crm.lead.lost' },
    fields: { reason: { type: 'char', label: 'Lost reason', required: true }, note: { type: 'text', label: 'Closing note' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [{ type: 'field', id: 'f-reason', field: 'reason' }, { type: 'field', id: 'f-note', field: 'note' }],
      footer: [
        { type: 'button', id: 'confirm', label: 'Mark as Lost', style: 'primary', steps: [{ do: 'check' }, { do: 'call', action: 'action_lost_reason_apply' }, { do: 'save' }] },
        { type: 'button', id: 'cancel', label: 'Cancel', steps: [{ do: 'close' }] },
        { type: 'button', id: 'manage', label: 'Reasons', action: 'open_reasons', invisible: 'not reason' },
      ],
    },
  }) as unknown as Page;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const words = (scope: Element) => [...scope.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.hidden && !b.closest('[hidden]')).map((b) => b.textContent?.trim());
const press = (scope: Element, name: string) => ([...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement).click();
const type = (scope: Element, node: string, text: string) => {
  const input = scope.querySelector(`[data-node="${node}"] input`) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

describe('a page’s own footer buttons', () => {
  it('stand in a dialog’s foot in place of Discard and Save & Close, each shown by its condition', async () => {
    const result = openFormDialog({ page: lost(), title: 'Mark as lost', dataSource: createMemoryDataSource() });
    await settle();
    const foot = document.querySelector('.fd-form-dialog-foot') as HTMLElement;
    expect(words(foot)).toEqual(['Mark as Lost', 'Cancel']);
    type(document.body, 'f-reason', 'Too expensive');
    await settle();
    expect(words(foot)).toEqual(['Mark as Lost', 'Cancel', 'Reasons']);
    press(foot, 'Cancel');
    expect(await result).toMatchObject({ saved: false });
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
  });

  it('close the dialog with its answers once their steps saved, and keep it open when a check stops them', async () => {
    const asked: ActionRequest[] = [];
    const result = openFormDialog({ page: lost(), title: 'Mark as lost', dataSource: createMemoryDataSource(), onAction: (request) => void asked.push(request) });
    await settle();
    const foot = document.querySelector('.fd-form-dialog-foot') as HTMLElement;
    press(foot, 'Mark as Lost');
    await settle();
    expect(document.querySelector('.fd-form-dialog')).not.toBeNull();
    expect(asked).toEqual([]);
    type(document.body, 'f-reason', 'Too expensive');
    // Ctrl+Enter presses the primary one, as it presses Save & Close elsewhere.
    (document.querySelector('.fd-form-dialog') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    expect(await result).toMatchObject({ saved: true, values: expect.objectContaining({ reason: 'Too expensive' }) });
    expect(asked.map((request) => request.action)).toEqual(['action_lost_reason_apply']);
  });

  it('stand at the foot of a page shown on its own, in place of its Save and Discard', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: lost(), dataSource: createMemoryDataSource() });
    type(host, 'f-reason', 'Too expensive');
    await settle();
    expect(words(host.querySelector('.fd-page-footer') as HTMLElement)).toEqual(['Mark as Lost', 'Cancel', 'Reasons']);
    expect(words(host)).not.toContain('Save');
  });
});
