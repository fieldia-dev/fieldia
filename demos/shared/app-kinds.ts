import type { AppKind } from '@fieldia/designer';
import type { WidgetFactory } from '@fieldia/widgets';

/**
 * The demos' own kind of field, as an app adds one: an IBAN. It is kept as
 * text, drawn by the app's widget — which writes it in groups of four and
 * checks it as it is typed, by its country's length and its check digits —
 * and it has a setting of its own, the country it is for.
 */

/** The countries the setting offers, with how long their IBANs are. */
const COUNTRIES: Record<string, { name: string; arabic: string; length: number }> = {
  EG: { name: 'Egypt', arabic: 'مصر', length: 29 },
  SA: { name: 'Saudi Arabia', arabic: 'السعودية', length: 24 },
  AE: { name: 'United Arab Emirates', arabic: 'الإمارات', length: 23 },
  DE: { name: 'Germany', arabic: 'ألمانيا', length: 22 },
  GB: { name: 'United Kingdom', arabic: 'المملكة المتحدة', length: 22 },
  FR: { name: 'France', arabic: 'فرنسا', length: 27 },
};

const compact = (text: string) => text.replace(/\s+/g, '').toUpperCase();
/** "DE89 3704 0044 …": four at a time, as it is printed on a bank card. */
const grouped = (text: string) => compact(text).replace(/(.{4})(?=.)/g, '$1 ');

/** Whether the check digits match: the first four moved to the end, letters as numbers, the whole leaving 1 over 97. */
function checksOut(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const c of moved) {
    const digits = /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** What is wrong with an IBAN, in words, or null when it checks out. */
export function ibanProblem(text: string, country: string | null, arabic = false): string | null {
  const iban = compact(text);
  const want = country ? COUNTRIES[country] : null;
  const where = want ? (arabic ? want.arabic : want.name) : '';
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return arabic ? 'يبدأ رقم IBAN بحرفين للدولة ثم رقمين' : 'An IBAN starts with its country’s two letters, then two digits';
  if (country && !iban.startsWith(country)) return arabic ? `يبدأ رقم IBAN من ${where} بـ ${country}` : `An IBAN from ${where} starts with ${country}`;
  const length = COUNTRIES[iban.slice(0, 2)]?.length;
  if (length && iban.length !== length) return arabic ? `رقم IBAN من ${COUNTRIES[iban.slice(0, 2)].arabic} من ${length} خانة، والمكتوب ${iban.length}` : `An IBAN from ${COUNTRIES[iban.slice(0, 2)].name} has ${length} characters, not ${iban.length}`;
  if (iban.length < 15 || iban.length > 34) return arabic ? 'رقم IBAN من 15 إلى 34 خانة' : 'An IBAN has 15 to 34 characters';
  if (!checksOut(iban)) return arabic ? 'رقما التحقق لا يطابقان: خانة ما خاطئة' : 'The check digits do not match: a character is wrong';
  return null;
}

const STYLE_ID = 'demo-iban-styles';
function installStyles(document: Document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* An IBAN runs to 34 letters and digits: the box measures itself, and its words get no bigger than fit it whole, in any font. */
.demo-iban { display: grid; gap: 4px; min-width: 0; container-type: inline-size; }
.demo-iban .fd-input { font-variant-numeric: tabular-nums; direction: ltr; text-align: start; text-overflow: ellipsis; font-size: min(1em, calc((100cqi - 26px) / 22)); }
[dir="rtl"] .demo-iban .fd-input { text-align: end; }
.demo-iban-check { margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--fd-muted); }
.demo-iban-check:empty { display: none; }
.demo-iban-check[data-state="ok"] { color: var(--fd-success); }
.demo-iban-check[data-state="wrong"] { color: var(--fd-error); }
`;
  (document.head ?? document.documentElement).append(style);
}

/** The app's widget: a box written in groups of four, and a line under it saying whether it checks out. */
export const ibanWidget: WidgetFactory = ({ form, name, node, id, document, locale }) => {
  installStyles(document);
  const arabic = locale === 'ar';
  const country = typeof node.options?.['country'] === 'string' ? (node.options['country'] as string) : null;
  const input = document.createElement('input');
  Object.assign(input, { id, className: 'fd-input', autocomplete: 'off', spellcheck: false, inputMode: 'text' });
  input.setAttribute('dir', 'ltr');
  input.placeholder = country ? `${country}00 0000 0000 …` : 'DE89 3704 0044 0532 0130 00';
  const check = document.createElement('p');
  check.className = 'demo-iban-check';
  check.id = `${id}-check`;
  check.setAttribute('aria-live', 'polite');
  const element = document.createElement('div');
  element.className = 'demo-iban';
  element.append(input, check);
  let described = '';

  function say(text: string) {
    const problem = text ? ibanProblem(text, country, arabic) : null;
    check.dataset['state'] = !text ? '' : problem ? 'wrong' : 'ok';
    check.textContent = !text ? '' : (problem ?? (arabic ? 'رقم IBAN صحيح' : 'This IBAN checks out'));
    input.setAttribute('aria-invalid', String(!!problem));
    input.setAttribute('aria-describedby', [described, check.id].filter(Boolean).join(' '));
  }
  input.addEventListener('input', () => {
    // Written in groups as it is typed, the caret kept after the same characters.
    const before = compact(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    const shown = grouped(input.value);
    input.value = shown;
    let at = 0;
    for (let seen = 0; at < shown.length && seen < before; at++) if (shown[at] !== ' ') seen++;
    input.setSelectionRange(at, at);
    form.setValue(name, compact(shown) || null);
    say(shown);
  });
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const text = typeof state.value === 'string' ? grouped(state.value) : '';
      if (compact(input.value) !== compact(text)) input.value = text;
      input.readOnly = state.readonly;
      described = state.describedBy ?? '';
      input.setAttribute('aria-required', String(state.required));
      say(input.value);
      if (state.invalid) input.setAttribute('aria-invalid', 'true');
    },
  };
};

/** The country setting: one choice, kept on the field's place on the page as `country`. */
const countrySetting: AppKind['settings'] = ({ document, set }) => {
  const select = document.createElement('select');
  select.className = 'fd-inline-select';
  select.setAttribute('aria-label', 'Country');
  select.append(new Option('Any country', ''), ...Object.entries(COUNTRIES).map(([code, c]) => new Option(`${c.name} (${code})`, code)));
  select.addEventListener('change', () => set({ country: select.value || null }));
  const words = document.createElement('span');
  words.textContent = 'Country';
  const element = document.createElement('label');
  element.className = 'fd-inline-setting';
  element.append(words, select);
  return {
    element,
    refresh(_page, node) {
      select.value = typeof node.options?.['country'] === 'string' ? (node.options['country'] as string) : '';
    },
  };
};

export const IBAN_KIND: AppKind = {
  id: 'iban',
  label: 'IBAN',
  icon: '<path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7"/><path d="M3 20h18"/>',
  field: (label) => ({ type: 'char', label, pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' }),
  settings: countrySetting,
};

/** The app's kinds, and the widgets that draw them, as the demos give them to the designer and the editors. */
export const APP_KINDS: AppKind[] = [IBAN_KIND];
export const APP_WIDGETS: Record<string, WidgetFactory> = { 'char.iban': ibanWidget };
