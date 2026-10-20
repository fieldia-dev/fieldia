import type { ActionStep, PageEvents } from './actions';
import type { Field, Fields, FilterItem, LineField } from './field';
import { changesOptions, optionsList } from './choice-options';
import type { ButtonNode, FieldNode, FormNode, LayoutNode, RootLayout, SheetNode, StatButton, TabsNode } from './layout';
import type { Page } from './page';
import { BUILT_IN_NAMES, USER_PARTS } from '../expression/built-ins';
import { compileModifier } from '../expression/modifier';
import { compileExpression } from '../expression/expression';
import { functionTable, type FunctionsKnown } from '../expression/app-functions';
import type { FunctionTable } from '../expression/functions';
import { dependencyOrder } from '../expression/order';
import { valuesIn } from './words';
import { BROWSER_HOTKEYS, hotkeyWords } from './hotkeys';
import { checkButtonParts, checkHead } from './head-checks';
import { checkSectionTracks } from './section-checks';
import { fieldPattern } from './pattern';
import { DUPLICATE_KINDS } from './duplicate-kinds';
import { isTimeZone } from '../record/zones';
import { fill, MESSAGES } from '../record/messages';
import { autofillGroupProblem } from './autofill-group';
import { checkLimits } from './limits-checks';
import { checkSeats } from './seats-checks';
import { checkList, checkRelated, type ListTools } from './list-checks';
import { checkEditable } from './editable-checks';
import type { FieldTools } from './part-checks';
import { checkSlots } from './slots-checks';
import { checkSignature } from './signature-checks';
import { checkEndings } from './endings-checks';
import { checkAddressSearch, checkMap, checkPlace, type MapTools } from './map-checks';
import { checkLineKinds, checkTable, type TableTools } from './table-checks';
import { checkStatusbar } from './statusbar-checks';
import { checkOptionRules } from './option-checks';

export interface PageIssue {
  /** Where the problem is, as a path into the page: `layout.children[0].field`. */
  path: string;
  message: string;
}

/**
 * What a check found. `warnings`, where pages are made (`validatePage`): what does not stop a page — a value of a kind
 * a function does not take, which gives nothing there — said beside it; left out when there are none. `later`, in the
 * one-tag script alone: the parts whose checks of what they draw (a list page's settings) were not run, not come yet —
 * the viewer runs the check again once they have; the packages' checks run them all at once.
 */
export type PageValidation = { ok: true; page: Page; warnings?: PageIssue[]; later?: string[] } | { ok: false; issues: PageIssue[]; warnings?: PageIssue[]; later?: string[] };

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** The kinds of field an expression can give a value to: the rest hold records, lines or files. */
const EXPRESSIBLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);
const EXPRESSIBLE_WORDS = 'text, numbers, yes or no, dates, choices and json can';
/** Where an expression's names are looked up: the page's fields, or the fields of one one2many's lines. */
export interface Scope {
  fields: Record<string, Field | LineField>;
  /** The one2many whose lines these are; none for the page's own fields. */
  lines?: string;
  /** The fields of the record those lines are on, as `parent` reads them: the page's unless said. */
  parent?: Record<string, Field | LineField>;
}

/**
 * A page that is one line's form — a table's line opened in a form of its
 * own (`lineForm`), its fields the line's: its conditions read the line, the
 * record it is on as `parent`.
 */
export interface LineOf {
  /** The table whose line it is, for what is said. */
  name: string;
  /** The fields of the record the line is on. */
  parent: Record<string, Field | LineField>;
}

/** How a page is checked besides its own parts: what the app gives its expressions, and how deep. */
export interface CheckOptions {
  /** The app's own functions its expressions may call (`functions` on the form, the viewer and its wrappers). */
  functions?: FunctionsKnown;
  /**
   * What is wrong with the kinds of value an expression hands its functions, in words, where it is read (`validatePage`
   * gives it: `age(notes)` says notes is text) — a warning, never a refusal: such a call gives null, as it did before
   * the kinds were read. Left out, kinds are not read.
   */
  kinds?(source: string, scope: { fields: Record<string, Field | LineField>; parent?: Record<string, Field | LineField> }): string[];
}

/** Names quoted and joined as a person lists them: "a", "b" and "c". */
const listed = (names: string[]) => {
  const quoted = names.map((name) => `"${name}"`);
  return quoted.length < 2 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
};

/** The second pass of every check: ids unique, every name defined, every condition readable. */
export class ReferenceCheck {
  private readonly issues: PageIssue[] = [];
  /** What does not stop the page, said beside it: the kinds an expression hands its functions (`CheckOptions.kinds`). */
  readonly warnings: PageIssue[] = [];
  /** The parts whose checks are owed, not come yet (the one-tag script's: later-checks.ts): run once they have. */
  readonly later = new Set<string>();
  private readonly ids = new Map<string, string>();
  /** Where the answers of each saved form placed here go, by name: the path of the part that took it first. */
  private readonly formNames = new Map<string, string>();
  /** The ids of the tabs and wizard steps a step can go to, and where each goTo and show names one. */
  private readonly places = new Set<string>();
  private readonly goingTo: { target: string; path: string }[] = [];
  /** The names of the slots the layout places. */
  private readonly slots = new Set<string>();

  /** The app's functions, as the page's expressions call them; or why the names given cannot be. */
  private readonly table: FunctionTable | undefined;
  private readonly tableProblem: string | undefined;

  constructor(
    private readonly page: Page,
    private readonly line?: LineOf,
    private readonly options: CheckOptions = {}
  ) {
    try {
      this.table = functionTable(options.functions);
    } catch (error) {
      this.tableProblem = (error as Error).message;
    }
  }

