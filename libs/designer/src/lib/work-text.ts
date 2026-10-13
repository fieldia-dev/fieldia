import { wideColumns, type FieldNode, type JsonValue, type Page, type SectionNode } from '@fieldia/core';
import { ICONS, TEXT_TOOLS, type TextTool } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { isSection, nodeOf } from './layout-tree';
import { segmented, setting } from './panel-controls';
import { Refusal } from './refusal';

/**
 * A work item's body in the designer: a group's own column widths and gap,
 * its fold control at its heading's end and its ⤢ (Layout tab); help in a
 * light box with an icon (Content tab); a formatted text's toolbar, tools,
 * editors and the records linked in it, and a links box's Add link, help and
 * empty link, among the field's own settings.
 */

/** A column's width as the page keeps it: pixels, a share of the row, or of what is left. */
const TRACK = /^\d+(\.\d+)?(px|%|fr)$/;

export interface WorkLook {
  tracks?: string[] | null;
  gap?: number | null;
  foldAt?: 'start' | 'end' | null;
  maximise?: boolean | null;
}

/** A group's widths, gap, fold control and ⤢, checked against the group before they are set. */
export function checkWorkLook(section: SectionNode, look: WorkLook): void {
  if (look.tracks) {
    const bad = look.tracks.find((track) => !TRACK.test(track));
    if (bad !== undefined) throw new Refusal((w) => w.workText.noWidth(bad));
    const columns = wideColumns(section.columns);
    if (look.tracks.length !== columns) throw new Refusal((w) => w.workText.tracksCount(columns, look.tracks?.length ?? 0));
  }
  if (look.gap !== undefined && look.gap !== null && !(Number.isInteger(look.gap) && look.gap >= 0 && look.gap <= 48)) throw new Refusal((w) => w.workText.gapRange);
  if (look.foldAt === 'end' && !section.collapsible) throw new Refusal((w) => w.workText.foldNeedsFolding);
  if (look.maximise && !section.title) throw new Refusal((w) => w.workText.maximiseNeedsTitle);
}

/** Widths typed apart by spaces, as the page keeps them: none for even columns. */
export const tracksFrom = (typed: string): string[] | null => {
  const tracks = typed.trim().split(/[\s,]+/).filter(Boolean);
  return tracks.length ? tracks : null;
};

export interface WorkRows {
  rows: HTMLElement[];
  update(page: Page): void;
}

