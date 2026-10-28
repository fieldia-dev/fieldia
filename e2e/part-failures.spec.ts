import { type Locator, type Page, type Route } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { screen } from './support';
import { validatePage } from '../libs/core/src/lib/format/validate';

/**
 * Each part failing in turn (the audits' R-H1 and R-M13: "a CI matrix fails each part in turn and checks three things:
 * the page draws, typing is kept, gates refuse"). The one-tag script's parts — each `fieldia.<part>.js` beside
 * fieldia.js, loaded the first time a page needs it — are read from the built fieldia.js itself (the table of each
 * part's hash it carries, which names every part it can ask for), never from a copy kept here: a part added later fails
 * this file until it has a case below.
 *
 * For every part, a page that needs it, the part refused both ways it can fail: the network refuses it (offline, a
 * blocked script), and its bytes are not those it was built with (the real file and one line more: the tag's integrity
 * refuses it, nothing of it runs). Each asserts that the page asked for the part (else the case tests nothing); that the
 * page is drawn, the part's own place never an empty box; that the page says in words that the part could not load,
 * where a person would look for what it does; that what was typed — before the failure (a part asked again is held
 * until the person has typed) and after it — is kept; that nothing threw; and, for a part that guards a send, that the
 * send is refused in words and nothing is sent. Where the person can try again (Retry), the part allowed once more,
 * Retry brings it in place.
 *
 * Where each says it (decided per part, below):
 * - FIELD — a part that draws a field's own box (a date's, a phone's, a table of lines…): the plain box stays and
 *   works, and "Part of this field could not load, so it is shown plainly." under it, with Retry.
 * - PAGE — a part with no place of its own (a record's head, AI help, templates, a list's cards or filter bar, a send's
 *   steps drawn with the page, possible duplicates, the page's own look, its map's checks…): the page drawn plainly
 *   without it, and said once over the page, with a reload to try again (what it would have drawn is drawn as the page
 *   is drawn).
 * - its own words, where it says so as a person asks for it (a list, Import, Record, a scan's reader, the signing,
 *   Undo, printing, the element, the memory source's first answer).
 * - nowhere, for who else has a record open alone (live): it appears unbidden, as someone else opens the record, and no
 *   one looks for it where it is not; the record works whole without it, as with a source that keeps no one's
 *   presence. The browser's console names the file that could not load.
 * - nowhere at all, for the whole check (check, 0.36): asked for once a page is drawn, it only warns of what 0.35's
 *   viewer drew (`page.invalid`), so a page whose whole check could not come is the page 0.35 checked — no notice, and
 *   nothing in the console but the browser's own line naming the file. (From 0.37 it refuses before the draw: its
 *   failure will be said then.)
 *
 * Every page here is one `validatePage` passes (the first test): none may log `page.invalid` as its whole check runs.
 */

const DEMO = join(__dirname, '..', 'dist', 'demos', 'script');

/** The parts the built fieldia.js can ask for: the names of the one table of part hashes it carries (tools/script-bundle.mjs). */
function builtParts(): string[] {
  const code = readFileSync(join(DEMO, 'fieldia.js'), 'utf8');
  const tables = code.match(/\{(?:"?[a-z]+"?:"[A-Za-z0-9+/]{43}=",?)+\}/g) ?? [];
  if (tables.length !== 1) throw new Error(`fieldia.js carries ${tables.length} tables of part hashes, not one`);
  return [...tables[0].matchAll(/"?([a-z]+)"?:"/g)].map((found) => found[1]);
}

const FIELD = 'Part of this field could not load, so it is shown plainly.';
const PAGE = 'Part of this page could not load, so it is shown plainly. Reload the page and try again.';

const responses = (more: Record<string, unknown> = {}, fields: Record<string, unknown> = {}, nodes: object[] = []) => ({
  fieldia: '0.13',
  id: 'enquiry',
  title: 'Enquiry',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, ...fields },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, ...nodes] },
  ...more,
});
const record = (more: Record<string, unknown> = {}, fields: Record<string, unknown> = {}, nodes: object[] = [], sheet: Record<string, unknown> = {}) => ({
  fieldia: '0.13',
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, ...fields },
  layout: { type: 'sheet', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, ...nodes], ...sheet },
  ...more,
});
const list = (more: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) => ({
  fieldia: '0.13',
  id: 'customers',
  title: 'Customers',
  data: { kind: 'record', model: 'partner' },
  records: { one: 'customer', other: 'customers', a: 'a customer' },
  fields: {
    name: { type: 'char', label: 'Name' },
    email: { type: 'char', label: 'Email' },
    state: { type: 'selection', label: 'State', options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }] },
    ...fields,
  },
  layout: { type: 'list', id: 'people', columns: ['name', 'email', 'state'], ...more },
});
const PEOPLE = { partner: { 1: { name: 'Nile Traders', email: 'sales@nile.example', state: 'active', sequence: 1 }, 2: { name: 'Amira Clinics', email: 'hello@amira.example', state: 'draft', sequence: 2 } } };
const people = { records: PEOPLE };

