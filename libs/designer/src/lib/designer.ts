import {
  validatePage,
  wideColumns,
  type Field,
  type FieldNode,
  type LayoutNode,
  type Option,
  type Page,
  type SectionNode,
  type SheetNode,
  type StepNode,
  type TabsNode,
} from '@fieldia/core';
import { allIds, containers, findContainer, findNode, findTab, firstSection, nextName, shownFields } from './page-tree';

/**
 * The editing model behind the designer: no DOM, so it is tested in Node.
 *
 * Every edit is a command that produces a new page. The page is validated
 * before it replaces the old one, so an edit that would break the page is
 * refused with the reason, never applied. Each edit is one undo step; a run of
 * typing in one label merges into one. Drafts are saved apart from published
 * versions, so editing never changes a form people are filling in.
 */

export interface QuestionKind {
  id: string;
  label: string;
  field: (label: string) => Field;
  widget?: string;
}

const firstOption = (): Option[] => [{ value: 'option_1', label: 'Option 1' }];

export const QUESTION_KINDS: readonly QuestionKind[] = [
  { id: 'short-answer', label: 'Short answer', field: (label) => ({ type: 'char', label }) },
  { id: 'paragraph', label: 'Paragraph', field: (label) => ({ type: 'text', label }) },
  { id: 'multiple-choice', label: 'Multiple choice', field: (label) => ({ type: 'selection', label, options: firstOption() }), widget: 'radio' },
  { id: 'checkboxes', label: 'Checkboxes', field: (label) => ({ type: 'selection', label, options: firstOption(), multiple: true }), widget: 'checkboxes' },
  { id: 'dropdown', label: 'Dropdown', field: (label) => ({ type: 'selection', label, options: firstOption() }) },
  { id: 'rating', label: 'Rating', field: (label) => ({ type: 'integer', label, min: 1, max: 5 }), widget: 'rating' },
  { id: 'scale', label: 'Linear scale', field: (label) => ({ type: 'integer', label, min: 0, max: 10 }), widget: 'scale' },
  { id: 'number', label: 'Number', field: (label) => ({ type: 'float', label }) },
  { id: 'date', label: 'Date', field: (label) => ({ type: 'date', label }) },
  { id: 'date-time', label: 'Date and time', field: (label) => ({ type: 'datetime', label }) },
  { id: 'yes-no', label: 'Yes or no', field: (label) => ({ type: 'boolean', label }), widget: 'toggle' },
  { id: 'email', label: 'Email', field: (label) => ({ type: 'char', label, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' }), widget: 'email' },
  { id: 'phone', label: 'Phone', field: (label) => ({ type: 'char', label }), widget: 'phone' },
  { id: 'file', label: 'File upload', field: (label) => ({ type: 'binary', label, maxSize: 10 * 1024 * 1024 }) },
];

/** What a page is for: a survey (wizard of steps), an app screen (sections), or a record's sheet. */
export type PageKind = 'survey' | 'screen' | 'sheet';

const slug = (text: string, sep = '_') =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '') || 'page';

export function blankPage(kind: PageKind, title: string): Page {
  const id = slug(title, '-');
  if (kind === 'survey') {
    return {
      fieldia: '0.1',
      id,
      title,
      data: { kind: 'responses' },
      fields: {},
      layout: { type: 'wizard', id: 'steps', children: [{ type: 'step', id: 'step-1', label: 'Page 1', children: [] }] },
    };
  }
  if (kind === 'sheet') {
    // A record named in big letters at the top, as a business record is.
    return {
      fieldia: '0.1',
      id,
      title,
      data: { kind: 'record', model: slug(title, '.') },
      fields: { name: { type: 'char', label: 'Name', required: true } },
      layout: { type: 'sheet', id: 'sheet', title: { field: 'name', placeholder: 'Name' }, children: [{ type: 'section', id: 'section-1', columns: 2, children: [] }] },
    };
  }
  return {
    fieldia: '0.1',
    id,
    title,
    data: { kind: 'record', model: slug(title, '.') },
    fields: {},
    layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'section-1', title: 'Section 1', columns: 2, children: [] }] },
  };
}

export interface PublishedVersion {
  version: number;
  publishedAt: string;
  page: Page;
}

/** Where pages are kept. An app implements this for its own storage. */
export interface PageStore {
  load(id: string): Promise<{ draft: Page | null; versions: PublishedVersion[] }>;
  saveDraft(page: Page): Promise<void>;
  publish(page: Page): Promise<number>;
}

