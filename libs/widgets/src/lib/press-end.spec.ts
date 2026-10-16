import { afterPress, watchPresses } from './press-end';

/**
 * What a box shows as it is left waits, when a press elsewhere left it, until
 * that press has ended: its click handled first, so the press lands where it
 * began. Left by the keys, it shows at once.
 */

function pointer(type: string, target: Element) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isPrimary', { value: true });
  target.dispatchEvent(event);
}

describe('afterPress', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs at once when no press is going on', () => {
    watchPresses(document);
    const shown: string[] = [];
    afterPress(document, () => shown.push('error'));
    expect(shown).toEqual(['error']);
  });

  it('waits for a press to end — its click handled first — then runs', () => {
    watchPresses(document);
    const submit = document.createElement('button');
    document.body.append(submit);
    const shown: string[] = [];
    submit.addEventListener('click', () => shown.push('submit checked'));
    pointer('pointerdown', submit);
    afterPress(document, () => shown.push('box error'));
    expect(shown).toEqual([]);
    pointer('pointerup', submit);
    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown).toEqual(['submit checked']);
    jest.advanceTimersByTime(0);
    expect(shown).toEqual(['submit checked', 'box error']);
  });

  it('a finger’s click that follows the lift is waited for; with none, it runs a moment after the lift', () => {
    watchPresses(document);
    const shown: string[] = [];
    pointer('pointerdown', document.body);
    pointer('pointerup', document.body);
    // A phone moves the focus after the lift, as its click comes.
    afterPress(document, () => shown.push('box error'));
    expect(shown).toEqual([]);
    jest.advanceTimersByTime(399);
    expect(shown).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(shown).toEqual(['box error']);
  });

  it('a press cancelled (a scroll) ends at once', () => {
    watchPresses(document);
    const shown: string[] = [];
    pointer('pointerdown', document.body);
    afterPress(document, () => shown.push('box error'));
    document.body.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(shown).toEqual(['box error']);
  });
});
