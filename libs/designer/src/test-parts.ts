import { loadParts } from '@fieldia/viewer';

/** Every part (parts.ts in @fieldia/widgets) in before each file's tests, as the designer's pages have them once they have come. */
beforeAll(() => loadParts());
