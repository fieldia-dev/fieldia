import type { Field, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';

/**
 * The choice kinds' own settings, in the picked question and the side panel
 * alike: how the options are laid out, which stay in place when shuffled, a
 * dropdown that searches its list, tags of one's own, pictures' words, size
 * and fit, how many a ranking ranks, a matrix's answers per row, shuffled
 * rows and columns taken once, how a yes or no shows and its words, and
 * whether a status's steps can be picked.
 */

export interface ChoicePart {
  element: HTMLElement;
  standsIn: boolean;
  refresh(page: Page, node: FieldNode): void;
}

/** Kinds whose options may be shuffled, so may be kept in place. */
const SHUFFLED = new Set(['multiple-choice', 'checkboxes', 'dropdown', 'image-choice', 'ranking']);
/** Above this many options a dropdown searches its list unless told not to, as the viewer does. */
const LONG_LIST = 15;

const optionsOf = (field: Field) => (field.type === 'selection' ? field.options : []);

export function choiceSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): ChoicePart[] {
  const w = designer.words.questions;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const option = (node: FieldNode, key: string) => node.options?.[key];
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const select = (label: string, choices: [string, string][], onChange: (value: string) => void) => {
    const box = el('select', { class: 'fd-inline-select', 'aria-label': label }, ...choices.map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
    box.addEventListener('change', () => onChange(box.value));
    return box;
  };
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  const switchPart = (label: string, onClick: (on: boolean) => void, on: (page: Page, node: FieldNode) => boolean): ChoicePart => {
    const made = toggle(label, onClick);
    return { element: made.element, standsIn: false, refresh: (page, node) => made.button.setAttribute('aria-checked', String(on(page, node))) };
  };
  const widget = (patch: Record<string, string | number | boolean | null>) => designer.setWidgetOptions(id, patch);
  /** How many options the question has now. */
  const count = () => {
    const page = designer.getPage();
    const node = findNode(page, id)?.node;
    return node?.type === 'field' ? optionsOf(page.fields[node.field]).length : 0;
  };

  /** Columns or a row, as Jotform spreads options to columns; a phone stacks them again. */
  function layout(pictures: boolean): ChoicePart {
    const counts: [string, string][] = [['1', w.oneColumn], ['2', w.twoColumns], ['3', w.threeColumns], ['4', w.fourColumns]];
    const box = select(w.layOut, pictures ? [['', w.automatic], ...counts, ['row', w.allInARow]] : [['', w.inARow], ...counts], (value) =>
      widget({ columns: value === '' ? null : value === 'row' ? 'row' : Number(value) })
    );
    return {
      element: word(w.layOut, box),
      standsIn: false,
      refresh(_page, node) {
        const columns = option(node, 'columns');
        box.value = columns === undefined ? '' : String(columns);
      },
    };
  }

  /** Shuffled, which options keep their place: Tally's "Lock options in place". */
  function keepInPlace(): ChoicePart {
    const chips = el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.keptInPlace });
    const element = el('div', { class: 'fd-inline-row fd-kind-keep' }, el('span', {}, w.keepInPlace), chips);
    return {
      element,
      standsIn: false,
      refresh(page, node) {
        const options = optionsOf(page.fields[node.field]);
        element.hidden = option(node, 'shuffle') !== true;
        while (chips.children.length > options.length) chips.lastElementChild?.remove();
        while (chips.children.length < options.length) {
          const index = chips.children.length;
          const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false' }) as HTMLButtonElement;
          chip.addEventListener('click', () => designer.setOptionDetails(id, index, { fixed: chip.getAttribute('aria-pressed') !== 'true' }));
          chips.append(chip);
        }
        options.forEach((o, i) => {
          const chip = chips.children[i] as HTMLElement;
          chip.textContent = o.label;
          chip.setAttribute('aria-pressed', String(o.fixed === true));
        });
      },
    };
  }

  /** A dropdown that searches: on its own above 15 options, and set either way. */
  const searching = (page: Page, node: FieldNode) => {
    const asked = option(node, 'search');
    return asked === true || (asked !== false && optionsOf(page.fields[node.field]).length > LONG_LIST);
  };
  function search(): ChoicePart {
    return switchPart(
      w.searchTheList,
      // Only what differs from what its length does anyway is written.
      (on) => widget({ search: on === count() > LONG_LIST ? null : on }),
      searching
    );
  }

  /** Pictures: their words under them, their size, and whether the whole picture shows. */
  function pictureLook(): ChoicePart {
    const labels = toggle(w.showLabels, (on) => widget({ showLabels: on ? null : false }));
    const size = select(w.pictureSize, [['small', w.small], ['', w.medium], ['large', w.large]], (value) => widget({ imageSize: value || null }));
    const fit = select(w.fit, [['', w.fillTheCard], ['whole', w.wholePicture]], (value) => widget({ imageFit: value || null }));
    return {
      element: el('div', { class: 'fd-inline-row' }, labels.element, word(w.pictureSize, size), word(w.fit, fit)),
      standsIn: false,
      refresh(_page, node) {
        labels.button.setAttribute('aria-checked', String(option(node, 'showLabels') !== false));
        size.value = String(option(node, 'imageSize') ?? '');
        fit.value = String(option(node, 'imageFit') ?? '');
      },
    };
  }

  /** A ranking of the top few only: picked from the rest, then put in order. */
  function top(): ChoicePart {
    const box = el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': w.rankTop, min: '1', step: '1', placeholder: w.all, inputmode: 'numeric' }) as HTMLInputElement;
    box.addEventListener('change', () => {
      const n = Number(box.value);
      widget({ top: box.value.trim() && Number.isInteger(n) && n >= 1 && n < count() ? n : null });
    });
    return {
      element: word(w.rankTop, box),
      standsIn: false,
      refresh(_page, node) {
        if (!focused(box)) box.value = typeof option(node, 'top') === 'number' ? String(option(node, 'top')) : '';
      },
    };
  }

  /** A yes or no: two buttons with words of their own, or a switch. */
  function yesNo(): ChoicePart {
    const look = select(w.showAs, [['buttons', w.buttons], ['switch', w.switch]], (value) => designer.setYesNoLook(id, value as 'buttons' | 'switch'));
    const words = (key: 'yesLabel' | 'noLabel', label: string, placeholder: string) => {
      const box = el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, placeholder, autocomplete: 'off' }) as HTMLInputElement;
      box.addEventListener('input', () => widget({ [key]: box.value }));
      return box;
    };
    const yes = words('yesLabel', w.wordsForYes, w.yes);
    const no = words('noLabel', w.wordsForNo, w.no);
    const said = el('div', { class: 'fd-inline-row' }, word(w.wordsForYes, yes), word(w.wordsForNo, no));
    return {
      element: el('div', { class: 'fd-kind-block' }, word(w.showAs, look), said),
      standsIn: false,
      refresh(_page, node) {
        const buttons = node.widget === 'buttons';
        look.value = buttons ? 'buttons' : 'switch';
        said.hidden = !buttons;
        if (!focused(yes)) yes.value = String(option(node, 'yesLabel') ?? '');
        if (!focused(no)) no.value = String(option(node, 'noLabel') ?? '');
      },
    };
  }

  const parts: ChoicePart[] = [];
  if (kind === 'multiple-choice' || kind === 'checkboxes' || kind === 'image-choice') parts.push(layout(kind === 'image-choice'));
  if (kind === 'image-choice') parts.push(pictureLook());
  if (kind === 'dropdown') parts.push(search());
  if (kind === 'ranking') parts.push(top());
  if (kind && SHUFFLED.has(kind)) parts.push(keepInPlace());
  if (kind === 'tags') parts.push(switchPart(w.ownAnswers, (on) => designer.setOwnAnswers(id, on), (page, node) => (page.fields[node.field] as { ownAnswers?: boolean }).ownAnswers === true));
  if (kind === 'matrix') {
    const def = (page: Page, node: FieldNode) => page.fields[node.field] as Extract<Field, { type: 'matrix' }>;
    parts.push(
      switchPart(w.severalPerRow, (on) => designer.setSeveral(id, on), (page, node) => def(page, node).multiple === true),
      switchPart(w.shuffleRows, (on) => widget({ shuffle: on || null }), (_page, node) => option(node, 'shuffle') === true),
      switchPart(w.onePerColumn, (on) => designer.setOnePerColumn(id, on), (page, node) => def(page, node).onePerColumn === true)
    );
  }
  if (kind === 'yes-no') parts.push(yesNo());
  if (kind === 'status') parts.push(switchPart(w.pickAStep, (on) => widget({ clickable: on || null }), (_page, node) => option(node, 'clickable') === true));
  return parts;
}
