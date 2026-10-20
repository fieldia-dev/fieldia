import { labelAt, type Field, type Line, type LineField, type RelatedRecord, type SearchOptions, type Value, type Values } from '@fieldia/core';
import { gs1Day, gs1Number, gs1Parts, isGs1Day, readGs1 } from './gs1';
import { drawIcon } from './icons';
import { announcer, fillIn, maker, setAttr, setHidden, wordsFor } from './kind-parts';
import { openScanSheet, type ScanAnswer, type ScanEnd, type ScanSheet } from './scan-sheet';
import type { FoundCode } from './scan-reader';
import { stillShown } from './shown';
import { installScanStyles } from './styles-scan';
import type { TypedText, Widget, WidgetContext } from './widgets';

/**
 * A field scanned into with the camera (`options.scan`, the scan part): the Scan button beside its box, and what a code
 * read comes to.
 *
 * - **Words** (a char, a text): the code as read — a GS1 code's part where the field takes one (`part`: its lot, its
 *   serial), a day as the date it names; a GS1 code taken whole is written as its label prints it, "(01)…(10)…".
 * - **A link** (a many2one): the record whose code it is — by the field holding the linked records' codes (`by`), else
 *   by the source's name search (the name itself first): one record, taken; none, or several, said in the sheet, which
 *   reads on; a GTIN of 14 digits found as the 13 or 12 a shop keeps too.
 * - **The other fields a GS1 code fills** (`fills`): its expiry, its product, written as the field takes them, before the
 *   field itself; one that finds nothing is left as it was.
 * - **A table counted** (a one2many, with `field` and `count`): the line whose `field` — and every column the code
 *   fills — holds what the code names gets one more; else a line is added with one. The sheet stays open, saying each
 *   count, until Done.
 *
 * Where the camera cannot open, a note beside the button says why and the focus goes to the box, to type the code. A
 * scanner gun types into the box as ever: this adds a way, it takes none. An answer for a record no longer shown is laid
 * on none, and the sheet closes.
 */

