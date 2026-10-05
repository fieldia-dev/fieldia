import type { Badge, ButtonNode, Field, Page, SheetNode, StatButton, Tone } from '@fieldia/core';
import { storedAs } from './kinds';
import { allIds, nextName, shownFields } from './page-tree';
import { Refusal } from './refusal';

/**
 * A record's header, as the designer edits it: the status steps, the
 * header's buttons, the counters that open related records, and the badges
 * by the title. Each part has an id like any element, so it can be picked on
 * the canvas, moved among its kind, and shown only for some records.
 */

export type HeaderPartKind = 'button' | 'stat' | 'badge';

export interface HeaderPartPatch {
  label?: string;
  /** The action's name, for a button or a counter. The app decides what it does. */
  action?: string;
  /** A button's look. */
  style?: ButtonNode['style'];
  /** A button's question before it acts; empty asks nothing. */
  confirm?: string;
  /** A badge's colour. */
  tone?: Tone;
  /** The number a counter shows, from a field; empty shows none. */
  field?: string;
  icon?: string;
}

export interface HeaderCommands {
  /** Status steps from a field that holds one of a list, or `null` for none. */
  setStatusbar(field: string | null, options?: { clickable?: boolean; position?: 'header' | 'title' }): boolean;
  /** A button, a counter or a badge, at the end of its kind. Returns its id, picked. */
  addHeaderPart(kind: HeaderPartKind, label: string): string | false;
  updateHeaderPart(id: string, patch: HeaderPartPatch): boolean;
  moveHeaderPart(id: string, delta: number): boolean;
  removeHeaderPart(id: string): boolean;
}

/** The lists a header part sits in, by kind, as the sheet names them. */
const LISTS = { button: 'buttons', stat: 'statButtons', badge: 'badges' } as const;

/** A part of a sheet's header by its id: what kind, which list, and where in it. */
export function findHeaderPart(page: Page, id: string): { kind: HeaderPartKind; list: (ButtonNode | StatButton | Badge)[]; index: number; part: ButtonNode | StatButton | Badge } | null {
  const root = page.layout;
  if (root.type !== 'sheet') return null;
  for (const kind of Object.keys(LISTS) as HeaderPartKind[]) {
    const list = (root[LISTS[kind]] ?? []) as (ButtonNode | StatButton | Badge)[];
    const index = list.findIndex((p) => p.id === id);
    if (index !== -1) return { kind, list, index, part: list[index] };
  }
  return null;
}

/** Words as an action's name: "Send by email" is `send_by_email`. */
const actionName = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'action';

export interface HeaderContext {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  select(id: string): void;
  model: Record<string, Field>;
}

