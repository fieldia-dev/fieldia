import type { Alert, Badge, ButtonNode, Field, Page, Ribbon, SheetNode, StatButton, Tone } from '@fieldia/core';
import { storedAs } from './kinds';
import { allIds, nextName, shownFields } from './page-tree';
import { Refusal } from './refusal';

/**
 * A record's header, as the designer edits it: the status steps, the
 * header's buttons, the counters that open related records, and the badges
 * by the title. Each part has an id like any element, so it can be picked on
 * the canvas, moved among its kind, and shown only for some records.
 */

export type HeaderPartKind = 'button' | 'stat' | 'badge' | 'ribbon' | 'alert';

/** A part of a sheet's header or card: a button, a counter, a badge, a ribbon or an alert. */
export type HeaderPart = ButtonNode | StatButton | Badge | Ribbon | Alert;

/** A part's words: an alert's message, any other's label. */
export const wordsOf = (part: HeaderPart): string => ('message' in part ? part.message : part.label);

export interface HeaderPartPatch {
  label?: string;
  /** The action's name, for a button or a counter. The app decides what it does. */
  action?: string;
  /** A button's look. */
  style?: ButtonNode['style'];
  /** A button's question before it acts; empty asks nothing. */
  confirm?: string;
  /** A badge's, a ribbon's or an alert's colour. */
  tone?: Tone;
  /** A ribbon's or an alert's words from a field, while it holds any; empty for none. */
  wordsField?: string;
  /** A ribbon's words on pointing at it; empty for none. */
  tooltip?: string;
  /** An alert with a × that hides it. */
  dismissible?: boolean;
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
  /** A button inside an alert, after its words: a link that runs an action. Returns its id. */
  addAlertButton(alert: string, label: string): string | false;
  /** An alert's button's words, or the action it runs. */
  updateAlertButton(alert: string, button: string, patch: { label?: string; action?: string }): boolean;
  removeAlertButton(alert: string, button: string): boolean;
}

/** The lists a header part sits in, by kind, as the sheet names them. */
const LISTS = { button: 'buttons', stat: 'statButtons', badge: 'badges', ribbon: 'ribbons', alert: 'alerts' } as const;

