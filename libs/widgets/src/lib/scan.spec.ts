import { createForm, createMemoryDataSource, type DataSource, type Field, type FieldNode, type Line, type Page, type SearchRequest, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import type { FoundCode } from './scan-reader';
import { createWidget } from './widgets';
import { relationsPart, scanPart } from './widget-parts';

/**
 * A code scanned with the camera (`options.scan`): a Scan button beside the box; the camera's sheet — the back camera,
 * stopped as it closes by a code kept, Escape, × or Type it instead; a code read written into the field — words, a GS1
 * code's part and the fields it fills, a link's record found by its code (by a field of its records, or by name) — and
 * a table counted, line by line; why the camera did not open, said beside the button, the focus in the box to type.
 * The camera here is a stand-in, its frames read by a reader handed to the part (`useCodeReader`).
 */

const GS = '\u001d';
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits, as a person waits for what they expect to see. */
async function until(ready: () => unknown, ms = 4000): Promise<boolean> {
  const end = Date.now() + ms;
  while (!ready() && Date.now() < end) await settle(10);
  return !!ready();
}

let track: { stop: jest.Mock };
let getUserMedia: jest.Mock;
/** What each frame read holds, in turn: a frame past the last holds none. */
let frames: FoundCode[][];
const code = (rawValue: string, format = 'qr_code'): FoundCode[] => [{ rawValue, format }];

beforeEach(async () => {
  track = { stop: jest.fn() };
  getUserMedia = jest.fn(async () => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  frames = [];
  (await scanPart.load()).useCodeReader({ detect: async () => frames.shift() ?? [] });
});
/** The widgets mounted by a test, taken away after it: a sheet still open closes with its field. */
const mounted: { destroy?(): void }[] = [];
afterEach(async () => {
  for (const widget of mounted.splice(0)) widget.destroy?.();
  (await scanPart.load()).useCodeReader(null);
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

/** A page of `fields`, the one named `name` drawn by its node as the viewer draws it, kept up to date with its form. */
function mount(fields: Record<string, Field>, name: string, node: Partial<FieldNode>, options: { values?: Values; dataSource?: DataSource; readonly?: boolean } = {}) {
  const page = {
    fieldia: '0.11',
    id: 'scan',
    data: { kind: 'record', model: 'clinic.treatment' },
    fields,
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: `f-${name}`, field: name, ...node }] },
  } as unknown as Page;
  const form = createForm({ page, values: options.values ?? {}, dataSource: options.dataSource ?? createMemoryDataSource() });
  const widget = createWidget({ form, name, field: fields[name], node: (page.layout as unknown as { children: FieldNode[] }).children[0], id: `fd-${name}`, document, labels: WIDGET_LABELS.en, locale: 'en' });
  mounted.push(widget);
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: !!options.readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const button = () => document.querySelector<HTMLButtonElement>('.fd-scan-button');
  const sheet = () => document.querySelector<HTMLElement>('.fd-scan-sheet');
  const said = () => document.querySelector('.fd-scan-said')?.textContent ?? '';
  const note = () => document.querySelector<HTMLElement>('.fd-scan-note');
  return { form, widget, page, button, sheet, said, note, values: () => form.getState().values };
}

const LOT: Record<string, Field> = { lot: { type: 'char', label: 'Lot' }, notes: { type: 'text', label: 'Notes' } };

describe('a field scanned into', () => {
  it('has a Scan button at the end of its box, named by the field, hidden while it is read-only', () => {
    const { button } = mount(LOT, 'lot', { options: { scan: true } });
    const box = document.querySelector('.fd-scan');
    expect(box?.firstElementChild?.matches('input.fd-input')).toBe(true);
    expect(button()?.textContent).toBe('Scan');
    expect(button()?.getAttribute('aria-label')).toBe('Scan a code into Lot');
    expect(button()?.getAttribute('aria-haspopup')).toBe('dialog');
    document.body.replaceChildren();
    const locked = mount(LOT, 'lot', { options: { scan: true } }, { readonly: true });
    expect(locked.button()?.hidden).toBe(true);
  });

  it('draws no button where it says scan false, or nothing', () => {
    mount(LOT, 'lot', { options: { scan: false } });
    expect(document.querySelector('.fd-scan, .fd-scan-button')).toBeNull();
  });

  it('opens the back camera in a sheet, and a code read fills the field, stops the camera and goes', async () => {
    const { button, sheet, said, values } = mount(LOT, 'lot', { options: { scan: true } });
    button()?.click();
    expect(sheet()?.getAttribute('role')).toBe('dialog');
    expect(sheet()?.getAttribute('aria-modal')).toBe('true');
    expect(sheet()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Scan Lot');
    expect(said()).toBe('Starting the camera…');
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    expect(await until(() => said() === 'Hold the code inside the frame.')).toBe(true);
    frames.push(code('25A1234', 'code_128'));
    expect(await until(() => values()['lot'] === '25A1234')).toBe(true);
    expect(await until(() => !sheet())).toBe(true);
    expect(track.stop).toHaveBeenCalled();
    expect(document.activeElement).toBe(button());
    expect(document.querySelector('.fd-scan .fd-announce')?.textContent).toBe('Lot: 25A1234');
  });

  it('closes on Escape, × or Type it instead, the camera stopped and the field as it was', async () => {
    const { button, sheet, values } = mount(LOT, 'lot', { options: { scan: true } }, { values: { lot: 'OLD-1' } });
    button()?.click();
    await until(() => document.querySelector('.fd-scan-said')?.textContent === 'Hold the code inside the frame.');
    sheet()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet()).toBeNull();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button());
    button()?.click();
    await until(() => track.stop.mock.calls.length === 0 && document.querySelector('.fd-scan-sheet'));
    document.querySelector<HTMLButtonElement>('.fd-dialog-close')?.click();
    expect(sheet()).toBeNull();
    button()?.click();
    document.querySelector<HTMLButtonElement>('.fd-scan-type')?.click();
    expect(sheet()).toBeNull();
    expect(document.activeElement?.matches('input.fd-input')).toBe(true);
    expect(values()['lot']).toBe('OLD-1');
    // A camera that opens after the sheet closed is stopped at once.
    await settle(20);
    expect(track.stop.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('says why the camera did not open beside the button, and puts the focus in the box to type', async () => {
    const cases: [unknown, string][] = [
      [Object.assign(new Error('no'), { name: 'NotAllowedError' }), 'The camera is not allowed here. Allow it in the browser’s settings and press Scan again, or type the code.'],
      [Object.assign(new Error('none'), { name: 'NotFoundError' }), 'No camera was found. Type the code instead.'],
      [Object.assign(new Error('busy'), { name: 'NotReadableError' }), 'The camera is in use by another app. Close it and press Scan again, or type the code.'],
    ];
    for (const [error, words] of cases) {
      getUserMedia.mockImplementationOnce(async () => Promise.reject(error));
      const { button, sheet, note } = mount(LOT, 'lot', { options: { scan: true } });
      button()?.click();
      expect(await until(() => !note()?.hidden)).toBe(true);
      expect(note()?.textContent).toBe(words);
      expect(sheet()).toBeNull();
      expect(button()?.getAttribute('aria-describedby')).toBe(note()?.id);
      expect(document.activeElement?.matches('input.fd-input')).toBe(true);
      // Pressed again, the note goes while the camera is asked again.
      button()?.click();
      expect(note()?.hidden).toBe(true);
      document.querySelector<HTMLButtonElement>('.fd-dialog-close')?.click();
    }
    // A page with no camera to ask (no https, an old browser).
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const { button, note } = mount(LOT, 'lot', { options: { scan: true } });
    button()?.click();
    expect(await until(() => !note()?.hidden)).toBe(true);
    expect(note()?.textContent).toBe('This page cannot use a camera. Type the code instead.');
  });

  it("writes words as one line in a char, its lines kept in a text, and a GS1 code whole as its label prints it", async () => {
    const one = mount(LOT, 'lot', { options: { scan: true } });
    one.button()?.click();
    frames.push(code(`${GS}0106285096000842172812311025A1234`, 'data_matrix'));
    expect(await until(() => one.values()['lot'] === '(01)06285096000842(17)281231(10)25A1234')).toBe(true);
    const notes = mount(LOT, 'notes', { options: { scan: true } });
    notes.button()?.click();
    frames.push(code('BEGIN:VCARD\r\nFN:Mona Adel\r\nEND:VCARD'));
    expect(await until(() => notes.values()['notes'] === 'BEGIN:VCARD\nFN:Mona Adel\nEND:VCARD')).toBe(true);
  });

  it('takes a code still in sight once, and a Code 39 only read twice alike', async () => {
    const asked: string[] = [];
    const source = createMemoryDataSource({ records: { 'clinic.patient': { 1: { name: 'Mona Adel', card: 'P-1042' } } } });
    const search = source.search!.bind(source);
    source.search = (request: SearchRequest) => (asked.push(String((request.filter?.at(-1) as { value?: unknown } | undefined)?.value)), search(request));
    const fields: Record<string, Field> = { patient_id: { type: 'many2one', label: 'Patient', relation: 'clinic.patient' } };
    const { button, said, values } = mount(fields, 'patient_id', { options: { scan: { by: 'card' } } }, { dataSource: source });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    // A card no one has, held up: said once, though it stays in sight.
    frames.push(code('P-9999'), code('P-9999'), code('P-9999'));
    expect(await until(() => said() === 'Nothing has the code P-9999. Scan another, or type it.')).toBe(true);
    await until(() => frames.length === 0);
    await settle(200);
    expect(asked).toEqual(['P-9999']);
    // A Code 39 read once is not taken; read twice alike, it is.
    frames.push(code('P-1042', 'code_39'), [], code('P-1042', 'code_39'));
    await until(() => frames.length === 0);
    await settle(200);
    expect(values()['patient_id'] ?? null).toBeNull();
    frames.push(code('P-1042', 'code_39'), code('P-1042', 'code_39'));
    expect(await until(() => (values()['patient_id'] as { label?: string } | undefined)?.label === 'Mona Adel')).toBe(true);
  });
});

describe('a link scanned into', () => {
  const PRODUCTS = {
    1: { name: 'Botulinum toxin type A, 100 U', gtin: '6285096000842' },
    2: { name: 'Hyaluronic acid filler 1 ml', gtin: '07612345000015' },
    3: { name: 'Lidocaine 2% 5 ml', gtin: '06221025001238' },
    4: { name: 'Lidocaine 2% 5 ml (box of 10)', gtin: '06221025001238' },
  };
  const fields: Record<string, Field> = { product_id: { type: 'many2one', label: 'Product', relation: 'clinic.product' } };

  it("finds the record by the field holding its code, through the source's search, and takes it", async () => {
    const source = createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } });
    const requests: SearchRequest[] = [];
    const search = source.search!.bind(source);
    source.search = (request: SearchRequest) => (requests.push(request), search(request));
    const { button, said, values, sheet } = mount(fields, 'product_id', { options: { scan: { by: 'gtin' } } }, { dataSource: source });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code('07612345000015', 'data_matrix'));
    expect(await until(() => (values()['product_id'] as { id?: number } | undefined)?.id === 2)).toBe(true);
    expect(requests[0]).toMatchObject({ model: 'clinic.product', query: '', filter: [{ field: 'gtin', op: '=', value: '07612345000015' }], limit: 2 });
    expect(await until(() => !sheet())).toBe(true);
  });

  it("finds a GTIN of 14 digits kept as its 13, and says none and several in the sheet, reading on", async () => {
    const source = createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } });
    const { button, said, values, sheet } = mount(fields, 'product_id', { options: { scan: { by: 'gtin' } } }, { dataSource: source });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code('06221025001238', 'data_matrix'));
    expect(await until(() => said() === 'More than one record has the code 06221025001238. Type it to choose one.')).toBe(true);
    expect(document.querySelector('.fd-scan-said')?.hasAttribute('data-problem')).toBe(true);
    frames.push(code('0000000000017', 'ean_13'));
    expect(await until(() => said() === 'Nothing has the code 0000000000017. Scan another, or type it.')).toBe(true);
    expect(sheet()).not.toBeNull();
    expect(values()['product_id'] ?? null).toBeNull();
    frames.push(code('06285096000842', 'data_matrix'));
    expect(await until(() => (values()['product_id'] as { id?: number } | undefined)?.id === 1)).toBe(true);
  });

  it('finds it by name where no field holds the codes: the name itself first, then as the source searches', async () => {
    const source = createMemoryDataSource({ records: { 'clinic.product': { 7: { name: 'LOT-7' }, 8: { name: 'LOT-77' }, 9: { name: 'Gauze 10 cm' } } } });
    const requests: SearchRequest[] = [];
    const search = source.search!.bind(source);
    source.search = (request: SearchRequest) => (requests.push(request), search(request));
    const { button, said, values } = mount(fields, 'product_id', { options: { scan: true } }, { dataSource: source });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code('lot-7'));
    expect(await until(() => (values()['product_id'] as { id?: number } | undefined)?.id === 7)).toBe(true);
    expect(requests[0]).toMatchObject({ query: 'lot-7', exact: true });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code('Gauze'));
    expect(await until(() => (values()['product_id'] as { id?: number } | undefined)?.id === 9)).toBe(true);
  });

  it('takes the place of words typed in the box that named nothing, and of what they said', async () => {
    const source = createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } });
    const { button, values, form } = mount(fields, 'product_id', { options: { scan: { by: 'gtin' } } }, { dataSource: source });
    const input = document.querySelector<HTMLInputElement>('.fd-scan input');
    if (!input) throw new Error('no box');
    input.focus();
    input.value = 'Botulinum toxin type B';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    expect(await until(() => form.getState().unread?.['product_id'])).toBe(true);
    button()?.click();
    frames.push(code('06285096000842', 'data_matrix'));
    expect(await until(() => (values()['product_id'] as { id?: number } | undefined)?.id === 1)).toBe(true);
    expect(form.getState().unread?.['product_id']).toBeUndefined();
    expect(await until(() => input.value === 'Botulinum toxin type A, 100 U')).toBe(true);
  });

  it('lays nothing on a record no longer shown, and closes', async () => {
    let answer: (found: { id: number; label: string }[]) => void = () => undefined;
    const source = { ...createMemoryDataSource(), search: () => new Promise<{ id: number; label: string }[]>((resolve) => (answer = resolve)) } as DataSource;
    const { button, said, values, sheet, form } = mount(fields, 'product_id', { options: { scan: { by: 'gtin' } } }, { dataSource: source });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code('06285096000842', 'data_matrix'));
    expect(await until(() => said() === 'Looking up 06285096000842…')).toBe(true);
    form.reset();
    answer([{ id: 1, label: 'Botulinum toxin type A, 100 U' }]);
    expect(await until(() => !sheet())).toBe(true);
    expect(values()['product_id'] ?? null).toBeNull();
  });
});

