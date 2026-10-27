/**
 * Promises as Angular's zone.js keeps them, for the gates (zone.js is no dependency here): the global `Promise` replaced
 * by one that, refused with no handler by the next microtask — as the zone's own microtasks drain — says so, as the
 * zone tells `NgZone.onError` (an Angular app's ErrorHandler, its specs), whatever handles it after. It adopts another
 * of its own at once, as the zone does. A native `await` of one — a promise not the engine's own — hands it its handler
 * a microtask late: what a promise an app's data source refuses at once meets in an Angular app, when what awaits it is
 * code Angular did not compile (a package's).
 *
 * `installZonePromises()` gives what it said (kept on `globalThis.__zoneSaid` too) and puts the engine's own back with
 * `restore()`. Self-contained, so the browser gates hand it to the page as it is (`page.addInitScript`).
 */
export function installZonePromises(): { said: unknown[]; restore(): void } {
  const host = globalThis as unknown as { Promise: PromiseConstructor; __zoneSaid?: unknown[] };
  const Native = host.Promise;
  const said: unknown[] = [];
  const handled = new WeakSet<object>();
  class ZonePromise<T> extends Native<T> {
    constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void) {
      const own: { self?: object; settled?: boolean } = {};
      super((resolve, reject) => {
        const no = (reason?: unknown) => {
          if (own.settled) return;
          own.settled = true;
          reject(reason);
          queueMicrotask(() => {
            if (own.self && !handled.has(own.self)) said.push(reason);
          });
        };
        const yes = (value: T | PromiseLike<T>) => {
          if (own.settled) return;
          // One of its own adopted at once, as the zone adopts it: its handlers are this one's.
          if (value instanceof ZonePromise) {
            own.settled = true;
            (value as ZonePromise<T>).then(resolve, (reason) => {
              own.settled = false;
              no(reason);
            });
            return;
          }
          own.settled = true;
          resolve(value);
        };
        try {
          executor(yes, no);
        } catch (error) {
          no(error);
        }
      });
      own.self = this;
    }
    override then<A = T, B = never>(onFulfilled?: ((value: T) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
      handled.add(this);
      return super.then(onFulfilled, onRejected);
    }
  }
  host.Promise = ZonePromise as unknown as PromiseConstructor;
  host.__zoneSaid = said;
  return { said, restore: () => void (host.Promise = Native) };
}
