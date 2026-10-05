import { describeTypes, fileProblem, fill, formatBytes, MESSAGES, type Field, type FileValue } from '@fieldia/core';
import { keepTabIn } from './focus-trap';
import { describeState, maker, rightToLeft, setHidden, setText, wordsFor, type Make } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * File and image fields. A chosen or dropped file is read into the value as
 * base64, the way a backend's binary fields carry it; a stored one may carry
 * a `url` instead. With `multiple` the value is a list: the picker and the
 * drop zone take many, each joining the list up to `maxFiles`, and a file of
 * a kind the field does not take, too large, already there, or past the most
 * is not added — the widget says which and why. The limits are said before
 * anyone tries. Files show as a list or as thumbnails (`options.files`); one
 * opens in a dialog that goes through them all. `options.camera` has a phone
 * offer its camera, the rear one, or the front with "user".
 */

type FileField = Extract<Field, { type: 'binary' | 'image' }>;

const read = (file: File) =>
  new Promise<FileValue>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve({ name: file.name, type: file.type, size: file.size, data: url.slice(url.indexOf(',') + 1) });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const extension = (name: string) => (/\.(\w{1,5})$/.exec(name)?.[1] ?? '').toUpperCase();
/** What a file is, for its icon and its preview: by its media type, else its extension. */
function kindOf(file: FileValue): string {
  const of = `${file.type} ${extension(file.name)}`.toLowerCase();
  return /^image\//.test(of) ? 'image' : /pdf/.test(of) ? 'pdf' : /sheet|excel|csv|xlsx?$|ods$/.test(of) ? 'sheet' : /zip|rar|7z|tar|gz/.test(of) ? 'zip' : /word|opendocument|^text|docx?$|odt$|rtf$/.test(of) ? 'doc' : 'file';
}
const asText = (file: FileValue) => /^text\/|json|xml|csv/.test(file.type);
/** Where a file's picture is: its data, or where it is stored. */
const source = (file: FileValue) => (file.data ? `data:${file.type};base64,${file.data}` : (file.url ?? ''));
const bytes = (data: string) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const icon = (make: Make, file: FileValue) => make('span', { class: 'fd-file-icon', 'data-kind': kindOf(file), 'aria-hidden': 'true' }, extension(file.name) || '?');
/** A name cut in the middle where it must be: its start may end in an ellipsis, its last characters — the extension — stay. */
const named = (make: Make, name: string) => make('span', { class: 'fd-file-name', dir: 'auto', title: name }, make('span', {}, name.slice(0, -9)), name.slice(-9));

