import type { ActionStep, PageEvents } from './actions';
import type { Field, Fields, FilterItem, LineField, LineKinds } from './field';
import type { ButtonNode, FieldNode, FormNode, LayoutNode, ListNode, RootLayout, SheetNode, StatButton, TabsNode } from './layout';
import type { Page } from './page';
import { BUILT_IN_NAMES, USER_PARTS } from '../expression/built-ins';
import { compileModifier } from '../expression/modifier';
import { compileExpression } from '../expression/expression';
import { dependencyOrder } from '../expression/order';

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

/** Where an expression's names are looked up: the page's fields, or the fields of one one2many's lines. */
interface Scope {
  fields: Record<string, Field | LineField>;
  /** The one2many whose lines these are; none for the page's own fields. */
  lines?: string;
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

  constructor(private readonly page: Page) {}

  run(): PageIssue[] {
    this.checkFields(this.page.fields, 'fields');
    this.walkRoot(this.page.layout, 'layout');
    if (this.page.on) this.checkEvents(this.page.on, 'on');
    for (const { target, path } of this.goingTo) {
      if (!this.places.has(target)) this.report(path, `no tab or wizard step "${target}" on this page`);
    }
    return this.issues;
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
    const scope: Scope = { fields: this.page.fields };
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
    } else if (scope.lines === undefined) {
      this.report(path, `"${name}": only a line's filter reads parent, the record it is on`);
    } else if (!has(this.page.fields, part) && part !== 'id') {
      this.report(path, `"${name}": "${part}" is not a field of this page`);
    }
  }

  /** Every modifier on `owner` must read, and read only fields of this page (or of its line). */
  private checkModifiers(owner: object, path: string, keys: readonly string[] = ['invisible'], scope: Scope = { fields: this.page.fields }) {
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
      // A record's expressions read its id and the person; a line's, the person and the record it is on.
      const builtIn = scope.lines === undefined ? (BUILT_IN_NAMES as readonly string[]).includes(name) : name === 'user' || name === 'parent';
      if (builtIn) {
        for (const read of reads.paths) {
          const [root, part] = read.split('.');
          if (root !== name || part === undefined) continue;
          if (name === 'user' && !(USER_PARTS as readonly string[]).includes(part)) this.report(path, `"${source}" reads "${read}": the person has an id, name or roles`);
          if (name === 'parent' && !has(this.page.fields, part) && !(BUILT_IN_NAMES as readonly string[]).includes(part)) this.report(path, `"${source}" reads "${read}": "${part}" is not a field of this page`);
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

  private checkFields(fields: Fields | Record<string, LineField>, base: string, lines?: string) {
    this.checkWorkedOut(fields, base, { fields, lines });
    for (const [name, def] of Object.entries(fields)) {
      const path = `${base}.${name}`;
      if (def.type === 'monetary' && def.currencyField !== undefined) this.checkCurrency(def.currencyField, `${path}.currencyField`, fields, lines);
      // A first value worked out, and what a record made from a link starts with: read where this field is.
      if (def.defaultFrom !== undefined) this.checkExpression(def.defaultFrom, `${path}.defaultFrom`, { fields, lines });
      if ((def.type === 'many2one' || def.type === 'many2many') && def.createValues) {
        for (const [key, source] of Object.entries(def.createValues)) this.checkExpression(source, `${path}.createValues.${key}`, { fields, lines });
      }
      // A new line's values: fields of its lines, read from the record.
      if (def.type === 'one2many' && def.lineDefaults) {
        for (const [key, source] of Object.entries(def.lineDefaults)) {
          if (!has(def.fields, key)) this.report(`${path}.lineDefaults.${key}`, `"${key}" is not a field of the lines of "${name}"`);
          else this.checkExpression(source, `${path}.lineDefaults.${key}`, { fields: this.page.fields });
        }
      }
      if ((def.type === 'many2one' || def.type === 'many2many') && def.filter) {
        def.filter.forEach((item, i) => this.checkFilterItem(item, `${path}.filter[${i}]`, { fields, lines }));
      }
      if (def.type === 'selection') def.optionsFrom?.dependsOn?.forEach((other, i) => this.need(other, `${path}.optionsFrom.dependsOn[${i}]`, fields));
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
        this.checkFields(def.fields, `${path}.fields`, name);
        if (def.lineKinds) this.checkLineKinds(name, def.lineKinds, def.fields, `${path}.lineKinds`);
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
  private checkCurrency(name: string, path: string, fields: Record<string, Field | LineField>, lines: string | undefined) {
    let currency: Field | LineField | undefined;
    if (!name.startsWith('parent.')) currency = this.need(name, path, fields);
    else if (lines === undefined) return this.report(path, `"${name}": only a line’s money reads parent, the record it is on`);
    else if (!has(this.page.fields, name.slice('parent.'.length))) return this.report(path, `"${name}": "${name.slice('parent.'.length)}" is not a field of this page`);
    else currency = this.page.fields[name.slice('parent.'.length)];
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
        return this.walkChildren(node.children, path);
      case 'tabs':
        return this.walkTabs(node, path);
      case 'form':
        return this.checkFormNode(node, path);
      case 'button':
        return this.checkPress(node, path);
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
    }
    if (sheet.statusbar) {
      const { field, visibleStates } = sheet.statusbar;
      const def = this.need(field, `${path}.statusbar.field`);
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
      if (stat.field !== undefined) this.need(stat.field, `${path}.statButtons[${i}].field`);
    });
    if (sheet.ribbon) {
      this.claim(sheet.ribbon.id, `${path}.ribbon`);
      this.checkModifiers(sheet.ribbon, `${path}.ribbon`);
    }
    sheet.badges?.forEach((badge, i) => {
      this.claim(badge.id, `${path}.badges[${i}]`);
      this.checkModifiers(badge, `${path}.badges[${i}]`);
    });
    for (const place of ['above', 'below'] as const) {
      sheet.title?.[place]?.forEach((node, i) => this.walkNode(node, `${path}.title.${place}[${i}]`));
    }
    sheet.alerts?.forEach((alert, i) => {
      this.claim(alert.id, `${path}.alerts[${i}]`);
      this.checkModifiers(alert, `${path}.alerts[${i}]`);
    });
    this.walkChildren(sheet.children, path);
    if (sheet.sidePanel) {
      this.claim(sheet.sidePanel.id, `${path}.sidePanel`);
      this.checkModifiers(sheet.sidePanel, `${path}.sidePanel`);
    }
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
    // Its value's tones and bold: read on the record, as its other conditions are.
    node.tones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.tones[${i}]`, ['when']));
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
    for (const key of ['lineOpens', 'cards', 'fit'] as const) {
      if (def && node[key] && def.type !== 'one2many') this.report(`${path}.${key}`, `${key} only applies to one2many fields; "${node.field}" is a ${def.type}`);
    }
    if (def && node.editMode && def.type !== 'one2many') {
      this.report(`${path}.editMode`, `editMode only applies to one2many fields; "${node.field}" is a ${def.type}`);
    }
    // A table's own rules: a cell's read on its line (with parent), a column's `hidden` on the record.
    if (def && (node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons)) {
      if (def.type !== 'one2many') this.report(path, `cells, rowTones, rowBold and rowButtons only apply to one2many fields; "${node.field}" is a ${def.type}`);
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
        }
        node.rowTones?.forEach((tone, i) => this.checkModifiers(tone, `${path}.rowTones[${i}]`, ['when'], line));
        this.checkModifiers(node, path, ['rowBold'], line);
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
        const shown = node.columns ?? Object.keys(def.fields).filter((c) => c !== def.lineKinds?.field && c !== def.sequenceField);
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
