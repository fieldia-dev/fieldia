import { MEDIA_URL, safeUrl, type AttachmentPreview, type DataSource, type FileValue, type Form, type FormState, type Page, type RecordId } from '@fieldia/core';
import { filesPart, type FilesPart } from '@fieldia/widgets';
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
  /** Told when the files part, which shows the files, could not come: the page says part of it could not load. */
  unloaded?: () => void;
}

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

  /** The files part, which shows a file in place: its formats, each file's bytes checked against its own (`fileShown`). */
  let part: FilesPart | null = null;
  let takes = 0;

  function draw() {
    shown?.free();
    shown = null;
    const file = files[at];
    if (!file || !part) return body.replaceChildren();
    const made = part.fileShown(context.doc, file);
    shown = made;
    body.replaceChildren(...(made ? [made.element] : []));
    setText(name, file.name);
    setText(count, files.length > 1 ? context.fill(labels.recordAt, { n: at + 1, total: files.length }) : '');
    setHidden(previous, files.length < 2);
    setHidden(next, files.length < 2);
    // Opened in a tab of its own once it is known to be what it says: never a picture drawn from markup.
    const opens = (url: string) => {
      setAttr(open, 'href', safeUrl(url, MEDIA_URL) ?? null);
      setHidden(open, !open.hasAttribute('href'));
    };
    opens(made?.url ?? '');
    void made?.ready.then((url) => shown === made && opens(url));
    setAttr(element, 'aria-label', context.fill(labels.attachment, { name: file.name }));
  }
  const step = (by: number) => {
    at = (at + by + files.length) % files.length;
    draw();
  };
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  /**
   * The files a browser shows itself — a picture or a PDF, by the formats Fieldia shows, never HTML named .pdf — once
   * the files part has come; none where it cannot, the page saying part of it could not load (`unloaded`).
   */
  const take = (found: FileValue[]) => {
    const mine = ++takes;
    const shownBy = (loaded: FilesPart | null) => {
      if (mine !== takes) return;
      part = loaded;
      files = loaded ? found.filter((file) => /^(image|pdf)$/.test(loaded.formatOf(file)?.kind ?? '')) : [];
      at = 0;
      draw();
      show();
    };
    if (!found.length || filesPart.loaded) return shownBy(filesPart.loaded ?? null);
    filesPart.load().then(shownBy, () => {
      shownBy(null);
      context.unloaded?.();
    });
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
