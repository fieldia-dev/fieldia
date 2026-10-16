import { lineKind, type Field, type Line, type RelatedRecord, type Value } from '@fieldia/core';
import { cellText } from './display';
import { describeState, fillIn, maker, wordsFor } from './kind-parts';
import { itemNumber } from './lines';
import type { Widget, WidgetFactory, WidgetState } from './widgets';

/**
 * A table of lines and a many2many's table of records drawn before the lines
 * part has come (parts.ts), by something that did not wait for it as the
 * viewer does: what they hold as plain words, one line under another, read
 * only. Nothing is written to the value; editing waits for the part, whose
 * table takes this one's place with the last state it was given (`partWidget`).
 */

/** Words one under another, each a line of the value; written again only when they change. */
function plainList(document: Document, id: string, texts: (state: WidgetState) => string[]): Widget {
  const make = maker(document);
  const element = make('div', { id, class: 'fd-lines-plain', role: 'list' });
  let shown = '';
  return {
    element,
    focus: () => undefined,
    update(state) {
      const now = texts(state);
      // Joined by a character no value holds, so two lines are never read as one.
      const key = now.join('\u0000');
      if (key !== shown || element.childElementCount !== now.length) {
        shown = key;
        element.replaceChildren(...now.map((text) => make('span', { class: 'fd-value-text', role: 'listitem' }, text)));
      }
      describeState(element, state);
    },
  };
}

/**
 * A one2many's lines: each line's values in its columns' order, as its cells show them at rest ("Desk · 2 · E£ 1,200.00"),
 * a section's or a note's text, and "line 2" for a line with nothing shown — never nothing while there are lines.
 */
export const plainLinesWidget: WidgetFactory = ({ field, node, id, document, labels, locale }) => {
  const def = field as Extract<Field, { type: 'one2many' }>;
  const words = wordsFor(labels, locale);
  const kinds = def.lineKinds;
  // The columns the table shows, as it chooses them.
  const columns = (node.columns ?? Object.keys(def.fields)).filter(
    (column) => def.fields[column] && def.fields[column].type !== 'one2many' && column !== kinds?.field && column !== def.sequenceField && node.optionalColumns?.[column] !== 'hide'
  );
  const said = (value: Value | undefined) => (typeof value === 'string' ? value.trim() : '');
  return plainList(document, id, (state) =>
    ((state.value as Line[] | null) ?? []).map((line, _index, all) => {
      const kind = lineKind(def, line.values);
      const shown = kind && kinds ? [said(line.values[kinds.text])] : columns.map((column) => cellText(def.fields[column], line.values[column], line.values, locale, state.values, node.cells?.[column]));
      // Named by its number as people count lines: a section or a note before it is not one.
      return shown.filter(Boolean).join(' · ') || (kind ? '' : fillIn(words.lineN, { n: itemNumber(all, line.key, (one) => !lineKind(def, one.values)) }));
    })
  );
};

/** A many2many's records by their names (a record with none by its id). */
export const plainLinksWidget: WidgetFactory = ({ id, document }) =>
  plainList(document, id, (state) => ((state.value as RelatedRecord[] | null) ?? []).map((record) => record.label || String(record.id)));
