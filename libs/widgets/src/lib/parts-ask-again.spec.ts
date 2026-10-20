import { lazyPart, partsComeByScriptTag, partWith } from './parts';

/**
 * Whether asking for a part again, once it failed, can bring it (`Part.asksAgain`): where parts come by `import()` — an
 * app's bundler — the browser keeps a module it could not fetch for the page's life, so nothing may offer to try again;
 * where they come by a script tag of their own (the one-tag script says so as it starts), each ask is a new tag. This
 * file flips the page's way once: its tests run in order.
 */

describe('a part asked for again', () => {
  it('cannot come by import(): asking again brings nothing a reload would not', () => {
    const part = lazyPart('one', () => Promise.resolve({}));
    expect(part.asksAgain).toBe(false);
    expect(partWith(part, lazyPart('two', () => Promise.resolve({}))).asksAgain).toBe(false);
  });

  it('can come by a script tag of its own, once the one-tag script says its parts come so', () => {
    const part = lazyPart('one', () => Promise.resolve({}));
    partsComeByScriptTag();
    expect(part.asksAgain).toBe(true);
    expect(partWith(part, lazyPart('two', () => Promise.resolve({}))).asksAgain).toBe(true);
  });
});
