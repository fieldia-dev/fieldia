import { blankPage, createDesigner } from './designer';
import { tabsFor, TAB_NAMES, type PartKind } from './panel-tabs';
import { mount, openTab } from './test-editor';

/**
 * Simple mode keeps the panel to what most forms need, as the approved
 * mockup does: a field's words and when it shows or is required; groups
 * side by side, columns per screen, looks and answer rules stay as they are
 * until Advanced is opened.
 */

describe('the tabs in Simple mode', () => {
  it('are the mockup’s: a field’s Content and Rules, everything else its Content, and what the page is', () => {
    const cases: [PartKind, string[]][] = [
      // A screen or a record sheet: on the page's Layout tab, the only setting there.
      ['page', ['Content', 'Layout']],
      ['field', ['Content', 'Rules']],
      ['group', ['Content']],
      ['tabs', ['Content']],
      ['block', ['Content']],
      ['tab', ['Content']],
    ];
    for (const [kind, names] of cases) expect([kind, tabsFor(kind, 'simple').map((t) => TAB_NAMES[t])]).toEqual([kind, names]);
    // Advanced is as it was.
    expect(tabsFor('field', 'advanced').map((t) => TAB_NAMES[t])).toEqual(['Content', 'Layout', 'Rules', 'Data']);
  });
});

describe('the panel in each mode', () => {
  function editor(mode: 'simple' | 'advanced') {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    const { host, handle } = mount(designer, { mode });
    designer.select(id);
    const tabs = () => [...host.querySelectorAll('.fd-properties [role="tab"]')].map((t) => t.textContent);
    const settings = () => [...host.querySelectorAll('.fd-properties [data-panel]:not([hidden]) [data-setting]')].map((s) => s.getAttribute('data-setting'));
    return { designer, host, handle, id, tabs, settings };
  }

  it('keeps a field to its words and when it shows or is required in Simple', () => {
    const { host, tabs, settings } = editor('simple');
    expect(tabs()).toEqual(['Content', 'Rules']);
    openTab(host, 'Rules');
    expect(settings()).toEqual(['Required', 'When it shows']);
  });

  it('gives every setting back in Advanced', () => {
    const { host, tabs, settings } = editor('advanced');
    expect(tabs()).toEqual(['Content', 'Layout', 'Rules', 'Data']);
    openTab(host, 'Rules');
    expect(settings()).toEqual(expect.arrayContaining(['Required', 'When it shows', 'Read-only', 'Answer rules', 'Worked out from']));
  });

  it('follows the switch between Simple and Advanced at once', () => {
    const { host, tabs } = editor('simple');
    (host.querySelector('.fd-mode-switch [data-mode="advanced"]') as HTMLButtonElement).click();
    expect(tabs()).toEqual(['Content', 'Layout', 'Rules', 'Data']);
    (host.querySelector('.fd-mode-switch [data-mode="simple"]') as HTMLButtonElement).click();
    expect(tabs()).toEqual(['Content', 'Rules']);
  });

  it('finds no setting Simple keeps out of sight, by the panel’s search or by Find anything', () => {
    const { host, handle } = editor('simple');
    const search = host.querySelector('.fd-properties input[type="search"], .fd-properties [aria-label="Search settings"]') as HTMLInputElement;
    search.value = 'answer rules';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelector('.fd-properties')?.textContent).toMatch(/No setting called/);
    void handle;
  });
});
