/**
 * Asking a provider over the network: its answer as JSON, or its refusal in
 * its own words, and a path read through an answer whose shape may vary.
 * Kept apart, as the providers and their routes (loaded later) both use it.
 */

export type Fetch = typeof globalThis.fetch;

/**
 * A provider's answer, or its refusal in its own words: "Places API (New) has
 * not been used in project … or it is disabled" says what to do; a bare 403
 * does not.
 */
export async function getJson(fetchWith: Fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWith(url, init);
  if (response.ok) return response.json();
  const body = await response.json().catch(() => null);
  const said = pathOf(body, 'error', 'message') ?? pathOf(body, 'error_message') ?? pathOf(body, 'message');
  throw new Error(`${url.split('?')[0]} answered ${response.status}${typeof said === 'string' && said ? `: ${said}` : ''}`);
}

export type Json = { [key: string]: unknown };
export const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
export const pathOf = (value: unknown, ...path: string[]): unknown => path.reduce<unknown>((at, key) => (isObject(at) ? at[key] : undefined), value);
