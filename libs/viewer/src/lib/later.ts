/**
 * An answer of the app's that comes later, known by its `then`: a zone's promise (an Angular app's) and the engine's own
 * alike, as `instanceof Promise` is true of only one of them in a zone. A module of its own: the parts take it without
 * the viewer, which related.ts's dialogs bring.
 */
export const later = <T>(answer: T): answer is Extract<T, PromiseLike<unknown>> => typeof (answer as { then?: unknown } | null)?.then === 'function';
