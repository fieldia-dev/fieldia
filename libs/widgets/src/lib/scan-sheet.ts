import { keepTabIn } from './focus-trap';
import { maker } from './kind-parts';
import type { WidgetLabels } from './labels';
import { codeReaderFor, type CodeReader, type FoundCode } from './scan-reader';

/**
 * The camera's sheet (the scan part): a dialog over the page with the camera's picture — the back camera on a phone —
 * a frame to hold the code in, and what it says under it. It reads the picture several times a second with the reader
 * of the formats asked (scan-reader.ts) and hands each code read to the field (`read`), which says what it came to: kept
 * — the sheet beeps where the browser lets it, buzzes a phone, and closes, or reads on where a table counts — or why
 * not, said in the sheet as it reads on; a code of a kind the field takes nothing from is said too (`others`), never
 * met with silence. A table counted has a box in the sheet to type a code whose label will not scan, read as one the
 * camera read. Escape, × and Type it instead close it, and the camera stops the moment it closes. Where the camera cannot open — not allowed, none, in use, none on the page — or no reader can come, it
 * closes at once saying why (`closed`), for the field to say so beside its button.
 */

/** Why the camera's sheet closed without a code: the person's own way out, or what kept the camera from opening. */
export type ScanEnd = 'read' | 'closed' | 'type' | ScanProblem;
/** What kept the camera from opening, or the code from being read. */
export type ScanProblem = 'refused' | 'absent' | 'busy' | 'unavailable' | 'noReader';

/** What a code read came to: `kept` (the field took it), `close` (the sheet is done), and what to say in the sheet. */
export interface ScanAnswer {
  kept: boolean;
  close?: boolean;
  said?: string;
}

export interface ScanSheetOptions {
  doc: Document;
  /** The button that opened it: the sheet wears the look of the form round it, and the focus goes back to it. */
  from: HTMLElement;
  words: WidgetLabels;
  title: string;
  /** Its first words under the picture once the camera shows: where to hold the code. */
  aim: string;
  formats: readonly string[];
  /** Codes of other kinds it reads too, to say the field takes nothing from them: `others`'s words. */
  seen?: readonly string[];
  /** What a code of a kind the field takes nothing from is said as: "This code has no Lot in it." */
  others?: string;
  /** A table counting: the sheet stays open, reading on, and its way out is Done. */
  counting: boolean;
  /** A beep for each code read, where the browser lets it (the press that opened the sheet allows it). */
  sound: boolean;
  /** A code read, handed to the field: what it came to; `say` puts words under the picture meanwhile. Never asked again while it answers. */
  read(code: FoundCode, say: (text: string) => void): Promise<ScanAnswer>;
  /** Closed: by a code kept, by the person, or because the camera could not open. Said once. */
  closed(end: ScanEnd): void;
}

export interface ScanSheet {
  /** Close it at once, saying nothing (the field taken away, another record shown). */
  close(): void;
}

/** How often a frame is read: a phone's reader keeps up, and a slower one (the decode part) has room between. */
const EVERY_MS = 150;
/**
 * A code read again within this of last seeing it is the same item still in sight, not another: an item counts again
 * once it was out of sight this long — a frame or two that read nothing (a blur) is not out of sight.
 */
const GONE_MS = 800;
/** Formats with no check of their own (Code 39): read twice alike before they are taken. */
const UNCHECKED = new Set(['code_39']);

/** The problem a camera's refusal names, by the error's name as browsers give it. */
function problemOf(error: unknown): ScanProblem {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'refused';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'absent';
}

/** A short tone where the browser plays one: high for a code kept, low for one refused. */
function tone(audio: AudioContext | null, kept: boolean): void {
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = kept ? 1760 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    const now = audio.currentTime;
    osc.start(now);
    osc.stop(now + (kept ? 0.09 : 0.22));
  } catch {
    // No sound here: the words say it.
  }
}

