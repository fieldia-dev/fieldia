/**
 * Each kind of part's look, on the Look tab: the kinds as people think of
 * them, each setting by what it draws on that kind — a table's background is
 * its heading row, a button's accent its colour — and what is said of them.
 */
export const partLooks = {
  setting: 'Each kind of part',
  hint: 'Each over the page’s look. A colour words would be hard to read on is drawn lighter or darker, just as far as it has to be.',
  kindOfPart: 'Kind of part',
  kinds: { inputs: 'Text boxes', choices: 'Choices', groups: 'Groups', buttons: 'Buttons', tables: 'Tables' },
  /** What each kind covers, under its settings. */
  hints: {
    inputs: 'Text, number and date boxes, and dropdowns. The accent is the edge of the box being typed in and the day picked.',
    choices: 'Rings and ticks take the accent; a scale’s points, Yes and No, pictures and a ranking’s lines take the rest.',
    groups: 'Sections and cards. With the underline skin, a group given a background or a border is drawn as a card.',
    buttons: 'Send, Next, Save, Add another.',
    tables: 'Tables of lines, and a matrix’s grid of questions.',
  },
  settings: { background: 'Background', border: 'Border', corners: 'Corners', textSize: 'Text size', accent: 'Accent' },
  /** A setting named for what it draws on one kind. */
  own: { buttons: { accent: 'Colour' }, tables: { background: 'Heading row', border: 'Lines' } } as Record<string, Record<string, string>>,
  values: { square: 'Square', soft: 'Soft', round: 'Round', small: 'Small', large: 'Large' } as Record<string, string>,
  /** A setting named in full, its kind with it: every kind has corners, and the page has too. */
  named: (kind: string, setting: string) => `${kind}’ ${setting.toLowerCase()}`,
  asThePage: 'As the page',
  namedAsThePage: (named: string) => `${named} as the page`,
  ownLook: (kind: string) => `${kind}: a look of their own`,
  pageLook: (kind: string) => `${kind}: as the page`,
  /** What a value is said as in the changes before publishing: a colour as written, a choice as set, nothing set as the page. */
  said: (value: string | undefined): string => value ?? 'as the page',
  change: (kind: string, setting: string, was: string, now: string) => `${kind}, ${setting.toLowerCase()}: ${was} → ${now}`,
  // ---- refused
  noKind: (kind: string) => `There is no kind of part “${kind}”`,
  noSetting: (kind: string, setting: string) => `${kind} have no ${setting.toLowerCase()} of their own`,
  corners: 'Corners are square, soft or round',
  textSize: 'Text is small or large',
  colour: 'A colour is written #rrggbb, such as #1f7a4d',
};
