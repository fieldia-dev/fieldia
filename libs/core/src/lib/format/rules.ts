import { isTimeZone } from '../record/zones';
import { LOADING_DEFAULTS } from './loading';

/**
 * The format's rules a JSON Schema cannot say — a condition's value given once, a time limit's warning before its end,
 * a widget's own options by the widget it names — written once, with no validation library: the zod definitions run
 * them (`ruled`, ruled.ts) as `validatePage` checks a page, and the viewer's check runs the very same functions on the
 * format's schema (shape-check.ts), so the two refuse alike. Each rule is given a value whose shape held, and says each
 * problem at its path under the value.
 */

/** What a rule says a problem with, and the shapes it checks a part against. */
export interface RuleContext {
  /** A problem, at `path` under the value the rule is given. */
  say(message: string, path?: (string | number)[]): void;
  /** A part of the value checked against one of the format's shapes for a widget's options, its problems under `path`. */
  check(shape: OptionShape, value: unknown, path: (string | number)[]): void;
}

/** The shapes of a widget's own options, as the format names them. */
export type OptionShape =
  | 'PickerOptions'
  | 'PathPickerOptions'
  | 'StateDotOptions'
  | 'CheckTreeOptions'
  | 'PhoneOptions'
  | 'SlotsOptions'
  | 'SignatureOptions'
  | 'PhotosOptions'
  | 'ScanSettings'
  | 'ScanOption'
  | 'OneTimeCodeOptions'
  | 'MaskOptions'
  | 'ShorthandOptions'
  | 'RecordOptions'
  | 'CodeOptions'
  | 'PinsOptions'
  | 'PageLoading'
  | 'AddressSearchOptions';

type Json = Record<string, unknown>;
type Rule<T> = (value: T, context: RuleContext) => void;
const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

const COUNTRY = /^[A-Z]{2}$/;
const ASPECT = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const SEVERAL = 'the fewest and the most files are for a field of several files: set multiple';
const ANSWER_ASKS = ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'date', 'distinct', 'holds'];

/** A widget's own options, where the format knows them, each against its shape: a scan's, a mask's, an address's. */
function widgetOptions(node: { widget?: string; options?: Json }, c: RuleContext) {
  const options = node.options ?? {};
  const widget = node.widget;
  // Any picker's: Fieldia's own list, tags added from a button.
  c.check('PickerOptions', options, ['options']);
  if (widget === 'path') c.check('PathPickerOptions', options, ['options']);
  if (widget === 'dot') c.check('StateDotOptions', options, ['options']);
  if (widget === 'tree') c.check('CheckTreeOptions', options, ['options']);
  if (widget === 'phone') c.check('PhoneOptions', options, ['options']);
  if (widget === 'slots') c.check('SlotsOptions', options, ['options']);
  if (widget === 'signature') c.check('SignatureOptions', options, ['options']);
  if (widget === 'photos') c.check('PhotosOptions', options, ['options']);
  scanOptions(options, c);
  if (widget === 'one-time-code') c.check('OneTimeCodeOptions', options, ['options']);
  if ('mask' in options || 'maskKeeps' in options) c.check('MaskOptions', options, ['options']);
  if ('shorthand' in options) c.check('ShorthandOptions', options, ['options']);
  if (options['record'] !== undefined || options['maxSeconds'] !== undefined) c.check('RecordOptions', { record: options['record'], maxSeconds: options['maxSeconds'] }, ['options']);
  if (widget === 'qrcode' || widget === 'barcode') {
    c.check('CodeOptions', options, ['options']);
    if (widget === 'barcode' && options['level'] !== undefined) c.say('level is a QR code\'s error correction: a barcode has none', ['options', 'level']);
  }
  if (widget === 'pins') {
    c.check('PinsOptions', options, ['options']);
    // A picture of its own or a field's, never both: with neither, the field says it has no picture yet.
    if (options['image'] !== undefined && options['imageField'] !== undefined) c.say('pins are placed on one picture: its address (image) or the field holding it (imageField), not both', ['options', 'imageField']);
  }
  if (options['loading'] !== undefined) c.check('PageLoading', options['loading'], ['options', 'loading']);
  if (widget === 'address-search') c.check('AddressSearchOptions', options, ['options']);
}

/** `options.scan`: true for a Scan button as the field is, or its settings — checked as settings, said where it is wrong. */
function scanOptions(options: Json, c: RuleContext) {
  const scan = options['scan'];
  if (scan === undefined) return;
  c.check(isObject(scan) ? 'ScanSettings' : 'ScanOption', scan, ['options', 'scan']);
}

