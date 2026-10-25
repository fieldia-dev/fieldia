import { LINK_URL, safeUrl, labelAt, type Value, intlFormat } from '@fieldia/core';
import { guard, refusalHint } from './input-rules';
import { boxPurpose, describeState, fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { phoneSettings } from './phone-settings';
import { flagOf, phoneCountries, phoneCountry, phoneLinks, phoneParts, readPhone, shownPhone, typedCode, writePhone, type PhoneReading } from './phone-numbers';
import { afterPress } from './press';
import { searchList } from './search-list';
import { installPhoneStyles } from './styles-phone';
import { textRules } from './text-box';
import type { WidgetFactory } from './widgets';

/**
 * A phone number read the world over (`"widget": "phone"` where its page's `phone` or its own options say so; the
 * phone part). Its country is picked before it — its flag and dialling code, from a list of every country found by
 * typing its name in the page's language or in English, its code or its dialling code, the page's country and the
 * reader's first (search-list.ts; the browser's own list where the page or the field says `countries: "native"`) —
 * or typed with it: "+20 10 1234 5678" or "0020…" takes Egypt whatever was
 * picked, and "010 1234 5678" is read in the country picked, which starts as the field's or the page's (never one
 * assumed). The keys are the phone box's own (text-box.ts): a letter is refused, and said why, and the keys after it
 * held with it. Left, or read by a save, the number is checked by its country — its length by how it starts, and
 * whether any number there starts so — and kept as E.164 ("+201012345678"), written back as the page shows numbers
 * ("+20 10 1234 5678", or "010 1234 5678" at home); one that does not read stays as typed, marked, with why — letters
 * held after a refused one are said as letters — and the field keeps what it held, so a save refuses it. At rest a
 * number that reads has a call link beside it, and a WhatsApp link where it may be a mobile (by how its country's
 * mobiles start); one that does not read has none (hidden, never disabled). Read-only, the number and its links alone.
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

  const named = fillIn(words.phoneCountry, { label: labelAt(words.phoneCountry, 'label', form.page.lowerLabels, locale)(label) });
  const dialOf = (code: string) => (phoneCountry(code) as { dial: string }).dial;
  // The browser's own list, where the page or the field asks for it: its options laid over the flag and the code.
  const native = (node.options?.['countries'] ?? form.page.phone?.countries) === 'native';
  const select = native ? make('select', { class: 'fd-phone-select', 'aria-label': named }, make('option', { value: '' }, words.phoneNoCountry)) : null;
  for (const [code, country] of select ? names.sorted : []) select?.append(make('option', { value: code }, `${flagOf(code)} ${country} ⁦+${dialOf(code)}⁩`));
  const flag = make('span', { class: 'fd-phone-flag', 'aria-hidden': 'true' });
  // Its code reads left to right on a right-to-left page too: +20, never 20+.
  const dial = make('span', { class: 'fd-phone-dial', 'aria-hidden': 'true', dir: 'ltr' });
  // Else a button opening Fieldia's own list, named by what it picks for, the country picked said after its name.
  const picker = select ? make('span', { class: 'fd-input fd-phone-country' }, flag, dial, select) : make('button', { type: 'button', class: 'fd-input fd-phone-country', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': named }, flag, dial);
  // What the browser fills it in with: the page's own purpose ("mobile tel"), else a phone, as any phone box.
  const input = make('input', { id, type: 'tel', class: 'fd-input fd-phone-input', dir: 'ltr', ...boxPurpose(node, { autocomplete: 'tel' }) });
  if (node.placeholder) input.placeholder = node.placeholder;
  const call = make('a', { class: 'fd-phone-link fd-phone-call', hidden: '' }, words.phoneCall);
  const chat = make('a', { class: 'fd-phone-link fd-phone-whatsapp', target: '_blank', rel: 'noopener noreferrer', hidden: '' }, words.phoneWhatsApp);
  const links = make('span', { class: 'fd-phone-links' }, call, chat);
  const box = make('span', { class: 'fd-phone-box' }, picker, input);
  const element = make('span', { class: 'fd-phone', 'data-fd-phone': '' }, box, links);
  const hint = refusalHint(input, box);
  const checks = guard(input, textRules('phone', context), hint);
  /** Every country, found by its name here and in English, its code and its dialling code; the field's or the page's and the reader's first. */
  const english = locale === 'en' ? names : countryNames('en');
  const list = select
    ? null
    : searchList({
        make,
        id: `${id}-countries`,
        home: element,
        button: picker,
        rows: names.sorted.map(([code, country]) => ({ value: code, words: country, also: [english.byCode.get(code) ?? code, code], number: dialOf(code), lead: flagOf(code), trail: `+${dialOf(code)}` })),
        first: () => [home, ...readersRegions(doc)].filter((code): code is string => !!code && !!phoneCountry(code)),
        picked: () => picked,
        pick: (code) => {
          choose(code);
          input.focus();
        },
        // Headed "Country" on a phone's sheet — never "Country of Phone" — and named for the field it picks for.
        words: { find: words.phoneFindCountry, list: words.phoneCountries, none: words.phoneNoCountryFound, title: named, heading: words.phoneNoCountry, close: words.close },
      });

  const unreadNow = () => form.getState().unread?.[name];
  /** The country picked, or shown for the number: what a number typed at home's way is read in. */
  let picked: string | null = home;
  /** Typed in since it was last read: no links meanwhile, nor the number's words written over the keys. */
  let typing = false;

  function show(code: string | null) {
    picked = code;
    if (select && select.value !== (code ?? '')) select.value = code ?? '';
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
    // Under the box on a phone: they come and go once a press going on has ended, so a tap below that leaves the box
    // lands where it was aimed (press.ts).
    afterPress(element.ownerDocument, links, () => {
      setHidden(call, !to);
      // WhatsApp only for a number that may be a mobile: a fixed line is called (hidden, never disabled).
      setHidden(chat, !to?.whatsapp);
    });
    if (!to || !number) return;
    const said = writePhone(number, 'international');
    setAttr(call, 'href', safeUrl(to.call, LINK_URL) ?? null);
    setAttr(chat, 'href', safeUrl(to.whatsapp, LINK_URL) ?? null);
    setAttr(call, 'aria-label', fillIn(words.phoneCallNamed, { number: said }));
    setAttr(chat, 'aria-label', fillIn(words.phoneWhatsAppNamed, { number: said }));
  }

  /** Why a number does not read, in the page's words. */
  function why(reading: Exclude<PhoneReading, { number: string }>): string {
    const country = reading.country ? phoneCountry(reading.country) : undefined;
    const where = { label, dial: country ? `+${country.dial}` : '', country: country ? (names.byCode.get(country.code) ?? country.code) : '', start: reading.start ?? '' };
    if (reading.problem === 'letters') return fillIn(words.phoneLetters, where);
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
    const reading = input.value.trim() ? readPhone(input.value, picked) : null;
    // Typed with its + and code, the country follows the number as it comes: +1 876… is Jamaica.
    const code = typedCode(input.value);
    const country = code ? (reading?.country ?? byDial(code.dial)) : undefined;
    if (country && country !== picked) show(country);
    // A number that reads is the field's as it is typed, as a text's and an amount's are: the record has changed — its
    // Save shown — before the box is left, the box keeping what was typed. A part of one, or text held after a refused
    // key, waits for the box to be left, which reads it and says why it does not read; the field holds what it held.
    if (reading && 'number' in reading && !checks.held() && !unreadNow() && form.getState().values[name] !== reading.number) form.setValue(name, reading.number);
  });
  input.addEventListener('change', read);
  input.addEventListener('blur', read);
  // A country picked: a number typed with its + takes that country's code in place of its own; any number is read again in it.
  function choose(country: string | null) {
    show(country);
    const code = typedCode(input.value);
    const now = picked ? phoneCountry(picked) : undefined;
    if (code && now && code.dial !== now.dial) {
      input.value = `+${now.dial} ${code.digits}`;
      checks.accept();
    }
    typing = true;
    read();
  }
  select?.addEventListener('change', () => choose(select.value || null));
  // Another record: its own number's country, or the field's to start with.
  const offOpen = form.on?.('open', () => {
    picked = home;
  });

  return {
    element,
    focus: () => input.focus(),
    destroy() {
      list?.close(false);
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
      if (!select && (picker as HTMLButtonElement).disabled !== state.readonly) (picker as HTMLButtonElement).disabled = state.readonly;
      if (state.readonly) list?.close(false);
      // At rest, a number that reads has its links; one typed, or that does not read, none.
      linksTo(!kept && !typing ? (number?.number ?? null) : null);
      setAttr(input, 'aria-required', String(state.required));
      describeState(input, { invalid: state.invalid || !!kept, describedBy: hint.describedBy(state.describedBy) });
    },
  };
};

