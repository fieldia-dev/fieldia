export * from './lib/source';
export * from './lib/memory';
export * from './lib/labels';
export * from './lib/styles';
export * from './lib/chatter';
export * from './lib/slot';
// A work item's Discussion and its History come in parts loaded the first time a page shows one (parts.ts in
// @fieldia/widgets): through their slots — chatterSlot({ look: 'discussion' }), historySlot — or from the part itself,
// `(await historyPart.load()).mountHistory(…)`. Their types are here; their code is not, so no app carries it unasked.
export { historySlot } from './lib/history-slot';
export { discussionPart, historyPart } from './lib/chatter-parts';
export type { DiscussionOptions } from './lib/discussion';
export type { HistoryAge, HistoryEntry, HistoryHandle, HistoryKind, HistoryOptions, MountHistoryOptions } from './lib/history';