  run(): PageIssue[] {
    if (this.tableProblem) this.report('(functions)', this.tableProblem);
    if (this.page.timeZone !== undefined) this.checkZone(this.page.timeZone, 'timeZone');
    this.checkFields(this.page.fields, 'fields', this.line?.name, this.line?.parent);
    this.walkRoot(this.page.layout, 'layout');
    checkHead(this.page.layout, 'layout', {
      claim: (id, path) => this.claim(id, path),
      need: (name, path) => this.need(name, path),
      report: (path, message) => this.report(path, message),
      walkNode: (node, path) => this.walkNode(node, path),
      checkModifiers: (owner, path, keys) => this.checkModifiers(owner, path, keys),
      checkSteps: (steps, path) => this.checkSteps(steps, path),
      checkPress: (button, path) => this.checkPress(button, path, true),
      isPart: (id) => this.ids.has(id),
      isPlace: (id) => this.places.has(id),
      owe: (part) => this.later.add(part),
    });
    if (this.page.on) this.checkEvents(this.page.on, 'on');
    if (this.page.botCheck !== undefined && !this.line) this.checkBotCheck(this.page);
    if (this.page.duplicates !== undefined && !this.line) this.checkDuplicates(this.page);
    if (this.page.records !== undefined && !this.line) this.checkRecords(this.page.records);
    if (this.page.endings !== undefined && !this.line) {
      if (this.page.data.kind !== 'responses') this.report('endings', 'endings are for a page of responses, shown once it is sent');
      // Each ending: in the one-tag script, its checks come with the answers part, which a page with any asks for.
      if (Array.isArray(this.page.endings) && this.page.endings.length) checkEndings(this.page, { ...this.fieldTools(), checkModifiers: (owner, path, keys) => this.checkModifiers(owner, path, keys), checkWords: (owner, path, keys, sent) => this.checkWords(owner, path, keys, sent) });
    }
    // A page's limits and Continue later: checked where it has either (in the one-tag script, by the limits part it asks for).
    if (!this.line && (this.page.limits !== undefined || this.page.continueLater !== undefined)) checkLimits(this.page, { report: (path, message) => this.report(path, message), owe: (part) => this.later.add(part) });
    this.checkGoingTo();
    return this.issues;
  }

  /** A bot check: on a page of responses, its captcha drawn in a slot the page places. */
  private checkBotCheck(page: Page) {
    const check = page.botCheck;
    if (page.data.kind !== 'responses') return this.report('botCheck', 'a bot check is for a page of responses that anyone may send; a record’s page is behind the app’s own sign-in');
    const captcha = check?.captcha;
    if (typeof captcha === 'string' && !this.slots.has(captcha)) this.report('botCheck.captcha', `no slot "${captcha}" on this page to draw the captcha in: place { "type": "slot", "id": "${captcha}", "name": "${captcha}" } where it goes`);
  }

  /** Possible duplicates: asked of a record's own page, by fields records can be compared by, each named once. */
  private checkDuplicates(page: Page) {
    const given = page.duplicates?.fields;
    const named: string[] = Array.isArray(given) ? given : [];
    if (!named.length) this.report('duplicates.fields', 'name the fields records are compared by: ["phone", "email"]');
    if (page.data.kind !== 'record') this.report('duplicates', 'duplicates are asked of records like the one typed: a page of responses keeps none to compare it with');
    else if (page.layout.type === 'list') this.report('duplicates', 'duplicates are asked as a record is typed, on its own page, not on a list of records');
    named.forEach((name, i) => {
      const at = `duplicates.fields[${i}]`;
      if (named.indexOf(name) !== i) return this.report(at, `"${name}" is named twice`);
      const def = this.need(name, at);
      if (def && !DUPLICATE_KINDS.has(def.type)) this.report(at, `"${name}" is a ${def.type}; records are compared by words, a number, a date, a choice or a link`);
    });
  }

  /** What the page's records are called: words for one and for more, and for one with its article where given. */
  private checkRecords(records: unknown) {
    const words = (records ?? {}) as Record<string, unknown>;
    const said = (value: unknown) => typeof value === 'string' && /\S/.test(value);
    if (!said(words['one'])) this.report('records.one', 'the word for one record, as a sentence says it: "customer"');
    if (!said(words['other'])) this.report('records.other', 'the word for more than one record: "customers"');
    if (words['a'] !== undefined && !said(words['a'])) this.report('records.a', 'the word for one record with its article: "a customer", "an invoice"');
  }

  /** A time zone the browser knows, by its IANA name: a page's dates and times are never drawn on a clock it cannot read. */
  private checkZone(zone: unknown, path: string) {
    if (!isTimeZone(zone)) this.report(path, `${JSON.stringify(zone)} is not a time zone this browser knows: name one as the IANA does, such as "Africa/Cairo"`);
  }

  /** Each step's goTo and show names a tab or a wizard step of this page. */
  private checkGoingTo() {
    for (const { target, path } of this.goingTo) {
      if (!this.places.has(target)) this.report(path, `no tab or wizard step "${target}" on this page`);
    }
  }

  /** Where the page's own expressions read: its fields — on a line's form, the line's, with its record as parent. */
  private here(): Scope {
    return this.line ? { fields: this.page.fields, lines: this.line.name, parent: this.line.parent } : { fields: this.page.fields };
  }

  /** A line's own form (`lineForm`), its parts checked against the line's fields, its record as parent. */
  private checkLineForm(node: FieldNode, def: Extract<Field, { type: 'one2many' }>, path: string) {
    const children = node.lineForm?.children;
    if (!Array.isArray(children)) return this.report(`${path}.lineForm`, 'a line’s form holds its parts: { "children": [...] }');
    const page = { ...this.page, fields: def.fields as Fields, layout: { type: 'sections', id: `${node.id}#line`, children }, on: undefined } as Page;
    const inside = new ReferenceCheck(page, { name: node.field, parent: this.page.fields }, this.options);
    inside.walkChildren(children, `${path}.lineForm`);
    inside.checkGoingTo();
    this.issues.push(...inside.issues);
  }

  /** The form's moments: their steps checked, a change named by a field (or a saved form placed here, by its answers' name), a step or tab shown by its id. */
  private checkEvents(on: PageEvents, path: string) {
    for (const moment of ['open', 'beforeSave', 'afterSave'] as const) {
      const steps = on[moment];
      if (steps) this.checkSteps(steps, `${path}.${moment}`);
    }
    for (const [field, steps] of Object.entries(on.change ?? {})) {
      if (!this.formNames.has(field)) this.need(field, `${path}.change.${field}`);
      this.checkSteps(steps, `${path}.change.${field}`);
    }
    for (const [target, steps] of Object.entries(on.show ?? {})) {
      this.goingTo.push({ target, path: `${path}.show.${target}` });
      this.checkSteps(steps, `${path}.show.${target}`);
    }
  }

