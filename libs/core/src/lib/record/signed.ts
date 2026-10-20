import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import type { SignatureEvidence, Value, Values } from './values';

/**
 * Answers a signature signed are locked while it is kept: each answer its evidence names (`FileValue.signed.fields`)
 * is read-only until the signature is taken away (its "Change answers") and signed again — a signature the page has
 * sign answers (`options.signs`); one that no longer does is a picture, whatever its value carries. The evidence itself — the
 * fingerprint, its canonical form — is the files part's (signature-evidence.ts in @fieldia/widgets); this is the one
 * thing every page with a form needs of it: which answers are locked, and by which signature.
 */

/** A value's signature evidence: who signed, when, which answers and their fingerprint; null for any other value. */
export function evidenceOf(value: Value | undefined): SignatureEvidence | null {
  const signed = value && typeof value === 'object' && !Array.isArray(value) ? (value as { signed?: unknown }).signed : undefined;
  if (!signed || typeof signed !== 'object') return null;
  const evidence = signed as SignatureEvidence;
  return Array.isArray(evidence.fields) && typeof evidence.sha256 === 'string' && typeof evidence.at === 'string' ? evidence : null;
}

/** The answer a signature locks, by the answer's field: the signature's field and its evidence. */
export type SignedBy = ReadonlyMap<string, { field: string; evidence: SignatureEvidence }>;

const none: SignedBy = new Map();

/** Whether a signature's node signs answers: its `options.signs` is "form", or names some. */
export function signsAnswers(node: Pick<FieldNode, 'options'>): boolean {
  const signs = node.options?.['signs'];
  return signs === 'form' || (Array.isArray(signs) && signs.length > 0);
}

/** The fields a page draws as a signature that signs answers, wherever they stand: worked out once for each page. */
const signing = new WeakMap<object, ReadonlySet<string>>();
function signingFields(page: Pick<Page, 'layout'>): ReadonlySet<string> {
  let found = signing.get(page.layout);
  if (found) return found;
  const fields = new Set<string>();
  const walk = (part: unknown): void => {
    if (Array.isArray(part)) return part.forEach(walk);
    if (!part || typeof part !== 'object') return;
    const node = part as Partial<FieldNode>;
    if (node.type === 'field' && node.widget === 'signature' && typeof node.field === 'string' && signsAnswers(node)) fields.add(node.field);
    Object.values(part).forEach(walk);
  };
  walk(page.layout);
  signing.set(page.layout, (found = fields));
  return found;
}

/** Every answer a signature of the page that signs answers kept signed in these values, by field: what a form locks. */
export function signedBy(page: Pick<Page, 'layout' | 'fields'>, values: Readonly<Values>): SignedBy {
  let found: Map<string, { field: string; evidence: SignatureEvidence }> | null = null;
  for (const field of signingFields(page)) {
    const evidence = page.fields[field]?.type === 'binary' ? evidenceOf(values[field]) : null;
    if (!evidence) continue;
    found ??= new Map();
    for (const name of evidence.fields) if (name !== field && !found.has(name)) found.set(name, { field, evidence });
  }
  return found ?? none;
}
