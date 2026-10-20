import type { AppFunctions } from '@fieldia/core';

/**
 * The app's functions as a framework's wrapper hands them on: each name the ones given at mount name, each call made
 * to the newest given (`newest()`) — so a component that gives a new object each render changes nothing, and a
 * function reading the component's state reads it as it is now. Undefined for none.
 */
export function newestFunctions(newest: () => AppFunctions | undefined): AppFunctions | undefined {
  const first = newest();
  if (!first) return undefined;
  return Object.fromEntries(
    Object.entries(first).map(([name, given]) => {
      const call = (...values: never[]) => {
        const now = newest()?.[name] ?? given;
        return typeof now === 'function' ? now(...values) : now.call(...values);
      };
      return [name, typeof given === 'function' ? call : { ...given, call }];
    })
  );
}
