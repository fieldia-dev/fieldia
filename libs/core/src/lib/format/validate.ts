import type * as z from 'zod';
import type { Field, Fields, LineField, LineKinds } from './field';
import type { FieldNode, LayoutNode, RootLayout, SheetNode, TabsNode } from './layout';
import { PageSchema, type Page } from './page';
import { compileModifier } from '../expression/modifier';

export interface PageIssue {
  /** Where the problem is, as a path into the page: `layout.children[0].field`. */
  path: string;
  message: string;
}

export type PageValidation = { ok: true; page: Page } | { ok: false; issues: PageIssue[] };

/**
 * Check a page in two passes: its shape against the format, then every
 * reference inside it — ids unique, every field a layout, title, statusbar,
 * stat button, currency or filter names actually defined, and every modifier
 * readable and reading only fields of this page.
 *
 * Returns the page as validated. Nothing is coerced or filled in: a page that
 * passes is returned equal to the input.
 */
export function validatePage(input: unknown): PageValidation {
  const parsed = PageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => ({ path: formatPath(issue.path), message: describe(issue) })) };
  }
  const page: Page = parsed.data;
  const issues = new ReferenceCheck(page).run();
  return issues.length ? { ok: false, issues } : { ok: true, page };
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(page)';
  return path
    .map((segment, i) => (typeof segment === 'number' ? `[${segment}]` : i === 0 ? String(segment) : `.${String(segment)}`))
    .join('');
}

function describe(issue: z.core.$ZodIssue): string {
  if (issue.code === 'invalid_union' && 'discriminator' in issue && issue.discriminator) {
    return `"${issue.discriminator}" is not one of the kinds allowed here`;
  }
  return issue.message;
}

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

class ReferenceCheck {
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
        def.filter.forEach((condition, i) => {
          if (condition.valueFrom !== undefined) this.need(condition.valueFrom, `${path}.filter[${i}].valueFrom`, fields);
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
    root.children.forEach((step, i) => {
      const stepPath = `${path}.children[${i}]`;
      this.claim(step.id, stepPath);
      this.checkModifiers(step, stepPath);
      this.walkChildren(step.children, stepPath);
    });
  }

  private walkChildren(children: LayoutNode[], path: string) {
    children.forEach((child, i) => this.walkNode(child, `${path}.children[${i}]`));
  }

  private walkNode(node: LayoutNode, path: string) {
    this.claim(node.id, path);
    this.checkModifiers(node, path, node.type === 'field' ? ['invisible', 'readonly', 'required'] : ['invisible']);
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