describe('a link scanned into, typed by a scanner gun', () => {
  const PATIENTS = { 1: { name: 'Mona Adel', card: 'P-1042' }, 2: { name: 'Hana Fouad', card: 'P-1043' } };
  const fields: Record<string, Field> = { patient_id: { type: 'many2one', label: 'Patient', relation: 'clinic.patient' } };

  it('finds the record by its code as Enter is pressed, and by its name where no code is so', async () => {
    // The owner's walk of 0.29: "P-1043" and Enter said "nothing is called P-1043"; the camera found Hana.
    await relationsPart.load();
    const { values } = mount(fields, 'patient_id', { options: { scan: { formats: ['qr_code'], by: 'card' } } }, { dataSource: createMemoryDataSource({ records: { 'clinic.patient': PATIENTS } }) });
    const box = document.querySelector<HTMLInputElement>('.fd-scan input') as HTMLInputElement;
    const typeIn = (text: string) => {
      box.focus();
      box.value = text;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    };
    typeIn('P-1043');
    expect(await until(() => (values()['patient_id'] as { id?: number } | null)?.id === 2)).toBe(true);
    typeIn('Mona Adel');
    expect(await until(() => (values()['patient_id'] as { id?: number } | null)?.id === 1)).toBe(true);
  });
});

describe("a GS1 code's parts", () => {
  const PRODUCTS = { 1: { name: 'Botulinum toxin type A, 100 U', gtin: '06285096000842' } };
  const fields: Record<string, Field> = {
    lot: { type: 'char', label: 'Lot' },
    expiry: { type: 'date', label: 'Expiry' },
    product_id: { type: 'many2one', label: 'Product', relation: 'clinic.product' },
    serial: { type: 'char', label: 'Serial' },
  };
  const scan = { formats: ['data_matrix'], part: '10', fills: { expiry: '17', product_id: { part: '01', by: 'gtin' }, serial: '21' } };

  it('fills the field with its part, and the fields it fills with theirs: a day as its date, a link by its code', async () => {
    const source = createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } });
    const { button, values } = mount(fields, 'lot', { options: { scan } }, { dataSource: source });
    button()?.click();
    frames.push(code(`${GS}0106285096000842172812311025A1234${GS}21SN998877`, 'data_matrix'));
    expect(await until(() => values()['lot'] === '25A1234')).toBe(true);
    expect(values()['expiry']).toBe('2028-12-31');
    expect(values()['serial']).toBe('SN998877');
    expect(values()['product_id']).toEqual({ id: 1, label: 'Botulinum toxin type A, 100 U' });
  });

  it('says a code without the part, reading on; takes only the formats the field asks, and says another holds no part', async () => {
    const { button, said, values } = mount(fields, 'lot', { options: { scan } }, { dataSource: createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } }) });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    frames.push(code(`${GS}0106285096000842172812311`, 'data_matrix'));
    expect(await until(() => said() === 'This code has no Lot in it. Scan the code on the pack.')).toBe(true);
    // A shelf's barcode held up for a lot: said, never silence (the owner's walk of 0.29), and nothing taken.
    frames.push([], code('6224000123451', 'ean_13'));
    await until(() => document.querySelector('.fd-scan-said[data-problem]') && frames.length === 0);
    expect(said()).toBe('This code has no Lot in it. Scan the code on the pack.');
    frames.push([], code(`${GS}010628509600084210LOT-9`, 'qr_code'), [], code(`${GS}010628509600084210LOT-8`, 'data_matrix'));
    expect(await until(() => values()['lot'] === 'LOT-8')).toBe(true);
  });

  it('reads a code a scanner gun types in the box as the camera reads one, as it is left or Enter commits it; words typed stay', async () => {
    // The owner's walk of 0.29: the box's code typed into Lot stayed as typed, no product, no expiry.
    const { values } = mount(fields, 'lot', { options: { scan } }, { dataSource: createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } }) });
    const box = document.querySelector<HTMLInputElement>('.fd-scan input') as HTMLInputElement;
    const typeIn = (text: string) => {
      box.focus();
      box.value = text;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
    };
    typeIn('0106285096000842172812311025A1234');
    expect(await until(() => values()['lot'] === '25A1234')).toBe(true);
    expect(values()).toMatchObject({ expiry: '2028-12-31', product_id: { id: 1, label: 'Botulinum toxin type A, 100 U' } });
    expect(box.value).toBe('25A1234');
    // As a label prints it, the same.
    typeIn('(01)06285096000842(10)LOT-7');
    expect(await until(() => values()['lot'] === 'LOT-7')).toBe(true);
    // A lot typed by hand, though it starts as a GS1 part would: as typed.
    typeIn('10A55');
    await settle(20);
    expect(values()['lot']).toBe('10A55');
    // A code with no lot in it: said beside the box, the words as typed.
    typeIn('01062850960008421728123121SN000417');
    expect(await until(() => document.querySelector('.fd-scan-note')?.textContent === 'This code has no Lot in it. Scan the code on the pack.')).toBe(true);
  });

  it("fills a line's columns from its lot's cell, as a table of lines draws the cell", async () => {
    const page = {
      fieldia: '0.11',
      id: 'treatment',
      data: { kind: 'record', model: 'clinic.treatment' },
      fields: { line_ids: { type: 'one2many', label: 'Injectables used', relation: 'clinic.treatment.line', fields } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', columns: ['product_id', 'lot', 'expiry'], cells: { lot: { options: { scan } } } }] },
    } as unknown as Page;
    const form = createForm({ page, values: { line_ids: [{ key: 'a', id: null, values: { product_id: null, lot: null, expiry: null, serial: null } }] }, dataSource: createMemoryDataSource({ records: { 'clinic.product': PRODUCTS } }) });
    const node = (page.layout as unknown as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: page.fields['line_ids'], node, id: 'fd-lines', document, labels: WIDGET_LABELS.en, locale: 'en' });
    mounted.push(widget);
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    const button = document.querySelector<HTMLButtonElement>('.fd-scan[data-in-line] > .fd-scan-button');
    expect(button?.getAttribute('aria-label')).toBe('Scan a code into Lot');
    expect(button?.textContent).toBe('');
    button?.click();
    frames.push(code(`${GS}0106285096000842172812311025A1234`, 'data_matrix'));
    const line = () => (form.getState().values['line_ids'] as Line[])[0].values;
    expect(await until(() => line()['lot'] === '25A1234')).toBe(true);
    expect(line()).toMatchObject({ expiry: '2028-12-31', product_id: { id: 1, label: 'Botulinum toxin type A, 100 U' } });
  });
});

