import { saveRefused, type DataSource, type UploadSignal } from './data-source';
import { hostScheduler, type Scheduler } from './scheduler';

/**
 * Nothing waits for ever (audit R-M1). Every request a form makes of its data source that a person waits on — a save, a
 * send, an onchange, a search, a list's options — goes through one deadline, here: past `timeout` (30 s unless the app
 * says, 0 for none) its `signal` aborts and it ends as the network's problem, the form's Retry; an answer that comes after
 * is dropped. A Discard ends the ones on their way that have not answered within `DISCARD_GRACE_MS` (`stopSends`): the
 * person's choice never waits behind a stuck save. A load's own is the loading settings' (0.33's `timeout`, the same shape: a time, and a `signal`).
 */

/** How long a request may take unless the app says (`FormOptions.timeout`), in milliseconds. */
export const SEND_TIMEOUT_MS = 30_000;

/** The members a person waits on, each under the deadline. */
const TIMED = ['save', 'submit', 'onchange', 'search', 'options'] as const;

/** The host's `AbortController`: every browser's, and Node's. Core names no DOM types. */
const stopper = () => new (globalThis as unknown as { AbortController: new () => { signal: UploadSignal; abort(): void } }).AbortController();

/** A timer that keeps nothing alive by itself (Node's `unref`): a deadline never holds a process open. None where there are no timers. */
function later(scheduler: Scheduler, run: () => void, ms: number): unknown {
  if (scheduler === hostScheduler && typeof (globalThis as { setTimeout?: unknown }).setTimeout !== 'function') return null;
  const handle = scheduler.setTimeout(run, ms);
  (handle as { unref?: () => void } | null)?.unref?.();
  return handle;
}

/** A request handed its `signal`: kept off what is copied, compared or kept on the device (not enumerable). */
function signalled<R extends object>(request: R, signal: UploadSignal): R {
  return Object.defineProperty({ ...request }, 'signal', { value: signal, enumerable: false, configurable: true });
}

/** Why a request on its way ended at a Discard: no problem of the person's, said nowhere. */
export const DISCARDED = 'fieldia:discarded';

/**
 * One request under a deadline: `ask(signal)`, raced against `ms` and against a Discard (`stops`): past it, the signal
 * aborts and it rejects as the network's problem in `words`; at a Discard, with `DISCARDED`. Settled once.
 */
export function withDeadline<T>(ask: (signal: UploadSignal) => Promise<T>, ms: number, words: string, scheduler: Scheduler = hostScheduler, stops?: Set<(reason?: string) => void>): Promise<T> {
  const controller = stopper();
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let timer: unknown = null;
    const end = () => {
      done = true;
      if (timer !== null && timer !== undefined) scheduler.clearTimeout(timer);
      stops?.delete(stop);
    };
    const stop = (reason?: string) => {
      if (done) return;
      end();
      controller.abort();
      reject(reason === DISCARDED ? Object.assign(new Error(DISCARDED), { discarded: true }) : saveRefused({ kind: 'network', message: words }));
    };
    if (ms > 0 && Number.isFinite(ms)) timer = later(scheduler, () => stop(), ms);
    stops?.add(stop);
    let asked: Promise<T>;
    try {
      asked = Promise.resolve(ask(controller.signal));
    } catch (error) {
      end();
      reject(error);
      return;
    }
    asked.then(
      (value) => {
        if (done) return;
        end();
        resolve(value);
      },
      (error: unknown) => {
        if (done) return;
        end();
        reject(error);
      }
    );
  });
}

/** Each deadlined source's requests on their way, by the source: what a Discard ends. */
const going = new WeakMap<object, Set<(reason?: string) => void>>();

/**
 * A data source whose members a person waits on (`TIMED`) each answer within `ms` — every other member as it is, none
 * added: a source without one has none. The one place a form's requests meet their deadline; made once per form.
 */
export function withDeadlines(source: DataSource | undefined, ms: number | undefined, words: string, scheduler: Scheduler = hostScheduler): DataSource | undefined {
  if (!source || going.has(source)) return source;
  const time = ms ?? SEND_TIMEOUT_MS;
  const stops = new Set<(reason?: string) => void>();
  const timed = new Map<PropertyKey, unknown>();
  for (const member of TIMED) {
    const call = (source as Record<string, unknown>)[member];
    if (typeof call !== 'function') continue;
    timed.set(member, (request: object) => withDeadline((signal) => (call as (one: object) => Promise<unknown>).call(source, signalled(request, signal)), time, words, scheduler, stops));
  }
  const wrapped = new Proxy(source, {
    get(target, member) {
      if (timed.has(member)) return timed.get(member);
      const value = Reflect.get(target, member, target);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  going.set(wrapped, stops);
  return wrapped;
}

/**
 * How long a Discard waits for a save on its way before it ends it: one answering as saves do lands — a dialog's new
 * record is its caller's, with its id — and one stuck never holds the person's choice longer.
 */
export const DISCARD_GRACE_MS = 5_000;

/** End every request of this source on its way: a Discard's, once `after` passed with no answer (at once for 0). */
export function stopSends(source: DataSource | undefined, after = 0, scheduler: Scheduler = hostScheduler): void {
  const stops = source ? going.get(source) : undefined;
  for (const stop of [...(stops ?? [])]) {
    if (after > 0) later(scheduler, () => stop(DISCARDED), after);
    else stop(DISCARDED);
  }
}