/** A part of a sheet's header by its id: what kind, which list, and where in it. A page's one `ribbon` is found as the first of the ribbons. */
export function findHeaderPart(page: Page, id: string): { kind: HeaderPartKind; list: HeaderPart[]; index: number; part: HeaderPart } | null {
  const root = page.layout;
  if (root.type !== 'sheet') return null;
  if (root.ribbon?.id === id) return { kind: 'ribbon', list: [root.ribbon, ...(root.ribbons ?? [])], index: 0, part: root.ribbon };
  for (const kind of Object.keys(LISTS) as HeaderPartKind[]) {
    const list = (root[LISTS[kind]] ?? []) as HeaderPart[];
    const index = list.findIndex((p) => p.id === id);
    if (index !== -1) return { kind, list: kind === 'ribbon' && root.ribbon ? [root.ribbon, ...list] : list, index: kind === 'ribbon' && root.ribbon ? index + 1 : index, part: list[index] };
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
    let found = findHeaderPart(draft, id);
    if (!found) throw new Refusal((w) => w.refusals.noHeaderPart(id));
    // A page's one ribbon joins the list of ribbons once one is edited: they are moved and taken away alike.
    const root = draft.layout as SheetNode;
    if (found.kind === 'ribbon' && root.ribbon) {
      root.ribbons = [root.ribbon, ...(root.ribbons ?? [])];
      delete root.ribbon;
      found = findHeaderPart(draft, id) as NonNullable<typeof found>;
    }
    return found;
  };
  const alertOf = (draft: Page, id: string): Alert => {
    const found = partOf(draft, id);
    if (found.kind !== 'alert') throw new Refusal((w) => w.refusals.onlyAlertButtons);
    return found.part as Alert;
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
        else if (kind === 'ribbon') {
          // The one ribbon a page had joins the list, first.
          root.ribbons = [...(root.ribbon ? [root.ribbon] : []), ...(root.ribbons ?? []), { id: created, label: words, tone: 'success' }];
          delete root.ribbon;
        } else if (kind === 'alert') root.alerts = [...(root.alerts ?? []), { id: created, message: words, tone: 'info' }];
        else root.badges = [...(root.badges ?? []), { id: created, label: words, tone: 'muted' }];
      });
      if (!ok) return false;
      context.select(created);
      return created;
    },

    updateHeaderPart(id, patch) {
      const typing = Object.keys(patch).length === 1 && ('label' in patch || 'action' in patch || 'confirm' in patch || 'tooltip' in patch);
      return apply(
        (draft) => {
          const { kind, part } = partOf(draft, id);
          if (patch.label !== undefined) {
            if (kind === 'alert') (part as Alert).message = patch.label;
            else (part as Exclude<HeaderPart, Alert>).label = patch.label;
          }
          if (patch.action !== undefined) {
            if (kind === 'badge' || kind === 'ribbon' || kind === 'alert') throw new Refusal((w) => w.refusals.badgeNoAction);
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
            if (kind !== 'badge' && kind !== 'ribbon' && kind !== 'alert') throw new Refusal((w) => w.refusals.onlyBadgeTone);
            (part as Badge).tone = patch.tone;
          }
          if (patch.wordsField !== undefined) {
            if (kind !== 'ribbon' && kind !== 'alert') throw new Refusal((w) => w.refusals.onlyRibbonAlertField);
            const key = kind === 'ribbon' ? 'labelField' : 'messageField';
            if (!patch.wordsField) delete (part as Ribbon & Alert)[key];
            else {
              fieldFor(draft, patch.wordsField);
              (part as Ribbon & Alert)[key] = patch.wordsField;
            }
            prune(draft);
          }
          if (patch.tooltip !== undefined) {
            if (kind !== 'ribbon') throw new Refusal((w) => w.refusals.onlyRibbonTooltip);
            if (patch.tooltip.trim()) (part as Ribbon).tooltip = patch.tooltip;
            else delete (part as Ribbon).tooltip;
          }
          if (patch.dismissible !== undefined) {
            if (kind !== 'alert') throw new Refusal((w) => w.refusals.onlyAlertCloses);
            if (patch.dismissible) (part as Alert).dismissible = true;
            else delete (part as Alert).dismissible;
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
            if (kind === 'ribbon' || kind === 'alert') throw new Refusal((w) => w.refusals.onlySomeIcons);
            const own = part as ButtonNode | StatButton | Badge;
            if (patch.icon) own.icon = patch.icon;
            else delete own.icon;
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

    addAlertButton(alertId, label) {
      let created = '';
      const words = label.trim();
      const ok = apply((draft) => {
        const alert = alertOf(draft, alertId);
        if (!words) throw new Refusal((w) => w.refusals.headerNeedsWords);
        const ids = allIds(draft);
        created = nextName((id) => ids.has(id), `${alertId}-button`, '-');
        alert.buttons = [...(alert.buttons ?? []), { type: 'button', id: created, label: words, action: actionName(words) }];
      });
      return ok ? created : false;
    },

    updateAlertButton(alertId, buttonId, patch) {
      const typing = Object.keys(patch).length === 1;
      return apply(
        (draft) => {
          const button = alertOf(draft, alertId).buttons?.find((b) => b.id === buttonId);
          if (!button) throw new Refusal((w) => w.refusals.noHeaderPart(buttonId));
          if (patch.label !== undefined) button.label = patch.label;
          if (patch.action !== undefined) {
            if (!patch.action.trim()) throw new Refusal((w) => w.refusals.buttonAction);
            button.action = patch.action.trim();
          }
        },
        typing ? `alert-button:${Object.keys(patch)[0]}:${buttonId}` : null
      );
    },

    removeAlertButton(alertId, buttonId) {
      return apply((draft) => {
        const alert = alertOf(draft, alertId);
        const kept = (alert.buttons ?? []).filter((b) => b.id !== buttonId);
        if (kept.length === (alert.buttons ?? []).length) throw new Refusal((w) => w.refusals.noHeaderPart(buttonId));
        if (kept.length) alert.buttons = kept;
        else delete alert.buttons;
      });
    },
  };
}