  /** A press: steps, an app action, or both — and its steps checked; on a button drawn on the record (`drawn`, not a list's row's), the `{field}`s its words show. */
  private checkPress(button: ButtonNode | StatButton, path: string, drawn = false) {
    if (drawn && 'type' in button) this.checkWords(button, path, ['label', 'pressedLabel']);
    // A button with a menu of its own and nothing else is a menu button.
    const menu = 'menu' in button && !!button.menu?.length;
    if (!button.steps && button.action === undefined && !menu) this.report(path, 'a button needs steps, an action, or both');
    if ('type' in button && button.type === 'button') checkButtonParts(button, path, { claim: (id, at) => this.claim(id, at), report: (at, message) => this.report(at, message), checkModifiers: (owner, at, keys) => this.checkModifiers(owner, at, keys), checkSteps: (steps, at) => this.checkSteps(steps, at) });
    const key = 'hotkey' in button ? button.hotkey : undefined;
    if (typeof key === 'string' && BROWSER_HOTKEYS.includes(key.replace('shift+', ''))) this.report(`${path}.hotkey`, `${hotkeyWords(key)} is the browser’s own: pick another key`);
    if (button.steps) this.checkSteps(button.steps, `${path}.steps`);
  }

  /**
   * Steps, each against this page: the fields it sets, empties, checks or adds
   * a line to are this page's; its expressions read; a step it goes to is a
   * tab or a wizard step here. The opened page's own fields are not known
   * here: what it starts with is named freely, and what comes back is read
   * as an expression.
   */
  private checkSteps(steps: ActionStep[], path: string) {
    const scope: Scope = this.here();
    steps.forEach((step, i) => {
      const at = `${path}[${i}]`;
      this.checkModifiers(step, at, ['when']);
      switch (step.do) {
        case 'set': {
          const def = this.need(step.field, `${at}.field`);
          if (def && !EXPRESSIBLE.has(def.type)) this.report(`${at}.field`, `a ${def.type} cannot be set from an expression; ${EXPRESSIBLE_WORDS}`);
          this.checkExpression(step.value, `${at}.value`, scope);
          return;
        }
        case 'clear':
          this.need(step.field, `${at}.field`);
          return;
        case 'addLine': {
          const def = this.need(step.field, `${at}.field`);
          if (def && def.type !== 'one2many') return this.report(`${at}.field`, `"${step.field}" is a ${def.type}; a line is added to a one2many`);
          for (const [name, value] of Object.entries(step.values ?? {})) {
            if (def?.type === 'one2many' && !has(def.fields, name)) this.report(`${at}.values.${name}`, `"${name}" is not a field of the lines of "${step.field}"`);
            this.checkExpression(value, `${at}.values.${name}`, scope);
          }
          return;
        }
        case 'check':
          step.fields?.forEach((field, j) => this.need(field, `${at}.fields[${j}]`));
          return;
        case 'goTo':
          this.goingTo.push({ target: step.target, path: `${at}.target` });
          return;
        case 'open':
          if (step.page === this.page.id && step.as === 'page') this.report(`${at}.page`, 'a page cannot open itself in its own place');
          if (step.side !== undefined && step.as !== 'panel') this.report(`${at}.side`, `a side is where a panel comes from; this opens ${step.as === 'page' ? 'in its place' : 'in a dialog'}`);
          if (step.record !== undefined) this.checkExpression(step.record, `${at}.record`, scope);
          for (const [name, value] of Object.entries(step.values ?? {})) this.checkExpression(value, `${at}.values.${name}`, scope);
          // A list's records by this form's values: each valueFrom names one of its fields.
          step.filter?.forEach((item, j) => this.checkFilterItem(item, `${at}.filter[${j}]`, scope));
          for (const [name, value] of Object.entries(step.into ?? {})) {
            this.need(name, `${at}.into.${name}`);
            try {
              compileExpression(value, this.table);
            } catch (error) {
              this.report(`${at}.into.${name}`, `cannot read "${value}": ${(error as Error).message}`);
            }
          }
          if (step.then) this.checkSteps(step.then, `${at}.then`);
          return;
        case 'openUrl':
          this.checkExpression(step.url, `${at}.url`, scope);
          return;
        default:
          return;
      }
    });
  }

  /**
   * Words that show fields' values: each `{name}` a field of this page — in an ending's (`sent`), or `id`, the id the
   * app's source gave the response.
   */
  private checkValuesIn(words: string, path: string, sent = false) {
    for (const name of valuesIn(words)) if (!(sent && name === 'id' && !has(this.page.fields, 'id'))) this.need(name, path);
  }

  /** The words of a part that may show the answers given (`keys` of `owner`): each `{name}` a field of the page. */
  private checkWords(owner: object, path: string, keys: readonly string[], sent = false) {
    for (const key of keys) {
      const words = (owner as Record<string, unknown>)[key];
      if (typeof words === 'string') this.checkValuesIn(words, `${path}.${key}`, sent);
    }
  }

  private report(path: string, message: string) {
    this.issues.push({ path, message });
  }

  private claim(id: string, path: string) {
    const first = this.ids.get(id);
    if (first !== undefined) this.report(path, `duplicate id "${id}", also used at ${first}`);
    else this.ids.set(id, path);
  }

  /** The field a reference names, or a reported issue and undefined. */
  private need(name: string, path: string, scope: Record<string, Field | LineField> = this.page.fields) {
    if (has(scope, name)) return scope[name];
    this.report(path, `no field "${name}"`);
    return undefined;
  }

  /** A filter's conditions: groups nest, and each valueFrom inside them must name a field too. */
  private checkFilterItem(item: FilterItem, at: string, scope: Scope): void {
    if ('any' in item) return item.any.forEach((inner, i) => this.checkFilterItem(inner, `${at}.any[${i}]`, scope));
    if ('all' in item) return item.all.forEach((inner, i) => this.checkFilterItem(inner, `${at}.all[${i}]`, scope));
    if (item.valueFrom !== undefined) this.checkValueFrom(item.valueFrom, `${at}.valueFrom`, scope);
  }

  /** A filter's `valueFrom`: a field where it is used, the record's `id`, a part of `user`, or on a line a field of its record. */
  private checkValueFrom(name: string, path: string, scope: Scope) {
    const [root, part] = name.split('.');
    if (part === undefined) {
      if (has(scope.fields, name) || (name === 'id' && scope.lines === undefined)) return;
      this.need(name, path, scope.fields);
    } else if (root === 'user') {
      if (!(USER_PARTS as readonly string[]).includes(part)) this.report(path, `"${name}": the person has an id, name or roles`);
    } else if (root === 'context') {
      // The app's values: any name it passes in.
    } else if (scope.lines === undefined) {
      this.report(path, `"${name}": only a line's filter reads parent, the record it is on`);
    } else if (!has(scope.parent ?? this.page.fields, part) && part !== 'id') {
      this.report(path, `"${name}": "${part}" is not a field of this page`);
    }
  }

