import type { Option } from '../format/field';
import type { Page } from '../format/page';
import { choiceOptions, optionsField, optionsList } from '../format/choice-options';
import type { DataSource, LimitsResult, SaveProblem } from './data-source';
import type { FormState, FormUser } from './form';
import { fill, type Messages } from './messages';
import type { Stopped } from './run';
import type { Scheduler } from './scheduler';
import { countsAsked, dayAlone, limitInstant, seatedFields, type FormLimits, type Seats, type TakingState } from './taking';
import { dayWords } from './day-words';
import { isOwnZone, wallClock, wallDay, wallTime } from './zones';
import type { DateOrder } from './input-rules';
import type { Value } from './values';

/**
 * A form's limits (the limits part): when the page takes answers and each choice's places, worked out from the page,
 * the form's clock and the data source's counts — asked as it opens, again before its answers go and after — a full
 * choice refused when picked or held. A form on a page with `limits` or options with `seats` (or an app's list whose
 * options come with them) makes this from the part as it comes (form.ts, `limitsCode`); before, it takes answers as a
 * page without limits does, and a save waits for it.
 */

/** What the limits ask of the form they are made for. */
export interface LimitsHost {
  readonly page: Page;
  readonly dataSource: DataSource | undefined;
  readonly user: FormUser | undefined;
  readonly messages: Messages;
  readonly scheduler: Scheduler;
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** Now, in ms, by the form's clock. */
  clock(): number;
  /** Whether the form has its state yet: a list's choices are read from it once it has. */
  started(): boolean;
  /** Whether what is asked now still lands on the record shown, when it answers. */
  shownNow(): () => boolean;
  /** The record shown's generation: another shown since a save started, it is told so. */
  generation(): number;
  /** The words a save says when another record was shown since it started. */
  replaced(): string;
  /** Whether something listens to the form: a page left open is told as it opens or closes then. */
  listened(): boolean;
  disposed(): boolean;
  /** Words said under a field until it changes from what it holds, as a refused save's are. */
  refuse(name: string, message: string): void;
}

/** A form's limits, made for it (`formLimits`). */
export interface Limits {
  /** The limits shown as they are now, and the next moment they change of themselves awaited. */
  show(): void;
  /** Ask the source's `limits` again and show what it tells, on the record it was asked for. */
  ask(): Promise<void>;
  /** Whether the form asks the source for counts: a source that tells them, and something to count. */
  asks(): boolean;
  /** Whether the counts of a choice of an app's list whose options came with places were never told. */
  uncounted(name: string): boolean;
  /** Whether the page takes these answers now, asked of the source again: why not, as a save's problem, or null. */
  stillTaking(asked: number): Promise<Stopped | null>;
  /** A choice of a full option, picked by the person, refused under its field: the field keeps what it held. */
  refusedFull(name: string, value: Value): boolean;
  /** A choice held whose places filled up since it was picked, said under it: never sent. */
  fullErrors(seen: ReadonlySet<string>, errors: Readonly<Record<string, string>>): Record<string, string>;
  /** Something listens now, or no longer does: the timer for the page opening or closing kept, or let go. */
  heard(listening: boolean): void;
  dispose(): void;
}

/** What a form tells of its limits now: from the page, the clock, the options it shows and the source's last answer. */
export function limitsNow(
  page: Page,
  now: number,
  told: LimitsResult | null,
  asking: boolean,
  optionsOf: (field: string) => readonly Option[]
): FormLimits | null {
  const limits = page.data.kind === 'responses' ? page.limits : undefined;
  const seats: Record<string, Record<string, Seats>> = {};
  for (const [field, counted] of Object.entries(told?.perChoice ?? {})) {
    const places: Record<string, Seats> = {};
    for (const option of optionsOf(field)) {
      if (option.seats === undefined) continue;
      const taken = Math.max(0, Number(counted?.[String(option.value)] ?? 0) || 0);
      places[String(option.value)] = { seats: option.seats, taken, left: Math.max(0, option.seats - taken) };
    }
    if (Object.keys(places).length) seats[field] = places;
  }
  if (!limits && !Object.keys(seats).length) return null;
  const opens = limits?.opens ? limitInstant(limits.opens, page.timeZone) : null;
  const closes = limits?.closes ? limitInstant(limits.closes, page.timeZone, true) : null;
  const max = limits?.maxResponses;
  const responses = told?.responses;
  const left = max !== undefined && typeof responses === 'number' ? Math.max(0, max - responses) : undefined;
  const state: TakingState =
    opens !== null && now < opens ? 'soon'
    : closes !== null && now >= closes ? 'closed'
    : asking ? 'asking'
    : left === 0 ? 'full'
    : limits?.onePerPerson && (told?.mine ?? 0) >= 1 ? 'sent'
    : 'open';
  return {
    state,
    ...(opens !== null ? { opens: new Date(opens).toISOString() } : {}),
    ...(closes !== null ? { closes: new Date(closes).toISOString() } : {}),
    ...(limits?.message ? { message: limits.message } : {}),
    ...(left !== undefined ? { left } : {}),
    seats,
  };
}

