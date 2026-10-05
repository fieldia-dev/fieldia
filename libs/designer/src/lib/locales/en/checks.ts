const andList = (words: readonly string[]) => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** What people would trip over, as Checks lists it before publishing, and each fix's button. */
export const checks = {
  noQuestions: 'The survey has no questions yet, so there is nothing to answer.',
  noWords: (question: boolean, label: string) => `A ${question ? 'question' : 'field'} has no words yet: people would read “${label}”.`,
  typeItsWords: 'Type its words',
  defaultOptions: (label: string, options: readonly string[]) => `“${label}” still offers ${andList(options)} as its options.`,
  typeItsOptions: 'Type its options',
  linkedPicture: 'A picture that is a link has no description: a screen reader would read it as a link with no name.',
  picture: 'A picture has no description: people who cannot see it are told nothing of it.',
  describeIt: 'Describe it',
  emptyPage: (name: string) => `“${name}” has no questions: people would see an empty page.`,
  emptySection: (name: string) => `“${name}” has no fields: it would show as an empty box.`,
  deletePage: 'Delete the page',
  deleteSection: 'Delete the section',
  neverShows: (name: string, field: string, value: string) => `“${name}” shows only when ${field} is “${value}”, which ${field} no longer offers, so it never shows.`,
  neverHolds: (name: string, field: string, value: string) => `“${name}”: the rule “${field} is ${value}” can never hold, as ${field} no longer offers it.`,
  removeTheRule: 'Remove the rule',
  twoQuestions: (label: string) => `Two questions read “${label}”: people may not tell them apart.`,
  twoFields: (label: string) => `Two fields read “${label}”: people may not tell them apart.`,
  renameSecond: 'Rename the second',
  /** A page written by hand that does not pass the format's checks: where, and what. */
  invalid: (path: string, message: string) => (path ? `${path}: ${message}` : message),
  // ---- rules
  readsGone: (name: string, sentence: string, gone: readonly string[]) => `“${name}”: “${sentence}” reads ${andList(gone)}, which ${gone.length === 1 ? 'is' : 'are'} no longer on the page.`,
  formulaBroken: (name: string, problem: string) => `“${name}”: its formula no longer reads — ${problem}.`,
  removeTheFormula: 'Remove the formula',
  setBroken: (name: string, sentence: string, problem: string) => `“${name}”: “${sentence}” no longer reads — ${problem}.`,
  setCannotHold: (name: string, sentence: string, problem: string) => `“${name}”: “${sentence}” sets a value it cannot hold — ${problem}.`,
  removeIt: 'Remove it',
  patternBroken: (name: string, pattern: string) => `“${name}”: the rule’s pattern “${pattern}” cannot be read.`,
  asksNothing: (name: string) => `“${name}”: a rule asks for nothing, so it checks nothing.`,
  checksNothing: (name: string, sentence: string, stored: string) => `“${name}”: the rule “${sentence}” checks nothing, as ${name} holds ${stored}.`,
};
