import type { Page, PageLook } from '@fieldia/core';
import { accentShades } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer, SavedLook } from './designer';
import { designerIcon } from './icons';
import { looksHub, reasonOf } from './look-hub';
import { LOOK_PRESETS, lookValuesOf, PRESET_KEYS, sameLook, type LookValues } from './look-presets';
import { openMenu } from './menu';
import { setting } from './panel-controls';

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
export function nameRefusal(name: string, kept: readonly SavedLook[], self?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'A look needs a name';
  if ([...trimmed].length > NAME_MOST) return `A name is ${NAME_MOST} characters at most`;
  const same = (other: string) => other.toLocaleLowerCase() === trimmed.toLocaleLowerCase();
  const taken = LOOK_PRESETS.find((preset) => same(preset.name)) ?? kept.find((look) => look.id !== self && same(look.name));
  return taken ? `There is a look named “${taken.name}” already` : null;
}

let made = 0;
const newId = () => `look-${Date.now().toString(36)}-${(++made).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const anySet = (look: PageLook | undefined) => PRESET_KEYS.some((key) => look?.[key] !== undefined);

export interface LookRow {
  rows: HTMLElement[];
  update(page: Page): void;
}

export function lookRow(el: ElementFactory, designer: Designer): LookRow {
  const hub = looksHub(designer.looks());
  const base = `fd-look-${++made}`;

  /** A tile: “Aa” in the look's font and accent, on its scheme's surface, and its name. */
  const tile = (look: LookValues, name: string, attrs: Record<string, string>) => {
    const sample = el('span', { class: 'fd-look-preset-sample', 'aria-hidden': 'true', 'data-font': look.font, 'data-scheme': look.scheme }, 'Aa');
    if (look.accent) {
      const shades = accentShades(look.accent);
      sample.style.setProperty('--fd-preset-accent', look.scheme === 'dark' ? shades.dark : shades.accent);
    }
    return el('button', { type: 'button', class: 'fd-look-preset', 'aria-pressed': 'false', ...attrs }, sample, el('span', { class: 'fd-look-preset-name' }, name)) as HTMLButtonElement;
  };

  // ---- Fieldia's -------------------------------------------------------------
  const own = el('span', { class: 'fd-look-own' });
  const presets = LOOK_PRESETS.map((preset) => {
    const button = tile(preset.look, preset.name, { 'data-preset': preset.id });
    button.addEventListener('click', () => designer.setLookPreset(preset.id));
    return { look: preset.look, button };
  });

  // ---- yours -----------------------------------------------------------------
  const yoursList = el('div', { class: 'fd-look-presets fd-look-saved', role: 'group', 'aria-label': 'Your looks' });
  const yours = el('div', { class: 'fd-look-yours' }, el('p', { class: 'fd-look-saved-head' }, 'Your looks'), yoursList);
  /** Where “Your looks” goes: on the page only once there is one. */
  const yoursAt = el('div', { class: 'fd-look-yours-at' });
  let tiles: { saved: SavedLook; button: HTMLButtonElement; more: HTMLButtonElement }[] = [];
  /** The looks as last drawn, so they are drawn again only when they change. */
  let drawn = '';

  // ---- naming one: a box on the page, never a prompt -------------------------
  const save = el('button', { type: 'button', class: 'fd-button fd-button-link fd-look-save' }, 'Save this look…');
  const label = el('label', { class: 'fd-look-name-label', for: `${base}-name` });
  const input = el('input', { id: `${base}-name`, class: 'fd-input', type: 'text', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const problem = el('p', { id: `${base}-problem`, class: 'fd-look-name-problem', role: 'alert', hidden: '' });
  const submit = el('button', { type: 'submit', class: 'fd-button fd-button-primary' });
  const cancel = el('button', { type: 'button', class: 'fd-button' }, 'Cancel');
  const box = el('form', { class: 'fd-look-name', novalidate: '', hidden: '' }, label, input, problem, el('div', { class: 'fd-look-name-buttons' }, submit, cancel)) as HTMLFormElement;
  /** The look being renamed; null while a new one is named. */
  let renaming: SavedLook | null = null;
  let busy = false;

  // ---- what was done, and what failed ----------------------------------------
  const statusWords = el('span', { id: `${base}-status` });
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-describedby': `${base}-status` }, 'Undo');
  const status = el('p', { class: 'fd-look-status', role: 'status', hidden: '' }, statusWords, undo);
  /** The look just removed: Undo brings it back. */
  let removed: SavedLook | null = null;
  const troubleWords = el('span', {});
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Try again');
  const trouble = el('p', { class: 'fd-look-problem', role: 'alert', hidden: '' }, troubleWords, retry);
  /** What failed here, and how to try it again; a failure to list them is the store's, shown wherever they are. */
  let failed: { words: string; retry?: () => void } | null = null;

  const row = setting(el, 'look', 'Look presets', [el('div', { class: 'fd-look-presets', role: 'group', 'aria-label': 'Look presets' }, ...presets.map((p) => p.button), own), save, box, yoursAt, status, trouble], {
    words: 'Start from',
    hint: 'Sets the accent, font, spacing, corners and colours at once. Each stays yours to change, and a look of your own can be saved to use again.',
  });

  /** What failed, and why in the store's words, or plainly when it gave none. */
  const said = (what: string, reason: string) => (reason ? `${what}: ${reason}` : `${what}. Try again in a moment.`);
  const focusTile = (id: string) => tiles.find((t) => t.saved.id === id)?.button.focus();

  function savedTile(saved: SavedLook) {
    const button = tile(saved.look, saved.name, { title: saved.name });
    button.addEventListener('click', () => designer.useLook(saved.look));
    const more = el('button', { type: 'button', class: 'fd-look-saved-more', 'aria-label': `Rename or remove “${saved.name}”`, title: 'Rename or remove', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, designerIcon(row.ownerDocument, 'more'));
    more.addEventListener('click', () =>
      openMenu({
        el,
        anchor: more,
        title: saved.name,
        actions: true,
        items: [
          { id: 'rename', label: 'Rename…' },
          { id: 'remove', label: 'Remove' },
        ],
        onPick: (id) => (id === 'rename' ? openBox(saved) : void remove(saved)),
      })
    );
    tiles.push({ saved, button, more });
    return el('div', { class: 'fd-look-saved-tile', 'data-look': saved.id }, button, more);
  }

  function openBox(look: SavedLook | null) {
    renaming = look;
    const words = look ? `New name for “${look.name}”` : 'Name this look';
    label.textContent = words;
    input.setAttribute('aria-label', words);
    submit.textContent = look ? 'Rename' : 'Save';
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
    problem.textContent = words;
    problem.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', problem.id);
    input.focus();
  }
  function clearProblem() {
    problem.hidden = true;
    problem.textContent = '';
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
    const refusal = nameRefusal(input.value, hub.looks ?? [], renaming?.id);
    if (refusal) return refuse(refusal);
    const name = input.value.trim();
    const look: SavedLook = renaming ? { ...renaming, name } : { id: newId(), name, look: lookValuesOf(designer.getPage().look) };
    busy = true;
    box.setAttribute('aria-busy', 'true');
    try {
      await hub.save(look);
    } catch (error) {
      refuse(said(renaming ? `Could not rename “${renaming.name}”` : `Could not save “${name}”`, reasonOf(error)));
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
      failed = { words: said(`Could not remove “${saved.name}”`, reasonOf(error)), retry: () => void remove(saved) };
      draw();
      return;
    }
    removed = saved;
    statusWords.textContent = `Removed “${saved.name}”. `;
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
      failed = { words: said(`Could not bring back “${look.name}”`, reasonOf(error)), retry: () => void bringBack() };
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
    own.textContent = mine ? 'Your own' : 'As the skin';
    // Only a look of one's own is offered to save: a preset, or a look kept already, is one click away as it is.
    save.hidden = worn || !mine || !box.hidden;
    const shown = failed ?? (hub.problem === null ? null : { words: said('Your looks could not be loaded', hub.problem) });
    trouble.hidden = !shown;
    troubleWords.textContent = shown ? `${shown.words} ` : '';
  }

  hub.ensure();
  return { rows: [row], update: (page) => draw(page) };
}
