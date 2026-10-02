import { fill, formatBytes } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
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
 * stored at once through the source and shown until it is sent or taken away.
 * Without a source that stores files, there is nothing to show.
 */
export function composerFiles(context: ChatterContext, onProblem: (message: string) => void) {
  const { el, labels, source, doc, icons } = context;
  let files: Attachment[] = [];
  let uploading = 0;
  const input = el('input', { type: 'file', multiple: '', hidden: '' });
  const icon = drawIcon(doc, 'link', icons);
  const button = el('button', { type: 'button', class: 'fd-button fd-attach' }, ...(icon ? [icon] : []), labels.attach);
  const chips = el('div', { class: 'fd-composer-files' });
  const element = el('div', { class: 'fd-composer-attach' }, button, input);

  const draw = () => chips.replaceChildren(...(files.length ? [attachmentList(context, files, (gone) => ((files = files.filter((f) => f !== gone)), draw()))] : []));

  async function take(chosen: readonly File[]) {
    const record = context.record();
    if (!source.upload || !record) return;
    uploading += chosen.length;
    for (const file of chosen) {
      try {
        files = [...files, await source.upload(record, file)];
        draw();
      } catch (error) {
        onProblem(fill(labels.couldNotSend, { reason: (error as Error).message }));
      } finally {
        uploading--;
      }
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
    busy: () => uploading > 0,
    clear() {
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
