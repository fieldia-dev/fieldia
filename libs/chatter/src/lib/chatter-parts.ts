import { lazyPart, type Part } from '@fieldia/widgets';
import type * as DiscussionModule from './discussion';
import type * as HistoryModule from './history';

/** A work item's Discussion, loaded the first time a page shows one (parts.ts in @fieldia/widgets); its comment box is the text part's editor. */
export const discussionPart: Part<typeof DiscussionModule> = lazyPart('discussion', () => import('./discussion'));
/** A record's History with its State Graph, loaded the first time a page shows one. */
export const historyPart: Part<typeof HistoryModule> = lazyPart('history', () => import('./history'));
