import type { CreateRequest, DataSource, Field, Page, SearchRequest } from '@fieldia/core';
import type { WidgetDialogs } from '@fieldia/widgets';
import { openFormDialog, openSearchDialog } from './dialog';
import type { ViewerOptions } from './viewer';

/** The field a page's records are named by: its title, or "name", or its first line of text. */
export function nameFieldOf(page: Page): string | null {
  if (page.layout.type === 'sheet' && page.layout.title?.field) return page.layout.title.field;
  if (page.fields['name']) return 'name';
  return Object.entries(page.fields).find(([, def]) => def.type === 'char')?.[0] ?? null;
}



/** A form made of fields, for values edited in a dialog (a line, for one). */
function valuesPage(fields: Record<string, Field>, title: string, readonly: boolean): Page {
  const shown = Object.fromEntries(Object.entries(fields).map(([name, def]) => [name, readonly ? { ...def, readonly: true } : def])) as Page['fields'];
  return {
    fieldia: '0.1',
    id: 'values',
    title,
    data: { kind: 'record', model: 'values' },
    fields: shown,
    layout: {
      type: 'sections',
      id: 'values',
      children: [{ type: 'section', id: 'values-section', columns: 2, children: Object.keys(shown).map((name) => ({ type: 'field' as const, id: `values-${name}`, field: name })) }],
    },
  };
}

/** Only finding and making linked records: values edited in a dialog are no record of the source's to load, save or recalculate. */
function lookupsOf(source: DataSource | undefined): DataSource | undefined {
  if (!source) return undefined;
  return {
    ...(source.search ? { search: (request: SearchRequest) => source.search!(request) } : {}),
    ...(source.create ? { create: (request: CreateRequest) => source.create!(request) } : {}),
  };
}

/** The dialogs a page's widgets may open, made from the viewer's own options. */
export function pageDialogs(options: ViewerOptions): WidgetDialogs {
  const pageFor = (model: string) =>
    (typeof options.relatedPages === 'function' ? options.relatedPages(model) : options.relatedPages?.[model]) ?? null;
  // A dialog's page looks and reads like the page that opened it, and can open dialogs of its own.
  const shared = {
    locale: options.locale,
    skin: options.skin,
    dir: options.dir,
    widgets: options.widgets,
    preferences: options.preferences,
    relatedPages: options.relatedPages,
    translate: options.translate,
  };
  return {
    canOpen: (model) => pageFor(model) !== null,
    async openRecord(model, request) {
      const related = pageFor(model);
      if (!related) return null;
      const nameField = nameFieldOf(related);
      const result = await openFormDialog({
        ...shared,
        page: related,
        dataSource: options.dataSource,
        recordId: request.recordId ?? null,
        values: request.name && nameField ? { [nameField]: request.name } : undefined,
        title: request.title,
        size: 'large',
      });
      if (!result.saved || result.recordId === null) return null;
      const name = nameField ? result.values[nameField] : null;
      return { id: result.recordId, label: typeof name === 'string' && name ? name : request.name ?? request.title };
    },
    searchMore: (request) => openSearchDialog({ title: request.title, search: request.search, locale: options.locale, skin: options.skin, dir: options.dir }),
    async editValues(request) {
      const result = await openFormDialog({
        ...shared,
        page: valuesPage(request.fields, request.title, request.readonly === true),
        dataSource: lookupsOf(options.dataSource),
        values: request.values,
        title: request.title,
        mode: 'values',
        ...(request.recompute ? { recompute: request.recompute } : {}),
      });
      return result.saved ? result.values : null;
    },
  };
}
