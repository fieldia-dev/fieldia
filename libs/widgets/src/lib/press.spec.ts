import { refusalHint } from './input-rules';
import { afterPress } from './press';

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
