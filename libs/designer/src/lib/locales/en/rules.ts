import { plural } from '../speak';

const lower = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);
const letters = (n: number) => plural('en', n, { one: '# letter', other: '# letters' });
const andWords = (words: readonly string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/**
 * Rules as sentences — "Shows when Status is Active", "Worked out from Price
 * × Quantity", "Ends with @acme.com — only warns" — and a formula in words:
 * its signs, what is wrong with it, what it gives on made-up values. The
 * overview, the marks, the checks and the Publish dialog all say rules so.
 */
export const rules = {
  // ---- what "Add a rule" offers
  kinds: {
    length: 'A length',
    ending: 'An ending',
    pattern: 'A pattern',
    range: 'A range',
    count: 'How many are ticked',
    past: 'A date in the past',
    future: 'A date in the future',
    across: 'A rule across fields',
  },
  /** The patterns people pick by name. */
  patterns: { letters: 'Letters only', digits: 'Digits only', lettersAndDigits: 'Letters and digits only' },
  // ---- an answer rule's asks: as it reads alone, and as what the answer must be
  exactlyLetters: (n: number) => `Exactly ${letters(n)}`,
  mustExactlyLetters: (n: number) => `Must be exactly ${letters(n)}`,
  betweenLetters: (a: number, b: number) => `Between ${a} and ${letters(b)}`,
  mustBetweenLetters: (a: number, b: number) => `Must be between ${a} and ${letters(b)}`,
  atLeastLetters: (n: number) => `At least ${letters(n)}`,
  mustAtLeastLetters: (n: number) => `Must be at least ${letters(n)}`,
  atMostLetters: (n: number) => `At most ${letters(n)}`,
  mustAtMostLetters: (n: number) => `Must be at most ${letters(n)}`,
  mustNamed: { letters: 'Must be letters only', digits: 'Must be digits only', lettersAndDigits: 'Must be letters and digits only' },
  matches: (pattern: string) => `Matches the pattern ${pattern}`,
  mustMatch: (pattern: string) => `Must match the pattern ${pattern}`,
  endsWith: (end: string) => `Ends with ${end}`,
  mustEndWith: (end: string) => `Must end with ${end}`,
  exactly: (n: number) => `Exactly ${n}`,
  mustExactly: (n: number) => `Must be exactly ${n}`,
  between: (a: number, b: number) => `Between ${a} and ${b}`,
  mustBetween: (a: number, b: number) => `Must be between ${a} and ${b}`,
  atLeast: (n: number) => `At least ${n}`,
  mustAtLeast: (n: number) => `Must be at least ${n}`,
  atMost: (n: number) => `At most ${n}`,
  mustAtMost: (n: number) => `Must be at most ${n}`,
  tickBetween: (a: number, b: number) => `Tick between ${a} and ${b}`,
  mustTickBetween: (a: number, b: number) => `Must tick between ${a} and ${b}`,
  tickAtLeast: (n: number) => `Tick at least ${n}`,
  mustTickAtLeast: (n: number) => `Must tick at least ${n}`,
  tickAtMost: (n: number) => `Tick at most ${n}`,
  mustTickAtMost: (n: number) => `Must tick at most ${n}`,
  past: 'A date in the past',
  mustPast: 'Must be a date in the past',
  future: 'A date in the future',
  mustFuture: 'Must be a date in the future',
  mustHold: (formula: string) => `Must hold: ${formula}`,
  /** A rule's asks said as one: "At least 2 letters, ends with .com". */
  joinAsks: (asks: readonly string[]) => [asks[0], ...asks.slice(1).map(lower)].join(', '),
  onlyWarns: 'only warns',
  neverChecked: 'never checked',
  onlyWhen: (condition: string) => `only when ${condition}`,
  /** An answer rule in a list: "Ends with @acme.com — only warns, only when VIP is Yes". */
  sentence: (said: string, notes: readonly string[]) => (notes.length ? `${said} — ${notes.join(', ')}` : said),
  /** What it makes the answer be: "Must end with @acme.com (only warns)". */
  must: (said: string, notes: readonly string[]) => (notes.length ? `${said} (${notes.join(', ')})` : said),
  asksNothingYet: 'Asks for nothing yet',
  asksNothing: 'Asks for nothing',
  // ---- conditions and values
  is: 'is',
  isNot: 'is not',
  /** One test of a condition: "Status is Active". */
  test: (field: string, op: string, value: string) => `${field} ${op} ${value}`,
  allOf: (tests: readonly string[]) => tests.join(' and '),
  anyOf: (tests: readonly string[]) => tests.join(' or '),
  text: (text: string) => `“${text}”`,
  yes: 'Yes',
  no: 'No',
  nothing: 'nothing',
  // ---- every rule on the page
  untitledPage: 'Untitled page',
  alwaysHidden: 'Always hidden',
  hiddenWhen: (formula: string) => `Hidden when ${formula}`,
  showsWhen: (condition: string) => `Shows when ${condition}`,
  requiredWhen: (formula: string) => `Required when ${formula}`,
  readonlyWhen: (formula: string) => `Read-only when ${formula}`,
  workedOutFrom: (formula: string) => `Worked out from ${formula}`,
  setTo: (value: string, when: string) => `Set to ${value} when ${when}`,
  // ---- a formula in words
  signs: { is: 'is', isNot: 'is not' },
  /** The formula's own words (and, or, not, in), said in the designer's language; English keeps them as written. */
  keyword: (word: string) => word,
  /** A label with a sign of its own, quoted so it reads as one name. */
  quoteName: (label: string) => `“${label}”`,
  // ---- what is wrong with a formula
  typeAFormula: 'Type a formula',
  cannotBeIn: (sign: string) => `“${sign}” cannot be in a formula,`,
  unknownField: (name: string) => `Unknown field “${name}”`,
  unknownFunction: (name: string) => `Unknown function “${name}”`,
  /** A function given the wrong values, in the formula reader's own words after its name. */
  takes: (name: string, rest: string) => `“${name}”${rest},`,
  neverClosed: 'A “(” is never closed',
  missingAfter: (piece: string) => `Something is missing after “${piece}”`,
  outOfPlace: (piece: string) => `“${piece}” is out of place`,
  /** Where: "at 1–5". */
  at: (words: string, place: string) => `${words} at ${place}`,
  fromItself: (label: string) => `“${label}” cannot be worked out from itself`,
  circle: (label: string, path: readonly string[]) => `“${label}” would be worked out from itself: ${path.join(' → ')}`,
  // ---- on made-up values
  cannotWorkOut: 'nothing — it cannot be worked out',
  always: (value: string) => `Always ${value}`,
  given: (name: string, value: string) => `${name} ${value}`,
  withValues: (given: readonly string[], result: string) => `With ${andWords(given)}: ${result}`,
  alwaysHolds: 'Always holds',
  neverHolds: 'Never holds',
  checkedOnce: (names: readonly string[]) => `Checked once ${andWords(names)} ${names.length === 1 ? 'is' : 'are'} filled in`,
  holds: 'holds',
  doesNotHold: 'does not hold',
  // ---- a rule refused
  /** What an ask is, in a refusal: "a length does not fit it". */
  asks: {
    minLength: 'a length',
    maxLength: 'a length',
    endsWith: 'an ending',
    pattern: 'a pattern',
    min: 'a range',
    max: 'a range',
    atLeast: 'how many are ticked',
    atMost: 'how many are ticked',
    date: 'a date in the past or the future',
    holds: 'a rule across fields',
  },
  computeFromModel: (label: string) => `How “${label}” is worked out comes from the model`,
  setFromModel: (label: string) => `What sets “${label}” comes from the model`,
  cannotBeWorkedOut: (label: string, stored: string) => `“${label}” holds ${stored}, which cannot be worked out from other fields`,
  cannotBeSet: (label: string, stored: string) => `“${label}” holds ${stored}, which cannot be set by a rule`,
  inWhen: (problem: string) => `When: ${problem}`,
  inSetTo: (problem: string) => `Set to: ${problem}`,
  holdsNot: (label: string, stored: string, value: string) => `“${label}” holds ${stored}, not ${value}`,
  offersNot: (label: string, offered: readonly string[], value: string) => `“${label}” offers ${andWords(offered)}, not ${value}`,
  askSomething: 'A rule asks for something: a length, an ending, a pattern, a range, how many are ticked, a date or a rule across fields',
  askMisfit: (label: string, stored: string, ask: string) => `“${label}” holds ${stored}: ${ask} does not fit it`,
  patternUnreadable: (pattern: string) => `The pattern “${pattern}” cannot be read`,
  lengthWhole: 'A length is a whole number of letters',
  tickedWhole: 'How many are ticked is a whole number',
  rangeNumbers: 'A range runs between numbers',
  shortestLonger: (a: number, b: number) => `The shortest, ${a}, is longer than the longest, ${b}`,
  smallestMore: (a: number, b: number) => `The smallest, ${a}, is more than the largest, ${b}`,
  atLeastMore: (a: number, b: number) => `At least ${a} is more than at most ${b}`,
  inMustHold: (problem: string) => `Must hold: ${problem}`,
  inOnlyWhen: (problem: string) => `Only when: ${problem}`,
  noRule: (label: string, n: number) => `“${label}” has no rule ${n}`,
};
