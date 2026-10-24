import { checkPage } from './check-page';
import { validatePage } from './validate';
import type { Page } from './page';

/**
 * A file field that records a voice note or a short film, in the page format: `options.record` is "audio", "video" or
 * both, `maxSeconds` a whole number of seconds up to an hour; it is a binary field's, whose `accept` takes what it
 * records; and `maxSeconds` goes with `record`. Refused before anything draws, by both checks.
 */

const page = (options: Record<string, unknown>, field: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.12',
    id: 'visit',
    data: { kind: 'record', model: 'visit' },
    fields: { notes: { type: 'binary', label: 'Voice notes', multiple: true, ...field }, unit: { type: 'char', label: 'Unit' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-notes', field: 'notes', options }] },
  }) as unknown as Page;
const issues = (given: Page) => {
  const full = validatePage(given);
  const quick = checkPage(given);
  return { full: full.ok ? [] : full.issues.map((i) => `${i.path}: ${i.message}`), quick: quick.ok ? [] : quick.issues.map((i) => `${i.path}: ${i.message}`) };
};
const at = 'layout.children[0]';

describe('a file field that records', () => {
  it('records a voice note, a film or both, for as long as it says', () => {
    for (const options of [{ record: 'audio' }, { record: 'video', maxSeconds: 30 }, { record: ['audio', 'video'], maxSeconds: 3600 }]) expect(issues(page(options))).toEqual({ full: [], quick: [] });
    expect(issues(page({ record: 'audio' }, { accept: ['audio/*'] }))).toEqual({ full: [], quick: [] });
    expect(issues(page({ record: ['audio', 'video'] }, { accept: ['audio/webm', 'video/mp4'] }))).toEqual({ full: [], quick: [] });
  });

  it('refuses a kind it cannot record and a length of no whole seconds or past an hour', () => {
    expect(issues(page({ record: 'photo' })).full).toEqual([`${at}.options.record: record is "audio" (a voice note), "video" (a short film) or both: ["audio", "video"]`]);
    expect(issues(page({ record: 'audio', maxSeconds: 0 })).full).toEqual([`${at}.options.maxSeconds: maxSeconds is a whole number of seconds, 1 to 3600`]);
    expect(issues(page({ record: 'audio', maxSeconds: 7200 })).full).toEqual([`${at}.options.maxSeconds: maxSeconds is a whole number of seconds, 1 to 3600: an hour at most`]);
    expect(issues(page({ record: 'audio', maxSeconds: 1.5 })).full).toEqual([`${at}.options.maxSeconds: maxSeconds is a whole number of seconds, 1 to 3600`]);
  });

  it('records on a binary field whose accept takes what it records, and a length only with something recorded', () => {
    expect(issues(page({ record: 'audio' }, { accept: ['application/pdf'] })).quick).toEqual([`${at}.options.record: "notes" accepts application/pdf: a voice note is audio (audio/*), which it would refuse`]);
    expect(issues(page({ record: ['audio', 'video'] }, { accept: ['audio/*'] })).quick).toEqual([`${at}.options.record: "notes" accepts audio/*: a film is video (video/*), which it would refuse`]);
    expect(issues(page({ maxSeconds: 30 })).quick).toEqual([`${at}.options.maxSeconds: maxSeconds is how long a recording may be: say what the field records (record: "audio" or "video")`]);
    const onWords = page({ record: 'audio' });
    (onWords.layout as unknown as { children: Record<string, unknown>[] }).children[0]['field'] = 'unit';
    expect(issues(onWords).quick).toEqual([`${at}.options.record: record is for a binary field; "unit" is a char`]);
  });
});

describe('a value shown as a code', () => {
  const coded = (widget: string, options: Record<string, unknown> | undefined, type = 'char'): Page =>
    ({
      fieldia: '0.12',
      id: 'ticket',
      data: { kind: 'record', model: 'ticket' },
      fields: { code: { type, label: 'Ticket' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-code', field: 'code', widget, ...(options ? { options } : {}) }] },
    }) as unknown as Page;

  it('is a QR code of words or a barcode of words or a whole number, at a level and a size', () => {
    for (const page of [coded('qrcode', undefined), coded('qrcode', { level: 'H', size: 240, showValue: true }, 'text'), coded('barcode', { size: 48 }), coded('barcode', undefined, 'integer')]) expect(issues(page)).toEqual({ full: [], quick: [] });
  });

  it('refuses a level, a size or a field it cannot draw', () => {
    expect(issues(coded('qrcode', { level: 'X' })).full).toEqual([`${at}.options.level: level is a QR code's error correction: "L", "M", "Q" or "H"`]);
    expect(issues(coded('qrcode', { size: 20 })).full).toEqual([`${at}.options.size: size is a whole number of pixels, 48 to 640`]);
    expect(issues(coded('barcode', { level: 'M' })).full).toEqual([`${at}.options.level: level is a QR code's error correction: a barcode has none`]);
    expect(issues(coded('qrcode', undefined, 'boolean')).quick).toEqual([`${at}.widget: qrcode is for a char or text field; "code" is a boolean`]);
    expect(issues(coded('barcode', undefined, 'float')).quick).toEqual([`${at}.widget: barcode is for a char or integer field; "code" is a float`]);
  });
});

describe('pins on a picture', () => {
  const pinned = (options: Record<string, unknown> | undefined, type = 'json'): Page =>
    ({
      fieldia: '0.12',
      id: 'chart',
      data: { kind: 'record', model: 'treatment' },
      fields: { points: { type, label: 'Injection points' }, plan: { type: 'image', label: 'Plan' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-points', field: 'points', widget: 'pins', ...(options ? { options } : {}) }] },
    }) as unknown as Page;

  it('puts pins on the page’s own picture or a field’s, as many as it says', () => {
    for (const page of [pinned({ image: 'https://charts.example/face.svg', alt: 'Face', maxPins: 30, noteLabel: 'Product and units' }), pinned({ imageField: 'plan' }), pinned(undefined)]) expect(issues(page)).toEqual({ full: [], quick: [] });
  });

  it('refuses two pictures, a field that is none, a number of pins out of range, and pins on anything but json', () => {
    expect(issues(pinned({ image: 'a.svg', imageField: 'plan' })).full).toEqual([`${at}.options.imageField: pins are placed on one picture: its address (image) or the field holding it (imageField), not both`]);
    expect(issues(pinned({ imageField: 'nothing' })).quick).toEqual([`${at}.options.imageField: no field "nothing"`]);
    expect(issues(pinned({ image: 'a.svg', maxPins: 0 })).full).toEqual([`${at}.options.maxPins: maxPins is a whole number of pins, 1 to 200`]);
    expect(issues(pinned({ image: 'a.svg' }, 'char')).quick).toEqual([`${at}.widget: pins is for a json field; "points" is a char`]);
  });
});
