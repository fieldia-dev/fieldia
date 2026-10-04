import {
  validatePage,
  wideColumns,
  type AnswerRule,
  type ColumnCount,
  type ColumnsByWidth,
  type Field,
  type FieldNode,
  type LabelPlace,
  type LayoutNode,
  type Option,
  type Page,
  type SectionNode,
  type SetWhen,
  type SheetNode,
  type StepNode,
  type TabsNode,
} from '@fieldia/core';
import { conditionToHide, conditionToHold, type Condition } from './conditions';
import { findHeaderPart, headerCommands, type HeaderCommands } from './header-commands';
import { listCommands, type ListCommands } from './list-commands';
import { kindCommands, type OptionDetails } from './kind-commands';
import { fixCheck, pageChecks, type PageCheck } from './page-checks';
import { COLUMN_TYPES, columnKind, kindById, kindFits, kindOfField, kindsFor, orList, storedAs, type LineColumn, type QuestionKind } from './kinds';
import * as ops from './layout-ops';
import type { BlockKind, Drop, NewPart } from './layout-ops';
import * as settings from './layout-settings';
import type { LookPatch, SectionLook } from './layout-settings';
import * as several from './layout-several';
import type { EachChange } from './layout-several';
import { allIds, containers, findContainer, findNode, findTab, firstSection, nextName, shownFields } from './page-tree';
import { Refusal } from './refusal';
import { translationCommands } from './translations';
import { rulesCommands, type AnswerRulePatch } from './rules-commands';
import { keepWhatRulesRead } from './rules-reads';

/**
 * The editing model behind the designer: no DOM, so it is tested in Node.
 *
 * Every edit is a command that produces a new page. The page is validated
 * before it replaces the old one, so an edit that would break the page is
 * refused with the reason, never applied. Each edit is one undo step; a run of
 * typing in one label merges into one. Drafts are saved apart from published
 * versions, so editing never changes a form people are filling in.
 *
 * Given the backend's model, it offers the model's fields as they are: a
 * field from the model keeps what it holds, and only changes editor.
 */

export { columnKind, kindFits, kindOfField, kindsFor, QUESTION_KINDS, SCREEN_KINDS, storedAs } from './kinds';
export type { LineColumn, QuestionKind } from './kinds';
export type { HeaderCommands, HeaderPartKind, HeaderPartPatch } from './header-commands';
export type { ListActionPatch, ListCommands, ListOptionsPatch } from './list-commands';
export { pageChanges, pageChecks, type CheckFix, type PageCheck } from './page-checks';
export type { BlockKind, Drop, NewPart } from './layout-ops';
export type { LookPatch, SectionLook } from './layout-settings';
export type { EachChange } from './layout-several';
export type { AnswerRulePatch } from './rules-commands';

