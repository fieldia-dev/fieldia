/** The sheet of shortcuts: its groups, when each works, and the keys of the bar and of typing (the canvas's, the outline's and the clipboard's are theirs). */
export const shortcuts = {
  title: 'Keyboard shortcuts',
  findKey: 'Find a key',
  findPlaceholder: 'Find a key, or what it does',
  close: 'Close',
  keys: 'The keys',
  none: 'No key does that.',
  groups: { Anywhere: 'Anywhere', Canvas: 'Canvas', Outline: 'Outline', Typing: 'Typing' },
  when: {
    Anywhere: 'Outside a box being typed in',
    Canvas: 'In Advanced, with a part picked',
    Outline: 'With a row of the outline focused',
    Typing: 'In a label, a help or a title',
  },
  /** The bar's keys, and the editors' own. */
  anywhere: [
    ['⌘K or /', 'Find anything: a field, a kind, a setting, an action'],
    ['⌘Z', 'Undo'],
    ['⌘⇧Z or ⌘Y', 'Redo'],
    ['?', 'This sheet of keys'],
    ['Escape', 'Put down what is picked'],
  ] as [string, string][],
  typing: [
    ['Enter', 'From a label to its help, and from the help out'],
    ['Escape', 'Leave the box, and put the part down'],
    ['⌘C / ⌘X / ⌘V', 'Copy, cut and paste words, as ever'],
  ] as [string, string][],
  surveyTyping: [
    ['⌘⇧Enter', 'Add a question after this one'],
    ['⌘⇧D', 'Copy the question'],
    ['⌘⇧K / ⌘⇧J', 'Move the question up or down'],
  ] as [string, string][],
};
