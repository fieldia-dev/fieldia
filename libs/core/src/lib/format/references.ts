import type { Field, Fields, FilterItem, LineField, LineKinds } from './field';
import type { FieldNode, LayoutNode, ListNode, RootLayout, SheetNode, TabsNode } from './layout';
import type { Page } from './page';
import { compileModifier } from '../expression/modifier';

export interface PageIssue {
  /** Where the problem is, as a path into the page: `layout.children[0].field`. */
  path: string;
  message: string;
}

export type PageValidation = { ok: true; page: Page } | { ok: false; issues: PageIssue[] };

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** The second pass of every check: ids unique, every name defined, every condition readable. */
export class ReferenceCheck {
  private readonly issues: PageIssue[] = [];
  private readonly ids = new Map<string, string>();

  constructor(private readonly page: Page) {}

  run(): PageIssue[] {
    this.checkFields(this.page.fields, 'fields');
    this.walkRoot(this.page.layout, 'layout');
    return this.issues;
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

  /** Every modifier on `owner` must read, and read only fields of this page. */
  private checkModifiers(owner: object, path: string, keys: readonly string[] = ['invisible']) {
    for (const key of keys) {
      const value = (owner as Record<string, unknown>)[key];
      if (typeof value !== 'string') continue;
      let fields: readonly string[];
      try {
        fields = compileModifier(value).fields;
      } catch (error) {
        this.report(`${path}.${key}`, `cannot read "${value}": ${(error as Error).message}`);
        continue;
      }
      for (const name of fields) {
        if (!has(this.page.fields, name)) {
          this.report(`${path}.${key}`, `"${value}" reads "${name}", which is not a field of this page`);
        }
      }
    }
  }

  private checkFields(fields: Fields | Record<string, LineField>, base: string) {
    for (const [name, def] of Object.entries(fields)) {
      const path = `${base}.${name}`;
      // Values set when a condition starts to hold: the condition reads like any other.
      def.setWhen?.forEach((item, i) => this.checkModifiers(item, `${path}.setWhen[${i}]`, ['when']));
      if (def.type === 'monetary' && def.currencyField !== undefined) {
        const currency = this.need(def.currencyField, `${path}.currencyField`, fields);
        if (currency && !['many2one', 'selection', 'char'].includes(currency.type)) {
          this.report(
            `${path}.currencyField`,
            `"${def.currencyField}" is a ${currency.type}; a currency field must be a many2one, selection or char`
          );
        }
      }
      if ((def.type === 'many2one' || def.type === 'many2many') && def.filter) {
        // Groups nest: each valueFrom inside them must name a field too.
        const walk = (item: FilterItem, at: string): void => {
          if ('any' in item) return item.any.forEach((inner, i) => walk(inner, `${at}.any[${i}]`));
          if ('all' in item) return item.all.forEach((inner, i) => walk(inner, `${at}.all[${i}]`));
          if (item.valueFrom !== undefined) this.need(item.valueFrom, `${at}.valueFrom`, fields);
        };
        def.filter.forEach((item, i) => {
          walk(item, `${path}.filter[${i}]`);
        });
      }
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
        this.checkFields(def.fields, `${path}.fields`);
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

  private walkRoot(root: RootLayout, path: string) {
    if (root.type === 'tabs') return this.walkNode(root, path);
    this.claim(root.id, path);
    if (root.type === 'sheet') return this.walkSheet(root, path);
    if (root.type === 'sections') return this.walkChildren(root.children, path);
    if (root.type === 'list') return this.walkList(root, path);
    root.children.forEach((step, i) => {
      const stepPath = `${path}.children[${i}]`;
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
    list.actions?.forEach((button, i) => this.claim(button.id, `${path}.actions[${i}]`));
  }

  private walkChildren(children: LayoutNode[], path: string) {
    children.forEach((child, i) => this.walkNode(child, `${path}.children[${i}]`));
  }

  private walkNode(node: LayoutNode, path: string) {
    this.claim(node.id, path);
    this.checkModifiers(node, path, node.type === 'field' ? ['invisible', 'readonly', 'required'] : node.type === 'section' ? ['invisible', 'readonly'] : ['invisible']);
    switch (node.type) {
      case 'field':
        return this.checkFieldNode(node, path);
      case 'section':
        if (node.collapsible && !node.title) this.report(path, 'a collapsible section needs a title to fold it by');
        if (node.collapsed && !node.collapsible) this.report(path, 'collapsed needs collapsible: true');
        return this.walkChildren(node.children, path);
      case 'tabs':
        return this.walkTabs(node, path);
      default:
        return;
    }
  }

  private walkTabs(node: TabsNode, path: string) {
    node.children.forEach((tab, i) => {
      const tabPath = `${path}.children[${i}]`;
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
    });
    sheet.statButtons?.forEach((stat, i) => {
      this.claim(stat.id, `${path}.statButtons[${i}]`);
      this.checkModifiers(stat, `${path}.statButtons[${i}]`);
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
    // Answer rules: each condition reads, each pattern is a regular expression.
    node.validate?.forEach((rule, i) => {
      const at = `${path}.validate[${i}]`;
      this.checkModifiers(rule, at, ['when']);
      if (rule.pattern === undefined) return;
      try {
        new RegExp(rule.pattern);
      } catch {
        this.report(`${at}.pattern`, `"${rule.pattern}" is not a regular expression`);
      }
    });
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
    if (def && node.editMode && def.type !== 'one2many') {
      this.report(`${path}.editMode`, `editMode only applies to one2many fields; "${node.field}" is a ${def.type}`);
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
    } else if (def.type !== 'many2many') {
      this.report(`${path}.columns`, `columns only apply to one2many and many2many fields; "${node.field}" is a ${def.type}`);
    }
  }
}