/** The country a dialling code is first: Egypt for 20, the United States for 1. */
const byDial = (dial: string): string | undefined => phoneCountries().find((country) => country.dial === dial)?.code;

/**
 * The countries of the reader's languages, as their browser lists them ("en-GB", "ar-EG"): each one's region, else the
 * region its language is most spoken in. Put first in a list of countries, never picked for them.
 */
function readersRegions(doc: Document): string[] {
  const nav = doc.defaultView?.navigator;
  const tags = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  const regions: string[] = [];
  for (const tag of tags) {
    try {
      const at = new Intl.Locale(tag);
      const region = at.region ?? (regions.length ? undefined : at.maximize().region);
      if (region && !regions.includes(region)) regions.push(region);
    } catch {
      // A tag the engine does not read puts nothing first.
    }
  }
  return regions;
}

const named = new Map<string, { sorted: [string, string][]; byCode: Map<string, string> }>();
/** Every country the table knows, by its name in the page's language, in that language's order. */
function countryNames(locale: string) {
  let found = named.get(locale);
  if (!found) {
    let names: Intl.DisplayNames | undefined;
    try {
      names = intlFormat('DisplayNames', [locale], { type: 'region', fallback: 'code' });
    } catch {
      names = undefined;
    }
    const sorted = phoneCountries().map(({ code }): [string, string] => [code, names?.of(code) ?? code]);
    sorted.sort((a, b) => intlFormat('Collator', locale).compare(a[1], b[1]));
    found = { sorted, byCode: new Map(sorted) };
    named.set(locale, found);
  }
  return found;
}
