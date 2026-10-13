import { fill, formatBytes } from '@fieldia/core';
import { drawIcon, goingItem, shrinkable, shrinkPhoto, WIDGET_LABELS, type Going, type GoingItem, type ShrinkOptions } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Attachment } from './source';

const isImage = (attachment: Attachment) => attachment.type.startsWith('image/') && !!attachment.url;

/** A message's files: an image as a preview that opens it, any other file as a link with its size. */
export function attachmentList(context: ChatterContext, attachments: readonly Attachment[], remove?: (attachment: Attachment) => void): HTMLElement {
  const { el, doc, labels, icons } = context;
  return el(
    'ul',
    { class: 'fd-attachments' },
    ...attachments.map((attachment) => {
      const item = el('li', { class: 'fd-attachment' });
      if (isImage(attachment)) {
        const preview = el('img', { src: attachment.url as string, alt: attachment.name });
        item.append(el('a', { class: 'fd-attachment-image', href: attachment.url as string, target: '_blank', rel: 'noopener' }, preview));
      } else {
        const icon = drawIcon(doc, 'file', icons);
        const words = el('span', { class: 'fd-attachment-words' }, el('span', { class: 'fd-attachment-name' }, attachment.name), el('span', { class: 'fd-attachment-size' }, formatBytes(attachment.size)));
        const parts = [...(icon ? [icon] : []), words];
        item.append(
          attachment.url
            ? el('a', { class: 'fd-attachment-file', href: attachment.url, target: '_blank', rel: 'noopener', download: attachment.name }, ...parts)
            : el('span', { class: 'fd-attachment-file' }, ...parts)
        );
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
 * files, there is nothing to show.
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

  const draw = () => chips.replaceChildren(...(files.length ? [attachmentList(context, files, (gone) => ((files = files.filter((f) => f !== gone)), draw()))] : []), onTheirWay);
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
      const stored = await source.upload(record, pending.file, {
        signal: stop.signal,
        onProgress: (sent, total) => {
          Object.assign(pending, { sent, total });
          show(pending);
        },
      });
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
    if (!source.upload || !context.record()) return;
    for (const picked of chosen) {
      const file = options.shrink && shrinkable(picked) ? await shrinkPhoto(picked, options.shrink, doc) : picked;
      const pending = { id: `attachment-${++made}`, name: file.name, size: file.size, type: file.type, status: 'waiting', sent: 0, total: null, file } as Pending;
      const picture = el('span', { class: 'fd-file-icon', 'aria-hidden': 'true' }, (/\.(\w{1,5})$/.exec(file.name)?.[1] ?? '').toUpperCase());
      pending.item = goingItem(el, words, picture, (name) => el('span', { class: 'fd-file-name', dir: 'auto', title: name }, name), { cancel: () => cancel(pending), retry: () => void send(pending) });
      going = [...going, pending];
      onTheirWay.append(pending.item.element);
      void send(pending);
    }
    draw();
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
