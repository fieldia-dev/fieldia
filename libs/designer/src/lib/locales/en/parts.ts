/** What a part is called when it has no words of its own: an arrangement by how its parts fall, a picture with no description. */
export const parts = {
  page: 'Page',
  column: 'Column',
  columns: (n: number) => `${n} columns`,
  sideBySide: 'Side by side',
  tabs: 'Tabs',
  image: 'Image',
  divider: 'Divider',
  spacer: 'Spacer',
  untitledSection: 'Untitled section',
  /** A section in a tab, as a list of sections names it. */
  inTab: (tab: string, section: string) => `${tab} › ${section}`,
  /** A part's name in a sentence. */
  quote: (name: string) => `“${name}”`,
  /** Parts named together: "“A” and “B”", "“A”, “B” and “C”". */
  and: (names: readonly string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`),
  /** Names one after another: "A, B, C". */
  commaList: (names: readonly string[]) => names.join(', '),
  /** A part's width as a share of its row. */
  shares: { whole: 'the whole row', threeQuarters: 'three quarters of the row', twoThirds: 'two thirds of the row', half: 'half the row', third: 'a third of the row', quarter: 'a quarter of the row' },
  percentOfRow: (n: number) => `${n}% of the row`,
};