/** Every format Fieldia reads: a field that names none reads them all. */
const EVERY_FORMAT = ['qr_code', 'data_matrix', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
/** Fieldia's own picture for Scan: a viewfinder's corners and a line across them. */
const SCAN_ICON = '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7 12h10"/>';

/** What one field takes of a GS1 code: its part, and for a link the field holding the linked records' codes. */
interface Fill {
  part: string;
  by?: string;
}
interface Settings {
  formats: string[];
  by?: string;
  part?: string;
  fills: [string, Fill][];
  sound: boolean;
  field?: string;
  count?: string;
}

/** A field's `options.scan` as a scan reads it: `true`, or its settings. */
function settingsOf(scan: unknown): Settings {
  const given = scan && typeof scan === 'object' && !Array.isArray(scan) ? (scan as Record<string, unknown>) : {};
  const text = (key: string) => (typeof given[key] === 'string' ? (given[key] as string) : undefined);
  const formats = Array.isArray(given['formats']) ? given['formats'].filter((format): format is string => EVERY_FORMAT.includes(format as string)) : [];
  const fills = given['fills'] && typeof given['fills'] === 'object' ? Object.entries(given['fills'] as Record<string, unknown>) : [];
  return {
    formats: formats.length ? formats : EVERY_FORMAT,
    by: text('by'),
    part: text('part'),
    fills: fills.flatMap(([name, fill]): [string, Fill][] => (typeof fill === 'string' ? [[name, { part: fill }]] : fill && typeof fill === 'object' && typeof (fill as Fill).part === 'string' ? [[name, fill as Fill]] : [])),
    sound: given['sound'] !== false,
    field: text('field'),
    count: text('count'),
  };
}

/** A code as words: a GS1 code as its label prints it; control characters out, and in one line its line breaks a space. */
function codeWords(code: string, oneLine: boolean): string {
  const parts = gs1Parts(code);
  if (parts) return parts.map(([id, value]) => `(${id})${value}`).join('');
  const text = oneLine ? code.replace(/\s*[\r\n]+\s*/g, ' ') : code.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
}

/** A GTIN of 14 digits as a shop's system may keep it too: its leading zeros dropped down to 13 and 12 digits (EAN-13, UPC-A). */
function codeForms(code: string): string[] {
  const forms = [code];
  if (!/^\d{14}$/.test(code)) return forms;
  for (let next = code; next.length > 12 && next.startsWith('0'); ) forms.push((next = next.slice(1)));
  return forms;
}

type Found = RelatedRecord | 'none' | 'several';
const oneOf = (found: RelatedRecord[]): Found => (found.length === 1 ? found[0] : found.length ? 'several' : 'none');

/**
 * The record a code names, through a search (`find`, the form's for the field): by the field holding the codes (`by`);
 * else by name, the name itself first, then the source's name search (which may find a product by its barcode).
 */
async function findByCode(find: (query: string, options: SearchOptions) => Promise<RelatedRecord[]>, code: string, by: string | undefined): Promise<Found> {
  for (const form of codeForms(code)) {
    const found = by ? oneOf(await find(form, { field: by })) : await (async () => {
      const exact = oneOf(await find(form, { exact: true }));
      return exact !== 'none' ? exact : oneOf(await find(form, {}));
    })();
    if (found !== 'none') return found;
  }
  return 'none';
}

/** Two values alike as a line's column holds them: a link by its record. */
const alike = (a: Value | undefined, b: Value): boolean => {
  if (b && typeof b === 'object' && !Array.isArray(b) && 'id' in b) return !!a && typeof a === 'object' && !Array.isArray(a) && 'id' in a && (a as RelatedRecord).id === (b as RelatedRecord).id;
  return (a ?? null) === b;
};
/** A value as a sentence says it: a link by its name. */
const shownOf = (value: Value): string => (value && typeof value === 'object' && !Array.isArray(value) && 'label' in value ? String((value as RelatedRecord).label) : String(value ?? ''));

/**
 * A field's widget scanned into (`options.scan`): in a box of its own with the Scan button at its end — a table's under
 * it — and what the codes it reads come to. The main script draws it so once this part has come (`partWidget`), the
 * widget alone until then.
 */
export function scanning(widget: Widget, context: WidgetContext): Widget {
  const { form, name, field, node, document: doc, labels, locale } = context;
  const kind = field.type === 'one2many' ? 'lines' : field.type === 'many2one' ? 'link' : field.type === 'char' || field.type === 'text' ? 'words' : null;
  const settings = settingsOf(node.options?.['scan']);
  // A kind no code is written into, or a table that names nothing to count by: the widget alone (the page's check says why).
  if (!kind || (kind === 'lines' && (!settings.field || !settings.count))) return widget;
  installScanStyles(doc);
  const make = maker(doc);
  const holder = make('div', { class: 'fd-scan' }, widget.element);
  const words = wordsFor(labels, locale);
  const label = node.label ?? field.label;
  const lower = form.page.lowerLabels;
  const named = (template: string) => fillIn(template, { label: labelAt(template, 'label', lower, locale)(label) });
  const inLine = !!form.line;
  const id = `${context.id}-scan`;

  const icon = drawIcon(doc, 'scan', { scan: SCAN_ICON });
  icon?.setAttribute('aria-hidden', 'true');
  const button = make('button', { type: 'button', class: 'fd-button fd-scan-button', 'aria-haspopup': 'dialog', 'aria-label': named(words.scanInto), title: named(words.scanInto) }, ...(icon ? [icon] : []), ...(inLine ? [] : [words.scanButton]));
  const note = make('p', { class: 'fd-scan-note', id: `${id}-note`, role: 'status', hidden: '' });
  const voice = announcer(make);
  holder.dataset['scan'] = kind;
  if (inLine) holder.setAttribute('data-in-line', '');
  holder.append(button, note, voice.element);

  /** The fields a GS1 code may fill: the line's columns for a cell or a counted line, else the page's. */
  const columns: Record<string, Field | LineField> =
    kind === 'lines' ? ((field as { fields?: Record<string, LineField> }).fields ?? {}) : form.line ? ((form.page.fields[form.line.field] as { fields?: Record<string, LineField> } | undefined)?.fields ?? {}) : form.page.fields;
  let sheet: ScanSheet | null = null;

  /** What a part of a code (or the whole, `id` null) is as `def` holds it; a link's is looked up apart. Null where it is none. */
  function valueOf(def: Field | LineField, id: string | null, part: string): Value | null {
    const day = id && isGs1Day(id) ? gs1Day(part, form.now?.() ?? new Date()) : null;
    switch (def.type) {
      case 'date':
        return day ?? (/^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null);
      case 'integer': {
        const n = id ? gs1Number(id, part) : /^\d+$/.test(part) ? Number(part) : null;
        return n !== null && Number.isInteger(n) ? n : null;
      }
      case 'float':
      case 'monetary':
        return id ? gs1Number(id, part) : /^\d+(\.\d+)?$/.test(part) ? Number(part) : null;
      case 'char':
        return day ?? ((id ? part : codeWords(part, true)) || null);
      case 'text':
        return day ?? ((id ? part : codeWords(part, false)) || null);
      default:
        return null;
    }
  }

  /** The record a code names in a link `column` — a line's not added yet for a table counted. */
  function find(column: string, code: string, by: string | undefined): Promise<Found> {
    return findByCode((query, options) => (kind === 'lines' ? form.searchLine(name, null, column, query, 2, options) : form.search(column, query, 2, options)), code, by);
  }

  /** The values a GS1 code fills besides the field: each written as its field takes it, a link's record looked up. */
  async function filled(parts: Record<string, string> | null): Promise<Values> {
    const values: Values = {};
    for (const [other, fill] of settings.fills) {
      const def = columns[other];
      const part = parts?.[fill.part];
      if (!def || part === undefined) continue;
      if (def.type === 'many2one') {
        const record = await find(other, part, fill.by).catch((): Found => 'none');
        if (typeof record === 'object') values[other] = record;
        continue;
      }
      const value = valueOf(def, fill.part, part);
      if (value !== null) values[other] = value;
    }
    return values;
  }

  /** What the code names in `def` (`column`, by `by`): its value, or what to say instead; a link's said looked up meanwhile. */
  async function nameCode(def: Field | LineField, column: string, code: FoundCode, say: (text: string) => void): Promise<{ value: Value } | { said: string }> {
    const parts = settings.part || settings.fills.length ? readGs1(code.rawValue) : null;
    const part = settings.part ? parts?.[settings.part] : code.rawValue;
    const nameOf = labelAt(words.scanNoPart, 'label', lower, locale)(def.label);
    if (part === undefined) return { said: fillIn(words.scanNoPart, { label: nameOf }) };
    if (def.type === 'many2one') {
      const shown = codeWords(part, true);
      say(fillIn(words.scanLookingUp, { code: shown }));
      let found: Found;
      try {
        found = await find(column, part, settings.by);
      } catch {
        return { said: fillIn(words.scanLookUpFailed, { code: shown }) };
      }
      if (found === 'none') return { said: fillIn(words.scanNoneFound, { code: shown }) };
      if (found === 'several') return { said: fillIn(words.scanSeveral, { code: shown }) };
      return { value: found };
    }
    const value = valueOf(def, settings.part ?? null, part);
    return value === null ? { said: fillIn(words.scanNoPart, { label: nameOf }) } : { value };
  }

  /** A code read into the field: written, the fields it fills first. */
  async function readInto(code: FoundCode, shown: () => boolean, say: (text: string) => void): Promise<ScanAnswer> {
    const got = await nameCode(field, name, code, say);
    if (!shown()) return { kept: false, close: true };
    if ('said' in got) return { kept: false, said: got.said };
    const others = await filled(readGs1(code.rawValue));
    if (!shown()) return { kept: false, close: true };
    for (const [other, value] of Object.entries(others)) form.setValue(other, value);
    form.setValue(name, got.value);
    voice.say(fillIn(words.scanRead, { label: labelAt(words.scanRead, 'label', lower, locale)(label), value: shownOf(got.value) }));
    return { kept: true, close: true };
  }

  /** A code read into a table counted: its line one more, else a line with one. */
  async function countIn(code: FoundCode, shown: () => boolean, say: (text: string) => void): Promise<ScanAnswer> {
    const column = settings.field as string;
    const counted = settings.count as string;
    const def = columns[column];
    if (!def) return { kept: false };
    const got = await nameCode(def, column, code, say);
    if (!shown()) return { kept: false, close: true };
    if ('said' in got) return { kept: false, said: got.said };
    const others = await filled(readGs1(code.rawValue));
    if (!shown()) return { kept: false, close: true };
    const lines = (form.getState().values[name] as Line[] | null) ?? [];
    const same = lines.find((line) => alike(line.values[column], got.value) && Object.entries(others).every(([other, value]) => alike(line.values[other], value)));
    let n = 1;
    if (same) {
      n = (Number(same.values[counted]) || 0) + 1;
      form.updateLine(name, same.key, counted, n);
    } else {
      form.addLine(name, { ...others, [column]: got.value, [counted]: 1 });
    }
    return { kept: true, said: fillIn(words.scanCounted, { name: shownOf(got.value), n }) };
  }

  function ended(end: ScanEnd) {
    sheet = null;
    if (end === 'read' || end === 'closed') {
      if (button.isConnected) button.focus();
      return;
    }
    if (end === 'type') {
      widget.focus();
      return;
    }
    const why = { refused: words.scanRefused, absent: words.scanNoCamera, busy: words.scanCameraBusy, unavailable: words.scanUnavailable, noReader: words.scanNoReader }[end];
    note.textContent = why;
    note.hidden = false;
    setAttr(button, 'aria-describedby', note.id);
    widget.focus();
  }

  button.addEventListener('click', () => {
    if (sheet) return;
    note.hidden = true;
    setAttr(button, 'aria-describedby', null);
    const shown = stillShown(form);
    sheet = openScanSheet({
      doc,
      from: button,
      words,
      title: named(words.scanTitle),
      aim: kind === 'lines' ? words.scanAimCount : words.scanAim,
      formats: settings.formats,
      counting: kind === 'lines',
      sound: settings.sound,
      read: (code, say) => (kind === 'lines' ? countIn(code, shown, say) : readInto(code, shown, say)),
      closed: ended,
    });
  });

  return {
    element: holder,
    get tools() {
      return widget.tools;
    },
    update(state) {
      widget.update(state);
      setHidden(button, state.readonly);
      if (state.readonly) setHidden(note, true);
    },
    focus: () => widget.focus(),
    destroy() {
      sheet?.close();
      sheet = null;
      widget.destroy?.();
    },
    ...(widget.takeTyped ? { takeTyped: (typed: TypedText) => widget.takeTyped?.(typed) ?? false } : {}),
    ...(widget.typedText ? { typedText: () => widget.typedText?.() ?? '' } : {}),
  };
}
