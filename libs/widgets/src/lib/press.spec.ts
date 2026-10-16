import { refusalHint } from './input-rules';
import { afterPress, watchPresses } from './press';

/**
 * A press of the pointer leaves the box the person was in: the words under it, said or unsaid then, wait for the
 * press to end, so nothing under the pointer moves before the release — a click on Apply, or Save, below the box is
 * the button's (input rules: a press is always the button's).
 */

const press = (target: Element, type: string) => target.dispatchEvent(new Event(type, { bubbles: true }));
const tick = () => new Promise((done) => setTimeout(done, 5));

describe('what moves the page as a press leaves a box', () => {
  afterEach(() => document.body.replaceChildren());

  it('is done at once when no press is going on', () => {
    const done = jest.fn();
    afterPress(document, {}, done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('waits for the press to end, the latest of each asker alone, then after the click it makes', async () => {
    const box = document.createElement('input');
    const button = document.createElement('button');
    document.body.append(box, button);
    const hint = refusalHint(box);
    box.focus();
    hint.show('“1e5” is not a number');
    expect(hint.element.hidden).toBe(false);
    press(button, 'pointerdown');
    // The box left as the press begins: its words stay where they are until it ends.
    hint.hide();
    expect(hint.words).toBe('');
    expect(hint.element.hidden).toBe(false);
    hint.show('Enter a number');
    expect(hint.element.textContent).toBe('“1e5” is not a number');
    press(button, 'pointerup');
    let shownAtClick: string | null = null;
    button.addEventListener('click', () => (shownAtClick = hint.element.textContent));
    button.click();
    expect(shownAtClick).toBe('“1e5” is not a number');
    await tick();
    expect(hint.element.textContent).toBe('Enter a number');
    expect(hint.element.hidden).toBe(false);
  });

  it('a press never released lets what waits go after a moment', async () => {
    jest.useFakeTimers();
    try {
      const done = jest.fn();
      press(document.body, 'pointerdown');
      afterPress(document, {}, done);
      expect(done).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1600);
      expect(done).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * A box's own message as it is left (a field's problem, a cell's, a property's, a range's end) waits as its hint does:
 * one mechanism. Left by the keys, it shows at once.
 */
function pointer(type: string, target: Element) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isPrimary', { value: true });
  target.dispatchEvent(event);
}

describe('what a box shows as a press leaves it', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    // Whatever a test left waiting ends here, so the next starts with no press going on.
    document.body.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    jest.useRealTimers();
  });

  it('runs at once when no press is going on', () => {
    watchPresses(document);
    const shown: string[] = [];
    afterPress(document, {}, () => shown.push('error'));
    expect(shown).toEqual(['error']);
  });

  it('waits for a press to end — its click handled first — then runs', () => {
    watchPresses(document);
    const submit = document.createElement('button');
    document.body.append(submit);
    const shown: string[] = [];
    submit.addEventListener('click', () => shown.push('submit checked'));
    pointer('pointerdown', submit);
    afterPress(document, {}, () => shown.push('box error'));
    expect(shown).toEqual([]);
    pointer('pointerup', submit);
    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown).toEqual(['submit checked']);
    jest.advanceTimersByTime(0);
    expect(shown).toEqual(['submit checked', 'box error']);
    submit.remove();
  });

  it('a finger’s click that follows the lift is waited for; with none, it runs a moment after the lift', () => {
    watchPresses(document);
    const shown: string[] = [];
    pointer('pointerdown', document.body);
    pointer('pointerup', document.body);
    // A phone moves the focus after the lift, as its click comes.
    afterPress(document, {}, () => shown.push('box error'));
    expect(shown).toEqual([]);
    jest.advanceTimersByTime(399);
    expect(shown).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(shown).toEqual(['box error']);
  });

  it('a press whose lift never came ends with the next key', () => {
    watchPresses(document);
    const shown: string[] = [];
    pointer('pointerdown', document.body);
    afterPress(document, {}, () => shown.push('box error'));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(shown).toEqual(['box error']);
  });

  it('a press cancelled (a scroll) ends at once', () => {
    watchPresses(document);
    const shown: string[] = [];
    pointer('pointerdown', document.body);
    afterPress(document, {}, () => shown.push('box error'));
    document.body.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(shown).toEqual(['box error']);
  });

  it('every asker waiting is done once the press ends, each its latest', () => {
    watchPresses(document);
    const shown: string[] = [];
    const [field, hint] = [{}, {}];
    pointer('pointerdown', document.body);
    afterPress(document, field, () => shown.push('field: first'));
    afterPress(document, hint, () => shown.push('hint'));
    afterPress(document, field, () => shown.push('field: latest'));
    document.body.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(shown).toEqual(['field: latest', 'hint']);
  });
});
