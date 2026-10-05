import { FIELDIA_CSS } from '@fieldia/widgets';
import { canvasGuides, SHARED_CELL_NARROW } from './canvas-guides';
import { createDesigner } from './designer';
import { mount } from './test-editor';
import { employeeDesigner, employeePage, watched } from './test-layout';

/**
 * The guides of the Advanced canvas: the columns of the grid a picked part
 * sits on, and of a picked group's own grid, tinted and numbered — so a part
 * dropped or widened can be seen to land on them.
 */

function setup() {
  const designer = watched(createDesigner({ page: employeePage() }));
  const root = document.createElement('div');
  root.dataset['container'] = 'root';
  document.body.append(root);
  const grid = (id: string, parent: HTMLElement) => {
    const section = document.createElement('fieldset');
    section.dataset['node'] = id;
    const g = document.createElement('div');
    g.className = 'fd-grid';
    g.dataset['container'] = id;
    section.append(g);
    parent.append(section);
    return g;
  };
  const personal = grid('personal', root);
  const photo = document.createElement('div');
  photo.dataset['node'] = 'f-photo';
  personal.append(photo);
  grid('who', personal);
  const emergency = grid('emergency', root);
  const name = document.createElement('div');
  name.dataset['node'] = 'f-ec_name';
  emergency.append(name);
  const guides = canvasGuides({ root, designer });
  const shown = () => [...root.querySelectorAll<HTMLElement>('.fd-guides')].map((g) => `${(g.parentElement as HTMLElement).dataset['container']}:${g.children.length}:${[...g.children].map((i) => i.getAttribute('data-n')).join('')}`);
  return { designer, guides, shown };
}

afterEach(() => document.body.replaceChildren());

