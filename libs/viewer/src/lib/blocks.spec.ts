import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** Blocks between fields: a line across, empty room, a picture — each shown or hidden by its rule like any part. */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page: Page = {
  fieldia: '0.1',
  id: 'blocks',
  data: { kind: 'responses' },
  fields: { kind: { type: 'char', label: 'Kind' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section', id: 's', title: 'Details', columns: 2,
        children: [
          { type: 'field', id: 'k', field: 'kind' },
          { type: 'spacer', id: 'gap', colspan: 1 },
          { type: 'divider', id: 'line' },
          { type: 'image', id: 'logo', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Acme logo', colspan: 2, invisible: "kind == 'plain'" },
        ],
      },
    ],
  },
};

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page });
  return host;
}
const at = (host: Element, id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;

describe('blocks between fields', () => {
  it('draws a line across, empty room that keeps a cell, and a described picture', () => {
    const host = mount();
    expect(at(host, 'line').tagName).toBe('HR');
    expect(at(host, 'gap').getAttribute('aria-hidden')).toBe('true');
    const logo = at(host, 'logo') as HTMLImageElement;
    expect(logo.tagName).toBe('IMG');
    expect(logo.alt).toBe('Acme logo');
    expect(logo.style.getPropertyValue('--fd-span')).toBe('2');
    expect(at(host, 'gap').style.getPropertyValue('--fd-span')).toBe('1');
  });

  it('hides a block while its rule holds', () => {
    const host = mount();
    expect(at(host, 'logo').hidden).toBe(false);
    handle!.form.setValue('kind', 'plain');
    expect(at(host, 'logo').hidden).toBe(true);
  });
});
