import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * The settings of the kinds that hold more than one value — a signature, an
 * address, a table of lines, links to records and rich text — in the picked
 * field itself, beside the rest of its kind's, and in the side panel the
 * same way: a signature's pen, its words and an upload; an address's parts
 * that must be filled and its country to start with; a table's least and
 * most lines, its button's words, the sentence it says when empty, its
 * totals and the columns people may hide; whether a link makes new records
 * and which records it offers; whether rich text has its toolbar.
 */

export interface StructurePart {
  element: HTMLElement;
  refresh(page: Page, node: FieldNode): void;
}

/** A signature's inks, by name: the first is the usual one, kept as nothing. */
export const PEN_COLOURS: [string, string][] = [
  ['#1b2a5c', 'Blue-black'],
  ['#111111', 'Black'],
  ['#1d4ed8', 'Blue'],
];

export function structureSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): StructurePart[] {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const row = (...parts: HTMLElement[]) => el('div', { class: 'fd-inline-row' }, ...parts);
  const select = (label: string, choices: [string, string][]) =>
    el('select', { class: 'fd-inline-select', 'aria-label': label }, ...choices.map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
  const textBox = (label: string, placeholder: string) => el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, placeholder, autocomplete: 'off' }) as HTMLInputElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A box shows what is saved, unless the cursor is in it. */
  const show = (input: HTMLInputElement | HTMLSelectElement, value: unknown) => {
    if (!focused(input)) input.value = value === undefined || value === null ? '' : String(value);
  };
  const widget = (patch: Record<string, string | number | boolean | null>) => designer.setWidgetOptions(id, patch);
  const option = (node: FieldNode, key: string) => node.options?.[key];

  /** A signature's pen — its ink and width — the words on the pad and under it, and whether a picture may be uploaded. */
  function signature(): StructurePart {
    const inks = PEN_COLOURS.map(([colour, name], i) => {
      const chip = el('button', { type: 'button', class: 'fd-inline-chip fd-pen-ink', 'aria-pressed': 'false', style: `--fd-ink: ${colour}` }, el('span', { class: 'fd-pen-dot', 'aria-hidden': 'true' }), name) as HTMLButtonElement;
      chip.addEventListener('click', () => widget({ color: i === 0 ? null : colour }));
      return { chip, colour };
    });
    const width = select('Pen width', [['2', 'Thin'], ['3', 'Medium'], ['5', 'Thick']]);
    width.addEventListener('change', () => widget({ penWidth: width.value === '3' ? null : Number(width.value) }));
    const pad = textBox('Words on the pad', 'Sign here');
    pad.addEventListener('input', () => designer.updateQuestion(id, { placeholder: pad.value }));
    const under = textBox('Words under it', 'I agree this is my signature');
    under.addEventListener('input', () => widget({ footerLabel: under.value }));
    const upload = toggle('People can upload a picture of it', (on) => widget({ upload: on || null }));
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        row(el('span', {}, 'Ink'), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': 'Ink' }, ...inks.map((i) => i.chip)), word('Pen width', width)),
        row(word('Words on the pad', pad), word('Words under it', under)),
        upload.element
      ),
      refresh(_page, node) {
        const colour = option(node, 'color') ?? PEN_COLOURS[0][0];
        for (const ink of inks) ink.chip.setAttribute('aria-pressed', String(ink.colour === colour));
        width.value = String(option(node, 'penWidth') ?? 3);
        show(pad, node.placeholder);
        show(under, option(node, 'footerLabel'));
        upload.button.setAttribute('aria-checked', String(option(node, 'upload') === true));
      },
    };
  }

  const parts: StructurePart[] = [];
  if (kind === 'signature') parts.push(signature());
  return parts;
}
