import type { Page, PageLook } from '@fieldia/core';
import { accentShades } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer, SavedLook } from './designer';
import { designerIcon } from './icons';
import { looksHub, reasonOf } from './look-hub';
import { LOOK_PRESETS, lookValuesOf, PRESET_KEYS, sameLook, type LookValues } from './look-presets';
import { openMenu } from './menu';
import { setting } from './panel-controls';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * Looks to start from, a tile each — Fieldia's presets, then “Your looks”:
 * its words in its font and accent, on its scheme's surface. The ones the
 * page wears are pressed; a look that is none of them is "Your own", and one
 * with none of their settings is the skin's. A look of one's own is saved by
 * a name typed on the page, put on as a preset is, and renamed or removed
 * from a small menu on its tile — removed with Undo at hand, not asked
 * about first, as an answer rule is: it is put back as easily as it went.
 */

/** A look's name is this long at most: it is shown on a tile a third of the panel wide. */
export const NAME_MOST = 40;

/** Why a name cannot be a look's, or null when it can: trimmed, it is not empty, not too long, and no other look's, in any case. */
export function nameRefusal(name: string, kept: readonly SavedLook[], self?: string, words: DesignerWords = en): string | null {
  const w = words.looks;
  const trimmed = name.trim();
  if (!trimmed) return w.needsName;
  if ([...trimmed].length > NAME_MOST) return w.tooLong(NAME_MOST);
  const same = (other: string) => other.toLocaleLowerCase() === trimmed.toLocaleLowerCase();
  // A preset's name in English, or as the designer says it, is taken.
  const preset = LOOK_PRESETS.find((p) => same(p.name) || same(presetName(p.id, p.name, words)));
  const taken = preset ? presetName(preset.id, preset.name, words) : kept.find((look) => look.id !== self && same(look.name))?.name;
  return taken ? w.taken(taken) : null;
}

/** A preset's name in the designer's words. */
const presetName = (id: string, name: string, words: DesignerWords) => words.looks.presets[id] ?? name;