/** The values a choice holds: one, several (a choice of many), or none. */
const chosenOf = (value: Value | undefined): unknown[] => (Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]);

/**
 * The options of a choice's value that are full now, in the order they are held: those `before` held too left out
 * when given — a choice made now, not one held already.
 */
export function fullChosen(field: Page['fields'][string] | undefined, places: Readonly<Record<string, Seats>> | undefined, value: Value | undefined, before?: Value | undefined): Option[] {
  if (!places || field?.type !== 'selection') return [];
  const held = new Set(chosenOf(before).map(String));
  return chosenOf(value)
    .filter((one) => !(before !== undefined && held.has(String(one))) && places[String(one)]?.left === 0)
    .map((one) => (field.options ?? []).find((option) => String(option.value) === String(one)) ?? { value: String(one), label: String(one) });
}

/** A form's limits: what it tells of them, and what it asks and refuses by them. */
export function formLimits(host: LimitsHost): Limits {
  const { page, scheduler, messages } = host;
  /** The source's last answer to `limits`: null until it told. */
  let counted: LimitsResult | null = null;
  let timer: unknown = null;
  /** The choice fields whose own options have places. */
  const seated = seatedFields(page);
  /** A choice's options as shown: its own, or its app's list's once loaded. */
  const optionsOf = (name: string): readonly Option[] => {
    const def = page.fields[name];
    if (def?.type !== 'selection') return [];
    if (optionsList(def.optionsFrom)) return (host.started() ? host.state().choices[name]?.options : null) ?? [];
    // Carried from an earlier question: its options, and the choice's own after them.
    return optionsField(def.optionsFrom) ? choiceOptions(page.fields, name) : (def.options ?? []);
  };
  /** The choice fields with places now: those of the page's own, and of the app's lists whose options loaded with them. */
  const seatedNow = () => [...seated, ...Object.keys(host.started() ? host.state().choices : {}).filter((name) => !seated.includes(name) && optionsOf(name).some((option) => option.seats !== undefined))];
  const asks = () => !!host.dataSource?.limits && (countsAsked(page) || seatedNow().length > 0);
  /** The page's counts asked as it opens and not told yet: nothing is typed meanwhile. */
  let askingFirst = asks() && countsAsked(page);
  const limitsHere = (): FormLimits | null => limitsNow(page, host.clock(), counted, askingFirst, optionsOf);

  function show() {
    const limits = limitsHere();
    if (JSON.stringify(limits) !== JSON.stringify(host.state().limits ?? null)) host.set({ limits });
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
    const next = [limits?.opens, limits?.closes].map((at) => (at ? Date.parse(at) - host.clock() : -1)).filter((ms) => ms > 0).sort((a, b) => a - b)[0];
    // Within the longest wait a timer keeps (24 days), while something listens: a page left open as it opens or closes
    // says so then. (A form no one listens to keeps no timer that would hold a process open.)
    if (next !== undefined && next < 2 ** 31 - 1 && !host.disposed() && host.listened()) timer = scheduler.setTimeout(show, next + 50);
  }

  async function ask(): Promise<void> {
    const source = host.dataSource;
    if (!asks() || !source?.limits) return show();
    const shown = host.shownNow();
    const user = host.user ? { user: { id: host.user.id, ...(host.user.name ? { name: host.user.name } : {}) } } : {};
    // A source that never answers keeps no one from the questions for long: past 10 seconds they show, and its submit decides.
    const waited = askingFirst
      ? scheduler.setTimeout(() => {
          if (!askingFirst || !shown()) return;
          askingFirst = false;
          show();
        }, 10000)
      : null;
    try {
      const told = await source.limits({ pageId: page.id, model: page.data.kind === 'record' ? page.data.model : '', recordId: host.state().recordId, fields: seatedNow(), ...user });
      if (!shown()) return;
      counted = told ?? {};
    } catch {
      // Not told: the page keeps to its dates alone, and the source's submit refuses as it would.
      if (!shown()) return;
    } finally {
      if (waited !== null) scheduler.clearTimeout(waited);
    }
    askingFirst = false;
    show();
  }

  return {
    show,
    ask,
    asks,
    uncounted: (name) => !counted?.perChoice?.[name],
    async stillTaking(asked) {
      if (!page.limits && !seatedNow().length) return null;
      await ask();
      if (asked !== host.generation()) return { reason: 'save', message: host.replaced() };
      const limits = limitsHere();
      const why = limits && limits.state !== 'open' && limits.state !== 'asking' ? takingWords(page, limits, messages) : null;
      if (!why) return null;
      const problem: SaveProblem = { kind: 'rule', message: why };
      host.set({ status: 'error', error: why, saveProblem: problem, conflict: null, limits });
      return { reason: 'save', message: why };
    },
    refusedFull(name, value) {
      const state = host.state();
      const full = fullChosen(page.fields[name], state.limits?.seats[name], value, state.values[name]);
      if (!full.length) return false;
      host.refuse(name, fill(messages.choiceFull, { option: full.map((option) => option.label).join(', ') }));
      return true;
    },
    fullErrors(seen, errors) {
      const state = host.state();
      const found: Record<string, string> = {};
      for (const [name, places] of Object.entries(state.limits?.seats ?? {})) {
        const full = seen.has(name) && !errors[name] ? fullChosen(page.fields[name], places, state.values[name]) : [];
        if (full.length) found[name] = fill(messages.choiceFilled, { option: full.map((option) => option.label).join(', ') });
      }
      return found;
    },
    heard(listening) {
      if (listening) {
        const limits = host.state().limits;
        if (timer === null && (limits?.opens || limits?.closes)) show();
        return;
      }
      if (timer === null) return;
      scheduler.clearTimeout(timer);
      timer = null;
    },
    dispose() {
      if (timer !== null) scheduler.clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * A day or a day and a time in words, as the page's date boxes write one (`dayWords`): in its order (`order`, the
 * page's `look.dateOrder`, else the messages'), its language, on its clock — "20 Nov 2026", "1 Nov 2026, 09:00" — with
 * the zone's short name where it is not the browser's own ("09:00 EET").
 */
export function whenWords(written: string, at: number, messages: Messages, zone?: string, order: DateOrder = messages.dateOrder ?? 'dmy'): string {
  if (dayAlone(written)) return dayWords(written.slice(0, 10), messages, order);
  const wall = wallTime(at, zone);
  const words = `${dayWords(wallDay(wall), messages, order)}${order === 'ymd' ? ' ' : ', '}${wallClock(wall)}`;
  if (!zone || isOwnZone(zone)) return words;
  const name = new Intl.DateTimeFormat(messages.locale === 'en' ? 'en-GB' : messages.locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(at).find((part) => part.type === 'timeZoneName')?.value;
  return name ? `${words} ${name}` : words;
}

/**
 * Why a page takes no answers now, in the messages' words — "This form opens on 1 November 2026 at 09:00.", "This form
 * closed on 20 November 2026.", "This form has all the responses it takes.", "You have sent your answers to this form
 * already." — or null while it takes them (or still asks).
 */
/** The order a page writes its days in: its own `look.dateOrder`, else its messages'. */
const orderOf = (page: Page, messages: Messages): DateOrder | undefined => {
  const own: unknown = page.look?.dateOrder;
  return own === 'dmy' || own === 'mdy' || own === 'ymd' ? own : messages.dateOrder;
};

export function takingWords(page: Page, limits: FormLimits | null | undefined, messages: Messages): string | null {
  const written = page.limits;
  switch (limits?.state) {
    case 'soon':
      return written?.opens && limits.opens ? fill(messages.formOpens, { when: whenWords(written.opens, Date.parse(limits.opens), messages, page.timeZone, orderOf(page, messages)) }) : null;
    case 'closed':
      return written?.closes && limits.closes ? fill(messages.formClosed, { when: whenWords(written.closes, Date.parse(limits.closes), messages, page.timeZone, orderOf(page, messages)) }) : null;
    case 'full':
      return messages.formFull;
    case 'sent':
      return messages.formSent;
    default:
      return null;
  }
}
