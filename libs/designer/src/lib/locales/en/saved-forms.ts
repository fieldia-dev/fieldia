const q = (name: string) => `“${name}”`;

/** A saved form placed in another: the toolbox's tile and its menu, the frame on the canvas, its panel, what the Checks list and the edits say of it. */
export const savedForms = {
  savedForm: 'Saved form',
  /** A saved form placed with no words of its own to be named by: the first, the second… */
  copy: (n: number) => (n === 1 ? 'Saved form' : `Saved form ${n}`),
  tile: 'A saved form',
  tileTip: 'A saved form: place one of the app’s saved forms, such as an address',
  menuNote: (any: boolean): string =>
    any ? 'Placed whole, its answers kept apart; it is changed on its own page.' : 'The app has no saved form to place yet: publish one first.',
  add: 'Add a saved form',
  hint: 'saved form',
  // ---- the frame on the canvas
  tag: (name: string, version?: number) => `Saved form ${q(name)} · ${version === undefined ? 'latest version' : `version ${version}`}`,
  openIt: 'Open it',
  openTitle: (name: string) => `Open ${q(name)} on its own page, to change it`,
  loading: (id: string) => `Loading ${q(id)}…`,
  cannotShow: (name: string, why: string) => `${q(name)} cannot be shown: ${why}`,
  // ---- its panel
  version: 'Version',
  title: 'Title',
  showTitle: 'Show a title',
  answersGoUnder: 'Answers go under',
  latest: 'Latest version',
  versionOn: (version: number, publishedAt: string) => `Version ${version} · ${new Date(publishedAt).toLocaleDateString()}`,
  versionOnly: (version: number) => `Version ${version}`,
  notFound: (id: string) => `${id} (not found)`,
  openHint: 'A saved form is changed on its own page: every form that places it follows, unless it keeps to a version.',
  versionHint: 'The latest: each version published shows here once it is. A version kept to stays as it was.',
  titleHint: 'Its own title unless words are typed here.',
  answersHint: 'Its answers are kept under this name, apart from a second copy’s: { "home": { "street": … } }.',
  // ---- refused
  noForm: (id: string) => `There is no saved form ${q(id)} on this page`,
  pickForm: 'Pick the saved form to place',
  versionWhole: 'A version is a whole number from 1',
  answersName: (hint: string) => `Where its answers go is a name of letters, digits and _, starting with a letter: ${q(hint)}, say`,
  insideItself: 'A page cannot be placed inside itself',
  /** The way round, by title: this page, the forms between, this page again. */
  way: (titles: readonly string[]) => titles.join(' → '),
  holdsThisPage: (name: string, way: string) => `${q(name)} holds this page: it would be placed inside itself (${way})`,
  // ---- Checks
  mixWithField: (name: string) => `A saved form keeps its answers under ${q(name)}, the name of a field: their answers would mix. Give it a name of its own.`,
  mixWithCopy: (name: string) => `Two saved forms keep their answers under ${q(name)}: their answers would mix. Give each copy a name of its own.`,
  placedInItself: 'This page is placed inside itself: the form cannot show it.',
  cannotBeFound: (id: string) => `The saved form ${q(id)} cannot be found: the form would say so in its place.`,
  noVersion: (title: string, version: number) => `${q(title)} has no version ${version}: the form would say it cannot be found.`,
  notSections: (title: string) => `${q(title)} is not a form of sections or tabs: it cannot be placed in another.`,
  holdsThisPageCheck: (name: string, way: string) => `${q(name)} holds this page: it would be placed inside itself (${way}).`,
  takeItOff: 'Take it off the page',
};
