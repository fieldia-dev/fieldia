import { functionInfo, type AppFunctions, type FunctionsKnown } from '@fieldia/core';

const made = new WeakMap<FunctionsKnown, AppFunctions>();

/**
 * The app's functions as a page is drawn while it is designed — the canvas, a formula's made-up values: each known
 * by its name and what it takes, none called, so nothing asks the app's server as a person types. Each gives nothing.
 * Try it calls them as they were given.
 */
export function uncalled(functions: FunctionsKnown | undefined): AppFunctions | undefined {
  if (!functions) return undefined;
  let found = made.get(functions);
  if (!found) {
    found = Object.fromEntries(Object.entries(functions).map(([name, entry]) => [name, { ...functionInfo(entry), asks: false, call: () => null }]));
    made.set(functions, found);
  }
  return found;
}
