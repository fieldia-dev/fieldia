import type { Field, LineField, Option, OptionsFrom, OptionsFromField, OptionsFromList } from './field';
import type { Page } from './page';

/** The app's list a choice's options come from, when they do. */
export const optionsList = (from: OptionsFrom | undefined): OptionsFromList | undefined => (from && 'list' in from ? from : undefined);
/** The earlier question a choice's options are carried from, when they are. */
export const optionsField = (from: OptionsFrom | undefined): OptionsFromField | undefined => (from && 'field' in from ? from : undefined);

/**
 * Every option a page's choice may hold, as the page writes it: its own — or, carried from an earlier question
 * (`optionsFrom.field`), that question's (its "None of these" left out) and its own after them. A list's (`optionsFrom.list`)
 * are the app's, known once loaded: its own until then. Whatever conditions hide (`options[].invisible`) included.
 */
export function choiceOptions(fields: Readonly<Record<string, Field | LineField>>, name: string, seen: readonly string[] = []): Option[] {
  const def = fields[name];
  if (def?.type !== 'selection') return [];
  const carried = optionsField(def.optionsFrom);
  if (!carried || seen.includes(carried.field)) return [...def.options];
  return [...choiceOptions(fields, carried.field, [...seen, name]).filter((o) => !o.exclusive), ...def.options];
}

/**
 * The page with each choice carried from an earlier question holding every option it may (`choiceOptions`), for what
 * shows its answers apart from a form — a list's cells, groups and filters, an import — by their labels. The same
 * page when it carries none.
 */
export function withCarriedOptions<P extends Pick<Page, 'fields'>>(page: P): P {
  const carried = Object.keys(page.fields).filter((name) => {
    const def = page.fields[name];
    return def.type === 'selection' && optionsField(def.optionsFrom);
  });
  if (!carried.length) return page;
  const fields = { ...page.fields };
  for (const name of carried) fields[name] = { ...(fields[name] as Extract<Field, { type: 'selection' }>), options: choiceOptions(page.fields, name) };
  return { ...page, fields };
}
