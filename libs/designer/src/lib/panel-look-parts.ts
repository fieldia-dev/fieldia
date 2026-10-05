import { PART_LOOKS, type Page, type PartLook, type PartLookKind } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { settingWords } from './look-parts-words';
import { segmented, setting, type Segmented } from './panel-controls';

/**
 * “Each kind of part” on the Look tab (the survey's Look sheet): pick a kind —
 * text boxes, choices, groups, buttons, tables — and set the few things the
 * skins draw on it, over the page's look. A colour is picked from the
 * browser's own colour picker, a choice of a few pressed; pressed again, or
 * its colour's ×, a setting goes back to the page's; “As the page” gives the
 * whole kind back. The canvas wears each as it is set (see `wearLook`).
 */

export interface PartLookSetting {
  row: HTMLElement;
  update(page: Page): void;
}

const KINDS = Object.keys(PART_LOOKS) as PartLookKind[];
const CHOICES: Partial<Record<keyof PartLook, string[]>> = { corners: ['square', 'soft', 'round'], textSize: ['small', 'large'] };
/** What a colour box shows while the page's look draws it: about what the skin does. */
const SHOWN_UNSET: Partial<Record<keyof PartLook, string>> = { background: '#ffffff', border: '#cfd4da', accent: '#1365d9' };

export function partLookSettings(el: ElementFactory, designer: Designer): PartLookSetting {
  const w = designer.words.partLooks;
  let picked: PartLookKind = 'inputs';
  const kinds = segmented<PartLookKind>(
    el,
    w.kindOfPart,
    KINDS.map((kind) => ({ value: kind, words: w.kinds[kind] })),
    (kind) => {
      if (kind) show(kind);
    },
    { className: 'fd-insp-kinds' }
  );

  /** Each kind's settings, in a group of its own; only the picked kind's shows. */
  const blocks = KINDS.map((kind) => {
    const draws: ((part: PartLook) => void)[] = [];
    const rows = PART_LOOKS[kind].map((name: keyof PartLook) => {
      // Kept by its English name, as the panel keeps every setting; said in the designer's words.
      const key = settingWords(kind, name);
      const words = settingWords(kind, name, designer.words);
      // Its name in full, the kind's with it: every kind has corners, and the page has too.
      const named = w.named(w.kinds[kind], words);
      const choices = CHOICES[name];
      if (choices) {
        const seg: Segmented<string> = segmented(
          el,
          named,
          choices.map((value) => ({ value, words: w.values[value] })),
          (value) => designer.setPartLook(kind, { [name]: value }),
          { toggle: true }
        );
        draws.push((part) => seg.set(part[name]));
        return el('div', { class: 'fd-part-setting', 'data-part-setting': key }, el('span', { class: 'fd-part-setting-name' }, words), seg.element);
      }
      const colour = el('input', { type: 'color', class: 'fd-insp-colour', 'aria-label': named });
      colour.addEventListener('input', () => designer.setPartLook(kind, { [name]: colour.value }));
      const value = el('span', { class: 'fd-part-colour-value' });
      const clear = el('button', { type: 'button', class: 'fd-part-colour-clear', 'aria-label': w.namedAsThePage(named), title: w.asThePage }, '×');
      clear.addEventListener('click', () => {
        designer.setPartLook(kind, { [name]: null });
        colour.focus();
      });
      draws.push((part) => {
        const set = part[name] as string | undefined;
        if (colour.ownerDocument.activeElement !== colour) colour.value = (set ?? SHOWN_UNSET[name] ?? '#ffffff').toLowerCase();
        value.textContent = set ? set.toLowerCase() : w.asThePage;
        value.classList.toggle('fd-part-colour-unset', !set);
        clear.hidden = !set;
      });
      return el(
        'div',
        { class: 'fd-part-setting', 'data-part-setting': key },
        el('label', { class: 'fd-part-colour' }, el('span', { class: 'fd-part-setting-name' }, words), colour),
        value,
        clear
      );
    });
    const reset = el('button', { type: 'button', class: 'fd-button fd-button-link fd-insp-reset', 'aria-label': w.namedAsThePage(w.kinds[kind]) }, w.asThePage);
    reset.addEventListener('click', () => {
      designer.setPartLook(kind, null);
      kinds.element.querySelector<HTMLElement>(`[data-choice="${kind}"]`)?.focus();
    });
    const element = el('div', { class: 'fd-part-look', role: 'group', 'aria-label': w.kinds[kind], hidden: '' }, ...rows, reset, el('p', { class: 'fd-properties-hint fd-set-hint' }, w.hints[kind]));
    return { kind, element, reset, draw: (part: PartLook) => draws.forEach((draw) => draw(part)) };
  });

  const row = setting(el, 'look', 'Each kind of part', [kinds.element, ...blocks.map((b) => b.element)], { hint: w.hint, words: w.setting });

  function show(kind: PartLookKind) {
    picked = kind;
    kinds.set(kind);
    for (const block of blocks) block.element.hidden = block.kind !== kind;
  }
  show(picked);

  return {
    row,
    update(page) {
      const parts = (page.look?.parts ?? {}) as Partial<Record<PartLookKind, PartLook>>;
      for (const block of blocks) {
        const part = parts[block.kind] ?? {};
        block.draw(part);
        const own = Object.keys(part).length > 0;
        block.reset.hidden = !own;
        const chip = kinds.element.querySelector<HTMLElement>(`[data-choice="${block.kind}"]`);
        if (own) chip?.setAttribute('data-own', '');
        else chip?.removeAttribute('data-own');
        chip?.setAttribute('title', own ? w.ownLook(w.kinds[block.kind]) : w.pageLook(w.kinds[block.kind]));
      }
    },
  };
}
