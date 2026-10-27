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
    const logo = at(host, 'logo');
    expect(logo.tagName).toBe('FIGURE');
    expect((logo.querySelector('img') as HTMLImageElement).alt).toBe('Acme logo');
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

describe('a picture’s width, place, link and caption', () => {
  const shown = (image: Record<string, unknown>) => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, {
      page: { ...page, layout: { type: 'sections', id: 'root', children: [{ type: 'image', id: 'map', src: 'https://example.com/map.png', alt: 'A map of the venue', ...image }] } } as Page,
    });
    return at(host, 'map');
  };

  it('is as wide as asked, by name or in pixels, and sits where asked', () => {
    expect(shown({ width: 'small' }).style.getPropertyValue('--fd-image-width')).toBe('160px');
    expect(shown({ width: 'full' }).style.getPropertyValue('--fd-image-width')).toBe('100%');
    const placed = shown({ width: 240, align: 'center' });
    expect(placed.style.getPropertyValue('--fd-image-width')).toBe('240px');
    expect(placed.dataset['align']).toBe('center');
    expect(shown({}).style.getPropertyValue('--fd-image-width')).toBe('');
  });

  it('opens its link in a new tab, named by what it shows, and has its caption under it', () => {
    const figure = shown({ href: 'https://example.com/venue', caption: 'The hall is on the first floor' });
    const link = figure.querySelector('a') as HTMLAnchorElement;
    expect([link.getAttribute('href'), link.target, link.rel]).toEqual(['https://example.com/venue', '_blank', 'noopener noreferrer']);
    expect(link.querySelector('img')?.alt).toBe('A map of the venue');
    expect(figure.querySelector('figcaption')?.textContent).toBe('The hall is on the first floor');
  });

  it('a page whose picture links to an address that is not a web or mail one is refused before it is drawn (0.37)', () => {
    const host = document.createElement('div');
    document.body.append(host);
    expect(() => mountViewer(host, { page: { ...page, layout: { type: 'sections', id: 'root', children: [{ type: 'image', id: 'map', src: 'https://example.com/map.png', alt: 'A map', href: 'javascript:alert(1)' }] } } as Page })).toThrow(/layout\.children\[0\]\.href/);
    expect(host.querySelector('.fd-unshown')).not.toBeNull();
    expect(host.querySelector('a, img')).toBeNull();
    expect(shown({}).querySelector('figcaption')).toBeNull();
  });

  it('opens no address that is not a web or mail one, whatever the page says, where its whole check could not come: drawn without it', async () => {
    // The one-tag script with its whole check never come (offline): the address checked as it is used (safeUrl).
    let fresh!: typeof import('./viewer');
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../core/src/lib/format/check-now', () => ({ WHOLE_CHECK_APART: true, wholeCheckNow: () => null }));
      fresh = await import('./viewer');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const told: unknown[] = [];
    const opened = fresh.mountViewer(host, { page: { ...page, layout: { type: 'sections', id: 'root', children: [{ type: 'image', id: 'map', src: 'https://example.com/map.png', alt: 'A map', href: 'javascript:alert(1)' }] } } as Page, onError: (_, where) => told.push(where) });
    await opened.drawn;
    expect(host.querySelector('[data-node="map"] img')).not.toBeNull();
    expect(host.querySelector('[data-node="map"] a')).toBeNull();
    expect(told).toEqual([{ stage: 'check', part: 'page', warning: true }]);
    opened.destroy();
    warn.mockRestore();
  });
});
