import type { Field, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { InputLimits } from './input-commands';

/**
 * The text, number and date kinds' settings, in the picked field itself
 * beside the rest of its kind's, and in the side panel the same way: the
 * most characters a box takes, a paragraph's rows and whether it grows.
 */

export interface InputSettings {
  elements: HTMLElement[];
  refresh(page: Page, node: FieldNode): void;
}
type Part = Omit<InputSettings, 'elements'> & { element: HTMLElement };

const numberOrNull = (text: string) => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text));

export function inputSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): InputSettings | null {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const row = (...parts: HTMLElement[]) => el('div', { class: 'fd-inline-row' }, ...parts);
  const numberBox = (label: string, extra: Record<string, string> = {}) =>
    el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': label, inputmode: 'decimal', ...extra }) as HTMLInputElement;
  const select = (label: string, choices: [string, string][]) =>
    el('select', { class: 'fd-inline-select', 'aria-label': label }, ...choices.map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A box shows what is saved, unless the cursor is in it. */
  const show = (input: HTMLInputElement | HTMLSelectElement, value: unknown) => {
    if (!focused(input)) input.value = value === undefined || value === null ? '' : String(value);
  };
  /** A number box whose number, once typed and left, is a limit of the field. */
  const limitBox = (label: string, key: keyof InputLimits, extra: Record<string, string> = {}) => {
    const input = numberBox(label, extra);
    input.addEventListener('change', () => designer.setLimits(id, { [key]: numberOrNull(input.value) }));
    return input;
  };
  const own = (field: Field, key: string) => (field as Record<string, unknown>)[key];

  /** The most characters a short answer or a paragraph takes: a count shows under its box. */
  function most(): Part {
    const input = limitBox('Most characters', 'size', { min: '1', step: '1', placeholder: 'Any' });
    return { element: word('Most characters', input), refresh: (page, node) => show(input, own(page.fields[node.field], 'size')) };
  }

  /** A paragraph's rows, and whether it grows as people type. */
  function rows(): Part {
    const count = select('Rows', Array.from({ length: 11 }, (_, i) => [String(i + 2), String(i + 2)]));
    count.addEventListener('change', () => designer.setWidgetOptions(id, { rows: count.value === '3' ? null : Number(count.value) }));
    const grows = toggle('Grows as people type', (on) => designer.setWidgetOptions(id, { autoGrow: on ? null : false }));
    return {
      element: row(word('Rows', count), grows.element),
      refresh(_page, node) {
        const n = node.options?.['rows'];
        count.value = String(typeof n === 'number' ? n : 3);
        grows.button.setAttribute('aria-checked', String(node.options?.['autoGrow'] !== false));
      },
    };
  }

  const parts: Part[] = [];
  if (kind === 'short-answer' || kind === 'paragraph') parts.push(most());
  if (kind === 'paragraph') parts.push(rows());
  if (!parts.length) return null;
  return { elements: parts.map((p) => p.element), refresh: (page, node) => parts.forEach((p) => p.refresh(page, node)) };
}
