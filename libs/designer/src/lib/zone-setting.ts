import type { ElementFactory } from './chrome';

const LIST_ID = 'fd-designer-zones';

/**
 * A box a time zone is typed in, by its IANA name, offering the zones the browser knows as it is typed
 * ("Europe/Berlin", "Africa/Cairo"): one list of them in the designer's document, made the first time a box asks.
 * Empty, it names none — the page's, or the browser's own. What it takes is the designer's to judge (`setTimeZone`).
 */
export function zoneBox(el: ElementFactory, label: string, placeholder: string): HTMLInputElement {
  const doc = el('span').ownerDocument;
  if (!doc.getElementById(LIST_ID)) {
    const zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    (doc.body ?? doc.documentElement).append(el('datalist', { id: LIST_ID }, ...zones.map((zone) => el('option', { value: zone }))));
  }
  return el('input', { class: 'fd-input fd-zone-box', 'aria-label': label, list: LIST_ID, placeholder, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
}
