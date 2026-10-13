import type { ActionStep, PageEvents } from './actions';
import type { Field, Fields, FilterItem, LineField, LineKinds } from './field';
import type { ButtonNode, FieldNode, FormNode, LayoutNode, ListNode, MapCard, MapNode, Pin, RootLayout, SheetNode, StatButton, TabsNode } from './layout';
import type { Page } from './page';
import { BUILT_IN_NAMES, USER_PARTS } from '../expression/built-ins';
import { compileModifier } from '../expression/modifier';
import { compileExpression } from '../expression/expression';
import { dependencyOrder } from '../expression/order';
import { valuesIn } from './words';
import { BROWSER_HOTKEYS, hotkeyWords } from './hotkeys';

export interface PageIssue {
  /** Where the problem is, as a path into the page: `layout.children[0].field`. */
  path: string;
  message: string;
}

export type PageValidation = { ok: true; page: Page } | { ok: false; issues: PageIssue[] };

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** The kinds of field an expression can give a value to: the rest hold records, lines or files. */
const EXPRESSIBLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);
const EXPRESSIBLE_WORDS = 'text, numbers, yes or no, dates, choices and json can';
/** The kinds of field a list's filter bar can list the values of. */
const LISTS_ITS_VALUES = new Set(['selection', 'many2one', 'many2many', 'boolean', 'char', 'integer']);

/** Where an expression's names are looked up: the page's fields, or the fields of one one2many's lines. */
interface Scope {
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

/** Names quoted and joined as a person lists them: "a", "b" and "c". */
const listed = (names: string[]) => {
  const quoted = names.map((name) => `"${name}"`);
  return quoted.length < 2 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
};

/** The second pass of every check: ids unique, every name defined, every condition readable. */
export class ReferenceCheck {
  private readonly issues: PageIssue[] = [];
  private readonly ids = new Map<string, string>();
  /** Where the answers of each saved form placed here go, by name: the path of the part that took it first. */
  private readonly formNames = new Map<string, string>();
  /** The ids of the tabs and wizard steps a step can go to, and where each goTo and show names one. */
  private readonly places = new Set<string>();
  private readonly goingTo: { target: string; path: string }[] = [];

  constructor(
    private readonly page: Page,
    private readonly line?: LineOf
  ) {}

