import { businessPart, choicePart, datePart, pathPart, textPart } from '@fieldia/widgets';

/**
 * The widgets' parts (parts.ts in @fieldia/widgets) in before each file's
 * tests, as a page has them once they have come: a column drawn by one of
 * their widgets — hours, a per cent, stars, a distribution, a date — is drawn
 * whole at once. A `*-lazy.spec.ts` file starts without them.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([textPart.load(), pathPart.load(), choicePart.load(), datePart.load(), businessPart.load()]));