/** The rules, by name: what the zod definitions run (`ruled`) and the viewer's check runs where the schema says (`x-rule`). */
export const RULES = {
  /** An address's countries written as one text: ISO codes in capitals, by commas. */
  countryCodes: ((codes, c) => {
    if (!codes.split(',').every((code) => COUNTRY.test(code.trim()))) c.say('countries are ISO codes in capitals, such as ["EG", "SA"] or "EG,SA"');
  }) as Rule<string>,

  /** A filter's condition: one value or a field to read it from (none for set and notset); between's two; within's area. */
  filterCondition: ((condition, c) => {
    const given = condition.value !== undefined;
    const from = condition.valueFrom !== undefined;
    if (!(condition.op === 'set' || condition.op === 'notset' ? !given && !from : given !== from)) c.say('set exactly one of value or valueFrom; set and notset take neither');
    if (!(condition.op !== 'between' || from || (Array.isArray(condition.value) && condition.value.length === 2))) c.say('between takes value: [low, high]');
    if (!withinArea(condition)) {
      c.say(
        'within takes value: a box { south, west, north, east }, a { polygon: [[longitude, latitude], …] } or a { center: [longitude, latitude], radius } in metres, all in degrees; with longitude: "a field" when the field is a latitude'
      );
    }
  }) as Rule<{ op: string; value?: unknown; valueFrom?: string }>,

  /** A value set when a condition starts to hold, or when a field it is on changes. */
  setWhen: ((rule, c) => {
    if (rule.when === undefined && rule.on === undefined) c.say('a value is set when a condition starts to hold, or when a field it is on changes: give when, on or both');
  }) as Rule<{ when?: string; on?: string[] }>,

  /** A text in several languages: each language once; `requiredIn` only with `translate`, each of its own. */
  languages: ((field, c) => {
    const same = (tags: string[]) => tags.find((tag, i) => tags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) !== i);
    const twice = same(field.translate ?? []);
    if (twice) c.say(`"${twice}" is named twice: each language once`, ['translate']);
    if (field.requiredIn === undefined) return;
    if (field.translate === undefined) c.say('requiredIn says which of a text’s languages are required: name them in translate', ['requiredIn']);
    else
      field.requiredIn.forEach((tag, i) => {
        if (!field.translate?.some((own) => own.toLowerCase() === tag.toLowerCase())) c.say(`"${tag}" is not one of the languages it is kept in (translate)`, ['requiredIn', i]);
      });
  }) as Rule<{ translate?: string[]; requiredIn?: string[] }>,

  /** A date of a month or a year alone has no days of the week, and no Hijri day. */
  dateField: ((field, c) => {
    if (field.precision && field.days) c.say('the days of the week a date may fall on are a day’s: a month or a year has them all', ['days']);
    if (field.precision && field.hijri) c.say('a Hijri date is a day: a month or a year alone is the Gregorian calendar’s', ['hijri']);
  }) as Rule<{ precision?: string; days?: unknown; hijri?: boolean }>,

  /** A time zone the IANA names. */
  timeZone: ((name, c) => {
    if (!isTimeZone(name)) c.say('not a time zone the IANA names: "Africa/Cairo", "Europe/Berlin", "UTC"');
  }) as Rule<string>,

  /** A choice's options: written in the page, from a list of the app's, or carried from an earlier question. */
  choiceOptions: ((field, c) => {
    if (!(field.options.length > 0 || field.optionsFrom !== undefined)) c.say('a choice needs its options, a list of the app’s to take them from, or an earlier question to carry them from', ['options']);
  }) as Rule<{ options: unknown[]; optionsFrom?: unknown }>,

  /** A choice in a table's lines: its options, or a list of the app's. */
  lineChoiceOptions: ((field, c) => {
    if (!(field.options.length > 0 || field.optionsFrom !== undefined)) c.say('a choice needs its options, or a list of the app’s to take them from', ['options']);
  }) as Rule<{ options: unknown[]; optionsFrom?: unknown }>,

  /** The fewest and the most files only with several files, the fewest no more than the most. */
  fileRules: ((field, c) => {
    for (const key of ['minFiles', 'maxFiles'] as const) if (field[key] !== undefined && field.multiple !== true) c.say(SEVERAL, [key]);
    if (field.minFiles !== undefined && field.maxFiles !== undefined && field.minFiles > field.maxFiles) c.say('the fewest files cannot be more than the most', ['minFiles']);
  }) as Rule<{ multiple?: boolean; minFiles?: number; maxFiles?: number }>,

  /** A time limit's warning comes before its end. */
  timeLimit: ((limit, c) => {
    if (!(limit.warn === undefined || limit.warn < limit.minutes)) c.say('warn comes before the end: fewer minutes than the limit', ['warn']);
  }) as Rule<{ minutes: number; warn?: number }>,

  /** A wait that ends after its loader could show, and says "Still loading…" before it ends. */
  loading: ((loading, c) => {
    // A wait that ends before anything could be said of it fails every slow answer unseen.
    if (loading.timeout !== undefined && loading.timeout <= (loading.delay ?? LOADING_DEFAULTS.delay)) {
      c.say(`a timeout ends the wait as failed: make it longer than the delay before a loader shows (${loading.delay ?? LOADING_DEFAULTS.delay} ms)`, ['timeout']);
    }
    if (loading.timeout !== undefined && loading.slowAfter !== undefined && loading.slowAfter >= loading.timeout) {
      c.say(`"Still loading…" is said before the wait ends: make slowAfter shorter than the timeout (${loading.timeout} ms)`, ['slowAfter']);
    }
  }) as Rule<{ timeout?: number; delay?: number; slowAfter?: number }>,

  /** A photo's crop shape: its width and its height, no longer than five to one either way. */
  aspect: ((text, c) => {
    const [, width, height] = ASPECT.exec(text) ?? [];
    const ratio = Number(width) / Number(height);
    if (!(ratio >= 0.2 && ratio <= 5)) c.say('aspect is a shape, its width and its height: "4:3", "16:9", "1:1" — no longer than five to one either way');
  }) as Rule<string>,

  /** A mask names what goes in it, and what may be left out is its end. */
  mask: ((pattern, c) => {
    const plain = pattern.replace(/\\./g, '');
    if (!/[9a*]/.test(plain)) c.say('a mask names what goes in it: 9 a digit, a a letter, * either');
    if (!/^[^[\]]*(\[[^[\]]*\][^[\]9a*]*)?$/.test(plain)) c.say('what may be left out is the end of a mask, in [ ]: "aa99 **** [****]"');
  }) as Rule<string>,

  /** A column scanned into (`options.scan`): its settings' shape, as a field's. */
  cellRules: ((rules, c) => scanOptions(rules.options ?? {}, c)) as Rule<{ options?: Json }>,

  /** An answer rule asks for something. */
  answerRule: ((rule, c) => {
    if (!ANSWER_ASKS.some((key) => rule[key] !== undefined)) c.say('an answer rule asks for something: a length, a pattern, an ending, a range, a count, a date, a column with no value twice or an expression that holds');
  }) as Rule<Json>,

  /** A field's widget's own options. */
  fieldNode: ((node, c) => widgetOptions(node, c)) as Rule<{ widget?: string; options?: Json }>,

  /** A fence is an area field or a reachable area of the map, one of the two. */
  mapFence: ((fence, c) => {
    if ((fence.area === undefined) === (fence.within === undefined)) c.say('a fence is an area field (`area`) or a reachable area of the map (`within`), one of the two');
  }) as Rule<{ area?: string; within?: string }>,

  /** A row's details: its lines, or the records pointing at it, with their model, link and fields. */
  listDetail: ((detail, c) => {
    if ((detail.lines !== undefined) === (detail.model !== undefined || detail.field !== undefined || detail.fields !== undefined)) c.say('a row opens to its lines (lines), or to the records pointing at it (model, field and fields): one of them');
    if (!(detail.lines !== undefined || (detail.model !== undefined && detail.field !== undefined && detail.fields !== undefined))) c.say('the records a row opens to need their model, their link to it (field) and their fields');
  }) as Rule<{ lines?: string; model?: string; field?: string; fields?: unknown }>,

  /** A list's named filter holds conditions, a period or both. */
  namedFilter: ((named, c) => {
    if (named.filter === undefined && named.period === undefined) c.say('a filter holds conditions (filter), a period (period) or both');
  }) as Rule<{ filter?: unknown; period?: unknown }>,
};

export type RuleName = keyof typeof RULES;

/** A place inside a box on the map, as a map's "In this area" asks: a box, a polygon, or a centre and a radius. */
function withinArea(condition: { op: string; value?: unknown; valueFrom?: string }): boolean {
  if (condition.op !== 'within' || condition.valueFrom !== undefined) return true;
  const area = condition.value as Json | undefined;
  if (!isObject(area)) return false;
  if (area['longitude'] !== undefined && typeof area['longitude'] !== 'string') return false;
  const pair = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number');
  if (area['polygon'] !== undefined) return Array.isArray(area['polygon']) && area['polygon'].length >= 3 && area['polygon'].every(pair);
  if (area['center'] !== undefined) return pair(area['center']) && typeof area['radius'] === 'number' && area['radius'] > 0;
  return ['south', 'west', 'north', 'east'].every((side) => typeof area[side] === 'number');
}
