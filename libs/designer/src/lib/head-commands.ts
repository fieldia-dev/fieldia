import type { ButtonNode, Field, FieldNode, HeadLink, LayoutNode, MenuItem, Page, SheetHead, SheetNode, TabNode, TabsNode } from '@fieldia/core';
import { allIds, findNode, findTab, keptFields, nextName, tabsNodes } from './page-tree';
import { Refusal } from './refusal';
import type { DesignerWords } from './designer-words';

/**
 * A record's head (`SheetHead`), as the designer edits it: turned on with a
 * work item's buttons, its kind's field and looks, its number, Copy title,
 * its row's fields and count links, its band's fields with their columns and
 * labels' width, "Updated by"; and the parts it brought to the format — a
 * button's icon alone, toggle and menu, a tab's icon and count, tabs in the
 * head, a field's access key. Each edit is one undo step; typing in one box
 * merges into one.
 */

export interface HeadPatch {
  /** The field holding the kind (a choice or a link), or null for one kind named by `kindLabel`. */
  kindField?: string | null;
  kindLabel?: string | null;
  /** The field holding the record's number, or null for the record's id. */
  numberField?: string | null;
  /** The one kind's colour (#rrggbb) and icon, or null for none. */
  colour?: string | null;
  icon?: string | null;
  copyTitle?: boolean;
  /** The band's columns' widths ("274px", "50%", "1fr"), or null for two even ones. */
  tracks?: string[] | null;
  /** The band's labels' width in pixels, or null for 76. */
  labelWidth?: number | null;
  /** "Updated by" from a field naming who and a date, the tab it opens; null takes it away. */
  updated?: { byField: string; atField: string; opens?: string | null } | null;
}

/** What a part of the head's row may change: a count link's field, words and target. */
export interface HeadLinkPatch {
  field?: string;
  one?: string;
  other?: string;
  /** The part it takes the reader to, by id; empty for none. */
  target?: string;
  icon?: string;
}

/** A button's own parts, wherever it stands: a value sets, null takes away. */
export interface ButtonPartsPatch {
  iconOnly?: boolean | null;
  icon?: string | null;
  /** A toggle: a yes/no field it is pressed while it holds, or null for none. */
  pressed?: string | null;
  pressedLabel?: string | null;
  primaryWhenChanged?: boolean | null;
  menuIcon?: string | null;
  menuLabel?: string | null;
  /** Its menu's items, in order (words and an action each); null or none takes the menu away. */
  menu?: { id?: string; label: string; action: string }[] | null;
}

export interface HeadCommands {
  /** The sheet's head: `null` takes it away; a patch turns it on (with Save and Close, Refresh and Undo) and sets its own settings. */
  setHead(patch: HeadPatch | null): boolean;
  /** A kind's colour and icon, by the kind field's value; `null` takes its look away. */
  setHeadKindLook(value: string, look: { colour: string; icon?: string } | null): boolean;
  /** A field in the row under the title or on the band, a count link in the row, or a button at the row's end. Returns its id. */
  addHeadPart(where: 'meta' | 'band' | 'actions', what: { field?: string; link?: string; button?: string }): string | false;
  /** A count link's field, words or target; a row's or band's field's field. */
  updateHeadLink(id: string, patch: HeadLinkPatch): boolean;
  /** Put a field of the row or the band to show another field. */
  setHeadField(id: string, field: string): boolean;
  removeHeadPart(id: string): boolean;
  moveHeadPart(id: string, delta: number): boolean;
  /** A button's icon alone, toggle, menu and look while the record has changes: a head's, a header's or one in a group. */
  setButtonParts(id: string, patch: ButtonPartsPatch): boolean;
  /** A tab's icon, shown alone or not, and the field whose count shows after it. */
  setTabParts(id: string, patch: { iconOnly?: boolean; icon?: string | null; count?: string | null }): boolean;
  /** Tabs directly in a sheet with a head, put in the head's band (true) or left over the body. */
  setTabsInHead(id: string, inHead: boolean): boolean;
  /** A field's access key — one letter or digit of its label, with Alt — or `null` for none. */
  setFieldHotkey(id: string, key: string | null): boolean;
}

export interface HeadCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  select(id: string): void;
  model: Record<string, Field>;
  /** The designer's words, for the head's first buttons: in its language. */
  words: DesignerWords;
}

