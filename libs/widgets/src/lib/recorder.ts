import { MEDIA_URL, safeUrl, type RecordedKind } from '@fieldia/core';
import { keepTabIn } from './focus-trap';
import { fillIn, maker, setHidden, setText } from './kind-parts';
import type { WidgetLabels } from './labels';
import { installRecordStyles } from './styles-record';
import { withDuration } from './webm-duration';
import { intlFormat } from '@fieldia/core';

/**
 * A voice note or a short film recorded on the page (a file field's `options.record`), in a dialog of its own over the
 * form: the browser asks for the microphone (and the camera for a film) as it opens — a refusal, no device, or one
 * another app holds said in words, with Try again — then a film's live picture or a voice's level, Start recording,
 * the time against the longest a recording may be (`maxSeconds`), and Stop; at the limit, or at the largest file the
 * field takes, it stops itself and says why. Its clock runs from when the browser's recorder has begun — Chrome's begins
 * up to a second and more after Start (0.36) — and a recording stopped before it began keeps nothing, said, with Start
 * recording again. Stopped, it plays back in the browser's own player, its length written into a WebM (which a
 * browser's recorder leaves out), with Use this recording and Record again. A recording made and not used is never let go without asking: Escape, × and Cancel ask
 * first. Used, it is handed to the field as a file picked is (`use`), named by when it was made on the page's clock,
 * and stored the way the field stores its files (the data source's `upload`, else inside the record).
 *
 * The camera's and the microphone's light goes out whenever the dialog closes. It comes in the record part
 * (record-part.ts), loaded the first time a person presses Record — never kept from a page that records nothing — and
 * its own sheet (styles-record.ts).
 */

export interface RecorderContext {
  doc: Document;
  words: WidgetLabels;
  /** A voice note (`audio`) or a short film with its sound (`video`). */
  kind: RecordedKind;
  /** The longest a recording may be, in seconds. */
  maxSeconds: number;
  /** The largest file the field takes, in bytes (`maxSize`), where it says. */
  maxBytes?: number;
  /** The media types the field takes (`accept`), where it says: a recording is made in one of them. */
  accept?: readonly string[];
  /** What it opens over: the form round the field, whose skin, scheme and direction it wears, else the page's body. */
  home: Element;
  /** The time now, on the form's clock, and the page's time zone: a recording is named by them. */
  now: () => Date;
  timeZone?: string;
  /** A recording to keep, as a file picked is. */
  use(file: File): void;
  /** Told once it is closed, used or not: the focus goes back to what opened it. */
  closed?(): void;
}

export interface Recorder {
  /** Closes it at once, asking nothing: the person left the record. */
  close(): void;
}

/** The kinds a browser records, in the order they are tried: MP4 where it can (it plays everywhere), else WebM or Ogg. */
const RECORDED_IN: Readonly<Record<RecordedKind, readonly string[]>> = {
  audio: ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'],
  video: ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
};
const EXTENSION: Readonly<Record<string, string>> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'video/mp4': 'mp4', 'video/webm': 'webm' };
/** A media type without its parameters: "audio/webm;codecs=opus" is an "audio/webm", as a file field checks it. */
const bare = (type: string) => type.split(';')[0].trim().toLowerCase();
/** Whether a field that takes `accept` takes a file of this type (`audio/*`, or the type itself). */
const takes = (accept: readonly string[] | undefined, type: string) => !accept?.length || accept.some((one) => (one.endsWith('/*') ? bare(type).startsWith(one.slice(0, -1).toLowerCase()) : bare(one) === bare(type)));

type Recorded = { start(timeslice?: number): void; stop(): void; state: string; mimeType: string; addEventListener(type: string, listener: (event: Event & { data?: Blob }) => void): void };
type RecorderClass = { new (stream: MediaStream, options?: { mimeType?: string }): Recorded; isTypeSupported?(type: string): boolean };

/** The kind this browser records in, of those the field takes: the first it says it can; none where it can record none. */
export function recordingType(win: Window & typeof globalThis, kind: RecordedKind, accept?: readonly string[]): string | null {
  const Made = (win as unknown as { MediaRecorder?: RecorderClass }).MediaRecorder;
  if (!Made) return null;
  const wanted = RECORDED_IN[kind].filter((type) => takes(accept, type));
  // A browser that cannot say what it records in records in its own: taken where the field takes any of its kind.
  if (!Made.isTypeSupported) return wanted[0] ?? null;
  return wanted.find((type) => Made.isTypeSupported?.(type)) ?? null;
}