  /** Every modifier on `owner` must read, and read only fields of this page (or of its line). */
  private checkModifiers(owner: object, path: string, keys: readonly string[] = ['invisible'], scope: Scope = this.here()) {
    for (const key of keys) {
      const value = (owner as Record<string, unknown>)[key];
      if (typeof value !== 'string') continue;
      let compiled: ReturnType<typeof compileModifier>;
      try {
        compiled = compileModifier(value, this.table);
      } catch (error) {
        this.report(`${path}.${key}`, `cannot read "${value}": ${(error as Error).message}`);
        continue;
      }
      this.checkReads(value, compiled, `${path}.${key}`, scope);
      this.checkKinds(value, `${path}.${key}`, scope);
    }
  }

  /**
   * Each name an expression reads must be a field where it is worked out, or
   * on a record what every expression there reads: its `id`, and `user` with
   * the person's `id`, `name` or `roles`.
   */
  private checkReads(source: string, reads: { fields: readonly string[]; paths: readonly string[]; wheres: readonly { lines: string; condition: string }[] }, path: string, scope: Scope) {
    // A count's or a sum's condition reads the fields of the lines it is on.
    for (const where of reads.wheres) {
      const lines = scope.fields[where.lines];
      if (lines?.type !== 'one2many') continue;
      let fields: readonly string[];
      try {
        fields = compileModifier(where.condition, this.table).fields;
      } catch (error) {
        this.report(path, `cannot read the condition "${where.condition}": ${(error as Error).message}`);
        continue;
      }
      for (const name of fields) if (!has(lines.fields, name)) this.report(path, `"${where.condition}" reads "${name}", which is not a field of the lines of "${where.lines}"`);
    }
    for (const name of reads.fields) {
      if (has(scope.fields, name)) continue;
      // A record's expressions read its id and the person; a line's, its own id, the person and the record it is on.
      const builtIn = scope.lines === undefined ? (BUILT_IN_NAMES as readonly string[]).includes(name) : name === 'user' || name === 'parent' || name === 'id' || name === 'context';
      if (builtIn) {
        for (const read of reads.paths) {
          const [root, part] = read.split('.');
          if (root !== name || part === undefined) continue;
          if (name === 'user' && !(USER_PARTS as readonly string[]).includes(part)) this.report(path, `"${source}" reads "${read}": the person has an id, name or roles`);
          if (name === 'parent' && !has(scope.parent ?? this.page.fields, part) && !(BUILT_IN_NAMES as readonly string[]).includes(part)) this.report(path, `"${source}" reads "${read}": "${part}" is not a field of this page`);
        }
        continue;
      }
      const where = scope.lines === undefined ? 'of this page' : `of the lines of "${scope.lines}"`;
      this.report(path, `"${source}" reads "${name}", which is not a field ${where}`);
    }
  }

  /** The kinds of value an expression hands its functions, where the check reads them (`CheckOptions.kinds`). */
  private checkKinds(source: string, path: string, scope: Scope) {
    if (!this.options.kinds) return;
    const parent = scope.lines === undefined ? undefined : (scope.parent ?? this.page.fields);
    for (const words of this.options.kinds(source, { fields: scope.fields, ...(parent ? { parent } : {}) })) this.warnings.push({ path, message: `"${source}": ${words}` });
  }

  /**
   * An expression for a value must read, read only fields where it is worked
   * out, and add up only line fields that exist. Returns the fields it reads,
   * or null when it cannot be read.
   */
  private checkExpression(source: string, path: string, scope: Scope): readonly string[] | null {
    let compiled: ReturnType<typeof compileExpression>;
    try {
      compiled = compileExpression(source, this.table);
    } catch (error) {
      this.report(path, `cannot read "${source}": ${(error as Error).message}`);
      return null;
    }
    this.checkReads(source, compiled, path, scope);
    this.checkKinds(source, path, scope);
    for (const sum of compiled.sums) {
      if (!has(scope.fields, sum.lines)) continue;
      const lines = scope.fields[sum.lines];
      if (lines.type !== 'one2many') this.report(path, `sum adds up the lines of a one2many; "${sum.lines}" is a ${lines.type}`);
      else if (!has(lines.fields, sum.field)) this.report(path, `"${sum.field}" is not a field of the lines of "${sum.lines}"`);
    }
    return compiled.fields;
  }

  /**
   * Worked-out values and values set by a condition, among one set of fields:
   * each expression checked, and no two values worked out from each other.
   */
  private checkWorkedOut(fields: Record<string, Field | LineField>, base: string, scope: Scope) {
    const reads = new Map<string, readonly string[]>();
    for (const [name, def] of Object.entries(fields)) {
      const path = `${base}.${name}`;
      if ((def.compute !== undefined || def.setWhen) && !EXPRESSIBLE.has(def.type)) {
        if (def.compute !== undefined) this.report(`${path}.compute`, `a ${def.type} cannot be worked out; ${EXPRESSIBLE_WORDS}`);
        if (def.setWhen) this.report(`${path}.setWhen`, `a ${def.type} cannot be set by a condition; ${EXPRESSIBLE_WORDS}`);
        continue;
      }
      if (def.compute !== undefined) {
        const read = this.checkExpression(def.compute, `${path}.compute`, scope);
        if (read) reads.set(name, read);
      }
      def.setWhen?.forEach((item, i) => {
        this.checkModifiers(item, `${path}.setWhen[${i}]`, ['when'], scope);
        item.on?.forEach((other, j) => this.need(other, `${path}.setWhen[${i}].on[${j}]`, fields));
        this.checkExpression(item.value, `${path}.setWhen[${i}].value`, scope);
      });
    }
    for (const cycle of dependencyOrder(reads).cycles) {
      const names = cycle.slice(0, -1);
      const message = names.length === 1 ? `"${names[0]}" is worked out from itself` : `${listed(names)} are worked out from each other: ${cycle.join(' → ')}`;
      this.report(`${base}.${cycle[0]}.compute`, message);
    }
  }