/** A group's own column widths and the gap between them; for a titled group, its fold control's place and its ⤢. */
export function workGroupSetting(el: ElementFactory, designer: Designer, id: string, titled: boolean): WorkRows {
  const w = designer.words.workText;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const widths = el('input', { class: 'fd-input', 'aria-label': w.columnWidths, placeholder: '50% 1fr 1fr', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  // Kept once typed and left: "50% 1f" is no width yet.
  widths.addEventListener('change', () => designer.setSectionLook(id, { tracks: tracksFrom(widths.value) }));
  const gap = el('input', { type: 'number', class: 'fd-input fd-insp-number', min: '0', max: '48', step: '1', 'aria-label': w.gap }) as HTMLInputElement;
  gap.addEventListener('change', () => designer.setSectionLook(id, { gap: gap.value.trim() === '' ? null : Number(gap.value) }));
  const widthRow = setting(el, 'layout', 'Column widths', widths, { words: w.columnWidths, hint: w.columnWidthsHint });
  const gapRow = setting(el, 'layout', 'Gap between columns', [gap, el('span', { class: 'fd-insp-unit' }, designer.words.panel.px)], { words: w.gap, hint: w.gapHint });
  const fold = segmented<string>(
    el,
    w.foldControl,
    [
      { value: 'start', words: w.beforeTitle },
      { value: 'end', words: w.atHeadingEnd },
    ],
    (value) => value && designer.setSectionLook(id, { foldAt: value === 'end' ? 'end' : null })
  );
  const foldRow = setting(el, 'layout', 'Fold control', fold.element, { words: w.foldControl });
  const big = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': w.maximise }) as HTMLButtonElement;
  big.addEventListener('click', () => designer.setSectionLook(id, { maximise: big.getAttribute('aria-checked') === 'true' ? null : true }));
  const bigRow = setting(el, 'layout', 'Maximise', big, { words: w.maximise, hint: w.maximiseHint });
  return {
    rows: titled ? [widthRow, gapRow, foldRow, bigRow] : [widthRow, gapRow],
    update(page) {
      const section = nodeOf(page, id);
      if (!isSection(section)) return;
      // Widths for a group of columns only: one column has nothing to share.
      widthRow.hidden = wideColumns(section.columns) < 2 && !section.tracks;
      gapRow.hidden = widthRow.hidden && section.gap === undefined;
      if (!focused(widths)) widths.value = (section.tracks ?? []).join(' ');
      if (!focused(gap)) gap.value = section.gap === undefined ? '' : String(section.gap);
      foldRow.hidden = !section.collapsible;
      fold.set(section.foldAt ?? 'start');
      bigRow.hidden = !section.title;
      big.setAttribute('aria-checked', String(section.maximise === true));
    },
  };
}

/** The icons a help box may have: Fieldia's own, by name. */
export const iconNames = () => Object.keys(ICONS).sort();

/** A help box's icon, by name; none leaves room for one all the same. */
export function helpIconSetting(el: ElementFactory, designer: Designer, id: string): WorkRows {
  const w = designer.words.workText;
  const pick = el('select', { class: 'fd-input', 'aria-label': w.icon }, el('option', { value: '' }, w.noIcon), ...iconNames().map((name) => el('option', { value: name }, name))) as HTMLSelectElement;
  pick.addEventListener('change', () => designer.updateBlock(id, { icon: pick.value }));
  const row = setting(el, 'content', 'Icon', pick, { words: w.icon });
  return {
    rows: [row],
    update(page) {
      const node = nodeOf(page, id) as { type?: string; style?: string; icon?: string } | null;
      row.hidden = node?.type !== 'text' || node.style !== 'help';
      pick.value = node?.icon ?? '';
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A field's own settings: a formatted text's, a links box's.

export interface WorkPart {
  element: HTMLElement;
  refresh(page: Page, node: FieldNode): void;
}

type Widget = (patch: Record<string, JsonValue | null>) => void;

const record = (value: unknown): Record<string, JsonValue> | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, JsonValue>) : null);

/**
 * A formatted text's toolbar — always, or while it is worked in — at its top
 * or foot, its tools, its editor and the switch between editors, the
 * people @mentioned in it and the records linked by a key.
 */
export function richTextPart(el: ElementFactory, designer: Designer, id: string): WorkPart {
  const w = designer.words.workText;
  const widget: Widget = (patch) => designer.setWidgetOptions(id, patch);
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const choice = <T extends string>(label: string, choices: [T, string][], pick: (value: T) => void) => {
    const seg = segmented<T>(el, label, choices.map(([value, words]) => ({ value, words })), (value) => value && pick(value));
    return { seg, element: el('div', { class: 'fd-inline-setting' }, el('span', {}, label), seg.element) };
  };
  const when = choice<'always' | 'focus'>(w.toolbarShown, [['always', w.always], ['focus', w.whileWorkedIn]], (value) => widget({ toolbar: value === 'always' ? null : value }));
  const where = choice<'top' | 'bottom'>(w.toolbarAt, [['top', w.atTop], ['bottom', w.atFoot]], (value) => widget({ toolbarAt: value }));
  const editor = choice<'rich' | 'markdown'>(w.editor, [['rich', w.richText], ['markdown', w.markdown]], (value) => widget({ editor: value === 'rich' ? null : value }));
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  const switching = toggle(w.switchEditor, (on) => widget({ switchEditor: on || null }));
  // Its tools, in the order a toolbar keeps them: each one on or off.
  let tools: TextTool[] | null = null;
  const toolChips = TEXT_TOOLS.map((tool) => {
    const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false', 'data-tool': tool }, tool) as HTMLButtonElement;
    chip.addEventListener('click', () => {
      const now = new Set(tools ?? []);
      if (now.has(tool)) now.delete(tool);
      else now.add(tool);
      const next = TEXT_TOOLS.filter((t) => now.has(t));
      widget({ tools: next.length ? next : null });
    });
    return chip;
  });
  const mention = el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': w.mentions, placeholder: w.mentionsPlaceholder, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  mention.addEventListener('change', () => widget({ mention: mention.value.trim() ? { model: mention.value.trim() } : null }));
  // The records linked by a key, one row each: its key, model and name.
  let references: { key: string; model: string; label: string; icon?: string }[] = [];
  const list = el('ul', { class: 'fd-inline-list fd-work-references' });
  const saveReferences = (next: typeof references) => widget({ references: next.length ? next : null });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.addReference);
  add.addEventListener('click', () => saveReferences([...references, { key: references.some((r) => r.key === '#') ? '!' : '#', model: 'record', label: 'Record' }]));
  const draw = () =>
    list.replaceChildren(
      ...references.map((reference, at) => {
        const box = (label: string, key: 'key' | 'model' | 'label', size: string) => {
          const input = el('input', { class: 'fd-inline-input', 'aria-label': `${label} ${at + 1}`, size, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
          input.value = reference[key];
          input.addEventListener('change', () => input.value.trim() && saveReferences(references.map((r, i) => (i === at ? { ...r, [key]: input.value.trim() } : r))));
          return input;
        };
        const remove = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': w.removeReference(reference.key) }, '×');
        remove.addEventListener('click', () => saveReferences(references.filter((_, i) => i !== at)));
        return el('li', { class: 'fd-inline-row' }, box(w.referenceKey, 'key', '2'), box(w.referenceModel, 'model', '14'), box(w.referenceLabel, 'label', '14'), remove);
      })
    );
  const barRow = el('div', { class: 'fd-inline-row' }, when.element, where.element);
  const element = el(
    'div',
    { class: 'fd-kind-block fd-work-text' },
    barRow,
    el('div', { class: 'fd-inline-row' }, editor.element, switching.element),
    el('div', { class: 'fd-inline-setting' }, el('span', {}, w.tools), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.tools }, ...toolChips)),
    el('div', { class: 'fd-inline-row' }, word(w.mentions, mention)),
    el('div', { class: 'fd-inline-setting' }, el('span', {}, w.references), list, add)
  );
  return {
    element,
    refresh(_page, node) {
      const options = node.options ?? {};
      const bar = options['toolbar'];
      // Its toolbar's own switch takes it away: then there is no toolbar to place.
      barRow.hidden = bar === false || bar === 'never';
      when.seg.set(bar === 'focus' ? 'focus' : 'always');
      where.seg.set(options['toolbarAt'] === 'top' || options['toolbarAt'] === 'bottom' ? options['toolbarAt'] : bar === 'focus' ? 'bottom' : 'top');
      editor.seg.set(options['editor'] === 'markdown' ? 'markdown' : 'rich');
      switching.button.setAttribute('aria-checked', String(options['switchEditor'] === true));
      tools = Array.isArray(options['tools']) ? (options['tools'].filter((t) => TEXT_TOOLS.includes(t as TextTool)) as TextTool[]) : null;
      for (const chip of toolChips) chip.setAttribute('aria-pressed', String(!!tools?.includes(chip.dataset['tool'] as TextTool)));
      if (mention.ownerDocument.activeElement !== mention) mention.value = String(record(options['mention'])?.['model'] ?? '');
      references = (Array.isArray(options['references']) ? options['references'] : []).flatMap((r) => {
        const one = record(r);
        return one && typeof one['key'] === 'string' && typeof one['model'] === 'string' && typeof one['label'] === 'string' ? [{ key: one['key'], model: one['model'], label: one['label'], ...(typeof one['icon'] === 'string' ? { icon: one['icon'] } : {}) }] : [];
      });
      if (!list.contains(list.ownerDocument.activeElement)) draw();
    },
  };
}

/** A many2many as tags or as a links box, and the box's Add link, its words, its help and icon, and its empty box's link. */
export function linksPart(el: ElementFactory, designer: Designer, id: string): WorkPart {
  const w = designer.words.workText;
  const widget: Widget = (patch) => designer.setWidgetOptions(id, patch);
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const shown = segmented<string>(
    el,
    w.shownAs,
    [
      { value: 'tags', words: w.tags },
      { value: 'links', words: w.linksBox },
    ],
    (value) => value && designer.setFieldWidget(id, value === 'links' ? 'links' : null)
  );
  const way = segmented<string>(
    el,
    w.addWay,
    [
      { value: 'search', words: w.addSearch },
      { value: 'menu', words: w.addMenu },
    ],
    (value) => value && widget({ add: value === 'search' ? null : value })
  );
  const text = (label: string, key: string) => {
    const input = el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, autocomplete: 'off' }) as HTMLInputElement;
    input.addEventListener('input', () => widget({ [key]: input.value.trim() ? input.value : null }));
    return input;
  };
  const words = text(w.addWords, 'addLabel');
  const help = el('textarea', { class: 'fd-inline-input', rows: '3', 'aria-label': w.helpWords }) as HTMLTextAreaElement;
  help.addEventListener('input', () => widget({ help: help.value.trim() ? help.value : null }));
  const icon = el('select', { class: 'fd-inline-select', 'aria-label': w.helpIcon }, el('option', { value: '' }, w.noIcon), ...iconNames().map((name) => el('option', { value: name }, name))) as HTMLSelectElement;
  icon.addEventListener('change', () => widget({ helpIcon: icon.value || null }));
  const empty = text(w.emptyLink, 'emptyLink');
  const word = (label: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, label), control);
  const box = el(
    'div',
    { class: 'fd-work-links' },
    el('div', { class: 'fd-inline-setting' }, el('span', {}, w.addWay), way.element),
    el('div', { class: 'fd-inline-row' }, word(w.addWords, words), word(w.emptyLink, empty)),
    el('div', { class: 'fd-inline-row' }, word(w.helpWords, help), word(w.helpIcon, icon))
  );
  const element = el('div', { class: 'fd-kind-block' }, el('div', { class: 'fd-inline-setting' }, el('span', {}, w.shownAs), shown.element), box);
  return {
    element,
    refresh(page, node) {
      const def = page.fields[node.field];
      element.hidden = def?.type !== 'many2many' || !!node.columns?.length;
      const links = node.widget === 'links';
      shown.set(links ? 'links' : 'tags');
      box.hidden = !links;
      const options = node.options ?? {};
      way.set(options['add'] === 'menu' ? 'menu' : 'search');
      const value = (key: string) => (typeof options[key] === 'string' ? (options[key] as string) : '');
      if (!focused(words)) words.value = value('addLabel');
      if (!focused(help)) help.value = value('help');
      icon.value = value('helpIcon');
      if (!focused(empty)) empty.value = value('emptyLink');
    },
  };
}