export function createMemoryPageStore(): PageStore & { pages: Map<string, { draft: Page | null; versions: PublishedVersion[] }> } {
  const pages = new Map<string, { draft: Page | null; versions: PublishedVersion[] }>();
  const entry = (id: string) => {
    if (!pages.has(id)) pages.set(id, { draft: null, versions: [] });
    return pages.get(id) as { draft: Page | null; versions: PublishedVersion[] };
  };
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  return {
    pages,
    async load(id) {
      const found = entry(id);
      return copy({ draft: found.draft, versions: found.versions });
    },
    async saveDraft(page) {
      entry(page.id).draft = copy(page);
    },
    async publish(page) {
      const found = entry(page.id);
      const version = found.versions.length + 1;
      found.versions.push({ version, publishedAt: new Date().toISOString(), page: copy(page) });
      return version;
    },
  };
}

export interface DesignerState {
  page: Page;
  /** The element being edited. */
  selected: string | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Why the last edit was refused. Empty when it was applied. */
  issues: string[];
  /** The draft differs from the last published version. */
  unpublished: boolean;
  versions: readonly PublishedVersion[];
}

export interface QuestionPatch {
  label?: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
}

export interface Designer {
  getPage(): Page;
  getState(): DesignerState;
  subscribe(listener: (state: DesignerState) => void): () => void;
  select(id: string | null): void;
  /** Add a question after `after`, or at the end of `parent` (or of the last container). Returns its id. */
  addQuestion(kind: string, where?: { after?: string; parent?: string }): string | false;
  updateQuestion(id: string, patch: QuestionPatch): boolean;
  setOptions(id: string, labels: string[]): boolean;
  changeKind(id: string, kind: string): boolean;
  moveNode(id: string, delta: number): boolean;
  placeNode(id: string, parent: string, index: number): boolean;
  duplicateNode(id: string): string | false;
  removeNode(id: string): boolean;
  /** A step for a survey, a section for a screen or a sheet, or a section in a tab (`parent`). Returns its id. */
  addContainer(label: string, where?: { parent?: string }): string | false;
  /** A screen of sections becomes a sheet, or a sheet without tabs a screen of sections. */
  setLayoutKind(kind: 'sections' | 'sheet'): boolean;
  /** A sheet's title: a text field taken out of its section, or `null` to put it back first in the first section. */
  setTitleField(nodeId: string | null): boolean;
  /** Tabs on a sheet, after `after` or at the end: one tab, with a section. Returns the tabs' id. */
  addTabs(where?: { after?: string }): string | false;
  /** One more tab, with a section. Returns its id. */
  addTab(tabsId: string, label: string): string | false;
  renameContainer(id: string, label: string): boolean;
  /** Show an element only when a field has a value; `null` always shows it. */
  setCondition(id: string, condition: { field: string; equals: string | number | boolean } | null): boolean;
  setColumns(sectionId: string, columns: 1 | 2 | 3 | 4): boolean;
  setColspan(nodeId: string, span: number): boolean;
  /** Put a section's fields in this order with these widths, as one edit (a canvas drag). */
  arrangeSection(sectionId: string, items: { id: string; colspan: number }[]): boolean;
  setPageInfo(info: { title?: string; description?: string }): boolean;
  undo(): void;
  redo(): void;
  /** Publish the draft as the next version. Returns its number. */
  publish(): Promise<number>;
  /** Make a published version the draft again. Undoable. */
  revertTo(version: number): boolean;
  /** Resolves once every draft save started so far has finished. */
  settled(): Promise<void>;
}

/** Thrown by an edit that cannot be made; `apply` turns it into an issue. */
class Refusal extends Error {}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function kindOf(id: string): QuestionKind {
  const kind = QUESTION_KINDS.find((k) => k.id === id);
  if (!kind) throw new Error(`Unknown question kind "${id}"`);
  return kind;
}

