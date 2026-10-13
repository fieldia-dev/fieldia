import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * `look.quietHints: false`: an empty field in the quiet look shows nothing at
 * rest, as a work item's Planning does — its label alone says what it is.
 * The page's own words for a field still show; a field out of the quiet look
 * keeps what its box says.
 */

const planning = (look: Page['look'], children?: unknown[]): Page =>
  ({
    fieldia: '0.1',
    id: 'planning',
    data: { kind: 'record', model: 'bug' },
    look,
    fields: {
      points: { type: 'float', label: 'Story points' },
      priority: { type: 'selection', label: 'Priority', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
      state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
      found: { type: 'char', label: 'Found in Build' },
      notes: { type: 'html', label: 'System Info' },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: children ?? [
        { type: 'field', id: 'f-points', field: 'points' },
        { type: 'field', id: 'f-priority', field: 'priority' },
        { type: 'field', id: 'f-state', field: 'state', widget: 'dot' },
        { type: 'field', id: 'f-found', field: 'found' },
        { type: 'field', id: 'f-notes', field: 'notes' },
      ],
    },
  }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page });
  return (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
}

describe('empty quiet fields with quietHints false', () => {
  it('show nothing at rest: no "Add …" in a box, a choice, a state or formatted text', () => {
    const field = mount(planning({ skin: 'quiet', quietHints: false }));
    expect(field('f-points').hasAttribute('data-quiet')).toBe(true);
    expect((field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('');
    expect((field('f-found').querySelector('input') as HTMLInputElement).placeholder).toBe('');
    expect((field('f-priority').querySelector('select') as HTMLSelectElement).selectedOptions[0].textContent).toBe('');
    expect(field('f-state').querySelector('.fd-dot-label')?.getAttribute('data-hint') ?? '').toBe('');
    expect(field('f-notes').querySelector('.fd-richtext')?.hasAttribute('data-placeholder')).toBe(false);
    // The label says what it is.
    expect(field('f-points').querySelector('label')?.textContent).toBe('Story points');
  });

  it('still show the page’s own words, where it gives some', () => {
    const field = mount(planning({ skin: 'quiet', quietHints: false }, [{ type: 'field', id: 'f-found', field: 'found', placeholder: 'Which build?' }]));
    expect((field('f-found').querySelector('input') as HTMLInputElement).placeholder).toBe('Which build?');
  });

  it('say what to add, as before, unless the page turns it off', () => {
    const field = mount(planning({ skin: 'quiet' }));
    expect((field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('Add story points');
    handle?.destroy();
    const on = mount(planning({ skin: 'quiet', quietHints: true }));
    expect((on('f-found').querySelector('input') as HTMLInputElement).placeholder).toBe('Add found in Build');
  });
});
