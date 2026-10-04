import { screenCanvas, type ScreenCanvas } from './screen-canvas';
import { employeeDesigner } from './test-layout';

/**
 * The canvas draws what the format has, as the viewer draws it: groups inside
 * groups, arrangements on their grid's columns, each group's style, where
 * labels sit, tabs anywhere, the blocks between fields, and the page's look.
 */

let canvas: ScreenCanvas;
function setup() {
  const designer = employeeDesigner();
  const host = document.createElement('div');
  host.className = 'fd-form';
  document.body.append(host);
  canvas = screenCanvas({ designer, doc: document, skin: 'outlined', more: () => undefined, dropTool: () => undefined });
  host.append(canvas.element);
  designer.subscribe((state) => canvas.update(state));
  canvas.update(designer.getState());
  const part = (id: string) => canvas.element.querySelector(`[data-node="${id}"]`) as HTMLElement;
  return { designer, part };
}

afterEach(() => {
  canvas?.destroy();
  document.body.replaceChildren();
});

describe('the canvas draws the layout as the viewer does', () => {
  it('a group is a fieldset; an arrangement on its grid’s columns has none of its own', () => {
    const { part } = setup();
    expect(part('personal').tagName).toBe('FIELDSET');
    expect(part('personal').dataset).toMatchObject({ style: 'card' });
    expect(part('personal').hasAttribute('data-on-page')).toBe(true);
    const grid = part('personal').querySelector(':scope > .fd-grid') as HTMLElement;
    expect([grid.style.getPropertyValue('--fd-columns'), grid.dataset['columnsMedium'], grid.dataset['columnsNarrow']]).toEqual(['3', '3', '1']);
    const who = part('who');
    expect([who.tagName, who.dataset['place'], who.style.getPropertyValue('--fd-span')]).toEqual(['DIV', 'tracks', '2']);
    expect((who.querySelector(':scope > .fd-grid') as HTMLElement).style.getPropertyValue('--fd-columns')).toBe('');
    expect((who.querySelector(':scope > legend') as HTMLElement).hidden).toBe(true);
    expect([...who.querySelectorAll(':scope > .fd-grid > [data-node]')].map((e) => e.getAttribute('data-node'))).toEqual(['f-first_name', 'f-last_name', 'f-email', 'f-mobile', 'f-birthday', 'f-nationality']);
  });

  it('a row of groups on the page has its own columns; each group its style, label place and label width', () => {
    const { part } = setup();
    expect(part('side-1').dataset['place']).toBeUndefined();
    expect((part('side-1').querySelector(':scope > .fd-grid') as HTMLElement).style.getPropertyValue('--fd-columns')).toBe('2');
    expect(part('role').dataset['style']).toBe('line');
  });

  it('draws tabs anywhere, and the open tab’s parts', () => {
    const { part, designer } = setup();
    expect([...part('job-tabs').querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Job', 'Documents', 'Pay']);
    expect(part('role')).toBeTruthy();
    designer.select('f-iban');
    expect(part('bank').dataset['style']).toBe('framed');
    expect(part('bank').style.getPropertyValue('--fd-label-width')).toBe('120px');
    expect(part('f-bank_name').dataset['labels']).toBe('beside');
    expect(part('f-email').dataset['labels']).toBe('above');
  });

  it('draws the blocks between fields with the viewer’s own elements', () => {
    const { part } = setup();
    expect([part('div-1').tagName, part('div-1').className]).toEqual(['HR', 'fd-divider fd-canvas-block']);
    expect([part('h-send').tagName, part('h-send').textContent]).toEqual(['H3', 'Before you send']);
    expect(part('t-note').classList.contains('fd-text-note')).toBe(true);
    expect([part('send').textContent, part('send').classList.contains('fd-button-primary')]).toEqual(['Send to HR', true]);
  });

  it('wears the page’s look, as the form does', () => {
    setup();
    const element = canvas.element;
    expect(element.classList.contains('fd-form')).toBe(true);
    expect(element.dataset).toMatchObject({ fdSkin: 'outlined', font: 'system', density: 'comfortable', corners: 'soft' });
    // The page's #1677ff, a shade darker so words in it read at 4.5:1 (WCAG AA).
    expect(element.style.getPropertyValue('--fd-look-accent')).toBe('#1365d9');
    expect(element.style.getPropertyValue('--fd-label-width')).toBe('140px');
  });

  it('picks a block, and its words are typed where they stand', () => {
    const { part, designer } = setup();
    part('h-send').click();
    expect(designer.getState().selected).toBe('h-send');
    const heading = part('h-send');
    expect(heading.getAttribute('contenteditable')).toBe('plaintext-only');
    heading.textContent = 'Last of all';
    heading.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().layout.type === 'sections' && JSON.stringify(designer.getPage())).toContain('"text":"Last of all"');
    part('send').click();
    expect(part('h-send').hasAttribute('contenteditable')).toBe(false);
  });

  it('picks an arrangement by its room between parts, and lets go of views of parts gone', () => {
    const { part, designer } = setup();
    part('side-1').click();
    expect(designer.getState().selected).toBe('side-1');
    designer.remove(['div-1', 'personal']);
    expect(part('div-1')).toBeNull();
    expect(part('f-first_name')).toBeNull();
  });
});
