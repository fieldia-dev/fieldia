import { describeTypes, DOWNLOAD_URL, fileProblem, fill, formatBytes, MEDIA_URL, MESSAGES, PICTURE_URL, safeUrl, saveRefused, uploadGoing, type Field, type FileUpload, type FileValue, type Form, type Messages, type RecordedKind } from '@fieldia/core';
import { keepTabIn } from './focus-trap';
import { goingItem, type GoingItem } from './files-going';
import { shrinkable, shrinkFor, shrinkPhoto } from './shrink';
import { drawIcon } from './icons';
import { bytesOf, extension, INLINE_FILE_WARNING, readFile, source } from './file-shown';
import { formatOf, shownFile, whenShown, type Shown } from './file-formats';
import { kindOfFile as kindOf, recordedKinds, recordSeconds } from './media';
export { INLINE_FILE_WARNING, readFile };
import { askFirst, describeState, maker, rightToLeft, setAttr, setHidden, setText, wordsFor, type Make } from './kind-parts';
import type { WidgetFactory } from './widgets';
import type { WidgetLabels } from './labels';
import { formBehind } from './handed';
import { stillShown } from './shown';
import { installFilesStyles } from './styles-files';
import { loadRecordPart } from './widget-parts';

/**
 * File and image fields. A chosen or dropped file is read into the value as
 * base64, the way a backend's binary fields carry it; a stored one may carry
 * a `url` instead. With `multiple` the value is a list: the picker and the
 * drop zone take many, each joining the list up to `maxFiles`, and a file of
 * a kind the field does not take, too large, already there, or past the most
 * is not added — the widget says which and why. The limits are said before
 * anyone tries. Files show as a list, as thumbnails, or as cards — a picture
 * over each one's name and size (`options.files`); `options.filesSwitch` lets
 * the person flip them between a list and the pictures. One opens in a dialog
 * that goes through them all. `options.camera` has a phone offer its camera,
 * the rear one, or the front with "user".
 *
 * Where the data source stores files (`upload`), each file goes to the app's
 * store as soon as it is picked — a photo made smaller first (the field's
 * `shrink`) — and shows on its way with a bar, × to cancel it and Retry once
 * it failed; the field then holds its link alone. Without it, a file larger
 * than a megabyte warns once in the console: it travels inside the record.
 *
 * A film or a sound plays in the browser's own player: in the dialog, a film
 * with its poster frame — the app's own (`FileValue.poster`), else the frame
 * half a second in — and a sound under its name in a list, where a voice note
 * is listened to in place. A film's picture among the files is that frame.
 *
 * A field whose node says `options.record` — `"audio"`, `"video"` or both —
 * records a voice note or a short film on the page, beside its picker: Record
 * opens the recorder (the record part, recorder.ts, loaded as it is first
 * pressed) and what is recorded is taken as a file picked is. Where the browser
 * cannot record (no microphone to ask for: a page not served over https), the
 * buttons are not shown.
 *
 * They come in the files part (files-part.ts), loaded the first time a page
 * shows one; the names of the files a value holds meanwhile.
 */

export type FileField = Extract<Field, { type: 'binary' | 'image' }>;

const asText = (file: FileValue) => /^text\/|json|xml|csv/.test(file.type);
const warned = new WeakSet<object>();
function warnInline(form: Form, files: { name: string; size: number }[]) {
  const large = files.find((file) => file.size > INLINE_FILE_WARNING);
  // Once for the page's form, whichever field's widget it was handed through (contain.ts).
  if (!large || warned.has(formBehind(form))) return;
  warned.add(formBehind(form));
  console.warn(
    `Fieldia: ${large.name} (${formatBytes(large.size)}) goes inside the record as base64, because the data source has no upload(). ` +
      'Give it upload() — uploadTo({ url }) for a plain endpoint — to store each file as it is picked and keep only its link.'
  );
}
// Its extension drawn on it (styles-files.ts), a picture's: the file's name, beside it and in the button's name, says it.
const icon = (make: Make, file: FileValue) => make('span', { class: 'fd-file-icon', 'data-kind': kindOf(file), 'data-ext': extension(file.name) || '?', 'aria-hidden': 'true' });
/**
 * A file's picture, or — where the browser cannot draw it (random bytes
 * named .jpg, a HEIC photo in Chrome) — `instead` in its place: never the
 * browser's broken-picture mark.
 */
