import type { Field, LineField } from './field';
import type { Page } from './page';

type AnyField = Field | LineField;

/** A field with the page's zone written in where it is a date and time naming none, and in the fields its lines and links hold. */
function zonedField<F extends AnyField>(field: F, zone: string): F {
  if (field.type === 'datetime') return field.timeZone ? field : { ...field, timeZone: zone };
  if ((field.type === 'one2many' || field.type === 'many2many') && field.fields) {
    const fields = zonedFields(field.fields as Record<string, AnyField>, zone);
    return fields === field.fields ? field : ({ ...field, fields } as F);
  }
  return field;
}

function zonedFields<T extends Record<string, AnyField>>(fields: T, zone: string): T {
  let changed = false;
  const zoned: Record<string, AnyField> = {};
  for (const [name, field] of Object.entries(fields)) {
    zoned[name] = zonedField(field, zone);
    if (zoned[name] !== field) changed = true;
  }
  return changed ? (zoned as T) : fields;
}

/**
 * A page with its time zone (`timeZone`) written into each date and time field that names none of its own — the
 * page's fields, its lines' and the records its links show — so whatever shows or checks one of its values (a list's
 * cell, a value read-only, a day's limits, a pasted cell) reads it on that zone's clock from the field alone. The
 * page as it is when it names no zone, or each such field names its own: an app's field objects stay its own.
 */
export function zonedPage<T extends Page>(page: T): T {
  if (!page.timeZone || !page.fields) return page;
  const fields = zonedFields(page.fields, page.timeZone);
  return fields === page.fields ? page : { ...page, fields };
}
