import type { FieldTools } from './part-checks';

/**
 * Record templates people save (a page's `templates`): kept of a record's page, each field it keeps the page's own.
 * Drawn by the templates part, whose checks come with it in the one-tag script.
 */
export function checkTemplates(tools: FieldTools): void {
  const { page } = tools;
  if (page.data.kind !== 'record') tools.report('templates', 'templates are kept of records: a page of responses has none');
  const templates = page.templates;
  if (templates && templates !== true) templates.fields.forEach((name, i) => tools.need(name, `templates.fields[${i}]`));
}