const COLOUR = /^#[0-9a-fA-F]{6}$/;
const TRACK = /^\d+(\.\d+)?(px|%|fr)$/;
const NUMBER = new Set(['integer', 'float', 'monetary']);
const COUNTED = new Set(['integer', 'float', 'monetary', 'one2many', 'many2many', 'binary', 'image']);

/** The head's first buttons, as a work item has them: Save and Close with Save beside it, Refresh and Undo by their icons. */
export function starterActions(ids: Set<string>, words: { saveClose: string; save: string; refresh: string; undo: string }): ButtonNode[] {
  const id = (prefix: string) => {
    const made = nextName((name) => ids.has(name), prefix, '-');
    ids.add(made);
    return made;
  };
  return [
    { type: 'button', id: id('save-close'), label: words.saveClose, icon: 'save', primaryWhenChanged: true, steps: [{ do: 'save' }, { do: 'close' }], menu: [{ id: id('menu-save'), label: words.save, icon: 'save', steps: [{ do: 'save' }] }] },
    { type: 'button', id: id('refresh'), label: words.refresh, icon: 'refresh', iconOnly: true, steps: [{ do: 'reload' }] },
    { type: 'button', id: id('undo'), label: words.undo, icon: 'undo', iconOnly: true, steps: [{ do: 'reset' }] },
  ];
}

/** Words as an action's name: "Follow all changes" is `follow_all_changes`. */
const actionName = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'action';

/** Where a new count takes the reader: the first of the tabs in the head, else the first tab, else the first group with a title. */
function firstPlace(page: Page): string | undefined {
  const root = page.layout;
  const inHead = root.type === 'sheet' ? root.children.find((child): child is TabsNode => child.type === 'tabs' && child.place === 'head') : undefined;
  const tab = inHead?.children[0] ?? tabsNodes(page)[0]?.children[0];
  if (tab) return tab.id;
  const walk = (nodes: readonly LayoutNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.type === 'section' && node.title) return node.id;
      if (node.type === 'section') {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return undefined;
  };
  return root.type === 'sheet' || root.type === 'sections' ? walk(root.children) : undefined;
}

