import { mountKind, press } from './test-kinds';

/** Flectra's state_selection: a grey, red or green dot, its menu choosing the state. */
const STATES = [
  { value: 'normal', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Ready for next stage' },
];

const button = (el: HTMLElement) => el.querySelector('button.fd-dot-button') as HTMLButtonElement;
const menu = (el: HTMLElement) => el.querySelector('[role="menu"]') as HTMLElement;
const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];

describe('a state’s dot', () => {
  it('is a button named by the field and its state, in the state’s tone', () => {
    const { el } = mountKind({ type: 'selection', label: 'Kanban state', options: STATES, default: 'blocked' }, { widget: 'dot' });
    expect(button(el).id).toBe('fd-x');
    expect(button(el).getAttribute('aria-label')).toBe('Kanban state: Blocked');
    expect(button(el).getAttribute('aria-haspopup')).toBe('menu');
    expect(button(el).dataset['tone']).toBe('danger');
    expect(menu(el).hidden).toBe(true);
  });

  it('opens its menu of states, each with its dot, and picking one sets it and closes the menu', () => {
    const { el, value } = mountKind({ type: 'selection', options: STATES, default: 'normal' }, { widget: 'dot' });
    button(el).click();
    expect(menu(el).hidden).toBe(false);
    expect(button(el).getAttribute('aria-expanded')).toBe('true');
    expect(items(el).map((item) => item.textContent)).toEqual(['In progress', 'Blocked', 'Ready for next stage']);
    expect(items(el).map((item) => item.dataset['tone'])).toEqual(['muted', 'danger', 'success']);
    expect(items(el)[0].getAttribute('aria-checked')).toBe('true');
    items(el)[2].click();
    expect(value()).toBe('done');
    expect(menu(el).hidden).toBe(true);
    expect(document.activeElement).toBe(button(el));
  });

  it('is used from the keyboard: down opens it on the state it has, arrows move, Enter picks, Escape closes', () => {
    const { el, value } = mountKind({ type: 'selection', options: STATES, default: 'blocked' }, { widget: 'dot' });
    button(el).focus();
    press(button(el), 'ArrowDown');
    expect(document.activeElement).toBe(items(el)[1]);
    press(items(el)[1], 'ArrowDown');
    expect(document.activeElement).toBe(items(el)[2]);
    press(items(el)[2], 'Home');
    expect(document.activeElement).toBe(items(el)[0]);
    press(items(el)[0], 'Escape');
    expect(menu(el).hidden).toBe(true);
    expect(document.activeElement).toBe(button(el));
    expect(value()).toBe('blocked');
    press(button(el), 'Enter');
    press(document.activeElement as Element, 'ArrowUp');
    press(document.activeElement as Element, 'Enter');
    expect(value()).toBe('normal');
  });

  it('takes its tones from the page, and shows the state’s words beside it when asked', () => {
    const { el } = mountKind({ type: 'selection', options: STATES, default: 'normal' }, { widget: 'dot', options: { tones: { normal: 'info' }, label: true } });
    expect(button(el).dataset['tone']).toBe('info');
    expect(el.querySelector('.fd-dot-label')?.textContent).toBe('In progress');
  });

  it('cannot be opened while read-only', () => {
    const { el, refresh } = mountKind({ type: 'selection', options: STATES, default: 'done' }, { widget: 'dot' });
    refresh({ readonly: true });
    expect(button(el).disabled).toBe(true);
  });
});