  run(): PageIssue[] {
    this.checkFields(this.page.fields, 'fields', this.line?.name, this.line?.parent);
    this.walkRoot(this.page.layout, 'layout');
    if (this.page.on) this.checkEvents(this.page.on, 'on');
    this.checkGoingTo();
    return this.issues;
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
    const inside = new ReferenceCheck(page, { name: node.field, parent: this.page.fields });
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

  /** A press: steps, an app action, or both — and its steps checked. */
  private checkPress(button: ButtonNode | StatButton, path: string) {
    if (!button.steps && button.action === undefined) this.report(path, 'a button needs steps, an action, or both');
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
              compileExpression(value);
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

  /** Words that show fields' values: each `{name}` a field of this page. */
  private checkValuesIn(words: string, path: string) {
    for (const name of valuesIn(words)) this.need(name, path);
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
        compiled = compileModifier(value);
      } catch (error) {
        this.report(`${path}.${key}`, `cannot read "${value}": ${(error as Error).message}`);
        continue;
      }
      this.checkReads(value, compiled, `${path}.${key}`, scope);
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
        fields = compileModifier(where.condition).fields;
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

  /**
   * An expression for a value must read, read only fields where it is worked
   * out, and add up only line fields that exist. Returns the fields it reads,
   * or null when it cannot be read.
   */
  private checkExpression(source: string, path: string, scope: Scope): readonly string[] | null {
    let compiled: ReturnType<typeof compileExpression>;
    try {
      compiled = compileExpression(source);
    } catch (error) {
      this.report(path, `cannot read "${source}": ${(error as Error).message}`);
      return null;
    }
    this.checkReads(source, compiled, path, scope);
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

  private checkFields(fields: Fields | Record<string, LineField>, base: string, lines?: string, parent?: Record<string, Field | LineField>) {
    const scope: Scope = { fields, lines, ...(parent ? { parent } : {}) };
    this.checkWorkedOut(fields, base, scope);
    for (const [name, def] of Object.entries(fields as Record<string, Field | LineField>)) {
      const path = `${base}.${name}`;
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
      if (def.type === 'selection') def.optionsFrom?.dependsOn?.forEach((other, i) => this.need(other, `${path}.optionsFrom.dependsOn[${i}]`, fields));
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
        if ('lineKinds' in def && def.lineKinds) this.checkLineKinds(name, def.lineKinds, def.fields, `${path}.lineKinds`);
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

  private checkLineKinds(field: string, kinds: LineKinds, lineFields: Record<string, LineField>, path: string) {
    const kindField = lineFields[kinds.field];
    if (!kindField) this.report(`${path}.field`, `"${kinds.field}" is not a field of the lines of "${field}"`);
    else if (kindField.type !== 'selection' && kindField.type !== 'char') {
      this.report(`${path}.field`, `"${kinds.field}" is a ${kindField.type}; the field that says what a line is must be a selection or char`);
    } else if (kindField.type === 'selection') {
      for (const which of ['section', 'note'] as const) {
        const value = kinds[which] ?? which;
        if (!kindField.options.some((o) => o.value === value)) this.report(`${path}.${which}`, `"${kinds.field}" has no option "${value}"`);
      }
    }
    const text = lineFields[kinds.text];
    if (!text) this.report(`${path}.text`, `"${kinds.text}" is not a field of the lines of "${field}"`);
    else if (text.type !== 'char' && text.type !== 'text') {
      this.report(`${path}.text`, `"${kinds.text}" is a ${text.type}; a section's or note's text must be a char or text field`);
    }
  }

  /** A page's own buttons at its foot: buttons as any. */
  private walkFooter(footer: ButtonNode[] | undefined, path: string) {
    footer?.forEach((button, i) => {
      this.claim(button.id, `${path}.footer[${i}]`);
      this.checkModifiers(button, `${path}.footer[${i}]`);
      this.checkPress(button, `${path}.footer[${i}]`);
    });
  }

  private walkRoot(root: RootLayout, path: string) {
    if (root.type === 'tabs') return this.walkNode(root, path);
    this.claim(root.id, path);
    if (root.type === 'sheet' || root.type === 'sections') this.walkFooter(root.footer, path);
    if (root.type === 'sheet') return this.walkSheet(root, path);
    if (root.type === 'sections') return this.walkChildren(root.children, path);
    if (root.type === 'list') return this.walkList(root, path);
    root.children.forEach((step, i) => {
      const stepPath = `${path}.children[${i}]`;
      this.places.add(step.id);
      this.claim(step.id, stepPath);
      this.checkModifiers(step, stepPath);
      this.walkChildren(step.children, stepPath);
    });
  }

  private walkList(list: ListNode, path: string) {
    if (this.page.data.kind !== 'record') this.report('data', 'a list shows records: its data needs kind "record" and a model');
    list.columns.forEach((name, i) => this.need(name, `${path}.columns[${i}]`));
    list.sort?.forEach((order, i) => this.need(order.field, `${path}.sort[${i}].field`));
    list.searchFields?.forEach((name, i) => this.need(name, `${path}.searchFields[${i}]`));
    list.groupBy?.forEach((name, i) => this.need(name, `${path}.groupBy[${i}]`));
    // A list's filters are about its own records: their fields are the page's, and there is no record to take a value from.
    const walk = (item: FilterItem, at: string): void => {
      if ('any' in item) return item.any.forEach((inner, i) => walk(inner, `${at}.any[${i}]`));
      if ('all' in item) return item.all.forEach((inner, i) => walk(inner, `${at}.all[${i}]`));
      this.need(item.field, `${at}.field`);
      if (item.valueFrom !== undefined) this.report(`${at}.valueFrom`, "a list's filter compares with values, not with another field");
    };
    const named = new Set<string>();
    list.filters?.forEach((filter, i) => {
      this.claim(filter.id, `${path}.filters[${i}]`);
      named.add(filter.id);
      filter.filter.forEach((item, j) => walk(item, `${path}.filters[${i}].filter[${j}]`));
    });
    list.defaultFilters?.forEach((id, i) => {
      if (!named.has(id)) this.report(`${path}.defaultFilters[${i}]`, `no filter "${id}" in this list`);
    });
    list.actions?.forEach((button, i) => {
      this.claim(button.id, `${path}.actions[${i}]`);
      this.checkPress(button, `${path}.actions[${i}]`);
    });
    if (list.map) this.walkListMap(list.map, `${path}.map`);
    this.checkListCells(list, path);
  }

  /**
   * A list drawn as a backlog: each column's cells are a column's, a lead's
   * icon is by a field's values; the filter bar's fields can list their
   * values; rows nest under a link to the list's own records; and buttons for
   * the rows chosen need a box to choose one.
   */
  private checkListCells(list: ListNode, path: string) {
    for (const [column, cell] of Object.entries(list.cells ?? {})) {
      const at = `${path}.cells.${column}`;
      if (!list.columns.includes(column)) {
        this.report(at, `"${column}" is no column of this list: its cells are for its columns`);
        continue;
      }
      if (!cell.lead) continue;
      const def = this.need(cell.lead.field, `${at}.lead.field`);
      if (def?.type !== 'selection') continue;
      const values = new Set(def.options.map((option) => String(option.value)));
      for (const value of Object.keys(cell.lead.looks)) if (!values.has(value)) this.report(`${at}.lead.looks.${value}`, `"${value}" is no value of "${cell.lead.field}"`);
    }
    if (list.filterFields && list.search !== 'fields') this.report(`${path}.filterFields`, 'the filter fields are for the "fields" search: add "search": "fields"');
    list.filterFields?.forEach((name, i) => {
      const def = this.need(name, `${path}.filterFields[${i}]`);
      if (def && !LISTS_ITS_VALUES.has(def.type)) this.report(`${path}.filterFields[${i}]`, `"${name}" is a ${def.type}; a filter lists the values of a choice, a link, links, a yes or no, text or a whole number`);
    });
    if (list.parentField !== undefined) {
      const def = this.need(list.parentField, `${path}.parentField`);
      const model = this.page.data.kind === 'record' ? this.page.data.model : '';
      if (def && (def.type !== 'many2one' || def.relation !== model)) {
        this.report(`${path}.parentField`, `"${list.parentField}" ${def.type === 'many2one' ? `links to ${def.relation}` : `is a ${def.type}`}; a parent is a many2one to the list’s own model, ${model}`);
      }
    }
    if (list.choose === false && list.actions?.length) this.report(`${path}.actions`, 'a list’s buttons act on the rows chosen: with "choose": false there is no way to choose one');
  }

  /** A list's map: where each record is, and the fields its pin and its card show, each of a type that can. */
  private walkListMap(map: NonNullable<ListNode['map']>, path: string) {
    const pair = map.latitude !== undefined || map.longitude !== undefined;
    if (map.point !== undefined && pair) this.report(path, 'a map takes point, or latitude and longitude, not both');
    else if (map.point === undefined && (map.latitude === undefined || map.longitude === undefined)) this.report(path, 'a map needs where each record is: point, or latitude and longitude');
    this.checkPlace(map, path, this.here(), map.pin, map.card);
    if (map.regions) this.need(map.regions.field, `${path}.regions.field`);
    if (typeof map.heat === 'object' && map.heat.weight !== undefined) {
      const def = this.need(map.heat.weight, `${path}.heat.weight`);
      if (def && def.type !== 'float' && def.type !== 'integer' && def.type !== 'monetary') this.report(`${path}.heat.weight`, `"${map.heat.weight}" is a ${def.type}; a weight is a number field`);
    }
  }

  /**
   * Where a place is kept, and the fields its pin and its card show, each of a
   * type that can: a page's fields, or a line's when the place is a line's.
   */
  private checkPlace(at: { point?: string; latitude?: string; longitude?: string }, path: string, scope: Scope, pin?: Pin, card?: MapCard) {
    const typed = (name: string | undefined, where: string, ok: (type: string) => boolean, says: string) => {
      if (name === undefined) return;
      const def = this.need(name, where, scope.fields);
      if (def && !ok(def.type)) this.report(where, `"${name}" is a ${def.type}; ${says}`);
    };
    const number = (type: string) => type === 'float' || type === 'integer';
    const picture = (type: string) => type === 'image' || type === 'binary';
    typed(at.point, `${path}.point`, (type) => type === 'json', 'a point is kept in a json field');
    typed(at.latitude, `${path}.latitude`, number, 'a latitude is a number field (float or integer)');
    typed(at.longitude, `${path}.longitude`, number, 'a longitude is a number field (float or integer)');
    if (pin) {
      typed(pin.image, `${path}.pin.image`, picture, "a pin's photo is an image or binary field");
      typed(pin.turn, `${path}.pin.turn`, number, 'a turn is a number field, in degrees');
      if (pin.iconField !== undefined) this.need(pin.iconField, `${path}.pin.iconField`, scope.fields);
      if (pin.label !== undefined) this.need(pin.label, `${path}.pin.label`, scope.fields);
      pin.tones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.pin.tones[${i}]`, ['when'], scope));
      pin.money?.per?.forEach((item, i) => this.checkModifiers(item, `${path}.pin.money.per[${i}]`, ['when'], scope));
    }
    if (card) {
      if (card.title !== undefined) this.need(card.title, `${path}.card.title`, scope.fields);
      typed(card.image, `${path}.card.image`, picture, "a card's picture is an image or binary field");
      // A line is a part, or several on one line; a part a field's name, or a field with its words.
      card.fields?.forEach((line, i) =>
        (Array.isArray(line) ? line : [line]).forEach((part, j) => {
          const at = `${path}.card.fields[${i}]${Array.isArray(line) ? `[${j}]` : ''}${typeof part === 'string' ? '' : '.field'}`;
          this.need(typeof part === 'string' ? part : part.field, at, scope.fields);
        })
      );
      typed(card.href, `${path}.card.href`, (type) => type === 'char' || type === 'text', "a card's link is a text field holding a web address");
    }
  }

  /**
   * A form's map: each layer one kind — the record's place, a place for each
   * of its lines, a route between layers, or the reader's own place — its
   * fields where that kind keeps them, and a route's ends layers it can join.
   */
  private walkMap(node: MapNode, path: string) {
    const layers = new Map<string, { lines: boolean; place: boolean }>();
    node.layers.forEach((layer, i) => {
      const at = `${path}.layers[${i}]`;
      if (layers.has(layer.id)) this.report(`${at}.id`, `two layers are called "${layer.id}"`);
      const pair = layer.latitude !== undefined || layer.longitude !== undefined;
      const placed = layer.point !== undefined || pair;
      const kinds = [placed, !!layer.route, !!layer.myLocation, !!layer.regions, !!layer.reachable].filter(Boolean).length;
      if (kinds !== 1) this.report(at, 'a layer is one of: a place (point, or latitude and longitude, for the record or for each of its lines), a route, myLocation, regions, or reachable');
      if (layer.regions?.choose !== undefined) this.need(layer.regions.choose, `${at}.regions.choose`);
      if (layer.point !== undefined && pair) this.report(at, 'a layer takes point, or latitude and longitude, not both');
      else if (layer.point === undefined && pair && (layer.latitude === undefined || layer.longitude === undefined)) this.report(at, 'a layer needs both latitude and longitude');
      if (layer.lines !== undefined && !placed) this.report(`${at}.lines`, "a layer of lines needs where each line is: point, or latitude and longitude, of the line's fields");
      if (layer.live && (!placed || layer.lines !== undefined)) this.report(`${at}.live`, "live is for a layer of the record's own place: it moves as its fields change");
      this.checkModifiers(layer, at, ['invisible']);
      layers.set(layer.id, { lines: layer.lines !== undefined, place: placed || !!layer.myLocation });
      if (!placed) return;
      if (layer.lines === undefined) return this.checkPlace(layer, at, this.here(), layer.pin, layer.card);
      const def = this.need(layer.lines, `${at}.lines`);
      if (!def) return;
      if (def.type !== 'one2many') return this.report(`${at}.lines`, `"${layer.lines}" is a ${def.type}; a layer of lines is a one2many field`);
      this.checkPlace(layer, at, { fields: def.fields as Record<string, LineField>, lines: layer.lines, parent: this.page.fields }, layer.pin, layer.card);
    });
    node.layers.forEach((layer, i) => {
      const route = layer.route;
      if (!route) return;
      const at = `${path}.layers[${i}].route`;
      const end = (id: string | undefined, key: 'from' | 'to') => {
        if (id === undefined) return;
        const found = layers.get(id);
        if (!found) this.report(`${at}.${key}`, `no layer "${id}" on this map`);
        else if (!found.place || found.lines) this.report(`${at}.${key}`, `a route's ${key} is a layer of one place, or the reader's own; "${id}" is not`);
      };
      end(route.from, 'from');
      end(route.to, 'to');
      if (route.through !== undefined) {
        const found = layers.get(route.through);
        if (!found) this.report(`${at}.through`, `no layer "${route.through}" on this map`);
        else if (!found.lines) this.report(`${at}.through`, `a route goes through a layer of lines; "${route.through}" is not one`);
      }
      if (route.to === undefined && route.through === undefined) this.report(at, 'a route needs where it goes: to, or through');
      const written = (name: string | undefined, key: string, ok: (type: string) => boolean, says: string) => {
        if (name === undefined) return;
        const def = this.need(name, `${at}.write.${key}`);
        if (def && !ok(def.type)) this.report(`${at}.write.${key}`, `"${name}" is a ${def.type}; ${says}`);
      };
      const number = (type: string) => type === 'float' || type === 'integer';
      written(route.write?.seconds, 'seconds', number, 'seconds are a number field');
      written(route.write?.metres, 'metres', number, 'metres are a number field');
      written(route.write?.line, 'line', (type) => type === 'json', 'a line is kept in a json field');
    });
    node.layers.forEach((layer, i) => {
      if (!layer.reachable) return;
      const found = layers.get(layer.reachable.from);
      const at = `${path}.layers[${i}].reachable.from`;
      if (!found) this.report(at, `no layer "${layer.reachable.from}" on this map`);
      else if (!found.place || found.lines) this.report(at, `a reachable area is worked out from a layer of one place, or the reader's own; "${layer.reachable.from}" is not`);
    });
    node.fences?.forEach((fence, i) => {
      const at = `${path}.fences[${i}]`;
      const watched = node.layers.find((layer) => layer.id === fence.layer);
      if (!watched) this.report(`${at}.layer`, `no layer "${fence.layer}" on this map`);
      else if (!watched.live && !watched.myLocation) this.report(`${at}.layer`, `a fence watches a place that moves: a live layer, or the reader's own; "${fence.layer}" is not`);
      if (fence.area !== undefined) {
        const def = this.need(fence.area, `${at}.area`);
        if (def && def.type !== 'json') this.report(`${at}.area`, `"${fence.area}" is a ${def.type}; an area is kept in a json field`);
      }
      if (fence.within !== undefined && !node.layers.some((layer) => layer.id === fence.within && layer.reachable)) this.report(`${at}.within`, `a fence is within a reachable area of this map; "${fence.within}" is not one`);
      this.checkSteps(fence.steps, `${at}.steps`);
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
        return this.walkChildren(node.children, path);
      case 'tabs':
        return this.walkTabs(node, path);
      case 'form':
        return this.checkFormNode(node, path);
      case 'button':
        return this.checkPress(node, path);
      case 'text':
        return this.checkValuesIn(node.text, `${path}.text`);
      case 'map':
        return this.walkMap(node, path);
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
    if (sheet.statusbar) {
      const { field, visibleStates, durationsField, fold, saves, clickable } = sheet.statusbar;
      const at = `${path}.statusbar`;
      this.checkModifiers(sheet.statusbar, at);
      if (durationsField !== undefined) {
        const times = this.need(durationsField, `${at}.durationsField`);
        if (times && times.type !== 'json') this.report(`${at}.durationsField`, `"${durationsField}" is a ${times.type}; time per step comes from a json field`);
      }
      if (saves && !clickable) this.report(`${at}.saves`, 'a click saves only where a step can be clicked (clickable)');
      const def = this.need(field, `${path}.statusbar.field`);
      if (fold && def && def.type !== 'many2one') this.report(`${at}.fold`, 'steps fold by their record (a stage), so only a link’s steps fold; a choice keeps the steps it shows with visibleStates');
      if (def && def.type !== 'selection' && def.type !== 'many2one') {
        this.report(`${path}.statusbar.field`, `"${field}" is a ${def.type}; a statusbar needs a selection or many2one`);
      }
      if (def?.type === 'selection' && visibleStates) {
        const values = new Set(def.options.map((o) => o.value));
        visibleStates.forEach((state, i) => {
          if (!values.has(state)) {
            this.report(`${path}.statusbar.visibleStates[${i}]`, `"${state}" is not an option of "${field}"`);
          }
        });
      }
    }
    sheet.buttons?.forEach((button, i) => {
      this.claim(button.id, `${path}.buttons[${i}]`);
      this.checkModifiers(button, `${path}.buttons[${i}]`);
      this.checkPress(button, `${path}.buttons[${i}]`);
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
        this.checkPress(button, `${at}.buttons[${j}]`);
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

  /** An address with suggestions: a char field, its place kept as a place field keeps one, its parts in a json field. */
  private checkAddressSearch(node: FieldNode, def: Field | LineField | undefined, path: string) {
    const options = node.options ?? {};
    const kind = (key: string) => {
      const name = options[key];
      return typeof name === 'string' && has(this.page.fields, name) ? this.page.fields[name].type : undefined;
    };
    if (def && def.type !== 'char') this.report(`${path}.widget`, `address-search is for a char field; "${node.field}" is a ${def.type}`);
    const place = kind('placeField');
    if (place && place !== 'json' && place !== 'float') this.report(`${path}.options.placeField`, `"${options['placeField']}" is a ${place}; a place is kept in a json field, or in a float field (its latitude) with longitudeField`);
    if (place === 'float' && options['longitudeField'] === undefined) this.report(`${path}.options.placeField`, `"${options['placeField']}" keeps a latitude: name the float field for its longitude in longitudeField`);
    if (options['longitudeField'] !== undefined && place !== 'float') this.report(`${path}.options.longitudeField`, 'longitudeField goes with a placeField that is a float field, its latitude');
    const longitude = kind('longitudeField');
    if (longitude && longitude !== 'float') this.report(`${path}.options.longitudeField`, `"${options['longitudeField']}" is a ${longitude}; a longitude is kept in a float field`);
    const parts = kind('partsField');
    if (parts && parts !== 'json') this.report(`${path}.options.partsField`, `"${options['partsField']}" is a ${parts}; an address's parts are kept in a json field`);
  }

  private checkFieldNode(node: FieldNode, path: string) {
    const def = this.need(node.field, `${path}.field`);
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
    if (def && node.totals) {
      if (def.type !== 'one2many') {
        this.report(`${path}.totals`, `totals only apply to one2many fields; "${node.field}" is a ${def.type}`);
      } else {
        node.totals.forEach((column, i) => {
          const sub = has(def.fields, column) ? def.fields[column] : undefined;
          if (!sub) this.report(`${path}.totals[${i}]`, `"${column}" is not a field of the lines of "${node.field}"`);
          else if (!['integer', 'float', 'monetary'].includes(sub.type)) {
            this.report(`${path}.totals[${i}]`, `"${column}" is a ${sub.type}; only integer, float and monetary columns add up`);
          }
        });
      }
    }
    // Options that point at another field: by convention their names end in "Field".
    for (const [key, value] of Object.entries(node.options ?? {})) {
      if (key.endsWith('Field') && typeof value === 'string') this.need(value, `${path}.options.${key}`);
    }
    if (node.widget === 'address-search') this.checkAddressSearch(node, def, path);
    // The order lines load in: fields of its lines.
    if (def && node.order) {
      if (def.type !== 'one2many') this.report(`${path}.order`, `order only applies to one2many fields; "${node.field}" is a ${def.type}`);
      else node.order.forEach((item, i) => !has(def.fields, item.field) && this.report(`${path}.order[${i}].field`, `"${item.field}" is not a field of the lines of "${node.field}"`));
    }
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
    if (def && (node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons || node.lineDelete !== undefined)) {
      if (def.type !== 'one2many') {
        if (node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons) this.report(path, `cells, rowTones, rowBold and rowButtons only apply to one2many fields; "${node.field}" is a ${def.type}`);
      }
      else {
        const line: Scope = { fields: def.fields, lines: node.field };
        for (const [column, rules] of Object.entries(node.cells ?? {})) {
          if (!has(def.fields, column)) {
            this.report(`${path}.cells.${column}`, `"${column}" is not a field of the lines of "${node.field}"`);
            continue;
          }
          this.checkModifiers(rules, `${path}.cells.${column}`, ['invisible', 'readonly', 'required', 'bold'], line);
          this.checkModifiers(rules, `${path}.cells.${column}`, ['hidden']);
          rules.tones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.cells.${column}.tones[${i}]`, ['when'], line));
          // Its widget's options that point at a field: one of the line's.
          for (const [key, value] of Object.entries(rules.options ?? {})) {
            if (key.endsWith('Field') && typeof value === 'string') this.need(value, `${path}.cells.${column}.options.${key}`, def.fields);
          }
        }
        node.rowTones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.rowTones[${i}]`, ['when'], line));
        this.checkModifiers(node, path, ['rowBold', 'lineDelete'], line);
        node.rowButtons?.forEach((button, i) => {
          this.claim(button.id, `${path}.rowButtons[${i}]`);
          this.checkModifiers(button, `${path}.rowButtons[${i}]`, ['invisible'], line);
          this.checkPress(button, `${path}.rowButtons[${i}]`);
        });
      }
    }
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
    if (def && node.optionalColumns) {
      if (def.type !== 'one2many') {
        this.report(`${path}.optionalColumns`, `optional columns only apply to one2many fields; "${node.field}" is a ${def.type}`);
      } else {
        // The columns the table shows: those named, or every line field but the structural ones.
        const shown = node.columns ?? Object.keys(def.fields).filter((c) => c !== ('lineKinds' in def ? def.lineKinds?.field : undefined) && c !== def.sequenceField);
        for (const column of Object.keys(node.optionalColumns)) {
          if (!shown.includes(column)) this.report(`${path}.optionalColumns.${column}`, `"${column}" is not a column of "${node.field}"`);
        }
      }
    }
    if (!def || !node.columns) return;
    if (def.type === 'one2many') {
      node.columns.forEach((column, i) => {
        if (!has(def.fields, column)) {
          this.report(`${path}.columns[${i}]`, `"${column}" is not a field of the lines of "${node.field}"`);
        } else if (def.fields[column].type === 'one2many') {
          this.report(`${path}.columns[${i}]`, `"${column}" holds lines of its own: they are edited in the line's form (lineForm), not drawn in its row`);
        }
      });
    } else if (def.type === 'many2many') {
      // A table of the records linked: its columns are fields of those records.
      node.columns.forEach((column, i) => {
        if (!def.fields || !has(def.fields, column)) this.report(`${path}.columns[${i}]`, `"${column}" is not a field of the records of "${node.field}"`);
      });
    } else {
      this.report(`${path}.columns`, `columns only apply to one2many and many2many fields; "${node.field}" is a ${def.type}`);
    }
  }
}
