/**
 * The slice of Grafloria's dashboard kit the screen editor uses, declared
 * rather than imported. The app passes the real kit in —
 * `import * as grafloria from '@grafloria/element'` — so the designer does
 * not pin a Grafloria version, a survey-only app does not load it, and the
 * editor can be tested without a browser. If Grafloria changes one of these
 * shapes, this file is the diff. The names match `@grafloria/element`.
 */

/** A field on a section's board. */
export interface GrafloriaWidget {
  id: string;
  kind?: string;
  /** Columns wide. */
  span?: number;
  /** Rows tall. */
  rows?: number;
  x?: number;
  y?: number;
  limits?: { minSpan?: number; maxSpan?: number; minRows?: number; maxRows?: number };
  title?: string;
  data?: Record<string, unknown>;
}

export interface GrafloriaBoardOptions {
  columns: number;
  sizing: 'grow';
  rowHeight: number;
  gap: number;
  /** True: fields stay on the cells they are given; nothing packs them upward. */
  float: boolean;
  widgets: GrafloriaWidget[];
  /** Paint one field into its host. Called once per field as it mounts, and on `repaint()`. */
  renderWidget(widget: GrafloriaWidget, host: HTMLElement): void;
  /** After a drag or resize is committed, with every field's cell. */
  onLayoutChange?(viewId: string, widgets: GrafloriaWidget[]): void;
  /** A field was pressed (its id), or the board's empty space (undefined). */
  onSelect?(id: string | undefined, viewId: string): void;
  binder?: { dragOut?: 'remove' | 'cancel' };
}

export interface GrafloriaBoardHandle {
  selectWidget(id: string | undefined): boolean;
  getSelectedWidget(): string | undefined;
  widget(id: string): { repaint(): void } | undefined;
  dispose(): void;
}

export interface GrafloriaBoard {
  readonly handle: GrafloriaBoardHandle;
}

/** What the screen editor needs from `@grafloria/element`. */
export interface Grafloria {
  dashboard(options: GrafloriaBoardOptions): GrafloriaBoard;
  render(board: GrafloriaBoard, host: HTMLElement): { dispose?(): void } | null | undefined | void;
}