function picture(make: Make, src: string, instead: () => HTMLElement, attrs: Record<string, string> = { class: 'fd-file-thumb', alt: '' }): HTMLElement {
  const image = make('img', { ...attrs, src: safeUrl(src, PICTURE_URL) }) as HTMLImageElement;
  // No picture at all where its address is none a picture may have.
  if (!image.hasAttribute('src')) return instead();
  image.addEventListener('error', () => image.parentNode?.replaceChild(instead(), image), { once: true });
  return image;
}
/**
 * A film's picture among the files: the app's own poster frame (`poster`), else the frame half a second in, drawn by
 * the browser from the film itself (a media fragment) — never played, never heard, never read aloud — with a play mark
 * over it. Where the browser cannot read the film, `instead`.
 */
function filmFrame(make: Make, file: FileValue, src: string, instead: () => HTMLElement): HTMLElement {
  const film = file.poster ? make('img', { src: safeUrl(file.poster, PICTURE_URL), alt: '' }) : make('video', { src: safeUrl(`${src}#t=0.5`, MEDIA_URL), preload: 'metadata', muted: '', playsinline: '', tabindex: '-1' });
  if (!file.poster) {
    const video = film as HTMLVideoElement;
    // Muted as a property too: the attribute alone sets only where it starts.
    video.muted = true;
    // A browser that reads a film's length but no frame of it (Safari, told to load no more than that) is asked for the
    // frame: seeking to it loads it.
    video.addEventListener('loadedmetadata', () => video.readyState < 2 && (video.currentTime = Math.min(0.5, (video.duration || 1) / 2)), { once: true });
  }
  const frame = make('span', { class: 'fd-file-thumb fd-file-film', 'aria-hidden': 'true' }, film);
  film.addEventListener('error', () => frame.replaceWith(instead()), { once: true });
  return frame;
}
/**
 * Where a film or a sound plays from, as every file shown (`shownFile`): where it is stored, or its bytes held in the
 * value — checked, in a blob typed from its format — as an address `made` keeps to let go. '' where it is not one.
 */
function playedFrom(file: FileValue, made: Set<string>): string {
  const shown = shownFile(file);
  if (!shown || shown instanceof Promise || (shown.kind !== 'video' && shown.kind !== 'audio')) return '';
  if (shown.url.startsWith('blob:')) made.add(shown.url);
  return shown.url;
}
/**
 * The browser's own player for a film or a sound, named by the file: a film starts on its poster frame (the app's, else
 * its frame a tenth of a second in). One the browser cannot play says so in its place (`instead`).
 */
function player(make: Make, kind: 'video' | 'audio', file: FileValue, url: string, instead: () => HTMLElement, attrs: Record<string, string> = {}): HTMLElement {
  const film = kind === 'video';
  const media = make(kind, { ...attrs, src: safeUrl(film && !file.poster ? `${url}#t=0.1` : url, MEDIA_URL), controls: '', preload: 'metadata', 'aria-label': file.name, ...(film ? { playsinline: '' } : {}), ...(film && file.poster ? { poster: safeUrl(file.poster, PICTURE_URL) } : {}) });
  media.addEventListener('error', () => media.replaceWith(instead()), { once: true });
  return media;
}
/** A microphone, and a film's camera, for the Record buttons. */
const RECORDING: Record<string, string> = {
  audio: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  video: '<rect x="3" y="6" width="12.5" height="12" rx="2"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
};
/** "2:00" for two minutes: how long a recording may be. */
const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/**
 * Whether the browser can record on this page: a microphone and a camera it may ask for — on a page served over https,
 * or the machine's own — and a recorder.
 */
const canRecord = (doc: Document) => {
  const win = doc.defaultView as (Window & { MediaRecorder?: unknown }) | null;
  return typeof win?.navigator?.mediaDevices?.getUserMedia === 'function' && typeof win.MediaRecorder === 'function';
};
/** The pictures' ways in the switch: cards, a picture over a line of words; thumbnails, pictures alone. A list has the list's icon. */
const VIEWS = {
  cards: '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 15h8M13 15h8M3 19h5M13 19h5"/>',
  thumbnails: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
};
/** A name cut in the middle where it must be: its start may end in an ellipsis, its last characters — the extension — stay. */
const named = (make: Make, name: string) => make('span', { class: 'fd-file-name', dir: 'auto', title: name }, make('span', {}, name.slice(0, -9)), name.slice(-9));
/**
 * A card's name, in two lines at most: in halves, parted at the space nearest
 * the middle, side by side while they fit. Longer, the first ends in an
 * ellipsis on its line and the second starts with one on the next, so its
 * end — the extension — stays. The second reads in its own direction, inside
 * a box of the other, which is what puts its ellipsis at its start.
 */
