import type { Value } from '@fieldia/core';
import { guard, refusalHint } from './input-rules';
import { describeState, fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { phoneSettings } from './phone-settings';
import { flagOf, phoneCountries, phoneCountry, phoneLinks, phoneParts, readPhone, shownPhone, typedCode, writePhone, type PhoneReading } from './phone-numbers';
import { installPhoneStyles } from './styles-phone';
import { textRules } from './text-box';
import type { WidgetFactory } from './widgets';

/**
 * A phone number read the world over (`"widget": "phone"` where its page's `phone` or its own options say so; the
 * phone part). Its country is picked before it — its flag and dialling code, the browser's own list of every country
 * by its name in the page's language — or typed with it: "+20 10 1234 5678" or "0020…" takes Egypt whatever was
 * picked, and "010 1234 5678" is read in the country picked, which starts as the field's or the page's (never one
 * assumed). The keys are the phone box's own (text-box.ts): a letter is refused, and said why, and the keys after it
 * held with it. Left, or read by a save, the number is checked by its country — its length by how it starts, and
 * whether any number there starts so — and kept as E.164 ("+201012345678"), written back as the page shows numbers
 * ("+20 10 1234 5678", or "010 1234 5678" at home); one that does not read stays as typed, marked, with why, and the
 * field keeps what it held, so a save refuses it. At rest a number that reads has a call link and a WhatsApp link
 * beside it; one that does not has none (hidden, never disabled). Read-only, the number and its links alone.
 */
export const phoneWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document: doc, labels, locale = 'en' } = context;
  installPhoneStyles(doc);
  const make = maker(doc);
  const words = wordsFor(labels, locale);
  const label = node.label ?? field.label;
  const settings = phoneSettings(form.page, node.options) ?? { country: null, shown: 'international' as const };
  /** The country a number typed at home's way is read in, when none is picked: the field's or the page's, if the table knows it. */
  const home = phoneCountry(settings.country)?.code ?? null;
  const names = countryNames(locale);

  const select = make('select', { class: 'fd-phone-select', 'aria-label': fillIn(words.phoneCountry, { label }) }, make('option', { value: '' }, words.phoneNoCountry));
  for (const [code, country] of names.sorted) select.append(make('option', { value: code }, `${flagOf(code)} ${country} ⁦+${(phoneCountry(code) as { dial: string }).dial}⁩`));
  const flag = make('span', { class: 'fd-phone-flag', 'aria-hidden': 'true' });
  // Its code reads left to right on a right-to-left page too: +20, never 20+.
  const dial = make('span', { class: 'fd-phone-dial', 'aria-hidden': 'true', dir: 'ltr' });
  const picker = make('span', { class: 'fd-input fd-phone-country' }, flag, dial, select);
  const input = make('input', { id, type: 'tel', class: 'fd-input fd-phone-input', autocomplete: 'tel', dir: 'ltr' });
  if (node.placeholder) input.placeholder = node.placeholder;
  const call = make('a', { class: 'fd-phone-link fd-phone-call', hidden: '' }, words.phoneCall);
  const chat = make('a', { class: 'fd-phone-link fd-phone-whatsapp', target: '_blank', rel: 'noopener noreferrer', hidden: '' }, words.phoneWhatsApp);
  const links = make('span', { class: 'fd-phone-links' }, call, chat);
  const box = make('span', { class: 'fd-phone-box' }, picker, input);
  const element = make('span', { class: 'fd-phone', 'data-fd-phone': '' }, box, links);
  const hint = refusalHint(input, box);
  const checks = guard(input, textRules('phone', context), hint);

  const unreadNow = () => form.getState().unread?.[name];
  /** The country picked, or shown for the number: what a number typed at home's way is read in. */
  let picked: string | null = home;
  /** Typed in since it was last read: no links meanwhile, nor the number's words written over the keys. */
  let typing = false;

  function show(code: string | null) {
    picked = code;
    if (select.value !== (code ?? '')) select.value = code ?? '';
    setText(flag, code ? flagOf(code) : '');
    setText(dial, code ? `+${(phoneCountry(code) as { dial: string }).dial}` : words.phoneNoCountry);
    setAttr(picker, 'data-empty', code ? null : '');
    setAttr(picker, 'title', code ? (names.byCode.get(code) ?? code) : null);
    drawDial();
  }
  /** The dialling code beside the flag, unless the number written in the box says it ("+971 50…"): its flag alone then. */
  const drawDial = () => setHidden(dial, !!picked && typedCode(input.value) !== undefined);

  /** A number the field holds, read: E.164 as it is, or one kept another way (an older record's) read in the home country. */
  const numberOf = (value: Value | undefined): { number: string; country: string } | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parts = phoneParts(value);
    if (parts) return { number: value, country: parts.country };
    const reading = readPhone(value, home);
    return 'number' in reading ? reading : null;
  };
  /** A number as the page shows it at rest; text that is no number as it is. */
  const atRest = (value: Value | undefined) => (typeof value === 'string' ? shownPhone(value, settings.shown, home) : '');

  function linksTo(number: string | null) {
    const to = number ? phoneLinks(number) : undefined;
    setHidden(call, !to);
    setHidden(chat, !to);
    if (!to || !number) return;
    const said = writePhone(number, 'international');
    setAttr(call, 'href', to.call);
    setAttr(chat, 'href', to.whatsapp);
    setAttr(call, 'aria-label', fillIn(words.phoneCallNamed, { number: said }));
    setAttr(chat, 'aria-label', fillIn(words.phoneWhatsAppNamed, { number: said }));
  }

  /** Why a number does not read, in the page's words. */
  function why(reading: Exclude<PhoneReading, { number: string }>): string {
    const country = reading.country ? phoneCountry(reading.country) : undefined;
    const where = { label, dial: country ? `+${country.dial}` : '', country: country ? (names.byCode.get(country.code) ?? country.code) : '', start: reading.start ?? '' };
    if (reading.problem === 'country') return fillIn(words.phoneNeedsCountry, where);
    if (reading.problem === 'code' || !country) return fillIn(words.phoneNoCode, { label, code: reading.start ?? '+' });
    return fillIn(reading.problem === 'short' ? words.phoneShort : reading.problem === 'long' ? words.phoneLong : words.phoneStart, where);
  }

  /**
   * What is typed, read — as the box is left, or a save reads it first (a change): kept as E.164 and written back as
   * the page shows numbers, or left as typed, marked, with why, the field keeping what it held.
   */
  function read() {
    // Nothing typed since it was last read (entered and left, say): the field keeps what it holds, and the box shows it.
    if (input.readOnly || (!typing && !checks.held())) return;
    // Keys held after a refused one are part of what was typed: the box's now, and the field's words take over from the hint.
    const held = checks.held();
    if (held) {
      hint.hide();
      input.value = held.text;
      checks.accept();
    }
    typing = false;
    const text = input.value;
    if (!text.trim()) {
      if (unreadNow()) form.setUnread(name, null);
      if (form.getState().values[name] !== null && form.getState().values[name] !== undefined) form.setValue(name, null);
      return linksTo(null);
    }
    const reading = readPhone(text, picked);
    if ('number' in reading) {
      if (unreadNow()) form.setUnread(name, null);
      if (form.getState().values[name] !== reading.number) form.setValue(name, reading.number);
      show(reading.country);
      const shown = writePhone(reading.number, settings.shown, home);
      if (input.value !== shown) {
        input.value = shown;
        checks.accept();
      }
      drawDial();
      return linksTo(reading.number);
    }
    if (reading.country) show(reading.country);
    form.setUnread(name, { text, message: why(reading) });
    linksTo(null);
  }

  input.addEventListener('input', () => {
    typing = true;
    linksTo(null);
    drawDial();
    // Typed with its + and code, the country follows the number as it comes: +1 876… is Jamaica.
    const code = typedCode(input.value);
    if (!code) return;
    const reading = readPhone(input.value, picked);
    const country = reading.country ?? byDial(code.dial);
    if (country && country !== picked) show(country);
  });
  input.addEventListener('change', read);
  input.addEventListener('blur', read);
  // A country picked: a number typed with its + takes that country's code in place of its own; any number is read again in it.
  select.addEventListener('change', () => {
    show(select.value || null);
    const code = typedCode(input.value);
    const now = picked ? phoneCountry(picked) : undefined;
    if (code && now && code.dial !== now.dial) {
      input.value = `+${now.dial} ${code.digits}`;
      checks.accept();
    }
    typing = true;
    read();
  });
  // Another record: its own number's country, or the field's to start with.
  const offOpen = form.on?.('open', () => {
    picked = home;
  });

  return {
    element,
    focus: () => input.focus(),
    destroy() {
      checks.destroy();
      offOpen?.();
    },
    update(state) {
      const kept = unreadNow();
      const number = numberOf(state.value);
      // What is being typed stays as typed.
      if (doc.activeElement !== input && !typing) {
        const text = kept ? kept.text : atRest(state.value);
        if (input.value !== text) {
          input.value = text;
          checks.accept();
        }
        if (!kept) show(number?.country ?? picked);
      }
      drawDial();
      setAttr(element, 'data-readonly', state.readonly ? '' : null);
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      // At rest, a number that reads has its links; one typed, or that does not read, none.
      linksTo(!kept && !typing ? (number?.number ?? null) : null);
      setAttr(input, 'aria-required', String(state.required));
      describeState(input, { invalid: state.invalid || !!kept, describedBy: hint.describedBy(state.describedBy) });
    },
  };
};

/** The country a dialling code is first: Egypt for 20, the United States for 1. */
const byDial = (dial: string): string | undefined => phoneCountries().find((country) => country.dial === dial)?.code;

const named = new Map<string, { sorted: [string, string][]; byCode: Map<string, string> }>();
/** Every country the table knows, by its name in the page's language, in that language's order. */
function countryNames(locale: string) {
  let found = named.get(locale);
  if (!found) {
    let names: Intl.DisplayNames | undefined;
    try {
      names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' });
    } catch {
      names = undefined;
    }
    const sorted = phoneCountries().map(({ code }): [string, string] => [code, names?.of(code) ?? code]);
    sorted.sort((a, b) => a[1].localeCompare(b[1], locale));
    found = { sorted, byCode: new Map(sorted) };
    named.set(locale, found);
  }
  return found;
}
