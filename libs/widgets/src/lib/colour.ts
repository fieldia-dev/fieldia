import { foldDigits, stripMarks } from '@fieldia/core';
import { guard, refusalHint } from './input-rules';
import { describeState, fillIn, maker, rightToLeft, setAttr, setHidden, wordsFor } from './kind-parts';
import { popup } from './popup';
import type { WidgetFactory } from './widgets';

/**
 * A colour. On a whole number, Flectra's tag colours (widget="color_picker"):
 * 0 for none, 1 to 11 for red to violet, picked from a palette that opens
 * under a swatch of the colour now — a group of radios, named in the page's
 * language, used with the arrow keys. On text, a colour kept as #rrggbb, picked
 * with the browser's own picker (Flectra's widget="color") or typed as its code.
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

/** A colour code typed or pasted, as it is kept: #rrggbb in lower case, from #rgb or #rrggbb, with or without its #, in any case; null when it is none. */
export function readColour(text: string): string | null {
  const found = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(foldDigits(stripMarks(text)).trim());
  if (!found) return null;
  const hex = found[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`;
}

/**
 * A colour as #rrggbb text: picked with the browser's own picker, or typed or
 * pasted as its code in the box beside it — #rgb or #rrggbb, with or without
 * its #, in any case — which refuses anything else, and says why. An empty
 * colour shows as no colour, never black; one that need not be given can be
 * cleared. Read-only, its swatch and its code alone.
 */
const hexWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const label = node.label ?? field.label;
  const input = make('input', { id, type: 'color', class: 'fd-colour-input' });
  const swatch = make('span', { class: 'fd-colour-swatch', 'aria-hidden': 'true' });
  const well = make('span', { class: 'fd-colour-well' }, input, swatch);
  const code = make('input', { id: `${id}-code`, type: 'text', class: 'fd-input fd-colour-code', dir: 'ltr', autocomplete: 'off', spellcheck: 'false', placeholder: '#rrggbb', 'aria-label': `${label}: ${words.colourCodeBox}` });
  const clear = make('button', { type: 'button', class: 'fd-colour-clear', hidden: '', 'aria-label': fillIn(words.clear, { label }), title: fillIn(words.clear, { label }) }, '×');
  const element = make('span', { class: 'fd-colour-box' }, well, code, clear);
  const hint = refusalHint(code, element);
  const checks = guard(code, {
    // Only what a colour code is made of: a # first, then six hex digits at most.
    judge: (next) => (/^#?[0-9a-f]{0,6}$/i.test(foldDigits(stripMarks(next)).trim()) ? null : words.colourCode),
    paste: (text) => (readColour(text) ? { text: stripMarks(text).trim() } : { refuse: words.colourCode }),
  }, hint);
  const unread = () => form.getState().unread?.[name];
  const take = (colour: string | null) => {
    if (unread()) form.setUnread(name, null);
    form.setValue(name, colour);
  };
  input.addEventListener('input', () => take(input.value));
  code.addEventListener('input', () => {
    // A whole code is taken as it is typed; one on its way waits.
    const colour = readColour(code.value);
    if (colour) take(colour);
    else if (code.value.trim() === '' && form.getState().values[name] !== null) take(null);
  });
  code.addEventListener('blur', () => {
    if (code.readOnly) return;
    const text = code.value.trim();
    // A code left half typed stays, marked, and says what a code is; the colour stays what it was.
    if (text && !readColour(text)) form.setUnread(name, { text: code.value, message: words.colourCode });
  });
  clear.addEventListener('click', () => {
    take(null);
    code.focus();
  });
  return {
    element,
    focus: () => input.focus(),
    destroy: () => checks.destroy(),
    update(state) {
      const text = typeof state.value === 'string' ? state.value : '';
      const colour = readColour(text);
      const kept = unread();
      if (input.value !== (colour ?? '#000000')) input.value = colour ?? '#000000';
      swatch.style.setProperty('--fd-swatch', colour ?? 'transparent');
      swatch.classList.toggle('fd-colour-none', !colour);
      setAttr(swatch, 'title', colour ? null : words.noColour);
      if (document.activeElement !== code) {
        const shown = kept ? kept.text : text;
        if (code.value !== shown) {
          code.value = shown;
          checks.accept();
        }
      }
      // Read-only, its swatch and code are shown, not offered: the picker goes, the code is read.
      setHidden(input, state.readonly);
      if (code.readOnly !== state.readonly) code.readOnly = state.readonly;
      setHidden(clear, state.readonly || state.required || !text);
      setAttr(code, 'aria-invalid', String(state.invalid || !!kept));
      setAttr(code, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
      describeState(input, state);
    },
  };
};

export const colourWidget: WidgetFactory = (context) => (context.field.type === 'char' ? hexWidget(context) : paletteWidget(context));