  /**
   * A choice's options, a page's own and a table line's alike: each condition on one reads the record — a line's, its
   * line and `parent.` (`options[].invisible`); its list's `dependsOn` names fields (`checkDependsOn`); an earlier
   * question it carries them from (`optionsFrom.field`) is another choice of the page, never one carrying its own from
   * this one — and never for a line, whose choices are its own or one of the app's lists.
   */
  private checkChoices(name: string, def: Extract<Field | LineField, { type: 'selection' }>, path: string, fields: Record<string, Field | LineField>, scope: Scope) {
    optionsList(def.optionsFrom)?.dependsOn?.forEach((other, i) => this.checkDependsOn(name, other, `${path}.optionsFrom.dependsOn[${i}]`, fields, scope.lines, scope.parent));
    // Options by condition, or carried from an earlier question: in the one-tag script, checked by the options part a
    // page with any asks for.
    if (changesOptions(def)) checkOptionRules(name, def, path, fields, scope, { ...this.fieldTools(), checkModifiers: (owner, at, keys, inside) => this.checkModifiers(owner, at, keys, inside) });
  }

  private checkFields(fields: Fields | Record<string, LineField>, base: string, lines?: string, parent?: Record<string, Field | LineField>) {
    const scope: Scope = { fields, lines, ...(parent ? { parent } : {}) };
    this.checkWorkedOut(fields, base, scope);
    for (const [name, def] of Object.entries(fields as Record<string, Field | LineField>)) {
      const path = `${base}.${name}`;
      // A field's label, its help and its choices' words may show the answers given — the page's own fields', not a line's.
      if (lines === undefined) {
        this.checkWords(def, path, ['label', 'help']);
        if (def.type === 'selection' && Array.isArray(def.options)) def.options.forEach((option, i) => this.checkWords(option ?? {}, `${path}.options[${i}]`, ['label']));
      }
      if (def.type === 'monetary' && def.currencyField !== undefined) this.checkCurrency(def.currencyField, `${path}.currencyField`, fields, lines, parent);
      // What an amount is for, by a condition on the record it is on: "/month" on a rent.
      if (def.type === 'monetary') def.money?.per?.forEach((item, i) => this.checkModifiers(item, `${path}.money.per[${i}]`, ['when'], scope));
      // A first value worked out, and what a record made from a link starts with: read where this field is.
      if (def.defaultFrom !== undefined) this.checkExpression(def.defaultFrom, `${path}.defaultFrom`, scope);
      if ((def.type === 'many2one' || def.type === 'many2many') && def.createValues) {
        for (const [key, source] of Object.entries(def.createValues)) this.checkExpression(source, `${path}.createValues.${key}`, scope);
      }
      // A new line's values: fields of its lines, read from the record.
      if (def.type === 'one2many' && def.lineDefaults) {
        for (const [key, source] of Object.entries(def.lineDefaults)) {
          if (!has(def.fields, key)) this.report(`${path}.lineDefaults.${key}`, `"${key}" is not a field of the lines of "${name}"`);
          else this.checkExpression(source, `${path}.lineDefaults.${key}`, scope);
        }
      }
      if ((def.type === 'many2one' || def.type === 'many2many') && def.filter) {
        def.filter.forEach((item, i) => this.checkFilterItem(item, `${path}.filter[${i}]`, scope));
      }
      // A pattern reads, or the page says why: a person's Save never ends on a pattern the page got wrong.
      if (def.type === 'char' && def.pattern !== undefined) {
        const pattern = fieldPattern(def.pattern);
        if (pattern instanceof Error) this.report(`${path}.pattern`, fill(MESSAGES.en.patternBroken, { label: def.label, problem: pattern.message }));
      }
      if (def.type === 'datetime' && def.timeZone !== undefined) this.checkZone(def.timeZone, `${path}.timeZone`);
      // A linked record's date and time, in a table of the records a many2many links to.
      if (def.type === 'many2many' && def.fields) {
        for (const [column, linked] of Object.entries(def.fields)) if (linked.type === 'datetime' && linked.timeZone !== undefined) this.checkZone(linked.timeZone, `${path}.fields.${column}.timeZone`);
      }
      if (def.type === 'selection') this.checkChoices(name, def, path, fields, scope);
      checkSeats(def, path, lines ?? this.line?.name, (at, message) => this.report(at, message));
      if (def.type === 'properties') def.definitionsFrom?.dependsOn?.forEach((other, i) => this.need(other, `${path}.definitionsFrom.dependsOn[${i}]`, fields));
      if (def.type === 'properties' && def.definitions) {
        const seen = new Set<string>();
        def.definitions.forEach((property, i) => {
          if (property.type === 'selection' && !property.options) {
            this.report(`${path}.definitions[${i}].options`, 'a choice property needs its choices');
          }
          if (seen.has(property.name)) this.report(`${path}.definitions[${i}].name`, `"${property.name}" is named twice`);
          seen.add(property.name);
        });
      }
      if (def.type === 'one2many') {
        // Its lines read the record they are on — on a line, that line — as parent.
        this.checkFields(def.fields, `${path}.fields`, name, fields);
        if ('lineKinds' in def && def.lineKinds) checkLineKinds(name, def.lineKinds, def.fields, `${path}.lineKinds`, this.fieldTools());
        if (def.sequenceField !== undefined) {
          const sequence = def.fields[def.sequenceField];
          if (!sequence) this.report(`${path}.sequenceField`, `"${def.sequenceField}" is not a field of the lines of "${name}"`);
          else if (sequence.type !== 'integer') {
            this.report(`${path}.sequenceField`, `"${def.sequenceField}" is a ${sequence.type}; the field that keeps the order of lines must be an integer`);
          }
        }
      }
    }
  }

  /**
   * A field a choice's list changes with: one beside it, or on a line `parent.` and a field of the record it is on. A
   * line's list never changes with its own column: choosing would ask for its choices again.
   */
  private checkDependsOn(own: string, name: string, path: string, fields: Record<string, Field | LineField>, lines: string | undefined, parent: Record<string, Field | LineField> = this.page.fields) {
    if (!name.startsWith('parent.')) {
      if (lines !== undefined && name === own) return this.report(path, `"${own}" cannot change with itself`);
      return void this.need(name, path, fields);
    }
    if (lines === undefined) return this.report(path, `"${name}": only a line’s choices read parent, the record it is on`);
    if (!has(parent, name.slice('parent.'.length))) this.report(path, `"${name}": "${name.slice('parent.'.length)}" is not a field of this page`);
  }

