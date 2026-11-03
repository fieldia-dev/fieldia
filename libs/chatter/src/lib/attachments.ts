import { answerOf, DOWNLOAD_URL, fill, formatBytes, PICTURE_URL, safeUrl, type FileValue } from '@fieldia/core';
import { drawIcon, filesPart, WIDGET_LABELS, type Going, type GoingItem, type ShrinkOptions } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Attachment } from './source';

const isImage = (attachment: Attachment) => attachment.type.startsWith('image/') && !!safeUrl(attachment.url, PICTURE_URL);
let viewed = 0;

/**
 * A message's files: an image as a preview that opens it — in Fieldia's own dialog of files, as a file field's do, which
 * shows a picture only from bytes that are one (the files part's `shownFile`), never in a tab of its own — any other file
 * as a link that downloads it, with its size.
 */
export function attachmentList(context: ChatterContext, attachments: readonly Attachment[], remove?: (attachment: Attachment) => void): HTMLElement {
  const { el, doc, labels, icons } = context;
  const pictures = attachments.filter(isImage).map(({ name, type, size, url }): FileValue => ({ name, type, size, url: url ?? undefined }));
  return el(
    'ul',
    { class: 'fd-attachments' },
    ...attachments.map((attachment) => {
      const item = el('li', { class: 'fd-attachment' });
      if (isImage(attachment)) {
        const preview = el('img', { src: safeUrl(attachment.url, PICTURE_URL), alt: attachment.name });
        const open = el('button', { type: 'button', class: 'fd-attachment-image', 'aria-haspopup': 'dialog' }, preview);
        const at = pictures.findIndex((picture) => picture.url === (attachment.url ?? undefined) && picture.name === attachment.name);
        const words = WIDGET_LABELS[context.locale] ?? WIDGET_LABELS.en;
        open.addEventListener('click', () => void filesPart.load().then((part) => part.viewFiles({ doc, words, id: `fd-attachments-${++viewed}`, files: pictures, at, home: open, back: () => open })));
        item.append(open);
      } else {
        const icon = drawIcon(doc, 'file', icons);
        const words = el('span', { class: 'fd-attachment-words' }, el('span', { class: 'fd-attachment-name' }, attachment.name), el('span', { class: 'fd-attachment-size' }, formatBytes(attachment.size)));
        const parts = [...(icon ? [icon] : []), words];
        // Downloaded, as its link says: from a web address, this site's, a blob this page made, or its data.
        const href = safeUrl(attachment.url, DOWNLOAD_URL);
        item.append(href ? el('a', { class: 'fd-attachment-file', href: safeUrl(href, DOWNLOAD_URL), target: '_blank', rel: 'noopener', download: attachment.name }, ...parts) : el('span', { class: 'fd-attachment-file' }, ...parts));
      }
      if (remove) {
        const drop = el('button', { type: 'button', class: 'fd-attachment-remove', 'aria-label': fill(labels.removeAttachment, { name: attachment.name }) }, '×');
        drop.addEventListener('click', () => remove(attachment));
        item.append(drop);
      }
      return item;
    })
  );
}

/**
 * The composer's files: a button to choose them, dropped ones too, each
 * stored at once through the source — on its way with a bar, × to cancel it
 * and Retry once it failed — and shown until it is sent or taken away. Send
 * waits for those still going, and says so. Without a source that stores
 * files, there is nothing to show. A file on its way is drawn as a file field
 * draws one, by the files part (@fieldia/widgets), asked for the first time a
 * file is chosen: its list joins the composer with its first file.
 */
