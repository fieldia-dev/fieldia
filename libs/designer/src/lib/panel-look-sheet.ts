import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { pageLookSettings, wearLook } from './panel-look';

/**
 * The page's look where there is no panel to hold it, as in the survey
 * designer: a Look button in the bar opens the same settings as the screen
 * editor's Look tab, in a sheet at the side, and the cards wear each setting
 * as it is set. Escape or its close button puts it away.
 */

export interface LookSheet {
  button: HTMLButtonElement;
  sheet: HTMLElement;
  destroy(): void;
}

export function lookSheet(options: { el: ElementFactory; designer: Designer; root: HTMLElement; bar: HTMLElement; wearer: HTMLElement }): LookSheet {
  const { el, designer, root, bar, wearer } = options;
  const w = designer.words.panel;
  const look = pageLookSettings(el, designer);
  const button = el('button', { type: 'button', class: 'fd-button fd-look-button', 'aria-label': w.look, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: w.lookTitle }, w.look);
  const close = el('button', { type: 'button', class: 'fd-icon-button', 'aria-label': w.close, title: w.close }, '×');
  const sheet = el(
    'aside',
    { class: 'fd-look-sheet fd-properties', role: 'dialog', 'aria-label': w.look },
    el('div', { class: 'fd-look-sheet-head' }, el('div', {}, el('div', { class: 'fd-insp-kind' }, el('span', { class: 'fd-panel-title' }, w.look)), el('div', { class: 'fd-insp-name' }, w.formsLook)), close),
    el('div', { class: 'fd-props fd-insp-panel fd-look-sheet-body' }, ...look.rows)
  );

  // On the page only while it is open.
  const show = (open: boolean) => {
    if (open) root.append(sheet);
    else sheet.remove();
    // Drawn as it opens: what changed while it was away — a look saved in another editor — is shown.
    if (open) draw();
    button.setAttribute('aria-expanded', String(open));
    // Under the bar, so the bar's buttons stay in reach.
    if (open) sheet.style.setProperty('--fd-sheet-top', `${Math.max(8, Math.round(bar.getBoundingClientRect().bottom + 8))}px`);
    if (open) (sheet.querySelector('[aria-pressed="true"], button, input') as HTMLElement | null)?.focus();
  };
  button.addEventListener('click', () => show(!sheet.isConnected));
  close.addEventListener('click', () => {
    show(false);
    button.focus();
  });
  sheet.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // The editor's own Escape puts a card down; this one only puts the sheet away.
    event.stopPropagation();
    show(false);
    button.focus();
  });

  const draw = () => {
    const page = designer.getPage();
    look.update(page);
    wearLook(wearer, page.look);
  };
  const leave = designer.subscribe(draw);
  bar.insertBefore(button, bar.querySelector('[data-checks]'));
  draw();
  return {
    button,
    sheet,
    destroy() {
      leave();
      button.remove();
      sheet.remove();
    },
  };
}
