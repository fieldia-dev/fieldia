import { fillValues, valuesIn, type Fields, type Form, type Locale, type Page, type Values } from '@fieldia/core';
import { linkedWords } from '@fieldia/widgets';
import { valueWords, type ValueWriter } from './value-words';

/** What an ending is drawn into and with: the done screen's parts, the page, its form and how its values read. */
export interface EndingContext {
  doc: Document;
  page: Page;
  form: Form;
  locale: Locale;
  /** How a value reads in the page's words: as a sentence says it. */
  write: ValueWriter;
  /** The done screen's heading, its box of words and its button to start again. */
  title: HTMLElement;
  words: HTMLElement;
  again: HTMLElement;
  /** The viewer's own thanks, and its button's words, where the page's ending says none. */
  thanks: string;
  another: string;
}

/**
 * The ending a page of responses shows for the answers just sent (`form.ending()`): its title, its words — a
 * paragraph for each line, with the answers they name, the id the app gave the response (`{id}`), and links — and its
 * button to start again, its own words or none. Where none holds, the viewer's own thanks. Gives the part that takes
 * the focus, so what it says, the reference with it, is read out.
 */
export function drawEnding(context: EndingContext): HTMLElement | null {
  const { doc, page, form, title, words, again } = context;
  const ending = form.ending();
  const sent = form.getState().sent;
  // The response's id where the page has no field of that name, written as it came.
  const own = !!page.fields['id'];
  const fields: Fields = own ? page.fields : { ...page.fields, id: { type: 'char', label: 'id' } };
  const values = { ...(sent?.values ?? {}), ...(own ? {} : { id: sent?.id ?? null }) } as Values;
  const shown = (text: string) => {
    const drawn = linkedValueWords(doc, fields, text, context.locale, context.write);
    drawn.update(values);
    return drawn.nodes;
  };
  title.replaceChildren(...(ending?.title ? shown(ending.title) : ending?.text ? [] : [context.thanks]));
  title.hidden = !title.childNodes.length;
  const lines = (ending?.text ?? '').split(/\n+/).filter((line) => line.trim());
  words.replaceChildren(
    ...lines.map((line) => {
      const paragraph = doc.createElement('p');
      paragraph.className = 'fd-done-words';
      paragraph.append(...shown(line));
      return paragraph;
    })
  );
  words.hidden = !lines.length;
  again.textContent = typeof ending?.again === 'string' ? form.endingWords(ending.again) : context.another;
  again.hidden = ending?.again === false;
  const first = (title.hidden ? words.firstElementChild : title) as HTMLElement | null;
  first?.setAttribute('tabindex', '-1');
  return first;
}

/**
 * Words with `[words](address)` links among them and `{field}`s anywhere in them — a link's words and its address too,
 * "[See your booking](https://clinic.example/bookings/{id})": the links drawn as `linkedWords` draws them, then each
 * value set in as `valueWords` sets it; in an address, the value as it is kept (a choice's value, a link's id, a day as
 * 2026-10-15), written so it stays one part of the address. The address's start (https://, mailto:) is the page's own.
 */
export function linkedValueWords(doc: Document, fields: Fields, text: string, locale: Locale, write?: ValueWriter): { nodes: (Node | string)[]; update(values: Readonly<Values>): void } {
  const updates: ((values: Readonly<Values>) => void)[] = [];
  const nodes = linkedWords(doc, text).flatMap((node): (Node | string)[] => {
    const isLink = node.nodeType === 1 && (node as Element).tagName === 'A';
    if (node.nodeType !== 3 && !isLink) return [node];
    const drawn = valueWords(doc, fields, node.textContent ?? '', locale, write);
    updates.push(drawn.update);
    if (!isLink) return drawn.nodes;
    const link = node as HTMLAnchorElement;
    link.replaceChildren(...drawn.nodes);
    const address = link.getAttribute('href') ?? '';
    if (valuesIn(address).length) updates.push((values) => link.setAttribute('href', fillValues(address, (name) => encodeURIComponent(keptAs(values[name])))));
    return [link];
  });
  return { nodes, update: (values) => updates.forEach((update) => update(values)) };
}

/** A value as it is kept, in words: a link's id, a choice's value, several joined by commas; nothing for none. */
function keptAs(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(keptAs).join(',');
  if (typeof value === 'object') return 'id' in (value as object) ? String((value as { id: unknown }).id) : '';
  return String(value);
}
