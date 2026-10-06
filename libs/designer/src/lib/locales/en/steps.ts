import type { PanelSide } from '@fieldia/core';
import { listOf, plural } from '../speak';

const and = (items: readonly string[]) => listOf('en', items, 'and');

/**
 * What a press, a change or a moment of the form does: its steps, each read
 * as a sentence, the "Add a step" menu, each step's settings, and where steps
 * are set — a button's "When clicked", a field's "When it changes", the
 * form's own moments. A name in a sentence is the page's own, as written.
 */
export const steps = {
  // ---- where steps are set
  whenClicked: 'When clicked',
  whenItChanges: 'When it changes',
  changeHint: 'Run as a person changes it — never when a step, a rule or the app sets it.',
  /** The page's own moments, on its Rules tab. */
  moments: 'When…',
  momentNames: { open: 'When the form opens', beforeSave: 'Before it’s saved or sent', afterSave: 'After it’s saved or sent', show: 'When a tab or step is shown' },
  beforeSaveHint: 'A step that stops — a check that finds problems, No to a question — keeps it unsaved.',
  whenShown: (name: string) => `When ${name} is shown`,
  stepsForATab: 'Steps for a tab or step…',
  noTabs: 'The page has no tabs or wizard steps yet.',
  // ---- the list
  steps: 'Steps',
  addAStep: 'Add a step',
  addThen: 'Add a step once it’s saved',
  thenList: 'Once it’s saved or sent',
  groups: { open: 'Open and close', values: 'Values', check: 'Check and save', talk: 'Talk to the person', app: 'The app' },
  kinds: {
    open: 'Open a page',
    close: 'Close the dialog or panel',
    set: 'Set a field',
    clear: 'Empty a field',
    addLine: 'Add a line to a table',
    goTo: 'Go to a tab or step',
    check: 'Check the form',
    save: 'Save or send',
    reset: 'Put the form back',
    say: 'Say something',
    ask: 'Ask Yes or No',
    call: 'Run one of the app’s actions',
  },
  /** A step by its place, for a screen reader: "Step 2 of 3". */
  stepOf: (n: number, count: number) => `Step ${n} of ${count}`,
  removeStep: (n: string) => `Remove step ${n}`,
  removeNew: 'Remove this new step',
  grip: 'Drag to move it, or press Alt+↑ or Alt+↓',
  moved: (n: number, count: number) => `Moved: step ${n} of ${count}.`,
  removed: (sentence: string) => `Removed “${sentence}”. `,
  undo: 'Undo',
  keepsOne: 'A button does at least one thing: add another step to take this one away.',
  count: (n: number) => plural('en', n, { one: '# step', other: '# steps' }),
  /** What the canvas says of a part that does something. */
  markName: 'Does something',
  openTheSteps: (name: string) => `${name}: open what it does`,
  // ---- sentences
  /** A panel from the end of the line, the default, says no side. */
  open: (page: string, as: 'dialog' | 'panel' | 'page', side?: PanelSide) =>
    as === 'panel' ? `Open ${page} in a panel${side && side !== 'end' ? ` from the ${side === 'start' ? 'start of the line' : side}` : ''}` : as === 'page' ? `Open ${page} in its place` : `Open ${page} in a dialog`,
  onRecord: (record: string) => `, on the record ${record}`,
  startingWith: (names: readonly string[]) => `, starting with ${and(names)}`,
  thenPut: (fields: readonly string[]) => `, then put its ${fields.length > 1 ? 'answers' : 'answer'} in ${and(fields)}`,
  set: (field: string, value: string) => `Set ${field} to ${value}`,
  clear: (field: string) => `Empty ${field}`,
  addLine: (field: string) => `Add a line to ${field}`,
  checkAll: 'Check the form',
  checkFields: (fields: readonly string[]) => `Check ${and(fields)}`,
  save: 'Save the record',
  send: 'Send the answers',
  reset: 'Put the form back as it was loaded',
  goTo: (name: string) => `Go to ${name}`,
  say: (message: string) => `Say: ${message}`,
  sayTone: (message: string, tone: 'success' | 'warning' | 'danger' | 'muted') =>
    `${{ success: 'Say as good news', warning: 'Warn', danger: 'Say as a problem', muted: 'Say quietly' }[tone]}: ${message}`,
  ask: (message: string) => `Ask: ${message}`,
  /** An action's name is the app's, as it is typed: kept apart in the sentence. */
  call: (action: string) => `Run the app’s action ${action}`,
  callWith: (action: string, n: number) => `Run the app’s action ${action}, with ${plural('en', n, { one: '# value', other: '# values' })}`,
  close: 'Close the dialog or panel it was opened in',
  /** A step that runs only when a condition holds. */
  when: (sentence: string, condition: string) => `${sentence} when ${condition}`,
  never: (sentence: string) => `${sentence} — never, for now`,
  /** A step run once the page an open step opened is saved: under it. */
  nested: (sentence: string) => `↳ ${sentence}`,
  /** A page known only by its id. */
  unknownPage: (id: string) => id,
  // ---- a step's settings
  page: 'Page',
  pageById: 'Another page, by its id…',
  pageId: 'The page’s id',
  pageIdPlaceholder: 'contact',
  opensIn: 'Opens',
  /** Each in full, starting with its short words, as a screen reader's user says them. */
  as: { dialog: 'Dialog, over this form', panel: 'Panel, beside this form', page: 'Its place, instead of this form' },
  asShort: { dialog: 'Dialog', panel: 'Panel', page: 'Its place' },
  /** Where a panel comes from: the end of the line (unset), then the screen's edges; the start of the line only for a page that has it. */
  from: 'From',
  sides: { end: 'The end of the line', start: 'The start of the line', left: 'The left', right: 'The right', top: 'The top', bottom: 'The bottom' },
  /** Under the list, for the side picked: what it means on the screen. The left and the right say it already. */
  sideHints: {
    end: 'The right, or the left on a page that reads right to left.',
    start: 'The left, or the right on a page that reads right to left.',
    top: 'The whole width of the screen.',
    bottom: 'The whole width of the screen.',
  } as Partial<Record<PanelSide, string>>,
  title: 'Its title',
  titlePlaceholder: 'The page’s own title',
  record: 'On a record',
  recordPlaceholder: 'Empty for a new one',
  startsWith: 'It starts with',
  answersGo: 'Its answers go to',
  itsField: 'Its field',
  thisFormsField: 'This form’s field',
  value: 'Value',
  valueFrom: (name: string) => `${name} gets`,
  fromItsAnswers: 'From its answers',
  theRecordItSaved: 'The record it saved',
  addValue: 'Add a value',
  addAnswer: 'Add an answer',
  removeValue: (name: string) => `Remove ${name}`,
  pick: 'Pick…',
  field: 'Field',
  setTo: 'To',
  setToPlaceholder: 'Quantity × 12.5 — type a field’s name, or @',
  expressionPlaceholder: 'A field, or @',
  table: 'Table of lines',
  lineValues: 'Its values',
  check: 'Check',
  wholeForm: 'Whole form',
  onlyFields: 'Some fields',
  goToTarget: 'Go to',
  words: 'Words',
  sayPlaceholder: 'Customer added',
  askPlaceholder: 'Send the order?',
  tone: 'Tone',
  tones: { info: 'Information', success: 'Good news', warning: 'A warning', danger: 'A problem', muted: 'Quiet' },
  action: 'The app’s action',
  actionPlaceholder: 'confirm',
  actionHint: 'The name the app receives; the app decides what it does. Its answer can set values, say something, open a page, or stop the steps after it.',
  onlyWhen: 'Only when…',
  runsOnlyWhen: 'Runs only when',
  whenPlaceholder: 'Quantity > 0 — type a field’s name, or @',
  noField: 'This page has no field it can take yet.',
  needsPage: 'Pick the page it opens, or type its id.',
  needsWords: 'Type what it says.',
  needsAction: 'Type the action’s name.',
  needsValue: 'Type the value it sets.',
  // ---- the Rules view
  groupNames: { clicked: 'When clicked', changes: 'When it changes', moments: 'At the form’s moments' },
  countWith: (rules: number, places: number) => {
    const where = plural('en', places, { one: '# place', other: '# places' });
    return rules ? `${plural('en', rules, { one: '# rule', other: '# rules' })}, and steps in ${where}, on this page.` : `Steps in ${where} on this page, and no rules.`;
  },
  findSteps: (name: string, sentence: string) => `Steps: ${name} — ${sentence}`,
  // ---- checks
  namesGone: (name: string, sentence: string, gone: readonly string[]) => `“${name}”: “${sentence}” names ${and(gone)}, which ${gone.length === 1 ? 'is' : 'are'} no longer on the page.`,
  changeGone: (field: string) => `“${field}” is no longer on the page, so its steps when it changes never run.`,
  removeTheStep: 'Remove the step',
  removeTheSteps: 'Remove the steps',
  /** On a page written by hand: a step the page's own check finds wrong, and where. */
  stepWrong: (name: string, n: string, problem: string) => `“${name}”, step ${n}: ${problem}.`,
  placeWrong: (name: string, problem: string) => `“${name}”: ${problem}.`,
  // ---- refusals
  noPlace: 'There is nothing here to give steps to.',
  noStep: (n: number) => `There is no step ${n} here.`,
  needsSomething: (name: string) => `“${name}” needs something to do: add another step before taking this one away.`,
  onlyOpenThen: 'Only a step that opens a page has steps once it is saved.',
  cannotMoveFurther: 'It cannot move further.',
  // ---- what changed
  changedSteps: (name: string) => `What “${name}” does changed`,
  changedMoment: (moment: string) => `${moment}: its steps changed`,
};
