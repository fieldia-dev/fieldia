import { installPartStyles, PART_RANK } from './styles';
import { SURVEY_LOOKS_CSS } from './styles-survey-looks';

/**
 * The survey part's sheets (survey-part.ts): a ranking, a matrix, a slider, pictures to choose from, a colour,
 * properties, an address and a progress bar. Their rules were cut from two places in Fieldia's stylesheet, and each
 * goes back where it stood: this one's from the first half (the skins' rules, the inputs' and the business widgets'),
 * after all of it and before the other parts' sheets (PART_RANK.survey); the looks' from the head of the page's own
 * looks (styles-survey-looks.ts), after every part's sheet and before the rest of those looks (PART_RANK.surveyLooks). A
 * rule that also styles something the main script draws stays there: properties' box (the designer's inspector
 * wears it), a line's grip (a table's lines have one).
 */
export const SURVEY_CSS = /* css */ `
/* ---- the survey kinds, cut from the skins', the inputs' and the business widgets' rules ------------------- */
.fd-progressbar-edit:has(> .fd-refusal-hint) { flex-wrap: wrap; }
.fd-progressbar-edit > .fd-refusal-hint { flex-basis: 100%; }
.fd-property { display: grid; grid-template-columns: minmax(120px, 30%) minmax(0, 1fr); align-items: center; gap: 12px; min-width: 0; }
.fd-property > label { color: var(--fd-muted); font-size: 13px; }
.fd-property[data-type="boolean"] > :nth-child(2) { justify-self: start; }
/* A row's problem and a refused key's hint, under its value, not its label. */
.fd-property > :is(.fd-property-error, .fd-refusal-hint) { grid-column: 2; margin-block-start: -8px; }
/* Beside their values, as the sheet's labels are: the same label column, the same words, the same gap between halves — the properties read as fields of the sheet. */
.fd-form[data-fd-skin="underline"] .fd-property { grid-template-columns: var(--fd-label-width, 11em) minmax(0, 1fr); }
.fd-form[data-fd-skin="underline"] .fd-property > label { color: var(--fd-text); font-size: inherit; font-weight: var(--fd-label-weight); }
/* Narrow — a phone, or a narrow card — each label above its value, the underline skin's rows too, as the sheet's fields go. */
@container (max-width: 520px) { .fd-property, .fd-form[data-fd-skin="underline"] .fd-property { grid-template-columns: minmax(0, 1fr); gap: 4px; } .fd-property > :is(.fd-property-error, .fd-refusal-hint) { grid-column: 1; margin-block-start: 0; } }
.fd-progressbar {
  position: relative; height: 22px; min-width: 120px; border-radius: 999px; overflow: hidden;
  background: var(--fd-page); border: 1px solid var(--fd-border); font-variant-numeric: tabular-nums;
}
.fd-progressbar-fill { height: 100%; background: var(--fd-success); transition: width 0.2s ease; }
.fd-progressbar[data-tone="warning"] .fd-progressbar-fill { background: #d97706; }
.fd-progressbar[data-tone="danger"] .fd-progressbar-fill { background: var(--fd-error); }
.fd-progressbar[data-tone="info"] .fd-progressbar-fill { background: var(--fd-info); }
/* The share in words, on a chip of the surface: it reads the same over the fill and the track, in either scheme. Centred by its left edge, so it is centred right to left too. */
.fd-progressbar-text { position: absolute; inset-block: 2px; left: 50%; translate: -50% 0; display: grid; place-items: center; padding-inline: 7px; border-radius: 999px; background: var(--fd-surface); font-size: 12px; line-height: 1; font-weight: 600; color: var(--fd-text); }
.fd-progressbar-text:empty { display: none; }
.fd-progressbar-edit { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fd-progressbar-edit > .fd-progressbar { flex: 1 1 auto; }
.fd-progressbar-edit > .fd-input { flex: 0 0 96px; }
/* A matrix: rows against columns; it scrolls sideways in its own box on a narrow screen. */
.fd-matrix { overflow-x: auto; max-width: 100%; }
.fd-matrix-table { border-collapse: collapse; min-width: 100%; }
.fd-matrix-table th, .fd-matrix-table td { padding: 6px 10px; text-align: center; border-bottom: 1px solid var(--fd-border); }
.fd-matrix-table thead th { font-weight: 500; font-size: 13px; color: var(--fd-muted); }
.fd-matrix-table tbody th { text-align: start; font-weight: 500; }
.fd-matrix-table input { accent-color: var(--fd-accent); width: 16px; height: 16px; margin: 0; }
/* Words under a slider's ends, each under its own end. */
.fd-slider-word { display: block; max-width: 12em; }
.fd-slider-last { text-align: end; }
/* A colour: a swatch of it, and a palette of Flectra's twelve under it; none is a crossed-out square. */
.fd-colour-box { position: relative; display: inline-flex; align-items: center; gap: 8px; }
.fd-colour-button, .fd-colour { width: 24px; height: 24px; padding: 0; border: 1px solid var(--fd-border-strong); border-radius: 4px; background: var(--fd-swatch, transparent); cursor: pointer; }
.fd-colour-button:disabled { cursor: default; }
.fd-colour-none, .fd-colour[data-colour="0"] { background: linear-gradient(to top right, transparent calc(50% - 1px), var(--fd-error) calc(50% - 1px), var(--fd-error) calc(50% + 1px), transparent calc(50% + 1px)); }
.fd-colour-palette { position: absolute; top: calc(100% + 4px); inset-inline-start: 0; z-index: 30; display: grid; grid-template-columns: repeat(6, 24px); gap: 6px; padding: 8px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16); }
.fd-colour[aria-checked="true"] { box-shadow: 0 0 0 2px var(--fd-surface), 0 0 0 4px var(--fd-accent); }
/* A colour as text: the browser's picker over a swatch of its own, so an empty colour shows as none, never black; its code beside it. */
.fd-colour-well { position: relative; display: inline-block; flex: none; width: 44px; height: 30px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); }
.fd-colour-well:focus-within { outline: 2px solid var(--fd-focus); }
.fd-colour-swatch { position: absolute; inset: 3px; border-radius: 2px; background-color: var(--fd-swatch); }
.fd-colour-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.fd-input.fd-colour-code { width: 11ch; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.fd-colour-clear { border: 0; background: none; color: var(--fd-muted); font-size: 18px; cursor: pointer; }
/* Properties: in two columns when asked, one on a narrow form; adding one in place, its name and kind in a row. */
.fd-properties-list { display: grid; gap: 8px; min-width: 0; }
.fd-properties[data-columns="2"] > .fd-properties-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--fd-gap-x, 24px); }
@container (max-width: 520px) { .fd-properties[data-columns="2"] > .fd-properties-list { grid-template-columns: minmax(0, 1fr); } }
.fd-property-add { justify-self: start; }
.fd-property-new { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fd-property-new > .fd-input { flex: 1 1 10em; width: auto; }
`;

/** The part's sheets in a document, once each, in their places among Fieldia's. */
export function installSurveyStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-survey-styles', SURVEY_CSS, PART_RANK.survey);
  installPartStyles(doc, 'fieldia-survey-looks', SURVEY_LOOKS_CSS, PART_RANK.surveyLooks);
}
