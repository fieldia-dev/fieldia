import type { Field, LineField } from './field';
import type { FieldNode } from './layout';
import type { Page } from './page';
import type { FieldTools } from './part-checks';

/** The kinds a proposal fills: words, numbers, money, yes or no, a choice, a day, links, and a table of lines. */
const PROPOSED_KINDS: ReadonlySet<string> = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'datetime', 'many2one', 'many2many', 'one2many']);

/** The kinds a text field's tools rewrite. */
const TEXT_KINDS = new Set(['char', 'text', 'html']);

/**
 * AI help's checks (the assist part's in the one-tag script): a page's `suggest` — on a record's or a response's form,
 * never a list's — its fields of the page, each once, of a kind a proposal fills; the words it reads, a text of the page's.
 */
export function checkSuggest(page: Page, tools: FieldTools): void {
  const suggest = page.suggest;
  if (!suggest) return;
  if (page.layout.type === 'list') tools.report('suggest', 'suggest fills a form’s fields; a list of records has none to fill: put it on the record’s page');
  const seen = new Set<string>();
  (suggest.fields ?? []).forEach((name, i) => {
    const at = `suggest.fields[${i}]`;
    if (seen.has(name)) return tools.report(at, `"${name}" is named twice`);
    seen.add(name);
    const def = tools.need(name, at) as Field | LineField | undefined;
    if (!def) return;
    if (!PROPOSED_KINDS.has(def.type)) tools.report(at, `"${name}" is a ${def.type}: a proposal fills words, numbers, money, yes or no, a choice, a day, links or a table of lines`);
    else if (def.readonly === true || def.compute !== undefined) tools.report(at, `"${name}" is ${def.compute !== undefined ? 'worked out' : 'read-only'}: a proposal fills what a person can set`);
  });
  // The words a record holds, read in place of words pasted: a text of the page's.
  const from = suggest.fromField;
  if (from === undefined) return;
  const def = tools.need(from, 'suggest.fromField') as Field | LineField | undefined;
  if (def && !TEXT_KINDS.has(def.type)) tools.report('suggest.fromField', `"${from}" is a ${def.type}: the words read are a char, text or html field's`);
  if (suggest.fields?.includes(from)) tools.report('suggest.fromField', `"${from}" is what is read: it is not filled too`);
}

/**
 * A text field's tools (`options.rewrite`): on a char, text or html field; `true`, or a list of `draft`, `polish` and
 * the app's own `{ "how", "label" }`, each once.
 */
export function checkRewrite(node: FieldNode, def: Field | LineField | undefined, path: string, tools: FieldTools): void {
  const given = node.options?.['rewrite'];
  const at = `${path}.options.rewrite`;
  if (def && !TEXT_KINDS.has(def.type)) tools.report(at, `rewrite is for a char, text or html field; "${node.field}" is a ${def.type}`);
  if (given === true || given === false) return;
  if (!Array.isArray(given) || !given.length) return tools.report(at, 'rewrite is true, or a list of its tools: ["draft", "polish"], or { "how": "shorter", "label": "Shorter" }');
  const seen = new Set<string>();
  given.forEach((tool, i) => {
    const how = tool === 'draft' || tool === 'polish' ? tool : tool && typeof tool === 'object' && !Array.isArray(tool) ? (tool as Record<string, unknown>)['how'] : undefined;
    const own = tool && typeof tool === 'object' && !Array.isArray(tool) ? (tool as Record<string, unknown>) : null;
    if (typeof how !== 'string' || !how || (own && (typeof own['label'] !== 'string' || !own['label'] || Object.keys(own).some((key) => key !== 'how' && key !== 'label')))) {
      return tools.report(`${at}[${i}]`, 'a tool is "draft", "polish", or one of the app’s own: { "how": "shorter", "label": "Shorter" }');
    }
    if (seen.has(how)) tools.report(`${at}[${i}]`, `"${how}" is given twice`);
    seen.add(how);
  });
}

