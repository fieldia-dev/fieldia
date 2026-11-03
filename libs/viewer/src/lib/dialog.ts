import type { PageLook, PanelSide, RecordId, RelatedRecord, Theme, Values } from '@fieldia/core';
import type { Tokens } from './look';
import { mountViewer, type Skin, type ViewerOptions } from './viewer';
import { withActs } from './viewer-parts';

/**
 * A page in a dialog: a new related record, a line to edit, a quick task. The
 * dialog saves (Save & Close) or closes without saving (Discard, ×, Escape);
 * the page's own Save and Discard stay hidden. The focus moves into the dialog,
 * Tab stays inside it, and the focus goes back where it was when it closes.
 * A side panel (`openFormPanel`) is the same box at the edge of the screen.
 */

export interface FormDialogOptions extends ViewerOptions {
  title: string;
  /**
   * How big: small, medium (the default), large, the whole window — or
   * `inset`, as a work item's window over its backlog: 96 pixels in from the
   * window's sides and 46 from its top and bottom, the whole window under 760.
   */
  size?: 'small' | 'medium' | 'large' | 'full' | 'inset';
  /** The page behind dimmed (the default), or `clear`: left as it is, though out of reach while the dialog is open. */
  backdrop?: 'dim' | 'clear';
  /** A ⤢ beside × that fills the window with it, and Restore that puts it back. */
  maximise?: boolean;
  /** A grip at its end-bottom corner that resizes it, by dragging, or by the arrow keys while it has the focus. */
  resizable?: boolean;
  /**
   * "save" (the default) saves the record through the data source. "values"
   * only checks the form and hands its values back, for something saved with
   * a bigger record, such as a line.
   */
  mode?: 'save' | 'values';
  /**
   * Recalculates the values as they change, for a dialog with no data source of
   * its own: a line's subtotal following its quantity. What comes back is shown.
   */
  recompute?: (values: Values) => Promise<Values>;
  /** Where the dialog goes: the document's body by default. */
  container?: HTMLElement;
  /** The look of the page that opened it, worn by the dialog and the page in it, unless that page has a look of its own. */
  look?: PageLook;
  /** Closed, as not saved and nothing asked, when it aborts: the viewer that opened it is taken away (`destroy()`). */
  signal?: AbortSignal;
}

export interface FormDialogResult {
  /**
   * True when Save & Close (Done, in a panel in "values" mode) was pressed and the form accepted — and, once any save
   * or send in it went through, whichever way it closed after: Discard, Escape, ×, a `close` step.
   */
  saved: boolean;
  recordId: RecordId | null;
  /** Its values as it closed: once a save went through, a change the person let go after it is not among them. */
  values: Values;
}

/** A page in a side panel: the dialog's options, with the edge it comes from and its depth in place of a size. */
export interface FormPanelOptions extends Omit<FormDialogOptions, 'size'> {
  /**
   * The edge it comes from: `end` (the default: the end of the line, the right,
   * or the left right to left) or `start`, as the page reads; or `left`,
   * `right`, `top` or `bottom` of the screen, whatever the page's direction.
   */
  side?: PanelSide;
  /** A panel at the end, start, left or right: about 420, 560 (the default) or 720 pixels wide on a wide screen; the whole screen on a phone. */
  width?: 'narrow' | 'medium' | 'wide';
  /** A panel at the top or bottom, the whole width: about 40, 60 (the default) or 85 in a hundred of the screen's height; the whole screen on a phone. */
  height?: 'short' | 'medium' | 'tall';
}

export { FIRST_FIELD, focusField } from './focus-field';

/**
 * A page in a dialog. Its code is the acts part's (viewer-parts.ts, `withActs`), which no page draws from: at once once it
 * has come, else once it does, what asked for it busy meanwhile. Rejects where the part cannot come: nothing opened.
 */
export function openFormDialog(options: FormDialogOptions): Promise<FormDialogResult> {
  return withActs((part) => part.openFormDialog(options, mountViewer), options.container?.ownerDocument);
}

/**
 * A page in a side panel: the dialog's twin, at full height along the
 * inline-end edge (the left, right to left) unless it names another `side` —
 * the whole width along the top or the bottom — the page behind dimmed but in
 * sight; a full-screen sheet on a phone, from above for the top, from below
 * for the rest. It saves, or in "values" mode hands back its values with
 * Done, as the dialog does; Escape and × ask first when there are changes to
 * lose. A dialog opened from it sits above it, and a panel opened from it
 * stacks over it, this one stepped back from its own edge. In the acts part, as the dialog is.
 */
export function openFormPanel(options: FormPanelOptions): Promise<FormDialogResult> {
  return withActs((part) => part.openFormPanel(options, mountViewer), options.container?.ownerDocument);
}

export interface SearchDialogOptions {
  title: string;
  /** Finds records for what is typed: the field's own search, filter and all. */
  search(query: string, limit: number): Promise<RelatedRecord[]>;
  /** A language tag; the dialog's words are in it when Fieldia has them, English otherwise. */
  locale?: string;
  skin?: Skin;
  dir?: 'ltr' | 'rtl';
  /** Where the dialog goes: the document's body by default. */
  container?: HTMLElement;
  /** The look of the page that opened it: its accent, scheme, font, room and corners. */
  look?: PageLook;
  /** The opener's theme, over its look's. */
  theme?: Theme;
  /** The opener's host's tokens, over everything else. */
  tokens?: Tokens;
  /** Closed, with nothing picked, when it aborts: the viewer that opened it is taken away. */
  signal?: AbortSignal;
}

/**
 * A searchable list in a dialog, for "Search more…": every record the field may
 * point to, narrowed as the person types, picked with a click or the keyboard.
 * Resolves with the record picked, or null when closed. In the acts part, as the dialog is.
 */
export function openSearchDialog(options: SearchDialogOptions): Promise<RelatedRecord | null> {
  return withActs((part) => part.openSearchDialog(options), options.container?.ownerDocument);
}