function fileWidget(kind: 'binary' | 'image'): WidgetFactory {
  return ({ form, name, field: def, node, id, document: doc, labels, locale = 'en' }) => {
    const field = def as FileField;
    const words = wordsFor(labels, locale);
    const make = maker(doc);
    const several = field.multiple === true;
    const most = several ? (field.maxFiles ?? Infinity) : 1;
    const image = kind === 'image';
    const thumbs = (node.options?.['files'] ?? (image ? 'thumbnails' : 'list')) === 'thumbnails';
    const camera = node.options?.['camera'];
    const accept = field.type === 'binary' ? field.accept : ['image/*'];
    const element = make('div', { class: `fd-file fd-file-${kind} fd-files-${thumbs ? 'thumbs' : 'list'}` });
    const input = make('input', { type: 'file', id, class: 'fd-sr-only', accept: accept?.join(','), capture: camera ? (camera === 'user' ? 'user' : 'environment') : undefined });
    input.multiple = several;

    // The limits, said before anyone tries.
    const limits = [
      !image && accept ? describeTypes(accept, MESSAGES[locale].or) : '',
      field.maxSize ? fill(several ? words.upToEach : words.upToSize, { size: formatBytes(field.maxSize) }) : '',
      several && field.maxFiles ? fill(words.upToFiles, { max: field.maxFiles }) : '',
    ].filter(Boolean);
    // A tile among the thumbnails, a drop zone over the list.
    const pick = make(
      'label',
      { class: `fd-file-pick${thumbs ? ' fd-image-pick' : ''}`, for: id },
      make('span', { class: 'fd-button' }, several ? (image ? words.addPhotos : words.addFiles) : image ? words.uploadImage : words.upload),
      make('span', { class: 'fd-help' }, several ? words.dropThem : words.dropHere)
    );
    const limited = make('span', { class: 'fd-help fd-file-limits' }, limits.join(' · '));
    const count = several ? make('span', { class: 'fd-help fd-file-count' }) : null;
    const list = make('ul', { class: 'fd-files', role: 'list' });
    const replace = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.replace);
    replace.addEventListener('click', () => input.click());
    // Removing asks first, in place: "Remove report.pdf?  Remove · Keep".
    const question = make('span');
    const yes = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.removeFile);
    const no = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.keep);
    const confirm = make('div', { class: 'fd-file-confirm', hidden: '' }, question, yes, no);
    // Why files were not added, and one removed: said politely, and shown.
    const note = make('div', { class: 'fd-help fd-file-note', role: 'status' });
    element.append(input, pick, ...(limits.length ? [limited] : []), ...(count ? [count] : []), list, replace, confirm, note);

    let readonly = false;
    let files: FileValue[] = [];
    let shown: unknown;
    let asking = -1;
    const say = (lines: string[]) => note.replaceChildren(...lines.map((line) => make('div', {}, line)));

    const take = async (chosen: File[]) => {
      if (readonly || !chosen.length) return;
      const kept: File[] = [];
      const lines: string[] = [];
      let over = 0;
      for (const file of chosen) {
        const problem = fileProblem(field, file, MESSAGES[locale]) ?? (several && [...files, ...kept].some((f) => f.name === file.name) ? fill(words.alreadyAdded, { name: file.name }) : undefined);
        if (problem) lines.push(problem);
        else if ((several ? files.length : 0) + kept.length < most) kept.push(file);
        else over++;
      }
      if (over && several) lines.push(fill(words.tooMany, { max: most, n: over }));
      say(lines);
      if (!kept.length) return;
      const added = await Promise.all(kept.map(read));
      form.setValue(name, several ? [...files, ...added] : added[0]);
    };
    input.addEventListener('change', () => {
      void take([...(input.files ?? [])]);
      input.value = '';
    });
    element.addEventListener('dragover', (event) => {
      if (readonly) return;
      event.preventDefault();
      element.classList.add('fd-dragging');
    });
    element.addEventListener('dragleave', () => element.classList.remove('fd-dragging'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('fd-dragging');
      void take([...((event as DragEvent).dataTransfer?.files ?? [])]);
    });

    list.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('button');
      const at = Number(button?.dataset['at']);
      if (!button) return;
      if (button.classList.contains('fd-file-open')) return view(at, button);
      asking = at;
      question.textContent = fill(words.removeAsk, { name: files[at].name });
      confirm.hidden = false;
      no.focus();
    });
    const answered = (remove: boolean) => {
      const at = asking;
      const gone = files[at];
      confirm.hidden = true;
      if (remove) {
        form.setValue(name, several ? files.filter((_, i) => i !== at) : null);
        say([fill(words.removed, { name: gone.name })]);
      }
      (list.querySelectorAll<HTMLElement>('.fd-file-remove')[remove ? Math.min(at, files.length - 1) : at] ?? (pick.hidden ? replace : input)).focus();
    };
    yes.addEventListener('click', () => answered(true));
    no.addEventListener('click', () => answered(false));
    confirm.addEventListener('keydown', (event) => event.key === 'Escape' && answered(false));

    /** A file open in a dialog, the arrows and Previous and Next going through them all. */
    function view(at: number, opener: HTMLElement) {
      const all = files;
      let url = '';
      const title = make('h2', { id: `${id}-view`, class: 'fd-form-dialog-title' });
      const meta = make('span', { class: 'fd-help' });
      const step = (by: number, words: string, arrow: string) => {
        const button = make('button', { type: 'button', class: 'fd-button fd-file-step', 'aria-label': words }, arrow);
        button.hidden = all.length < 2;
        button.addEventListener('click', () => show(at + by));
        return button;
      };
      const download = make('a', { class: 'fd-button' }, words.download);
      const close = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': words.close }, '×');
      const body = make('div', { class: 'fd-file-viewer-body' });
      const box = make(
        'div',
        // A page's dialog, as the viewer's are.
        { class: 'fd-form-dialog fd-file-viewer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' },
        make('div', { class: 'fd-form-dialog-head' }, title, meta, step(-1, words.previous, '‹'), step(1, words.next, '›'), download, close),
        body
      );
      const backdrop = make('div', { class: 'fd-dialog-backdrop' }, box);
      const free = () => url.startsWith('blob:') && URL.revokeObjectURL(url);
      const none = (file: FileValue) => make('div', { class: 'fd-file-none' }, icon(make, file), make('strong', {}, file.name), formatBytes(file.size), make('p', {}, words.noPreview));
      function show(to: number) {
        at = (to + all.length) % all.length;
        const file = all[at];
        free();
        const data = file.data ? bytes(file.data) : null;
        url = data ? URL.createObjectURL(new Blob([data], { type: file.type })) : (file.url ?? '');
        title.textContent = file.name;
        meta.replaceChildren(make('span', { class: 'fd-file-size' }, formatBytes(file.size)), all.length > 1 ? ` · ${fill(words.fileAt, { n: at + 1, total: all.length })}` : '');
        download.href = url;
        download.download = file.name;
        const kind = kindOf(file);
        if (kind === 'image') return body.replaceChildren(make('img', { src: url, alt: file.name }));
        if (kind === 'pdf') return body.replaceChildren(make('iframe', { src: url, title: file.name }));
        if (!asText(file)) return body.replaceChildren(none(file));
        const pre = make('pre', { tabindex: '0' });
        body.replaceChildren(pre);
        // The first 200 KB: enough to see what it is.
        (data ? Promise.resolve(new TextDecoder().decode(data.subarray(0, 2e5))) : fetch(url).then((r) => r.text())).then(
          (words) => (pre.textContent = words.slice(0, 2e5)),
          () => pre.replaceWith(none(file))
        );
      }
      const done = () => {
        free();
        backdrop.remove();
        (opener.isConnected ? opener : list.querySelectorAll<HTMLElement>('.fd-file-open')[at])?.focus();
      };
      close.addEventListener('click', done);
      backdrop.addEventListener('click', (event) => event.target === backdrop && done());
      box.addEventListener('keydown', (event) => {
        const by = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[event.key];
        if (event.key === 'Escape') done();
        else if (by && all.length > 1 && (event.target as Element).tagName !== 'PRE') show(at + (rightToLeft(element) ? -by : by));
        else keepTabIn(box, event);
      });
      show(at);
      // Over the page, wearing the form's skin, scheme and direction.
      (element.closest('.fd-form') ?? doc.body).append(backdrop);
      box.focus();
    }

    return {
      element,
      focus: () => (list.querySelector('button') ?? (pick.hidden ? replace : input)).focus(),
      update(state) {
        readonly = state.readonly;
        const value = state.value as FileValue | FileValue[] | null | undefined;
        files = Array.isArray(value) ? value : value ? [value] : [];
        const full = files.length >= most;
        setHidden(pick, full || readonly);
        setHidden(limited, readonly);
        input.disabled = readonly;
        input.hidden = pick.hidden;
        setHidden(replace, several || !files.length || readonly);
        if (count) setText(count, !files.length ? '' : several && field.maxFiles ? fill(words.fileCountOf, { n: files.length, max: field.maxFiles }) : files.length === 1 ? words.oneFile : fill(words.fileCount, { n: files.length }));
        describeState(input, state);
        if (shown === value && list.dataset['readonly'] === String(readonly)) return;
        shown = value;
        list.dataset['readonly'] = String(readonly);
        list.replaceChildren(
          ...files.map((file, at) =>
            make(
              'li',
              { class: 'fd-file-item' },
              make(
                'button',
                // Named whole: the name's two parts would be read as two words.
                { type: 'button', class: 'fd-file-open', 'data-at': String(at), 'aria-haspopup': 'dialog', 'aria-label': `${file.name}, ${formatBytes(file.size)}` },
                kindOf(file) === 'image' && source(file) ? make('img', { class: 'fd-file-thumb', src: source(file), alt: '' }) : icon(make, file),
                named(make, file.name),
                make('span', { class: 'fd-file-size' }, formatBytes(file.size))
              ),
              ...(readonly ? [] : [make('button', { type: 'button', class: 'fd-file-remove', 'data-at': String(at), 'aria-label': fill(words.remove, { name: file.name }) }, '×')])
            )
          )
        );
      },
    };
  };
}

export const binaryWidget = fileWidget('binary');
export const imageWidget = fileWidget('image');
