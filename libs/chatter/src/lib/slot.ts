import type { FileValue, Form, FormState, RecordRequest } from '@fieldia/core';
import { textPart, type Part, type TextReference } from '@fieldia/widgets';
import { mountChatter, wantsChannels, type ChatterOptions } from './chatter';
import { channelsPart, discussionPart } from './chatter-parts';
import { drawnLater } from './later';
import type { ChatterSource, RecordRef } from './source';

export interface ChatterSlotOptions extends Omit<ChatterOptions, 'record'> {
  /** The model the conversation is about; the page's own by default. */
  model?: string;
  /**
   * `discussion`: drawn as a work item's Discussion — a card to write a
   * comment in, then a card for each comment — with no messages and notes
   * bar, no followers, no activities and no tracked changes.
   */
  look?: 'discussion';
  /** A discussion's words in its empty comment box. */
  placeholder?: string;
  /** A discussion's records linked by a key as a comment is typed: "#" for a work item. */
  references?: readonly TextReference[];
  /** How many comments the discussion has, after each load and each one saved: for a count in the record's head. */
  onCount?: (count: number, form: Form) => void;
}

/**
 * What fills a sheet's chatter slot: the conversation of the record the form
 * shows. It waits while the record is new, starts once it is saved, follows
 * the form to another record, and fetches again after each save and each
 * time the record is loaded again — when a backend posts what changed. What
 * a `post` step or the app's answer posts, it posts. Its activities' hours
 * and its messages' times are on the page's clock (`timeZone`), its days
 * written in the page's order, its today the form's; what it is answered is
 * laid only on the record the form still shows (`form.recordShown`).
 *
 *   mountViewer(host, { page, dataSource, slots: { chatter: chatterSlot({ source }) } })
 */
export function chatterSlot(options: ChatterSlotOptions): ((element: HTMLElement, context: { form: Form }) => () => void) & { readonly parts: readonly Part[] } {
  // A Discussion's code and its editor are parts loaded on first use: named, so the viewer draws the page once they are
  // in; so is a conversation's that knows its channels or is live.
  const parts: readonly Part[] = options.look === 'discussion' ? [discussionPart, textPart] : wantsChannels(options) ? [channelsPart] : [];
  return Object.assign((element: HTMLElement, { form }: { form: Form }) => {
    const model = options.model ?? (form.page.data.kind === 'record' ? form.page.data.model : null);
    const recordOf = (state: FormState): RecordRef | null => (model && state.recordId != null ? { model, id: state.recordId } : null);
    let shown = recordOf(form.getState());
    let status = form.getState().status;
    const { look, placeholder, references, onCount, ...rest } = options;
    // A discussion's code, and the editor of its comment box, come the first time one is shown: drawn whole once they have.
    const discussion = (part: NonNullable<typeof discussionPart.loaded>, record: RecordRef | null) =>
      part.mountDiscussion(element, { ...rest, records: form.page.records, record, placeholder, references, onCount: (count) => onCount?.(count, form) });
    const chatter =
      look !== 'discussion'
        ? mountChatter(element, {
            ...rest,
            records: form.page.records,
            record: shown,
            timeZone: rest.timeZone ?? form.page.timeZone,
            dateOrder: rest.dateOrder ?? form.page.look?.dateOrder,
            now: rest.now ?? (() => form.now()),
            recordShown: rest.recordShown ?? (() => form.recordShown()),
          })
        : discussionPart.loaded && textPart.loaded
          ? discussion(discussionPart.loaded, shown)
          : drawnLater(element, shown, Promise.all([discussionPart.load(), textPart.load()]).then(([part]) => (record) => discussion(part, record)));
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
  }, { parts });
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