/** A field's own place, by its node's id. */
const at = (id: string) => `#app [data-node="${id}"]`;
/** A field's box drawn plainly: said under it, with Retry; the field's place never empty. */
const field = (id: string) => ({ said: { at: `${at(id)} .fd-part-unloaded`, words: FIELD, retry: true }, place: at(id) });
const over = { at: '#app .fd-parts-unloaded', words: PAGE };
const SEARCH = '.fd-search-input';

interface Case {
  /** A part's second page and on: what it is, beside the part's name. */
  name?: string;
  page: object;
  /** The memory source's options (JSON), and what it is given that is code, by name (`SOURCE_CODE`). */
  source?: Record<string, unknown>;
  code?: keyof typeof SOURCE_CODE;
  recordId?: number;
  viewport?: { width: number; height: number };
  /** Put on the page before it loads: a camera, a printer. */
  init?: () => void;
  /** The page drawn in a `<fieldia-form>`, not by mountViewer. */
  element?: true;
  /** The box typed in, inside #app: the name's unless said; none where the page has no box to type in. */
  box?: string | null;
  /** What a person does that asks for the part, where it comes as they do. */
  bring?: (page: Page) => Promise<void>;
  /** Where its failure is said, and in what words — Retry beside, where said; null where it is said nowhere (why, beside). */
  said: { at: string; words: string | RegExp; retry?: boolean } | null;
  /** Said too, elsewhere. */
  also?: { at: string; words: string | RegExp };
  /** The part's own place, where it has one: never an empty box. */
  place?: string;
  /** A send the part guards: the button, and what the form's status says as nothing is sent. */
  guards?: { press: 'Submit' | 'Save'; words: string };
  /** A send it does not guard (it keeps sends without signal): pressed, it goes. */
  sends?: 'Submit';
  /**
   * Silent in the console too: no console error of the page's own scripts — the browser's own line about the file it
   * refused is the one allowed (the whole check, which says nothing when it cannot come in 0.36).
   */
  quiet?: true;
}

/** What a memory source is given that is code: made in the page. */
const SOURCE_CODE = {
  approvals: `({ approvals: { 'purchase.order': () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: false }) } })`,
  assist: `({ assist: { suggest: async () => ({ values: { name: 'Nile Traders' } }) } })`,
  duplicates: `({ duplicates: () => ({ records: [{ id: 1, name: 'Nile Traders', matched: ['name'] }] }) })`,
  slots: `({ slots: () => ({ days: {} }) })`,
} as const;

/** A camera that shows a desk, its frames coming, in a browser that reads no codes itself: Scan asks for the decode part. */
function camera() {
  delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 48;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  setInterval(() => {
    context.fillStyle = `#d9d4c${Date.now() % 10}`;
    context.fillRect(0, 0, 64, 48);
  }, 40);
  const getUserMedia = async () => (canvas as HTMLCanvasElement & { captureStream(rate?: number): MediaStream }).captureStream(25);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
}

/**
 * A browser that can record, as the files part asks before it offers Record (WebKit's here has no MediaRecorder): the
 * recorder itself is the part that never comes, so neither is ever used.
 */
function microphone() {
  const host = window as unknown as { MediaRecorder?: unknown };
  if (typeof host.MediaRecorder !== 'function') host.MediaRecorder = class {};
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => new MediaStream() }, configurable: true });
}