export function headCommands(deps: HeadCommandsDeps): HeadCommands {
  const { apply, model } = deps;
  const sheetOf = (draft: Page): SheetNode => {
    if (draft.layout.type !== 'sheet') throw new Refusal((w) => w.head.onlySheet);
    return draft.layout;
  };
  const headOf = (draft: Page): SheetHead => {
    const head = sheetOf(draft).head;
    if (!head) throw new Refusal((w) => w.head.noHead);
    return head;
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
    const kept = keptFields(draft);
    for (const name of Object.keys(draft.fields)) if (!kept.has(name)) delete draft.fields[name];
  };
  /** A part of the head by its id: which list it is in, and where. */
  const partOf = (draft: Page, id: string): { list: (FieldNode | HeadLink | ButtonNode | LayoutNode)[]; index: number; where: 'meta' | 'band' | 'actions' } => {
    const head = headOf(draft);
    for (const [where, list] of [['meta', head.meta], ['band', head.band?.children], ['actions', head.actions]] as const) {
      const index = (list ?? []).findIndex((part) => part.id === id);
      if (index !== -1) return { list: list as (FieldNode | HeadLink | ButtonNode | LayoutNode)[], index, where };
    }
    throw new Refusal((w) => w.head.noPart(id));
  };
  /** A button by its id, wherever it is: the head's, the header's, a group's, an alert's. */
  const buttonOf = (draft: Page, id: string): ButtonNode => {
    const root = draft.layout;
    const found = findNode(draft, id)?.node;
    if (found?.type === 'button') return found;
    if (root.type === 'sheet') {
      const own = [...(root.head?.actions ?? []), ...(root.buttons ?? []), ...(root.footer ?? []), ...(root.alerts ?? []).flatMap((alert) => alert.buttons ?? [])].find((button) => button.id === id);
      if (own) return own;
    }
    if (root.type === 'sections') {
      const own = root.footer?.find((button) => button.id === id);
      if (own) return own;
    }
    throw new Refusal((w) => w.head.noButton(id));
  };

  return {
    setHead(patch) {
      return apply((draft) => {
        const root = sheetOf(draft);
        if (patch === null) {
          delete root.head;
          // Tabs that were in it go back over the body.
          for (const tabs of tabsNodes(draft)) delete tabs.place;
          prune(draft);
          return;
        }
        const head: SheetHead = root.head ?? { actions: starterActions(allIds(draft), deps.words.head.starter) };
        root.head = head;
        if ('kindField' in patch || 'kindLabel' in patch || 'numberField' in patch || 'colour' in patch || 'icon' in patch) {
          const kind = { ...head.kind };
          if (patch.kindField === null) {
            delete kind.field;
            delete kind.looks;
          } else if (patch.kindField !== undefined) {
            const def = fieldFor(draft, patch.kindField);
            if ((def.type !== 'selection' || def.multiple) && def.type !== 'many2one') throw new Refusal((w) => w.head.kindOneOfList(def.label));
            if (kind.field !== patch.kindField) delete kind.looks;
            kind.field = patch.kindField;
          }
          if (patch.kindLabel === null || patch.kindLabel?.trim() === '') delete kind.label;
          else if (patch.kindLabel !== undefined) kind.label = patch.kindLabel;
          if (patch.numberField === null) delete kind.numberField;
          else if (patch.numberField !== undefined) {
            const def = fieldFor(draft, patch.numberField);
            if (!['integer', 'float', 'char'].includes(def.type)) throw new Refusal((w) => w.head.numberShape(def.label));
            kind.numberField = patch.numberField;
          }
          if (patch.colour === null) delete kind.colour;
          else if (patch.colour !== undefined) {
            if (!COLOUR.test(patch.colour)) throw new Refusal((w) => w.head.colourShape);
            kind.colour = patch.colour.toLowerCase();
          }
          if (patch.icon === null || patch.icon === '') delete kind.icon;
          else if (patch.icon !== undefined) kind.icon = patch.icon;
          if (Object.keys(kind).length) head.kind = kind;
          else delete head.kind;
        }
        if (patch.copyTitle !== undefined) {
          if (patch.copyTitle) delete head.copyTitle;
          else head.copyTitle = false;
        }
        if (patch.tracks !== undefined || patch.labelWidth !== undefined) {
          const band = head.band ?? { children: [] };
          if (patch.tracks === null || patch.tracks?.length === 0) delete band.tracks;
          else if (patch.tracks !== undefined) {
            const tracks = patch.tracks.map((track) => track.trim()).filter(Boolean);
            if (tracks.length > 4 || tracks.some((track) => !TRACK.test(track))) throw new Refusal((w) => w.head.tracksShape);
            band.tracks = tracks;
          }
          if (patch.labelWidth === null) delete band.labelWidth;
          else if (patch.labelWidth !== undefined) {
            if (!Number.isInteger(patch.labelWidth) || patch.labelWidth < 48 || patch.labelWidth > 320) throw new Refusal((w) => w.head.labelWidthShape);
            band.labelWidth = patch.labelWidth;
          }
          head.band = band;
        }
        if (patch.updated === null) delete head.updated;
        else if (patch.updated) {
          fieldFor(draft, patch.updated.byField);
          const at = fieldFor(draft, patch.updated.atField);
          if (at.type !== 'date' && at.type !== 'datetime') throw new Refusal((w) => w.head.datesOnly(at.label));
          if (patch.updated.opens && !findTab(draft, patch.updated.opens)) throw new Refusal((w) => w.head.noTabNamed(patch.updated?.opens ?? ''));
          head.updated = { byField: patch.updated.byField, atField: patch.updated.atField, ...(patch.updated.opens ? { opens: patch.updated.opens } : {}) };
        }
        prune(draft);
      }, patch && Object.keys(patch).length === 1 && ('kindLabel' in patch || 'tracks' in patch || 'labelWidth' in patch) ? `head:${Object.keys(patch)[0]}` : null);
    },

    setHeadKindLook(value, look) {
      return apply((draft) => {
        const head = headOf(draft);
        const kind = head.kind;
        if (!kind?.field) throw new Refusal((w) => w.head.looksNeedField);
        const looks = { ...kind.looks };
        if (look === null) delete looks[value];
        else {
          if (!COLOUR.test(look.colour)) throw new Refusal((w) => w.head.colourShape);
          looks[value] = { colour: look.colour.toLowerCase(), ...(look.icon ? { icon: look.icon } : {}) };
        }
        if (Object.keys(looks).length) kind.looks = looks;
        else delete kind.looks;
      }, `head:look:${value}`);
    },

    addHeadPart(where, what) {
      let created = '';
      const ok = apply((draft) => {
        const head = headOf(draft);
        const ids = allIds(draft);
        if (where === 'actions') {
          const words = (what.button ?? '').trim();
          if (!words) throw new Refusal((w) => w.refusals.headerNeedsWords);
          created = nextName((name) => ids.has(name), 'button', '-');
          head.actions = [...(head.actions ?? []), { type: 'button', id: created, label: words, action: actionName(words) }];
          return;
        }
        if (what.link !== undefined) {
          if (where !== 'meta') throw new Refusal((w) => w.head.linksInRow);
          const def = fieldFor(draft, what.link);
          if (!NUMBER.has(def.type)) throw new Refusal((w) => w.head.linkNeedsNumber(def.label));
          created = nextName((name) => ids.has(name), 'link', '-');
          // It takes the reader somewhere from the start, where there is somewhere: the first tab of the head's, else the first group with a title.
          const target = firstPlace(draft);
          head.meta = [...(head.meta ?? []), { type: 'link', id: created, icon: 'chat', field: what.link, words: { other: def.label }, ...(target ? { target } : {}) }];
          return;
        }
        const name = what.field ?? '';
        fieldFor(draft, name);
        created = nextName((id) => ids.has(id), `${where === 'band' ? 'band' : 'row'}-${name.replace(/[^A-Za-z0-9_-]/g, '-')}`, '-');
        const node: FieldNode = { type: 'field', id: created, field: name, ...(where === 'meta' ? { labels: 'hidden' as const } : {}) };
        if (where === 'meta') head.meta = [...(head.meta ?? []), node];
        else head.band = { ...head.band, children: [...(head.band?.children ?? []), node] };
      });
      if (!ok) return false;
      if (where === 'actions') deps.select(created);
      return created;
    },

    updateHeadLink(id, patch) {
      const typing = Object.keys(patch).length === 1 && ('one' in patch || 'other' in patch);
      return apply((draft) => {
        const { list, index } = partOf(draft, id);
        const link = list[index] as HeadLink;
        if (link.type !== 'link') throw new Refusal((w) => w.head.noPart(id));
        if (patch.field !== undefined) {
          const def = fieldFor(draft, patch.field);
          if (!NUMBER.has(def.type)) throw new Refusal((w) => w.head.linkNeedsNumber(def.label));
          link.field = patch.field;
        }
        if (patch.other !== undefined) {
          if (!patch.other.trim()) throw new Refusal((w) => w.head.linkNeedsWords);
          link.words = { ...link.words, other: patch.other };
        }
        if (patch.one !== undefined) {
          const words = { ...link.words };
          if (patch.one.trim()) words.one = patch.one;
          else delete words.one;
          link.words = words;
        }
        if (patch.target !== undefined) {
          if (patch.target) link.target = patch.target;
          else delete link.target;
        }
        if (patch.icon !== undefined) {
          if (patch.icon) link.icon = patch.icon;
          else delete link.icon;
        }
        prune(draft);
      }, typing ? `head-link:${Object.keys(patch)[0]}:${id}` : null);
    },

    setHeadField(id, field) {
      return apply((draft) => {
        const { list, index } = partOf(draft, id);
        const node = list[index];
        if (node.type !== 'field') throw new Refusal((w) => w.head.noPart(id));
        fieldFor(draft, field);
        node.field = field;
        prune(draft);
      });
    },

    removeHeadPart(id) {
      return apply((draft) => {
        const head = headOf(draft);
        const { list, index, where } = partOf(draft, id);
        list.splice(index, 1);
        if (!list.length) {
          if (where === 'meta') delete head.meta;
          if (where === 'actions') delete head.actions;
        }
        prune(draft);
      });
    },

    moveHeadPart(id, delta) {
      return apply((draft) => {
        const { list, index } = partOf(draft, id);
        const to = index + delta;
        if (to < 0 || to >= list.length) throw new Refusal((w) => w.refusals.cannotMoveFurther);
        const [moved] = list.splice(index, 1);
        list.splice(to, 0, moved);
      });
    },

    setButtonParts(id, patch) {
      const typing = Object.keys(patch).length === 1 && ('pressedLabel' in patch || 'menuLabel' in patch || 'menu' in patch);
      return apply((draft) => {
        const button = buttonOf(draft, id);
        if (patch.icon === null || patch.icon === '') delete button.icon;
        else if (patch.icon !== undefined) button.icon = patch.icon;
        if (patch.iconOnly === null || patch.iconOnly === false) delete button.iconOnly;
        else if (patch.iconOnly) {
          if (!button.icon) throw new Refusal((w) => w.head.iconOnlyNeedsIcon);
          button.iconOnly = true;
        }
        if (button.iconOnly && !button.icon) throw new Refusal((w) => w.head.iconOnlyNeedsIcon);
        if (patch.pressed === null || patch.pressed === '') {
          delete button.pressed;
          delete button.pressedLabel;
        } else if (patch.pressed !== undefined) {
          const def = fieldFor(draft, patch.pressed);
          if (def.type !== 'boolean') throw new Refusal((w) => w.head.toggleYesNo(def.label));
          button.pressed = patch.pressed;
        }
        if (patch.pressedLabel === null || patch.pressedLabel?.trim() === '') delete button.pressedLabel;
        else if (patch.pressedLabel !== undefined) {
          if (button.pressed === undefined) throw new Refusal((w) => w.head.pressedWordsNeedToggle);
          button.pressedLabel = patch.pressedLabel;
        }
        if (patch.primaryWhenChanged === null || patch.primaryWhenChanged === false) delete button.primaryWhenChanged;
        else if (patch.primaryWhenChanged) button.primaryWhenChanged = true;
        if (patch.menu === null || patch.menu?.length === 0) {
          delete button.menu;
          delete button.menuIcon;
          delete button.menuLabel;
          if (!button.steps && button.action === undefined) button.action = actionName(button.label);
        } else if (patch.menu !== undefined) {
          const ids = allIds(draft);
          for (const item of button.menu ?? []) ids.delete(item.id);
          button.menu = patch.menu.map((item): MenuItem => {
            const own = item.id && button.menu?.find((one) => one.id === item.id);
            const id = own ? own.id : nextName((name) => ids.has(name), `${button.id}-menu`, '-');
            ids.add(id);
            return { ...(own ? own : {}), id, label: item.label, action: item.action.trim() || actionName(item.label) };
          });
        }
        if (patch.menuIcon === null || patch.menuIcon === '') delete button.menuIcon;
        else if (patch.menuIcon !== undefined) {
          if (!button.menu?.length) throw new Refusal((w) => w.head.chevronNeedsMenu);
          button.menuIcon = patch.menuIcon;
        }
        if (patch.menuLabel === null || patch.menuLabel?.trim() === '') delete button.menuLabel;
        else if (patch.menuLabel !== undefined) {
          if (!button.menu?.length) throw new Refusal((w) => w.head.chevronNeedsMenu);
          button.menuLabel = patch.menuLabel;
        }
        prune(draft);
      }, typing ? `button-parts:${Object.keys(patch)[0]}:${id}` : null);
    },

    setTabParts(id, patch) {
      return apply((draft) => {
        const found = findTab(draft, id);
        if (!found) throw new Refusal((w) => w.head.noTabNamed(id));
        const tab: TabNode = found.tab;
        if (patch.icon === null || patch.icon === '') delete tab.icon;
        else if (patch.icon !== undefined) tab.icon = patch.icon;
        if (patch.iconOnly === false) delete tab.iconOnly;
        else if (patch.iconOnly) tab.iconOnly = true;
        if (tab.iconOnly && !tab.icon) throw new Refusal((w) => w.head.iconOnlyNeedsIcon);
        if (patch.count === null || patch.count === '') delete tab.count;
        else if (patch.count !== undefined) {
          const def = fieldFor(draft, patch.count);
          if (!COUNTED.has(def.type)) throw new Refusal((w) => w.head.countShape(def.label));
          tab.count = patch.count;
        }
        prune(draft);
      });
    },

    setTabsInHead(id, inHead) {
      return apply((draft) => {
        const root = sheetOf(draft);
        const tabs = root.children.find((child): child is TabsNode => child.type === 'tabs' && child.id === id);
        if (!tabs || (inHead && !root.head)) throw new Refusal((w) => w.head.tabsDirectlyInHead);
        if (inHead) {
          for (const other of tabsNodes(draft)) delete other.place;
          tabs.place = 'head';
        } else delete tabs.place;
      });
    },

    setFieldHotkey(id, key) {
      return apply((draft) => {
        const root = draft.layout;
        const node = findNode(draft, id)?.node ?? (root.type === 'sheet' ? [...(root.head?.meta ?? []), ...(root.head?.band?.children ?? [])].find((part) => part.id === id) : undefined);
        if (!node || node.type !== 'field') throw new Refusal((w) => w.refusals.noField(id));
        const typed = (key ?? '').trim().toLowerCase().replace(/^alt\+/, '');
        if (!typed) {
          delete node.hotkey;
          return;
        }
        if (!/^[a-z0-9]$/.test(typed)) throw new Refusal((w) => w.head.accessKeyShape);
        node.hotkey = typed;
      }, `hotkey:${id}`);
    },
  };
}
