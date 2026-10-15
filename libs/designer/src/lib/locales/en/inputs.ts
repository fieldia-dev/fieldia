/**
 * What the designer says of a setting typed into one of its own boxes that it
 * cannot take — out of range, not a number, half-typed — and of a formula that
 * does not read yet: the setting keeps what it held, and the box says why.
 * `setting` is the setting's own name ("Height"); numbers come as written.
 */
export const inputs = {
  settingRange: (setting: string, min: string | number, max: string | number) => `${setting} is a whole number from ${min} to ${max}`,
  settingNumberRange: (setting: string, min: string | number, max: string | number) => `${setting} is a number from ${min} to ${max}`,
  settingAtLeast: (setting: string, min: string | number) => `${setting} is a whole number, ${min} or more`,
  settingMoreThan: (setting: string, min: string | number) => `${setting} is more than ${min}`,
  settingFewer: (setting: string, n: number) => `${setting} is fewer than the ${n} options`,
  settingNeedsNumber: (setting: string) => `${setting} needs a number`,
  /** A date the designer did not take, for a reason none of the above names. */
  settingDateRefused: (setting: string) => `${setting} cannot be that date on this page`,
  /** After any of the above: what the page keeps meanwhile. */
  settingStays: (value: string | number) => `It stays ${value}.`,
  /** A setting brought into its range, and said so. */
  settingSetTo: (setting: string, min: string | number, max: string | number, value: string | number) => `${setting} runs from ${min} to ${max}, so it is ${value}`,
  /** A formula that does not read yet (`problem`): the one the page keeps, or none. */
  formulaKept: (problem: string, formula: string) => `Not in force yet: ${problem}. The page keeps ${formula}.`,
  formulaNone: (problem: string) => `Not in force yet: ${problem}. The page has no formula until this one reads.`,
  formulaPoint: 'In a formula the decimal mark is a point or ٫, like 1.5',
  /** A grid's column width (`track`) out of range, in pixels. */
  trackRange: (track: string, min: string | number, max: string | number) => `“${track}”: a column is ${min} to ${max} px wide`,
};
