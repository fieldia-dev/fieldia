import type { Field } from '../format/field';
import type { SignatureEvidence, Value, Values } from './values';

/**
 * Answers a signature signed are locked while it is kept: each answer its evidence names (`FileValue.signed.fields`)
 * is read-only until the signature is taken away (its "Change answers") and signed again. The evidence itself — the
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

/** Every answer a signature kept in these values signed, by field: what a form locks while those signatures are kept. */
export function signedBy(fields: Readonly<Record<string, Field>>, values: Readonly<Values>): SignedBy {
  let found: Map<string, { field: string; evidence: SignatureEvidence }> | null = null;
  for (const [field, def] of Object.entries(fields)) {
    const evidence = def.type === 'binary' ? evidenceOf(values[field]) : null;
    if (!evidence) continue;
    found ??= new Map();
    for (const name of evidence.fields) if (name !== field && !found.has(name)) found.set(name, { field, evidence });
  }
  return found ?? none;
}
