import type { Form, FormState } from '@fieldia/core';
import { mountChatter, type ChatterOptions } from './chatter';
import type { RecordRef } from './source';

export interface ChatterSlotOptions extends Omit<ChatterOptions, 'record'> {
  /** The model the conversation is about; the page's own by default. */
  model?: string;
}

/**
 * What fills a sheet's chatter slot: the conversation of the record the form
 * shows. It waits while the record is new, starts once it is saved, follows
 * the form to another record, and fetches again after each save, when a
 * backend posts what changed.
 *
 *   mountViewer(host, { page, dataSource, slots: { chatter: chatterSlot({ source }) } })
 */
export function chatterSlot(options: ChatterSlotOptions): (element: HTMLElement, context: { form: Form }) => () => void {
  return (element, { form }) => {
    const model = options.model ?? (form.page.data.kind === 'record' ? form.page.data.model : null);
    const recordOf = (state: FormState): RecordRef | null => (model && state.recordId != null ? { model, id: state.recordId } : null);
    let shown = recordOf(form.getState());
    let status = form.getState().status;
    const chatter = mountChatter(element, { ...options, record: shown });
    const unsubscribe = form.subscribe((state) => {
      const next = recordOf(state);
      if (next?.id !== shown?.id) {
        shown = next;
        void chatter.setRecord(next);
      } else if (state.status === 'saved' && status !== 'saved') {
        void chatter.refresh();
      }
      status = state.status;
    });
    return () => {
      unsubscribe();
      chatter.destroy();
    };
  };
}
