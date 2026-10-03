import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { tryIt, type TryIt } from './try-it';

let handle: TryIt | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function setup() {
  const designer = createDesigner({ page: blankPage('screen', 'Site visit') });
  const id = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(id, { label: 'Customer' });
  const changes: boolean[] = [];
  handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: (trying) => changes.push(trying) });
  document.body.append(handle.toggle, handle.element);
  const mode = (name: string) => handle?.toggle.querySelector(`button[data-mode="${name}"]`) as HTMLButtonElement;
  const control = (name: string) => handle?.element.querySelector(`button[data-try="${name}"]`) as HTMLButtonElement;
  const viewer = () => handle?.element.querySelector('.fd-try-frame form.fd-form') as HTMLFormElement | null;
  return { designer, id, changes, mode, control, viewer };
}

describe('try it', () => {
  it('switches between designing and trying the page as people will use it', () => {
    const { changes, mode, viewer } = setup();
    expect(mode('design').getAttribute('aria-pressed')).toBe('true');
    expect(handle?.element.hidden).toBe(true);
    expect(viewer()).toBeNull();
    mode('try').click();
    expect(changes).toEqual([true]);
    expect(handle?.trying).toBe(true);
    expect(mode('try').getAttribute('aria-pressed')).toBe('true');
    expect(handle?.element.hidden).toBe(false);
    expect([...(viewer()?.querySelectorAll('.fd-label') ?? [])].map((l) => l.textContent)).toEqual(['Customer']);
    // It works: what is typed stays in the box.
    const input = viewer()?.querySelector('input') as HTMLInputElement;
    input.value = 'Nile Towers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('Nile Towers');
    mode('design').click();
    expect(changes).toEqual([true, false]);
    expect(handle?.element.hidden).toBe(true);
    expect(viewer()).toBeNull();
  });

  it('tries the page as it is now, every time', () => {
    const { designer, id, mode, viewer } = setup();
    mode('try').click();
    mode('design').click();
    designer.updateQuestion(id, { label: 'Client' });
    mode('try').click();
    expect(viewer()?.querySelector('.fd-label')?.textContent).toBe('Client');
  });

  it('tries it at a tablet’s or a phone’s width', () => {
    const { mode, control } = setup();
    mode('try').click();
    const frame = handle?.element.querySelector('.fd-try-frame') as HTMLElement;
    expect(frame.dataset['width']).toBe('desktop');
    expect(control('desktop').getAttribute('aria-pressed')).toBe('true');
    control('phone').click();
    expect(frame.dataset['width']).toBe('phone');
    expect(control('phone').getAttribute('aria-pressed')).toBe('true');
    expect(control('desktop').getAttribute('aria-pressed')).toBe('false');
    control('tablet').click();
    expect(frame.dataset['width']).toBe('tablet');
  });

  it('tries it in Arabic, right to left, and back', () => {
    const { mode, control, viewer } = setup();
    mode('try').click();
    expect(viewer()?.getAttribute('dir')).toBe('ltr');
    control('rtl').click();
    expect(viewer()?.getAttribute('dir')).toBe('rtl');
    expect(viewer()?.getAttribute('lang')).toBe('ar');
    expect(control('rtl').getAttribute('aria-pressed')).toBe('true');
    control('ltr').click();
    expect(viewer()?.getAttribute('dir')).toBe('ltr');
  });

  it('takes the viewer down with it', () => {
    const { mode, viewer } = setup();
    mode('try').click();
    expect(viewer()).not.toBeNull();
    handle?.destroy();
    expect(viewer()).toBeNull();
  });
});
