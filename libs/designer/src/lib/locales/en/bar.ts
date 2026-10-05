import { plural } from '../speak';

/** The bar over both editors: the title, where the page stands, Undo, Checks, Publish and its versions, Find anything, Simple and Advanced. */
export const bar = {
  screenTitle: 'Screen title',
  untitledScreen: 'Untitled screen',
  formTitle: 'Form title',
  untitledForm: 'Untitled form',
  versions: 'Versions',
  undo: 'Undo',
  redo: 'Redo',
  publish: 'Publish',
  showChecks: 'Show the checks',
  publishHint: (version: number) => `version ${version}`,
  openEarlier: 'Open an earlier version',
  versionsHint: 'versions',
  findAnything: 'Find anything',
  findTitle: (keys: string) => `Find anything · ${keys} or /`,
  /** Where the page stands. */
  draft: 'Draft, not published yet',
  unpublished: 'Changes not published yet',
  published: (version: number) => `Published · version ${version}`,
  // ---- the versions published
  version: (version: number, live: boolean, when: string) => `Version ${version} · ${live ? 'live · ' : ''}${when}`,
  versionsNote: 'Picking one makes it the draft; Undo brings back what was there. Nothing changes for people until it is published.',
  noVersions: 'Nothing published yet: publishing makes version 1.',
  // ---- Checks
  checks: 'Checks',
  mustFix: 'Must fix',
  shouldFix: 'Should fix',
  checksDialog: 'Checks before publishing',
  toLookAt: (n: number) => `${n} to look at before publishing`,
  allClear: 'All clear',
  nothingToFix: 'Nothing here would stop people, or read wrong to them.',
  checksCount: (n: number) => `Checks: ${n} to look at`,
  checksClear: 'Checks: all clear',
  // ---- Publish
  andMore: (n: number) => `and ${n} more`,
  mustFixFirst: 'Must fix first',
  keepEditing: 'Keep editing',
  publishVersion: (version: number) => `Publish version ${version}`,
  publishFailed: 'It could not be published.',
  close: 'Close',
  publishQuestion: (version: number) => `Publish version ${version}?`,
  changesSince: (n: number, version: number) => `${plural('en', n, { one: '# change', other: '# changes' })} since version ${version}:`,
  firstVersion: 'What people will get:',
  keepTheirs: (version: number) => `People part-way through it keep the version they started. Version ${version} stays one click away, under the status.`,
  keepTheirsFirst: 'People part-way through it keep the version they started; later versions never change it under them.',
  // ---- Find anything
  findPlaceholder: 'Find a field, a kind, a setting, an action…',
  found: 'Found',
  nothingFound: 'Nothing by that name.',
  /** A choice of a setting, as Find anything lists it: "Labels: beside". */
  settingChoice: (setting: string, choice: string) => `${setting}: ${choice.toLowerCase()}`,
  settingHint: (kind: string, tab: string) => `${kind} · ${tab}`,
  setting: 'setting',
  // ---- Simple and Advanced
  editingMode: 'Editing mode',
  simple: 'Simple',
  advanced: 'Advanced',
  simpleTitle: 'Simple: pick a part and edit it where it stands',
  advancedTitle: 'Advanced: drop parts beside, under or between others, set widths, pick several',
};
