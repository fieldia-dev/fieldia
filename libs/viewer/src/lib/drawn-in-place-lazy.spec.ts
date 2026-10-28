import type { Page } from '@fieldia/core';

/**
 * A part a page can be drawn without, plainly, that draws itself in place as it comes (`DRAWN_IN_PLACE`: the classic
 * formatted text's toolbar) is waited for only beside the page's other parts: a page that waits for others anyway is
 * drawn whole at once, as ever; one that would wait for it alone is drawn at once without it — no page drawn later for
 * it (0.37) — and its box takes the toolbar in place as it comes. Its tags (`partFiles`) say the same. This file starts
 * with no part loaded; every case with fresh modules.
 */

beforeEach(() => {
  jest.resetModules();
  document.body.replaceChildren();
});

const note = (more: Page['fields'] = {}, nodes: object[] = []): Page =>
  ({
    fieldia: '0.14',
    id: 'note',
    title: 'Note',
    data: { kind: 'responses' },
    fields: { title: { type: 'char', label: 'Title' }, body: { type: 'html', label: 'Body' }, ...more },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-title', field: 'title' }, { type: 'field', id: 'f-body', field: 'body' }, ...nodes] },
  }) as Page;

async function mount(page: Page) {
  const { mountViewer } = await import('./viewer');
  const host = document.createElement('div');
  document.body.append(host);
  return { host, handle: mountViewer(host, { page }) };
}

describe('a part drawn in place as it comes', () => {
  it('alone, never waited for: the page drawn at once, its box typed in, the toolbar in its place as it comes', async () => {
    const { host, handle } = await mount(note());
    // Drawn at once: its formatted text's box alone, typed in.
    const area = host.querySelector('[data-node="f-body"] .fd-richtext[contenteditable="true"]') as HTMLElement;
    expect(area).not.toBeNull();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.fd-richtext-bar')).toBeNull();
    area.innerHTML = '<p>Hello</p>';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    const { htmlPart } = await import('@fieldia/widgets');
    await htmlPart.load();
    await handle.drawn;
    for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('[data-node="f-body"] .fd-richtext-bar')).not.toBeNull();
    expect(host.querySelector('[data-node="f-body"] .fd-richtext')?.innerHTML).toBe('<p>Hello</p>');
    expect(handle.form.getState().values['body']).toBe('<p>Hello</p>');
  });

  it('beside other parts, waited for with them: the page drawn whole at once, the toolbar with it', async () => {
    const { host, handle } = await mount(note({ when: { type: 'date', label: 'When' } }, [{ type: 'field', id: 'f-when', field: 'when' }]));
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node="f-body"]')).toBeNull();
    await handle.drawn;
    expect(host.querySelector('[data-node="f-body"] .fd-richtext-bar')).not.toBeNull();
  });

  it("its tags: none for a page that waits for it alone, its own beside the page's others", async () => {
    const { partFiles } = await import('./viewer-parts');
    expect(partFiles(note())).toEqual([]);
    expect(partFiles(note({ when: { type: 'date', label: 'When' } }, [{ type: 'field', id: 'f-when', field: 'when' }])).sort()).toEqual(['fieldia.date.js', 'fieldia.html.js']);
  });
});
