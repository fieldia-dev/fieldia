import { saveRefused, type DataSource, type UploadSignal } from './data-source';
import { hostScheduler, type Scheduler } from './scheduler';

/**
 * Nothing waits for ever (audit R-M1). Every request Fieldia makes of a data source that a person waits on — a record's
 * load, a list's rows and groups, a save, a send, an onchange, a search, a list's options — goes through one deadline,
 * here: past `timeout` (30 s unless the app says, 0 for none) its `signal` aborts and it ends as the network's problem,
 * said where it was asked with its Retry; an answer that comes after is dropped. A wait's own `loading.timeout` (0.33)
 * is the loader's: it ends the wait as failed, and a request that carries the wait's `signal` (a list's) is told to stop
 * with it — the deadline ends the request, the loading timeout ends the loader, the sooner of the two first. A Discard
 * ends the sends on their way that have not answered within `DISCARD_GRACE_MS` (`stopSends`): the person's choice never
 * waits behind a stuck save.
 */

/** How long a request may take unless the app says (`FormOptions.timeout`), in milliseconds. */
export const SEND_TIMEOUT_MS = 30_000;

/** The members a person waits on, each under the deadline: what the form sends and asks as it is filled in… */
const TIMED = ['save', 'submit', 'onchange', 'search', 'options'] as const;
/** …and what a page loads — a record, a list's rows and its groups — which a Discard does not end (it is no send). */
const LOADS = ['load', 'list', 'groups'] as const;

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

/** The engine's own promise, whatever `Promise` is now (an Angular app's zone puts its own in its place): an async function's. */
const OwnPromise = (async () => undefined)().constructor as PromiseConstructor;

/**
 * An answer of the app's data source as a promise of the engine's own, the app's promise handled at once — its handlers
 * given as it is made: one it refuses at once is never said unhandled by a zone that watches its own promises (Angular's,
 * as `NgZone.onError`) while an `await` of Fieldia's, code Angular did not compile, comes to it a microtask late. What
 * is not a promise, as it is.
 */
export function answerOf<T>(answer: T): T {
  const then = (answer as { then?: unknown } | null | undefined)?.then;
  return typeof then === 'function' ? (new OwnPromise((resolve, reject) => then.call(answer, resolve, reject)) as T) : answer;
}

/** A member of the app's source as Fieldia calls it: on the source, each answer the engine's own (`answerOf`). */
const answering = (target: object, member: PropertyKey): unknown => {
  const value = Reflect.get(target, member, target);
  return typeof value === 'function' ? (...args: unknown[]) => answerOf((value as (...args: unknown[]) => unknown).apply(target, args)) : value;
};

/** Why a request on its way ended at a Discard: no problem of the person's, said nowhere. */
export const DISCARDED = 'fieldia:discarded';

/** Why a request on its way ended as its caller's own signal aborted (a wait past its `loading.timeout`): said by the caller. */
const STOPPED = 'fieldia:stopped';

/**
 * One request under a deadline: `ask(signal)`, raced against `ms`, against a Discard (`stops`) and against the caller's
 * own signal (`given`: a wait's): past `ms`, the signal aborts and it rejects as the network's problem in `words`; at a
 * Discard, with `DISCARDED`; as `given` aborts, the signal with it, rejecting as an abort (the caller said why). Settled once.
 */
export function withDeadline<T>(ask: (signal: UploadSignal) => Promise<T>, ms: number, words: string, scheduler: Scheduler = hostScheduler, stops?: Set<(reason?: string) => void>, given?: UploadSignal): Promise<T> {
  const controller = stopper();
  return new OwnPromise<T>((resolve, reject) => {
    let done = false;
    let timer: unknown = null;
    const end = () => {
      done = true;
      if (timer !== null && timer !== undefined) scheduler.clearTimeout(timer);
      stops?.delete(stop);
      given?.removeEventListener('abort', stopped);
    };
    const stop = (reason?: string) => {
      if (done) return;
      end();
      controller.abort();
      reject(reason === DISCARDED ? Object.assign(new Error(DISCARDED), { discarded: true }) : reason === STOPPED ? Object.assign(new Error(STOPPED), { name: 'AbortError' }) : saveRefused({ kind: 'network', message: words }));
    };
    const stopped = () => stop(STOPPED);
    if (given?.aborted) return stop(STOPPED);
    given?.addEventListener('abort', stopped);
    if (ms > 0 && Number.isFinite(ms)) timer = later(scheduler, () => stop(), ms);
    stops?.add(stop);
    let asked: Promise<T>;
    try {
      asked = OwnPromise.resolve(answerOf(ask(controller.signal)));
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
 * A data source whose members a person waits on (`TIMED`, `LOADS`) each answer within `ms` — every other member as it
 * is, none added: a source without one has none. The one place Fieldia's requests meet their deadline; made once per
 * viewer (its form's, its lists', its maps' the same) or per form made alone, and given again, it is itself. Every
 * answer of every member reaches Fieldia as the engine's own promise, the app's handled where it is made (`answerOf`).
 */
export function withDeadlines(source: DataSource | undefined, ms: number | undefined, words: string, scheduler: Scheduler = hostScheduler): DataSource | undefined {
  if (!source || going.has(source)) return source;
  const time = ms ?? SEND_TIMEOUT_MS;
  const stops = new Set<(reason?: string) => void>();
  // Each member read as it is called, never kept from when the form was made: an app (or a test's spy) may change it. A
  // request that carries a signal of its own (a wait's, a list's early one) is told to stop as that one aborts too.
  const timed = new Map<PropertyKey, unknown>(
    [...TIMED.map((member) => [member, true] as const), ...LOADS.map((member) => [member, false] as const)].map(([member, send]) => [
      member,
      (request: object) => withDeadline((signal) => (Reflect.get(source, member) as (one: object) => Promise<unknown>).call(source, signalled(request, signal)), time, words, scheduler, send ? stops : undefined, (request as { signal?: UploadSignal }).signal),
    ])
  );
  const wrapped = new Proxy(source, {
    get(target, member) {
      // A member the source has not is none here either (hide, never disable).
      return timed.has(member) && typeof Reflect.get(target, member) === 'function' ? timed.get(member) : answering(target, member);
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
