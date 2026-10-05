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
};
