/** A choice's options, typed in place: adding, “Other”, “None of these”, moving and removing them. */
export const options = {
  addOption: 'Add option',
  addOther: 'add “Other”',
  or: 'or',
  removeOther: 'Remove “Other”',
  other: 'Other…',
  addNone: 'add “None of these”',
  removeOption: 'Remove option',
  removeNamed: (label: string) => `Remove option ${label}`,
  /** An option's box, for a screen reader. */
  option: (n: number) => `Option ${n}`,
  grip: 'Drag to move · Alt+↑ or ↓ moves it too',
  alone: 'goes alone',
};