  /** A money field's currency: a field beside it, or on a line `parent.` and a field of the record — one that holds a currency. */
  private checkCurrency(name: string, path: string, fields: Record<string, Field | LineField>, lines: string | undefined, parent: Record<string, Field | LineField> = this.page.fields) {
    let currency: Field | LineField | undefined;
    if (!name.startsWith('parent.')) currency = this.need(name, path, fields);
    else if (lines === undefined) return this.report(path, `"${name}": only a line’s money reads parent, the record it is on`);
    else if (!has(parent, name.slice('parent.'.length))) return this.report(path, `"${name}": "${name.slice('parent.'.length)}" is not a field of this page`);
    else currency = parent[name.slice('parent.'.length)];
    if (currency && !['many2one', 'selection', 'char'].includes(currency.type)) {
      this.report(path, `"${name}" is a ${currency.type}; a currency field must be a many2one, selection or char`);
    }
  }


  /** The tools a table of lines' checks are handed (table-checks.ts). */
  private tableTools(): TableTools {
    return {
      ...this.fieldTools(),
      claim: (id, path) => this.claim(id, path),
      checkModifiers: (owner, path, keys, scope) => this.checkModifiers(owner, path, keys, scope),
      checkPress: (button, path) => this.checkPress(button, path),
    };
  }

  /** The tools a part's checks of a field are handed (part-checks.ts). */
  private fieldTools(): FieldTools {
    return { page: this.page, need: (name, path, scope) => this.need(name, path, scope), report: (path, message) => this.report(path, message), owe: (part) => this.later.add(part) };
  }

  /** The tools a map's checks are handed (map-checks.ts). */
  private mapTools(): MapTools {
    return {
      page: this.page,
      need: (name, path, scope) => this.need(name, path, scope),
      report: (path, message) => this.report(path, message),
      checkModifiers: (owner, path, keys, scope) => this.checkModifiers(owner, path, keys, scope),
      checkSteps: (steps, path) => this.checkSteps(steps, path),
      here: () => this.here(),
      owe: (part) => this.later.add(part),
    };
  }

  /** The tools a list page's own checks are handed (list-checks.ts). */
  private listTools(): ListTools {
    return {
      page: this.page,
      need: (name, path, scope) => this.need(name, path, scope),
      report: (path, message) => this.report(path, message),
      claim: (id, path) => this.claim(id, path),
      checkModifiers: (owner, path, keys, scope) => this.checkModifiers(owner, path, keys, scope),
      checkPress: (button, path) => this.checkPress(button, path),
      checkPlace: (at, path, scope, pin, card) => checkPlace(at, path, scope, pin, card, this.mapTools()),
      here: () => this.here(),
      onLine: !!this.line,
      checkCurrency: (name, path, fields, lines, parent) => this.checkCurrency(name, path, fields, lines, parent),
      checkZone: (zone, path) => this.checkZone(zone, path),
      checkFilterItem: (item, at, scope) => this.checkFilterItem(item, at, scope),
      owe: (part) => this.later.add(part),
    };
  }

  /** A page's own buttons at its foot: buttons as any. */
  private walkFooter(footer: ButtonNode[] | undefined, path: string) {
    footer?.forEach((button, i) => {
      this.claim(button.id, `${path}.footer[${i}]`);
      this.checkModifiers(button, `${path}.footer[${i}]`);
      this.checkPress(button, `${path}.footer[${i}]`, true);
    });
  }

  private walkRoot(root: RootLayout, path: string) {
    if (root.type === 'tabs') return this.walkNode(root, path);
    this.claim(root.id, path);
    if (root.type === 'sheet' || root.type === 'sections') this.walkFooter(root.footer, path);
    if (root.type === 'sheet') return this.walkSheet(root, path);
    if (root.type === 'sections') return this.walkChildren(root.children, path);
    if (root.type === 'list') {
      // Its cells changed in place: checked with the part that changes them.
      if (root.editable) checkEditable(root, path, this.fieldTools());
      return checkList(root, path, this.listTools());
    }
    // A wizard's own buttons' words, and each step's title and words, may show the answers given: "Your visit to {branch}".
    this.checkWords(root, path, ['nextLabel', 'backLabel', 'finishLabel']);
    root.children.forEach((step, i) => {
      const stepPath = `${path}.children[${i}]`;
      this.places.add(step.id);
      this.claim(step.id, stepPath);
      this.checkModifiers(step, stepPath);
      this.checkWords(step, stepPath, ['label', 'description']);
      this.walkChildren(step.children, stepPath);
    });
  }



  private walkChildren(children: LayoutNode[], path: string) {
    children.forEach((child, i) => this.walkNode(child, `${path}.children[${i}]`));
  }

  private walkNode(node: LayoutNode, path: string) {
    this.claim(node.id, path);
    this.checkModifiers(node, path, node.type === 'field' ? ['invisible', 'readonly', 'required'] : node.type === 'section' || node.type === 'form' ? ['invisible', 'readonly'] : ['invisible']);
    switch (node.type) {
      case 'field':
        return this.checkFieldNode(node, path);
      case 'section':
        if (node.collapsible && !node.title) this.report(path, 'a collapsible section needs a title to fold it by');
        if (node.collapsed && !node.collapsible) this.report(path, 'collapsed needs collapsible: true');
        if (node.style === 'inline' && node.columns !== undefined) this.report(`${path}.columns`, 'parts on one line take no columns: each is as wide as it needs');
        if (node.style === 'inline' && node.collapsible) this.report(`${path}.collapsible`, 'a line of parts does not fold: its title is its label');
        if (node.style === 'inline') {
          node.children.forEach((child, i) => {
            if (!['field', 'text', 'button', 'spacer'].includes(child.type)) this.report(`${path}.children[${i}]`, `a line of parts holds fields, words and buttons; a ${child.type} needs a row of its own`);
          });
        }
        checkSectionTracks(node, path, (at, message) => this.report(at, message));
        return this.walkChildren(node.children, path);
      case 'tabs':
        return this.walkTabs(node, path);
      case 'form':
        return this.checkFormNode(node, path);
      case 'button':
        return this.checkPress(node, path, true);
      case 'text':
        return this.checkValuesIn(node.text, `${path}.text`);
      case 'map':
        return checkMap(node, path, this.mapTools());
      case 'related':
        return checkRelated(node, path, this.listTools());
      case 'slot':
        this.slots.add(node.name);
        return;
      default:
        return;
    }
  }

