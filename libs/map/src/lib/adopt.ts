import { answerOf } from '@fieldia/core';
import type { MapSettings } from './settings';

/**
 * An app's function as the maps call it — its own fetch, token, search, route, a provider's member — its answer handled
 * the moment it is given, the engine's own (`answerOf`): one it refuses at once, or refused before, is never said
 * unhandled by an Angular zone (`NgZone.onError`) while an `await` of the maps' comes to it a microtask late. Called on
 * `self`, as the app's own method is. What is no function, as it is.
 */
export const adopt = <F>(app: F, self?: object): F => (typeof app === 'function' ? (((...args: unknown[]) => answerOf((app as (...args: unknown[]) => unknown).apply(self, args))) as F) : app);

/** The app's own functions among its settings, each in place of its provider's. */
const OWN = ['search', 'reverse', 'route', 'reach', 'countArea'] as const;

/**
 * The app's map settings as the maps take them, given once (`mapWidgets`, `mapParts`, `mapListViews`): its provider's
 * every member, its own search, naming, routes, reachable areas and count of an area, and a set of borders it loads, each
 * answer handled as it is given (`adopt`). The rest as the app wrote it.
 */
export function adoptedSettings(settings: MapSettings): MapSettings {
  const own: Record<string, unknown> = { ...settings, provider: new Proxy(settings.provider, { get: (target, member) => adopt(Reflect.get(target, member, target) as unknown, target) }) };
  for (const name of OWN) own[name] = adopt(own[name]);
  if (settings.regions) own['regions'] = Object.fromEntries(Object.entries(settings.regions).map(([name, set]) => [name, adopt(set)]));
  return own as unknown as MapSettings;
}
