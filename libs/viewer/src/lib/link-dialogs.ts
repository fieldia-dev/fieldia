import { fill, FORMAT_VERSION, literalWords, MESSAGES, writtenPart, type CellRules, type CreateRequest, type DataSource, type Field, type LayoutNode, type OptionsRequest, type Page, type SearchRequest, type Tone } from '@fieldia/core';
import type { WidgetDialogs } from '@fieldia/widgets';
import { openFormDialog, openSearchDialog, type Mount } from './dialog-box';
import { findPage } from './find-page';
import { ownLocale, viewerWords } from './labels';
import { nameFieldOf } from './name-field';
import type { ViewerOptions } from './viewer';

/**
 * A form made of fields, for values edited in a dialog (a line, for one): laid out as asked (a line's own form), else
 * the fields `shown` (every one unless said) in two columns, each with the widget its column's cells are drawn with
 * (`cells`); its labels small inside sentences where the record's page asks (`lowerLabels`).
 */
function valuesPage(fields: Record<string, Field>, title: string, readonly: boolean, layout?: LayoutNode[], phone?: Page['phone'], lowerLabels?: boolean, placed?: string[], cells?: Readonly<Record<string, Pick<CellRules, 'widget' | 'options'>>>): Page {
  const shown = Object.fromEntries(Object.entries(fields).map(([name, def]) => [name, readonly ? { ...def, readonly: true } : def])) as Page['fields'];
  return {
    // In the format this Fieldia writes: its fields are the record's page's, whatever format they came in (a page is read
    // by its stamp, and refused stamped older than a setting it uses).
    fieldia: FORMAT_VERSION,
    id: 'values',
    title,
    data: { kind: 'record', model: 'values' },
    fields: shown,
    // A line's phone numbers read as the record's page reads its own, its labels said as the record's are.
    ...(phone ? { phone } : {}),
    ...(lowerLabels ? { lowerLabels } : {}),
    layout: {
      type: 'sections',
      id: 'values',
      children: layout ?? [{ type: 'section', id: 'values-section', columns: 2, children: (placed ?? Object.keys(shown)).map((name) => ({ type: 'field' as const, id: `values-${name}`, field: name, ...(cells?.[name]?.widget ? { widget: cells[name].widget } : {}), ...(cells?.[name]?.options ? { options: cells[name].options } : {}) })) }],
    },
  };
}


/** Only finding and making linked records, and the app's lists of choices: values edited in a dialog are no record of the source's to load, save or recalculate. */
function lookupsOf(source: DataSource | undefined): DataSource | undefined {
  if (!source) return undefined;
  return {
    ...(source.search ? { search: (request: SearchRequest) => source.search!(request) } : {}),
    ...(source.create ? { create: (request: CreateRequest) => source.create!(request) } : {}),
    // A choice from the app's lists: a line's own form asks them as its line does, its record as parent.
    ...(source.options ? { options: (request: OptionsRequest) => source.options!(request) } : {}),
  };
}

/**
 * The dialogs a page's widgets open, made from the viewer's own options (the acts part's: related.ts's `pageDialogs` asks
 * here once it came): a linked record's page — a new one, or one to edit — a line's values in a form of their own, and
 * Search more…. A linked record's page says its words through `say`, the opener's, so they show over the dialog and
 * outlive it. `mount`: the viewer's `mountViewer`, handed over (a part never imports the viewer's module).
 */
export function linkDialogs(options: ViewerOptions, say: ((message: string, tone: Tone) => void) | undefined, signal: AbortSignal | undefined, mount: Mount): Omit<WidgetDialogs, 'canOpen'> {
  const pageFor = (model: string) => findPage(options, { model });
  // A dialog's page looks and reads like the page that opened it, and can open dialogs of its own.
  const shared = {
    locale: options.locale,
    skin: options.skin,
    theme: options.theme ?? options.page.look?.theme,
    // Read as each dialog opens: the host's tokens as they are then.
    get tokens() {
      return options.tokens;
    },
    dir: options.dir,
    widgets: options.widgets,
    // A part of a dialog that throws is told where the page's own are.
    onError: options.onError,
    preferences: options.preferences,
    pages: options.pages,
    relatedPages: options.relatedPages,
    translate: options.translate,
    look: options.page.look,
    // The person, and the values the app passes in, as the opener's own conditions and filters read them.
    user: options.user,
    context: options.context,
    // The app's own functions, as the opener's expressions call them.
    functions: options.functions,
    // Closed with the viewer that opened them.
    signal,
  };
  return {
    async openRecord(model, request) {
      let found: Page | null;
      try {
        found = await pageFor(model);
      } catch {
        // Its page could not come (a network's failure, the page left as it came): said as a record that cannot be
        // opened is, by its name or the name typed for a new one, else as a form that could not be loaded — never in
        // the loader's words — and asked for anew at the next press.
        const locale = ownLocale(options.locale ?? options.page.language);
        const messages = options.messages ?? MESSAGES[locale];
        const name = request.recordId == null ? request.name : request.title;
        say?.(name ? fill(messages.openFailed, { id: name, problem: messages.partNotLoaded }) : viewerWords(locale, options.labels).formNotLoaded, 'danger');
        return null;
      }
      if (!found) return null;
      // A line opened in its model's page: its labels said as the record's are, unless that page says otherwise.
      const related = request.lowerLabels !== undefined && found.lowerLabels === undefined ? { ...found, lowerLabels: request.lowerLabels } : found;
      const nameField = nameFieldOf(related);
      const result = await openFormDialog({
        ...shared,
        page: related,
        dataSource: options.dataSource,
        recordId: request.recordId ?? null,
        values: request.name || request.values ? { ...(request.values ?? {}), ...(request.name && nameField ? { [nameField]: request.name } : {}) } : undefined,
        title: request.title,
        size: 'large',
        ...(say ? { host: { say } } : {}),
      }, mount);
      if (!result.saved || result.recordId === null) return null;
      const name = nameField ? result.values[nameField] : null;
      const label = typeof name === 'string' && name ? name : request.name ?? request.title;
      // Its values as its page saved them, for a line of a table that opened it to take back.
      return request.withValues ? { id: result.recordId, label, values: result.values } : { id: result.recordId, label };
    },
    searchMore: (request) => openSearchDialog({ title: request.title, search: request.search, locale: options.locale, skin: options.skin, theme: options.theme, tokens: options.tokens, dir: options.dir, look: options.page.look, signal }),
    async editValues(request) {
      const result = await openFormDialog({
        ...shared,
        // Its title as a person reads it, written for the page round its fields; those fields as their page writes them.
        page: valuesPage(Object.fromEntries(Object.entries(request.fields).map(([name, def]) => [name, writtenPart(def)])), literalWords(request.title), request.readonly === true, request.layout?.map(writtenPart), options.page.phone, request.lowerLabels, request.shown, request.cells),
        ...(request.parent ? { parent: request.parent } : {}),
        dataSource: lookupsOf(options.dataSource),
        values: request.values,
        title: request.title,
        // A line's own form is laid out as a page is: the room of a record's dialog.
        ...(request.layout ? { size: 'large' as const } : {}),
        mode: 'values',
        ...(request.buttons ? { labels: { ...options.labels, ...(request.buttons.done ? { saveClose: request.buttons.done } : {}), ...(request.buttons.cancel ? { discard: request.buttons.cancel } : {}) } } : {}),
        ...(request.recompute ? { recompute: request.recompute } : {}),
        ...(say ? { host: { say } } : {}),
      }, mount);
      return result.saved ? result.values : null;
    },
  };
}