function namedOnCard(make: Make, name: string) {
  const half = name.length / 2;
  // A space further than a quarter of the name from the middle is not taken.
  let [at, off] = [Math.round(half), half / 2];
  for (let i = name.indexOf(' '); i >= 0; i = name.indexOf(' ', i + 1)) if (Math.abs(i + 1 - half) < off) [at, off] = [i + 1, Math.abs(i + 1 - half)];
  const rtl = /^\P{L}*[\p{sc=Arabic}\p{sc=Hebrew}]/u.test(name);
  return make('span', { class: 'fd-file-name', dir: rtl ? 'rtl' : 'ltr', title: name }, make('span', {}, name.slice(0, at)), make('span', { dir: rtl ? 'ltr' : 'rtl' }, make('bdi', {}, name.slice(at))));
}

/** What a dialog of files needs: the files and the one shown first, its words, where it opens, and where the focus goes once it closes. */
export interface ViewFiles {
  doc: Document;
  words: WidgetLabels;
  /** Its title's id. */
  id: string;
  /** The files; one whose `size` is not a number (NaN: an address that said none) is shown without it. */
  files: readonly FileValue[];
  at: number;
  /** What it opens over: the form round it, whose skin, scheme and direction it wears, else the page's body. */
  home: Element;
  /** Where the focus goes once it is closed, by the file last shown. */
  back?: (at: number) => HTMLElement | null | undefined;
  /** Told once it is closed: an address made for it can be let go. */
  closed?: () => void;
}

/**
 * Files open in a dialog over the page, one at a time: a picture whole, a PDF
 * in the browser's own viewer, text as it is, and anything else by its name
 * and size — with Download, Previous and Next (and the arrows) through several,
 * and × or Escape to close. A file field's files open in it; so does a file
 * the app hands back from an action (the viewer's host, `ActionResult.file`),
 * its PDF of a record shown over the record.
 */
