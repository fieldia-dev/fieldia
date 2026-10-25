import { join } from 'node:path';
import { readReleased, scriptTag } from '../tools/script-tags.mjs';

/**
 * The script tags fieldia.dev prints, each written by tools/script-tags.mjs, never typed in a page: @fieldia/viewer at
 * the last version published, from jsDelivr, with the sha256 of the file npm serves as `integrity` and
 * `crossorigin="anonymous"` (tools/script-tags.json, recorded after each publish). The site is built from main between
 * releases; its tags name what is on npm, never what main holds.
 */
const RELEASED = readReleased(join(import.meta.dirname, '..'));

/** The version every tag names. */
export const RELEASED_VERSION = RELEASED.version;

/** A script's tag, `attributes` after its integrity (a new line of them starting with its own break). */
export const tag = (file, attributes = '') => scriptTag(file, RELEASED, attributes);
