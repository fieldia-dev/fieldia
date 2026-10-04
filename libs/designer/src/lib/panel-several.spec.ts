import { mount } from './test-editor';
import { employeeDesigner, nodeOf } from './test-layout';

/** Several parts picked: the panel says how many, and sets what applies to them all, as one undo step. */

function picked(...ids: string[]) {
  const designer = employeeDesigner();
  const { host } = mount(designer);
  designer.pick(ids[0]);
  for (const id of ids.slice(1)) designer.pick(id, { add: true });
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  const shown = () => panel.querySelector('[role="tabpanel"]:not([hidden])') as HTMLElement;
  const group = (name: string) => [...shown().querySelectorAll<HTMLElement>(`[role="group"][aria-label="${name}"]`)].find((g) => !g.closest('[hidden]')) ?? null;
  const words = (name: string) => [...(group(name)?.querySelectorAll('button') ?? [])].filter((b) => !b.hidden).map((b) => b.textContent);
  const pressed = (name: string) => [...(group(name)?.querySelectorAll('button') ?? [])].find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null;
  const press = (name: string, text: string) => [...(group(name)?.querySelectorAll('button') ?? [])].find((b) => b.textContent === text)?.click();
  const value = (id: string, key: string) => nodeOf(designer.getPage(), id)?.[key];
  return { designer, panel, shown, group, words, pressed, press, value };
}

describe('the panel — several picked', () => {
  it('says how many, and keeps to their layout', () => {
    const { panel } = picked('f-email', 'f-mobile', 'f-birthday');
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('Several');
    expect(panel.querySelector('.fd-insp-name')?.textContent).toBe('3 parts picked');
    expect([...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Layout']);
  });

  it('sets the width of every part picked, as one undo step', () => {
    const { designer, words, pressed, press, value } = picked('f-email', 'f-mobile');
    expect(words('Width')).toEqual(['1', 'All 2']);
    expect(pressed('Width')).toBe('1');
    press('Width', 'All 2');
    expect([value('f-email', 'colspan'), value('f-mobile', 'colspan')]).toEqual([2, 2]);
    expect(pressed('Width')).toBe('All 2');
    designer.undo();
    expect([value('f-email', 'colspan'), value('f-mobile', 'colspan')]).toEqual([undefined, undefined]);
  });

  it('offers no more columns than the narrowest place has, and presses none when they differ', () => {
    const { words, pressed } = picked('f-street', 'f-city', 'who');
    // Home address has two columns, Personal details three.
    expect(words('Width')).toEqual(['1', 'All 2']);
    expect(pressed('Width')).toBeNull();
  });

  it('sets where the labels of fields and groups sit', () => {
    const { words, pressed, press, value } = picked('f-email', 'address');
    // A field in a group, a group on the page: what each takes when none is set differs.
    expect(words('Labels')).toEqual(['Not set', 'Above', 'Beside', 'In box']);
    expect(pressed('Labels')).toBe('Not set');
    press('Labels', 'Beside');
    expect([value('f-email', 'labels'), value('address', 'labels')]).toEqual(['beside', 'beside']);
    press('Labels', 'Not set');
    expect([value('f-email', 'labels'), value('address', 'labels')]).toEqual([undefined, undefined]);
  });

  it('says “As group” when every one of them sits in a group', () => {
    const { words } = picked('f-email', 'f-mobile');
    expect(words('Labels')[0]).toBe('As group');
  });

  it('offers only what applies to them all, and says why when nothing does', () => {
    const { group, shown } = picked('f-email', 'div-1');
    expect(group('Labels')).toBeNull();
    expect(group('Width')).toBeNull();
    expect(shown().querySelector('[data-setting="Width"] .fd-set-hint')?.textContent).toBe('A width needs every part picked in a group with columns.');
  });

  it('offers no width when one of them runs across the whole row, even in a group with columns', () => {
    const designer = employeeDesigner();
    const line = designer.addBlock('divider', { parent: 'address' }) as string;
    const { host } = mount(designer);
    designer.pick('f-city');
    designer.pick(line, { add: true });
    const shown = host.querySelector('.fd-properties [role="tabpanel"]:not([hidden])') as HTMLElement;
    expect([...shown.querySelectorAll('[role="group"][aria-label="Width"]')].filter((g) => !g.closest('[hidden]'))).toEqual([]);
    expect(shown.querySelector('[data-setting="Width"] .fd-set-hint')?.textContent).toBe('A width needs every part picked in a group with columns.');
  });

  it('groups them, or puts them side by side, when they sit together', () => {
    const { designer, shown } = picked('f-email', 'f-mobile');
    const button = (words: string) => [...shown().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words && !b.closest('[hidden]'));
    expect(button('Group these')).toBeDefined();
    button('Side by side')?.click();
    expect(nodeOf(designer.getPage(), 'f-email')).toBeDefined();
    const apart = picked('f-email', 'f-city');
    expect([...apart.shown().querySelectorAll('button')].filter((b) => !b.closest('[hidden]')).map((b) => b.textContent)).not.toContain('Group these');
  });
});
