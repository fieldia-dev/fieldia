import { createForm, type DataSource, type Field, type FieldNode, type FileValue, type Page, type UploadedFile, type UploadFile } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { recordingType } from './recorder';

/**
 * A voice note or a short film recorded on the page, as a person meets it: a file field whose node says
 * `options.record` offers Record beside its picker, with how long a recording may be — never where the browser cannot
 * record; Record opens the recorder over the form, which asks for the microphone (and the camera); a refusal, no
 * device, or one in use is said with Try again; Start, the time, Stop — or the limit, which stops it and says so — then
 * the recording played back, Use this recording or Record again. Used, it is the field's as a file picked is: inside the
 * record, or through the data source's `upload`. One made and not used is let go only once the person says so, and the
 * microphone's light goes out whenever the recorder closes.
 */

// jsdom has no object URLs, no microphone and no recorder, and its Blob reads no bytes of itself (no arrayBuffer): the
// browser's are stood in for.
const made: string[] = [];
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function')
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((done, fail) => {
          const reader = new FileReader();
          reader.onload = () => done(reader.result as ArrayBuffer);
          reader.onerror = () => fail(reader.error);
          reader.readAsArrayBuffer(this);
        });
      },
    });
  Object.assign(URL, { createObjectURL: () => (made.push(`blob:${made.length + 1}`), made[made.length - 1]), revokeObjectURL: () => undefined });
});

class Track {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}
const tracks: Track[] = [];
class Stream {
  own = [new Track(), new Track()];
  constructor() {
    tracks.push(...this.own);
  }
  getTracks() {
    return this.own;
  }
}
class Recorder {
  static isTypeSupported = (type: string) => /^(audio|video)\/webm/.test(type);
  /** How long the browser's recorder takes to begin once asked (Chrome 156's MP4 one, a second and more under load). */
  static startsAfter = 0;
  /** What it hands back once stopped, having begun: a WebM's first bytes, unless a test gives a whole one. */
  static recording: Uint8Array<ArrayBuffer> = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
  state = 'inactive';
  began = false;
  mimeType: string;
  private listeners: Record<string, ((event: Event & { data?: Blob }) => void)[]> = {};
  constructor(_stream: Stream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }
  addEventListener(type: string, listener: (event: Event & { data?: Blob }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  private tell(type: string, more: object = {}) {
    for (const listener of this.listeners[type] ?? []) listener(Object.assign(new Event(type), more));
  }
  /** As a browser's: recording at once, its `start` told once it has begun — a moment after, never in the same turn. */
  start() {
    this.state = 'recording';
    setTimeout(() => {
      if (this.state !== 'recording') return;
      this.began = true;
      this.tell('start');
    }, Recorder.startsAfter);
  }
  /**
   * As a browser's: its last data and its end told a moment after it is stopped, never in the same turn. Stopped before
   * it began, as Chrome 156's: its start told late, then no bytes, then its end.
   */
  stop() {
    const began = this.began;
    this.state = 'inactive';
    setTimeout(() => {
      if (!began) this.tell('start');
      this.tell('dataavailable', { data: new Blob(began ? [Recorder.recording] : [], { type: this.mimeType }) });
      this.tell('stop');
    }, 5);
  }
}
let asked: MediaStreamConstraints[] = [];
let answer: () => Promise<unknown> = async () => new Stream();
function devices(on: boolean) {
  Object.defineProperty(navigator, 'mediaDevices', { value: on ? { getUserMedia: (constraints: MediaStreamConstraints) => (asked.push(constraints), answer()) } : undefined, configurable: true });
  Object.assign(window, { MediaRecorder: on ? Recorder : undefined });
}
beforeEach(() => {
  asked = [];
  tracks.length = 0;
  Recorder.startsAfter = 0;
  Recorder.recording = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
  answer = async () => new Stream();
  devices(true);
});

const refused = (name: string) => async () => {
  throw Object.assign(new Error(name), { name });
};

function setup(options: Record<string, unknown> | undefined, more: { field?: Record<string, unknown>; upload?: DataSource['upload'] } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    timeZone: 'UTC',
    data: { kind: 'record', model: 'visit' },
    fields: { x: { type: 'binary', label: 'Voice notes', multiple: true, ...more.field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options ? { options } : {}) }] },
  } as Page;
  const form = createForm({ page, now: () => new Date('2026-10-21T07:30:05Z'), dataSource: more.upload ? { upload: more.upload } : {} });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node, id: 'fd-x', document, labels: WIDGET_LABELS.en });
  const root = document.createElement('div');
  root.className = 'fd-form';
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, widget, value: () => (form.getState().values['x'] ?? []) as FileValue[] };
}

