/**
 * The words the designer writes into a page as a part is made — a new
 * question's label, its first option, a new page's or section's name — in
 * the language the person designing reads. From then on they are the page's
 * own, to be typed over.
 */
export const defaults = {
  untitledQuestion: 'Untitled question',
  option: (n: number) => `Option ${n}`,
  row: (n: number) => `Row ${n}`,
  column: (n: number) => `Column ${n}`,
  page: (n: number) => `Page ${n}`,
  section: (n: number) => `Section ${n}`,
  tab: (n: number) => `Tab ${n}`,
  name: 'Name',
  description: 'Description',
  quantity: 'Quantity',
  draft: 'Draft',
  confirmed: 'Confirmed',
  done: 'Done',
  newButton: 'New button',
  counter: 'Counter',
  badge: 'Badge',
  ribbon: 'Ribbon',
  alert: 'Something to know about this record.',
  noneOfThese: 'None of these',
  /** The blocks Advanced's toolbox adds. */
  newGroup: 'New group',
  left: 'Left',
  right: 'Right',
  first: 'First',
  second: 'Second',
  newHeading: 'New heading',
  helpText: 'Words that help people fill this in.',
  button: 'Button',
  /** A scale made NPS: the words at its ends. */
  npsStart: 'Not at all likely',
  npsEnd: 'Extremely likely',
  /** Priority stars' levels, after the first (none), and a state's dot's states. */
  priorityNone: 'Normal',
  priorityLevels: ['High', 'Very high'] as readonly string[],
  dotStates: ['In progress', 'Blocked', 'Ready'] as readonly string[],
};
