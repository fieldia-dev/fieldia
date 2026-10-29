/**
 * Promises as Angular's zone.js keeps them, for the gates (zone.js is no dependency here): the global `Promise` replaced
 * by one that, refused with no handler once its zone's microtasks have drained, says so, as the zone tells
 * `NgZone.onError` (an Angular app's ErrorHandler, its specs), whatever handles it after. The zone runs a promise's
 * reactions in a drain of its own and looks at what they refused as that drain ends: before any job of the engine's
 * queued after it — a native `await`'s among them. So a promise refused at once is looked at by the next microtask, and
 * one refused in a reaction — a promise made by `then` on one that is refused, or refused already, or any refused by a
 * reaction's own handler (what `Promise.all` makes, refused as one of those it was given is) — as soon as that reaction
 * has run. It adopts another of its own at once, as the zone does. A native `await` of one — a promise not the
 * engine's own — hands it its handler a microtask late, after that look: what a promise an app's data source or page
 * loader refuses meets in an Angular app, when what awaits it is code Angular did not compile (a package's) — and what
 * one the app refused before it was asked for meets, made again by Fieldia's own `then` (0.36.1's FU2: a linked page
 * that had failed already when Open was pressed) or by its own `Promise.all` (the chatter's, 0.37), as zone.js 0.15
 * says each of them (zone-stand-in.spec.ts in @fieldia/core holds it to that).
 *
 * `installZonePromises()` gives what it said (kept on `globalThis.__zoneSaid` too) and puts the engine's own back with
 * `restore()`. Self-contained, so the browser gates hand it to the page as it is (`page.addInitScript`).
 */
export function installZonePromises(): { said: unknown[]; restore(): void } {
  const host = globalThis as unknown as { Promise: PromiseConstructor; __zoneSaid?: unknown[] };
  const Native = host.Promise;
  const said: unknown[] = [];
  const handled = new WeakSet<object>();
  /** Each promise refused, with why; each kept; the promises each one's `then` made, its children; each said once. */
  const refused = new WeakMap<object, { reason: unknown }>();
  const kept = new WeakSet<object>();
  const children = new WeakMap<object, object[]>();
  const told = new WeakSet<object>();
  /** How deep in a reaction's handler the code runs now; and the promises refused there, looked at as that reaction ends. */
  let reacting = 0;
  let inReactions: (() => object | undefined)[] = [];
  /** The zone's look at a promise, once what is queued now has run: refused with no handler, it is said. */
  const sayIfLeft = (one: object | undefined) => {
    const no = one && refused.get(one);
    if (!one || !no || handled.has(one) || told.has(one)) return;
    told.add(one);
    said.push(no.reason);
  };
  const look = (promise: () => object | undefined) => queueMicrotask(() => sayIfLeft(promise()));
  /**
   * The zone's look at what the reactions queued now refused, right after them: queued as they are, so before any job
   * queued after them — a native `await`'s handler among them.
   */
  const afterReactions = () =>
    queueMicrotask(() => {
      const ones = inReactions;
      inReactions = [];
      for (const one of ones) sayIfLeft(one());
    });
  /** A handler run as a reaction: what it refuses is looked at as it ends. */
  const asReaction = <A, R>(handler: ((value: A) => R) | null | undefined) =>
    typeof handler === 'function'
      ? (value: A): R => {
          reacting++;
          try {
            return handler(value);
          } finally {
            reacting--;
            // Where its reaction was queued with no look after it (a promise kept by another's adoption): looked at
            // once what is queued now has run — never sooner than the zone would.
            if (!reacting && inReactions.length) afterReactions();
          }
        }
      : handler;
  class ZonePromise<T> extends Native<T> {
    constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void) {
      const own: { self?: object; settled?: boolean; no?: { reason: unknown }; yes?: boolean } = {};
      super((resolve, reject) => {
        const no = (reason?: unknown) => {
          if (own.settled) return;
          own.settled = true;
          own.no = { reason };
          if (own.self) refused.set(own.self, own.no);
          // Refused by a reaction's handler: looked at as that reaction ends.
          if (reacting) inReactions.push(() => own.self);
          // The engine queues its handlers' reactions as it is refused: its children are refused in them, and looked at
          // once they ran, with what they refused.
          reject(reason);
          look(() => own.self);
          const handlers = (own.self && children.get(own.self)) ?? [];
          for (const child of handlers) look(() => child);
          if (handlers.length) afterReactions();
        };
        const yes = (value: T | PromiseLike<T>) => {
          if (own.settled) return;
          // One of its own adopted at once, as the zone adopts it: its handlers are this one's.
          if (value instanceof ZonePromise) {
            own.settled = true;
            (value as ZonePromise<T>).then(
              (kept) => {
                own.settled = false;
                yes(kept);
              },
              (reason) => {
                own.settled = false;
                no(reason);
              }
            );
            return;
          }
          own.settled = true;
          resolve(value);
          // Kept with a value, not a promise: its handlers' reactions queued now, what they refuse looked at after them.
          const thenable = !!value && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';
          if (!thenable) {
            own.yes = true;
            if (own.self) kept.add(own.self);
            if (own.self && children.get(own.self)?.length) afterReactions();
          }
        };
        try {
          executor(yes, no);
        } catch (error) {
          no(error);
        }
      });
      own.self = this;
      if (own.no) refused.set(this, own.no);
      if (own.yes) kept.add(this);
    }
    override then<A = T, B = never>(onFulfilled?: ((value: T) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
      handled.add(this);
      const child = super.then(asReaction(onFulfilled), asReaction(onRejected));
      const made = children.get(this) ?? [];
      children.set(this, [...made, child]);
      // Refused already: its reaction is queued now, and the child it refuses looked at as soon as it ran; settled already
      // either way, what its handler refuses looked at then too.
      if (refused.has(this)) look(() => child);
      if (refused.has(this) || kept.has(this)) afterReactions();
      return child;
    }
  }
  host.Promise = ZonePromise as unknown as PromiseConstructor;
  host.__zoneSaid = said;
  return { said, restore: () => void (host.Promise = Native) };
}
