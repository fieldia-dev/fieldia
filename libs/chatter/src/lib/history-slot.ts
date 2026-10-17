import type { Form, FormState } from '@fieldia/core';
import type { HistoryOptions } from './history';
import { historyPart } from './chatter-parts';
import { drawnLater } from './later';
import type { RecordRef } from './source';

/**
 * What fills a page's history slot: the history of the record the form
 * shows, its State Graph's colours the page's own dot's. It follows the form
 * to another record, and fetches again after each save and each time the
 * record is loaded again.
 *
 *   mountViewer(host, { page, dataSource, slots: { history: historySlot({ source, stateField: 'state', reasonField: 'reason', kind: 'work item' }) } })
 */
export function historySlot(options: HistoryOptions): (element: HTMLElement, context: { form: Form }) => () => void {
  return (element, { form }) => {
    const model = form.page.data.kind === 'record' ? form.page.data.model : null;
    const recordOf = (state: FormState): RecordRef | null => (model && state.recordId != null ? { model, id: state.recordId } : null);
    let shown = recordOf(form.getState());
    let status = form.getState().status;
    // The history's code comes the first time one is shown (a tab of its own, built as it is opened): drawn whole once it has.
    const draw = ({ mountHistory, stateColours }: NonNullable<typeof historyPart.loaded>, record: RecordRef | null) =>
      mountHistory(element, { records: form.page.records, ...options, record, ...(options.stateField ? { stateColour: stateColours(form.page, options.stateField) } : {}) });
    const history = historyPart.loaded ? draw(historyPart.loaded, shown) : drawnLater(element, shown, historyPart.load().then((part) => (record) => draw(part, record)));
    const unsubscribe = form.subscribe((state) => {
      const next = recordOf(state);
      if (next?.id !== shown?.id) {
        shown = next;
        void history.setRecord(next);
      } else if ((state.status === 'saved' && status !== 'saved') || (state.status === 'ready' && status === 'loading')) {
        void history.refresh();
      }
      status = state.status;
    });
    return () => {
      unsubscribe();
      history.destroy();
    };
  };
}
