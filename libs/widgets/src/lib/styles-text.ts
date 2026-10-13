/**
 * A work item's body, as its editor draws it: a group's heading with its tools
 * at the end, groups of their own column widths, help in a light box, the
 * formatted text's editors (rich and Markdown) with their toolbars and menus,
 * and a links box. Written with logical properties, so right to left mirrors
 * on its own; every colour from a token, so a host's colours and the dark
 * scheme reach it. The tokens a work item adds (`link`, `help`) fall back to
 * Fieldia's own until a host gives them.
 */
export const TEXT_CSS = /* css */ `
.fd-form, .fd-theme {
  --fd-text-link: var(--fd-link, var(--fd-accent));
  --fd-text-fill: var(--fd-fill, color-mix(in srgb, var(--fd-text) 6%, var(--fd-surface)));
  --fd-text-hover: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface));
  --fd-text-pressed: color-mix(in srgb, var(--fd-text) 20%, var(--fd-surface));
  --fd-text-help: var(--fd-help, color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)));
  --fd-depth-4: 0 1.6px 3.6px rgb(0 0 0 / 0.132), 0 0.3px 0.9px rgb(0 0 0 / 0.108);
  --fd-depth-8: 0 3.2px 7.2px rgb(0 0 0 / 0.132), 0 0.6px 1.8px rgb(0 0 0 / 0.108);
}

/* ---- a group's own column widths (tracks), from a tablet's width up ---- */
@container (min-width: 761px) { .fd-form .fd-grid[data-tracks] { grid-template-columns: var(--fd-track-list); } }

/* ---- a group's heading with tools at its end: 16px words, a rule 50px down ---- */
.fd-form .fd-section[data-head] { gap: 0; --fd-group-inset: 8px; }
.fd-form .fd-section[data-head] > .fd-section-title {
  display: flex; align-items: center; float: none; width: 100%; box-sizing: border-box; min-height: 51px; margin: 0; padding: 0;
  border-block-end: 1px solid var(--fd-border); font-size: 16px; font-weight: 600; line-height: 22px; color: var(--fd-heading, var(--fd-text));
  text-transform: none; letter-spacing: 0;
}
.fd-form .fd-section[data-head] > .fd-section-title > .fd-section-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.fd-form .fd-section[data-head] > .fd-section-title .fd-icon { margin-inline-end: 0.4em; }
.fd-form .fd-section[data-head] > .fd-grid { padding: 4px var(--fd-group-inset) 0; row-gap: 7px; }
/* Its fields: a 12px label on a 16px line right over a 32px box, words 7px into it, 55px from one label to the next. */
.fd-form .fd-section[data-head] { --fd-pad-x: 6px; --fd-control-height: 32px; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field { gap: 0; line-height: 20px; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field > .fd-label { font-size: 12px; line-height: 16px; font-weight: 400; color: var(--fd-muted); }
/* A number's box is a compact one, 22px: 45px from its label to the next one, as the tracker's numbers (measured 20.22.23). */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field:is([data-type="integer"], [data-type="float"]) > input.fd-input { height: 22px; min-height: 22px; padding-block: 0; }
/* A lock in such a group is drawn in the words' colour, a padlock 12px wide and 13px tall, as the tracker's. */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field .fd-lock { color: var(--fd-text); }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field .fd-lock .fd-icon { width: 15px; height: 15px; }
/* At a value's start, its padlock's edge a pixel past the label's, as the tracker's: the 18px button pulled 2px back and up. */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field[data-lock-at="value"] > .fd-lock-wrap { margin-inline-start: -2px; inset-block-start: -1.5px; }
/* Groups with such headings, one under another: 11px from one's last part to the next one's heading. */
.fd-form .fd-grid:has(> .fd-section[data-head]) { row-gap: 11px; }
.fd-section-tools { display: flex; align-items: center; gap: 2px; margin-inline-start: auto; flex: none; opacity: 0; transition: opacity 0.1s ease; }
/* In a work heading its tools sit low, their middle 8px under the title's, as the tracker's do (measured 20.22.23). */
.fd-form .fd-section[data-head] > .fd-section-title .fd-section-tools { align-self: flex-end; margin-block-end: 1px; margin-inline-end: -2px; }
/* Pointed at, worked in or folded, a group shows its tools; where nothing can point, always. */
.fd-form .fd-section[data-head]:is(:hover, :focus-within, .fd-section-folded, [data-maximised]) > .fd-section-title .fd-section-tools { opacity: 1; }
@media (hover: none) { .fd-section-tools { opacity: 1; } }
:is(.fd-section-tool, .fd-field-tool) {
  display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 2px;
  background: none; color: var(--fd-text); cursor: pointer; font: inherit;
}
:is(.fd-section-tool, .fd-field-tool):hover { background: var(--fd-text-hover); }
:is(.fd-section-tool, .fd-field-tool):active { background: var(--fd-text-pressed); }
:is(.fd-section-tool, .fd-field-tool):focus-visible { outline: 1px solid var(--fd-focus); outline-offset: -1px; }
/* Their icons 18px in thin lines of the words' colour: ⤢ 13px across, ^ 9px, ✎ 13px, as the tracker's (measured 20.22.23). */
:is(.fd-section-tool, .fd-field-tool) svg { width: 18px; height: 18px; stroke-width: 1.6; }
/* In the words' colour too in a heading, whose own icon before its name is muted. */
.fd-section-title .fd-section-tools .fd-icon { color: inherit; }
/* Shown alone over the body: the parts round it out of sight, its own heading still there to put it back. */
.fd-form [data-unshown] { display: none !important; }
.fd-form .fd-grid[data-maximising] { grid-template-columns: minmax(0, 1fr) !important; }
.fd-form .fd-grid[data-maximising] > * { grid-column: 1 / -1 !important; }
.fd-form .fd-section[data-maximised] { min-height: 60vh; }

/* ---- help in a light box, room for an icon at its start ---- */
.fd-help-box {
  position: relative; margin: 0; padding: 10px 12px 10px 50px; padding-inline: 50px 12px; min-height: 37px; box-sizing: border-box;
  background: var(--fd-text-help); color: var(--fd-text); font-size: 14px; line-height: 17px; overflow-wrap: anywhere;
}
.fd-help-box > p { margin: 0; }
.fd-help-box-icon, .fd-links-help-icon { position: absolute; inset-inline-start: 11px; inset-block-start: 50%; translate: 0 -50%; width: 28px; height: 30px; color: var(--fd-muted); stroke-width: 1.4; }
:is(.fd-help-box, .fd-links-help, .fd-text-help) a { color: var(--fd-text-link); text-decoration: underline; }

/* ---- the formatted text's editors ---- */
.fd-text { position: relative; display: grid; min-width: 0; --fd-text-pad-x: 5px; }
.fd-text[hidden] { display: none; }
.fd-text-box { position: relative; display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--fd-border); border-radius: 2px; background: var(--fd-surface); }
.fd-text-box:focus-within { border-color: var(--fd-focus); }
.fd-text-area { position: relative; min-height: 85px; padding: 5px var(--fd-text-pad-x); line-height: 20px; color: var(--fd-text); outline: none; overflow-wrap: anywhere; cursor: text; }
.fd-text-area.fd-blank:not(:focus)::before { content: attr(data-placeholder); position: absolute; color: var(--fd-muted); font-style: italic; pointer-events: none; }
/* The box round them shows where the focus is: no ring of their own. */
.fd-form :is(.fd-text-area, .fd-md-input, .fd-md-preview, .fd-md-view):focus-visible { outline: none; }
.fd-text-area[contenteditable="false"] { cursor: default; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) :is(p, ul, ol, blockquote, pre, h1, h2, h3, h4) { margin: 0 0 6px; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) > :last-child { margin-block-end: 0; }
/* Each block runs the way its words are written, on a page of either direction. */
:is(.fd-text-area, .fd-md-view, .fd-md-preview) > * { unicode-bidi: plaintext; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) :is(ul, ol) { padding-inline-start: 24px; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) a { color: var(--fd-text-link); text-decoration: underline; }
/* A link alone on its line is a target of its own: 24px tall to a finger, its line no taller. */
:is(.fd-md-view, .fd-md-preview) a { padding-block: 4px; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) code { padding: 0 3px; border-radius: 2px; background: var(--fd-text-fill); font: 13px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) pre { padding: 8px 10px; background: var(--fd-text-fill); overflow-x: auto; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) pre code { padding: 0; background: none; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) blockquote { padding-inline-start: 10px; border-inline-start: 3px solid var(--fd-border); color: var(--fd-muted); }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) img { max-width: 100%; height: auto; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) li[data-task] { list-style: none; position: relative; }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) li[data-task]::before {
  content: ""; position: absolute; inset-inline-start: -20px; inset-block-start: 4px; width: 12px; height: 12px;
  border: 1px solid var(--fd-border-strong); border-radius: 2px; background: var(--fd-surface);
}
:is(.fd-text-area, .fd-md-view, .fd-md-preview) li[data-task="done"]::before { background: var(--fd-accent); border-color: var(--fd-accent); box-shadow: inset 0 0 0 2px var(--fd-surface); }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) li[data-task="done"] { text-decoration: line-through; color: var(--fd-muted); }
:is(.fd-text-area, .fd-md-view, .fd-md-preview) :is([data-mention], [data-record]) { color: var(--fd-text-link); font-weight: 600; }
.fd-external { width: 12px; height: 12px; margin-inline-start: 4px; vertical-align: -1px; color: var(--fd-muted); stroke-width: 2; }
/* The toolbar only while the text is worked in: no edge and no tools at rest, a light box when pointed at. */
/* Not in Markdown, whose card keeps its own room; :where, so a host's own rule (a comment box's 0) still wins. */
.fd-text[data-toolbar="focus"]:not(:where([data-editor="markdown"])) { padding-block-end: 17px; }
.fd-text[data-toolbar="focus"] > .fd-text-box { border-color: transparent; background: transparent; }
.fd-text[data-toolbar="focus"]:focus-within > .fd-text-box { background: var(--fd-surface); }
.fd-text[data-toolbar="focus"] > .fd-text-box:hover { border-color: var(--fd-border); }
.fd-text[data-toolbar="focus"]:focus-within > .fd-text-box { border-color: var(--fd-focus); }
.fd-text[data-toolbar="focus"]:not(:focus-within) .fd-text-bar { display: none; }
.fd-text[data-toolbar="focus"]:not(:focus-within) .fd-text-area { min-height: 48px; }
.fd-text:not([data-switch="always"]):not(:focus-within) .fd-text-switch { display: none; }
.fd-text-under { display: flex; flex-wrap: wrap; align-items: start; justify-content: flex-end; gap: 0 12px; min-width: 0; }
.fd-text-under:empty, .fd-text-under:not(:has(.fd-text-switch)):has(> .fd-text-say:empty) { display: none; }
.fd-text-say { flex: 1 1 auto; margin: 2px 0 0; color: var(--fd-muted); font-size: 12px; line-height: 16px; }
.fd-text-say:empty { display: none; }
.fd-text-switch {
  margin: 2px 0 0; padding: 0; border: 0; background: none; color: var(--fd-text-link); font: 12px/16px var(--fd-font); text-decoration: underline; cursor: pointer;
}
.fd-text-switch:focus-visible, .fd-links-empty-link:focus-visible, .fd-md-preview-switch:focus-visible, .fd-links-name:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: 1px; }
.fd-text-ask { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-block-start: 6px; padding: 8px 10px; border-radius: 2px; background: var(--fd-warning-soft); color: var(--fd-text); font-size: 13px; }
/* The toolbar: 32px tools 3px apart, inside the box at its foot (or its head); "…" for those with no room. */
/* Its end keeps a little room: a tool that would touch the box's edge goes under "…". */
.fd-text-bar { display: flex; align-items: center; gap: 3px; min-width: 0; padding: 0 12px 5px 6px; padding-inline: 6px 12px; overflow: hidden; }
.fd-text[data-bar-at="top"] .fd-text-box > .fd-text-bar { padding-block: 5px 0; }
.fd-text-tool {
  position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 2px; background: none; color: var(--fd-text); font: inherit; cursor: pointer;
}
.fd-text-tool[hidden] { display: none; }
/* A tool with a list: its icon, then the chevron; the size's two letters wider. */
.fd-text-tool-choice { width: 46px; justify-content: flex-start; padding-inline-start: 5px; }
.fd-text-tool-choice[data-tool="size"] { width: 56px; padding-inline-start: 8px; }
.fd-text-icon-size { width: 20px; }
.fd-text-tool:hover { background: var(--fd-text-hover); }
.fd-text-tool:is([aria-pressed="true"], .fd-pressed, [aria-expanded="true"]) { background: var(--fd-text-pressed); }
.fd-text-tool:focus-visible, .fd-text-menu-item:focus-visible, .fd-links-add:focus-visible, .fd-links-remove:focus-visible {
  outline: 1px solid var(--fd-focus); outline-offset: -1px; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--fd-focus) 25%, transparent);
}
.fd-text-icon { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.fd-text-tool > svg.fd-icon { stroke-width: 1.6; }
.fd-text-accent { fill: var(--fd-accent); stroke: none; }
.fd-text-ink { fill: currentColor; stroke: none; }
.fd-text-accent-line { stroke: var(--fd-accent); }
.fd-text-accent-fill { fill: var(--fd-accent); stroke: none; }
.fd-text-icon-highlight .fd-text-swatch { fill: #ffff00; stroke: none; }
.fd-text-icon-colour .fd-text-swatch { fill: #d13438; stroke: none; }
.fd-text-face { fill: #ffc83d; stroke: #c78b00; }
.fd-text-dot { fill: #5c3d00; stroke: none; }
.fd-text-icon-emoji path { stroke: #5c3d00; }
.fd-text-eraser { fill: #f7a6c8; stroke: #c4005e; }
.fd-text-cross { stroke: #d13438; stroke-width: 1.4; }
.fd-text-glyph-bold { font: 700 16px/1 var(--fd-font); }
.fd-text-glyph-strike { font: 400 15px/1 var(--fd-font); text-decoration: line-through; text-decoration-thickness: 1px; }
.fd-text-icon-emoji { width: 20px; height: 20px; }
/* A tool's list chevron 12px across, a thin line in the muted colour: its icon carries the tool, the chevron the list. */
.fd-text-chevron { width: 12px; height: 12px; margin-inline-start: 4px; fill: none; stroke: currentColor; stroke-width: 1; }
.fd-text-tool-choice > .fd-text-chevron { color: var(--fd-muted); }
/* ---- the Markdown editor: a card, the box, a hint, the toolbar and Preview ---- */
.fd-md-card {
  display: grid; min-width: 0; margin-block: 12px 11px; margin-inline: calc(-1 * var(--fd-group-inset, 0px)); padding: 20px 16px;
  border-radius: 4px; background: var(--fd-surface); box-shadow: var(--fd-depth-4);
}
.fd-text:not([data-editor="markdown"]) > .fd-md-card, .fd-text:not([data-editor="rich"]) > .fd-text-box { display: none; }
.fd-md-input, .fd-md-preview {
  display: block; width: 100%; min-width: 0; min-height: 84px; box-sizing: border-box; margin: 0; padding: 4px 4px;
  border: 1px solid var(--fd-border); border-radius: 4px; background: var(--fd-surface); color: var(--fd-text);
  font: 14px/20px var(--fd-font); resize: vertical;
}
.fd-md-input:focus, .fd-md-preview:focus { outline: none; border-color: var(--fd-focus); }
/* In its card, the card is the frame of what is edited: the box keeps its light edge, the caret in it, and no grip. */
.fd-md-card :is(.fd-md-input, .fd-md-preview), .fd-md-card :is(.fd-md-input, .fd-md-preview):focus { border-color: var(--fd-border); resize: none; }
/* Its tools in the words' colour alone, as a Markdown toolbar draws them: no accent in a list's marks. */
.fd-md-card .fd-text-bar :is(.fd-text-accent, .fd-text-accent-fill) { fill: currentColor; }
.fd-md-card .fd-text-bar .fd-text-accent-line { stroke: currentColor; }
.fd-md-input[hidden], .fd-md-preview[hidden] { display: none; }
.fd-md-hint { display: flex; flex-wrap: wrap; align-items: center; gap: 0 4px; margin: 7px 0 0; color: var(--fd-muted); font-size: 12px; line-height: 16px; }
.fd-md-hint > .fd-icon { width: 12px; height: 12px; stroke-width: 2; }
.fd-md-supported { color: var(--fd-text-link); }
.fd-md-row { display: flex; align-items: center; min-width: 0; margin-block-start: 2px; }
.fd-md-row > .fd-text-bar { flex: 1 1 auto; padding: 0; }
.fd-md-preview-switch {
  display: inline-flex; align-items: center; gap: 8px; flex: none; margin-inline-start: auto; padding: 0 0 0 8px; padding-inline: 8px 0;
  border: 0; background: none; color: var(--fd-text); font: 14px/20px var(--fd-font); cursor: pointer;
}
.fd-md-track { position: relative; width: 40px; height: 20px; box-sizing: border-box; border: 1px solid var(--fd-muted); border-radius: 10px; background: var(--fd-surface); }
.fd-md-track::after { content: ""; position: absolute; inset-block-start: 3px; inset-inline-start: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--fd-muted); transition: inset-inline-start 0.1s ease; }
.fd-md-preview-switch[aria-checked="true"] > .fd-md-track { border-color: var(--fd-accent); background: var(--fd-accent); }
.fd-md-preview-switch[aria-checked="true"] > .fd-md-track::after { inset-inline-start: 22px; background: var(--fd-accent-text, #fff); }
/* A Markdown field at rest: the text as it reads, a light box when pointed at; the card while it is edited. */
.fd-md-field { position: relative; display: grid; min-width: 0; }
.fd-md-view { min-height: 50px; box-sizing: border-box; padding: 2px 9px; border: 1px solid transparent; border-radius: 2px; line-height: 20px; overflow-wrap: anywhere; cursor: text; outline: none; }
.fd-md-view:hover { border-color: var(--fd-border); }
.fd-md-view:focus-visible { border-color: var(--fd-focus); }
.fd-md-view[aria-readonly="true"] { cursor: default; border-color: transparent; }
.fd-md-view.fd-blank::before { content: attr(data-placeholder); color: var(--fd-muted); font-style: italic; }
.fd-md-view[hidden] { display: none; }
/*
 * Empty, with no words of its own to say so, and its Edit in its group's heading (a lone field's tools): it takes no
 * room at rest, as a work item's empty Repro Steps — the heading's ✎, in the Tab order, starts it.
 */
.fd-form .fd-field:has(> .fd-md-field > .fd-field-tools:empty):has(> .fd-md-field > .fd-md-view.fd-blank:not([data-placeholder], [hidden])) { display: none; }
/* Its group then its heading alone: no room under the rule, and the next group's heading 8px below it (measured 20.24.05).
   (:has() chained, not nested: a :has() inside another is no selector at all.) */
.fd-form .fd-section[data-head] > .fd-grid:has(> .fd-field:only-child > .fd-md-field > .fd-field-tools:empty):has(> .fd-field:only-child > .fd-md-field > .fd-md-view.fd-blank:not([data-placeholder], [hidden])) { padding-block-start: 0; }
.fd-form .fd-section[data-head]:has(> .fd-grid > .fd-field:only-child > .fd-md-field > .fd-field-tools:empty):has(> .fd-grid > .fd-field:only-child > .fd-md-field > .fd-md-view.fd-blank:not([data-placeholder], [hidden])) { margin-block-end: -3px; }
.fd-field-tools { display: flex; justify-content: flex-end; gap: 2px; }
.fd-field-tools:not(:has(> :not([hidden]))) { display: none; }
.fd-section-tools .fd-field-tool[hidden] { display: none; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field :is(.fd-text[data-toolbar="focus"] > .fd-text-box, .fd-md-view) { margin-inline: 2px; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field .fd-text[data-toolbar="focus"] > .fd-text-box { margin-block-start: 1px; }
/* A lock in a group's 12px label keeps to the label's line. */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field > .fd-label .fd-lock-wrap { height: 16px; vertical-align: top; align-items: center; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field > .fd-label .fd-lock { height: 16px; }
/* ---- menus: a tool's choices, the tools with no room, a links box's Add link ---- */
.fd-text-menu {
  z-index: 60; display: grid; min-width: 160px; box-sizing: border-box; padding: 8px 0; border-radius: 2px;
  background: var(--fd-surface); color: var(--fd-text); box-shadow: var(--fd-depth-8);
}
.fd-text-menu[hidden] { display: none; }
.fd-text-menu-item {
  display: flex; align-items: center; gap: 10px; min-height: 31px; box-sizing: border-box; padding: 0 16px 0 16px; padding-inline: 16px;
  border: 0; background: none; color: var(--fd-text); font: 14px/20px var(--fd-font); text-align: start; white-space: nowrap; cursor: pointer;
}
.fd-text-menu-item:hover, .fd-text-menu-item:focus-visible { background: var(--fd-text-hover); }
.fd-text-menu-item > :is(svg, .fd-text-colour) { width: 16px; height: 16px; flex: none; }
.fd-text-menu-item > svg.fd-icon { stroke-width: 1.6; }
.fd-text-menu-item[aria-checked="true"] { font-weight: 600; }
.fd-text-colour { display: inline-block; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--fd-text) 25%, transparent); border-radius: 2px; }
.fd-text-colour-none { background: linear-gradient(to top right, transparent calc(50% - 1px), #d13438 calc(50% - 1px), #d13438 calc(50% + 1px), transparent calc(50% + 1px)); }
.fd-text-emoji { grid-template-columns: repeat(5, 36px); min-width: 0; padding: 6px; }
.fd-text-emoji > .fd-text-menu-item { justify-content: center; min-height: 32px; padding: 0; font-size: 18px; }
.fd-links-menu { width: 223px; }
.fd-links-menu .fd-text-menu-item { gap: 12px; padding-inline: 14px; }
/* People and records, as they are typed after their key. */
.fd-text-suggest {
  position: absolute; z-index: 50; inset-inline-start: 0; inset-block-start: 100%; min-width: 220px; max-width: 100%; max-height: 240px; overflow: auto;
  margin: 4px 0 0; padding: 4px 0; list-style: none; border-radius: 2px; background: var(--fd-surface); box-shadow: var(--fd-depth-8);
}
.fd-text-suggest > li { padding: 6px 12px; cursor: pointer; }
.fd-text-suggest > li[aria-selected="true"] { background: var(--fd-accent-soft); }
.fd-text-suggest > li.fd-empty { color: var(--fd-muted); cursor: default; }

/* ---- a links box: Add link, the records linked, help while there are none ---- */
.fd-links-box { display: grid; justify-items: start; min-width: 0; }
.fd-links-add {
  display: inline-flex; align-items: center; gap: 8px; height: 31px; padding: 0 13px; border: 0; border-radius: 2px;
  background: none; color: var(--fd-text); font: 600 14px/20px var(--fd-font); cursor: pointer;
}
.fd-links-add:hover { background: var(--fd-text-hover); }
.fd-links-add:is(.fd-pressed, [aria-expanded="true"]) { background: var(--fd-text-pressed); }
.fd-links-add > .fd-text-chevron { width: 12px; height: 12px; margin: 0; stroke-width: 1.2; }
.fd-links-add[hidden], .fd-links-list[hidden] { display: none; }
.fd-links-list { justify-self: stretch; display: grid; margin: 0; padding: 0; list-style: none; }
.fd-links-list > li { display: flex; align-items: center; gap: 8px; min-height: 32px; padding-inline: 13px 0; border-block-end: 1px solid var(--fd-border); }
.fd-links-name { flex: 1 1 auto; min-width: 0; padding: 0; border: 0; background: none; color: var(--fd-text-link); font: inherit; text-align: start; overflow-wrap: anywhere; cursor: pointer; }
span.fd-links-name { color: var(--fd-text); cursor: default; }
.fd-links-remove { display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 2px; background: none; color: var(--fd-text); cursor: pointer; }
.fd-links-remove:hover { background: var(--fd-text-hover); }
.fd-links-remove > svg { width: 14px; height: 14px; }
.fd-links-help { position: relative; justify-self: stretch; display: block; padding: 10px 12px; padding-inline: 50px 12px; background: var(--fd-text-help); font-size: 14px; line-height: 17px; overflow-wrap: anywhere; }
.fd-links-help > p { margin: 0; }
.fd-links-help[hidden], .fd-links-empty[hidden] { display: none; }
.fd-links-empty { justify-self: stretch; padding: 10px; background: var(--fd-text-help); line-height: 17px; }
.fd-links-empty-link { padding: 0; border: 0; background: none; color: var(--fd-text-link); font: 14px/17px var(--fd-font); text-align: start; text-decoration: underline; cursor: pointer; }
`;
