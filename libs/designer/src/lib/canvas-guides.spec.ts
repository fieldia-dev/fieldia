import { canvasGuides } from './canvas-guides';
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