/** "1:05" for 65 seconds, "12:00" for 720; an hour as "60:00". */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** When a recording was made, for its name, on the page's clock: "2026-10-21 11.42.05" — a name every system keeps. */
function madeAt(now: Date, timeZone?: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = intlFormat('DateTimeFormat', 'en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = intlFormat('DateTimeFormat', 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const of = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${of('year')}-${of('month')}-${of('day')} ${of('hour')}.${of('minute')}.${of('second')}`;
}

/** Why the microphone or the camera could not be had, by the error the browser gave: refused, none there, or held. */
function whyNot(error: unknown, kind: RecordedKind, words: WidgetLabels): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (/NotAllowed|Security|PermissionDenied/.test(name)) return kind === 'audio' ? words.recordMicRefused : words.recordCameraRefused;
  if (/NotFound|DevicesNotFound|Overconstrained/.test(name)) return kind === 'audio' ? words.recordNoMic : words.recordNoCamera;
  return words.recordBusy;
}

export function openRecorder(context: RecorderContext): Recorder {
  const { doc, words, kind } = context;
  const win = doc.defaultView as Window & typeof globalThis;
  const make = maker(doc);
  installRecordStyles(doc);
  const film = kind === 'video';
  const limit = context.maxSeconds;
  const titleText = film ? words.recordVideo : words.recordVoice;

  // ---- the dialog: its title and ×, the stage, what is said, the time, and the buttons ----------------------------
  const title = make('h2', { id: `fd-recorder-${Math.random().toString(36).slice(2, 8)}`, class: 'fd-form-dialog-title' }, titleText);
  const close = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': words.close }, '×');
  const live = make('video', { class: 'fd-recorder-live', muted: '', playsinline: '', autoplay: '', 'aria-hidden': 'true' }) as HTMLVideoElement;
  live.muted = true;
  // A voice's level, as bars that rise with it: shown, never read aloud (what is said says the state).
  const level = make('span', { class: 'fd-recorder-level', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, () => make('span')));
  const stage = make('div', { class: `fd-recorder-stage fd-recorder-${kind}` }, ...(film ? [live] : [level]));
  const said = make('p', { class: 'fd-recorder-said', role: 'status' });
  const time = make('span', { class: 'fd-recorder-time', role: 'timer' });
  const dot = make('span', { class: 'fd-recorder-dot', 'aria-hidden': 'true' });
  const start = make('button', { type: 'button', class: 'fd-button fd-button-primary fd-recorder-start' }, dot, words.recordStart);
  const stop = make('button', { type: 'button', class: 'fd-button fd-recorder-stop', hidden: '' }, make('span', { class: 'fd-recorder-square', 'aria-hidden': 'true' }), words.recordStop);
  const use = make('button', { type: 'button', class: 'fd-button fd-button-primary', hidden: '' }, words.recordUse);
  const again = make('button', { type: 'button', class: 'fd-button', hidden: '' }, words.recordAgain);
  const retry = make('button', { type: 'button', class: 'fd-button', hidden: '' }, words.recordTryAgain);
  const cancel = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.cancel);
  const review = make('div', { class: 'fd-recorder-review', hidden: '' });
  // Asked before a recording is let go: in place, the focus on Go back.
  const question = make('span', {}, words.recordDiscardAsk);
  const discard = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.recordDiscard);
  const back = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.recordGoBack);
  const asking = make('div', { class: 'fd-file-confirm fd-recorder-ask', hidden: '' }, question, discard, back);
  const buttons = make('div', { class: 'fd-recorder-buttons' }, start, stop, use, again, retry, cancel);
  const box = make(
    'div',
    { class: 'fd-form-dialog fd-recorder', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' },
    make('div', { class: 'fd-form-dialog-head' }, title, close),
    make('div', { class: 'fd-recorder-body' }, stage, review, said, make('div', { class: 'fd-recorder-row' }, time, buttons), asking)
  );
  const backdrop = make('div', { class: 'fd-dialog-backdrop' }, box);

  // ---- what it holds --------------------------------------------------------------------------------------------
  let stream: MediaStream | null = null;
  let recorder: Recorded | null = null;
  let chunks: Blob[] = [];
  let bytes = 0;
  let began = 0;
  let seconds = 0;
  let ticking: ReturnType<typeof setInterval> | undefined;
  let made: { file: File; url: string } | null = null;
  /** A recording stopped and being made into its file (a WebM's length written in): something to lose already. */
  let finishing = false;
  let hearing: { context: AudioContext; frame: number } | null = null;
  let gone = false;
  /** Why it stopped itself, where it did: said once it has stopped. */
  let stoppedBy = '';

  const say = (text: string) => setText(said, text);
  const showing = (...shown: HTMLElement[]) => {
    for (const button of [start, stop, use, again, retry]) setHidden(button, !shown.includes(button));
  };
  const showTime = () => setText(time, `${clock(seconds)} / ${clock(limit)}`);

  /** The microphone's level, drawn as bars while it is heard — where the browser can measure it. */
  function listen(to: MediaStream) {
    const Context = (win as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    if (film || !Context) return;
    try {
      const audio = new Context();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      audio.createMediaStreamSource(to).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const bars = [...level.children] as HTMLElement[];
      const draw = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
        bars.forEach((bar, i) => bar.style.setProperty('--fd-level', String(Math.min(1, (peak / 64) * (1 - Math.abs(i - 2) * 0.22)))));
        if (hearing) hearing.frame = win.requestAnimationFrame(draw);
      };
      hearing = { context: audio, frame: win.requestAnimationFrame(draw) };
    } catch {
      // No level where the browser cannot measure one: the time still runs.
    }
  }

  /** Lets go of the microphone and the camera — their light goes out — and of what measured them. */
  function letGoDevices() {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    live.srcObject = null;
    if (hearing) {
      win.cancelAnimationFrame(hearing.frame);
      void hearing.context.close().catch(() => undefined);
      hearing = null;
    }
  }
  function forgetRecording() {
    if (made) URL.revokeObjectURL(made.url);
    made = null;
    review.replaceChildren();
    setHidden(review, true);
  }

  /** The microphone (and the camera) asked for: the browser asks the person, the first time. */
  async function ask() {
    showing();
    forgetRecording();
    seconds = 0;
    showTime();
    setHidden(stage, false);
    say(film ? words.recordAskCamera : words.recordAskMic);
    const type = recordingType(win, kind, context.accept);
    if (!type) {
      say(words.recordCannot);
      return;
    }
    try {
      const got = await win.navigator.mediaDevices.getUserMedia(film ? { audio: true, video: { facingMode: 'environment' } } : { audio: true });
      if (gone) {
        for (const track of got.getTracks()) track.stop();
        return;
      }
      stream = got;
    } catch (error) {
      if (gone) return;
      say(whyNot(error, kind, words));
      showing(retry);
      retry.focus();
      return;
    }
    // A film's live picture: muted and played inline as it comes (autoplay), on a phone too.
    if (film) live.srcObject = stream;
    listen(stream);
    say(words.recordReady);
    showing(start);
    start.focus();
  }

  function begin() {
    if (!stream) return;
    const Made = (win as unknown as { MediaRecorder: RecorderClass }).MediaRecorder;
    const type = recordingType(win, kind, context.accept) as string;
    try {
      recorder = new Made(stream, { mimeType: type });
    } catch {
      try {
        recorder = new Made(stream);
      } catch {
        say(words.recordCannot);
        return;
      }
    }
    chunks = [];
    bytes = 0;
    stoppedBy = '';
    began = 0;
    const taken = recorder;
    taken.addEventListener('dataavailable', (event) => {
      if (!event.data?.size) return;
      chunks.push(event.data);
      bytes += event.data.size;
      // Near the largest file the field takes: stopped, so what is kept fits.
      if (context.maxBytes && bytes >= context.maxBytes * 0.95 && taken.state === 'recording') finish(words.recordStoppedSize);
    });
    // The clock and "Recording…" wait for the browser's own start: its recorder may begin a second and more after it is
    // asked (Chrome 156's MP4 one did, under load), and a clock run from the press counted time nothing was recorded in.
    taken.addEventListener('start', () => {
      if (gone || taken !== recorder || taken.state !== 'recording') return;
      began = Date.now();
      ticking = setInterval(() => {
        seconds = Math.min(limit, (Date.now() - began) / 1000);
        showTime();
        if (seconds >= limit) finish(fillIn(words.recordStoppedAt, { time: clock(limit) }));
      }, 250);
      say(words.recordingNow);
    });
    taken.addEventListener('stop', () => void stopped(taken, type));
    taken.start(1000);
    seconds = 0;
    showTime();
    box.classList.add('fd-recording');
    say(words.recordStarting);
    showing(stop);
    stop.focus();
  }

  /** Stops the recording, saying why where it stopped itself. */
  function finish(why = '') {
    if (!recorder || recorder.state !== 'recording') return;
    stoppedBy = why;
    clearInterval(ticking);
    ticking = undefined;
    // Stopped before the browser's recorder began: nothing of it was recorded.
    seconds = began ? Math.min(limit, (Date.now() - began) / 1000) : 0;
    showTime();
    recorder.stop();
  }

  async function stopped(taken: Recorded, asked: string) {
    box.classList.remove('fd-recording');
    if (gone || taken !== recorder) return;
    recorder = null;
    clearInterval(ticking);
    ticking = undefined;
    const type = bare(taken.mimeType || chunks[0]?.type || asked) || bare(asked);
    const recorded = chunks;
    chunks = [];
    // Nothing recorded — stopped before the browser's recorder began, which then hands back no bytes, or under half a
    // second after (Firefox's hands back its first moments: a slip of the hand, 0.36's walk): no recording offered (an
    // empty file plays nowhere), the microphone kept, Start recording again.
    if (!recorded.some((one) => one.size) || seconds < 0.5) {
      seconds = 0;
      showTime();
      say(words.recordNothing);
      showing(start);
      if (asking.hidden) start.focus();
      return;
    }
    letGoDevices();
    // A WebM's length written into it, which a browser's recorder never does: its player says how long it is (never
    // Infinity) and can be scrubbed, here and wherever the file is played once it is kept. Meanwhile it is a recording
    // to lose: Escape, × or Cancel ask first (Firefox's WebM, under load, gave them a moment to let it go unasked).
    finishing = true;
    const blob = await withDuration(new Blob(recorded, { type }), seconds * 1000);
    finishing = false;
    if (gone) return;
    const name = `${fillIn(film ? words.recordingNameVideo : words.recordingNameVoice, { when: madeAt(context.now(), context.timeZone) })}.${EXTENSION[type] ?? (film ? 'webm' : 'webm')}`;
    const file = new File([blob], name, { type });
    const url = URL.createObjectURL(blob);
    made = { file, url };
    // Played back in the browser's own player, named by what it is.
    const player = make(film ? 'video' : 'audio', { src: safeUrl(url, MEDIA_URL), controls: '', preload: 'metadata', 'aria-label': name, ...(film ? { playsinline: '' } : {}) });
    review.replaceChildren(player);
    setHidden(review, false);
    setHidden(stage, true);
    // Its time as its clock says it, never more.
    say([stoppedBy, fillIn(words.recordDone, { time: clock(seconds) })].filter(Boolean).join(' '));
    showing(use, again);
    // Asked meanwhile whether to let it go: the question keeps the focus until it is answered.
    if (asking.hidden) use.focus();
  }

  /** Closes the dialog, the devices let go and the recording forgotten; the focus back where it came from. */
  function done() {
    if (gone) return;
    gone = true;
    clearInterval(ticking);
    if (recorder?.state === 'recording') recorder.stop();
    recorder = null;
    letGoDevices();
    forgetRecording();
    backdrop.remove();
    context.closed?.();
  }

  /** Leaving: at once with nothing to lose, else asked first — "Discard this recording?" in place — a recording being made or finished too. */
  function leave() {
    if (!made && !recorder && !finishing) return done();
    setHidden(asking, false);
    back.focus();
  }

  start.addEventListener('click', begin);
  stop.addEventListener('click', () => finish());
  again.addEventListener('click', () => void ask());
  retry.addEventListener('click', () => void ask());
  use.addEventListener('click', () => {
    const file = made?.file;
    if (!file) return;
    context.use(file);
    done();
  });
  cancel.addEventListener('click', leave);
  close.addEventListener('click', leave);
  discard.addEventListener('click', done);
  back.addEventListener('click', () => {
    setHidden(asking, true);
    (made ? use : stop).focus();
  });
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!asking.hidden) back.click();
      else leave();
    } else keepTabIn(box, event);
  });
  backdrop.addEventListener('click', (event) => event.target === backdrop && leave());

  // Over the page, wearing the form's skin, scheme and direction.
  (context.home.closest('.fd-form') ?? doc.body).append(backdrop);
  box.focus();
  showTime();
  void ask();
  return { close: done };
}