/** What a page is for: a survey (wizard of steps), an app screen (sections), a record's sheet, or a list of records. */
export type PageKind = 'survey' | 'screen' | 'sheet' | 'list';

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
  if (kind === 'list') {
    // A list shows at least one column: the records' names, to begin with.
    return {
      fieldia: '0.1',
      id,
      title,
      data: { kind: 'record', model: slug(title, '.') },
      fields: { name: { type: 'char', label: 'Name' } },
      layout: { type: 'list', id: 'list', columns: ['name'] },
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
  /** Every part picked, in the order picked: `selected` is the one picked last. */
  picked: string[];
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

/** Where something is added: after an element, or in a container — at a place among its children, or at its end. */
export interface Where {
  after?: string;
  parent?: string;
  index?: number;
}

/** A field of the backend's model, by its name. */
export interface ModelField {
  name: string;
  field: Field;
}

export interface Designer extends HeaderCommands, ListCommands {
  getPage(): Page;
  /** The model's fields not on the page yet, in the model's order. Empty without a model. */
  modelFields(): ModelField[];
  /** Show a field of the model, as the model has it: after `after`, or at the end of `parent` (or of the last container). Returns its node's id. */
  addModelField(name: string, where?: Where): string | false;
  /** The kinds a question can be shown as: for a field from the model, only those that fit what it holds. */
  kindsFor(id: string): QuestionKind[];
  /** Whether the question shows a field of the model, whose definition is the backend's. */
  isFromModel(id: string): boolean;
  getState(): DesignerState;
  subscribe(listener: (state: DesignerState) => void): () => void;
  select(id: string | null): void;
  /** Add a question after `after`, or at the end of `parent` (or of the last container). Returns its id. */
  addQuestion(kind: string, where?: Where): string | false;
  updateQuestion(id: string, patch: QuestionPatch): boolean;
  setOptions(id: string, labels: string[]): boolean;
  changeKind(id: string, kind: string): boolean;
  moveNode(id: string, delta: number): boolean;
  placeNode(id: string, parent: string, index: number): boolean;
  duplicateNode(id: string): string | false;
  removeNode(id: string): boolean;
  /** A step for a survey, a section for a screen or a sheet, or a section in a tab (`parent`). Returns its id. */
  /**
   * A section, or a survey's page: at the end, in a tab (`parent`), or — a
   * page — right after a question (`after`), the questions under it on its
   * page moving onto the new one, as Google Forms adds a section.
   */
  addContainer(label: string, where?: { parent?: string; after?: string }): string | false;
  /** A screen of sections becomes a sheet, or a sheet without tabs a screen of sections. */
  setLayoutKind(kind: 'sections' | 'sheet'): boolean;
  /** A sheet's title: a text field taken out of its section, or `null` to put it back first in the first section. */
  setTitleField(nodeId: string | null): boolean;
  /** Tabs on a sheet, after `after` or at the end: one tab, with a section. Returns the tabs' id. */
  addTabs(where?: { after?: string }): string | false;
  /** One more tab, with a section. Returns its id. */
  addTab(tabsId: string, label: string): string | false;
  renameContainer(id: string, label: string): boolean;
  /**
   * Show a page or a question only when earlier answers say so: all of the
   * rules, or any. One field and one value is the short form; `null`, or no
   * rules, always shows it.
   */
  setCondition(id: string, condition: Condition | { field: string; equals: string | number | boolean } | null): boolean;
  /**
   * A field required, or read-only, only when a rule holds; `null` for no
   * rule. A field always required becomes required only then; a field the
   * model always requires cannot be.
   */
  setRule(id: string, which: 'required' | 'readonly', condition: Condition | { field: string; equals: string | number | boolean } | null): boolean;
  /** A group's columns: one count, or a count for a desktop (`wide`), a tablet (`medium`) and a phone (`narrow`). */
  setColumns(sectionId: string, columns: ColumnCount | ColumnsByWidth): boolean;
  /** How many columns a field, a group, tabs, words, a button, a spacer or an image spans. */
  setColspan(nodeId: string, span: number): boolean;
  /** Put a section's fields in this order with these widths, as one edit (a canvas drag). */
  arrangeSection(sectionId: string, items: { id: string; colspan: number }[]): boolean;
  setPageInfo(info: { title?: string; description?: string }): boolean;
  /** The records a link, links or a table of lines point to, by their model's name. */
  setRelation(id: string, model: string): boolean;
  /** An amount's currency, such as USD. */
  setCurrency(id: string, code: string): boolean;
  /** Where a rating, a scale or a progress runs from and to. */
  setRange(id: string, range: { min: number; max: number }): boolean;
  /** An "Other" choice after the options, with a box for an answer of one's own: for multiple choice and checkboxes. */
  setOther(id: string, on: boolean): boolean;
  /** How the field's widget shows it, such as the words at a scale's ends; `null` or nothing takes a setting away. */
  setWidgetOptions(id: string, patch: Record<string, string | number | boolean | null>): boolean;
  /** Which kinds of file a file upload takes (media types, such as image/*), and the largest, in bytes. */
  setFileRules(id: string, rules: { accept?: string[]; maxSize?: number | null }): boolean;
  /**
   * Drop a part where it goes, as one edit: a part on the page, by its id, or
   * a new one from the toolbox. Returns its id, and picks it.
   */
  place(part: string | NewPart, drop: Drop): string | false;
  /** What a drop would do, in the words the drag chip says: "beside “First name”". `moving` is the part dragged, when it is on the page. */
  describeDrop(drop: Drop, moving?: string): string;
  /** Why a drop cannot be made, such as "A row holds four"; null when it can. */
  dropRefusal(drop: Drop, moving?: string): string | null;
  /** Parts that sit together, in a new group, side by side, or a tab each. Returns what holds them, and picks it. */
  wrap(ids: string[], kind: 'group' | 'side' | 'tabs'): string | false;
  /** A group's parts, or every tab's, where it was; they are picked. */
  ungroup(id: string): boolean;
  /** A copy of each part right after it; the copies are picked. */
  duplicate(ids: string[]): string[] | false;
  /** Take several parts off the page, as one edit. */
  remove(ids: string[]): boolean;
  /** Pick a part; with `add`, pick it as well as those picked, or let it go if it was. */
  pick(id: string, options?: { add?: boolean }): void;
  /** How a group looks, and where its fields' labels sit and how wide; `null` takes a setting back. */
  setSectionLook(id: string, look: SectionLook): boolean;
  /** Where one field's label sits; `null` for where its group or the page puts labels. */
  setFieldLabels(id: string, place: LabelPlace | null): boolean;
  /** The page's look: colour, font, spacing, corners, labels, scheme; `null` takes a setting back. */
  setLook(patch: LookPatch): boolean;
  /** A block after `after`, or in `parent` at `index`, or at the end of the last container. Returns its id, and picks it. */
  addBlock(kind: BlockKind, where?: Where): string | false;
  /** A table of lines' columns, in order. */
  setLineColumns(id: string, columns: LineColumn[]): boolean;
  /** An option's picture and points for a quiz; `null` or empty takes either away. */
  setOptionDetails(id: string, index: number, details: OptionDetails): boolean;
  /** A matrix's rows or columns, by their words, in order. */
  setMatrixItems(id: string, which: 'rows' | 'columns', labels: string[]): boolean;
  /** Which parts an address asks for: street, city, postcode, country. */
  setAddressParts(id: string, parts: string[]): boolean;
  /** Whether pictures to choose from take one answer or several. */
  setSeveral(id: string, on: boolean): boolean;
  undo(): void;
  redo(): void;
  /** Publish the draft as the next version. Returns its number. */
  publish(): Promise<number>;
  /** What people would trip over on the page as it is, what would stop them first. */
  checks(): PageCheck[];
  /** Do a check's fix: delete an empty page, drop a rule that can never hold, or pick what it is about. */
  fixCheck(check: PageCheck): boolean;
  /** Make a published version the draft again. Undoable. */
  revertTo(version: number): boolean;
  /** Resolves once every draft save started so far has finished. */
  settled(): Promise<void>;
  // translations lane
  /** A language to translate the page into, by tag (`ar`, `pt-BR`). Not the page's own language. */
  addLanguage(tag: string): boolean;
  /** A language taken out, with every word translated into it. */
  removeLanguage(tag: string): boolean;
  /** One word's translation; empty or `null` takes it away. Typing in one word is one undo step. */
  setTranslation(tag: string, source: string, text: string | null): boolean;
  /** Many translations at once, by language then by word, as one edit; languages the page has not got are added. Returns how many were filled. */
  fillTranslations(words: Record<string, Record<string, string>>): number | false;
  /** Let go of words' translations in every language, as one edit: for words no longer on the page. */
  forgetWords(sources: string[]): boolean;
  // panel lane
  /** Several parts' width, or where their labels sit, as one edit; none changes when one cannot. */
  setEach(ids: string[], change: EachChange): boolean;
  // rules lane
  /** A field's value worked out from others, such as `price * qty`; `null` makes it a field to fill in again. Typing a formula is one undo step. */
  setCompute(id: string, expression: string | null): boolean;
  /** Values set when a condition starts to hold, in order; `null` or none takes them away. Typing in one box is one undo step. */
  setSetWhen(id: string, items: SetWhen[] | null): boolean;
  /** A rule the answer must keep, after the others: one that fits what the field holds. */
  addAnswerRule(id: string, rule: AnswerRule): boolean;
  /** One answer rule changed: a value sets what it asks, `null` takes that away. Typing in one box is one undo step. */
  updateAnswerRule(id: string, index: number, patch: AnswerRulePatch): boolean;
  removeAnswerRule(id: string, index: number): boolean;
}


const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const kindOf = kindById;

export function createDesigner(options: { page: Page; store?: PageStore; versions?: PublishedVersion[]; model?: Record<string, Field> }): Designer {
  const store = options.store;
  const model = clone(options.model ?? {});
  /** A field the backend already has: its definition is the model's, not the designer's. */
  const fromModel = (name: string) => Object.prototype.hasOwnProperty.call(model, name);
  let page = clone(options.page);
  let selected: string | null = null;
  let picked: string[] = [];
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
  /** The picks: an editor that sets only `selected` picks that one alone. */
  const pickedNow = () => (selected === null ? [] : picked.includes(selected) ? picked : [selected]);
  /** What was picked as each page was left, to pick again when undo or redo comes back to it. */
  const pickedWhenLeft = new WeakMap<Page, { picked: string[]; selected: string | null }>();
  const leave = (left: Page) => pickedWhenLeft.set(left, { picked: pickedNow(), selected });
  /** Back at a page: what is picked stays while any of it is on the page; when none is, what was picked as it was left. */
  function arrive() {
    const ids = allIds(page);
    const now = pickedNow();
    const back = now.some((id) => ids.has(id)) ? { picked: now, selected } : (pickedWhenLeft.get(page) ?? { picked: [], selected: null });
    picked = back.picked.filter((id) => ids.has(id));
    selected = back.selected !== null && picked.includes(back.selected) ? back.selected : (picked[picked.length - 1] ?? null);
  }
  const state = (): DesignerState => ({
    page,
    selected,
    picked: pickedNow(),
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
    // rules lane: a field a rule still reads keeps its definition, so the rule can be seen and put right.
    keepWhatRulesRead(page, draft);
    const checked = validatePage(draft);
    if (!checked.ok) {
      issues = checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
      notify();
      return false;
    }
    if (!(merge && merge === mergeKey)) past = [...past, page];
    mergeKey = merge;
    future = [];
    leave(page);
    page = checked.page;
    issues = [];
    notify();
    saveDraft();
    return true;
  }

  function placeAfter(draft: Page, node: LayoutNode, where: Where = {}): void {
    if (where.after) {
      const found = findNode(draft, where.after);
      if (!found) throw new Refusal(`There is no element "${where.after}"`);
      found.parent.children.splice(found.index + 1, 0, node);
      return;
    }
    const all = containers(draft);
    const parent = where.parent ? all.find((c) => c.id === where.parent) : all[all.length - 1];
    if (!parent) throw new Refusal(`There is no step or section "${where.parent}"`);
    parent.children.splice(where.index === undefined ? parent.children.length : Math.max(0, Math.min(where.index, parent.children.length)), 0, node);
  }

  function refuseInSurvey(draft: Page, kind: QuestionKind) {
    if (kind.group === 'records' && draft.data.kind === 'responses') throw new Refusal('A survey has no records to link to or list: this kind is for app screens');
  }

  /** A field of the node, when it is one of the given types and the page's own to change: `owned` says what the model keeps otherwise. */
  function fieldOfType<T extends Field['type']>(draft: Page, id: string, types: T[], refusal: string, owned: (label: string) => string): Extract<Field, { type: T }> {
    const name = fieldNode(draft, id).field;
    const field = draft.fields[name];
    if (!(types as string[]).includes(field.type)) throw new Refusal(refusal);
    if (fromModel(name)) throw new Refusal(owned(field.label));
    return field as Extract<Field, { type: T }>;
  }

  /** A layout edit, one undo step: what it made or moved is picked after. */
  function layoutEdit<T extends string | string[]>(edit: (draft: Page) => T): T | false {
    let made = null as T | null;
    if (!apply((draft) => void (made = edit(draft))) || made === null) return false;
    picked = ([] as string[]).concat(made);
    selected = picked[0] ?? null;
    notify();
    return made;
  }

  /** Picks of parts no longer on the page are let go; the one picked last of the rest leads. */
  function forgetGone() {
    const ids = allIds(page);
    picked = pickedNow().filter((id) => ids.has(id));
    if (selected !== null && !ids.has(selected)) selected = picked[picked.length - 1] ?? null;
    notify();
  }

  function fieldNode(draft: Page, id: string): FieldNode {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${id}"`);
    return found.node;
  }

  const header = headerCommands({
    apply,
    select(id) {
      selected = id;
      notify();
    },
    model,
  });

  const list = listCommands({
    apply,
    select(id) {
      selected = id;
      notify();
    },
    selected: () => selected,
    model,
  });

  const kinds = kindCommands({ apply, fromModel });

  const designer: Designer = {
    ...header,
    ...list,
    ...kinds,
    getPage: () => page,
    modelFields() {
      const shown = shownFields(page);
      return Object.keys(model)
        .filter((name) => !shown.has(name))
        .map((name) => ({ name, field: clone(model[name]) }));
    },

    addModelField(name, where) {
      let created = '';
      const ok = apply((draft) => {
        if (!fromModel(name)) throw new Refusal(`The model has no field "${name}"`);
        if (shownFields(draft).has(name)) throw new Refusal(`${model[name].label} is on the page already`);
        // A definition the page already keeps for it stays; otherwise the model's.
        draft.fields[name] = draft.fields[name] ?? clone(model[name]);
        const ids = allIds(draft);
        created = nextName((id) => ids.has(id), 'q', '-');
        placeAfter(draft, { type: 'field', id: created, field: name }, where);
      });
      if (!ok) return false;
      selected = created;
      notify();
      return created;
    },

    isFromModel(id) {
      const found = findNode(page, id);
      return found?.node.type === 'field' && fromModel(found.node.field);
    },

    kindsFor(id) {
      const found = findNode(page, id);
      if (!found || found.node.type !== 'field') return [];
      const name = found.node.field;
      return kindsFor(page.fields[name], { fromModel: fromModel(name), survey: page.data.kind === 'responses' });
    },
    getState: state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(id) {
      selected = id;
      picked = id === null ? [] : [id];
      notify();
    },

    addQuestion(kindId, where) {
      const kind = kindOf(kindId);
      let created = '';
      const ok = apply((draft) => {
        refuseInSurvey(draft, kind);
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
          if (fromModel(node.field)) {
            // The backend's definition stays as it is: what this page says goes on the field's place on it.
            if (patch.label !== undefined) node.label = patch.label;
            if (patch.required !== undefined) {
              if (patch.required) node.required = true;
              else delete node.required;
            }
            if (patch.help !== undefined) {
              if (patch.help) node.help = patch.help;
              else delete node.help;
            }
            if (patch.placeholder !== undefined) {
              if (patch.placeholder) node.placeholder = patch.placeholder;
              else delete node.placeholder;
            }
            return;
          }
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
        if (fromModel(node.field)) throw new Refusal(`The options of ${field.label} come from the model`);
        const old = field.options;
        const used = new Set<string | number>();
        const placeholder = (o: Option | undefined) => !!o && /^option_\d+$/.test(String(o.value)) && /^Option \d+$/.test(o.label);
        const clean = labels.map((label) => label.trim()).filter(Boolean);
        // The same words are the same option: one put between others, or taken from among them, leaves theirs alone.
        const claimed = new Set<number>();
        const same = clean.map((label) => {
          const at = old.findIndex((o, k) => !claimed.has(k) && o.label === label);
          if (at !== -1) claimed.add(at);
          return at;
        });
        field.options = clean.map((label, i) => {
          let value: string | number;
          if (same[i] !== -1) value = old[same[i]].value;
          else {
            // Words changed in place keep the value the answers already use, unless it was a placeholder.
            const there = claimed.has(i) ? undefined : old[i];
            if (there) claimed.add(i);
            value = there && !placeholder(there) ? there.value : slug(label);
          }
          while (used.has(value)) value = `${value}_${i + 1}`;
          used.add(value);
          // An option kept keeps its picture and points.
          const kept = old.find((o) => o.value === value);
          return { ...(kept?.image !== undefined ? { image: kept.image } : {}), ...(kept?.score !== undefined ? { score: kept.score } : {}), value, label };
        });
        },
        // Typing in one option list is one undo step, like typing in a label.
        `options:${id}:${labels.length}`
      );
    },

    changeKind(id, kindId) {
      const kind = kindOf(kindId);
      return apply((draft) => {
        refuseInSurvey(draft, kind);
        const node = fieldNode(draft, id);
        const old = draft.fields[node.field] as Field & { help?: string; required?: boolean };
        if (fromModel(node.field)) {
          // What the backend stores stays as it is: only the editor changes.
          if (!kindFits(kind, old)) {
            const fitting = kindsFor(old, { fromModel: true, survey: draft.data.kind === 'responses' }).map((k) => k.label);
            throw new Refusal(`${old.label} is stored as ${storedAs(old)} in the model, so it can only be shown as ${orList(fitting)}`);
          }
          if (kind.widget) node.widget = kind.widget;
          else delete node.widget;
          return;
        }
        const next = kind.field(old.label) as Field & { help?: string; required?: boolean };
        if (old.type === 'selection' && next.type === 'selection') {
          next.options = old.options;
          // "Other" stays where the new kind has it too; a dropdown has none.
          if (old.other && (kind.id === 'multiple-choice' || kind.id === 'checkboxes')) next.other = true;
        }
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
        // No wider than its new section.
        const columns = (parent as SectionNode).type === 'section' ? wideColumns((parent as SectionNode).columns) : null;
        if (columns && found.node.type === 'field' && (found.node.colspan ?? 1) > columns) {
          if (columns === 1) delete found.node.colspan;
          else found.node.colspan = columns;
        }
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
          const at = where.after ? root.children.findIndex((step) => step.children.some((n) => n.id === where.after)) : -1;
          if (where.after && at === -1) throw new Refusal(`There is no question "${where.after}"`);
          if (at === -1) root.children.push({ type: 'step', id: created, label, children: [] });
          else {
            const step = root.children[at];
            const cut = step.children.findIndex((n) => n.id === where.after) + 1;
            root.children.splice(at + 1, 0, { type: 'step', id: created, label, children: step.children.splice(cut) });
          }
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
        const container = findContainer(draft, id) as { invisible?: string } | null;
        const found = container ? null : findNode(draft, id);
        // A badge, a counter or a button of a sheet's header shows only for some records too.
        const target = container ?? (found?.node as { invisible?: string } | undefined) ?? (findHeaderPart(draft, id)?.part as { invisible?: string } | undefined);
        if (!target) throw new Refusal(`There is no element "${id}"`);
        const rules: Condition = !condition
          ? { join: 'all', rules: [] }
          : 'rules' in condition
            ? condition
            : { join: 'all', rules: [{ field: condition.field, op: 'is', value: condition.equals }] };
        if (!rules.rules.length) {
          delete target.invisible;
          return;
        }
        const own = found?.node.type === 'field' ? found.node.field : null;
        if (own && rules.rules.some((rule) => rule.field === own)) throw new Refusal('A question cannot depend on its own answer');
        target.invisible = conditionToHide(rules);
      });
    },

    setRule(id, which, condition) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field') throw new Refusal(`There is no field "${id}"`);
        const node = found.node;
        const rules: Condition = !condition
          ? { join: 'all', rules: [] }
          : 'rules' in condition
            ? condition
            : { join: 'all', rules: [{ field: condition.field, op: 'is', value: condition.equals }] };
        if (rules.rules.some((rule) => rule.field === node.field)) throw new Refusal('A field cannot depend on its own answer');
        const field = draft.fields[node.field];
        if (which === 'required' && rules.rules.length && field?.required === true) {
          // The model's own word stands; a field of the page's own becomes required only when the rule holds.
          if (fromModel(node.field)) throw new Refusal(`The model requires ${field.label} always, so it cannot be required only sometimes`);
          delete field.required;
        }
        if (rules.rules.length) node[which] = conditionToHold(rules);
        else delete node[which];
      });
    },

    setColumns: (sectionId, columns) => apply((draft) => settings.setColumns(draft, sectionId, columns)),
    setColspan: (nodeId, span) => apply((draft) => settings.setColspan(draft, nodeId, span)),

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

    setRelation(id, model) {
      return apply(
        (draft) => {
          const field = fieldOfType(draft, id, ['many2one', 'many2many', 'one2many'], 'Only a link, links or a table of lines point to records', (label) => `What ${label} points to comes from the model`);
          if (!model.trim()) throw new Refusal('Say which records it points to, such as contact');
          field.relation = model.trim();
        },
        `relation:${id}`
      );
    },

    setCurrency(id, code) {
      return apply((draft) => {
        const field = fieldOfType(draft, id, ['monetary'], 'Only an amount has a currency', (label) => `The currency of ${label} comes from the model`);
        const currency = code.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw new Refusal('A currency is three letters, such as USD');
        field.currency = currency;
        delete field.currencyField;
      });
    },

    setRange(id, range) {
      return apply((draft) => {
        const field = fieldOfType(draft, id, ['integer'], 'Only a rating, a scale or a progress has a range', (label) => `The range of ${label} comes from the model`);
        const { min, max } = range;
        if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) throw new Refusal('A range runs from a smaller whole number to a bigger one');
        Object.assign(field, { min, max });
      });
    },

    setOther(id, on) {
      return apply((draft) => {
        const ask = 'Only multiple choice and checkboxes take an answer of one’s own';
        const field = fieldOfType(draft, id, ['selection'], ask, (label) => `Whether ${label} takes an answer of its own comes from the model`);
        const kind = kindOfField(field, fieldNode(draft, id));
        if (kind !== 'multiple-choice' && kind !== 'checkboxes') throw new Refusal(ask);
        if (on) field.other = true;
        else delete field.other;
      });
    },

    setWidgetOptions(id, patch) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const options = { ...(node.options ?? {}) } as Record<string, unknown>;
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') delete options[key];
            else options[key] = value;
          }
          if (Object.keys(options).length) node.options = options as FieldNode['options'];
          else delete node.options;
        },
        `widget:${id}:${Object.keys(patch).join(',')}`
      );
    },

    setFileRules(id, rules) {
      return apply((draft) => {
        const field = fieldOfType(draft, id, ['binary'], 'Only a file upload takes files', (label) => `The files ${label} takes come from the model`);
        if (rules.accept !== undefined) {
          if (rules.accept.length) field.accept = [...rules.accept];
          else delete field.accept;
        }
        if (rules.maxSize !== undefined) {
          if (rules.maxSize === null) delete field.maxSize;
          else if (!Number.isInteger(rules.maxSize) || rules.maxSize <= 0) throw new Refusal('The largest file is a size in bytes, more than nothing');
          else field.maxSize = rules.maxSize;
        }
      });
    },

    place: (part, drop) => layoutEdit((draft) => ops.place(draft, part, drop, { model })),
    describeDrop: (drop, moving) => ops.describeDrop(page, drop, moving),
    dropRefusal: (drop, moving) => ops.dropRefusal(page, drop, moving),
    wrap: (ids, kind) => layoutEdit((draft) => ops.wrap(draft, ids, kind)),
    ungroup: (id) => layoutEdit((draft) => ops.ungroup(draft, id)) !== false,
    duplicate: (ids) => layoutEdit((draft) => ops.duplicate(draft, ids)),
    remove(ids) {
      const ok = apply((draft) => ops.remove(draft, ids));
      if (ok) forgetGone();
      return ok;
    },
    pick(id, options = {}) {
      const now = pickedNow();
      const off = !!options.add && now.includes(id);
      picked = !options.add ? [id] : off ? now.filter((p) => p !== id) : [...now, id];
      selected = off ? (picked[picked.length - 1] ?? null) : id;
      notify();
    },
    setSectionLook: (id, look) => apply((draft) => settings.setSectionLook(draft, id, look), `section-look:${id}:${Object.keys(look).join(',')}`),
    setFieldLabels: (id, place) => apply((draft) => settings.setFieldLabels(draft, id, place)),
    setLook: (patch) => apply((draft) => settings.setLook(draft, patch), `look:${Object.keys(patch).join(',')}`),
    addBlock: (kind, where) => layoutEdit((draft) => ops.addBlock(draft, kind, where)),

    setLineColumns(id, columns) {
      return apply(
        (draft) => {
          const field = fieldOfType(draft, id, ['one2many'], 'Only a table of lines has columns', (label) => `The columns of ${label} come from the model`);
          if (!columns.length) throw new Refusal('A table of lines needs a column');
          const old = field.fields;
          const taken = new Set(columns.map((c) => c.name).filter((name): name is string => !!name && name in old));
          const fields: typeof old = {};
          for (const column of columns) {
            let name = column.name && column.name in old ? column.name : null;
            if (!name) {
              // A new column is named after its label, as a backend names a field.
              const base = slug(column.label || 'column', '_').replace(/^(\d)/, 'c_$1');
              name = base;
              for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
              taken.add(name);
            }
            // A column of the same kind keeps its field: a whole number stays whole, a link stays a link.
            const kept = old[name];
            if (kept && columnKind(kept) === column.kind) fields[name] = { ...kept, label: column.label };
            else if (column.kind === 'other') throw new Refusal('A new column is text, a number, a date, or yes or no');
            else fields[name] = { type: COLUMN_TYPES[column.kind], label: column.label } as (typeof old)[string];
          }
          field.fields = fields;
        },
        // Typing in a column's label is one undo step, as in an option.
        `columns:${id}:${columns.length}`
      );
    },

    undo() {
      const previous = past[past.length - 1];
      if (!previous) return;
      past = past.slice(0, -1);
      future = [page, ...future];
      leave(page);
      page = previous;
      arrive();
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
      leave(page);
      page = next;
      arrive();
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

    checks: () => pageChecks(page),
    fixCheck: (check) => fixCheck(designer, check),

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
    // translations lane
    ...translationCommands({ apply, getPage: () => page }),
    // panel lane
    setEach: (ids, change) => apply((draft) => several.setEach(draft, ids, change)),
    // rules lane
    ...rulesCommands({ apply, getPage: () => page, fromModel }),
  };
  return designer;
}

/** Open a page from a store: its latest draft, or else its latest version. */
createDesigner.open = async (id: string, store: PageStore, options: { model?: Record<string, Field> } = {}): Promise<Designer> => {
  const { draft, versions } = await store.load(id);
  const page = draft ?? versions[versions.length - 1]?.page;
  if (!page) throw new Error(`The store has no page "${id}"`);
  return createDesigner({ page, store, versions, model: options.model });
};
