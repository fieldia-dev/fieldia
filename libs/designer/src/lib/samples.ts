import type { Field, Value } from '@fieldia/core';

/**
 * Made-up values for the canvas to show, so a list or a record reads the way
 * it will with real records in it: each field gets a value of its own kind,
 * different on each row and the same every time it is drawn.
 */

const NAMES = ['Acme Trading', 'Blue Harbor', 'Cedar & Co', 'Delta Foods', 'Evergreen Labs', 'Fable Studio', 'Granite Works', 'Harbor Lights'];
const PEOPLE = ['Amira Saleh', 'Ben Carter', 'Chen Wei', 'Dina Haddad', 'Elif Kaya', 'Farid Nour', 'Grace Okafor', 'Hugo Martin'];
const CITIES = ['Cairo', 'Amman', 'Lisbon', 'Nairobi', 'Dubai', 'Lyon', 'Austin', 'Osaka'];
const TEXT = ['Asked for a quote', 'Prefers e-mail', 'Visits in spring', 'New this year', 'Pays on time'];

const pick = <T>(list: readonly T[], row: number) => list[row % list.length];
const handle = (row: number) => pick(NAMES, row).toLowerCase().split(/\W+/)[0];

/** A value for a field, on the row-th row. */
export function sampleValue(name: string, field: Field, row: number): Value {
  const words = `${name} ${field.label}`.toLowerCase();
  switch (field.type) {
    case 'char':
      if (/mail/.test(words)) return `hello@${handle(row)}.example`;
      if (/phone|mobile/.test(words)) return `+1 555 ${String(1000 + ((row * 137) % 9000))}`;
      if (/web|site|url/.test(words)) return `https://${handle(row)}.example`;
      if (/city|town/.test(words)) return pick(CITIES, row);
      if (/contact|person|owner|manager/.test(words)) return pick(PEOPLE, row);
      // Past the names there are, the same again with a number: still one name to a record.
      if (/name|company|customer|partner|title/.test(words)) return `${pick(NAMES, row)}${row >= NAMES.length ? ` ${Math.floor(row / NAMES.length) + 1}` : ''}`;
      return `${field.label} ${row + 1}`;
    case 'text':
      return pick(TEXT, row);
    case 'html':
      return `<p>${pick(TEXT, row)}</p>`;
    case 'selection':
      if (!field.options.length) return null;
      return field.multiple ? [pick(field.options, row).value] : pick(field.options, row).value;
    case 'integer':
      return [12, 3, 27, 8, 41, 5, 16, 30][row % 8];
    case 'float':
      return [4.5, 12.25, 0.75, 31, 7.5][row % 5];
    case 'monetary':
      return [50000, 18000, 420000, 120000, 250000, 9500, 76000, 33000][row % 8];
    case 'date':
    case 'datetime': {
      const day = new Date(Date.UTC(2026, 0, 1) + row * 23 * 86_400_000).toISOString().slice(0, 10);
      return field.type === 'date' ? day : `${day} 09:30:00`;
    }
    case 'boolean':
      return row % 3 !== 1;
    case 'many2one':
    case 'reference':
      return { id: row + 1, label: `${field.label} ${String.fromCharCode(65 + (row % 26))}` };
    case 'many2many':
      return [{ id: row + 1, label: `${field.label} ${String.fromCharCode(65 + (row % 26))}` }];
    default:
      return null;
  }
}

/** Rows of made-up values for these fields. */
export function sampleRows(fields: Record<string, Field>, names: readonly string[], count: number): Record<string, Value>[] {
  return Array.from({ length: count }, (_, row) => Object.fromEntries(names.filter((n) => fields[n]).map((n) => [n, sampleValue(n, fields[n], row)])));
}
