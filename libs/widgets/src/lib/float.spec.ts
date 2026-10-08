import { floatUnder } from './float';

describe('a list floating under its control', () => {
  const frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    // A window as a browser has one: room below the control.
    for (const [name, value] of [['clientWidth', 1200], ['clientHeight', 800]] as const) Object.defineProperty(document.documentElement, name, { value, configurable: true });
    frames.length = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => frames.push(run));
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const nextFrame = () => frames.splice(0).forEach((run) => run(0));

  function mount() {
    const anchor = document.createElement('input');
    const box = document.createElement('ul');
    box.hidden = true;
    document.body.replaceChildren(anchor, box);
    let top = 100;
    anchor.getBoundingClientRect = () => ({ left: 20, top, right: 220, bottom: top + 30, width: 200, height: 30, x: 20, y: top, toJSON: () => ({}) }) as DOMRect;
    return { anchor, box, floating: floatUnder(anchor, box), moveTo: (y: number) => (top = y) };
  }

  it('follows its control moved by anything, not only a scroll or a resize, while it is open', () => {
    const { box, floating, moveTo } = mount();
    floating.show();
    expect(box.style.top).toBe('132px');
    // A line added above, a screenshot's resize: the control moved and no scroll was told.
    moveTo(300);
    nextFrame();
    expect(box.style.top).toBe('332px');
  });

  it('stops watching once closed', () => {
    const { box, floating, moveTo } = mount();
    floating.show();
    floating.hide();
    moveTo(300);
    nextFrame();
    expect(box.hidden).toBe(true);
    expect(box.style.top).toBe('132px');
  });
});
