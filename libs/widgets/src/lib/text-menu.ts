/**
 * A menu that floats under the button that opens it — a formatted text's
 * colours, sizes and hidden tools, a links box's Add link — in a form it is
 * placed over the page from there, so a group or a scrolling box never clips
 * it, and goes back where it came from when it closes. Its start edge meets
 * the button's (`align: 'start'`) or its end edge the button's (`'end'`),
 * mirrored right to left; kept on the screen.
 *
 * It is a real menu: ↓ ↑ Home End move, Enter and Space choose, Escape and
 * Tab close it and give the focus back, a press outside closes it.
 */

export interface MenuChoice {
  label: string;
  /** Drawn before the words: an icon, a colour's swatch. */
  lead?: Node | null;
  /** A choice that is on now, as a colour picked: ✓ and `aria-checked`. */
  checked?: boolean;
  run(): void;
}

export interface TextMenu {
  readonly element: HTMLElement;
  open(choices: MenuChoice[], options?: { focus?: 'first' | 'checked' | 'none' }): void;
  close(giveBack?: boolean): void;
  isOpen(): boolean;
}

let menus = 0;

export function textMenu(doc: Document, anchor: HTMLElement, options: { label: string; align?: 'start' | 'end'; className?: string; grid?: boolean }): TextMenu {
  const element = doc.createElement('div');
  element.className = `fd-text-menu${options.className ? ` ${options.className}` : ''}`;
  element.id = `fd-text-menu-${++menus}`;
  element.setAttribute('role', 'menu');
  element.setAttribute('aria-label', options.label);
  element.hidden = true;
  anchor.setAttribute('aria-haspopup', 'menu');
  anchor.setAttribute('aria-expanded', 'false');
  anchor.setAttribute('aria-controls', element.id);
  let items: HTMLElement[] = [];

  const outside = (event: Event) => {
    if (!element.contains(event.target as Node) && !anchor.contains(event.target as Node)) close(false);
  };
  const move = (to: number) => {
    if (!items.length) return;
    const at = (to + items.length) % items.length;
    items.forEach((item, i) => (item.tabIndex = i === at ? 0 : -1));
    items[at].focus();
  };

  function place() {
    const host = anchor.closest<HTMLElement>('.fd-form, .fd-theme') ?? doc.body;
    host.append(element);
    Object.assign(element.style, { position: 'absolute', top: '0px', left: '0px' });
    const [a, origin, own] = [anchor.getBoundingClientRect(), element.getBoundingClientRect(), element.offsetWidth];
    const rtl = getComputedStyle(anchor).direction === 'rtl';
    const end = (options.align ?? 'start') === 'end';
    const width = doc.documentElement.clientWidth || own;
    // The edge it shares with the button: the start of the line, or its end, whichever way the words run.
    const wanted = end !== rtl ? a.right - own : a.left;
    const left = Math.max(8, Math.min(wanted, width - own - 8));
    Object.assign(element.style, { top: `${a.bottom - origin.top}px`, left: `${left - origin.left}px` });
  }

  function open(choices: MenuChoice[], how: { focus?: 'first' | 'checked' | 'none' } = {}) {
    items = choices.map((choice) => {
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = 'fd-text-menu-item';
      item.setAttribute('role', choice.checked === undefined ? 'menuitem' : 'menuitemradio');
      if (choice.checked !== undefined) item.setAttribute('aria-checked', String(choice.checked));
      item.tabIndex = -1;
      const words = doc.createElement('span');
      words.className = 'fd-text-menu-words';
      words.textContent = choice.label;
      if (options.grid) item.setAttribute('aria-label', choice.label);
      item.append(...(choice.lead ? [choice.lead] : []), ...(options.grid ? [] : [words]));
      // The text keeps its selection: the press acts on what was selected there.
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => {
        close(true);
        choice.run();
      });
      return item;
    });
    element.replaceChildren(...items);
    element.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    anchor.classList.add('fd-pressed');
    place();
    doc.addEventListener('pointerdown', outside, true);
    const checked = items.findIndex((item) => item.getAttribute('aria-checked') === 'true');
    if (how.focus !== 'none') move(how.focus === 'checked' && checked >= 0 ? checked : 0);
    else if (items[0]) items[0].tabIndex = 0;
  }

  function close(giveBack = true) {
    if (element.hidden) return;
    element.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    anchor.classList.remove('fd-pressed');
    doc.removeEventListener('pointerdown', outside, true);
    // Back beside its button, out of sight.
    const home = anchor.parentElement;
    if (home && element.parentElement !== home) home.append(element);
    for (const key of ['position', 'top', 'left'] as const) element.style.removeProperty(key);
    if (giveBack) anchor.focus();
  }

  element.addEventListener('keydown', (event) => {
    const at = items.indexOf(doc.activeElement as HTMLElement);
    const rtl = getComputedStyle(element).direction === 'rtl';
    const across = options.grid ? { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 } : {};
    const step = ({ ArrowDown: 1, ArrowUp: -1, ...across } as Record<string, number>)[event.key];
    if (step !== undefined) {
      event.preventDefault();
      move(at + step);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      move(event.key === 'Home' ? 0 : items.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  });

  return { element, open, close, isOpen: () => !element.hidden };
}
