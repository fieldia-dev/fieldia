import { readMode } from './canvas-mode';
import { mount } from './test-editor';
import { employeeDesigner } from './test-layout';

/**
 * Simple and Advanced: a preference of the person designing, not of the page.
 * Simple draws the page exactly as Advanced laid it out and hides Advanced's
 * marks; an arrangement says so, with a way into Advanced.
 */

const KEY = 'fieldia.designer.mode';
const modeButton = (host: Element, name: string) => host.querySelector<HTMLButtonElement>(`.fd-mode-switch button[data-mode="${name}"]`) as HTMLButtonElement;
const root = (host: Element) => host.querySelector('.fd-screen-designer') as HTMLElement;

beforeEach(() => localStorage.clear());

describe('the Simple and Advanced switch', () => {
  it('starts Simple, the switch saying which is on', () => {
    const { host } = mount(employeeDesigner());
    expect(root(host).dataset['mode']).toBe('simple');
    expect(modeButton(host, 'simple').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton(host, 'advanced').getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('.fd-mode-switch')?.getAttribute('aria-label')).toBe('Editing mode');
  });

  it('switches to Advanced, and remembers it for the next time in this browser', () => {
    const designer = employeeDesigner();
    const first = mount(designer);
    modeButton(first.host, 'advanced').click();
    expect(root(first.host).dataset['mode']).toBe('advanced');
    expect(localStorage.getItem(KEY)).toBe('advanced');
    first.handle.destroy();
    const again = mount(designer);
    expect(root(again.host).dataset['mode']).toBe('advanced');
    // The page itself is not touched by it.
    expect(JSON.stringify(designer.getPage())).not.toContain('advanced');
  });

  it('works when the browser keeps nothing', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    expect(readMode({ localStorage: storage } as unknown as Window)).toBe('simple');
    expect(readMode({ get localStorage(): Storage { throw new Error('blocked'); } } as unknown as Window)).toBe('simple');
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { host } = mount(employeeDesigner());
    modeButton(host, 'advanced').click();
    expect(root(host).dataset['mode']).toBe('advanced');
    spy.mockRestore();
  });
});

describe('an arrangement in Simple mode', () => {
  it('says how Advanced laid it out, and opens Advanced', () => {
    const designer = employeeDesigner();
    const { host } = mount(designer);
    designer.select('side-1');
    const note = host.querySelector('[data-node="side-1"] > .fd-simple-lock') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('Laid out in Advanced: 2 parts side by side, 2 columns on a desktop and 1 on a phone.');
    expect(note.textContent).toContain('Simple mode keeps it as it is. Edit what is inside by picking it.');
    (note.querySelector('button') as HTMLButtonElement).click();
    expect(root(host).dataset['mode']).toBe('advanced');
    expect(note.hidden).toBe(true);
  });

  it('says nothing for a group, or for an arrangement not picked', () => {
    const designer = employeeDesigner();
    const { host } = mount(designer);
    designer.select('personal');
    expect([...host.querySelectorAll<HTMLElement>('.fd-simple-lock')].filter((n) => !n.hidden)).toEqual([]);
    designer.select('who');
    expect((host.querySelector('[data-node="who"] > .fd-simple-lock') as HTMLElement).textContent).toContain('6 parts side by side, 2 columns on a desktop and 1 on a phone');
  });
});
