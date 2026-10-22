/**
 * What the specs of every language's designer words read them with (designer-words.spec.ts for Arabic,
 * unreviewed-languages.spec.ts for Turkish, Persian, Urdu and Spanish): the Latin words a right-to-left table keeps,
 * the values each sentence is said with, and a table's shape.
 */

/**
 * Latin words an Arabic sentence keeps, as Arabic software keeps them: keys
 * on a keyboard, the names of formats and currencies, and names in code an
 * example gives (an action's, a model's) — typed as they are, in Latin.
 * Anything else in Latin letters is English left behind.
 */
export const LATIN_KEPT = [
  // Keys, and the letters of shortcuts.
  ...['Ctrl', 'Shift', 'Alt', 'Enter', 'Esc', 'Tab', 'Home', 'End', 'Delete', 'Backspace', 'K', 'J', 'Z', 'Y', 'D', 'C', 'V', 'X', 'A', 'G', 'E'],
  // Formats and currencies.
  ...['JSON', 'CSV', 'PDF', 'USD', 'EGP', 'IBAN', 'URL', 'https'],
  // The standards a page starts from (Start from a schema), as people know them.
  ...['Schema', 'OpenAPI'],
  // A formatted text's own format, and the units a column's width is written in.
  ...['Markdown', 'px', 'fr'],
  // JSON's own words, as they are typed in it.
  ...['true', 'false', 'null'],
  // Language tags, as examples of what to type.
  ...['ar', 'en', 'es', 'pt-BR'],
  // Fieldia's own name, as its look's; an editor's, as people know it; the captchas', as people know them.
  'Fieldia',
  ...['VS', 'Code'],
  ...['Turnstile', 'reCAPTCHA', 'hCaptcha'],
  // Names in code, in examples.
  ...['contact', 'confirm', 'open_invoices', 'archive', 'active', 'home', 'street', 'res', 'users'],
  // A related list's model and its link, as its panel's hints give them to type.
  ...['invoice', 'partner_id'],
  // A mask's slot for a letter, as it is typed in a mask (9 a digit, a a letter).
  'a',
];

/** Code an example writes as it is typed: a formula's function and the fields it reads, as in round(price * qty, 2); an escape; and a place in a sentence that something is drawn in, as {language}. */
export const CODE = /\b[A-Za-z_]+\([^)]*\)|#\w+|https?:\/\/\S*|mailto:\S*|\\[a-z]|\{[a-z]+\}/g;

/** Latin letters left in Arabic words, besides those kept on purpose and code. */
export function latinIn(text: string): string[] {
  return (text.replace(CODE, '').match(/[A-Za-z][A-Za-z0-9_'’-]*/g) ?? []).filter((word) => !LATIN_KEPT.includes(word));
}

export type Table = Record<string, unknown>;

/**
 * Values to say a sentence with, for one that takes a choice of a few (a
 * kind of part, a style): said with each. Any other is said with counts in
 * every plural form Arabic has, a name in Arabic letters, and a list of names.
 */
export const SAMPLES: Record<string, unknown[][]> = {
  'changes.addedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س', 'بجانب «ص»']),
  'changes.removedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س']),
  'changes.renamedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س', 'ص']),
  'changes.addedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س']),
  'changes.removedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س']),
  'changes.renamedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س', 'ص']),
  'changes.drawn': ['card', 'plain', 'line', 'framed', 'inline'].map((style) => ['س', style]),
  'changes.folds': ['no', 'open', 'folded'].map((fold) => ['س', fold]),
  'changes.filesShownAs': ['list', 'thumbnails', 'cards'].map((as) => ['س', as]),
  'changes.filesSwitch': [['س', true], ['س', false]],
  'changes.botCheck': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.duplicates': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.limits': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.approval': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.suggest': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.quiz': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.review': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.payment': ['on', 'off', 'changed'].map((now) => [now]),
  'changes.continueLater': [[true], [false]],
  'changes.flowOne': [[true], [false]],
  'questions.size': [[512], [1024 * 1024], [7.3 * 1024 * 1024], [2 * 1024 ** 3]],
  'outline.atEdgeOfPage': [[true, 'top'], [false, 'bottom']],
  'outline.atEdgeOfSurvey': [[true, 'top'], [false, 'bottom']],
  'outline.atEdgeOf': [[true, 'top', '«س»', '←'], [false, 'bottom', '«س»', '→']],
  'outline.into': [[null, null], ['«س»', '«ص»']],
  'outline.columnsAt': [[3, 2, 1], [3, undefined, undefined]],
  'outline.tookOff': [['س'], [1], [2], [11]],
  'clipboard.pasted': [['س', 0], ['س', 1], ['س', 2], ['س', 3]],
  'steps.open': ['dialog', 'panel', 'page'].map((as) => ['س', as]),
  'steps.sayTone': ['success', 'warning', 'danger', 'muted'].map((tone) => ['س', tone]),
  'rules.wrongKind': [['س', ['date'], '«ص»', 'text'], ['س', ['text', 'list'], '«ص»', 'number']],
  'changes.lookValue': [['font', 'serif'], ['density', 'compact'], ['corners', 'round'], ['scheme', 'auto'], ['labels', 'beside'], ['labelWidth', 120], ['accent', null]],
};
export const GENERIC: unknown[] = [0, 1, 2, 3, 11, 100, 'س', ['س', 'ص']];

/** Every word of a table, each with its path: a sentence that names or counts is said with sample values. */
export function everyWord(table: Table, path = ''): { path: string; words: string }[] {
  return Object.entries(table).flatMap(([key, value]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === 'string') return [{ path: at, words: value }];
    if (typeof value === 'function') {
      const said: { path: string; words: string }[] = [];
      const fn = value as (...args: unknown[]) => unknown;
      for (const args of SAMPLES[at] ?? GENERIC.map((sample) => Array(fn.length).fill(sample))) {
        try {
          said.push({ path: `${at}(${args.join(', ')})`, words: String(fn(...args)) });
        } catch {
          // A sentence that takes a name, said with a number: the name's turn comes.
        }
      }
      if (!said.length) throw new Error(`${at} could not be said`);
      return said;
    }
    return everyWord(value as Table, at);
  });
}

/** The same keys, at every depth, and the same number of values to fill in. */
export function shapeOf(table: Table): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === 'string' ? [key] : typeof value === 'function' ? [`${key}/${value.length}`] : shapeOf(value as Table).map((inner) => `${key}.${inner}`)
  );
}
