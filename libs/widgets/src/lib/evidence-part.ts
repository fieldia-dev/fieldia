/**
 * The evidence part (parts.ts): a signature that signs answers (`options.signs`) — the canonical form of the answers it
 * signs and their SHA-256 (signature-evidence.ts: the browser's SubtleCrypto, else worked out the same where a page is
 * served without https), its signing and its line under the signature — who and when, whether the answers are as
 * signed, Change answers (signature-signing.ts) — and their sheet (styles-evidence.ts). Loaded the first time a page
 * shows such a signature, through `evidencePart`: never for a page with uploads or a plain signature, whose files part
 * draws the pad and keeps the picture; until it comes, a signing waits for it, and a save for the signing. The answers a
 * signature signed are locked by @fieldia/core whatever draws it (signed.ts).
 *
 * An app checks a record it keeps the same way: `(await evidencePart.load()).answersMatch(record.signature.signed,
 * page, 'signature', record)`, or writes the canonical text (`signatureText`) in its own language.
 */
export { SIGNATURE_FORMAT, answersMatch, answersToSign, canonicalJson, sha256Hex, signAnswers, signatureFields, signatureText, signedAnswer, signedAnswers, type SignedText } from './signature-evidence';
export { signingFor, type Signing, type SigningContext } from './signature-signing';
export { installEvidenceStyles } from './styles-evidence';