async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 3000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
const button = (within: ParentNode, name: string) => [...within.querySelectorAll('button')].find((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name) as HTMLButtonElement | undefined;
const recorder = () => document.querySelector('.fd-recorder') as HTMLElement | null;
const said = () => recorder()?.querySelector('.fd-recorder-said')?.textContent ?? '';
const shown = (name: string) => {
  const found = recorder() && button(recorder() as HTMLElement, name);
  return !!found && !found.hidden;
};
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('Record beside a file field’s picker', () => {
  it('is offered where the node says, with how long a recording may be — never where the browser cannot record, nor on a field that records nothing', () => {
    const plain = setup(undefined);
    expect(plain.el.querySelector('.fd-file-records')).toBeNull();
    const voice = setup({ record: 'audio' });
    expect(button(voice.el, 'Record a voice note')).toBeDefined();
    expect(voice.el.querySelector('.fd-file-limits')?.textContent).toBe('voice notes up to 2:00');
    const both = setup({ record: ['audio', 'video'], maxSeconds: 45 });
    expect([...both.el.querySelectorAll('.fd-file-record')].map((b) => b.textContent)).toEqual(['Record a voice note', 'Record a video']);
    expect(both.el.querySelector('.fd-file-limits')?.textContent).toBe('voice notes up to 0:45 · videos up to 0:45');
    // A film's own limit is a minute unless the page says.
    expect(setup({ record: 'video' }).el.querySelector('.fd-file-limits')?.textContent).toBe('videos up to 1:00');
    // No microphone to ask for (a page not served over https), or no recorder: hidden, never a button that cannot work.
    devices(false);
    const none = setup({ record: 'audio' });
    expect(none.el.querySelector('.fd-file-records')).toBeNull();
    expect(none.el.querySelector('.fd-file-limits')).toBeNull();
  });

  it('records a voice note, plays it back, and keeps it in the field as a file picked is, named by when it was made', async () => {
    const { el, value } = setup({ record: 'audio' });
    const record = button(el, 'Record a voice note') as HTMLButtonElement;
    record.focus();
    record.click();
    await until(() => shown('Start recording'));
    const box = recorder() as HTMLElement;
    expect([box.getAttribute('role'), box.getAttribute('aria-modal'), document.getElementById(box.getAttribute('aria-labelledby') as string)?.textContent]).toEqual(['dialog', 'true', 'Record a voice note']);
    // The microphone alone was asked for, and the person told what to do next.
    expect(asked).toEqual([{ audio: true }]);
    expect(said()).toBe('Ready. Press Start recording.');
    expect(document.activeElement?.textContent).toContain('Start recording');
    expect(box.querySelector('.fd-recorder-time')?.textContent).toBe('0:00 / 2:00');
    button(box, 'Start recording')?.click();
    // Its clock waits for the browser's recorder to begin.
    expect(said()).toBe('Starting the recording…');
    await until(() => said() === 'Recording…');
    expect(said()).toBe('Recording…');
    expect(box.classList.contains('fd-recording')).toBe(true);
    expect(shown('Stop') && !shown('Start recording')).toBe(true);
    expect(document.activeElement?.textContent).toContain('Stop');
    button(box, 'Stop')?.click();
    await until(() => shown('Use this recording'));
    // Played back in the browser's own player; the microphone let go.
    const player = box.querySelector('.fd-recorder-review audio') as HTMLAudioElement;
    expect([player.getAttribute('src'), player.hasAttribute('controls'), player.getAttribute('aria-label')]).toEqual([made[made.length - 1], true, 'Voice note 2026-10-21 07.30.05.webm']);
    expect(tracks.every((track) => track.stopped)).toBe(true);
    expect(said()).toBe('Recorded 0:01. Play it back, then use it or record again.');
    expect(shown('Use this recording') && shown('Record again') && !shown('Stop')).toBe(true);
    button(box, 'Use this recording')?.click();
    expect(recorder()).toBeNull();
    // Inside the record, as a file picked is without a store: its media type plain, as a file field checks it.
    await until(() => value().length);
    expect(value()).toEqual([{ name: 'Voice note 2026-10-21 07.30.05.webm', type: 'audio/webm', size: 4, data: 'GkXfow==' }]);
    expect(document.activeElement).toBe(record);
    // It plays in the field, in place, as any voice note does.
    expect(el.querySelector('audio.fd-file-player')?.getAttribute('aria-label')).toBe('Voice note 2026-10-21 07.30.05.webm');
  });

  it('stores a recording through the data source’s upload where it has one, the field keeping its link', async () => {
    const sent: UploadFile[] = [];
    const upload = async (file: UploadFile): Promise<UploadedFile> => (sent.push(file), { url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: 7 });
    const { el, value } = setup({ record: 'video' }, { field: { accept: ['video/*'] }, upload });
    button(el, 'Record a video')?.click();
    await until(() => shown('Start recording'));
    // The camera, the rear one on a phone, and the microphone with it; its live picture shown.
    expect(asked).toEqual([{ audio: true, video: { facingMode: 'environment' } }]);
    expect(recorder()?.querySelector('video.fd-recorder-live')).not.toBeNull();
    button(recorder() as HTMLElement, 'Start recording')?.click();
    await until(() => said() === 'Recording…');
    button(recorder() as HTMLElement, 'Stop')?.click();
    await until(() => shown('Use this recording'));
    expect(recorder()?.querySelector('.fd-recorder-review video')?.getAttribute('aria-label')).toBe('Video 2026-10-21 07.30.05.webm');
    button(recorder() as HTMLElement, 'Use this recording')?.click();
    await until(() => value().length);
    expect(sent.map((file) => [file.name, file.type])).toEqual([['Video 2026-10-21 07.30.05.webm', 'video/webm']]);
    expect(value()).toEqual([{ url: 'https://files.example/Video 2026-10-21 07.30.05.webm', name: 'Video 2026-10-21 07.30.05.webm', size: 4, type: 'video/webm', fileId: 7 }]);
  });

  it('says a refused microphone, with Try again, and records once it is allowed', async () => {
    answer = refused('NotAllowedError');
    const { el } = setup({ record: 'audio' });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Try again'));
    expect(said()).toBe('The microphone was not allowed. Allow it for this site in your browser’s settings, then press Try again, or add a recording as a file.');
    expect(shown('Start recording')).toBe(false);
    expect(document.activeElement?.textContent).toBe('Try again');
    answer = async () => new Stream();
    button(recorder() as HTMLElement, 'Try again')?.click();
    await until(() => shown('Start recording'));
    expect(said()).toBe('Ready. Press Start recording.');
    expect(asked).toHaveLength(2);
  });

  it('says no microphone, a camera refused and a device another app holds, each in words', async () => {
    const cases: [Record<string, unknown>, string, string][] = [
      [{ record: 'audio' }, 'NotFoundError', 'No microphone was found. Connect one, then press Try again.'],
      [{ record: 'video' }, 'NotAllowedError', 'The camera or the microphone was not allowed. Allow them for this site in your browser’s settings, then press Try again, or add a video as a file.'],
      [{ record: 'audio' }, 'NotReadableError', 'The microphone or the camera could not be started: another app may be using it. Close it, then press Try again.'],
    ];
    for (const [options, name, words] of cases) {
      answer = refused(name);
      const { el } = setup(options);
      (el.querySelector('.fd-file-record') as HTMLButtonElement).click();
      await until(() => shown('Try again'));
      expect(said()).toBe(words);
      button(recorder() as HTMLElement, 'Cancel')?.click();
      expect(recorder()).toBeNull();
    }
  });

  it('stops itself at the longest a recording may be, and says so', async () => {
    const { el } = setup({ record: 'audio', maxSeconds: 1 });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    button(recorder() as HTMLElement, 'Start recording')?.click();
    await until(() => shown('Use this recording'));
    expect(said()).toBe('Stopped at 0:01, the longest a recording may be here. Recorded 0:01. Play it back, then use it or record again.');
    expect(recorder()?.querySelector('.fd-recorder-time')?.textContent).toBe('0:01 / 0:01');
  });

  it('asks before a recording made is let go: Escape, ×, or Cancel; Go back keeps it', async () => {
    const { el, value } = setup({ record: 'audio' });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    button(recorder() as HTMLElement, 'Start recording')?.click();
    await until(() => said() === 'Recording…');
    button(recorder() as HTMLElement, 'Stop')?.click();
    // Escape at once, the recording still being finished: asked too, never let go unasked.
    key(recorder() as HTMLElement, 'Escape');
    const ask = recorder()?.querySelector('.fd-file-confirm') as HTMLElement;
    expect([ask.hidden, ask.textContent]).toEqual([false, 'Discard this recording?DiscardGo back']);
    expect(document.activeElement?.textContent).toBe('Go back');
    await until(() => shown('Use this recording'));
    // Escape again is Go back: the recording kept, Use this recording focused.
    key(recorder() as HTMLElement, 'Escape');
    expect(ask.hidden).toBe(true);
    expect(document.activeElement?.textContent).toBe('Use this recording');
    button(recorder() as HTMLElement, 'Close')?.click();
    button(ask, 'Discard')?.click();
    expect(recorder()).toBeNull();
    expect(value()).toEqual([]);
    // Nothing recorded yet: Cancel closes at once, the microphone let go.
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    button(recorder() as HTMLElement, 'Cancel')?.click();
    expect(recorder()).toBeNull();
    expect(tracks.every((track) => track.stopped)).toBe(true);
  });

  it('asks too while a stopped WebM is made into its file, its length being written in: never let go unasked', async () => {
    // Firefox records WebM; under load its length took a moment to write, and Escape then let the recording go unasked
    // (0.37's CI). The WebM's head read for it is held here, the recording stopped and its file not yet made.
    const real = Blob.prototype.arrayBuffer;
    let release: (() => void) | null = null;
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((done) => (release = () => void real.call(this).then(done)));
      },
    });
    try {
      const { el, value } = setup({ record: 'audio' });
      button(el, 'Record a voice note')?.click();
      await until(() => shown('Start recording'));
      button(recorder() as HTMLElement, 'Start recording')?.click();
      await until(() => said() === 'Recording…');
      button(recorder() as HTMLElement, 'Stop')?.click();
      await until(() => release);
      key(recorder() as HTMLElement, 'Escape');
      expect(recorder()).not.toBeNull();
      const ask = recorder()?.querySelector('.fd-file-confirm') as HTMLElement;
      expect([ask.hidden, ask.textContent]).toEqual([false, 'Discard this recording?DiscardGo back']);
      // Made once its length is written; Go back keeps it, and it is used.
      (release as unknown as () => void)();
      await until(() => shown('Use this recording'));
      key(recorder() as HTMLElement, 'Escape');
      expect(ask.hidden).toBe(true);
      button(recorder() as HTMLElement, 'Use this recording')?.click();
      await until(() => value().length);
      expect(value()).toHaveLength(1);
    } finally {
      Object.defineProperty(Blob.prototype, 'arrayBuffer', { configurable: true, value: real });
    }
  });

  it('runs its clock from when the browser’s recorder began; stopped before it began, keeps nothing and says so, Start again', async () => {
    Recorder.startsAfter = 300;
    const { el, value } = setup({ record: 'audio' });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    const box = recorder() as HTMLElement;
    button(box, 'Start recording')?.click();
    // Asked, not begun: no time counted, Stop offered.
    expect(said()).toBe('Starting the recording…');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(box.querySelector('.fd-recorder-time')?.textContent).toBe('0:00 / 2:00');
    expect(shown('Stop')).toBe(true);
    button(box, 'Stop')?.click();
    await until(() => shown('Start recording'));
    // Nothing recorded: none offered to play or use, the microphone kept, Start recording again, focused.
    expect(said()).toBe('Nothing was recorded: the recording had not started yet. Press Start recording to try again.');
    expect(box.querySelector('.fd-recorder-review audio')).toBeNull();
    expect(shown('Use this recording')).toBe(false);
    expect(tracks.some((track) => track.stopped)).toBe(false);
    expect(document.activeElement?.textContent).toContain('Start recording');
    // Again, waited for: recorded, used.
    button(box, 'Start recording')?.click();
    await until(() => said() === 'Recording…');
    button(box, 'Stop')?.click();
    await until(() => shown('Use this recording'));
    button(box, 'Use this recording')?.click();
    await until(() => value().length);
    expect(value()).toHaveLength(1);
  });

  it('keeps a WebM recording with its length written in, which the browser’s recorder leaves out', async () => {
    // A WebM as Chrome's and Firefox's recorders write it: the Segment's Info with its timecode scale, no Duration.
    const el_ = (id: number[], data: number[]) => [...id, 0x80 | data.length, ...data];
    Recorder.recording = new Uint8Array([
      ...el_([0x1a, 0x45, 0xdf, 0xa3], el_([0x42, 0x82], [0x77, 0x65, 0x62, 0x6d])),
      ...[0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ...el_([0x15, 0x49, 0xa9, 0x66], el_([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40])),
      ...el_([0x16, 0x54, 0xae, 0x6b], [0xae, 0x80]),
    ]);
    const { el, value } = setup({ record: 'audio' });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    button(recorder() as HTMLElement, 'Start recording')?.click();
    await until(() => said() === 'Recording…');
    await new Promise((resolve) => setTimeout(resolve, 600));
    button(recorder() as HTMLElement, 'Stop')?.click();
    await until(() => shown('Use this recording'));
    button(recorder() as HTMLElement, 'Use this recording')?.click();
    await until(() => value().length);
    // Inside the record: its bytes hold a Duration (0x4489) of about the time it ran, in milliseconds.
    const bytes = Uint8Array.from(atob(value()[0].data as string), (c) => c.charCodeAt(0));
    const at = bytes.findIndex((_, i) => bytes[i] === 0x44 && bytes[i + 1] === 0x89 && bytes[i + 2] === 0x88);
    expect(at).toBeGreaterThan(0);
    const ms = new DataView(bytes.buffer, at + 3, 8).getFloat64(0);
    expect(ms).toBeGreaterThan(500);
    expect(ms).toBeLessThan(3000);
    expect(value()[0].size).toBe(Recorder.recording.length + 11 + 7);
  });

  it('closes, the microphone let go, when the field goes', async () => {
    const { el, widget } = setup({ record: 'audio' });
    button(el, 'Record a voice note')?.click();
    await until(() => shown('Start recording'));
    button(recorder() as HTMLElement, 'Start recording')?.click();
    widget.destroy?.();
    expect(recorder()).toBeNull();
    expect(tracks.every((track) => track.stopped)).toBe(true);
  });
});

describe('the kind a recording is made in', () => {
  it('is the first the browser records of those the field takes, MP4 before WebM', () => {
    const with_ = (supported: RegExp) => Object.assign(window, { MediaRecorder: Object.assign(class {}, { isTypeSupported: (type: string) => supported.test(type) }) }) as unknown as Window & typeof globalThis;
    expect(recordingType(with_(/webm/), 'audio')).toBe('audio/webm;codecs=opus');
    expect(recordingType(with_(/mp4|webm/), 'audio')).toBe('audio/mp4');
    expect(recordingType(with_(/mp4|webm/), 'video', ['video/webm'])).toBe('video/webm;codecs=vp9,opus');
    expect(recordingType(with_(/ogg/), 'audio', ['audio/webm'])).toBeNull();
    expect(recordingType(with_(/webm/), 'audio', ['image/*'])).toBeNull();
  });
});