export function viewFiles(context: ViewFiles): void {
  const { doc, words, files: all } = context;
  const make = maker(doc);
  let at = context.at;
  let url = '';
  const title = make('h2', { id: context.id, class: 'fd-form-dialog-title' });
  const meta = make('span', { class: 'fd-help' });
  const step = (by: number, label: string, arrow: string) => {
    const button = make('button', { type: 'button', class: 'fd-button fd-file-step', 'aria-label': label }, arrow);
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
  /** What is shown now, and which showing: one shown from a PDF of this site's own, read late, is shown only while it is still the one. */
  let shown: Shown | null = null;
  let showing = 0;
  let closed = false;
  const free = () => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    shown?.free();
    shown = null;
  };
  /** Its size in words, where it is known: an app's file at its own address may not say. */
  const sized = (file: FileValue) => (Number.isFinite(file.size) ? formatBytes(file.size) : '');
  const none = (file: FileValue, said = words.noPreview) => make('div', { class: 'fd-file-none' }, icon(make, file), make('strong', {}, file.name), sized(file), make('p', {}, said));
  function show(to: number) {
    at = (to + all.length) % all.length;
    const file = all[at];
    free();
    const data = bytesOf(file);
    // Downloaded as the bytes they are, never read by the browser as a page: a blob of no type of its own.
    url = data && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/octet-stream' })) : '';
    // A photo of a set by its caption, where it has one, its file's name beside it.
    title.textContent = file.caption || file.name;
    meta.replaceChildren(...(file.caption ? [`${file.name} · `] : []), ...(sized(file) ? [make('span', { class: 'fd-file-size' }, sized(file))] : []), all.length > 1 ? ` · ${fill(words.fileAt, { n: at + 1, total: all.length })}` : '');
    setAttr(download, 'href', safeUrl(url || file.url, DOWNLOAD_URL) ?? null);
    download.download = file.name;
    const mine = ++showing;
    body.replaceChildren();
    whenShown(shownFile(file), (made) => {
      if (mine !== showing || closed) return void made?.free();
      shown = made;
      draw(file, made, data);
    });
  }
  /** A file as it is shown (`shownFile`): a picture, a film or a sound in its player, a PDF in a frame; text as it is; else its name. */
  function draw(file: FileValue, made: Shown | null, data: Uint8Array | null) {
    if (made?.kind === 'image') return body.replaceChildren(picture(make, made.url, () => none(file), { alt: file.name }));
    // A film in the browser's player; a sound under its name, the player beneath; either one the browser cannot play, said.
    const unplayable = () => make('div', { class: 'fd-file-none' }, icon(make, file), make('strong', {}, file.name), sized(file), make('p', {}, words.cannotPlay));
    if (made?.kind === 'video') return body.replaceChildren(player(make, made.kind, file, made.url, unplayable));
    if (made?.kind === 'audio') return body.replaceChildren(make('div', { class: 'fd-file-none fd-file-sound' }, icon(make, file), make('strong', {}, file.name), sized(file), player(make, made.kind, file, made.url, () => make('p', {}, words.cannotPlay))));
    if (made?.kind === 'pdf') return body.replaceChildren(make('iframe', { src: safeUrl(made.url, MEDIA_URL), title: file.name }));
    const from = safeUrl(file.url, MEDIA_URL);
    // A picture by its name whose bytes are none: said so, not only that it has no preview (0.35.1).
    const claimed = formatOf(file);
    if (!made && data && claimed?.kind === 'image' && !claimed.markup && !claimed.starts(data)) return body.replaceChildren(none(file, words.notAPicture));
    if (!asText(file) || (!data && !from)) return body.replaceChildren(none(file));
    const pre = make('pre', { tabindex: '0' });
    body.replaceChildren(pre);
    // The first 200 KB as words, never as a page: enough to see what it is.
    (data ? Promise.resolve(new TextDecoder().decode(data.subarray(0, 2e5))) : fetch(from as string).then((r) => r.text())).then(
      (text) => (pre.textContent = text.slice(0, 2e5)),
      () => pre.replaceWith(none(file))
    );
  }
  const done = () => {
    closed = true;
    free();
    backdrop.remove();
    context.back?.(at)?.focus();
    context.closed?.();
  };
  close.addEventListener('click', done);
  backdrop.addEventListener('click', (event) => event.target === backdrop && done());
  box.addEventListener('keydown', (event) => {
    const by = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[event.key];
    if (event.key === 'Escape') done();
    // A player's own arrows move through the film or the sound; text's move its caret.
    else if (by && all.length > 1 && !/^(PRE|VIDEO|AUDIO)$/.test((event.target as Element).tagName)) show(at + (rightToLeft(context.home) ? -by : by));
    else keepTabIn(box, event);
  });
  installFilesStyles(doc);
  show(at);
  // Over the page, wearing the form's skin, scheme and direction.
  (context.home.closest('.fd-form') ?? doc.body).append(backdrop);
  box.focus();
}

