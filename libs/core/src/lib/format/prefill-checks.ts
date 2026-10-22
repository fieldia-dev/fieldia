import type { Page } from './page';

/** The kinds a link's words fill as the page opens (`prefill`): read as linkValue reads them. */
const PREFILLED_KINDS = new Set(['char', 'text', 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'datetime']);

/** What a page's prefill is checked with: the reference check's own report, and its word that the checks are owed (`owe`). */
export interface PrefillTools {
  report(path: string, message: string): void;
  /** Said where checks come in a part that has not come (the one-tag script's: later-checks.ts): they are owed. */
  owe(part: string): void;
}

/**
 * The fields a link fills (`prefill.fromUrl`): each a field of the page that reads a link's words — a line of text, a
 * number, a yes or no, a choice of the page's own options, a day — filled by one parameter, never worked out. In the
 * one-tag script they come with the prefill part, which a page with `prefill` asks for (later-checks.ts).
 */
export function checkPrefill(page: Page, tools: PrefillTools): void {
  const report = (path: string, message: string) => tools.report(path, message);
  if (page.layout.type === 'list') return report('prefill', 'a link fills the answers of a record or a response as it starts: a list of records has none');
  const filled = new Set<string>();
  (page.prefill?.fromUrl ?? []).forEach((one, i) => {
    const at = `prefill.fromUrl[${i}]`;
    const [param, name] = typeof one === 'string' ? [one, one] : [one.param, one.field];
    if (filled.has(name)) return report(at, `"${name}" is filled by two of the link's parameters: name it once`);
    filled.add(name);
    const def = page.fields[name];
    if (!def) return report(at, `no field "${name}" for the link's "${param}" to fill: add it to the page's fields (placed nowhere, it is a hidden field, sent with the answers)`);
    if (def.compute !== undefined) return report(at, `"${name}" is worked out from other fields: a link cannot fill it`);
    if (Array.isArray((def as { translate?: unknown }).translate)) return report(at, `"${name}" keeps its text in several languages, each typed by a person: a link's words fill none of them`);
    if (!PREFILLED_KINDS.has(def.type)) return report(at, `"${name}" is a ${def.type}: a link's words fill a line of text, a number, a yes or no, a choice or a day — keep them in a text field (an agent's code), and let your app link the record`);
    if (def.type === 'selection' && def.optionsFrom !== undefined) report(at, `"${name}" takes its options from elsewhere: a link fills a choice of the page's own options`);
  });
}
