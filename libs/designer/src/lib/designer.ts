import {
  validatePage,
  wideColumns,
  type AnswerRule,
  type ColumnCount,
  type ColumnsByWidth,
  type Field,
  type FieldNode,
  type FormNode,
  type LabelPlace,
  type LayoutNode,
  type Option,
  type OptionsFrom,
  type PartLookKind,
  type Page,
  type PageLook,
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
import { choiceCommands, type ChoiceCommands } from './choice-commands';
import { inputCommands, type InputCommands } from './input-commands';
import { structureCommands, type StructureCommands } from './structure-commands';
import { fixCheck, pageChecks, type PageCheck } from './page-checks';
import { COLUMN_TYPES, columnKind, kindById, kindFits, kindName, kindOfField, kindsFor, registerKinds, storedAs, type LineColumn, type QuestionKind } from './kinds';
import type { AppKind } from './app-kinds';
import { replaceWith, templatesFor, type PageTemplate } from './templates';
import type { DesignerAssistant } from './assistant';
import * as ops from './layout-ops';
import type { BlockKind, Drop, NewPart } from './layout-ops';
import * as settings from './layout-settings';
import * as twelfths from './layout-twelfths';
import type { BlockPatch, LookPatch, PartLookPatch, SectionLook } from './layout-settings';
import * as several from './layout-several';
import type { EachChange } from './layout-several';
import { allIds, containers, findContainer, findNode, findTab, firstSection, nextName, shownFields, type Container } from './page-tree';
import { across, setSpan, type Holder } from './layout-tree';
import { Refusal } from './refusal';
import { translationCommands } from './translations';
import { pageJsonCommands, type PageJsonResult } from './page-json';
import { rulesCommands, type AnswerRulePatch } from './rules-commands';
import { keepWhatRulesRead } from './rules-reads';
import { stepsCommands, type StepsCommands } from './steps-commands';
import { forgetGoneTargets } from './steps-places';
import * as clipboard from './clipboard-ops';
import * as moves from './outline-moves';
import { outlineRows } from './outline-rows';
import { LOOK_PRESETS, wholeLook, type LookValues } from './look-presets';
import { browserLooks } from './look-store';
import { setFold, type Fold } from './group-fold';
import { editChecker } from './validate-edit';
import { DESIGNER_WORDS, designerLocale, isDefaultOption, type DesignerLocale, type DesignerWords } from './designer-words';
import { answersName, formParts, freeFieldName, refuseCycle, savedFormsCache, updateFormPart, type FormPartPatch, type SavedFormRef } from './saved-forms';

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

export { columnKind, kindFits, kindName, kindOfField, kindsFor, QUESTION_KINDS, SCREEN_KINDS, storedAs } from './kinds';
export type { LineColumn, QuestionKind } from './kinds';
export type { AppKind, AppKindContext, AppKindPreviewContext, AppKindSettings } from './app-kinds';
export { isBlank, SCREEN_TEMPLATES, SURVEY_TEMPLATES, type PageTemplate } from './templates';
export { askAssistant, type AssistantResult, type AssistantRun, type DesignerAssistant } from './assistant';
export type { HeaderCommands, HeaderPartKind, HeaderPartPatch } from './header-commands';
export type { ListActionPatch, ListCommands, ListOptionsPatch } from './list-commands';
export { pageChanges, pageChecks, type CheckFix, type PageCheck } from './page-checks';
export type { BlockKind, Drop, NewPart } from './layout-ops';
export type { BlockPatch, LookPatch, PartLookPatch, SectionLook } from './layout-settings';
export type { EachChange } from './layout-several';
export type { Fold } from './group-fold';
export type { JsonProblem, PageJsonResult } from './page-json';
export type { AnswerRulePatch } from './rules-commands';
export type { FormPartPatch, SavedFormRef } from './saved-forms';
export type { StepPatch, StepsCommands } from './steps-commands';
export type { Moment, StepPath, StepsPlace } from './steps-places';
export { createBrowserLookStore, createMemoryLookStore } from './look-store';
export type { LookValues } from './look-presets';
export { DESIGNER_WORDS, designerLocale, type DesignerLocale, type DesignerWords } from './designer-words';

/** What a page is for: a survey (wizard of steps), an app screen (sections), a record's sheet, or a list of records. */
export type PageKind = 'survey' | 'screen' | 'sheet' | 'list';

/** Words as a name for code: Latin letters and digits; `empty` for words written in another script, as Arabic is. */
const slug = (text: string, sep = '_', empty = 'page') =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '') || empty;

/**
 * A page with nothing on it yet, titled: a survey with its first page, a
 * screen with its first section, a sheet with its record's name, a list with
 * its column. What it names (Page 1, Section 1) is in the designer's
 * language (`locale`), English unless said; and a page begun in another
 * language is written in it (`language`), so its form speaks it too.
 */
