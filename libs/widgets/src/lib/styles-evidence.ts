import { installPartStyles, PART_RANK } from './styles';

/**
 * A signature's evidence (signature-signing.ts): who signed and when, whether the answers are as signed, and Change
 * answers asked in place, under the signature — the evidence part's sheet, put in its place among Fieldia's the first
 * time a page draws a signature that signs answers (installPartStyles, PART_RANK.evidence).
 *
 * It goes right after the files' sheet, whose signature it writes under: it names only its own parts (and the note
 * under the pad it writes news in), nothing of the files' sheet comes after it to undo it, and a theme still reshapes
 * its buttons and their focus, and the page's own looks win over it, as over the files'. The question's look is the
 * main sheet's (a file's Remove asks the same way).
 */
export const EVIDENCE_CSS = /* css */ `
/* Who signed and when, whether the answers are as signed, and Change answers: under the signature, a line that wraps;
   the day and time kept together. */
.fd-signature-evidence { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; width: 100%; font-size: 13px; }
.fd-signature-who { font-weight: 600; }
.fd-signature-when { white-space: nowrap; }
.fd-signature-state { color: var(--fd-success); }
.fd-signature-state[data-changed] { color: var(--fd-warning); font-weight: 600; }
.fd-signature-state > [aria-hidden] { margin-inline-end: 4px; }
.fd-signature-evidence > .fd-signature-ask { flex-basis: 100%; }
/* What was done (the signature taken away) is news, not a warning. */
.fd-signature-note[data-news] { color: var(--fd-muted); }
/* On paper: who and when, and whether the answers are as signed; not the way to change them. */
@media print { .fd-form :is(.fd-signature-change, .fd-signature-ask) { display: none !important; } }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installEvidenceStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-evidence-styles', EVIDENCE_CSS, PART_RANK.evidence);
}