/** A printer that prints nothing: each print the browser was asked for, counted. */
function printer() {
  (window as unknown as { printed: number }).printed = 0;
  window.print = () => void ((window as unknown as { printed: number }).printed += 1);
}

/** By part, the page (or pages) that need it, failing as each says. */
const CASES: Record<string, Case | Case[]> = {
  // The answers in a page's own words, and its ending: without the part, the words say the answers plainly ("Where do we
  // call Hana?") and the ending is the plain thanks — said over the page.
  answers: { page: responses({}, { where: { type: 'char', label: 'Where do we call {name}?' } }, [{ type: 'field', id: 'f-where', field: 'where' }]), said: over, place: at('f-where') },
  approvals: {
    page: { ...record({ approval: {} }), id: 'po', data: { kind: 'record', model: 'purchase.order' } },
    source: { records: { 'purchase.order': { 1: { name: 'Nile Office Supply' } } } },
    code: 'approvals',
    recordId: 1,
    said: over,
    guards: { press: 'Save', words: 'The approvals could not load, so nothing was saved. Try again.' },
  },
  assist: { page: record({ suggest: { label: 'Fill from an e-mail', fields: ['name'] } }), code: 'assist', said: over },
  business: { page: record({}, { priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'High' }] } }, [{ type: 'field', id: 'f-priority', field: 'priority', widget: 'priority' }]), ...field('f-priority') },
  // On a phone, where the cards are drawn: the list's rows in its table meanwhile.
  cards: { page: list({ card: {} }), source: people, viewport: { width: 390, height: 844 }, box: SEARCH, said: over, place: '#app .fd-list' },
  // The whole check (0.36): asked for after the page's first draw, once the browser is idle, it only warns — so without
  // it the page is the one 0.35's check drew, and nothing is said: no notice, no console error of Fieldia's.
  check: { page: record(), said: null, quiet: true },
  choice: { page: record({}, { kind: { type: 'selection', label: 'Kind', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Flat' }] } }, [{ type: 'field', id: 'f-kind', field: 'kind', options: { search: true } }]), ...field('f-kind') },
  codes: { page: record({}, { link: { type: 'char', label: 'Ticket', default: 'https://fieldia.dev' } }, [{ type: 'field', id: 'f-link', field: 'link', widget: 'qrcode' }]), ...field('f-link') },
  columns: { page: list({ optionalColumns: { email: 'hide' } }), source: people, box: SEARCH, said: over, place: '#app .fd-list' },
  date: { page: record({}, { when: { type: 'date', label: 'Moving on' } }, [{ type: 'field', id: 'f-when', field: 'when' }]), ...field('f-when') },
  // Asked for as Scan is pressed in a browser that reads no codes itself: the camera's sheet closes, and the field says
  // the code cannot be read here — type it instead.
  decode: {
    page: record({}, { code: { type: 'char', label: 'Code' } }, [{ type: 'field', id: 'f-code', field: 'code', options: { scan: true } }]),
    init: camera,
    bring: (page) => page.locator(at('f-code')).getByRole('button', { name: 'Scan a code into Code' }).click(),
    said: { at: at('f-code'), words: 'Codes cannot be read in this browser just now. Type the code instead.' },
  },
  duplicates: { page: record({ duplicates: { fields: ['name'] } }), source: { records: { partner: { 1: { name: 'Nile Traders' } } } }, code: 'duplicates', said: over },
  editable: { page: list({ editable: true }), source: people, box: SEARCH, said: over, place: '#app .fd-list' },
  // Its own words in its place, the main script's (it has no form to say them in), with Retry.
  element: { page: responses(), element: true, box: null, said: { at: '#app fieldia-form .fd-element-broken', words: 'This form could not be loaded.', retry: true }, place: '#app fieldia-form' },
  // Said under the signature as it is signed (the files part's words): who signed, and when, cannot be shown.
  evidence: {
    page: responses({}, { signature: { type: 'binary', label: 'Signature' } }, [{ type: 'field', id: 'f-signature', field: 'signature', widget: 'signature', options: { signs: ['name'] } }]),
    bring: async (page) => {
      const pad = page.locator(`${at('f-signature')} canvas`);
      const box = (await pad.boundingBox()) as { x: number; y: number; width: number; height: number };
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 12, { steps: 6 });
      await page.mouse.move(box.x + box.width - 20, box.y + box.height - 12, { steps: 6 });
      await page.mouse.up();
    },
    said: { at: `${at('f-signature')} .fd-signature-unloaded`, words: 'Not signed yet: the signing could not load. Try again' },
  },
  files: { page: record({}, { file: { type: 'binary', label: 'Contract' } }, [{ type: 'field', id: 'f-file', field: 'file' }]), ...field('f-file') },
  filters: { page: list({ search: 'fields', filterFields: ['state'] }), source: people, box: SEARCH, said: over, place: '#app .fd-list' },
  // A value worked out by one of its functions: said under it in the page's words, and over the page.
  functions: {
    page: record({}, { born: { type: 'date', label: 'Born', default: '1990-05-01' }, years: { type: 'integer', label: 'Age', compute: 'age(born)', readonly: true } }, [{ type: 'field', id: 'f-born', field: 'born' }, { type: 'field', id: 'f-years', field: 'years' }]),
    said: over,
    also: { at: at('f-years'), words: 'Age could not be worked out: part of this page could not load. Saving tries again.' },
  },
  head: { page: record({}, {}, [], { head: { meta: [{ type: 'field', id: 'h-name', field: 'name', labels: 'hidden' }] } }), said: over },
  import: {
    page: list({ import: true }),
    source: people,
    box: SEARCH,
    bring: (page) => page.locator('#app .fd-list-import-button').click(),
    said: { at: '#app .fd-says', words: 'Could not import the customers.' },
  },
  languages: {
    page: responses({}, { title: { type: 'char', label: 'Title', translate: ['en', 'ar'] } }, [{ type: 'field', id: 'f-title', field: 'title' }]),
    ...field('f-title'),
    guards: { press: 'Submit', words: 'The check of each language could not load, so nothing was sent. Try again.' },
  },
  limits: { page: responses({ limits: { closes: '2099-11-20' } }), said: over, guards: { press: 'Submit', words: 'The check of whether this form takes answers could not load, so nothing was sent. Try again.' } },
  lines: { page: record({}, { lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { product: { type: 'char', label: 'Product' }, qty: { type: 'integer', label: 'Qty' } } } }, [{ type: 'field', id: 'f-lines', field: 'lines' }]), ...field('f-lines') },
  // The list's own words in its place, with Retry (list-part.spec.ts): there is no list to type in. A record's related
  // list the same, in its place in the record: never an empty box.
  list: [
    { page: list({}), source: people, box: null, said: { at: '#app .fd-list .fd-list-failed', words: 'Could not load the customers.', retry: true } },
    {
      name: 'a record’s related list',
      page: record({}, {}, [
        {
          type: 'related',
          id: 'r-invoices',
          title: 'Invoices',
          model: 'invoice',
          field: 'partner_id',
          fields: { name: { type: 'char', label: 'Number' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
          columns: ['name'],
        },
      ]),
      source: { records: { partner: { 1: { name: 'Nile Traders' } }, invoice: { 1: { name: 'INV/1', partner_id: 1 } } } },
      recordId: 1,
      said: { at: '#app [data-node="r-invoices"] .fd-list-failed', words: 'Could not load the records.', retry: true },
    },
  ],
  // Who else has the record open appears unbidden, as someone else opens it: no one looks for it where it is not. The
  // record works whole without it, as with a source that keeps no one's presence: a change made elsewhere is found as a
  // save meets it (save safety's own words). Said nowhere.
  live: {
    page: record(),
    source: { live: true, records: { partner: { 1: { name: 'Nile Traders' } } } },
    recordId: 1,
    bring: (page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.arrive('partner', 1, { id: 9, name: 'Mona Adel' })),
    said: null,
  },
  // A wait's shapes (a spinner here) are its look alone: without them the wait is said in words, "Loading…", and the
  // records come as they would. Said nowhere: nothing a person looks for is missing.
  loading: { page: { ...list({}), loading: { first: 'spinner' } }, source: { delayMs: 600, ...people }, box: SEARCH, said: over, place: '#app .fd-list' },
  // A map's checks are the page's author's, run on a page before it is drawn: a page whose map is right draws the same
  // without them. The console names the file (and this page, with no map's drawing given to the one-tag viewer, says so
  // there too). Said nowhere to the person.
  mapchecks: { page: record({}, { lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } }, [{ type: 'map', id: 'm', layers: [{ id: 'here', label: 'Here', latitude: 'lat', longitude: 'lng' }] }]), said: over },
  // The memory source's members (the one-tag script's source for demos and tests, a developer's): its first call, the
  // send, says why it could not answer — in the status, with Retry, its words naming the file — and nothing is sent.
  memory: { page: responses(), said: null, guards: { press: 'Submit', words: '' } },
  months: { page: record({}, { month: { type: 'date', label: 'First rent', precision: 'month' } }, [{ type: 'field', id: 'f-month', field: 'month' }]), ...field('f-month') },
  options: {
    page: responses({}, { extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'garden', label: 'Garden', invisible: "name != 'villa'" }, { value: 'lift', label: 'Lift' }] } }, [{ type: 'field', id: 'f-extras', field: 'extras' }]),
    said: over,
    guards: { press: 'Submit', words: 'The check of the choices could not load, so nothing was sent. Try again.' },
  },
  // Keeps sends made without signal on the device: it guards nothing. Online, a send goes straight to the app, as on a
  // page without it; its bar, drawn with the page, is said over it.
  outbox: { page: responses({ outbox: true }), said: over, sends: 'Submit' },
  path: {
    page: record({}, { area: { type: 'many2one', label: 'Area', relation: 'work.area' } }, [{ type: 'field', id: 'f-area', field: 'area', widget: 'path' }]),
    source: { records: { 'work.area': { 1: { name: 'Portal' } } }, shows: { 'work.area': { path: 'name' } } },
    ...field('f-area'),
  },
  // Said by the send it stops, with its Retry — never over the page too, whose words would say otherwise (0.36.1).
  pay: { page: responses({ payment: { label: 'Reservation fee', amount: 500, currency: 'EGP' } }), guards: { press: 'Submit', words: 'The payment step could not load, so nothing was sent. Try again.' } },
  phone: { page: record({ phone: { country: 'EG' } }, { mobile: { type: 'char', label: 'Mobile' } }, [{ type: 'field', id: 'f-mobile', field: 'mobile', widget: 'phone' }]), ...field('f-mobile') },
  photos: { page: record({}, { photos: { type: 'image', label: 'Photos', multiple: true } }, [{ type: 'field', id: 'f-photos', field: 'photos', widget: 'photos' }]), ...field('f-photos') },
  pins: { page: record({}, { pins: { type: 'json', label: 'Injections' } }, [{ type: 'field', id: 'f-pins', field: 'pins', widget: 'pins', options: { image: '../samples/face.svg', alt: 'Face' } }]), ...field('f-pins') },
  prefill: { page: responses({ prefill: { fromUrl: ['agent_code'] } }, { agent_code: { type: 'char', label: 'Agent' } }), said: over, guards: { press: 'Submit', words: 'The answers from the link could not load, so nothing was sent. Try again.' } },
  // Asked for as a person means to print (Ctrl+P): the page prints as it is shown, and says so.
  print: {
    page: record(),
    init: printer,
    bring: async (page) => {
      await page.locator(`${at('f-name')} input`).focus();
      await page.keyboard.press('Control+p');
      await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
    },
    said: { at: '#app .fd-says', words: 'The print layout could not load, so the page prints as it is shown.' },
  },
  // A look alone: the page in the plain skin works whole. Said nowhere.
  quiet: { page: record({ look: { skin: 'quiet' } }), said: over },
  record: {
    page: record({}, { voice: { type: 'binary', label: 'Voice note' } }, [{ type: 'field', id: 'f-voice', field: 'voice', options: { record: 'audio' } }]),
    init: microphone,
    bring: (page) => page.locator(at('f-voice')).getByRole('button', { name: /^Record/ }).first().click(),
    said: { at: at('f-voice'), words: 'The recorder could not be loaded. Press Record to try again.' },
  },
  relations: { page: record({}, { company: { type: 'many2one', label: 'Company', relation: 'partner' } }, [{ type: 'field', id: 'f-company', field: 'company' }]), ...field('f-company') },
  rows: { page: list({ sequenceField: 'sequence', sort: [{ field: 'sequence' }] }, { sequence: { type: 'integer', label: 'Sequence' } }), source: people, box: SEARCH, said: over, place: '#app .fd-list' },
  scan: { page: record({}, { code: { type: 'char', label: 'Code' } }, [{ type: 'field', id: 'f-code', field: 'code', options: { scan: true } }]), ...field('f-code') },
  schedule: { page: record({}, { rule: { type: 'char', label: 'Repeats' } }, [{ type: 'field', id: 'f-rule', field: 'rule', widget: 'repeat' }]), ...field('f-rule') },
  slots: { page: record({}, { visit: { type: 'datetime', label: 'Visit' } }, [{ type: 'field', id: 'f-visit', field: 'visit', widget: 'slots', options: { length: 30 } }]), code: 'slots', ...field('f-visit') },
  survey: { page: record({}, { score: { type: 'integer', label: 'Score' } }, [{ type: 'field', id: 'f-score', field: 'score', widget: 'slider', options: { min: 0, max: 10 } }]), ...field('f-score') },
  surveyflow: { page: responses({ timeLimit: { minutes: 10 } }), said: over, guards: { press: 'Submit', words: 'The time limit could not load, so nothing was sent. Try again.' } },
  templates: { page: record({ templates: true }), source: { templates: { customer: [] } }, said: over },
  text: { page: record({}, { body: { type: 'html', label: 'Description' } }, [{ type: 'field', id: 'f-body', field: 'body', options: { editor: 'markdown' } }]), ...field('f-body') },
  // A look alone: the page in the plain theme works whole. Said nowhere.
  themes: { page: record({ look: { theme: 'fluent' } }), said: over },
  typed: { page: record({}, { nid: { type: 'char', label: 'National ID' } }, [{ type: 'field', id: 'f-nid', field: 'nid', options: { mask: '9 999 999 999' } }]), ...field('f-nid') },
  // Asked for as the person first enters the form; Ctrl+Z takes back nothing without it, and says so. Pressed outside the
  // box typed in, where it is the record's (inside, the browser's own undo comes first: Firefox's takes back the typing).
  undo: {
    page: record(),
    bring: async (page) => {
      await page.locator(`${at('f-name')} input`).press('Tab');
      await page.getByRole('button', { name: 'Save', exact: true }).focus();
      await page.keyboard.press('Control+z');
    },
    said: { at: '#app .fd-says', words: 'Undo could not load. Try again.' },
  },
  // Said at once under the mobile that asks for a code, with its Retry — never over the page too (0.36.1).
  verify: {
    page: responses({}, { phone: { type: 'char', label: 'Mobile' } }, [{ type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: true } }]),
    said: { at: '#app [data-node="f-phone"] .fd-join-missing', words: 'The code check could not load, so nothing was sent. Try again.', retry: true },
    guards: { press: 'Submit', words: 'The code check could not load, so nothing was sent. Try again.' },
  },
  // Asked for as the list opens, where its source keeps views: the list works without its saved views, said over it.
  views: { page: list({}), source: { views: { customers: [] }, ...people }, box: SEARCH, said: over, place: '#app .fd-list' },
};