export function blankPage(kind: PageKind, title: string, options: { locale?: string } = {}): Page {
  const locale = designerLocale(options.locale) ?? 'en';
  const w = DESIGNER_WORDS[locale].defaults;
  const id = slug(title, '-');
  const written = locale === 'en' ? {} : { language: locale };
  if (kind === 'survey') {
    return {
      fieldia: '0.1',
      id,
      title,
      ...written,
      data: { kind: 'responses' },
      fields: {},
      layout: { type: 'wizard', id: 'steps', children: [{ type: 'step', id: 'step-1', label: w.page(1), children: [] }] },
    };
  }
  if (kind === 'list') {
    // A list shows at least one column: the records' names, to begin with.
    return {
      fieldia: '0.1',
      id,
      title,
      ...written,
      data: { kind: 'record', model: slug(title, '.') },
      fields: { name: { type: 'char', label: w.name } },
      layout: { type: 'list', id: 'list', columns: ['name'] },
    };
  }
  if (kind === 'sheet') {
    // A record named in big letters at the top, as a business record is.
    return {
      fieldia: '0.1',
      id,
      title,
      ...written,
      data: { kind: 'record', model: slug(title, '.') },
      fields: { name: { type: 'char', label: w.name, required: true } },
      layout: { type: 'sheet', id: 'sheet', title: { field: 'name', placeholder: w.name }, children: [{ type: 'section', id: 'section-1', columns: 2, children: [] }] },
    };
  }
  return {
    fieldia: '0.1',
    id,
    title,
    ...written,
    data: { kind: 'record', model: slug(title, '.') },
    fields: {},
    layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'section-1', title: w.section(1), columns: 2, children: [] }] },
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
  /**
   * The saved forms that can be placed in another page, by id and title:
   * those with a published version. Optional: without it, the designer offers
   * no saved form to place.
   */
  list?(): Promise<SavedFormRef[]>;
}

/** A look of one's own, kept by name to use again on other pages: the values a preset sets, any left to the skin. */
export interface SavedLook {
  id: string;
  name: string;
  look: LookValues;
}

/**
 * Where looks of one's own are kept. An app implements this to keep them for
 * a whole workspace on its server; without one, the designer keeps them in
 * this browser (`createBrowserLookStore`). A store that rejects is said in
 * the editor, in the words of its error.
 */