  /** A saved form placed here: never this page itself, and its answers under a name no field and no other copy has. */
  private checkFormNode(node: FormNode, path: string) {
    // The quick check reads no shapes: a part with no page or name to go by is said here.
    if (typeof node.page !== 'string' || typeof node.name !== 'string') return this.report(path, 'a saved form placed here needs the page’s id and a name for its answers');
    if (node.page === this.page.id) this.report(`${path}.page`, 'a page cannot be placed inside itself');
    const first = this.formNames.get(node.name);
    if (has(this.page.fields, node.name)) {
      this.report(`${path}.name`, `"${node.name}" is a field of this page: the saved form’s answers need a name of their own`);
    } else if (first !== undefined) {
      this.report(`${path}.name`, `the answers of the saved form at ${first} go under "${node.name}" already: give each copy a name of its own`);
    } else this.formNames.set(node.name, path);
  }

  private walkTabs(node: TabsNode, path: string) {
    node.children.forEach((tab, i) => {
      const tabPath = `${path}.children[${i}]`;
      this.places.add(tab.id);
      this.claim(tab.id, tabPath);
      this.checkModifiers(tab, tabPath);
      this.walkChildren(tab.children, tabPath);
    });
  }

  private walkSheet(sheet: SheetNode, path: string) {
    if (sheet.title) {
      this.need(sheet.title.field, `${path}.title.field`);
      if (sheet.title.subtitleField !== undefined) this.need(sheet.title.subtitleField, `${path}.title.subtitleField`);
      if (sheet.title.avatarField !== undefined) this.need(sheet.title.avatarField, `${path}.title.avatarField`);
      sheet.title.placeholderWhen?.forEach((item, i) => this.checkModifiers(item, `${path}.title.placeholderWhen[${i}]`, ['when']));
    }
    // A statusbar, drawn by the business part, whose checks come with it in the one-tag script.
    if (sheet.statusbar) checkStatusbar(sheet.statusbar, path, { ...this.fieldTools(), checkModifiers: (owner, at, keys) => this.checkModifiers(owner, at, keys) });
    sheet.buttons?.forEach((button, i) => {
      this.claim(button.id, `${path}.buttons[${i}]`);
      this.checkModifiers(button, `${path}.buttons[${i}]`);
      this.checkPress(button, `${path}.buttons[${i}]`, true);
    });
    sheet.statButtons?.forEach((stat, i) => {
      this.claim(stat.id, `${path}.statButtons[${i}]`);
      this.checkModifiers(stat, `${path}.statButtons[${i}]`);
      this.checkPress(stat, `${path}.statButtons[${i}]`);
      for (const key of ['field', 'unitField', 'labelField', 'secondField'] as const) {
        const name = stat[key];
        if (name !== undefined) this.need(name, `${path}.statButtons[${i}].${key}`);
      }
      if (stat.secondLabel !== undefined && stat.secondField === undefined) this.report(`${path}.statButtons[${i}].secondLabel`, 'words for a second value need its field (secondField)');
    });
    const ribbons = [...(sheet.ribbon ? [[sheet.ribbon, `${path}.ribbon`] as const] : []), ...(sheet.ribbons ?? []).map((ribbon, i) => [ribbon, `${path}.ribbons[${i}]`] as const)];
    for (const [ribbon, at] of ribbons) {
      this.claim(ribbon.id, at);
      this.checkModifiers(ribbon, at);
      if (ribbon.labelField !== undefined) this.need(ribbon.labelField, `${at}.labelField`);
    }
    sheet.badges?.forEach((badge, i) => {
      this.claim(badge.id, `${path}.badges[${i}]`);
      this.checkModifiers(badge, `${path}.badges[${i}]`);
    });
    for (const place of ['above', 'before', 'after', 'below'] as const) {
      sheet.title?.[place]?.forEach((node, i) => this.walkNode(node, `${path}.title.${place}[${i}]`));
    }
    sheet.alerts?.forEach((alert, i) => {
      const at = `${path}.alerts[${i}]`;
      this.claim(alert.id, at);
      this.checkModifiers(alert, at);
      this.checkValuesIn(alert.message, `${at}.message`);
      if (alert.messageField !== undefined) this.need(alert.messageField, `${at}.messageField`);
      alert.buttons?.forEach((button, j) => {
        this.claim(button.id, `${at}.buttons[${j}]`);
        this.checkModifiers(button, `${at}.buttons[${j}]`);
        this.checkPress(button, `${at}.buttons[${j}]`, true);
      });
    });
    // The gear menu: buttons of the record, each doing something — its steps, an action, or a built-in — and named.
    sheet.toolbar?.menu?.forEach((item, i) => {
      const at = `${path}.toolbar.menu[${i}]`;
      this.claim(item.id, at);
      this.checkModifiers(item, at);
      if (!item.steps && item.action === undefined && !item.builtin) this.report(at, 'a menu item needs steps, an action, or a built-in');
      if (item.label === undefined && !item.builtin) this.report(`${at}.label`, 'a menu item needs words, unless it is a built-in');
      if (item.steps) this.checkSteps(item.steps, `${at}.steps`);
    });
    const preview = sheet.attachmentPreview;
    if (preview) {
      this.checkModifiers(preview, `${path}.attachmentPreview`);
      const def = preview.field !== undefined ? this.need(preview.field, `${path}.attachmentPreview.field`) : undefined;
      if (def && def.type !== 'binary' && def.type !== 'image') this.report(`${path}.attachmentPreview.field`, `"${preview.field}" is a ${def.type}; the preview shows a file (binary or image)`);
    }
    this.walkChildren(sheet.children, path);
    if (sheet.sidePanel) {
      this.claim(sheet.sidePanel.id, `${path}.sidePanel`);
      this.checkModifiers(sheet.sidePanel, `${path}.sidePanel`);
    }
  }


  /** A picker's own settings, on the kind of field each is for: a path on a link, Fieldia's own list on a choice, a button adding tags, a colour for each state. */
  private checkPicker(node: FieldNode, def: Field | LineField, path: string) {
    const options = node.options ?? {};
    if (node.widget === 'path' && def.type !== 'many2one') this.report(`${path}.widget`, `path is for a many2one field; "${node.field}" is a ${def.type}`);
    const single = def.type === 'selection' && !def.multiple && !node.widget;
    if (options['list'] !== undefined && !single) this.report(`${path}.options.list`, `list "own" is for a choice of one drawn as a list, with no widget; "${node.field}" is ${def.type === 'selection' ? `a selection${def.multiple ? ' of several' : ` drawn as ${node.widget}`}` : `a ${def.type}`}`);
    const tags = (def.type === 'many2many' && (!node.widget || node.widget === 'tags') && !node.columns?.length) || (def.type === 'char' && node.widget === 'tags');
    if (options['adder'] !== undefined && !tags) this.report(`${path}.options.adder`, `adder is for tags: a many2many, or a char field drawn as tags; "${node.field}" is ${node.widget ? `a ${def.type} drawn as ${node.widget}` : `a ${def.type}`}`);
    const colours = options['colours'];
    if (node.widget === 'dot' && def.type === 'selection' && colours && typeof colours === 'object' && !Array.isArray(colours)) {
      const values = new Set(def.options.map((option) => String(option.value)));
      for (const value of Object.keys(colours)) if (!values.has(value)) this.report(`${path}.options.colours.${value}`, `"${value}" is not a value of "${node.field}"`);
    }
  }

