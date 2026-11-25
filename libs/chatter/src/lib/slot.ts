import { answerOf, fill, plainPart, type FileValue, type Form, type FormApproval, type FormState, type Locale, type RecordRequest, type Value } from '@fieldia/core';
import { displayValue, textPart, type Part, type TextReference } from '@fieldia/widgets';
import { mountChatter, textToHtml, wantsChannels, type ChatterHandle, type ChatterOptions } from './chatter';
import { chatterLabels, type ChatterLabels } from './labels';
import { channelsPart, discussionPart } from './chatter-parts';
import { drawnLater } from './later';
import type { ChatterMessage, ChatterSource, RecordRef } from './source';

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
  /**
   * False: the record's approval history (a page with `approval`) is not told among its messages — where the app's
   * server posts each decision in the conversation itself. Told unless it says so.
   */
  approvals?: boolean;
}

/**
 * A record's approval history as the chatter tells it among its messages: who sent it for approval, who approved or
 * rejected it at which level, and why — and who changed it while it waited for a decision, or after a rejection, as a
 * tracked change: each field from what to what (`said` writes a value as the page does) — events, newest first, never
 * posted to the source.
 */
export function approvalEntries(approval: FormApproval | null | undefined, labels: ChatterLabels, said: (field: string, value: Value) => string = (_field, value) => String(value)): ChatterMessage[] {
  if (!approval) return [];
  const words = (field: string, value: Value) => (value === null || value === undefined || value === '' ? null : said(field, value));
  const levelName = (id: string | undefined, kept: string | undefined) => approval.levels.find((level) => level.id === id)?.name ?? kept ?? id ?? '';
  return approval.history.map((entry, at) => {
    if (entry.decision === 'changed')
      return {
        id: `approval-${at}`,
        kind: 'event',
        author: { id: `approval-by-${entry.by}`, name: entry.by },
        date: entry.at,
        body: '',
        tracking: (entry.changes ?? []).map((change) => ({ field: change.field, label: change.label ?? change.field, from: words(change.field, change.from), to: words(change.field, change.to) })),
      };
    const what = entry.decision === 'requested' ? labels.approvalAsked : entry.decision === 'notNeeded' ? labels.approvalNotNeeded : fill(entry.decision === 'approved' ? labels.approvalApproved : labels.approvalRejected, { level: levelName(entry.level, entry.levelName) });
    return {
      id: `approval-${at}`,
      kind: 'event',
      author: { id: `approval-by-${entry.by}`, name: entry.by },
      date: entry.at,
      body: textToHtml(what) + (entry.reason ? `<blockquote>${textToHtml(entry.reason)}</blockquote>` : ''),
    };
  });
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
    const { look, placeholder, references, onCount, approvals, ...rest } = options;
    // A record's approval history, among its messages: told as the form knows it, kept up as it changes.
    const telling = approvals !== false && look !== 'discussion' && !!form.page.approval;
    const words = chatterLabels(rest.locale ?? 'en', rest.labels);
    // A value changed on its way to approval, written as the page writes it, its field named by the page's label.
    const said = (field: string, value: Value) => {
      const def = form.page.fields[field];
      return def ? displayValue(def as never, value, form.getState().values, (rest.locale ?? 'en') as Locale) : String(value);
    };
    const told = (approval: FormApproval | null | undefined) =>
      approvalEntries(approval, words, said).map((entry) => (entry.tracking ? { ...entry, tracking: entry.tracking.map((change) => ({ ...change, label: plainPart(form.page.fields[change.field])?.label ?? change.label })) } : entry));
    let history = form.getState().approval?.history;
    // A discussion's code, and the editor of its comment box, come the first time one is shown: drawn whole once they have.
    const discussion = (part: NonNullable<typeof discussionPart.loaded>, record: RecordRef | null) =>
      part.mountDiscussion(element, { ...rest, records: form.page.records, record, placeholder, references, onCount: (count) => onCount?.(count, form) });
    /** The conversation itself, where it is no Discussion: it tells the record's approval history among its messages. */
    let conversation: ChatterHandle | null = null;
    const chatter =
      look !== 'discussion'
        ? (conversation = mountChatter(element, {
            ...rest,
            records: form.page.records,
            record: shown,
            timeZone: rest.timeZone ?? form.page.timeZone,
            dateOrder: rest.dateOrder ?? form.page.look?.dateOrder,
            now: rest.now ?? (() => form.now()),
            recordShown: rest.recordShown ?? (() => form.recordShown()),
            ...(telling ? { entries: told(form.getState().approval) } : {}),
          }))
        : discussionPart.loaded && textPart.loaded
          ? discussion(discussionPart.loaded, shown)
          : drawnLater(element, shown, Promise.all([discussionPart.load(), textPart.load()]).then(([part]) => (record) => discussion(part, record)));
    const unsubscribe = form.subscribe((state) => {
      if (telling && state.approval?.history !== history) {
        history = state.approval?.history;
        conversation?.setEntries?.(told(state.approval));
      }
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
      // The source's answer handled as it is given (`answerOf`), never by a `then` of the page's own made of it: the
      // conversation fetched again once it went; refused, it is as the source keeps it.
      if (record) void answerOf(options.source.post(record, { kind: message.kind, body: message.body })).then(() => chatter.refresh(), () => undefined);
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
    // The source's answer handled as it is given (`answerOf`); refused, refused to the one that asked.
    const messages = await answerOf(source.messages({ model, id }));
    return messages.flatMap((message) => message.attachments ?? []).flatMap((file) => (file.url ? [{ name: file.name, type: file.type, size: file.size, url: file.url }] : []));
  };
}
