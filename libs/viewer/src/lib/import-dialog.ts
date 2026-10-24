import type { SheetCell } from './xlsx';
import { MESSAGES, optionsList, recordSentence, type CsvValue, type DataSource, type Form, type LineField, type ListNode, type Locale, type Page, type RecordId, type Value } from '@fieldia/core';
import { askFirst, dateOrderOf, displayValue, drawIcon, keepTabIn, loadLinesPart, loadPhonePart, phoneSettings, WIDGET_LABELS, type IconSet, type LinesPart, type PhonePart } from '@fieldia/widgets';
import { checkRows, type CheckedRow, type RowsCheck } from './import-check';
import { ENCODING_SCRIPT, ENCODINGS, FileProblem, readFile, SEPARATORS, type FileCell, type FileSheet, type PickedFile, type ReadHow } from './import-file';
import { matchColumns } from './import-match';
import { installImportStyles } from './import-styles';
import { canWrite, deleteRecords, writeRows, type Written } from './import-write';
import { VIEWER_LABELS, type ViewerLabels } from './labels';

/**
 * A list's Import, in a dialog of three steps: a file chosen or dropped and
 * read (import-file.ts); its columns matched to the page's fields, each with
 * its first value and a picker of the field it goes into (import-match.ts);
 * its rows checked by the page's own rules before anything is written — the
 * rows that would be refused named with why, and downloadable as a file to
 * fix, and the first rows shown as they will be saved (import-check.ts) —
 * then written, with how far it has got and Stop (import-write.ts). The list
 * says how it ended, and offers Undo (list.ts). A file past the browser's
 * most is said plainly, unless the source takes it (`importRecords`).
 */

/** The most rows a file read in the browser may hold: a CSV file of 50,000 rows is read and checked in about a second. */
export const IMPORT_MOST = 50000;
/** The rows shown as they will be saved. */
const PREVIEW = 5;
/** The rows refused named in the dialog: the file to fix holds them all. */
const NAMED = 50;

/** What the list part hands over of its own, so the import part carries no copy of it: the workbook and CSV writers and the browser's save. */
export interface ImportFiles {
  xlsxOf: (sheet: { name: string; columns: string[]; rows: SheetCell[][]; rtl?: boolean }) => Promise<Uint8Array>;
  csvOf: (rows: readonly (readonly CsvValue[])[], separator?: string) => string;
  csvSeparator: (locale: Locale) => string;
  saveFile: (doc: Document, name: string, file: Blob | string) => void;
  xlsxType: string;
}

export interface ImportContext {
  page: Page;
  node: ListNode;
  /** The list's form: its search finds a link's record by name. */
  form: Form;
  model: string;
  dataSource: DataSource;
  doc: Document;
  /** The list's element: the dialog wears the look of the page round it. */
  from: HTMLElement;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  /** A count as the page writes numbers: "1,284". */
  number: (n: number) => string;
  /** The fields the columns may go into, in order (`importFields`, those the source can fill). */
  fields: string[];
  files: ImportFiles;
  icons?: IconSet;
  /** The most rows a file may hold: IMPORT_MOST unless told. */
  most?: number;
}

/** A row not imported: its number in the file, and why. */
export interface NotImported {
  number: number;
  why: string;
}

/** How an import ended: the source's words where it took the file; else what was made, what was not, of how many rows. */
export type ImportEnd =
  | { message: string }
  | {
      made: { number: number; id: RecordId }[];
      notImported: NotImported[];
      stopped: boolean;
      total: number;
      /** The rows not imported, in a file to fix them in, its last column why. */
      downloadFix(rows: readonly NotImported[]): Promise<void>;
      /** The records made, deleted again; absent where the source cannot delete. */
      undo?: (ids: readonly RecordId[], progress: (done: number, total: number) => void) => Promise<{ done: number; failed: { id: RecordId; why: string }[] }>;
    };