  private checkFieldNode(node: FieldNode, path: string) {
    const def = this.need(node.field, `${path}.field`);
    // Its own label and help, as the field's: words that may show the answers given.
    this.checkWords(node, path, ['label', 'help']);
    // Answer rules: each condition and rule across fields reads, each pattern is a regular expression.
    node.validate?.forEach((rule, i) => {
      const at = `${path}.validate[${i}]`;
      this.checkModifiers(rule, at, ['when', 'holds']);
      // No value twice in a column: a column of this table's lines.
      if (rule.distinct !== undefined && def) {
        if (def.type !== 'one2many') this.report(`${at}.distinct`, `distinct is for a table of lines; "${node.field}" is a ${def.type}`);
        else if (!has(def.fields, rule.distinct)) this.report(`${at}.distinct`, `"${rule.distinct}" is not a field of the lines of "${node.field}"`);
      }
      if (rule.pattern === undefined) return;
      try {
        new RegExp(rule.pattern);
      } catch {
        this.report(`${at}.pattern`, `"${rule.pattern}" is not a regular expression`);
      }
    });
    // Its value's tones and bold, and the words its empty box shows: read on the record, as its other conditions are.
    node.tones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.tones[${i}]`, ['when']));
    node.placeholderWhen?.forEach((item, i) => this.checkModifiers(item, `${path}.placeholderWhen[${i}]`, ['when']));
    this.checkModifiers(node, path, ['bold']);
    // What the browser fills its box in with: a box names what it holds, an address in parts only whose it is. (That
    // it is a purpose the standard lists is the format's check, `validatePage`, as other shapes are.)
    if (typeof node.autocomplete === 'string') {
      const problem = autofillGroupProblem(node.autocomplete, node.widget === 'address');
      if (problem) this.report(`${path}.autocomplete`, problem);
    }
    if (def && node.totals && def.type !== 'one2many') this.report(`${path}.totals`, `totals only apply to one2many fields; "${node.field}" is a ${def.type}`);
    // Options that point at another field: by convention their names end in "Field".
    for (const [key, value] of Object.entries(node.options ?? {})) {
      if (key.endsWith('Field') && typeof value === 'string') this.need(value, `${path}.options.${key}`);
    }
    // An address with suggestions, drawn by the app's maps: its checks come with a map's in the one-tag script.
    if (node.widget === 'address-search') checkAddressSearch(node, def, path, this.mapTools());
    // Booking slots on a date and time, a signature on a file: drawn by their parts, whose checks of their settings come
    // with them in the one-tag script.
    if (node.widget === 'slots' && def && def.type !== 'datetime') this.report(`${path}.widget`, `slots is for a datetime field; "${node.field}" is a ${def.type}`);
    else if (node.widget === 'slots') checkSlots(node, path, this.fieldTools());
    if (node.widget === 'signature' && def && def.type !== 'binary') this.report(`${path}.widget`, `signature is for a binary field; "${node.field}" is a ${def.type}`);
    else if (node.widget === 'signature') checkSignature(node, path, this.fieldTools());
    if (def) this.checkPicker(node, def, path);
    // The order lines load in: fields of its lines.
    if (def && node.order && def.type !== 'one2many') this.report(`${path}.order`, `order only applies to one2many fields; "${node.field}" is a ${def.type}`);
    // A line's own form: its parts read the line's fields, the record as parent.
    if (def && node.lineForm) {
      if (def.type !== 'one2many') this.report(`${path}.lineForm`, `lineForm only applies to one2many fields; "${node.field}" is a ${def.type}`);
      else this.checkLineForm(node, def, path);
    }
    for (const key of ['lineOpens', 'cards', 'fit'] as const) {
      if (def && node[key] && def.type !== 'one2many') this.report(`${path}.${key}`, `${key} only applies to one2many fields; "${node.field}" is a ${def.type}`);
    }
    if (def && node.editMode && def.type !== 'one2many') {
      this.report(`${path}.editMode`, `editMode only applies to one2many fields; "${node.field}" is a ${def.type}`);
    }
    // A table's own rules: a cell's read on its line (with parent), a column's `hidden` on the record.
    if (def && node.lineDelete !== undefined && def.type !== 'one2many') this.report(`${path}.lineDelete`, `lineDelete only applies to one2many fields; "${node.field}" is a ${def.type}`);
    if (def && def.type !== 'one2many' && (node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons)) this.report(path, `cells, rowTones, rowBold and rowButtons only apply to one2many fields; "${node.field}" is a ${def.type}`);
    // Buttons for the chosen lines and in the control row: buttons of the record, as any.
    for (const key of ['selectedButtons', 'controlButtons'] as const) {
      if (!node[key]) continue;
      if (def && def.type !== 'one2many') this.report(`${path}.${key}`, `${key} only apply to one2many fields; "${node.field}" is a ${def.type}`);
      node[key].forEach((button, i) => {
        this.claim(button.id, `${path}.${key}[${i}]`);
        this.checkModifiers(button, `${path}.${key}[${i}]`);
        this.checkPress(button, `${path}.${key}[${i}]`);
      });
    }
    if (def && node.optionalColumns && def.type !== 'one2many') this.report(`${path}.optionalColumns`, `optional columns only apply to one2many fields; "${node.field}" is a ${def.type}`);
    // A table of lines' own settings, drawn by the lines part: its columns, totals, order, cells and rows' rules.
    if (def?.type === 'one2many') return checkTable(node, def, path, this.tableTools());
    if (!def || !node.columns) return;
    if (def.type === 'many2many') {
      // A table of the records linked: its columns are fields of those records.
      node.columns.forEach((column, i) => {
        if (!def.fields || !has(def.fields, column)) this.report(`${path}.columns[${i}]`, `"${column}" is not a field of the records of "${node.field}"`);
      });
    } else {
      this.report(`${path}.columns`, `columns only apply to one2many and many2many fields; "${node.field}" is a ${def.type}`);
    }
  }
}