export function createDesigner(options: { page: Page; store?: PageStore; versions?: PublishedVersion[] }): Designer {
  const store = options.store;
  let page = clone(options.page);
  let selected: string | null = null;
  let issues: string[] = [];
  let past: Page[] = [];
  let future: Page[] = [];
  let mergeKey: string | null = null;
  let versions: PublishedVersion[] = clone(options.versions ?? []);
  const listeners = new Set<(state: DesignerState) => void>();
  let saving: Promise<void> = Promise.resolve();
  let saveAgain = false;
  let saveRunning = false;

  const published = () => versions[versions.length - 1]?.page ?? null;
  const state = (): DesignerState => ({
    page,
    selected,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    issues,
    unpublished: JSON.stringify(page) !== JSON.stringify(published()),
    versions,
  });
  const notify = () => {
    const snapshot = state();
    for (const listener of [...listeners]) listener(snapshot);
  };

  function saveDraft() {
    if (!store) return;
    if (saveRunning) {
      saveAgain = true;
      return;
    }
    saveRunning = true;
    saving = (async () => {
      do {
        saveAgain = false;
        await store.saveDraft(clone(page)).catch(() => undefined);
      } while (saveAgain);
      saveRunning = false;
    })();
  }

  /** Apply an edit to a copy, validate it, and keep it — or refuse it, saying why. */
  function apply(edit: (draft: Page) => void, merge: string | null = null): boolean {
    const draft = clone(page);
    try {
      edit(draft);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      issues = [error.message];
      notify();
      return false;
    }
    const checked = validatePage(draft);
    if (!checked.ok) {
      issues = checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
      notify();
      return false;
    }
    if (!(merge && merge === mergeKey)) past = [...past, page];
    mergeKey = merge;
    future = [];
    page = checked.page;
    issues = [];
    notify();
    saveDraft();
    return true;
  }

  function placeAfter(draft: Page, node: LayoutNode, where: { after?: string; parent?: string } = {}): void {
    if (where.after) {
      const found = findNode(draft, where.after);
      if (!found) throw new Refusal(`There is no element "${where.after}"`);
      found.parent.children.splice(found.index + 1, 0, node);
      return;
    }
    const all = containers(draft);
    const parent = where.parent ? all.find((c) => c.id === where.parent) : all[all.length - 1];
    if (!parent) throw new Refusal(`There is no step or section "${where.parent}"`);
    parent.children.push(node);
  }

  function fieldNode(draft: Page, id: string): FieldNode {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${id}"`);
    return found.node;
  }

  const designer: Designer = {
    getPage: () => page,
    getState: state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(id) {
      selected = id;
      notify();
    },

    addQuestion(kindId, where) {
      const kind = kindOf(kindId);
      let created = '';
      const ok = apply((draft) => {
        const ids = allIds(draft);
        const field = nextName((name) => name in draft.fields, 'q', '_');
        const id = nextName((name) => ids.has(name), 'q', '-');
        draft.fields[field] = kind.field('Untitled question');
        const node: FieldNode = { type: 'field', id, field, ...(kind.widget ? { widget: kind.widget } : {}) };
        created = id;
        placeAfter(draft, node, where);
      });
      if (!ok) return false;
      selected = created;
      notify();
      return created;
    },

    updateQuestion(id, patch) {
      const textOnly = Object.keys(patch).length === 1 && ('label' in patch || 'help' in patch || 'placeholder' in patch);
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
            const field = draft.fields[node.field] as Field & { help?: string; required?: boolean };
          if (patch.label !== undefined) field.label = patch.label;
          if (patch.required !== undefined) {
            if (patch.required) field.required = true;
            else delete field.required;
          }
          if (patch.help !== undefined) {
            if (patch.help) field.help = patch.help;
            else delete field.help;
          }
          if (patch.placeholder !== undefined) {
            if (patch.placeholder) node.placeholder = patch.placeholder;
            else delete node.placeholder;
          }
        },
        textOnly ? `${Object.keys(patch)[0]}:${id}` : null
      );
    },

    setOptions(id, labels) {
      return apply(
        (draft) => {
        const node = fieldNode(draft, id);
        const field = draft.fields[node.field];
        if (field.type !== 'selection') throw new Refusal(`"${id}" has no options`);
        const old = field.options;
        const used = new Set<string | number>();
        const placeholder = (o: Option | undefined) => !!o && /^option_\d+$/.test(String(o.value)) && /^Option \d+$/.test(o.label);
        field.options = labels
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label, i) => {
            // Keep a value the answers already use, unless it was a placeholder.
            let value: string | number = old[i] && !placeholder(old[i]) ? old[i].value : slug(label);
            while (used.has(value)) value = `${value}_${i + 1}`;
            used.add(value);
            return { value, label };
          });
        },
        // Typing in one option list is one undo step, like typing in a label.
        `options:${id}:${labels.length}`
      );
    },

    changeKind(id, kindId) {
      const kind = kindOf(kindId);
      return apply((draft) => {
        const node = fieldNode(draft, id);
        const old = draft.fields[node.field] as Field & { help?: string; required?: boolean };
        const next = kind.field(old.label) as Field & { help?: string; required?: boolean };
        if (old.type === 'selection' && next.type === 'selection') next.options = old.options;
        if (old.help) next.help = old.help;
        if (old.required) next.required = true;
        draft.fields[node.field] = next;
        if (kind.widget) node.widget = kind.widget;
        else delete node.widget;
      });
    },

    moveNode(id, delta) {
      return apply((draft) => {
        const found = findNode(draft, id);
        const tab = found ? null : findTab(draft, id);
        const list = (found?.parent.children ?? tab?.tabs.children) as { id: string }[] | undefined;
        const index = found?.index ?? tab?.index;
        if (!list || index === undefined) throw new Refusal(`There is no element "${id}"`);
        const to = index + delta;
        if (to < 0 || to >= list.length) throw new Refusal('It cannot move further');
        const [moved] = list.splice(index, 1);
        list.splice(to, 0, moved);
      });
    },

    placeNode(id, parentId, index) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found) throw new Refusal(`There is no element "${id}"`);
        const parent = containers(draft).find((c) => c.id === parentId);
        if (!parent) throw new Refusal(`There is no step or section "${parentId}"`);
        found.parent.children.splice(found.index, 1);
        parent.children.splice(Math.max(0, Math.min(index, parent.children.length)), 0, found.node);
      });
    },

    duplicateNode(id) {
      let created = '';
      const ok = apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${id}"`);
        const ids = allIds(draft);
        const field = nextName((name) => name in draft.fields, 'q', '_');
        created = nextName((name) => ids.has(name), 'q', '-');
        draft.fields[field] = clone(draft.fields[found.node.field]);
        found.parent.children.splice(found.index + 1, 0, { ...clone(found.node), id: created, field });
      });
      return ok ? created : false;
    },

    removeNode(id) {
      const ok = apply((draft) => {
        const root = draft.layout as { id: string; children: { id: string }[] };
        const found = findNode(draft, id);
        const tab = found ? null : findTab(draft, id);
        const topIndex = root.children.findIndex((child) => child.id === id);
        if (topIndex !== -1) {
          // A whole page (wizard step), or what sits at the top of a screen or a sheet.
          if (root.children.length === 1) throw new Refusal('A page needs at least one step or section');
          root.children.splice(topIndex, 1);
        } else if (found) found.parent.children.splice(found.index, 1);
        else if (tab) {
          tab.tabs.children.splice(tab.index, 1);
          // Tabs with no tab left go too.
          if (!tab.tabs.children.length) {
            const holder = findNode(draft, tab.tabs.id);
            if (holder) holder.parent.children.splice(holder.index, 1);
          }
        } else throw new Refusal(`There is no element "${id}"`);
        // Drop the fields nothing shows any more.
        const shown = shownFields(draft);
        for (const name of Object.keys(draft.fields)) if (!shown.has(name)) delete draft.fields[name];
      });
      if (ok && selected === id) {
        selected = null;
        notify();
      }
      return ok;
    },

    addContainer(label, where = {}) {
      let created = '';
      const ok = apply((draft) => {
        const ids = allIds(draft);
        const root = draft.layout;
        const section = () => {
          created = nextName((name) => ids.has(name), 'section', '-');
          return { type: 'section' as const, id: created, title: label, columns: 2 as const, children: [] };
        };
        if (where.parent) {
          const tab = findTab(draft, where.parent);
          if (!tab) throw new Refusal(`There is no tab "${where.parent}"`);
          tab.tab.children.push(section());
        } else if (root.type === 'wizard') {
          created = nextName((name) => ids.has(name), 'step', '-');
          root.children.push({ type: 'step', id: created, label, children: [] });
        } else if (root.type === 'sections' || root.type === 'sheet') root.children.push(section());
        else throw new Refusal('This page has no steps or sections to add to');
      });
      return ok ? created : false;
    },

    setLayoutKind(kind) {
      return apply((draft) => {
        const root = draft.layout;
        if (root.type === kind) throw new Refusal(`It is a ${kind === 'sheet' ? 'sheet' : 'screen of sections'} already`);
        const ids = allIds(draft);
        const rootId = ids.has(kind) ? root.id : kind;
        if (kind === 'sheet') {
          if (root.type !== 'sections') throw new Refusal('Only a screen of sections becomes a sheet');
          draft.layout = { type: 'sheet', id: rootId, children: root.children };
          return;
        }
        if (root.type !== 'sheet') throw new Refusal('Only a sheet becomes a screen of sections');
        if (root.children.some((n) => n.type === 'tabs')) throw new Refusal('Take the tabs out first: a screen of sections has none');
        const parts = (['statusbar', 'buttons', 'statButtons', 'ribbon', 'alerts', 'badges', 'sidePanel'] as const).filter((part) => root[part] !== undefined);
        if (parts.length) throw new Refusal(`A screen of sections cannot show this sheet's ${parts.join(', ')}`);
        if (root.title) {
          const first = firstSection(draft);
          if (!first) throw new Refusal('A screen of sections needs a section for the title field');
          first.children.unshift({ type: 'field', id: nextName((name) => ids.has(name), 'q', '-'), field: root.title.field });
        }
        draft.layout = { type: 'sections', id: rootId, children: root.children };
      });
    },

    setTitleField(nodeId) {
      return apply((draft) => {
        const root = draft.layout as SheetNode;
        if (root.type !== 'sheet') throw new Refusal('Only a sheet has a title');
        const ids = allIds(draft);
        // The field that was the title goes where the new one was, or first in the first section.
        const old: FieldNode | null = root.title ? { type: 'field', id: nextName((name) => ids.has(name), 'q', '-'), field: root.title.field } : null;
        if (nodeId === null) {
          if (!old) return;
          delete root.title;
          const first = firstSection(draft);
          if (!first) throw new Refusal('The title field needs a section to go back to');
          first.children.unshift(old);
          return;
        }
        const found = findNode(draft, nodeId);
        if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${nodeId}"`);
        const def = draft.fields[found.node.field];
        if (def.type !== 'char') throw new Refusal('A title is a text field');
        found.parent.children.splice(found.index, 1, ...(old ? [old] : []));
        root.title = { field: found.node.field, placeholder: def.label };
      });
    },

    addTabs(where = {}) {
      let created = '';
      const ok = apply((draft) => {
        const root = draft.layout;
        if (root.type !== 'sheet') throw new Refusal('Tabs go on a sheet');
        const ids = allIds(draft);
        const name = (prefix: string) => {
          const id = nextName((n) => ids.has(n), prefix, '-');
          ids.add(id);
          return id;
        };
        created = name('tabs');
        const tabs: TabsNode = { type: 'tabs', id: created, children: [{ type: 'tab', id: name('tab'), label: 'Tab 1', children: [{ type: 'section', id: name('section'), columns: 2, children: [] }] }] };
        const after = where.after ? root.children.findIndex((n) => n.id === where.after) : -1;
        if (where.after && after === -1) throw new Refusal(`There is no element "${where.after}" on the sheet`);
        root.children.splice(after === -1 ? root.children.length : after + 1, 0, tabs);
      });
      return ok ? created : false;
    },

    addTab(tabsId, label) {
      let created = '';
      const ok = apply((draft) => {
        const holder = findNode(draft, tabsId);
        if (!holder || holder.node.type !== 'tabs') throw new Refusal(`There are no tabs "${tabsId}"`);
        const ids = allIds(draft);
        created = nextName((n) => ids.has(n), 'tab', '-');
        ids.add(created);
        holder.node.children.push({ type: 'tab', id: created, label, children: [{ type: 'section', id: nextName((n) => ids.has(n), 'section', '-'), columns: 2, children: [] }] });
      });
      return ok ? created : false;
    },

    renameContainer(id, label) {
      return apply(
        (draft) => {
          const container = findContainer(draft, id) as (StepNode | SectionNode) | null;
          if (!container) throw new Refusal(`There is no step or section "${id}"`);
          if ('label' in container) container.label = label;
          else (container as SectionNode).title = label;
        },
        `rename:${id}`
      );
    },

    setCondition(id, condition) {
      return apply((draft) => {
        const target = (findContainer(draft, id) as { invisible?: string } | null) ?? (findNode(draft, id)?.node as { invisible?: string } | undefined);
        if (!target) throw new Refusal(`There is no element "${id}"`);
        if (!condition) {
          delete target.invisible;
          return;
        }
        const { field, equals } = condition;
        const literal = typeof equals === 'string' ? `'${equals.replace(/'/g, '')}'` : typeof equals === 'boolean' ? (equals ? 'True' : 'False') : String(equals);
        target.invisible = `${field} != ${literal}`;
      });
    },

    setColumns(sectionId, columns) {
      return apply((draft) => {
        const section = findContainer(draft, sectionId) as SectionNode | null;
        if (!section || !('columns' in section || section.type === 'section')) throw new Refusal(`There is no section "${sectionId}"`);
        // Columns given per width keep their narrower counts, never more than the wide one.
        const given = section.columns;
        section.columns =
          typeof given === 'object'
            ? {
                wide: columns,
                ...(given.medium ? { medium: Math.min(given.medium, columns) as typeof columns } : {}),
                ...(given.narrow ? { narrow: Math.min(given.narrow, columns) as typeof columns } : {}),
              }
            : columns;
        for (const child of section.children) if (child.type === 'field' && (child.colspan ?? 1) > columns) child.colspan = columns;
      });
    },

    setColspan(nodeId, span) {
      return apply((draft) => {
        const found = findNode(draft, nodeId);
        if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${nodeId}"`);
        const columns = wideColumns((found.parent as SectionNode).columns);
        if (span > columns) throw new Refusal(`A field cannot be wider than its section's ${columns} columns`);
        if (span <= 1) delete found.node.colspan;
        else found.node.colspan = span;
      });
    },

    arrangeSection(sectionId, items) {
      return apply((draft) => {
        const section = findContainer(draft, sectionId) as SectionNode | null;
        if (!section) throw new Refusal(`There is no section "${sectionId}"`);
        const fields = section.children.filter((n): n is FieldNode => n.type === 'field');
        const others = section.children.filter((n) => n.type !== 'field');
        const byId = new Map(fields.map((n) => [n.id, n]));
        if (items.length !== fields.length || items.some((item) => !byId.has(item.id))) {
          throw new Refusal('The arrangement does not match the fields in this section');
        }
        const columns = wideColumns(section.columns);
        section.children = [
          ...items.map(({ id, colspan }) => {
            const node = byId.get(id) as FieldNode;
            const span = Math.max(1, Math.min(columns, Math.round(colspan)));
            if (span === 1) delete node.colspan;
            else node.colspan = span;
            return node;
          }),
          ...others,
        ];
      });
    },

    setPageInfo(info) {
      return apply(
        (draft) => {
          if (info.title !== undefined) draft.title = info.title;
          if (info.description !== undefined) {
            if (info.description) draft.description = info.description;
            else delete draft.description;
          }
        },
        `page:${Object.keys(info).join(',')}`
      );
    },

    undo() {
      const previous = past[past.length - 1];
      if (!previous) return;
      past = past.slice(0, -1);
      future = [page, ...future];
      page = previous;
      mergeKey = null;
      issues = [];
      notify();
      saveDraft();
    },

    redo() {
      const next = future[0];
      if (!next) return;
      future = future.slice(1);
      past = [...past, page];
      page = next;
      mergeKey = null;
      issues = [];
      notify();
      saveDraft();
    },

    async publish() {
      const checked = validatePage(page);
      if (!checked.ok) throw new Error('This page has problems and cannot be published');
      const version = store ? await store.publish(clone(page)) : versions.length + 1;
      versions = [...versions, { version, publishedAt: new Date().toISOString(), page: clone(page) }];
      notify();
      return version;
    },

    revertTo(version) {
      const found = versions.find((v) => v.version === version);
      if (!found) {
        issues = [`There is no version ${version}`];
        notify();
        return false;
      }
      return apply((draft) => {
        Object.assign(draft, clone(found.page));
      });
    },

    async settled() {
      await saving;
    },
  };
  return designer;
}

/** Open a page from a store: its latest draft, or else its latest version. */
createDesigner.open = async (id: string, store: PageStore): Promise<Designer> => {
  const { draft, versions } = await store.load(id);
  const page = draft ?? versions[versions.length - 1]?.page;
  if (!page) throw new Error(`The store has no page "${id}"`);
  return createDesigner({ page, store, versions });
};