export function headerCommands(context: HeaderContext): HeaderCommands {
  const { apply, model } = context;
  const sheetOf = (draft: Page): SheetNode => {
    if (draft.layout.type !== 'sheet') throw new Refusal((w) => w.refusals.onlySheetHeader);
    return draft.layout;
  };
  /** A field the page has, or the model's, put on the page as the model has it. */
  const fieldFor = (draft: Page, name: string): Field => {
    const own = draft.fields[name] ?? model[name];
    if (!own) throw new Refusal((w) => w.refusals.noField(name));
    draft.fields[name] = own;
    return own;
  };
  /** Drop the fields nothing on the page shows any more. */
  const prune = (draft: Page) => {
    const shown = shownFields(draft);
    for (const name of Object.keys(draft.fields)) if (!shown.has(name)) delete draft.fields[name];
  };
  const partOf = (draft: Page, id: string) => {
    const found = findHeaderPart(draft, id);
    if (!found) throw new Refusal((w) => w.refusals.noHeaderPart(id));
    return found;
  };

  return {
    setStatusbar(field, options = {}) {
      return apply((draft) => {
        const root = sheetOf(draft);
        if (field === null) {
          delete root.statusbar;
          prune(draft);
          return;
        }
        const def = fieldFor(draft, field);
        if (def.type !== 'selection' || def.multiple) throw new Refusal((w) => w.refusals.statusOneOfList(def.label, storedAs(def, w)));
        const kept = root.statusbar?.field === field ? root.statusbar : undefined;
        root.statusbar = { ...kept, field, ...options };
        if (root.statusbar.clickable === false) delete root.statusbar.clickable;
        if (root.statusbar.position === 'header') delete root.statusbar.position;
        prune(draft);
      });
    },

    addHeaderPart(kind, label) {
      let created = '';
      const words = label.trim();
      const ok = apply((draft) => {
        const root = sheetOf(draft);
        if (!words) throw new Refusal((w) => w.refusals.headerNeedsWords);
        const ids = allIds(draft);
        created = nextName((id) => ids.has(id), kind, '-');
        if (kind === 'button') root.buttons = [...(root.buttons ?? []), { type: 'button', id: created, label: words, action: actionName(words) }];
        else if (kind === 'stat') root.statButtons = [...(root.statButtons ?? []), { id: created, label: words, action: actionName(words) }];
        else root.badges = [...(root.badges ?? []), { id: created, label: words, tone: 'muted' }];
      });
      if (!ok) return false;
      context.select(created);
      return created;
    },

    updateHeaderPart(id, patch) {
      const typing = Object.keys(patch).length === 1 && ('label' in patch || 'action' in patch || 'confirm' in patch);
      return apply(
        (draft) => {
          const { kind, part } = partOf(draft, id);
          if (patch.label !== undefined) part.label = patch.label;
          if (patch.action !== undefined) {
            if (kind === 'badge') throw new Refusal((w) => w.refusals.badgeNoAction);
            if (!patch.action.trim()) throw new Refusal((w) => (kind === 'stat' ? w.refusals.counterAction : w.refusals.buttonAction));
            (part as ButtonNode | StatButton).action = patch.action.trim();
          }
          if (patch.style !== undefined) {
            if (kind !== 'button') throw new Refusal((w) => w.refusals.onlyButtonStyle);
            (part as ButtonNode).style = patch.style;
          }
          if (patch.confirm !== undefined) {
            if (kind !== 'button') throw new Refusal((w) => w.refusals.onlyButtonAsks);
            if (patch.confirm.trim()) (part as ButtonNode).confirm = patch.confirm;
            else delete (part as ButtonNode).confirm;
          }
          if (patch.tone !== undefined) {
            if (kind !== 'badge') throw new Refusal((w) => w.refusals.onlyBadgeTone);
            (part as Badge).tone = patch.tone;
          }
          if (patch.field !== undefined) {
            if (kind !== 'stat') throw new Refusal((w) => w.refusals.onlyCounterField);
            if (!patch.field) delete (part as StatButton).field;
            else {
              const def = fieldFor(draft, patch.field);
              if (!['integer', 'float', 'monetary'].includes(def.type)) throw new Refusal((w) => w.refusals.counterNumber(def.label, storedAs(def, w)));
              (part as StatButton).field = patch.field;
            }
            prune(draft);
          }
          if (patch.icon !== undefined) {
            if (patch.icon) part.icon = patch.icon;
            else delete part.icon;
          }
        },
        typing ? `header:${Object.keys(patch)[0]}:${id}` : null
      );
    },

    moveHeaderPart(id, delta) {
      return apply((draft) => {
        const { list, index } = partOf(draft, id);
        const to = index + delta;
        if (to < 0 || to >= list.length) throw new Refusal((w) => w.refusals.cannotMoveFurther);
        const [moved] = list.splice(index, 1);
        list.splice(to, 0, moved);
      });
    },

    removeHeaderPart(id) {
      return apply((draft) => {
        const { kind, list, index } = partOf(draft, id);
        list.splice(index, 1);
        const root = draft.layout as SheetNode;
        if (!list.length) delete root[LISTS[kind]];
        prune(draft);
      });
    },
  };
}
