import type { RecordRef } from './source';

/** What the chatter's views hand back: a conversation, a discussion, a history. */
export interface ViewHandle {
  readonly element: HTMLElement;
  refresh(): Promise<void>;
  setRecord(record: RecordRef | null): Promise<void>;
  destroy(): void;
}

/**
 * A view drawn once its code has come (a part loaded the first time a page
 * shows it): `draw` is handed the record it was last told to show, and its
 * element goes in `host` as it would have at once. Until then the handle
 * keeps that record; destroyed before, it never draws. A part that cannot
 * come leaves `host` as it is.
 */
export function drawnLater<H extends ViewHandle>(host: HTMLElement, record: RecordRef | null, code: Promise<(record: RecordRef | null) => H>): ViewHandle {
  let shown = record;
  let view: H | null = null;
  let gone = false;
  const ready = code.then(
    (draw) => {
      if (!gone) view = draw(shown);
    },
    () => undefined
  );
  return {
    get element() {
      return view?.element ?? host;
    },
    // Before it is drawn, it fetches as it is drawn, and for the record it was last told.
    refresh: () => (view ? view.refresh() : ready),
    setRecord(next) {
      shown = next;
      return view ? view.setRecord(next) : ready;
    },
    destroy() {
      gone = true;
      view?.destroy();
    },
  };
}
