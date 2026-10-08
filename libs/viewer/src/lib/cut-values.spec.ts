import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** A value too long for its box ends in an ellipsis, and the pointer over it shows all of it. */

const page: Page = {
  fieldia: '0.1',
  id: 'employee',
  data: { kind: 'record', model: 'hr.employee' },
  fields: { email: { type: 'char', label: 'Work Email' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-email', field: 'email' }] },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, values: { email: 'salma.adel@glowclinic.example' } });
  return host.querySelector('input') as HTMLInputElement;
}

/** Gives a box the widths a browser would measure: its words, and its own room. */
function measured(input: HTMLInputElement, words: number, room: number) {
  Object.defineProperty(input, 'scrollWidth', { configurable: true, value: words });
  Object.defineProperty(input, 'clientWidth', { configurable: true, value: room });
}

describe('a value cut by its box', () => {
  it('shows its whole text as the pointer comes over it, and none once it fits', () => {
    const input = mount();
    measured(input, 211, 177);
    input.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(input.title).toBe('salma.adel@glowclinic.example');
    measured(input, 177, 177);
    input.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(input.hasAttribute('title')).toBe(false);
  });

  it('leaves a box’s own title alone', () => {
    const input = mount();
    input.title = 'Where we write to her';
    measured(input, 211, 177);
    input.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(input.title).toBe('Where we write to her');
  });
});