export interface LookStore {
  /** Every look kept. The designer shows them by name. */
  list(): Promise<SavedLook[]>;
  /** Keep a look: a new one by a new id, or one kept already — renamed — in its place. */
  save(look: SavedLook): Promise<void>;
  remove(id: string): Promise<void>;
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
    async list() {
      return [...pages]
        .filter(([, found]) => found.versions.length)
        .map(([id, found]) => ({ id, title: found.versions[found.versions.length - 1].page.title || id }));
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

export interface Designer extends HeaderCommands, ListCommands, ChoiceCommands, InputCommands, StructureCommands, StepsCommands {
  /** The designer's own words, in its language: English unless `locale` said another it speaks. */
  readonly words: DesignerWords;
  /**
   * The designer's language, when one was given: its own words are in it, and
   * the editors run its way — Arabic right to left, English left to right —
   * whatever the direction of the page around them. Null when none was given:
   * English, running the way the page around it does.
   */
  readonly locale: DesignerLocale | null;
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
  /** Put a part in a step or section, at a place among its parts; with `pick`, it is picked too, as one change. */
  placeNode(id: string, parent: string, index: number, options?: { pick?: boolean }): boolean;
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
  /**
   * Which kinds of file a file upload takes (media types, such as image/*), and
   * the largest, in bytes; whether it, or an image, takes several files, and as
   * few and as many as it takes. `null` lifts a limit; one file again lifts both counts.
   */
  setFileRules(id: string, rules: { accept?: string[]; maxSize?: number | null; multiple?: boolean; minFiles?: number | null; maxFiles?: number | null }): boolean;
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
  /**
   * One kind of part's look, over the page's: text boxes, choices, groups,
   * buttons or tables, with the settings `PART_LOOKS` gives each. `null` takes
   * a setting back, or the whole kind. Each change is one undo step; a run of
   * colours tried, one after another, is one, as typing is.
   */
  setPartLook(kind: PartLookKind, patch: PartLookPatch | null): boolean;
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
  /** The language the page's own words are written in, by tag, as one edit: not one it keeps a translation into. */
  setPageLanguage(tag: string): boolean;
  // panel lane
  /** Several parts' width, where their labels sit, or whether they are required, as one edit; none changes when one cannot. */
  setEach(ids: string[], change: EachChange): boolean;
  // json lane
  /** The page as JSON: two spaces deep, its keys in the order the page keeps them. */
  pageJson(): string;
  /** A whole page written as JSON, as one edit; refused with each problem's line and column, the page kept as it was. */
  setPageJson(text: string): PageJsonResult;
  /** The app's lists of choices a choice may take its options from, as the app named them. */
  lists(): AppList[];
  /** A choice's options taken from one of the app's lists, changing with other fields; `null` for options written here. */
  setOptionsFrom(id: string, from: OptionsFrom | null): boolean;
  // canvas lane
  /** A block's words and look, a button's label, a picture's address and description; a run of typing in one is one undo step. */
  updateBlock(id: string, patch: BlockPatch): boolean;
  /**
   * Several parts' widths as one edit: two trading width across the gutter
   * between them. With `twelfths`, widths are twelfths of their row, and a
   * group of one to four columns is divided in twelfths first, in the same edit.
   */
  setWidths(widths: { id: string; span: number }[], options?: { twelfths?: boolean }): boolean;
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
  // extend lane
  /** The app's own kinds, as kinds, in the order the app gave them. */
  appKinds(): QuestionKind[];
  /** The templates this page can start from: Fieldia's for a survey or a screen, then the app's made the same way. */
  templates(): PageTemplate[];
  /** A whole page in place of this one, as one edit — a template, or what an assistant made — keeping this page's id and where its answers go. Refused, saying why, for one that is not a page, or is for the other editor. */
  replacePage(page: Page): boolean;
  /** The app's own assistant, when the app gave the designer one. */
  assistant(): DesignerAssistant | null;
  // outline lane
  /** Pick these parts at once, in this order, the last leading; any not on the page, or named twice, is left out. */
  pickMany(ids: string[]): void;
  /**
   * Move parts in reading order into a group, a tab, tabs or a survey's page,
   * before the part now at `index` there (the parts moved counted where they
   * are), as one edit; they stay picked. Returns them, in reading order.
   */
  moveParts(ids: string[], parentId: string, index: number): string[] | false;
  /** Why parts cannot be moved into `parentId`, such as “A tab holds parts, not other tabs”; null when they can. */
  moveRefusal(ids: string[], parentId: string): string | null;
  /** Where a move would put them, in the words the drag chip says: “into “Home address”, before “City””. */
  describeMove(ids: string[], parentId: string, index: number): string;
  /** The parts, with their fields' definitions, as JSON for the clipboard; false when none is a part of the page. */
  copyParts(ids: string[]): string | false;
  /**
   * Paste the parts a copy holds, as one edit: after the part picked, into the
   * group, tab or page picked, or at the end. Ids are new; a field whose name
   * is taken takes a free one, and what its rules read follows it. Returns
   * the parts pasted, picked, and how many rules were left off for reading a
   * field the page has not got.
   */
  pasteParts(text: string): { ids: string[]; dropped: number } | false;
  // gap lane
  /** A look to start from, by its id: its accent, font, spacing, corners and colours, as one undo step; where labels sit is kept. */
  setLookPreset(id: string): boolean;
  /**
   * A whole look on the page as one undo step, as a preset is put on it — a
   * look of one's own: its accent, font, spacing, corners and colours, each it
   * leaves unset given back to the skin. Where labels sit is kept.
   */
  useLook(look: PageLook): boolean;
  /** Where looks of one's own are kept: the app's store, or this browser's, one for every designer on the page. */
  looks(): LookStore;
  /** Whether a group folds by its title, and how it starts; refused for a group with no title. */
  setFold(id: string, fold: Fold): boolean;
  // embed lane
  /** Whether a saved form can be placed in the page: the app's store lists its saved forms (`PageStore.list`). */
  canPlaceForms(): boolean;
  /** The saved forms that can be placed in this page: the store's, this page itself left out. None without a store that lists them. */
  savedForms(): Promise<SavedFormRef[]>;
  /**
   * A saved form as this page would place it: its published versions, newest
   * last, and the page of the version kept to, or of the latest. Undefined
   * while it loads — its listeners are told once it has — and null when the
   * store has none.
   */
  savedForm(id: string, version?: number): { versions: readonly PublishedVersion[]; page: Page | null } | null | undefined;
  /** Load a saved form afresh, and every saved form it places: once loaded, one that would hold this page is refused. */
  loadSavedForm(id: string): Promise<void>;
  /**
   * Place a saved form after `after`, or in `parent` at `index`, its answers
   * under a name of its own (after its title). Returns its id, and picks it.
   * Refused when it would hold this page, as far as what has loaded tells.
   */
  addForm(pageId: string, where?: Where): string | false;
  /** A saved form placed here: which one, the version it keeps to, where its answers go, its title. */
  setForm(id: string, patch: FormPartPatch): boolean;
  /** Whether a saved form can be opened where it is made: the app gave the designer a way to (`openForm`). */
  canOpenForm(): boolean;
  /** Open a saved form where it is made, the app's way. */
  openForm(pageId: string): void;
}

/** One of the app's lists of choices, by the name its data source answers to, and the words a person picks it by. */
export interface AppList {
  name: string;
  label: string;
}


const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function createDesigner(options: {
  page: Page;
  store?: PageStore;
  versions?: PublishedVersion[];
  model?: Record<string, Field>;
  lists?: AppList[];
  /** The app's own kinds of field, offered after Fieldia's. One whose id or widget is taken is refused. */
  kinds?: readonly AppKind[];
  /** The app's own templates, offered after Fieldia's to a blank page made the same way. */
  templates?: readonly PageTemplate[];
  /** The app's own assistant, which makes a page from what a person describes. Without one, nothing about it shows. */
  assistant?: DesignerAssistant;
  /** Where looks of one's own are kept, for a whole workspace. Without one, in this browser. */
  looks?: LookStore;
  /**
   * The designer's own language, as a language tag (`ar`, `en`): its buttons,
   * menus, messages and checks in it — English and Arabic; English for any
   * other — and its editors running that language's way. The page's own
   * words are never translated: they are the page's. English, taking the
   * direction of the page around it, unless said.
   */
  locale?: DesignerLocale | (string & {});
  /** Open a saved form placed in the page where it is made, by its id: “Open it” on the canvas. Without one, it is not offered. */
  openForm?: (id: string) => void;
}): Designer {
  const store = options.store;
  const locale = designerLocale(options.locale);
  const words = DESIGNER_WORDS[locale ?? 'en'];
  const appKinds = registerKinds(options.kinds ?? []);
  /** A kind this designer offers: Fieldia's, or one of this app's. */
  const kindOf = (id: string): QuestionKind => {
    const kind = appKinds.find((k) => k.id === id) ?? kindById(id);
    if (kind.app && !appKinds.includes(kind)) throw new Error(`Unknown question kind "${id}"`);
    return kind;
  };
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
  /** Whether the draft differs from the version published last: compared once for each page and version, however often the state is asked for. */
  let compared: { page: Page; published: Page | null; differs: boolean } | null = null;
  function unpublished(): boolean {
    const last = published();
    if (compared?.page !== page || compared.published !== last) compared = { page, published: last, differs: JSON.stringify(page) !== JSON.stringify(last) };
    return compared.differs;
  }
  /** The checks of the page, worked out once for each page, and again as saved forms placed in it load. */
  let checksOf: { page: Page; forms: number; checks: PageCheck[] } | null = null;
  /** How many times a saved form has come from the store: what depends on them is worked out again. */
  let formsCame = 0;
  const forms = savedFormsCache(store, () => {
    formsCame++;
    notify();
  });
  const state = (): DesignerState => ({
    page,
    selected,
    picked: pickedNow(),
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    issues,
    unpublished: unpublished(),
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

  /** An edit's page checked as validatePage would, at the cost of what it changed. */
  const checkEdit = editChecker();

  /**
   * Apply an edit to a copy, validate it, and keep it — or refuse it, saying
   * why. `after` runs once it is kept, before anyone is told: what the edit
   * picks is told with it, as one change, so a view draws it once.
   */
  function apply(edit: (draft: Page) => void, merge: string | null = null, after?: () => void): boolean {
    const draft = clone(page);
    try {
      edit(draft);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      issues = [error.in(words)];
      notify();
      return false;
    }
    // rules lane: a field a rule still reads keeps its definition, so the rule can be seen and put right.
    keepWhatRulesRead(page, draft);
    // steps lane: a tab or step taken away takes the steps that go to it, and its own, with it.
    forgetGoneTargets(draft);
    const checked = checkEdit(page, draft);
    if (!checked.ok) {
      issues = checked.issues.map((issue) => words.refusals.invalid(issue.path, issue.message));
      notify();
      return false;
    }
    if (!(merge && merge === mergeKey)) past = [...past, page];
    mergeKey = merge;
    future = [];
    leave(page);
    // What the edit left alone stays the same objects, so the views can skip it.
    page = checked.page;
    issues = [];
    after?.();
    notify();
    saveDraft();
    return true;
  }

  /** A new part after another, or in a container at a place: in a group in twelfths, a row of its own. */
  function placeAfter(draft: Page, node: LayoutNode, where: Where = {}): void {
    const new_ = (holder: Container, index: number) => twelfths.putAt(draft, holder as Holder, index, [node], (p) => twelfths.landingSpan(draft, p, holder as Holder));
    if (where.after) {
      const found = findNode(draft, where.after);
      if (!found) throw new Refusal((w) => w.refusals.noElement(where.after as string));
      new_(found.parent, found.index + 1);
      return;
    }
    const all = containers(draft);
    const parent = where.parent ? all.find((c) => c.id === where.parent) : all[all.length - 1];
    if (!parent) throw new Refusal((w) => w.refusals.noStepOrSection(String(where.parent)));
    new_(parent, where.index === undefined ? parent.children.length : Math.max(0, Math.min(where.index, parent.children.length)));
  }

  function refuseInSurvey(draft: Page, kind: QuestionKind) {
    if (kind.group === 'records' && draft.data.kind === 'responses') throw new Refusal((w) => w.refusals.surveyHasNoRecords);
  }

  /** A field of the node, when it is one of the given types and the page's own to change: `owned` says what the model keeps otherwise. */
  function fieldOfType<T extends Field['type']>(draft: Page, id: string, types: T[], refusal: (w: DesignerWords) => string, owned: (w: DesignerWords, label: string) => string): Extract<Field, { type: T }> {
    const name = fieldNode(draft, id).field;
    const field = draft.fields[name];
    if (!(types as string[]).includes(field.type)) throw new Refusal(refusal);
    if (fromModel(name)) throw new Refusal((w) => owned(w, field.label));
    return field as Extract<Field, { type: T }>;
  }

  /** A layout edit, one undo step: what it made or moved is picked after, `lead` leading when it is among them. */
  function layoutEdit<T extends string | string[]>(edit: (draft: Page) => T, lead: string | null = null): T | false {
    let made = null as T | null;
    const ok = apply(
      (draft) => void (made = edit(draft)),
      null,
      () => {
        if (made === null) return;
        picked = ([] as string[]).concat(made);
        selected = lead !== null && picked.includes(lead) ? lead : (picked[0] ?? null);
      }
    );
    return ok && made !== null ? made : false;
  }

  /** Picks of parts no longer on the page are let go; the one picked last of the rest leads. */
  function forgetGone() {
    const ids = allIds(page);
    picked = pickedNow().filter((id) => ids.has(id));
    if (selected !== null && !ids.has(selected)) selected = picked[picked.length - 1] ?? null;
  }

  function fieldNode(draft: Page, id: string): FieldNode {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
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
  const choices = choiceCommands({ apply, fromModel, words });
  const inputs = inputCommands({ apply, fromModel, words });
  const structures = structureCommands({ apply, fromModel });

  const designer: Designer = {
    ...header,
    ...list,
    ...kinds,
    ...choices,
    ...inputs,
    ...structures,
    words,
    locale,
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
        if (!fromModel(name)) throw new Refusal((w) => w.refusals.noModelField(name));
        if (shownFields(draft).has(name)) throw new Refusal((w) => w.refusals.onThePageAlready(model[name].label));
        // A definition the page already keeps for it stays; otherwise the model's.
        draft.fields[name] = draft.fields[name] ?? clone(model[name]);
        const ids = allIds(draft);
        created = nextName((id) => ids.has(id), 'q', '-');
        placeAfter(draft, { type: 'field', id: created, field: name }, where);
      }, null, () => (selected = created));
      return ok ? created : false;
    },

    isFromModel(id) {
      const found = findNode(page, id);
      return found?.node.type === 'field' && fromModel(found.node.field);
    },

    kindsFor(id) {
      const found = findNode(page, id);
      if (!found || found.node.type !== 'field') return [];
      const name = found.node.field;
      const offered = kindsFor(page.fields[name], { fromModel: fromModel(name), survey: page.data.kind === 'responses', app: appKinds });
      // The kind it is shown as now is always one, even where the page would not offer it to add (a photo on a form).
      const now = kindOfField(page.fields[name], found.node);
      return now && !offered.some((k) => k.id === now) ? [kindOf(now), ...offered] : offered;
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
        const field = freeFieldName(draft);
        const id = nextName((name) => ids.has(name), 'q', '-');
        draft.fields[field] = kind.field(words.defaults.untitledQuestion, words);
        const node: FieldNode = { type: 'field', id, field, ...(kind.widget ? { widget: kind.widget } : {}) };
        created = id;
        placeAfter(draft, node, where);
      }, null, () => (selected = created));
      return ok ? created : false;
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
        if (field.type !== 'selection') throw new Refusal((w) => w.refusals.noOptions(id));
        if (fromModel(node.field)) throw new Refusal((w) => w.refusals.optionsFromModel(field.label));
        const old = field.options;
        const used = new Set<string | number>();
        const placeholder = (o: Option | undefined) => !!o && /^option_\d+$/.test(String(o.value)) && isDefaultOption(o.label);
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
            value = there && !placeholder(there) ? there.value : slug(label, '_', `option_${i + 1}`);
          }
          while (used.has(value)) value = `${value}_${i + 1}`;
          used.add(value);
          // An option kept keeps its picture, points and flags.
          const kept = old.find((o) => o.value === value);
          return { ...kept, value, label };
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
            const fitting = kindsFor(old, { fromModel: true, survey: draft.data.kind === 'responses', app: appKinds });
            throw new Refusal((w) => w.kinds.onlyShownAs(old.label, storedAs(old, w), w.kinds.orList(fitting.map((k) => kindName(k, w)))));
          }
          if (kind.widget) node.widget = kind.widget;
          else delete node.widget;
          return;
        }
        const next = kind.field(old.label, words) as Field & { help?: string; required?: boolean };
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
        if (!list || index === undefined) throw new Refusal((w) => w.refusals.noElement(id));
        const to = index + delta;
        if (to < 0 || to >= list.length) throw new Refusal((w) => w.refusals.cannotMoveFurther);
        const [moved] = list.splice(index, 1);
        list.splice(to, 0, moved);
      });
    },

    placeNode(id, parentId, index, options = {}) {
      const pick = () => {
        if (!options.pick) return;
        selected = id;
        picked = [id];
      };
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found) throw new Refusal((w) => w.refusals.noElement(id));
        const parent = containers(draft).find((c) => c.id === parentId);
        if (!parent) throw new Refusal((w) => w.refusals.noStepOrSection(parentId));
        const came = ops.cameFrom(draft, id);
        // Its row closes up behind it; it is no wider than its new section, and as wide a share of a row in twelfths.
        ops.detach(draft, id);
        const holder = parent as Holder;
        twelfths.putAt(draft, holder, Math.max(0, Math.min(index, parent.children.length)), [found.node], (p) => twelfths.landingSpan(draft, p, holder, came), () => came?.cols);
      }, null, pick);
    },

    duplicateNode(id) {
      let created = '';
      const ok = apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
        const ids = allIds(draft);
        const field = freeFieldName(draft);
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
          if (root.children.length === 1) throw new Refusal((w) => w.refusals.oneStepOrSection);
          root.children.splice(topIndex, 1);
        } else if (found) ops.detach(draft, id); // Its row closes up.
        else if (tab) {
          tab.tabs.children.splice(tab.index, 1);
          // Tabs with no tab left go too.
          if (!tab.tabs.children.length) {
            const holder = findNode(draft, tab.tabs.id);
            if (holder) holder.parent.children.splice(holder.index, 1);
          }
        } else throw new Refusal((w) => w.refusals.noElement(id));
        // Drop the fields nothing shows any more.
        const shown = shownFields(draft);
        for (const name of Object.keys(draft.fields)) if (!shown.has(name)) delete draft.fields[name];
      }, null, () => {
        if (selected === id) selected = null;
      });
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
          if (!tab) throw new Refusal((w) => w.refusals.noTab(where.parent as string));
          tab.tab.children.push(section());
        } else if (root.type === 'wizard') {
          created = nextName((name) => ids.has(name), 'step', '-');
          const at = where.after ? root.children.findIndex((step) => step.children.some((n) => n.id === where.after)) : -1;
          if (where.after && at === -1) throw new Refusal((w) => w.refusals.noQuestion(where.after as string));
          if (at === -1) root.children.push({ type: 'step', id: created, label, children: [] });
          else {
            const step = root.children[at];
            const cut = step.children.findIndex((n) => n.id === where.after) + 1;
            root.children.splice(at + 1, 0, { type: 'step', id: created, label, children: step.children.splice(cut) });
          }
        } else if (root.type === 'sections' || root.type === 'sheet') root.children.push(section());
        else throw new Refusal((w) => w.refusals.nothingToAddTo);
      });
      return ok ? created : false;
    },

    setLayoutKind(kind) {
      return apply((draft) => {
        const root = draft.layout;
        if (root.type === kind) throw new Refusal((w) => (kind === 'sheet' ? w.refusals.sheetAlready : w.refusals.sectionsAlready));
        const ids = allIds(draft);
        const rootId = ids.has(kind) ? root.id : kind;
        if (kind === 'sheet') {
          if (root.type !== 'sections') throw new Refusal((w) => w.refusals.onlySectionsBecomeSheet);
          draft.layout = { type: 'sheet', id: rootId, children: root.children };
          return;
        }
        if (root.type !== 'sheet') throw new Refusal((w) => w.refusals.onlySheetBecomesSections);
        if (root.children.some((n) => n.type === 'tabs')) throw new Refusal((w) => w.refusals.takeTabsOut);
        const parts = (['statusbar', 'buttons', 'statButtons', 'ribbon', 'alerts', 'badges', 'sidePanel'] as const).filter((part) => root[part] !== undefined);
        if (parts.length) throw new Refusal((w) => w.refusals.cannotShowSheetParts(parts.join(', ')));
        if (root.title) {
          const first = firstSection(draft);
          if (!first) throw new Refusal((w) => w.refusals.sectionForTitle);
          first.children.unshift({ type: 'field', id: nextName((name) => ids.has(name), 'q', '-'), field: root.title.field });
        }
        draft.layout = { type: 'sections', id: rootId, children: root.children };
      });
    },

    setTitleField(nodeId) {
      return apply((draft) => {
        const root = draft.layout as SheetNode;
        if (root.type !== 'sheet') throw new Refusal((w) => w.refusals.onlySheetHasTitle);
        const ids = allIds(draft);
        // The field that was the title goes where the new one was, or first in the first section.
        const old: FieldNode | null = root.title ? { type: 'field', id: nextName((name) => ids.has(name), 'q', '-'), field: root.title.field } : null;
        if (nodeId === null) {
          if (!old) return;
          delete root.title;
          const first = firstSection(draft);
          if (!first) throw new Refusal((w) => w.refusals.titleNeedsSection);
          first.children.unshift(old);
          return;
        }
        const found = findNode(draft, nodeId);
        if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(nodeId));
        const def = draft.fields[found.node.field];
        if (def.type !== 'char') throw new Refusal((w) => w.refusals.titleIsText);
        found.parent.children.splice(found.index, 1, ...(old ? [old] : []));
        root.title = { field: found.node.field, placeholder: def.label };
      });
    },

    addTabs(where = {}) {
      let created = '';
      const ok = apply((draft) => {
        const root = draft.layout;
        if (root.type !== 'sheet') throw new Refusal((w) => w.refusals.tabsOnSheet);
        const ids = allIds(draft);
        const name = (prefix: string) => {
          const id = nextName((n) => ids.has(n), prefix, '-');
          ids.add(id);
          return id;
        };
        created = name('tabs');
        const tabs: TabsNode = { type: 'tabs', id: created, children: [{ type: 'tab', id: name('tab'), label: words.defaults.tab(1), children: [{ type: 'section', id: name('section'), columns: 2, children: [] }] }] };
        const after = where.after ? root.children.findIndex((n) => n.id === where.after) : -1;
        if (where.after && after === -1) throw new Refusal((w) => w.refusals.noElementOnSheet(where.after as string));
        root.children.splice(after === -1 ? root.children.length : after + 1, 0, tabs);
      });
      return ok ? created : false;
    },

    addTab(tabsId, label) {
      let created = '';
      const ok = apply((draft) => {
        const holder = findNode(draft, tabsId);
        if (!holder || holder.node.type !== 'tabs') throw new Refusal((w) => w.refusals.noTabs(tabsId));
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
          if (!container) throw new Refusal((w) => w.refusals.noStepOrSection(id));
          // gap lane: a group that folds does so by its title.
          if ((container as SectionNode).collapsible && !label.trim()) throw new Refusal((w) => w.refusals.foldsByTitle((container as SectionNode).title ?? ''));
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
        if (!target) throw new Refusal((w) => w.refusals.noElement(id));
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
        if (own && rules.rules.some((rule) => rule.field === own)) throw new Refusal((w) => w.refusals.questionOwnAnswer);
        target.invisible = conditionToHide(rules);
      });
    },

    setRule(id, which, condition) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noField(id));
        const node = found.node;
        const rules: Condition = !condition
          ? { join: 'all', rules: [] }
          : 'rules' in condition
            ? condition
            : { join: 'all', rules: [{ field: condition.field, op: 'is', value: condition.equals }] };
        if (rules.rules.some((rule) => rule.field === node.field)) throw new Refusal((w) => w.refusals.fieldOwnAnswer);
        const field = draft.fields[node.field];
        if (which === 'required' && rules.rules.length && field?.required === true) {
          // The model's own word stands; a field of the page's own becomes required only when the rule holds.
          if (fromModel(node.field)) throw new Refusal((w) => w.refusals.alwaysRequired(field.label));
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
        if (!section) throw new Refusal((w) => w.refusals.noSection(sectionId));
        const fields = section.children.filter((n): n is FieldNode => n.type === 'field');
        const others = section.children.filter((n) => n.type !== 'field');
        const byId = new Map(fields.map((n) => [n.id, n]));
        if (items.length !== fields.length || items.some((item) => !byId.has(item.id))) {
          throw new Refusal((w) => w.refusals.arrangementMismatch);
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
          const field = fieldOfType(draft, id, ['many2one', 'many2many', 'one2many'], (w) => w.refusals.onlyLinksPoint, (w, label) => w.refusals.pointsFromModel(label));
          if (!model.trim()) throw new Refusal((w) => w.refusals.sayWhichRecords);
          field.relation = model.trim();
        },
        `relation:${id}`
      );
    },

    setCurrency(id, code) {
      return apply((draft) => {
        const field = fieldOfType(draft, id, ['monetary'], (w) => w.refusals.onlyAmountCurrency, (w, label) => w.refusals.currencyFromModel(label));
        const currency = code.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw new Refusal((w) => w.refusals.currencyLetters);
        field.currency = currency;
        delete field.currencyField;
      });
    },

    setRange(id, range) {
      return apply((draft) => {
        const field = fieldOfType(draft, id, ['integer'], (w) => w.refusals.onlyRange, (w, label) => w.refusals.rangeFromModel(label));
        const { min, max } = range;
        if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) throw new Refusal((w) => w.refusals.rangeWhole);
        Object.assign(field, { min, max });
      });
    },

    setOther(id, on) {
      return apply((draft) => {
        const ask = (w: DesignerWords) => w.refusals.onlyOther;
        const field = fieldOfType(draft, id, ['selection'], ask, (w, label) => w.refusals.otherFromModel(label));
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
        const field = fieldOfType(draft, id, ['binary', 'image'], (w) => w.refusals.onlyFiles, (w, label) => w.refusals.filesFromModel(label));
        if (rules.accept !== undefined) {
          if (field.type === 'image') throw new Refusal((w) => w.refusals.imageOnly);
          if (rules.accept.length) field.accept = [...rules.accept];
          else delete field.accept;
        }
        if (rules.maxSize !== undefined) {
          if (rules.maxSize === null) delete field.maxSize;
          else if (!Number.isInteger(rules.maxSize) || rules.maxSize <= 0) throw new Refusal((w) => w.refusals.largestFile);
          else field.maxSize = rules.maxSize;
        }
        if (rules.multiple === true) field.multiple = true;
        else if (rules.multiple === false) {
          delete field.multiple;
          delete field.minFiles;
          delete field.maxFiles;
        }
        const counts = [['minFiles', 0, (w: DesignerWords) => w.refusals.atLeastFiles], ['maxFiles', 1, (w: DesignerWords) => w.refusals.atMostFiles]] as const;
        for (const [key, least, refusal] of counts) {
          const count = rules[key];
          if (count === undefined) continue;
          if (count !== null && !field.multiple) throw new Refusal((w) => w.refusals.severalFirst);
          if (count === null) delete field[key];
          else if (!Number.isInteger(count) || count < least) throw new Refusal(refusal);
          else field[key] = count;
        }
        if ((field.minFiles ?? 0) > (field.maxFiles ?? Infinity)) throw new Refusal((w) => w.refusals.leastOverMost);
      });
    },

    place: (part, drop) => layoutEdit((draft) => ops.place(draft, part, drop, { model, words })),
    describeDrop: (drop, moving) => ops.describeDrop(page, drop, moving, words),
    dropRefusal: (drop, moving) => ops.dropRefusal(page, drop, moving, words),
    wrap: (ids, kind) => layoutEdit((draft) => ops.wrap(draft, ids, kind, words)),
    ungroup: (id) => layoutEdit((draft) => ops.ungroup(draft, id)) !== false,
    duplicate: (ids) => layoutEdit((draft) => ops.duplicate(draft, ids)),
    remove: (ids) => apply((draft) => ops.remove(draft, ids), null, forgetGone),
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
    setPartLook: (kind, patch) => {
      const colours = !!patch && Object.values(patch).every((value) => typeof value === 'string' && value.startsWith('#'));
      return apply((draft) => settings.setPartLook(draft, kind, patch), colours ? `part-look:${kind}:${Object.keys(patch).join(',')}` : null);
    },
    addBlock: (kind, where) => layoutEdit((draft) => ops.addBlock(draft, kind, where, words)),

    setLineColumns(id, columns) {
      return apply(
        (draft) => {
          const field = fieldOfType(draft, id, ['one2many'], (w) => w.refusals.onlyLinesColumns, (w, label) => w.refusals.columnsFromModel(label));
          if (!columns.length) throw new Refusal((w) => w.refusals.linesNeedColumn);
          const old = field.fields;
          const taken = new Set(columns.map((c) => c.name).filter((name): name is string => !!name && name in old));
          const fields: typeof old = {};
          for (const column of columns) {
            let name = column.name && column.name in old ? column.name : null;
            if (!name) {
              // A new column is named after its label, as a backend names a field.
              const base = slug(column.label, '_', 'column').replace(/^(\d)/, 'c_$1');
              name = base;
              for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
              taken.add(name);
            }
            // A column of the same kind keeps its field: a whole number stays whole, a link stays a link.
            const kept = old[name];
            if (kept && columnKind(kept) === column.kind) fields[name] = { ...kept, label: column.label };
            else if (column.kind === 'other') throw new Refusal((w) => w.refusals.newColumnKind);
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
      if (!checked.ok) throw new Error(words.refusals.cannotPublish);
      const version = store ? await store.publish(clone(page)) : versions.length + 1;
      versions = [...versions, { version, publishedAt: new Date().toISOString(), page: clone(page) }];
      notify();
      return version;
    },

    checks() {
      if (checksOf?.page !== page || checksOf.forms !== formsCame) checksOf = { page, forms: formsCame, checks: pageChecks(page, { valid: checkEdit.passed(page), forms, words }) };
      return [...checksOf.checks];
    },
    fixCheck: (check) => fixCheck(designer, check),

    revertTo(version) {
      const found = versions.find((v) => v.version === version);
      if (!found) {
        issues = [words.refusals.noVersion(version)];
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
    setEach: (ids, change) => apply((draft) => several.setEach(draft, ids, change, fromModel)),
    // json lane
    ...pageJsonCommands({ getPage: () => page, apply }),
    lists: () => clone(options.lists ?? []),
    setOptionsFrom(id, from) {
      const found = findNode(page, id);
      const was = found?.node.type === 'field' ? (page.fields[found.node.field] as { optionsFrom?: OptionsFrom } | undefined)?.optionsFrom : undefined;
      // Typing a list's name is one step, as typing a label is.
      const naming = !!from && !!was && JSON.stringify(was.dependsOn ?? []) === JSON.stringify(from.dependsOn ?? []);
      return apply(
        (draft) => {
          const field = fieldOfType(draft, id, ['selection'], (w) => w.refusals.onlyChoiceFromList, (w, label) => w.refusals.choicesFromModel(label));
          if (!from) {
            delete field.optionsFrom;
            // Written again: one option to start from, when there were none.
            if (!field.options.length) field.options = [{ value: 'option_1', label: words.defaults.option(1) }];
            return;
          }
          field.optionsFrom = { list: from.list, ...(from.dependsOn?.length ? { dependsOn: [...from.dependsOn] } : {}) };
        },
        naming ? `list-name:${id}` : null
      );
    },
    // canvas lane
    updateBlock: (id, patch) => apply((draft) => settings.updateBlock(draft, id, patch), `block:${id}:${Object.keys(patch).join(',')}`),
    setWidths: (widths, options) => apply((draft) => settings.setWidths(draft, widths, options?.twelfths)),
    // rules lane
    ...rulesCommands({ apply, getPage: () => page, fromModel }),
    // extend lane
    appKinds: () => [...appKinds],
    templates: () => templatesFor(page, options.templates, locale ?? 'en'),
    replacePage(next) {
      return apply((draft) => replaceWith(draft, next), null, () => {
        selected = null;
        picked = [];
      });
    },
    assistant: () => options.assistant ?? null,
    // outline lane
    pickMany(ids) {
      const there = new Set([...allIds(page), ...outlineRows(page).map((row) => row.id)]);
      picked = [...new Set(ids)].filter((id) => there.has(id));
      selected = picked[picked.length - 1] ?? null;
      notify();
    },
    // The part that led the pick still leads it.
    moveParts: (ids, parentId, index) => layoutEdit((draft) => moves.moveParts(draft, ids, parentId, index), selected),
    moveRefusal: (ids, parentId) => moves.moveRefusal(page, ids, parentId, words),
    describeMove: (ids, parentId, index) => moves.describeMove(page, ids, parentId, index, words),
    copyParts: (ids) => clipboard.copyParts(page, ids) ?? false,
    pasteParts(text) {
      let pasted: { ids: string[]; dropped: number } | null = null;
      const pick = () => {
        if (!pasted) return;
        picked = [...(pasted as { ids: string[] }).ids];
        selected = picked[picked.length - 1] ?? null;
      };
      if (!apply((draft) => void (pasted = clipboard.pasteParts(draft, text, pickedNow(), { model })), null, pick) || !pasted) return false;
      return pasted;
    },
    // gap lane
    setLookPreset(id) {
      return apply((draft) => {
        const preset = LOOK_PRESETS.find((p) => p.id === id);
        if (!preset) throw new Refusal((w) => w.refusals.noLook(id));
        settings.setLook(draft, wholeLook(preset.look));
      });
    },
    useLook: (look) => apply((draft) => settings.setLook(draft, wholeLook(look))),
    looks: () => options.looks ?? browserLooks(),
    setFold: (id, fold) => apply((draft) => setFold(draft, id, fold)),
    // embed lane
    canPlaceForms: () => typeof store?.list === 'function',
    async savedForms() {
      if (!store?.list) return [];
      return (await store.list()).filter((ref) => ref.id !== page.id);
    },
    savedForm(id, version) {
      const all = forms.versions(id);
      if (!all) return all;
      return { versions: all as PublishedVersion[], page: forms.page(id, version) ?? null };
    },
    loadSavedForm: (id) => forms.load(id),
    addForm(pageId, where) {
      return layoutEdit((draft) => {
        refuseCycle(forms, { page: pageId }, draft);
        const ids = allIds(draft);
        const title = forms.page(pageId)?.title || pageId;
        const node: FormNode = { type: 'form', id: nextName((n) => ids.has(n), 'form', '-'), page: pageId, name: answersName(draft, title) };
        placeAfter(draft, node, where);
        // A whole form takes a whole row of the group it lands in.
        const holder = findNode(draft, node.id)?.parent;
        if (holder) setSpan(node, across(draft, holder as Holder));
        return node.id;
      });
    },
    setForm: (id, patch) =>
      apply((draft) => {
        updateFormPart(draft, id, patch);
        const part = formParts(draft).find((p) => p.id === id) as FormNode;
        if (patch.page !== undefined || patch.version !== undefined) refuseCycle(forms, part, draft);
      }, `form:${id}:${Object.keys(patch).join(',')}`),
    canOpenForm: () => typeof options.openForm === 'function',
    openForm: (id) => options.openForm?.(id),
    // steps lane
    ...stepsCommands({ apply, getPage: () => page }),
  };
  return designer;
}

/** Open a page from a store: its latest draft, or else its latest version. */
createDesigner.open = async (
  id: string,
  store: PageStore,
  options: { model?: Record<string, Field>; lists?: AppList[]; kinds?: readonly AppKind[]; looks?: LookStore; openForm?: (id: string) => void; locale?: DesignerLocale | (string & {}) } = {}
): Promise<Designer> => {
  const { draft, versions } = await store.load(id);
  const page = draft ?? versions[versions.length - 1]?.page;
  if (!page) throw new Error(`The store has no page "${id}"`);
  return createDesigner({ page, store, versions, model: options.model, lists: options.lists, kinds: options.kinds, looks: options.looks, openForm: options.openForm, locale: options.locale });
};