describe('a table of lines counted by scanning', () => {
  const PRODUCTS = { 1: { name: 'Hand cream 50 ml', barcode: '6224000123451' }, 2: { name: 'Lip balm', barcode: '6224000123468' } };
  const lineFields: Record<string, Field> = { product_id: { type: 'many2one', label: 'Product', relation: 'stock.product' }, counted: { type: 'integer', label: 'Counted' } } as Record<string, Field>;
  const fields: Record<string, Field> = { line_ids: { type: 'one2many', label: 'Products', relation: 'stock.count.line', fields: lineFields } as Field };
  const scan = { field: 'product_id', count: 'counted', by: 'barcode', formats: ['ean_13'] };

  it('counts each code read on its line, a line added for a new one, the sheet reading on until Done', async () => {
    const source = createMemoryDataSource({ records: { 'stock.product': PRODUCTS } });
    const { button, said, sheet, values } = mount(fields, 'line_ids', { columns: ['product_id', 'counted'], options: { scan } }, { dataSource: source, values: { line_ids: [{ key: 'k1', id: null, values: { product_id: { id: 2, label: 'Lip balm' }, counted: 4 } }] } });
    expect(document.querySelector('.fd-scan')?.getAttribute('data-scan')).toBe('lines');
    expect(button()?.getAttribute('aria-label')).toBe('Count Products by scanning');
    expect(button()?.textContent).toBe('Scan');
    button()?.click();
    expect(await until(() => said() === 'Scan each item: every code read counts one.')).toBe(true);
    const counts = () => Object.fromEntries((values()['line_ids'] as Line[]).map((line) => [(line.values['product_id'] as { label: string }).label, line.values['counted']]));
    frames.push(code('6224000123451', 'ean_13'));
    expect(await until(() => counts()['Hand cream 50 ml'] === 1)).toBe(true);
    expect(said()).toBe('Hand cream 50 ml: 1 counted');
    // Held still: one item, counted once.
    frames.push(code('6224000123451', 'ean_13'), code('6224000123451', 'ean_13'));
    await until(() => frames.length === 0);
    await settle(200);
    expect(counts()['Hand cream 50 ml']).toBe(1);
    // Out of sight a moment, and back: the next item.
    await settle(900);
    frames.push(code('6224000123451', 'ean_13'));
    expect(await until(() => counts()['Hand cream 50 ml'] === 2)).toBe(true);
    frames.push(code('6224000123468', 'ean_13'));
    expect(await until(() => counts()['Lip balm'] === 5)).toBe(true);
    expect(said()).toBe('Lip balm: 5 counted');
    expect(sheet()).not.toBeNull();
    // A code typed in the sheet, as its words offer: counted as one read (the owner's walk of 0.29: nowhere to type it).
    const typed = document.querySelector<HTMLInputElement>('.fd-scan-typed') as HTMLInputElement;
    expect(document.querySelector(`label[for="${typed.id}"]`)?.textContent).toBe('Or type the code');
    typed.value = '6224000123468';
    typed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(await until(() => counts()['Lip balm'] === 6)).toBe(true);
    expect(typed.value).toBe('');
    typed.value = '4006381333931';
    document.querySelector<HTMLButtonElement>('.fd-scan-count')?.click();
    expect(await until(() => said() === 'Nothing has the code 4006381333931. Scan another, or type it.')).toBe(true);
    expect(typed.value).toBe('4006381333931');
    document.querySelector<HTMLButtonElement>('.fd-scan-done')?.click();
    expect(sheet()).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it('has no box to type a code in the sheet of a single field: Type it instead goes to its own', async () => {
    const { button, said } = mount(LOT, 'lot', { options: { scan: true } });
    button()?.click();
    await until(() => said() === 'Hold the code inside the frame.');
    expect(document.querySelector('.fd-scan-typed')).toBeNull();
  });
});
