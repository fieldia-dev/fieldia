import { mountKind, typeInto } from './test-kinds';

/** Flectra's CopyClipboardChar: the value, and a button that copies it. */
describe('a value to copy', () => {
  const written: string[] = [];
  beforeEach(() => {
    written.length = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => (written.push(text), Promise.resolve()) } });
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('is typed in its box, and its button copies it, saying so for a moment', async () => {
    const { el, value } = mountKind({ type: 'char', label: 'Session link' }, { widget: 'copy' });
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('fd-x');
    typeInto(input, 'https://survey.example/s/42');
    expect(value()).toBe('https://survey.example/s/42');
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Copy');
    button.click();
    await Promise.resolve();
    expect(written).toEqual(['https://survey.example/s/42']);
    expect(button.textContent).toBe('Copied');
    expect(el.querySelector('[role="status"]')?.textContent).toBe('Copied');
    jest.advanceTimersByTime(2500);
    expect(button.textContent).toBe('Copy');
  });

  it('copies a read-only value too, and offers nothing to copy while empty', () => {
    const { el, refresh, form } = mountKind({ type: 'char', label: 'Code' }, { widget: 'copy' });
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.hidden).toBe(true);
    form.setValue('x', 'X7Q2');
    refresh({ readonly: true });
    expect(button.hidden).toBe(false);
    expect((el.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
  });

  it('is said in the page’s language', () => {
    const { el, form } = mountKind({ type: 'char', label: 'Code' }, { widget: 'copy' }, { locale: 'fr' });
    form.setValue('x', 'X7Q2');
    expect((el.querySelector('button') as HTMLButtonElement).textContent).toBe('Copier');
  });
});