/** The sheet opened from `from`, the camera asked for at once. */
export function openScanSheet(options: ScanSheetOptions): ScanSheet {
  const { doc, words } = options;
  const win = doc.defaultView;
  const make = maker(doc);
  const id = `fd-scan-${Math.random().toString(36).slice(2, 8)}`;
  // Made by the press that opened the sheet, so a browser lets it play.
  let audio: AudioContext | null = null;
  if (options.sound && win) {
    try {
      const sounds = win as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Audio = sounds.AudioContext ?? sounds.webkitAudioContext;
      audio = Audio ? new Audio() : null;
    } catch {
      audio = null;
    }
  }

  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, options.title);
  const shut = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': words.close, title: words.close }, '×');
  const video = make('video', { class: 'fd-scan-video', 'aria-hidden': 'true' });
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.autoplay = true;
  const frame = make('div', { class: 'fd-scan-frame', 'aria-hidden': 'true' });
  const said = make('p', { class: 'fd-scan-said', role: 'status', 'aria-live': 'polite' }, words.scanStarting);
  const way = make('button', { type: 'button', class: options.counting ? 'fd-button fd-button-primary fd-scan-done' : 'fd-button fd-scan-type' }, options.counting ? words.scanDone : words.scanTypeInstead);
  // Counting, a code is typed in the sheet itself — there is no box of the field's to type it in.
  const typed = options.counting ? make('input', { type: 'text', class: 'fd-input fd-scan-typed', id: `${id}-typed`, autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done' }) : null;
  const count = typed ? make('button', { type: 'button', class: 'fd-button fd-scan-count' }, words.scanTypeCount) : null;
  const typing = typed && count ? make('div', { class: 'fd-scan-typing' }, make('label', { class: 'fd-label', for: typed.id }, words.scanTypeCode), make('div', { class: 'fd-scan-typing-row' }, typed, count)) : null;
  const box = make(
    'div',
    { class: 'fd-theme fd-form-dialog fd-size-small fd-scan-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, 'aria-describedby': `${id}-said`, tabindex: '-1' },
    make('div', { class: 'fd-form-dialog-head' }, title, shut),
    make('div', { class: 'fd-form-dialog-body fd-scan-body' }, make('div', { class: 'fd-scan-view' }, video, frame), said, ...(typing ? [typing] : [])),
    make('div', { class: 'fd-actions fd-form-dialog-foot fd-scan-foot' }, way)
  );
  said.id = `${id}-said`;
  // The look of the form the field is on, as the sheet sits outside it.
  const root = options.from.closest<HTMLElement>('.fd-form') ?? options.from.closest<HTMLElement>('[data-fd-theme], [dir]');
  for (const { name, value } of [...(root?.attributes ?? [])]) if ((name.startsWith('data-') && name !== 'data-max-width') || name === 'dir' || name === 'lang') box.setAttribute(name, value);
  // Its tokens and accent through the style object, which a strict policy lets be: a style attribute it refuses.
  if (root) box.style.cssText = root.style.cssText;
  const backdrop = make('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop fd-scan-backdrop' }, box);
  (doc.body ?? doc.documentElement).append(backdrop);
  shut.focus();

  let stream: MediaStream | null = null;
  let reader: CodeReader | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  /** The last code read, and when it was last seen: the same item held still is read once. */
  let last: { text: string; seen: number } | null = null;
  /** A code with no check of its own, seen once: taken when the next frame reads it alike. */
  let once: string | null = null;

  function stop() {
    clearTimeout(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    video.srcObject = null;
    // Closed once the last beep has sounded: a code kept closes the sheet at once, its beep whole all the same.
    const sound = audio;
    audio = null;
    if (sound) setTimeout(() => void sound.close?.().catch(() => undefined), 400);
  }
  function close(end: ScanEnd | null) {
    if (done) return;
    done = true;
    stop();
    backdrop.remove();
    if (end) options.closed(end);
  }
  function say(text: string, how: 'problem' | 'kept' | null = null) {
    said.textContent = text;
    said.toggleAttribute('data-problem', how === 'problem');
    said.toggleAttribute('data-kept', how === 'kept');
  }

  shut.addEventListener('click', () => close('closed'));
  /** A code typed in the sheet: read as one the camera read — said, counted — the box emptied once it is kept. */
  let reading = false;
  async function readTyped() {
    const text = typed?.value.trim() ?? '';
    if (!typed || !text || reading || done) return;
    reading = true;
    let answer: ScanAnswer;
    try {
      answer = await options.read({ rawValue: text, format: '' }, (words) => !done && say(words));
    } catch {
      answer = { kept: false };
    } finally {
      reading = false;
    }
    if (done) return;
    tone(audio, answer.kept);
    if (answer.said) say(answer.said, answer.kept ? 'kept' : 'problem');
    if (answer.kept) typed.value = '';
    if (answer.close) close('read');
    else typed.focus();
  }
  count?.addEventListener('click', () => void readTyped());
  typed?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void readTyped();
  });
  way.addEventListener('click', () => close(options.counting ? 'closed' : 'type'));
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close('closed');
      return;
    }
    keepTabIn(box, event);
  });

  /** One frame read: the first code of the formats asked, handed on unless it is the same item still in sight. */
  async function look() {
    // Taken out of the page by someone else (an app replacing what it shows): the camera stops with it.
    if (!backdrop.isConnected) return close(null);
    if (done || !reader) return;
    let found: FoundCode[] = [];
    // A frame only once the camera gives one.
    if (video.readyState >= 2) {
      try {
        const seen = [...options.formats, ...(options.seen ?? [])];
        found = (await reader.detect(video)).filter((code) => code.rawValue && seen.includes(code.format));
      } catch {
        found = [];
      }
    }
    if (done) return;
    const code = found.find((one) => options.formats.includes(one.format)) ?? found[0];
    if (!code) {
      once = null;
      return;
    }
    // The same item, still in sight.
    if (last && last.text === code.rawValue && Date.now() - last.seen < GONE_MS) {
      last.seen = Date.now();
      return;
    }
    if (UNCHECKED.has(code.format) && once !== code.rawValue) {
      once = code.rawValue;
      return;
    }
    once = null;
    frame.setAttribute('data-read', '');
    let answer: ScanAnswer;
    try {
      // A code of a kind the field takes nothing from: said so, never left to silence.
      answer = options.formats.includes(code.format) ? await options.read(code, (text) => !done && say(text)) : { kept: false, said: options.others ?? words.scanAim };
    } catch {
      answer = { kept: false };
    }
    if (done) return;
    frame.removeAttribute('data-read');
    tone(audio, answer.kept);
    if (answer.kept) win?.navigator.vibrate?.(40);
    if (answer.said) say(answer.said, answer.kept ? 'kept' : 'problem');
    last = { text: code.rawValue, seen: Date.now() };
    if (answer.close) close('read');
  }
  function next() {
    if (done) return;
    timer = setTimeout(() => void look().then(next, next), EVERY_MS);
  }

  void (async () => {
    const media = win?.navigator.mediaDevices;
    if (!media?.getUserMedia) return close('unavailable');
    try {
      stream = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (error) {
      return close(problemOf(error));
    }
    if (done) return stop();
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Played by itself (autoplay), or a browser with no picture to play here: the frames are read as they come.
    }
    try {
      reader = await codeReaderFor(options.formats, doc, options.seen ?? []);
    } catch {
      return close('noReader');
    }
    if (done) return;
    say(options.aim);
    next();
  })();

  return { close: () => close(null) };
}
