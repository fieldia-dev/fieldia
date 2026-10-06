import { wideColumns, type ColumnCount, type HelpShown, type LabelPlace, type Page, type SectionNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { across, colsOf, isSection, isWrapper, locate, nameOf, nodeOf, onTracks, sharesOneCell, spanOf, type Part } from './layout-tree';
import { inTwelfths, isGroup, keepsFull, percent, rowParts, rowShare, TWELVE, widthsFor } from './layout-twelfths';
import { segmented, setting, type Choice } from './panel-controls';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * The Layout tab's settings: a group's columns on a desktop, a tablet and a
 * phone — one to four, or twelfths, each row divided its own way, and then
 * whether its rows stay full; how wide a part is where it sits (in twelfths, a
 * fraction of its row); where labels sit, and how wide they are when they sit
 * beside their boxes.
 */

export interface LayoutSetting {
  /** Its rows, on the Layout tab. */
  rows: HTMLElement[];
  update(page: Page): void;
}

const SCREENS = ['wide', 'medium', 'narrow'] as const;

const COUNTS: ColumnCount[] = [1, 2, 3, 4, TWELVE];
/** “Auto”: a count left out, which the skin stacks as it does by itself. */
const AUTO = 0;

/** A group's columns, on each size of screen: a tablet or a phone never more than a desktop, a phone never more than a tablet. */
export function columnsSetting(el: ElementFactory, designer: Designer, id: string, words = designer.words.panel.columnsInside): LayoutSetting {
  const w = designer.words.panel;
  const read = (): { wide: ColumnCount; medium?: ColumnCount; narrow?: ColumnCount } => {
    const section = nodeOf(designer.getPage(), id) as SectionNode | null;
    const columns = section?.columns;
    return typeof columns === 'object' ? { ...columns } : { wide: wideColumns(columns) };
  };
  const choose = (screen: 'wide' | 'medium' | 'narrow', count: number | null) => {
    const now = read();
    const n = (count || undefined) as ColumnCount | undefined;
    if (screen === 'wide') {
      if (n) designer.setColumns(id, n);
      return;
    }
    if (screen === 'medium') {
      // A tablet's fewer columns take the phone's down with them.
      const narrow = now.narrow && n ? (Math.min(now.narrow, n) as ColumnCount) : now.narrow;
      designer.setColumns(id, { wide: now.wide, medium: n, narrow });
    } else designer.setColumns(id, { wide: now.wide, medium: now.medium, narrow: n });
  };
  const segs = SCREENS.map((screen) => {
    const choices: Choice<number>[] = [
      ...(screen === 'wide' ? [] : [{ value: AUTO, words: w.auto, title: w.autoTitle }]),
      ...COUNTS.map((n) => (n === TWELVE ? { value: n, words: w.twelfths, title: w.twelfthsTitle } : { value: n, words: String(n), label: w.columnCount(n) })),
    ];
    return segmented(el, w.columnsOn[screen], choices, (value) => value !== null && choose(screen, value));
  });
  const screens = el(
    'div',
    { class: 'fd-insp-screens' },
    ...SCREENS.map((screen, i) => el('div', { class: 'fd-insp-screen' }, el('span', { class: 'fd-insp-screen-name' }, w.screens[screen]), segs[i].element))
  );
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const row = setting(el, 'layout', 'Columns', screens, { hint, words });
  return {
    rows: [row],
    update(page) {
      const section = nodeOf(page, id);
      if (!isSection(section)) return;
      // On the columns of the group round it, or sharing one of them: it has no columns of its own to set.
      const around = locate(page, id)?.parent;
      const aroundName = around ? nameOf(page, around, designer.words) : '';
      const tracks = onTracks(page, section);
      const shared = !tracks && isWrapper(section) && sharesOneCell(section) && isSection(around) && colsOf(page, around) > 1;
      screens.hidden = tracks || shared;
      if (tracks) hint.textContent = w.onTracks(colsOf(page, section), aroundName);
      else if (shared) hint.textContent = w.sharedColumn(section.children.length, aroundName);
      else if (inTwelfths(section)) hint.textContent = w.twelfthsHint;
      else hint.textContent = w.columnsHint;
      const columns = section.columns;
      const counts = typeof columns === 'object' ? columns : { wide: wideColumns(columns), medium: undefined, narrow: undefined };
      segs[0].set(counts.wide);
      segs[1].set(counts.medium ?? AUTO);
      segs[2].set(counts.narrow ?? AUTO);
      // Twelfths for a group only; in twelfths, a smaller screen keeps them, or stacks.
      const twelfths = counts.wide === TWELVE;
      segs[0].only((n) => n !== TWELVE || isGroup(section));
      segs[1].only((n) => (twelfths ? n <= 1 || n === TWELVE : n <= counts.wide && n !== TWELVE));
      segs[2].only((n) => (twelfths ? n <= 1 || n === TWELVE : n <= counts.wide && n !== TWELVE) && n <= (counts.medium ?? counts.wide));
    },
  };
}

/** In twelfths, whether a group's rows stay full as parts come and go, or may leave gaps. */
export function rowsSetting(el: ElementFactory, designer: Designer, id: string): LayoutSetting {
  const w = designer.words.panel;
  const seg = segmented<string>(
    el,
    w.rows,
    [
      { value: 'full', words: w.keepRowsFull },
      { value: 'gaps', words: w.allowGaps },
    ],
    (value) => value && designer.setSectionLook(id, { rows: value as 'full' | 'gaps' })
  );
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const row = setting(el, 'layout', 'Rows', seg.element, { hint, words: w.rows });
  return {
    rows: [row],
    update(page) {
      const section = nodeOf(page, id);
      row.hidden = !inTwelfths(section);
      if (!isSection(section)) return;
      seg.set(section.rows ?? 'full');
      hint.textContent = keepsFull(section) ? w.rowsFullHint : w.gapsHint;
    },
  };
}

/** The parts beside one, in words: by name when one or two, else how many. */
function othersOf(page: Page, list: Part[], id: string, words: DesignerWords): string {
  const others = list.filter((p) => p.id !== id);
  return words.panel.others(others.map((p) => words.parts.quote(nameOf(page, p, words))), others.length);
}

/** How many columns a part spans where it sits, or why it takes the whole row. */
export function widthSetting(el: ElementFactory, designer: Designer, id: string): LayoutSetting {
  const words = designer.words;
  const w = words.panel;
  /** What the choices are drawn for: a grid's columns, or twelfths and a width none of the fractions is. */
  let drawn = '';
  const box = el('div', { class: 'fd-insp-width' });
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const row = setting(el, 'layout', 'Width', box, { hint, words: w.width });
  let seg: ReturnType<typeof segmented<number>> | null = null;
  return {
    rows: [row],
    update(page) {
      const at = locate(page, id);
      if (!at) return;
      const parent = at.parent;
      if (inTwelfths(parent)) return twelfths(page, parent, at.node);
      const cols = across(page, at.parent);
      if (String(cols) !== drawn) {
        drawn = String(cols);
        seg = cols > 1 ? segmented(el, w.width, Array.from({ length: cols }, (_, i) => ({ value: i + 1, words: i + 1 === cols ? w.all(cols) : String(i + 1), label: i + 1 === cols ? w.allColumns(cols) : w.columnCount(i + 1) })), (n) => n !== null && designer.setColspan(id, n)) : null;
        box.replaceChildren(...(seg ? [seg.element] : []));
      }
      const span = Math.min((at.node as { colspan?: number }).colspan ?? 1, cols);
      seg?.set(span);
      if (cols > 1) hint.textContent = isWrapper(parent) ? w.sharesWith(span, cols, othersOf(page, parent.children, id, words)) : w.ofColumnsOf(span, cols, nameOf(page, parent, words));
      else if (isSection(parent)) hint.textContent = w.oneColumnFull(nameOf(page, parent, words));
      else hint.textContent = w.fullWidthOn(parent.type === 'tab');
    },
  };

  /** In twelfths: fractions of its row — those that leave the rest of it room where the row stays full — and its own width when none of them. */
  function twelfths(page: Page, group: SectionNode, part: Part) {
    const span = Math.min(spanOf(part), TWELVE);
    const odd = rowParts(words).some((p) => p.span === span) ? 0 : span;
    if (`t${odd}` !== drawn) {
      drawn = `t${odd}`;
      const choices: Choice<number>[] = rowParts(words).map((p) => ({ value: p.span, words: p.words, label: p.label }));
      if (odd) choices.push({ value: odd, words: w.percent(percent(odd)), label: w.percentOfRow(percent(odd)) });
      seg = segmented(el, w.width, choices, (n) => n !== null && designer.setColspan(id, n));
      box.replaceChildren(seg.element);
    }
    const fits = widthsFor(page, group, part);
    seg?.set(span);
    seg?.only((n) => n === span || fits(n));
    const name = words.parts.quote(nameOf(page, group, words));
    // Nothing narrower fits beside the rest of its row: it is alone in it.
    const alone = keepsFull(group) && !fits(1);
    hint.textContent = alone ? w.aloneFills(name) : w.shareIn(rowShare(span, TWELVE, words), name, keepsFull(group));
  }
}

/** Where the labels round a part sit, as a group or the page says: the nearest that says. */
function labelsAround(page: Page, id: string): { place?: LabelPlace; width?: number; group: boolean } {
  let group = false;
  let place: LabelPlace | undefined;
  let width: number | undefined;
  for (let at = locate(page, id)?.parent; at && at.id !== page.layout.id; at = locate(page, at.id)?.parent) {
    if (!isSection(at)) continue;
    group ||= !isWrapper(at);
    place ??= at.labels;
    width ??= at.labelWidth;
  }
  return { place: place ?? page.look?.labels, width: width ?? page.look?.labelWidth, group };
}

/** What “as round it” is, in words: as its group says, or as the page does. */
export const aroundWords = (page: Page, id: string, words: DesignerWords = en): string => (labelsAround(page, id).group ? words.panel.asGroup : words.panel.asPage);

/** Where labels may sit, in the designer's words. */
const placesIn = (w: DesignerWords['panel']): Choice<string>[] => [
  { value: 'above', words: w.above, title: w.aboveTitle },
  { value: 'beside', words: w.beside, title: w.besideTitle },
  { value: 'hidden', words: w.inBox, title: w.inBoxTitle },
];
/** Where the labels round it say: no setting of its own. */
const AROUND = 'around';

/** Where a group's labels sit, or one field's; and, for a group whose labels sit beside, how wide they are. */
export function labelsSetting(el: ElementFactory, designer: Designer, id: string, what: 'group' | 'field'): LayoutSetting {
  const w = designer.words.panel;
  const place = segmented<string>(el, w.labels, [{ value: AROUND, words: w.asGroup }, ...placesIn(w)], (value) => {
    const chosen = value === AROUND || value === null ? null : (value as LabelPlace);
    if (what === 'field') designer.setFieldLabels(id, chosen);
    else designer.setSectionLook(id, { labels: chosen });
  });
  const notSet = place.element.querySelector('[data-choice="around"] .fd-seg-words') as HTMLElement;
  const rows = [setting(el, 'layout', 'Labels', place.element, what === 'field' ? { words: w.label, hint: w.labelInBox } : { words: w.labelsInside })];
  if (what === 'field') {
    // Where its help shows: as the page has it, or its own way.
    const help = segmented<string>(
      el,
      w.help,
      [{ value: AROUND, words: w.asPage }, ...(['below', 'tooltip', 'both'] as const).map((value) => ({ value, words: w.helpWays[value] }))],
      (value) => designer.setFieldHelpShown(id, value === AROUND || value === null ? null : (value as HelpShown))
    );
    const helpRow = setting(el, 'layout', 'Help', help.element, { words: w.help });
    return {
      rows: [...rows, helpRow],
      update(page) {
        const node = locate(page, id)?.node as { labels?: LabelPlace; helpShown?: HelpShown; help?: string; field?: string } | undefined;
        if (!node) return;
        notSet.textContent = aroundWords(page, id, designer.words);
        place.set(node.labels ?? AROUND);
        // Only a field with help has anywhere to show it.
        helpRow.hidden = !(node.help || (node.field && page.fields[node.field]?.help));
        help.set(node.helpShown ?? AROUND);
      },
    };
  }
  const slider = el('input', { type: 'range', class: 'fd-insp-slider', min: '60', max: '320', step: '10', 'aria-label': w.labelWidth });
  const number = el('input', { type: 'number', class: 'fd-input fd-insp-number', min: '60', max: '320', step: '1', 'aria-label': w.labelWidth });
  const width = (value: string) => {
    const n = Number(value);
    // Only a width it can keep: one being typed on its way to one is left alone.
    if (Number.isInteger(n) && n >= 60 && n <= 320) designer.setSectionLook(id, { labelWidth: n });
  };
  slider.addEventListener('input', () => width(slider.value));
  number.addEventListener('input', () => width(number.value));
  const widthRow = setting(el, 'layout', 'Label width', [el('div', { class: 'fd-insp-range' }, slider, number, el('span', { class: 'fd-insp-unit' }, w.px))], { words: w.labelWidth });
  return {
    rows: [...rows, widthRow],
    update(page) {
      const section = nodeOf(page, id);
      if (!isSection(section)) return;
      const around = labelsAround(page, id);
      notSet.textContent = around.group ? w.asGroup : w.asPage;
      place.set(section.labels ?? AROUND);
      widthRow.hidden = (section.labels ?? around.place) !== 'beside';
      const value = String(section.labelWidth ?? around.width ?? 140);
      if (number.ownerDocument.activeElement !== number) number.value = value;
      if (number.ownerDocument.activeElement !== slider) slider.value = value;
    },
  };
}
