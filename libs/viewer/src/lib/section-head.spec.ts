import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A work item's groups as the viewer draws them (examples/pages/wi-text.page.json):
 * columns of their own widths and gap, headings with tools at their end —
 * ⤢, ^ and ⌄, and the Edit and Done of a Markdown text the group holds alone —
 * help in a light box with links in its words.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (): Page => JSON.parse(readFileSync(join(EXAMPLES, 'wi-text.page.json'), 'utf8'));
const records = {
  'wi.text': { 1: { name: 'Bug 4127', repro_steps: '<p><a href="https://shop.example/o/1">https://shop.example/o/1</a></p>', priority: '1', severity: '3', related: [], dev_links: [] } },
};

let viewer: ViewerHandle | null = null;
let host: HTMLElement;
const node = (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
const tools = (id: string) => [...node(id).querySelectorAll(':scope > legend .fd-section-tools > button:not([hidden])')].map((b) => b.getAttribute('aria-label'));
const settle = () => new Promise((resolve) => setTimeout(resolve));

async function show(options: { locale?: 'ar' | 'en'; dir?: 'rtl' } = {}) {
  host = document.createElement('div');
  document.body.replaceChildren(host);
  viewer = mountViewer(host, { page: page(), dataSource: createMemoryDataSource({ records }), recordId: 1, ...options });
  for (let i = 0; i < 50 && viewer.form.getState().status !== 'ready'; i++) await settle();
}

afterEach(() => {
  viewer?.destroy();
  viewer = null;
});

describe('a group’s own columns', () => {
  it('lays its columns at the widths and gap it gives', async () => {
    await show();
    const grid = node('cols').querySelector(':scope > .fd-grid') as HTMLElement;
    expect(grid.hasAttribute('data-tracks')).toBe(true);
    expect(grid.style.getPropertyValue('--fd-track-list')).toBe('50% minmax(0, 1fr) minmax(0, 1fr)');
    expect(grid.style.columnGap).toBe('16px');
    // A group without widths keeps the even columns of its skin.
    expect(node('g-planning').querySelector(':scope > .fd-grid')?.hasAttribute('data-tracks')).toBe(false);
  });
});

describe('a group’s heading with tools at its end', () => {
  it('names its words, then ⤢, then ^, then the tools of the field it holds alone', async () => {
    await show();
    const repro = node('g-repro');
    expect(repro.hasAttribute('data-head')).toBe(true);
    expect(repro.querySelector(':scope > legend .fd-section-name')?.textContent).toBe('Repro Steps');
    expect(tools('g-repro')).toEqual(['Maximise Repro Steps', 'Collapse Repro Steps', 'Edit Repro Steps']);
    for (const tool of repro.querySelectorAll(':scope > legend .fd-section-tools > button')) expect(tool.getAttribute('title')).toBe(tool.getAttribute('aria-label'));
    // The field's own Edit and Done went to the heading: the field holds none of its own.
    expect(node('f-repro').querySelector('[data-tool="edit"]')).toBeNull();
    // Rich text has no tools of its own: System Info's heading has ⤢ and ^.
    expect(tools('g-system')).toEqual(['Maximise System Info', 'Collapse System Info']);
    // A group of several fields, with no ⤢: ^ alone.
    expect(tools('g-planning')).toEqual(['Collapse Planning']);
  });

  it('folds and unfolds from ^ and ⌄, saying which', async () => {
    await show();
    const effort = node('g-effort');
    const fold = effort.querySelector('[data-tool="fold"]') as HTMLButtonElement;
    const content = effort.querySelector(':scope > .fd-grid') as HTMLElement;
    expect([fold.getAttribute('aria-label'), fold.getAttribute('aria-expanded'), content.hidden]).toEqual(['Collapse Effort (Hours)', 'true', false]);
    expect(fold.getAttribute('aria-controls')).toBe(content.id);
    expect(fold.querySelector('svg')?.getAttribute('data-icon')).toBe('chevron-up');
    fold.click();
    expect([fold.getAttribute('aria-label'), fold.getAttribute('aria-expanded'), content.hidden]).toEqual(['Expand Effort (Hours)', 'false', true]);
    expect(fold.querySelector('svg')?.getAttribute('data-icon')).toBe('chevron-down');
    expect(effort.classList.contains('fd-section-folded')).toBe(true);
    fold.click();
    expect(content.hidden).toBe(false);
  });

  it('shows the group alone over the body with ⤢, and puts it back with ⤢ or Escape', async () => {
    await show();
    const discussion = node('g-discussion');
    const big = discussion.querySelector('[data-tool="maximise"]') as HTMLButtonElement;
    big.click();
    expect(discussion.hasAttribute('data-maximised')).toBe(true);
    expect(big.getAttribute('aria-pressed')).toBe('true');
    expect(big.querySelector('svg')?.getAttribute('data-icon')).toBe('restore');
    expect(node('g-repro').hasAttribute('data-unshown')).toBe(true);
    expect(node('col-2').hasAttribute('data-unshown')).toBe(true);
    expect(node('cols').querySelector(':scope > .fd-grid')?.hasAttribute('data-maximising')).toBe(true);
    big.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(discussion.hasAttribute('data-maximised')).toBe(false);
    expect(host.querySelectorAll('[data-unshown], [data-maximising]')).toHaveLength(0);
    expect(big.getAttribute('aria-pressed')).toBe('false');
    big.click();
    big.click();
    expect(discussion.hasAttribute('data-maximised')).toBe(false);
  });

  it('says its tools in the page’s language', async () => {
    await show({ locale: 'ar', dir: 'rtl' });
    expect(tools('g-repro')).toEqual(['تكبير خطوات إعادة الإنتاج', 'طي خطوات إعادة الإنتاج', 'تعديل خطوات إعادة الإنتاج']);
    expect(tools('g-effort')).toEqual(['طي الجهد (ساعات)']);
  });
});

describe('help in a light box', () => {
  it('draws its words with their links, opening in a tab of their own', async () => {
    await show();
    const help = node('x-deployment');
    expect(help.classList.contains('fd-help-box')).toBe(true);
    const links = [...help.querySelectorAll('a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href'), a.target])).toEqual([
      ['Releases', 'https://example.com/releases', '_blank'],
      ['Learn more about deployment status reporting', 'https://example.com/help/deployment-status', '_blank'],
    ]);
    expect(help.textContent).toContain('turn on deployment status reporting for Boards');
    expect(help.textContent).not.toContain('](');
  });

  it('turns [words](address) into links in any words, but never another kind of address', () => {
    host = document.createElement('div');
    document.body.replaceChildren(host);
    viewer = mountViewer(host, {
      page: {
        fieldia: '0.1',
        id: 't',
        data: { kind: 'responses' },
        fields: {},
        layout: { type: 'sections', id: 'root', children: [{ type: 'text', id: 'x', text: 'See [the guide](https://example.com/guide), [mail](mailto:help@example.com) and [no](javascript:alert(1)).' }] },
      } as Page,
    });
    const words = node('x');
    expect([...words.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://example.com/guide', 'mailto:help@example.com']);
    expect(words.textContent).toBe('See the guide, mail and [no](javascript:alert(1)).');
  });
});