export function composerFiles(context: ChatterContext, onProblem: (message: string) => void, options: { shrink?: ShrinkOptions; changed?: () => void } = {}) {
  const { el, labels, source, doc, icons, locale } = context;
  // A file on its way speaks as a file field's does.
  const words = WIDGET_LABELS[locale] ?? WIDGET_LABELS.en;
  let files: Attachment[] = [];
  /** Files on their way, each with its item, in the order chosen. */
  let going: Pending[] = [];
  let made = 0;
  const waiters = new Set<() => void>();
  const input = el('input', { type: 'file', multiple: '', hidden: '' });
  const icon = drawIcon(doc, 'link', icons);
  const button = el('button', { type: 'button', class: 'fd-button fd-attach' }, ...(icon ? [icon] : []), labels.attach);
  const chips = el('div', { class: 'fd-composer-files' });
  const onTheirWay = el('ul', { class: 'fd-files fd-files-going', role: 'list' });
  const element = el('div', { class: 'fd-composer-attach' }, button, input);

  interface Pending extends Going {
    file: File;
    item: GoingItem;
    stop?: () => void;
  }

  // The files on their way after those in: their list once it has held one, and the files part's sheet with it.
  const draw = () => chips.replaceChildren(...(files.length ? [attachmentList(context, files, (gone) => ((files = files.filter((f) => f !== gone)), draw()))] : []), ...(made ? [onTheirWay] : []));
  const stillGoing = () => going.filter((p) => p.status !== 'failed');
  const show = (pending: Pending) => pending.item.update(pending, false);
  function settle() {
    options.changed?.();
    if (!stillGoing().length) for (const done of [...waiters]) done();
  }
  function cancel(pending: Pending) {
    going = going.filter((p) => p !== pending);
    pending.stop?.();
    pending.item.element.remove();
    settle();
  }

  async function send(pending: Pending) {
    const record = context.record();
    if (!source.upload || !record) return;
    const stop = new AbortController();
    Object.assign(pending, { status: 'uploading', sent: 0, total: null, error: undefined, stop: () => stop.abort() });
    show(pending);
    try {
      // The source's answer handled as it is given (`answerOf`), never a microtask late as this function's own await.
      const stored = await answerOf(source.upload(record, pending.file, {
        signal: stop.signal,
        onProgress: (sent, total) => {
          Object.assign(pending, { sent, total });
          show(pending);
        },
      }));
      if (!going.includes(pending)) return;
      going = going.filter((p) => p !== pending);
      pending.item.element.remove();
      files = [...files, stored];
      draw();
    } catch (error) {
      if (!going.includes(pending) || stop.signal.aborted || (error as Error | null)?.name === 'AbortError') return;
      Object.assign(pending, { status: 'failed', error: (error as Error).message });
      show(pending);
      onProblem(fill(words.notUploadedNamed, { name: pending.file.name }));
    } finally {
      settle();
    }
  }

  async function take(chosen: readonly File[]) {
    if (!source.upload || !context.record() || !chosen.length) return;
    // A part that cannot come (offline) stores none of them, and says so: they can be chosen again.
    const part = filesPart.loaded ?? (await filesPart.load().catch(() => null));
    if (!part) return onProblem(chosen.map((file) => fill(words.notUploadedNamed, { name: file.name })).join(' · '));
    const { goingItem, shrinkable, shrinkPhoto } = part;
    for (const picked of chosen) {
      const file = options.shrink && shrinkable(picked) ? await shrinkPhoto(picked, options.shrink, doc) : picked;
      const pending = { id: `attachment-${++made}`, name: file.name, size: file.size, type: file.type, status: 'waiting', sent: 0, total: null, file } as Pending;
      const picture = el('span', { class: 'fd-file-icon', 'data-ext': (/\.(\w{1,5})$/.exec(file.name)?.[1] ?? '').toUpperCase(), 'aria-hidden': 'true' });
      pending.item = goingItem(el, words, picture, (name) => el('span', { class: 'fd-file-name', dir: 'auto', title: name }, name), { cancel: () => cancel(pending), retry: () => void send(pending) });
      going = [...going, pending];
      onTheirWay.append(pending.item.element);
      draw();
      void send(pending);
    }
  }

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    void take([...(input.files ?? [])]);
    input.value = '';
  });

  return {
    /** The button, or nothing when the source cannot store files. */
    element: source.upload ? element : null,
    chips,
    files: () => files,
    /** How many files are still on their way. */
    busy: () => stillGoing().length,
    /** The files that did not get there: Send stops for them. */
    failed: () => going.filter((p) => p.status === 'failed').map((p) => p.file.name),
    /** Resolves once no file is on its way. */
    settled: () =>
      new Promise<void>((resolve) => {
        if (!stillGoing().length) return resolve();
        const done = () => (waiters.delete(done), resolve());
        waiters.add(done);
      }),
    clear() {
      for (const pending of [...going]) cancel(pending);
      files = [];
      draw();
    },
    /** Files dropped on the composer are taken too. */
    takeDropsOn(target: HTMLElement) {
      if (!source.upload) return;
      target.addEventListener('dragover', (event) => event.preventDefault());
      target.addEventListener('drop', (event) => {
        event.preventDefault();
        void take([...(event.dataTransfer?.files ?? [])]);
      });
    },
  };
}
