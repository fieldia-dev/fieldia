import type { Page } from '@fieldia/core';

/** The field a page's records are named by: its title, or "name", or its first line of text. */
export function nameFieldOf(page: Page): string | null {
  if (page.layout.type === 'sheet' && page.layout.title?.field) return page.layout.title.field;
  if (page.fields['name']) return 'name';
  return Object.entries(page.fields).find(([, def]) => def.type === 'char')?.[0] ?? null;
}