let made = 0;
const newId = () => `look-${Date.now().toString(36)}-${(++made).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const anySet = (look: PageLook | undefined) => PRESET_KEYS.some((key) => look?.[key] !== undefined);

export interface LookRow {
  rows: HTMLElement[];
  update(page: Page): void;
}

export function lookRow(el: ElementFactory, designer: Designer): LookRow {
  const words = designer.words;
  const w = words.looks;
  const hub = looksHub(designer.looks());
  const base = `fd-look-${++made}`;

  /** A tile: “Aa” in the look's font and accent, on its scheme's surface, and its name. */
  const tile = (look: LookValues, name: string, attrs: Record<string, string>) => {
    const sample = el('span', { class: 'fd-look-preset-sample', 'aria-hidden': 'true', 'data-font': look.font, 'data-scheme': look.scheme }, w.sample);
    if (look.accent) {
      const shades = accentShades(look.accent);
      sample.style.setProperty('--fd-preset-accent', look.scheme === 'dark' ? shades.dark : shades.accent);
    }
    return el('button', { type: 'button', class: 'fd-look-preset', 'aria-pressed': 'false', ...attrs }, sample, el('span', { class: 'fd-look-preset-name' }, name)) as HTMLButtonElement;
  };

  // ---- Fieldia's -------------------------------------------------------------
  const own = el('span', { class: 'fd-look-own' });
  const presets = LOOK_PRESETS.map((preset) => {
    const button = tile(preset.look, presetName(preset.id, preset.name, words), { 'data-preset': preset.id });
    button.addEventListener('click', () => designer.setLookPreset(preset.id));
    return { look: preset.look, button };
  });

  // ---- yours -----------------------------------------------------------------
  const yoursList = el('div', { class: 'fd-look-presets fd-look-saved', role: 'group', 'aria-label': w.yourLooks });
  const yours = el('div', { class: 'fd-look-yours' }, el('p', { class: 'fd-look-saved-head' }, w.yourLooks), yoursList);
  /** Where “Your looks” goes: on the page only once there is one. */
  const yoursAt = el('div', { class: 'fd-look-yours-at' });
  let tiles: { saved: SavedLook; button: HTMLButtonElement; more: HTMLButtonElement }[] = [];
  /** The looks as last drawn, so they are drawn again only when they change. */
  let drawn = '';

  // ---- naming one: a box on the page, never a prompt -------------------------
  // Words in their own direction: English keeps its order, and its “…”, on a page right to left.
  const save = el('button', { type: 'button', class: 'fd-button fd-button-link fd-look-save' }, el('bdi', {}, w.saveThisLook));
  const label = el('label', { class: 'fd-look-name-label', for: `${base}-name` });
  const input = el('input', { id: `${base}-name`, class: 'fd-input', type: 'text', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const problem = el('p', { id: `${base}-problem`, class: 'fd-look-name-problem', role: 'alert', hidden: '' });
  const submit = el('button', { type: 'submit', class: 'fd-button fd-button-primary' });
  const cancel = el('button', { type: 'button', class: 'fd-button' }, w.cancel);
  const box = el('form', { class: 'fd-look-name', novalidate: '', hidden: '' }, label, input, problem, el('div', { class: 'fd-look-name-buttons' }, submit, cancel)) as HTMLFormElement;
  /** The look being renamed; null while a new one is named. */
  let renaming: SavedLook | null = null;
  let busy = false;

  // ---- what was done, and what failed ----------------------------------------
  const statusWords = el('span', { id: `${base}-status` });
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-describedby': `${base}-status` }, w.undo);
  const status = el('p', { class: 'fd-look-status', role: 'status', hidden: '' }, statusWords, undo);
  /** The look just removed: Undo brings it back. */
  let removed: SavedLook | null = null;
  const troubleWords = el('span', {});
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.tryAgain);
  const trouble = el('p', { class: 'fd-look-problem', role: 'alert', hidden: '' }, troubleWords, retry);
  /** What failed here, and how to try it again; a failure to list them is the store's, shown wherever they are. */
  let failed: { words: string; retry?: () => void } | null = null;

  const row = setting(el, 'look', 'Look presets', [el('div', { class: 'fd-look-presets', role: 'group', 'aria-label': w.lookPresets }, ...presets.map((p) => p.button), own), save, box, yoursAt, status, trouble], {
    words: w.startFrom,
    hint: w.presetsHint,
  });

  /** What failed, and why in the store's words, or plainly when it gave none. */
  const said = (what: string, reason: string) => w.failed(what, reason);
  const focusTile = (id: string) => tiles.find((t) => t.saved.id === id)?.button.focus();

  function savedTile(saved: SavedLook) {
    const button = tile(saved.look, saved.name, { title: saved.name });
    button.addEventListener('click', () => designer.useLook(saved.look));
    const more = el('button', { type: 'button', class: 'fd-look-saved-more', 'aria-label': w.renameOrRemoveNamed(saved.name), title: w.renameOrRemove, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, designerIcon(row.ownerDocument, 'more'));
    more.addEventListener('click', () =>
      openMenu({
        el,
        anchor: more,
        title: saved.name,
        actions: true,
        items: [
          { id: 'rename', label: w.rename },
          { id: 'remove', label: w.remove },
        ],
        onPick: (id) => (id === 'rename' ? openBox(saved) : void remove(saved)),
      })
    );
    tiles.push({ saved, button, more });
    return el('div', { class: 'fd-look-saved-tile', 'data-look': saved.id }, button, more);
  }

  function openBox(look: SavedLook | null) {
    renaming = look;
    const asked = look ? w.newNameFor(look.name) : w.nameThisLook;
    label.replaceChildren(el('bdi', {}, asked));
    input.setAttribute('aria-label', asked);
    submit.textContent = look ? w.renameButton : w.save;
    input.value = look?.name ?? '';
    clearProblem();
    hideStatus();
    box.hidden = false;
    draw();
    input.focus();
    input.select();
  }
  function closeBox(focusBack: boolean) {
    const was = renaming;
    box.hidden = true;
    renaming = null;
    input.value = '';
    clearProblem();
    draw();
    if (!focusBack) return;
    if (was) focusTile(was.id);
    else (save.hidden ? (presets[0]?.button ?? null) : save)?.focus();
  }
  function refuse(words: string) {
    problem.replaceChildren(el('bdi', {}, words));
    problem.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', problem.id);
    input.focus();
  }
  function clearProblem() {
    problem.hidden = true;
    problem.replaceChildren();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  const hideStatus = () => {
    removed = null;
    status.hidden = true;
    failed = null;
  };

  async function keep() {
    if (busy) return;
    const refusal = nameRefusal(input.value, hub.looks ?? [], renaming?.id, words);
    if (refusal) return refuse(refusal);
    const name = input.value.trim();
    const look: SavedLook = renaming ? { ...renaming, name } : { id: newId(), name, look: lookValuesOf(designer.getPage().look) };
    busy = true;
    box.setAttribute('aria-busy', 'true');
    try {
      await hub.save(look);
    } catch (error) {
      refuse(said(renaming ? w.couldNotRename(renaming.name) : w.couldNotSave(name), reasonOf(error)));
      return;
    } finally {
      busy = false;
      box.removeAttribute('aria-busy');
    }
    closeBox(false);
    focusTile(look.id);
  }

  async function remove(saved: SavedLook) {
    hideStatus();
    try {
      await hub.remove(saved.id);
    } catch (error) {
      failed = { words: said(w.couldNotRemove(saved.name), reasonOf(error)), retry: () => void remove(saved) };
      draw();
      return;
    }
    removed = saved;
    statusWords.replaceChildren(el('bdi', {}, w.removed(saved.name)), ' ');
    status.hidden = false;
    draw();
    undo.focus();
  }

  async function bringBack() {
    const look = removed;
    if (!look) return;
    failed = null;
    try {
      await hub.save(look);
    } catch (error) {
      failed = { words: said(w.couldNotBringBack(look.name), reasonOf(error)), retry: () => void bringBack() };
      draw();
      return;
    }
    hideStatus();
    draw();
    focusTile(look.id);
  }

  save.addEventListener('click', () => openBox(null));
  box.addEventListener('submit', (event) => {
    event.preventDefault();
    void keep();
  });
  input.addEventListener('input', clearProblem);
  cancel.addEventListener('click', () => closeBox(true));
  // Escape puts the box away, and only the box: not the sheet round it, nor what is picked.
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closeBox(true);
  });
  undo.addEventListener('click', () => void bringBack());
  retry.addEventListener('click', () => {
    const again = failed?.retry ?? (() => hub.reload());
    failed = null;
    trouble.hidden = true;
    again();
  });

  /** Told of each change to the looks while on the page: listening starts once it is drawn there. */
  const listener = { element: row, draw: () => draw() };
  function draw(page: Page = designer.getPage()) {
    if (row.isConnected) hub.listen(listener);
    const kept = hub.looks ?? [];
    const now = JSON.stringify(kept);
    if (now !== drawn) {
      drawn = now;
      // The tile with the cursor keeps it, drawn anew.
      const active = row.ownerDocument.activeElement;
      const had = tiles.find((t) => t.button === active || t.more === active);
      tiles = [];
      yoursList.replaceChildren(...kept.map(savedTile));
      yoursAt.replaceChildren(...(kept.length ? [yours] : []));
      const again = had && tiles.find((t) => t.saved.id === had.saved.id);
      if (again) (had.more === active ? again.more : again.button).focus();
    }
    let worn = false;
    for (const { look, button } of [...presets, ...tiles.map((t) => ({ look: t.saved.look, button: t.button }))]) {
      const on = sameLook(page.look, look);
      worn ||= on;
      button.setAttribute('aria-pressed', String(on));
    }
    const mine = anySet(page.look);
    own.hidden = worn;
    own.textContent = mine ? w.yourOwn : w.asTheSkin;
    // Only a look of one's own is offered to save: a preset, or a look kept already, is one click away as it is.
    save.hidden = worn || !mine || !box.hidden;
    const shown = failed ?? (hub.problem === null ? null : { words: said(w.couldNotLoad, hub.problem) });
    trouble.hidden = !shown;
    troubleWords.replaceChildren(...(shown ? [el('bdi', {}, shown.words), ' '] : []));
  }

  hub.ensure();
  return { rows: [row], update: (page) => draw(page) };
}
