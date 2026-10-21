import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as PrefillModule from './prefill-part';

/** The prefill part: a link's parameters read as the fields they fill (link-values.ts). */
export type PrefillPart = typeof PrefillModule;

/**
 * A page's fields filled from its link (`prefill`): read by the form as a new record or response starts, at once where
 * the part has come, else laid as it comes on the fields no one has changed — the viewer waits for it with the page's
 * parts, so nothing is typed before. A page without `prefill` never loads it.
 */
export const prefillPart: Part<PrefillPart> = lazyPart('prefill', () => import('./prefill-part'));

/** The fields a page's link fills (`prefill.fromUrl`), by name: the hidden ones among them are sent with the answers. */
export const prefilledNames = (page: Page): string[] => (page.prefill?.fromUrl ?? []).map((one) => (typeof one === 'string' ? one : one.field));
