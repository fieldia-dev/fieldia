import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import type { Designer } from './designer';
import { kindOfField } from './kinds';
import { kindSettings } from './kind-settings';
import { inputSettings } from './kind-settings-inputs';
import { structureSettings } from './kind-settings-structures';
import type { DesignerWords } from './designer-words';

/**
 * What a kind of field has beyond its words, set in the picked field itself,
 * where it is seen: a rating's levels, where a scale starts and ends, an
 * amount's currency, what a link points to, a table's columns — and the
 * newer kinds' own, from `kind-settings`, and the structures', from
 * `kind-settings-structures`. A field of the model keeps the
 * model's, so it has none here. The panel has the same.
 */

export interface InlineSettings {
  element: HTMLElement;
  /** Draw for the field as it is now; true when the settings stand in for its widget, as a table's columns do. */
  update(page: Page, node: FieldNode): boolean;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** Kinds of file, as people name them, and the media types each takes. */
const FILE_TYPES: [keyof DesignerWords['questions']['fileTypes'], string[]][] = [
  ['images', ['image/*']],
  ['pdf', ['application/pdf']],
  ['documents', ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'text/plain']],
  ['spreadsheets', ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv']],
  ['presentations', ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation']],
  ['video', ['video/*']],
  ['audio', ['audio/*']],
];
/** The largest file, in bytes, and in words. */
const FILE_SIZES = [1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 * 1024 * 1024];

export function inlineSettings(el: ElementFactory, designer: Designer, id: string): InlineSettings {
  const w = designer.words.questions;
  const element = el('div', { class: 'fd-inline-settings', hidden: '' });
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const select = (label: string, values: string[]) => el('select', { class: 'fd-inline-select', 'aria-label': label }, ...values.map((v) => el('option', { value: v }, v))) as HTMLSelectElement;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  let drawn = '';
  let refresh: (page: Page, node: FieldNode) => void = () => undefined;
  let standsIn = false;

  function build(kind: string | null) {
    standsIn = false;
    refresh = () => undefined;
    if (kind === 'rating') {
      const levels = select(w.levels, range(3, 10));
      levels.addEventListener('change', () => designer.setRange(id, { min: 1, max: Number(levels.value) }));
      element.replaceChildren(word(w.levels, levels));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        levels.value = String('max' in def && def.max !== undefined ? def.max : 5);
      };
    } else if (kind === 'scale') {
      const from = select(w.from, ['0', '1']);
      const to = select(w.toLabel, range(2, 10));
      const save = () => designer.setRange(id, { min: Number(from.value), max: Number(to.value) });
      from.addEventListener('change', save);
      to.addEventListener('change', save);
      // Words at either end, each typed beside its number, as Google Forms has them.
      const end = (which: 'start' | 'end') => {
        const number = el('span', { class: 'fd-inline-end-number' });
        const words = el('input', { class: 'fd-inline-input fd-inline-end-words', 'aria-label': w.wordsAt(which), placeholder: w.labelOptional, autocomplete: 'off' }) as HTMLInputElement;
        words.addEventListener('input', () => designer.setWidgetOptions(id, { [`${which}Label`]: words.value }));
        return { element: el('label', { class: 'fd-inline-end' }, number, words), number, words };
      };
      const start = end('start');
      const finish = end('end');
      element.replaceChildren(el('div', { class: 'fd-inline-row' }, word(w.from, from), word(w.to, to)), start.element, finish.element);
      refresh = (page, node) => {
        const def = page.fields[node.field];
        const min = 'min' in def && def.min !== undefined ? def.min : 0;
        const max = 'max' in def && def.max !== undefined ? def.max : 10;
        from.value = String(min);
        to.value = String(max);
        start.number.textContent = String(min);
        finish.number.textContent = String(max);
        if (!focused(start.words)) start.words.value = String(node.options?.['startLabel'] ?? '');
        if (!focused(finish.words)) finish.words.value = String(node.options?.['endLabel'] ?? '');
      };
    } else if (kind === 'amount') {
      const currency = el('input', { class: 'fd-inline-input fd-inline-currency', 'aria-label': w.currency, maxlength: '3', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      // Three letters make a currency; until then nothing is saved.
      currency.addEventListener('input', () => /^[A-Za-z]{3}$/.test(currency.value.trim()) && designer.setCurrency(id, currency.value));
      element.replaceChildren(word(w.currency, currency));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        if (!focused(currency)) currency.value = def.type === 'monetary' ? (def.currency ?? '') : '';
      };
    } else if (kind === 'link' || kind === 'links') {
      const target = el('input', { class: 'fd-inline-input', 'aria-label': w.linksTo, placeholder: 'contact', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      target.addEventListener('input', () => target.value.trim() && designer.setRelation(id, target.value));
      element.replaceChildren(word(w.linksTo, target));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        if (!focused(target)) target.value = 'relation' in def ? def.relation : '';
      };
    } else if (kind === 'file' || kind === 'image') {
      // Which kinds of file it takes — none picked, any; an image takes images — and the largest.
      const types = FILE_TYPES.map(([label, accept]) => {
        const button = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false' }, w.fileTypes[label]) as HTMLButtonElement;
        button.addEventListener('click', () => {
          const on = new Set(current());
          const all = accept.every((a) => on.has(a));
          for (const a of accept) {
            if (all) on.delete(a);
            else on.add(a);
          }
          designer.setFileRules(id, { accept: FILE_TYPES.flatMap(([, list]) => list).filter((a) => on.has(a)) });
        });
        return { button, accept };
      });
      let current: () => string[] = () => [];
      const largest = select(w.largestFile, ['', ...FILE_SIZES.map(String)]);
      [w.anySize, ...FILE_SIZES.map(w.size)].forEach((words, i) => (largest.options[i].textContent = words));
      // A size the page set that is none of these is shown as it is.
      const own = el('option', { hidden: '' }) as HTMLOptionElement;
      largest.append(own);
      largest.addEventListener('change', () => designer.setFileRules(id, { maxSize: largest.value ? Number(largest.value) : null }));
      // Several files, as few and as many as it takes: a box left empty is no limit. Saved once typed and left.
      const several = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': w.severalFiles }) as HTMLButtonElement;
      several.addEventListener('click', () => designer.setFileRules(id, { multiple: several.getAttribute('aria-checked') !== 'true' }));
      const count = (label: string, key: 'minFiles' | 'maxFiles') => {
        const box = el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': label, min: key === 'minFiles' ? '0' : '1', step: '1', inputmode: 'numeric', placeholder: w.any }) as HTMLInputElement;
        box.addEventListener('change', () => designer.setFileRules(id, { [key]: box.value.trim() === '' ? null : Number(box.value) }));
        return box;
      };
      const least = count(w.atLeast, 'minFiles');
      const most = count(w.atMost, 'maxFiles');
      // Each box with its word for what it counts, so the two never part on a narrow card.
      const files = (text: string, box: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), box, el('span', {}, w.files));
      const counts = el('div', { class: 'fd-inline-row' }, files(w.atLeast, least), files(w.atMost, most));
      // How the chosen files show: as a list, or as thumbnails; what the kind shows anyway is kept as nothing.
      let shownAs = 'list';
      let usual = 'list';
      const asChip = (value: string, words: string) => {
        const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false', 'data-choice': value }, words) as HTMLButtonElement;
        chip.addEventListener('click', () => value !== shownAs && designer.setWidgetOptions(id, { files: value === usual ? null : value }));
        return chip;
      };
      const asChips = [asChip('list', w.list), asChip('thumbnails', w.thumbnails)];
      // A phone's camera, for an image: the rear one, or the front.
      const camera = select(w.cameraOnPhones, ['', 'environment', 'user']);
      [w.no, w.rearCamera, w.frontCamera].forEach((words, i) => (camera.options[i].textContent = words));
      camera.addEventListener('change', () => designer.setWidgetOptions(id, { camera: camera.value === 'user' ? 'user' : camera.value ? true : null }));
      element.replaceChildren(
        ...(kind === 'file' ? [el('div', { class: 'fd-inline-row' }, el('span', {}, w.takesOnly), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.kindsOfFile }, ...types.map((t) => t.button)))] : []),
        el('div', { class: 'fd-inline-row' }, word(w.largestFile, largest), el('span', { class: 'fd-inline-setting fd-inline-toggle' }, several, el('span', { 'aria-hidden': 'true' }, w.severalFiles))),
        counts,
        el('div', { class: 'fd-inline-row' }, el('span', {}, w.showFilesAs), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.showFilesAs }, ...asChips)),
        ...(kind === 'image' ? [word(w.cameraOnPhones, camera)] : [])
      );
      refresh = (page, node) => {
        const def = page.fields[node.field];
        if (def.type !== 'binary' && def.type !== 'image') return;
        const accept = def.type === 'binary' ? (def.accept ?? []) : [];
        current = () => accept;
        for (const t of types) t.button.setAttribute('aria-pressed', String(t.accept.every((a) => accept.includes(a))));
        own.hidden = !def.maxSize || FILE_SIZES.includes(def.maxSize);
        own.value = String(def.maxSize ?? '');
        own.textContent = def.maxSize ? w.size(def.maxSize) : '';
        largest.value = String(def.maxSize ?? '');
        several.setAttribute('aria-checked', String(def.multiple === true));
        counts.hidden = def.multiple !== true;
        if (!focused(least)) least.value = def.minFiles === undefined ? '' : String(def.minFiles);
        if (!focused(most)) most.value = def.maxFiles === undefined ? '' : String(def.maxFiles);
        usual = def.type === 'image' ? 'thumbnails' : 'list';
        shownAs = String(node.options?.['files'] ?? usual);
        for (const chip of asChips) chip.setAttribute('aria-pressed', String(chip.dataset['choice'] === shownAs));
        const facing = node.options?.['camera'];
        camera.value = facing ? (facing === 'user' ? 'user' : 'environment') : '';
      };
    } else if (kind === 'lines') {
      const columns = columnsEditor(el, designer, id);
      element.replaceChildren(columns.element);
      standsIn = true;
      refresh = (page, node) => columns.update(page.fields[node.field]);
    } else {
      // The newer kinds, and the choices' Shuffle and points.
      const more = kindSettings(el, designer, id, kind);
      element.replaceChildren(...(more?.elements ?? []));
      standsIn = more?.standsIn ?? false;
      if (more) refresh = more.refresh;
    }
    // The text, number and date kinds' own, then the structures', after the rest of their kind's.
    const inputs = inputSettings(el, designer, id, kind);
    const structures = structureSettings(el, designer, id, kind);
    if (!inputs && !structures.length) return;
    element.append(...(inputs?.elements ?? []), ...structures.map((p) => p.element));
    const before = refresh;
    refresh = (page, node) => (before(page, node), inputs?.refresh(page, node), structures.forEach((p) => p.refresh(page, node)));
  }

  return {
    element,
    update(page, node) {
      const def = page.fields[node.field];
      const kind = designer.isFromModel(id) ? null : kindOfField(def, node);
      if ((kind ?? '') !== drawn) {
        drawn = kind ?? '';
        build(kind);
      }
      element.hidden = !element.childElementCount;
      refresh(page, node);
      return standsIn && !element.hidden;
    },
  };
}
