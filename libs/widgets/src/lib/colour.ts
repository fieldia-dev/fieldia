import { describeState, maker, rightToLeft, setAttr, setText, wordsFor } from './kind-parts';
import { popup } from './popup';
import type { WidgetFactory } from './widgets';

/**
 * A colour. On a whole number, Flectra's tag colours (widget="color_picker"):
 * 0 for none, 1 to 11 for red to violet, picked from a palette that opens
 * under a swatch of the colour now — a group of radios, named in the page's
 * language, used with the arrow keys. On text, a colour kept as #rrggbb, picked
 * with the browser's own picker (Flectra's widget="color").
 */

/** Flectra's tag colours, by their number: none, red, orange, yellow, cyan, purple, almond, teal, blue, raspberry, green, violet. */
export const FLECTRA_COLOURS: readonly string[] = ['transparent', '#f06050', '#f4a460', '#f7cd1f', '#6cc1ed', '#814968', '#eb7e7f', '#2c8397', '#475577', '#d6145f', '#30c381', '#9365b8'];

const paletteWidget: WidgetFactory = ({ form, name, field, id, document, labels, locale }) => {
  const make = maker(document);
  const names = wordsFor(labels, locale).colourNames.split('|');
  const swatch = make('button', { type: 'button', id, class: 'fd-colour-button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': `${id}-palette` });
  const colours = FLECTRA_COLOURS.map((colour, n) => {
    const radio = make('button', { type: 'button', role: 'radio', class: 'fd-colour', 'aria-label': names[n] ?? String(n), title: names[n] ?? String(n), tabindex: '-1', 'data-colour': String(n) });
    radio.style.setProperty('--fd-swatch', colour);
    radio.addEventListener('click', () => pick(n));
    return radio;
  });
  const palette = make('div', { id: `${id}-palette`, role: 'radiogroup', class: 'fd-colour-palette', 'aria-label': field.label, hidden: '' }, ...colours);
  const element = make('span', { class: 'fd-colour-box' }, swatch, palette);
  let refocus = false;
  const floating = popup(element, swatch, palette, () => {
    if (refocus) swatch.focus();
    refocus = false;
  });
  const now = () => {
    const value = form.getState().values[name];
    return typeof value === 'number' && value >= 0 && value < FLECTRA_COLOURS.length ? value : 0;
  };
  function close(focusBack: boolean) {
    refocus = focusBack;
    floating.close();
  }
  function pick(n: number) {
    form.setValue(name, n);
    close(true);
  }
  swatch.addEventListener('click', () => {
    if (floating.isOpen()) return close(true);
    floating.open();
    colours[now()].focus();
  });
  palette.addEventListener('keydown', (event) => {
    const at = colours.indexOf(document.activeElement as HTMLButtonElement);
    const forward = rightToLeft(element) ? 'ArrowLeft' : 'ArrowRight';
    const back = rightToLeft(element) ? 'ArrowRight' : 'ArrowLeft';
    const to = event.key === forward || event.key === 'ArrowDown' ? at + 1 : event.key === back || event.key === 'ArrowUp' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? colours.length - 1 : null;
    if (to !== null) {
      event.preventDefault();
      colours[(to + colours.length) % colours.length].focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && at >= 0) {
      event.preventDefault();
      pick(at);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(true);
  });
  return {
    element,
    focus: () => swatch.focus(),
    destroy: () => close(false),
    update(state) {
      const n = typeof state.value === 'number' && state.value >= 0 && state.value < FLECTRA_COLOURS.length ? state.value : 0;
      swatch.style.setProperty('--fd-swatch', FLECTRA_COLOURS[n]);
      swatch.classList.toggle('fd-colour-none', n === 0);
      setAttr(swatch, 'aria-label', `${field.label}: ${names[n] ?? n}`);
      setAttr(swatch, 'title', names[n] ?? String(n));
      colours.forEach((radio, i) => setAttr(radio, 'aria-checked', String(i === n)));
      if (swatch.disabled !== state.readonly) swatch.disabled = state.readonly;
      if (state.readonly) close(false);
      describeState(swatch, state);
    },
  };
};

/** A colour as #rrggbb text, picked with the browser's own picker, its code beside it. */
const hexWidget: WidgetFactory = ({ form, name, id, document }) => {
  const make = maker(document);
  const input = make('input', { id, type: 'color', class: 'fd-colour-input' });
  const code = make('span', { class: 'fd-colour-code', dir: 'ltr' });
  input.addEventListener('input', () => form.setValue(name, input.value));
  return {
    element: make('span', { class: 'fd-colour-box' }, input, code),
    focus: () => input.focus(),
    update(state) {
      const text = typeof state.value === 'string' ? state.value : '';
      const hex = /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : '#000000';
      if (input.value !== hex) input.value = hex;
      setText(code, text);
      if (input.disabled !== state.readonly) input.disabled = state.readonly;
      describeState(input, state);
    },
  };
};

export const colourWidget: WidgetFactory = (context) => (context.field.type === 'char' ? hexWidget(context) : paletteWidget(context));