/** Every word for yes and no a page may hold, in every language the viewer has, and as spreadsheets write them. */
function yesAndNo(): { yes: string[]; no: string[] } {
  const yes = new Set(['yes', 'y', 'true', '1', 'x', '✓', '✔', 'on']);
  const no = new Set(['no', 'n', 'false', '0', 'off', '✗', '✘', '-']);
  for (const words of [...Object.values(VIEWER_LABELS), ...Object.values(WIDGET_LABELS)]) {
    yes.add(words.yes);
    no.add(words.no);
  }
  return { yes: [...yes], no: [...no] };
}

/** An encoding's name as people know it: "Windows-1256", "Shift_JIS". */
const encodingName = (encoding: string) => ({ 'utf-8': 'UTF-8', 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', shift_jis: 'Shift_JIS', gbk: 'GBK', big5: 'Big5', 'euc-kr': 'EUC-KR' })[encoding] ?? encoding.replace(/^windows/, 'Windows');

/** A cell's words, as a file to fix holds them: a day as written ("2026-09-14"), a number as JavaScript writes it. */
const cellWords = (cell: FileCell) => (cell === null ? '' : typeof cell === 'object' ? cell.at.replace('T', ' ') : String(cell));

/** Days from Excel's day 0 (30 December 1899) to the Unix epoch. */
const EXCEL_EPOCH = 25569;
/**
 * A workbook's cell written back as it was read: a number as a number, yes or no as yes or no, a day (and its time) as a
 * day in the ISO order, words as words — never "true", or "2026-06-11" as words.
 */
function sheetCellOf(cell: FileCell): SheetCell {
  if (cell === null) return null;
  if (typeof cell === 'number') return { n: cell };
  if (typeof cell === 'boolean') return { b: cell };
  if (typeof cell === 'object') {
    const time = /T\d\d:\d\d/.test(cell.at) && !/T00:00(:00)?$/.test(cell.at);
    const at = Date.parse(/Z|[+-]\d\d:\d\d$/.test(cell.at) ? cell.at : `${cell.at}${cell.at.includes('T') ? '' : 'T00:00'}Z`);
    return Number.isFinite(at) ? { n: Math.round((at / 86_400_000 + EXCEL_EPOCH) * 1e6) / 1e6, format: time ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd' } : cellWords(cell);
  }
  return cell;
}

/** The import, in its dialog: settled once it has ended — null when the person closed it before writing anything. */
export function openImport(context: ImportContext): Promise<ImportEnd | null> {
  const { page, doc, labels, fill, number, locale } = context;
  /** One of its sentences in the words the page names its records by (`records`), else as it says them plainly. */
  const sentence = (noun: string | undefined, words: string) => recordSentence(page.records, noun, words, locale);
  const failedWords = sentence(labels.importFailedNoun, labels.importFailed);
  const most = context.most ?? IMPORT_MOST;
  installImportStyles(doc);
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) element.setAttribute(name, value);
    element.append(...children);
    return element;
  };
  const plural = (n: number, other: string, one: string) => fill(new Intl.PluralRules(locale).select(n) === 'one' ? one : other, { n: number(n) });
  const opener = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

  // ---- the box: a dialog of the page's look --------------------------------------------------------------------
  const id = `fd-import-${Math.random().toString(36).slice(2, 8)}`;
  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, fill(labels.importTitle, { title: page.title || context.node.id }));
  const close = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close, title: labels.close }, '×');
  const body = make('div', { class: 'fd-form-dialog-body fd-import-body' });
  const status = make('span', { class: 'fd-import-status', role: 'status', 'aria-live': 'polite' });
  const back = make('button', { type: 'button', class: 'fd-button' }, labels.back);
  const primary = make('button', { type: 'button', class: 'fd-button fd-button-primary' });
  const stop = make('button', { type: 'button', class: 'fd-button', hidden: '' }, labels.importStop);
  const footer = make('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot fd-import-foot' }, status, back, stop, primary);
  const box = make('div', { class: 'fd-theme fd-form-dialog fd-size-large fd-import', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' }, make('div', { class: 'fd-form-dialog-head' }, title, close), body, footer);
  // The look of the page the list is on: its skin, theme, tokens, direction and language, as the dialog sits outside it.
  const root = context.from.closest<HTMLElement>('.fd-form') ?? context.from;
  for (const { name, value } of [...root.attributes]) if ((name.startsWith('data-') && name !== 'data-max-width') || name === 'style' || name === 'dir' || name === 'lang') box.setAttribute(name, value);
  const backdrop = make('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop' }, box);
  (doc.body ?? doc.documentElement).append(backdrop);

  // ---- what it knows so far ----------------------------------------------------------------------------------------
  let file: PickedFile | null = null;
  let how: ReadHow = {};
  let sheet: FileSheet | null = null;
  let columns: (string | null)[] = [];
  let checked: CheckedRow[] | null = null;
  /** Each step's own: a newer read or check makes an older one's answer moot. */
  let turn = 0;
  let writing = false;
  let stopping = false;
  let ended = false;
  let settle: (end: ImportEnd | null) => void = () => undefined;
  const done = new Promise<ImportEnd | null>((resolve) => (settle = resolve));

  function finish(end: ImportEnd | null) {
    if (ended) return;
    ended = true;
    turn++;
    backdrop.remove();
    doc.removeEventListener('keydown', onKey, true);
    if (opener?.isConnected) opener.focus();
    settle(end);
  }
  // A file chosen, its columns matched: × and Escape ask first, in place, as a record's dialog asks before it lets
  // work go; Cancel, before a file is chosen, is the person's own answer.
  const letGo = askFirst(make, { yes: labels.discard, no: labels.importKeepEditing });
  box.insertBefore(letGo.element, footer);
  const leave = () => {
    if (writing) return;
    if (!file) return finish(null);
    letGo.ask(labels.discardChanges, (discard) => (discard ? finish(null) : primary.hidden ? box.focus() : primary.focus()));
  };
  function onKey(event: KeyboardEvent) {
    if (!box.contains(event.target as Node) && event.target !== doc.body) return;
    // The question's own Escape is its Keep editing: its own to hear.
    if (event.key === 'Escape' && letGo.element.contains(event.target as Node)) return;
    if (event.key === 'Escape' && !writing) {
      event.preventDefault();
      event.stopPropagation();
      leave();
    } else keepTabIn(box, event);
  }
  doc.addEventListener('keydown', onKey, true);
  close.addEventListener('click', leave);

  /** The foot's buttons and words for a step. */
  function steps(step: { back?: () => void; backWords?: string; primary?: { words: string; act: () => void }; said?: string }) {
    back.hidden = !step.back;
    back.textContent = step.backWords ?? labels.back;
    back.onclick = step.back ?? null;
    primary.hidden = !step.primary;
    primary.textContent = step.primary?.words ?? '';
    primary.onclick = step.primary?.act ?? null;
    stop.hidden = true;
    status.textContent = step.said ?? '';
  }

  // ---- 1. a file, chosen or dropped ----------------------------------------------------------------------------------
  const input = make('input', { type: 'file', class: 'fd-import-input', accept: '.xlsx,.xlsm,.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aria-label': labels.importChoose, tabindex: '-1', hidden: '' });
  const choose = make('button', { type: 'button', class: 'fd-button fd-button-secondary fd-import-choose' }, labels.importChoose);
  const problem = make('p', { class: 'fd-error fd-import-problem', role: 'alert', hidden: '' });
  // A tray with an arrow out of it, unless the app's icons have their own "upload".
  const icon = drawIcon(doc, 'upload', { upload: '<path d="M12 15V5M7.5 9.5L12 5l4.5 4.5"/><path d="M4 15v4.5h16V15"/>', ...context.icons });
  icon?.setAttribute('aria-hidden', 'true');
  const drop = make(
    'div',
    { class: 'fd-import-drop' },
    ...(icon ? [icon] : []),
    make('p', { class: 'fd-import-drop-words' }, labels.importDrop),
    choose,
    make('p', { class: 'fd-help' }, fill(labels.importHint, { most: number(most) })),
    input
  );
  choose.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const picked = input.files?.[0];
    input.value = '';
    if (picked) void read(picked, {});
  });
  // A file dropped anywhere on the dialog while it asks for one.
  box.addEventListener('dragover', (event) => {
    if (!drop.isConnected || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    drop.setAttribute('data-over', '');
  });
  box.addEventListener('dragleave', (event) => {
    if (!box.contains(event.relatedTarget as Node | null)) drop.removeAttribute('data-over');
  });
  box.addEventListener('drop', (event) => {
    drop.removeAttribute('data-over');
    const dropped = event.dataTransfer?.files?.[0];
    if (!drop.isConnected || !dropped) return;
    event.preventDefault();
    void read(dropped, {});
  });

  function showPick() {
    turn++;
    body.replaceChildren(drop, problem);
    // Nothing chosen yet: Cancel, as × and Escape.
    steps({ back: () => finish(null), backWords: labels.cancel });
    choose.focus();
  }

  /** Why a file cannot be read, in the person's words. */
  const whyNot = (error: unknown) => {
    const kind = error instanceof FileProblem ? error.problem : 'damaged';
    return { notSheet: labels.importNotSheet, oldExcel: labels.importOldExcel, locked: labels.importLocked, damaged: labels.importDamaged, noRows: labels.importNoRows, cannotInflate: labels.importNoUnzip }[kind];
  };

  /** A file read, as the person last said to read it; then its columns to match, or why it cannot be. */
  async function read(picked: PickedFile, asked: ReadHow) {
    const mine = ++turn;
    problem.hidden = true;
    status.textContent = fill(labels.importReading, { name: picked.name });
    let next: FileSheet;
    try {
      next = await readFile(picked, asked, most, (letter) => fill(labels.importColumnLetter, { letter }));
    } catch (error) {
      if (mine !== turn) return;
      status.textContent = '';
      problem.textContent = fill(labels.importCannotRead, { name: picked.name, why: whyNot(error) });
      problem.hidden = false;
      if (!drop.isConnected) showPick();
      return;
    }
    if (mine !== turn) return;
    // Past the most, said plainly — unless the source takes a file of any size.
    if (next.total > most && !context.dataSource.importRecords) {
      status.textContent = '';
      problem.textContent = fill(labels.importTooMany, { name: picked.name, n: number(next.total), most: number(most) });
      problem.hidden = false;
      if (!drop.isConnected) showPick();
      return;
    }
    // Read again (another sheet, encoding or separator): the columns the person matched keep their fields, by header.
    const before = sheet && file === picked ? new Map(sheet.headers.map((header, i) => [header, columns[i]])) : null;
    file = picked;
    how = { ...(next.encoding ? { encoding: next.encoding } : {}), ...(next.separator ? { separator: next.separator } : {}), ...(next.sheet !== undefined ? { sheet: next.sheet } : {}) };
    sheet = next;
    const matched = matchColumns(page, next.headers, context.fields);
    columns = before ? next.headers.map((header, i) => (before.has(header) ? (before.get(header) ?? null) : matched[i])) : matched;
    checked = null;
    showMatch();
  }

  // ---- 2. the columns matched to fields --------------------------------------------------------------------------------
  const said = make('div', { class: 'fd-import-said', role: 'status', 'aria-live': 'polite' });

  function showMatch(focus = true) {
    turn++;
    const now = sheet as FileSheet;
    const picked = file as PickedFile;
    // The file's name in bold, where the words put it: "contacts.xlsx: 1,284 rows".
    // A header and nothing under it: said so, and nothing offered to check.
    const counted = !now.total ? labels.importNoRowsUnder : new Intl.PluralRules(locale).select(now.total) === 'one' ? labels.importFileRowsOne : labels.importFileRows;
    const [before, after = ''] = fill(counted, { name: '\u0000', n: number(now.total) }).split('\u0000');
    const rows = make('p', { class: 'fd-import-file' }, before, make('strong', {}, make('bdi', {}, picked.name)), after);
    const pickers: HTMLElement[] = [];
    let misread: HTMLElement | null = null;
    const picker = (label: string, options: [string, string][], value: string, change: (value: string) => void) => {
      const select = make('select', { class: 'fd-input fd-import-select', 'aria-label': label }, ...options.map(([v, words]) => make('option', { value: v }, words)));
      select.value = value;
      select.addEventListener('change', () => change(select.value));
      pickers.push(make('label', { class: 'fd-import-how' }, make('span', {}, label), select));
    };
    if (now.sheets && now.sheets.length > 1) picker(labels.importSheet, now.sheets.map((name, i) => [String(i), name]), String(now.sheet ?? 0), (value) => void read(picked, { ...how, sheet: Number(value) }));
    if (now.kind === 'csv') {
      let scripts: Intl.DisplayNames | null = null;
      try {
        scripts = new Intl.DisplayNames([locale], { type: 'script' });
      } catch {
        scripts = null;
      }
      const named = (encoding: string) => (encoding.startsWith('utf') ? fill(labels.importUnicode, { name: encodingName(encoding) }) : `${scripts?.of(ENCODING_SCRIPT[encoding]) ?? ENCODING_SCRIPT[encoding]} (${encodingName(encoding)})`);
      picker(labels.importEncoding, ENCODINGS.map((encoding) => [encoding, named(encoding)]), now.encoding ?? 'utf-8', (value) => void read(picked, { ...how, encoding: value }));
      const separators: Record<string, string> = { ',': labels.importComma, ';': labels.importSemicolon, '\t': labels.importTab, '|': labels.importBar };
      picker(labels.importSeparator, SEPARATORS.map((separator) => [separator, separators[separator]]), now.separator ?? ',', (value) => void read(picked, { ...how, separator: value }));
      // Read in an encoding its bytes say it is not in: said, with the one that reads it ("ï»؟Name" is UTF-8 read as Arabic).
      if (now.misread) misread = make('p', { class: 'fd-import-misread', role: 'note' }, fill(labels.importMisread, { chosen: named(now.encoding ?? 'utf-8'), encoding: named(now.misread) }));
    }
    const choices: [string, string][] = [['', labels.importLeaveOut], ...context.fields.map((field): [string, string] => [field, page.fields[field].label])];
    const table = make(
      'table',
      { class: 'fd-import-columns' },
      make('thead', {}, make('tr', {}, make('th', { scope: 'col' }, labels.importColumn), make('th', { scope: 'col', class: 'fd-import-example' }, labels.importExample), make('th', { scope: 'col' }, labels.importField))),
      make(
        'tbody',
        {},
        ...now.headers.map((header, i) => {
          const first = now.rows.find((row) => row[i] !== null)?.[i] ?? null;
          const select = make('select', { class: 'fd-input fd-import-select', 'data-column': String(i), 'aria-label': `${header}: ${labels.importField}` }, ...choices.map(([value, words]) => make('option', { value }, words)));
          select.value = columns[i] ?? '';
          select.addEventListener('change', () => {
            const field = select.value || null;
            // A field comes from one column: the one that had it is left out, and that is said.
            const other = field ? columns.findIndex((one, j) => one === field && j !== i) : -1;
            columns[i] = field;
            if (other >= 0) {
              columns[other] = null;
              const otherSelect = table.querySelector<HTMLSelectElement>(`select[data-column="${other}"]`);
              if (otherSelect) otherSelect.value = '';
              sayMatch(fill(labels.importMoved, { field: page.fields[field as string].label, column: header, other: now.headers[other] }));
            } else sayMatch();
          });
          return make('tr', {}, make('th', { scope: 'row' }, make('bdi', {}, header)), make('td', { class: 'fd-import-example' }, make('bdi', {}, shownWords(first))), make('td', {}, select));
        })
      )
    );
    body.replaceChildren(make('div', { class: 'fd-import-head' }, rows, ...pickers), ...(misread ? [misread] : []), problem, make('div', { class: 'fd-import-scroll' }, table), said);
    problem.hidden = true;
    sayMatch();
    if (focus) table.querySelector('select')?.focus();
  }

  /** What the matching leaves out, and a required field none fills; with what a change just did first. */
  function sayMatch(moved?: string) {
    const now = sheet as FileSheet;
    const out = now.headers.filter((_, i) => !columns[i]);
    const lines: string[] = [];
    if (moved) lines.push(moved);
    if (out.length) lines.push(fill(labels.importLeftOut, { columns: out.join(', ') }));
    for (const [name, def] of Object.entries(page.fields)) {
      if (def.required === true && def.default === undefined && context.fields.includes(name) && !columns.includes(name)) lines.push(fill(labels.importNeeded, { field: def.label }));
    }
    said.replaceChildren(...lines.map((line) => make('p', {}, line)));
    const anything = columns.some(Boolean) && now.total > 0;
    steps({ back: showPick, ...(anything ? { primary: { words: plural(now.total, labels.importCheck, labels.importCheckOne), act: () => void check() } } : {}) });
  }

  // ---- 3. the rows checked ------------------------------------------------------------------------------------------------
  async function check() {
    const mine = ++turn;
    const now = sheet as FileSheet;
    const picked = file as PickedFile;
    steps({ back: () => showMatch() });
    // The source's own import, for a file of any size: asked first, with the columns as matched.
    if (context.dataSource.importRecords) {
      status.textContent = fill(labels.importReading, { name: picked.name });
      let answer: { message: string } | false;
      try {
        answer = await context.dataSource.importRecords({
          model: context.model,
          file: picked,
          columns: now.headers.map((header, i) => ({ header, field: columns[i] ?? null })),
          rows: now.total,
          fields: page.fields,
          locale,
          dateOrder: dateOrderOf({ page }),
        });
      } catch {
        if (mine !== turn) return;
        status.textContent = failedWords;
        return;
      }
      if (mine !== turn) return;
      if (answer) return finish({ message: answer.message });
      if (now.total > most) {
        problem.textContent = fill(labels.importTooMany, { name: picked.name, n: number(now.total), most: number(most) });
        problem.hidden = false;
        status.textContent = '';
        return;
      }
    }
    status.textContent = fill(labels.importChecking, { done: number(0), n: number(now.total) });
    // The readers of a cell, the lines part's; a phone's, the phone part's, where a column of the page reads them so.
    const phones = context.fields.some((field) => context.node.cells?.[field]?.widget === 'phone' && phoneSettings(page, context.node.cells?.[field]?.options) !== null);
    let readers: LinesPart;
    let phoneReaders: PhonePart | undefined;
    try {
      [readers, phoneReaders] = await Promise.all([loadLinesPart(), phones ? loadPhonePart() : Promise.resolve(undefined)]);
    } catch {
      if (mine === turn) status.textContent = failedWords;
      return;
    }
    const words = { importNoneCalled: labels.importNoneCalled, importSeveralCalled: labels.importSeveralCalled, importNotYesNo: labels.importNotYesNo };
    const rowsCheck: RowsCheck = {
      page,
      form: context.form,
      cells: context.node.cells,
      locale,
      dateOrder: dateOrderOf({ page }),
      today: context.form.today(),
      // A field's label small inside a message's sentence where the page asks, as its own form says them.
      messages: page.lowerLabels ? { ...(MESSAGES[locale] ?? MESSAGES.en), lowerLabels: true } : (MESSAGES[locale] ?? MESSAGES.en),
      labels: WIDGET_LABELS[locale] ?? WIDGET_LABELS.en,
      words,
      ...yesAndNo(),
      readers,
      ...(phoneReaders ? { phones: phoneReaders } : {}),
      // A choice that changes with another field is asked by the row's values: a row's city by its own country.
      options: async (field, values) => {
        const def = page.fields[field];
        const from = def.type === 'selection' ? optionsList(def.optionsFrom) : undefined;
        return from && context.dataSource.options ? context.dataSource.options({ list: from.list, values }) : [];
      },
    };
    let rows: CheckedRow[];
    try {
      rows = await checkRows(rowsCheck, now, columns, (at, of) => {
        if (mine === turn) status.textContent = fill(labels.importChecking, { done: number(Math.round((at / of) * now.total)), n: number(now.total) });
      }, () => mine !== turn);
    } catch {
      if (mine === turn) status.textContent = failedWords;
      return;
    }
    if (mine !== turn) return;
    checked = rows;
    showChecked();
  }

  /** The rows not imported, as a file like the one read — a workbook for a workbook, CSV for CSV — with why in a last column. */
  /**
   * The rows not imported, to fix and bring in again: their cells as the file had them — a workbook's numbers, yes or
   * no and days kept as such, a CSV file's words as they were — under the labels of the fields the import matched them
   * to (where a column matched none, its own header), so the file matches by itself when it is imported again; why each
   * was refused in a last column.
   */
  async function downloadFix(rows: readonly NotImported[]): Promise<void> {
    const now = sheet as FileSheet;
    const byNumber = new Map(now.numbers.map((n, i) => [n, now.rows[i]]));
    const headers = [...now.headers.map((header, i) => (columns[i] ? (page.fields[columns[i] as string]?.label ?? header) : header)), labels.importWhy];
    const base = fill(labels.importFixName, { name: (file as PickedFile).name.replace(/\.[^.]+$/, '') });
    const { files } = context;
    if (now.kind === 'xlsx') {
      const cells = rows.map(({ number: n, why }) => [...(byNumber.get(n) ?? []).map(sheetCellOf), why]);
      const bytes = await files.xlsxOf({ name: base, columns: headers, rows: cells });
      files.saveFile(doc, `${base}.xlsx`, new Blob([bytes as BlobPart], { type: files.xlsxType }));
    } else {
      const lines = [headers, ...rows.map(({ number: n, why }) => [...(byNumber.get(n) ?? []).map(cellWords), why])];
      files.saveFile(doc, `${base}.csv`, new Blob([files.csvOf(lines, now.separator ?? files.csvSeparator(locale))], { type: 'text/csv;charset=utf-8' }));
    }
  }

  function showChecked() {
    turn++;
    const rows = checked as CheckedRow[];
    const ready = rows.filter((row) => !row.problems.length);
    const refused = rows.filter((row) => row.problems.length);
    const parts: Node[] = [];
    if (ready.length) parts.push(make('p', { class: 'fd-import-ready' }, plural(ready.length, labels.importReady, labels.importReadyOne)));
    else parts.push(make('p', { class: 'fd-import-ready', 'data-none': '' }, labels.importNone));
    if (refused.length) {
      const download = make('button', { type: 'button', class: 'fd-button fd-button-link fd-import-download' }, labels.importDownload);
      download.addEventListener('click', () => void downloadFix(refused.map((row) => ({ number: row.number, why: row.problems.join('; ') }))));
      parts.push(
        make(
          'div',
          { class: 'fd-import-refused' },
          make('p', {}, plural(refused.length, labels.importRefused, labels.importRefusedOne)),
          make('ul', {}, ...refused.slice(0, NAMED).map((row) => make('li', {}, fill(labels.importRow, { n: number(row.number), why: row.problems.join('; ') })))),
          ...(refused.length > NAMED ? [make('p', {}, plural(refused.length - NAMED, labels.importMore, labels.importMoreOne))] : []),
          download
        )
      );
    }
    if (ready.length) {
      // The first rows as they will be saved: the fields filled, each value as the page writes it.
      const shown = [...new Set(columns.filter((field): field is string => !!field))];
      const preview = make(
        'table',
        { class: 'fd-import-preview' },
        make('thead', {}, make('tr', {}, ...shown.map((field) => make('th', { scope: 'col' }, page.fields[field].label)))),
        make('tbody', {}, ...ready.slice(0, PREVIEW).map((row) => make('tr', {}, ...shown.map((field) => make('td', {}, make('bdi', {}, words(field, row.values[field], row.values)))))))
      );
      parts.push(make('h3', { class: 'fd-import-heading' }, labels.importPreview), make('div', { class: 'fd-import-scroll' }, preview));
    }
    body.replaceChildren(...parts);
    steps({ back: () => showMatch(), ...(ready.length ? { primary: { words: plural(ready.length, sentence(labels.importStartNoun, labels.importStart), sentence(labels.importStartNounOne, labels.importStartOne)), act: () => void write(ready, refused) } } : {}) });
    (ready.length ? primary : back).focus();
  }

  /** A cell's first value as the page writes such a value: a day as its days are written, yes or no in words; a number as it is (a phone kept as one is no amount). */
  function shownWords(cell: FileCell): string {
    if (typeof cell === 'boolean') return cell ? labels.yes : labels.no;
    if (cell !== null && typeof cell === 'object') {
      const [day, time] = cell.at.split('T');
      const written = displayValue({ type: 'date', label: '' } as LineField, day, {}, locale);
      return time ? `${written} ${time.slice(0, 5)}` : written;
    }
    return cellWords(cell);
  }

  /** A value as the page writes it: yes or no in words. */
  const words = (field: string, value: Value | undefined, values: Record<string, Value>) => {
    const def = page.fields[field];
    if (def.type === 'boolean' && typeof value === 'boolean') return value ? labels.yes : labels.no;
    return displayValue(def as LineField, value, values, locale);
  };

  // ---- 4. the rows written ------------------------------------------------------------------------------------------------
  async function write(ready: CheckedRow[], refused: CheckedRow[]) {
    if (!canWrite(context.dataSource)) return;
    turn++;
    writing = true;
    stopping = false;
    close.hidden = true;
    const bar = make('progress', { class: 'fd-import-progress', max: String(ready.length), value: '0', 'aria-labelledby': title.id });
    body.replaceChildren(make('div', { class: 'fd-import-writing' }, bar));
    steps({});
    stop.hidden = false;
    stop.onclick = () => {
      stopping = true;
      stop.setAttribute('aria-busy', 'true');
    };
    stop.focus();
    const how = { model: context.model, fields: page.fields, dataSource: context.dataSource, notMade: sentence(labels.importNotMadeNoun, labels.importNotMade) };
    let written: Written;
    try {
      written = await writeRows(how, ready, (at, of) => {
        bar.value = at;
        status.textContent = fill(labels.importing, { done: number(at), n: number(of) });
      }, () => stopping);
    } catch {
      written = { made: [], failed: ready.map((row) => ({ number: row.number, why: failedWords })), stopped: false };
    }
    writing = false;
    stop.removeAttribute('aria-busy');
    const notImported = [...refused.map((row) => ({ number: row.number, why: row.problems.join('; ') })), ...written.failed].sort((a, b) => a.number - b.number);
    finish({
      made: written.made,
      notImported,
      stopped: written.stopped,
      total: (checked as CheckedRow[]).length,
      downloadFix,
      ...(context.dataSource.delete ? { undo: (ids: readonly RecordId[], progress: (done: number, total: number) => void) => deleteRecords(how, ids, progress) } : {}),
    });
  }

  showPick();
  return done;
}