/** The page's own handle, as the one-tag demo keeps it. */
type Demo = { dataSource: { responses: unknown[]; calls?: { method: string }[] } };

/** The one-tag demo's page replaced by this case's, on a memory source made with its options. */
async function mount(page: Page, one: Case) {
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await page.evaluate(
    ([shown, options, code, recordId, element]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      // What the case's source is given that is code (`SOURCE_CODE`), the spec's own: made here, in the page.
      const more = code ? new Function(`return ${code}`)() : {};
      demo.dataSource = fieldia.createMemoryDataSource({ ...options, ...more });
      const app = document.getElementById('app') as HTMLElement;
      if (!element) {
        demo.handle = fieldia.mountViewer(app, { page: shown, dataSource: demo.dataSource, skin: 'outlined', ...(recordId ? { recordId } : {}) });
        return;
      }
      const form = document.createElement('fieldia-form') as HTMLElement & { page: unknown; source: unknown };
      form.page = shown;
      form.source = demo.dataSource;
      app.replaceChildren(form);
    },
    [one.page, one.source ?? {}, one.code ? SOURCE_CODE[one.code] : null, one.recordId ?? null, !!one.element] as const,
  );
}

/** Nothing of it empty: the place shows words or something to use. */
async function notEmpty(place: Locator) {
  await expect(place).toBeVisible();
  const shown = await place.evaluate((element) => ({ words: (element as HTMLElement).innerText.trim().length, controls: element.querySelectorAll('input, select, textarea, button, canvas, [contenteditable], table').length }));
  expect(shown.words + shown.controls, 'its place shows nothing').toBeGreaterThan(0);
}