/** A picture picked, shown from the file itself while it is on its way: an address to let go once it is stored. */
export const preview = (file: File): string => (/^image\//.test(file.type) && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '');

/** What files picked for a field are taken with: the form and the field, its words, the files it holds now, and where it says why. */
export interface FilesTaking {
  form: Form;
  name: string;
  field: FileField;
  doc: Document;
  words: WidgetLabels;
  messages: Messages;
  /** The files the field holds now. */
  held(): readonly FileValue[];
  /** Why some were not taken, a line each: said at once, and again with a photo too large even once smaller. */
  say(lines: string[]): void;
}

/**
 * Files picked or dropped for a file or picture field, taken as the field takes them — a file field's list, a photo
 * set alike: one of a kind it does not take, too large, already there or past the most is refused, said why; a photo
 * made smaller first (the field's `shrink`), and checked for its size once it is. Where the data source stores files
 * (`upload`), each goes to the store as it is picked: the uploads started, each with its file. Otherwise each is read
 * into the field's value as its bytes, after the files it holds, for the record shown as they were picked.
 */
export async function takeFiles(taking: FilesTaking, chosen: readonly File[]): Promise<{ id: string; file: File }[]> {
  const { form, name, field, doc, messages, words, say } = taking;
  const several = field.multiple === true;
  const most = several ? (field.maxFiles ?? Infinity) : 1;
  // Picked on the record shown now: read once another is shown, the files are laid on no record.
  const shown = stillShown(form);
  const storing = form.canUpload();
  // A photo made smaller is checked for its size once it is: a 12 MB photo may well fit.
  const shrink = shrinkFor(field, storing);
  const files = taking.held();
  const going = several ? form.uploading(name) : [];
  const kept: File[] = [];
  const lines: string[] = [];
  let over = 0;
  for (const file of chosen) {
    const checked = shrink && shrinkable(file) ? { ...field, maxSize: undefined } : field;
    const problem = fileProblem(checked, file, messages) ?? (several && [...files, ...going, ...kept].some((f) => f.name === file.name) ? fill(words.alreadyAdded, { name: file.name }) : undefined);
    if (problem) lines.push(problem);
    else if ((several ? files.length + going.length : 0) + kept.length < most) kept.push(file);
    else over++;
  }
  if (over && several) lines.push(fill(words.tooMany, { max: most, n: over }));
  say(lines);
  if (!kept.length) return [];
  // Too large even once smaller: refused, saying so.
  const smaller = async (file: File) => {
    const made = shrink ? await shrinkPhoto(file, shrink, doc) : file;
    const problem = fileProblem(field, made, messages);
    if (problem) throw saveRefused({ kind: 'rule', message: problem });
    return made;
  };
  if (storing) {
    const ids = form.upload(name, kept, shrink ? { prepare: (file) => smaller(file as File) } : {});
    return ids.map((id, at) => ({ id, file: kept[at] }));
  }
  const ready: File[] = [];
  for (const file of kept) {
    try {
      ready.push(await smaller(file));
    } catch (error) {
      say([...lines, (error as Error).message]);
    }
  }
  if (!ready.length) return [];
  warnInline(form, ready);
  const added = await Promise.all(ready.map(readFile));
  if (shown()) form.setValue(name, several ? [...taking.held(), ...added] : added[0]);
  return [];
}

function fileWidget(kind: 'binary' | 'image'): WidgetFactory {
  return ({ form, name, field: def, node, id, document: doc, labels, locale = 'en', preferences }) => {
    installFilesStyles(doc);
    const field = def as FileField;
    const words = wordsFor(labels, locale);
    const messages = MESSAGES[locale] ?? MESSAGES.en;
    const make = maker(doc);
    const several = field.multiple === true;
    const most = several ? (field.maxFiles ?? Infinity) : 1;
    const image = kind === 'image';
    // How the files show: the page's way, or with a switch the person's — a list, or the page's pictures, cards unless it says thumbnails.
    const own = String(node.options?.['files'] ?? (image ? 'thumbnails' : 'list'));
    const pictures = own === 'thumbnails' ? own : 'cards';
    const switchable = node.options?.['filesSwitch'] === true;
    const kept = `${form.page.id}.${node.id}.files`;
    const chosen = switchable ? preferences?.get(kept) : null;
    const camera = node.options?.['camera'];
    const accept = field.type === 'binary' ? field.accept : ['image/*'];
    const element = make('div');
    const input = make('input', { type: 'file', id, class: 'fd-sr-only', accept: accept?.join(','), capture: camera ? (camera === 'user' ? 'user' : 'environment') : undefined });
    input.multiple = several;

    // A voice note or a short film recorded on the page, where the node says and the browser can.
    const recorded: RecordedKind[] = field.type === 'binary' && canRecord(doc) ? recordedKinds(node.options) : [];
    // The limits, said before anyone tries.
    const limits = [
      !image && accept ? describeTypes(accept, messages.or) : '',
      field.maxSize ? fill(several ? words.upToEach : words.upToSize, { size: formatBytes(field.maxSize) }) : '',
      several && field.maxFiles ? fill(words.upToFiles, { max: field.maxFiles }) : '',
      ...recorded.map((kind) => fill(kind === 'audio' ? words.recordVoiceUpTo : words.recordVideoUpTo, { time: minutes(recordSeconds(node.options, kind)) })),
    ].filter(Boolean);
    // A tile after the pictures, a drop zone over the list.
    const pick = make(
      'label',
      { class: 'fd-file-pick', for: id },
      make('span', { class: 'fd-button' }, several ? (image ? words.addPhotos : words.addFiles) : image ? words.uploadImage : words.upload),
      make('span', { class: 'fd-help' }, several ? words.dropThem : words.dropHere)
    );
    const limited = make('span', { class: 'fd-help fd-file-limits' }, limits.join(' · '));
    const count = several ? make('span', { class: 'fd-help fd-file-count' }) : null;
    const list = make('ul', { class: 'fd-files', role: 'list' });
    const replace = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.replace);
    replace.addEventListener('click', () => input.click());
    // Removing asks first, in place: "Remove report.pdf?  Remove · Keep".
    const confirm = askFirst(make, { yes: words.removeFile, no: words.keep });
    // Why files were not added, and one removed: said politely, and shown.
    const note = make('div', { class: 'fd-help fd-file-note', role: 'status' });
    const way = (as: string, words: string) => {
      const button = make('button', { type: 'button', 'data-view': as }, drawIcon(doc, as, VIEWS) as SVGSVGElement, words);
      button.addEventListener('click', () => (showAs(as), preferences?.set(kept, as)));
      return button;
    };
    const switcher = switchable ? make('div', { class: 'fd-file-views', role: 'group', 'aria-label': words.showFilesAs }, way('list', words.asList), way(pictures, pictures === 'cards' ? words.asCards : words.asThumbnails)) : null;
    // Over the files: how many there are, and the switch.
    const bar = count || switcher ? make('div', { class: 'fd-file-bar' }, ...(count ? [count] : []), ...(switcher ? [switcher] : [])) : null;
    // Record a voice note, Record a video: beside the picker, the recorder opened over the form.
    let recording: { close(): void } | null = null;
    const record = (kind: RecordedKind, button: HTMLButtonElement) => {
      if (readonly || recording) return;
      // Asked for on the record shown now: what is recorded is laid on no other.
      const shown = stillShown(form);
      loadRecordPart().then(
        (part) => {
          if (!shown() || !button.isConnected || recording) return;
          say([]);
          recording = part.openRecorder({
            doc,
            words,
            kind,
            maxSeconds: recordSeconds(node.options, kind),
            ...(field.maxSize ? { maxBytes: field.maxSize } : {}),
            ...(accept ? { accept } : {}),
            home: element,
            now: () => form.now(),
            ...(form.page.timeZone ? { timeZone: form.page.timeZone } : {}),
            use: (file) => void (shown() && take([file])),
            closed: () => {
              recording = null;
              if (button.isConnected && !button.hidden) button.focus();
              else (list.querySelector('button') ?? input).focus();
            },
          });
        },
        () => say([words.recorderNoPart])
      );
    };
    const recordRow = recorded.length
      ? make(
          'div',
          { class: 'fd-file-records' },
          ...recorded.map((kind) => {
            const button = make('button', { type: 'button', class: 'fd-button fd-file-record', 'data-record': kind }, drawIcon(doc, kind, RECORDING) as SVGSVGElement, kind === 'audio' ? words.recordVoice : words.recordVideo);
            button.addEventListener('click', () => record(kind, button));
            return button;
          })
        )
      : null;
    const top = [input, pick, ...(recordRow ? [recordRow] : []), ...(limits.length ? [limited] : [])];
    element.append(...(bar ? [bar] : []), list, replace, confirm.element, note);
    let display = own;
    function showAs(as: string) {
      display = as;
      const tiles = as !== 'list';
      element.className = `fd-file fd-file-${kind} fd-files-${as === 'thumbnails' ? 'thumbs' : as}`;
      pick.classList.toggle('fd-image-pick', tiles);
      // A list has its drop zone over the files; pictures end with the add tile, after the last of them as the keys go too.
      if (tiles) list.after(...top);
      else (bar ?? list).before(...top);
      switcher?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['view'] === as)));
      // Files on their way are drawn again in the new way too.
      for (const { item } of goingItems.values()) item.element.remove();
      goingItems.clear();
      draw();
      drawGoing();
    }

    let readonly = false;
    let files: FileValue[] = [];
    let shown: unknown;
    const say = (lines: string[]) => note.replaceChildren(...lines.map((line) => make('div', {}, line)));
    // What came of the uploads, on a line of its own, so it never takes the place of why files were not added.
    const news = make('div', { class: 'fd-help fd-file-news', role: 'status' });
    note.after(news);
    const tell = (text: string, failed = false) => {
      setAttr(news, 'data-failed', failed ? '' : null);
      setText(news, text);
    };
    /** This field's files on their way to the store, as the form has them: in a table's cell, its line's. */
    const goingNow = (): readonly FileUpload[] => form.uploading(name);

    const take = async (chosen: File[]) => {
      if (readonly || !chosen.length) return;
      const started = await takeFiles({ form, name, field, doc, words, messages, held: () => files, say }, chosen);
      if (!started.length) return;
      // Each to the store as it is picked; its picture shown from the file meanwhile.
      tell('');
      for (const { id: upload, file } of started) previews.set(upload, preview(file));
      // Drawn as the form told of them, before their pictures were known: drawn again with them.
      for (const { id: upload } of started) goingItems.get(upload)?.item.element.remove();
      for (const { id: upload } of started) goingItems.delete(upload);
      drawGoing();
    };

    // ---- files on their way to the store ------------------------------------------------
    /** Each upload's item, by its id, and the picture it shows meanwhile. */
    const goingItems = new Map<string, { item: GoingItem; name: string }>();
    const previews = new Map<string, string>();
    let seenUploads: readonly FileUpload[] | undefined;
    let uploadedSince = 0;
    const saidFailed = new Set<string>();
    /** The files on their way, after the stored ones: patched in place, so a button keeps the focus while its bar moves. */
    function drawGoing() {
      const going = goingNow();
      const ids = new Set(going.map((upload) => upload.id));
      let focusAt = -1;
      for (const [id, { item, name: was }] of goingItems) {
        if (ids.has(id)) continue;
        if (item.element.contains(doc.activeElement)) focusAt = [...list.children].indexOf(item.element);
        item.element.remove();
        goingItems.delete(id);
        const preview = previews.get(id);
        if (preview) URL.revokeObjectURL(preview);
        previews.delete(id);
        // Gone because it is stored, not cancelled: the field holds it now.
        if (files.some((file) => file.name === was)) uploadedSince++;
      }
      for (const upload of going) {
        let item = goingItems.get(upload.id)?.item;
        if (!item) {
          const preview = previews.get(upload.id);
          const about = { name: upload.name, type: upload.type, size: upload.size };
          const shown = preview ? picture(make, preview, () => icon(make, about)) : icon(make, about);
          item = goingItem(make, words, display === 'cards' ? make('span', { class: 'fd-file-picture' }, shown) : shown, (text) => (display === 'cards' ? namedOnCard : named)(make, text), {
            cancel: () => form.cancelUpload(upload.id),
            retry: () => form.retryUpload(upload.id),
          });
        }
        goingItems.set(upload.id, { item, name: upload.name });
        item.update(upload, readonly);
        if (item.element.parentNode !== list || item.element !== list.lastElementChild) list.append(item.element);
        // Said once, as it fails: the bar alone would not tell a screen reader.
        if (upload.status === 'failed' || upload.status === 'refused') {
          if (!saidFailed.has(upload.id)) tell(fill(words.notUploadedNamed, { name: upload.name }), true);
          saidFailed.add(upload.id);
        } else saidFailed.delete(upload.id);
      }
      // Once nothing is on its way, how many got there.
      if (!going.some(uploadGoing) && uploadedSince) {
        tell(uploadedSince === 1 ? words.fileUploaded : fill(words.filesUploaded, { n: uploadedSince }));
        uploadedSince = 0;
      }
      if (focusAt >= 0) (list.children[Math.min(focusAt, list.children.length - 1)]?.querySelector<HTMLElement>('button') ?? input).focus();
    }
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
      // A file on its way has its own Cancel and Retry.
      if (!button || button.closest('.fd-file-going')) return;
      if (button.classList.contains('fd-file-open')) return view(at, button);
      confirm.ask(fill(words.removeAsk, { name: files[at].name }), (remove) => {
        const gone = files[at];
        if (remove) {
          form.setValue(name, several ? files.filter((_, i) => i !== at) : null);
          say([fill(words.removed, { name: gone.name })]);
        }
        (list.querySelectorAll<HTMLElement>('.fd-file-remove')[remove ? Math.min(at, files.length - 1) : at] ?? (pick.hidden ? replace : input)).focus();
      });
    });

    /** The addresses made for films and sounds held in the value, let go as they are drawn again, and as the field goes. */
    const played = new Set<string>();
    const letGo = () => {
      for (const url of played) URL.revokeObjectURL(url);
      played.clear();
    };
    /** A file's picture: a photo's own, a film's frame, else its kind's page. */
    const shownOf = (file: FileValue) => {
      const kind = kindOf(file);
      if (kind === 'image' && source(file)) return picture(make, source(file), () => icon(make, file));
      const src = kind === 'video' ? playedFrom(file, played) : '';
      return kind === 'video' && (src || file.poster) ? filmFrame(make, file, src, () => icon(make, file)) : icon(make, file);
    };
    /** The files, each opening, and each with × to remove it unless the field reads only; a sound in a list with its player under it. */
    function draw() {
      letGo();
      list.replaceChildren(
        ...files.map((file, at) =>
          make(
            'li',
            { class: 'fd-file-item' },
            make(
              'button',
              // Named whole: the name's two parts would be read as two words.
              { type: 'button', class: 'fd-file-open', 'data-at': String(at), 'aria-haspopup': 'dialog', 'aria-label': `${file.name}, ${formatBytes(file.size)}` },
              ...[shownOf(file)].map((shown) => (display === 'cards' ? make('span', { class: 'fd-file-picture' }, shown) : shown)),
              (display === 'cards' ? namedOnCard : named)(make, file.name),
              // Apart in its text too, as on screen: "plan.pdf 4.3 KB", which its name holds.
              ' ',
              make('span', { class: 'fd-file-size' }, formatBytes(file.size))
            ),
            ...(readonly ? [] : [make('button', { type: 'button', class: 'fd-file-remove', 'data-at': String(at), 'aria-label': fill(words.remove, { name: file.name }) }, '×')]),
            // A voice note listened to where it is, in the browser's own player.
            ...(display === 'list' && kindOf(file) === 'audio' ? [playedFrom(file, played)].filter(Boolean).map((url) => player(make, 'audio', file, url, () => make('span'), { class: 'fd-file-player' })) : [])
          )
        ),
        // Those on their way stay after them, as they were.
        ...[...goingItems.values()].map(({ item }) => item.element)
      );
    }
    showAs(chosen === 'list' || chosen === pictures ? chosen : own === pictures ? own : 'list');

    /** A file open in a dialog, the arrows and Previous and Next going through them all; back on its button once closed. */
    function view(at: number, opener: HTMLElement) {
      viewFiles({ doc, words, id: `${id}-view`, files, at, home: element, back: (last) => (opener.isConnected ? opener : list.querySelectorAll<HTMLElement>('.fd-file-open')[last]) });
    }

    return {
      element,
      focus: () => (list.querySelector('button') ?? (pick.hidden ? replace : input)).focus(),
      update(state) {
        readonly = state.readonly;
        const value = state.value as FileValue | FileValue[] | null | undefined;
        files = Array.isArray(value) ? value : value ? [value] : [];
        const going = goingNow();
        const full = files.length + (several ? going.length : 0) >= most;
        setHidden(pick, full || readonly);
        if (recordRow) setHidden(recordRow, full || readonly);
        setHidden(limited, readonly);
        input.disabled = readonly;
        input.hidden = pick.hidden;
        setHidden(replace, several || !files.length || readonly);
        // The switch shows once there is a file, stored or on its way.
        if (bar) setHidden(bar, !files.length && !going.length);
        if (count) setText(count, !files.length ? '' : several && field.maxFiles ? fill(words.fileCountOf, { n: files.length, max: field.maxFiles }) : files.length === 1 ? words.oneFile : fill(words.fileCount, { n: files.length }));
        describeState(input, state);
        const uploads = form.getState().uploads;
        if (shown !== value || list.dataset['readonly'] !== String(readonly)) {
          shown = value;
          list.dataset['readonly'] = String(readonly);
          draw();
        }
        // The files on their way, as the form has them now.
        if (uploads !== seenUploads || going.length !== goingItems.size) {
          seenUploads = uploads;
          drawGoing();
        }
      },
      destroy() {
        for (const preview of previews.values()) if (preview) URL.revokeObjectURL(preview);
        previews.clear();
        letGo();
        recording?.close();
      },
    };
  };
}

export const binaryWidget = fileWidget('binary');
export const imageWidget = fileWidget('image');

