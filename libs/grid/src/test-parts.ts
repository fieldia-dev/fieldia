import { loadParts } from '@fieldia/viewer';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests — a
 * table of lines' too, which a page whose one2many is not a grid draws — as a
 * page has them once they have come: drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => loadParts());
