import type { FileValue, Form, FormState, RecordRequest } from '@fieldia/core';
import { mountChatter, type ChatterOptions } from './chatter';
import type { ChatterSource, RecordRef } from './source';

export interface ChatterSlotOptions extends Omit<ChatterOptions, 'record'> {
  /** The model the conversation is about; the page's own by default. */
  model?: string;
}

/**
 * What fills a sheet's chatter slot: the conversation of the record the form
 * shows. It waits while the record is new, starts once it is saved, follows
 * the form to another record, and fetches again after each save and each
 * time the record is loaded again — when a backend posts what changed. What
 * a `post` step or the app's answer posts, it posts.
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
      } else if ((state.status === 'saved' && status !== 'saved') || (state.status === 'ready' && status === 'loading')) {
        void chatter.refresh();
      }
      status = state.status;
    });
    // Words a step or the app posts go in the conversation as a message or a note.
    const unpost = form.on('post', ({ message }) => {
      const record = recordOf(form.getState());
      if (record) void options.source.post(record, { kind: message.kind, body: message.body }).then(() => chatter.refresh());
    });
    return () => {
      unsubscribe();
      unpost();
      chatter.destroy();
    };
  };
}

/**
 * A record's attachments from its conversation, newest first — the pictures
 * and PDFs sent with its messages — as a data source's `attachments`, for a
 * sheet's attachment preview: `{ ...dataSource, attachments: chatterAttachments(source) }`.
 * Only those with an address are given.
 */
export function chatterAttachments(source: ChatterSource): (request: RecordRequest) => Promise<FileValue[]> {
  return async ({ model, id }) => {
    const messages = await source.messages({ model, id });
    return messages.flatMap((message) => message.attachments ?? []).flatMap((file) => (file.url ? [{ name: file.name, type: file.type, size: file.size, url: file.url }] : []));
  };
}