const MODES: Record<string, (route: Route) => Promise<void>> = {
  // Offline, or a script blocked on the way.
  'the network refuses it': (route) => route.abort('internetdisconnected'),
  // The real file and one line more: its hash, carried by fieldia.js as the tag's integrity, no longer matches.
  'its bytes are not those it was built with': async (route) => {
    const real = await route.fetch();
    return route.fulfill({ response: real, body: `${await real.text()}\n;window.partTampered = true;\n` });
  },
};

test.describe('each part failing in turn, from the one tag', () => {
  test('every part fieldia.js can ask for has a case here, and each case is a part of it', () => {
    const parts = builtParts().sort();
    // The table read right: every part's file is beside fieldia.js, the language add-ons (two letters) apart.
    const files = readdirSync(DEMO).flatMap((file) => /^fieldia\.([a-z]{3,})\.js$/.exec(file)?.[1] ?? []).sort();
    expect(parts).toEqual(files);
    expect(parts.filter((part) => ![CASES[part] ?? []].flat().length), 'parts with no case in part-failures.spec.ts').toEqual([]);
    expect(Object.keys(CASES).filter((part) => !parts.includes(part)), 'cases for no part of fieldia.js').toEqual([]);
  });

  test('every page here is one validatePage passes: none logs page.invalid as its whole check runs after the draw', () => {
    const refused = Object.entries(CASES).flatMap(([part, cases]) =>
      [cases].flat().flatMap((one) => {
        const checked = validatePage(one.page);
        return checked.ok ? [] : [`${part}${one.name ? `, ${one.name}` : ''}: ${checked.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`];
      })
    );
    expect(refused).toEqual([]);
  });

  for (const part of builtParts()) {
    for (const one of [CASES[part] ?? []].flat()) {
      for (const [mode, fail] of Object.entries(MODES)) {
        test(`${part}${one.name ? `, ${one.name}` : ''}: ${mode} — the page drawn, said, the typing kept${one.guards ? ', nothing sent' : ''}`, async ({ page }) => {
          if (one.viewport) await page.setViewportSize(one.viewport);
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          // Any page.invalid the console says once the case's page is mounted: a page here the whole check refuses.
          const said: { invalid: string[]; on: boolean } = { invalid: [], on: false };
          page.on('console', (message) => {
            if (said.on && message.text().includes('page.invalid')) said.invalid.push(message.text());
          });
          // A quiet part: each console.error the page's own scripts make, kept — the browser's own lines about a file it
          // refused never go through it.
          if (one.quiet) {
            await page.addInitScript(() => {
              const own: string[] = ((window as unknown as { ownErrors: string[] }).ownErrors = []);
              const error = console.error.bind(console);
              console.error = (...what: unknown[]) => {
                own.push(what.map(String).join(' '));
                error(...what);
              };
            });
          }
          if (one.init) await page.addInitScript(one.init);
          // Its first ask from this page refused at once, so the page is drawn; each one after held until the person has
          // typed, then refused: what was typed before the failure is kept too. Allowed once `failing` is let go (Retry).
          let failing = true;
          let armed = false;
          const asked: string[] = [];
          /** The asks counted in `asked` that were refused by now. */
          let refused = 0;
          let typed!: () => void;
          const typing = new Promise<void>((done) => (typed = done));
          await page.route(`**/fieldia.${part}.js`, async (route) => {
            if (!failing) return route.continue();
            if (!armed) return fail(route);
            asked.push(route.request().url());
            // (Let go after 8 s whatever happens: a page that waited for it before it could be typed in draws all the same.)
            if (asked.length > 1) await Promise.race([typing, new Promise((done) => setTimeout(done, 8000))]);
            await fail(route);
            refused++;
          });
          await page.goto('/script/');
          armed = true;
          said.on = true;
          await mount(page, one);

          // The page is drawn: its form, or the element's place.
          if (!one.element) await expect(page.locator('#app .fd-form')).toBeVisible();
          const box = one.box === null ? null : page.locator(`#app ${one.box ?? `${at('f-name').replace('#app ', '')} input`}`).first();
          if (box) {
            await expect(box).toBeEditable();
            await box.fill('Hana');
          }
          typed();
          if (one.bring) await one.bring(page);

          // Said, where a person would look for what it does.
          if (one.said) {
            const said = page.locator(one.said.at);
            await expect(said).toContainText(one.said.words);
            await notEmpty(said);
            if (one.said.retry) await expect(said.getByRole('button', { name: 'Retry' })).toBeVisible();
          }
          if (one.also) await expect(page.locator(one.also.at)).toContainText(one.also.words);
          if (one.place) await notEmpty(page.locator(one.place).first());

          // A send it guards: refused in words, nothing sent; one it does not, sent.
          const sent = () => page.evaluate(() => ((window as any).fieldiaDemo as Demo).dataSource.responses.length + (((window as any).fieldiaDemo as Demo).dataSource.calls ?? []).filter((call) => call.method === 'save').length);
          if (one.guards) {
            await page.getByRole('button', { name: one.guards.press, exact: true }).click();
            const status = page.locator('#app .fd-status');
            if (one.guards.words) await expect(status).toHaveText(one.guards.words);
            else await expect(status).toContainText(`fieldia.${part}.js could not be loaded`);
            await expect(page.locator('#app .fd-status-box .fd-retry')).toBeVisible();
            expect(await sent()).toBe(0);
          }
          if (one.sends) {
            await page.getByRole('button', { name: one.sends, exact: true }).click();
            await expect.poll(sent).toBe(1);
          }

          // What was typed before the failure, and after it, kept.
          if (box && !one.sends) {
            await box.press('End');
            await box.pressSequentially(' Fouad');
            await expect(box).toHaveValue('Hana Fouad');
          }
          // It asked for the part: else this case tests nothing. (The whole check is asked for once the browser is idle.)
          await expect.poll(() => asked.length, { message: `fieldia.${part}.js was never asked for` }).toBeGreaterThan(0);
          // Said nowhere: nothing a person looks for is missing, and nothing says a part of the page could not load.
          if (!one.said) await expect(page.locator('#app .fd-parts-unloaded:visible, #app .fd-part-unloaded:visible')).toHaveCount(0);
          expect(errors, 'uncaught').toEqual([]);
          // Silent: the page drawn as it is, nothing in the console but the browser's own line naming the file.
          if (one.quiet) {
            // Each ask refused; then whatever the page does after it, a frame and a task on.
            await expect.poll(() => asked.length > 0 && refused === asked.length, { message: `each ask of fieldia.${part}.js refused` }).toBe(true);
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))));
            await expect(page.locator('#app .fd-form')).toBeVisible();
            await expect(page.locator('#app .fd-parts-unloaded:visible, #app .fd-part-unloaded:visible')).toHaveCount(0);
            // No toast either: the page's says region, where one is, holds no words.
            expect((await page.locator('#app .fd-says').allInnerTexts()).join('').trim()).toBe('');
            expect(await page.evaluate(() => (window as unknown as { ownErrors: string[] }).ownErrors), 'a console error of the page’s own').toEqual([]);
          }
          expect(said.invalid, 'page.invalid: a page here that validatePage refuses').toEqual([]);
          // None of a changed file ran.
          expect(await page.evaluate(() => (window as any).partTampered)).toBeUndefined();
          if (mode === 'the network refuses it' && ['pay', 'date', 'head', 'element'].includes(part)) await screen(page, `part-failures-${part}`);

          // Retry, where said, the part let come: in its place, said no more.
          if (one.said?.retry) {
            failing = false;
            const said = page.locator(one.said.at);
            await said.getByRole('button', { name: 'Retry' }).click();
            await expect(said).toBeHidden();
            if (box) await expect(box).toHaveValue('Hana Fouad');
            expect(errors, 'uncaught').toEqual([]);
          }
        });
      }
    }
  }
});
