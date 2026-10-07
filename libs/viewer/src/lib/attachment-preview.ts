import type { AttachmentPreview, DataSource, FileValue, Form, FormState, Page, RecordId } from '@fieldia/core';
import { fileShown } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';

/** What the preview beside a sheet needs of the viewer that draws it. */
export interface PreviewContext {
  doc: Document;
  el: El;
  form: Form;
  page: Page;
  node: AttachmentPreview;
  dataSource: DataSource | undefined;
  labels: ViewerLabels;
  fill(template: string, values: Record<string, string | number>): string;
}

/** A file the browser shows itself: a picture or a PDF. */
const showable = (file: FileValue) => /^image\//.test(file.type) || /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);

const filesOf = (value: unknown): FileValue[] => (Array.isArray(value) ? (value as FileValue[]) : value ? [value as FileValue] : []).filter((file) => file && typeof file === 'object' && 'name' in file);

/**
 * The record's main attachment beside its sheet, as Flectra's
 * o_attachment_preview: a PDF in the browser's own viewer or a picture, with
 * Previous and Next when it has several, and a link that opens it on its own.
 * From a file field of the page, or the data source's `attachments` of the
 * record — asked again when the form shows another record, and after a save.
 * Hidden while there is nothing to show.
 */
export function attachmentPreview(context: PreviewContext): { element: HTMLElement; update(state: FormState): void; destroy(): void } {
  const { el, form, labels, node } = context;
  const name = el('span', { class: 'fd-attachment-name', dir: 'auto' });
  const count = el('span', { class: 'fd-attachment-count', dir: 'ltr' });
  const previous = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': labels.previousAttachment }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '‹'));
  const next = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': labels.nextAttachment }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '›'));
  const open = el('a', { class: 'fd-button fd-button-link fd-attachment-open', target: '_blank', rel: 'noopener' }, labels.openAttachment);
  const body = el('div', { class: 'fd-attachment-body' });
  const element = el('aside', { class: 'fd-attachment-preview', hidden: '' }, el('div', { class: 'fd-attachment-head' }, name, count, previous, next, open), body);

  let files: FileValue[] = [];
  let at = 0;
  let shown: { free(): void } | null = null;
  /** The record the attachments were asked for, and the latest ask: an older answer is let go. */
  let askedFor: RecordId | null | undefined;
  let asks = 0;
  let status: FormState['status'] | undefined;
  let held: unknown;

  function draw() {
    shown?.free();
    shown = null;
    const file = files[at];
    if (!file) return body.replaceChildren();
    const made = fileShown(context.doc, file);
    shown = made;
    body.replaceChildren(...(made ? [made.element] : []));
    setText(name, file.name);
    setText(count, files.length > 1 ? context.fill(labels.recordAt, { n: at + 1, total: files.length }) : '');
    setHidden(previous, files.length < 2);
    setHidden(next, files.length < 2);
    setAttr(open, 'href', made?.url ?? null);
    setAttr(element, 'aria-label', context.fill(labels.attachment, { name: file.name }));
  }
  const step = (by: number) => {
    at = (at + by + files.length) % files.length;
    draw();
  };
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  const take = (found: FileValue[]) => {
    files = found.filter(showable);
    at = 0;
    draw();
    show();
  };
  const show = () => setHidden(element, form.node('#preview').invisible || !files.length);

  function ask(state: FormState) {
    const source = context.dataSource;
    const ask = ++asks;
    askedFor = state.recordId;
    if (state.recordId == null || !source?.attachments || context.page.data.kind !== 'record') return take([]);
    source.attachments({ model: context.page.data.model, id: state.recordId, fields: context.page.fields }).then(
      (found) => ask === asks && take(found),
      () => ask === asks && take([])
    );
  }

  return {
    element,
    update(state) {
      if (node.field) {
        const value = state.values[node.field];
        if (value !== held) {
          held = value;
          take(filesOf(value));
        }
      } else if (state.status !== 'loading' && state.status !== 'idle' && (state.recordId !== askedFor || (state.status === 'saved' && status !== 'saved'))) ask(state);
      status = state.status;
      show();
    },
    destroy: () => shown?.free(),
  };
}