describe('the guides', () => {
  it('show the columns of the grid a picked part sits on, numbered', () => {
    const { designer, guides, shown } = setup();
    designer.select('f-photo');
    guides.update(designer.getState(), true);
    expect(shown()).toEqual(['personal:3:123']);
  });

  it('and a picked group’s own columns, as well as those it sits on', () => {
    const { designer, guides, shown } = setup();
    designer.select('who');
    guides.update(designer.getState(), true);
    expect(shown()).toEqual(['personal:3:123', 'who:2:12']);
  });

  it('count the columns the canvas gives a grid, without laying the page out to measure them', () => {
    const { designer, guides, shown } = setup();
    const personal = document.querySelector<HTMLElement>('[data-container="personal"]') as HTMLElement;
    personal.style.setProperty('--fd-cols', '2');
    const measured = jest.spyOn(window, 'getComputedStyle');
    try {
      designer.select('f-photo');
      guides.update(designer.getState(), true);
      expect(shown()).toEqual(['personal:2:12']);
      expect(measured).not.toHaveBeenCalled();
    } finally {
      measured.mockRestore();
    }
  });

  it('an arrangement on its grid’s tracks: as many as its span covers of the columns the grid has now, without measuring', () => {
    const { designer, guides, shown } = setup();
    const personal = document.querySelector<HTMLElement>('[data-container="personal"]') as HTMLElement;
    const who = document.querySelector<HTMLElement>('[data-node="who"]') as HTMLElement;
    who.dataset['place'] = 'tracks';
    who.style.setProperty('--fd-span', '2');
    personal.style.setProperty('--fd-cols', '3');
    const measured = jest.spyOn(window, 'getComputedStyle');
    try {
      designer.select('who');
      guides.update(designer.getState(), true);
      expect(shown()).toEqual(['personal:3:123', 'who:2:12']);
      // On a phone the grid has one column, and so has the arrangement on it: no guides.
      personal.style.setProperty('--fd-cols', '1');
      guides.update(designer.getState(), true);
      expect(shown()).toEqual([]);
      expect(measured).not.toHaveBeenCalled();
    } finally {
      measured.mockRestore();
    }
  });

  it('parts sharing a cell: their own columns, one where the browser reports the cell 330px or narrower — never measured', () => {
    const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
    const real = window.ResizeObserver;
    window.ResizeObserver = class {
      targets: Element[] = [];
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, targets: this.targets });
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const measured = jest.spyOn(window, 'getComputedStyle');
    try {
      const { designer, guides, shown } = setup();
      document.querySelector<HTMLElement>('[data-container="personal"]')?.style.setProperty('--fd-cols', '3');
      const who = document.querySelector<HTMLElement>('[data-node="who"]') as HTMLElement;
      who.dataset['place'] = 'shared';
      (who.querySelector('.fd-grid') as HTMLElement).style.setProperty('--fd-columns', '2');
      designer.select('who');
      guides.update(designer.getState(), true);
      expect(shown()).toEqual(['personal:3:123', 'who:2:12']);
      // The browser says the cell is narrow, after laying it out: the guides follow, with the cell's one column.
      const [observer] = observers;
      expect(observer.targets).toContain(who);
      const report = (width: number) => observer.callback([{ target: who, contentRect: { width } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      report(300);
      expect(shown()).toEqual(['personal:3:123']);
      report(420);
      expect(shown()).toEqual(['personal:3:123', 'who:2:12']);
      expect(measured).not.toHaveBeenCalled();
    } finally {
      measured.mockRestore();
      if (real) window.ResizeObserver = real;
      else delete (window as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it('in twelfths, twelve faint tracks with no numbers — and the tracks an arrangement covers on them', () => {
    const { designer, guides, shown } = setup();
    designer.setColumns('personal', 12);
    designer.select('who');
    guides.update(designer.getState(), true);
    expect(shown()).toEqual(['personal:12:', 'who:8:']);
    expect(document.querySelectorAll('.fd-guides.fd-guides-fine')).toHaveLength(2);
  });

  it('none where there is one column, none in Simple, none with nothing picked', () => {
    const { designer, guides, shown } = setup();
    designer.select('f-ec_name');
    guides.update(designer.getState(), true);
    expect(shown()).toEqual([]);
    designer.select('f-photo');
    guides.update(designer.getState(), false);
    expect(shown()).toEqual([]);
    guides.update(designer.getState(), true);
    designer.select(null);
    guides.update(designer.getState(), true);
    expect(shown()).toEqual([]);
  });
});

describe('the guides on the canvas', () => {
  afterEach(() => localStorage.clear());
  it('show on the grid a picked part sits on, in Advanced; none in Simple', () => {
    localStorage.setItem('fieldia.designer.mode', 'advanced');
    const designer = employeeDesigner();
    const { host } = mount(designer);
    designer.select('f-email');
    const bands = () => [...host.querySelectorAll<HTMLElement>('.fd-canvas-body .fd-guides')].map((g) => `${(g.parentElement as HTMLElement).dataset['container']}:${g.children.length}`);
    expect(bands()).toEqual(['who:2']);
    designer.select('personal');
    expect(bands()).toEqual(['personal:3']);
    (host.querySelector('.fd-mode-switch button[data-mode="simple"]') as HTMLButtonElement).click();
    expect(bands()).toEqual([]);
  });
});

describe('the guides and the canvas drawn again', () => {
  it('leave the part being typed in where it is, and the cursor in it, as each key redraws the canvas', () => {
    const designer = createDesigner({ page: employeePage() });
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select('f-first_name');
    const card = host.querySelector('.fd-canvas-field[data-node="f-first_name"]') as HTMLElement;
    const label = card.querySelector('[data-inline="label"]') as HTMLInputElement;
    expect(host.querySelector('.fd-guides')).not.toBeNull();
    label.focus();
    for (const word of ['G', 'Gi', 'Giv', 'Given name']) {
      label.value = word;
      label.dispatchEvent(new Event('input', { bubbles: true }));
      expect([word, document.activeElement === label, card.isConnected]).toEqual([word, true, true]);
    }
    expect(host.querySelector('.fd-guides')).not.toBeNull();
  });
});

describe('the width a shared cell turns to one column at', () => {
  it('is the form stylesheet’s own', () => {
    const rules = FIELDIA_CSS.split(`@container (max-width: ${SHARED_CELL_NARROW}px) {`).slice(1).map((after) => after.slice(0, after.indexOf('\n}')));
    expect(rules.some((r) => r.includes('.fd-section[data-place="shared"] > .fd-grid { --fd-cols: 1; }'))).toBe(true);
  });
});
