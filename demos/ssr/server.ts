import { firstPaint } from '@fieldia/viewer/server';
import { page, record } from './page';

/** What a site's server sends (here at build time: tools/build-demos.mjs): the enquiry's first paint, with its values. */
export const render = (): string => firstPaint(page, { values: record });
