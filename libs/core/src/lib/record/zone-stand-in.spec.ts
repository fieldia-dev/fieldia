import { installZonePromises } from '../../../../../testing/zone-promises';
import { answerOf, OwnPromise } from './values';

/**
 * The zone stand-in (testing/zone-promises.ts) says what zone.js says — the gates that Fieldia handles every answer of
 * the app's as it is given stand on it. Each case below is what zone.js 0.15.1 said of it, each run in a zone of its own
 * in Node (0.37): a promise refused at once, or refused before it was asked and kept, met by a native
 * `await` — Fieldia's own code, which Angular did not compile —, by the page's own `Promise.all` or `then` made of it,
 * or adopted first (`answerOf`). The two `Promise.all` cases are 0.37's: the stand-in let them by, zone.js says them.
 */

const FAILED = 'The server did not answer';
const turns = async () => {
  for (let i = 0; i < 6; i++) await new OwnPromise((done) => setTimeout(done, 2));
};
const quietly = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch {
    // handled: what the zone says is what was left unhandled before this came to it
  }
};

const AT_ONCE: [string, boolean, () => Promise<unknown>][] = [
  ['a native await', true, () => Promise.reject(new Error(FAILED))],
  ['the page’s own Promise.all, awaited natively', true, () => Promise.all([Promise.reject(new Error(FAILED)), Promise.resolve(1)])],
  ['the page’s own then, awaited natively', true, () => Promise.reject(new Error(FAILED)).then((value) => value)],
  ['adopted, awaited natively', false, () => answerOf(Promise.reject(new Error(FAILED)))],
  ['adopted, in the page’s own Promise.all', false, () => Promise.all([answerOf(Promise.reject(new Error(FAILED))), Promise.resolve(1)])],
];
const KEPT: [string, boolean, (kept: Promise<unknown>) => Promise<unknown>][] = [
  ['a native await', false, (kept) => kept],
  ['the page’s own Promise.all, awaited natively', true, (kept) => Promise.all([kept])],
  ['the page’s own then, awaited natively', true, (kept) => kept.then((value) => value)],
  ['adopted, then the page’s own then', false, (kept) => answerOf(kept).then((value: unknown) => value)],
  ['adopted, in the page’s own Promise.all', false, (kept) => Promise.all([answerOf(kept)])],
];

let zone: ReturnType<typeof installZonePromises>;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => zone.restore());

describe('the zone stand-in, as zone.js 0.15 says each', () => {
  it.each(AT_ONCE)('refused at once, met by %s: said %s', async (_, says, run) => {
    await quietly(run);
    await turns();
    expect(zone.said.length > 0).toBe(says);
  });

  it.each(KEPT)('refused before it was asked and kept, met by %s: said %s', async (_, says, run) => {
    const kept = Promise.reject(new Error(FAILED));
    // Its first asker handled it, as an app's cache has it handled.
    kept.then(undefined, () => undefined);
    await turns();
    await quietly(() => run(kept));
    await turns();
    expect(zone.said.length > 0).toBe(says);
  });

  it('refused later, met by the page’s own Promise.all awaited natively: quiet, its handler there first', async () => {
    await quietly(() => Promise.all([new Promise((_, no) => setTimeout(() => no(new Error(FAILED)), 5))]));
    await turns();
    expect(zone.said).toEqual([]);
  });
});
