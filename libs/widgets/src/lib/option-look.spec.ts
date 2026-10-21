import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * Options that say more than their words — a second line, an icon, a colour — in radios and checkboxes, in Fieldia's
 * own list (a choice with any is drawn there, never in the browser's list, which shows one line), in a long list that
 * searches; and a link's suggestions showing what its source gives of each record: its picture or colour, its first
 * line of details, its words at the row's end.
 */

const SERVICES = [
  { value: 'botox', label: 'Botox', caption: '30 min · EGP 4,500', icon: 'star' },
  { value: 'filler', label: 'Filler', caption: '45 min · EGP 6,000', color: '#d6145f' },
  { value: 'peel', label: 'Chemical peel' },
];

describe('options that say more than their words', () => {
  it('show their icon or colour and their second line in radios', () => {
    const { el } = mountKind({ type: 'selection', label: 'Service', options: SERVICES }, { widget: 'radio' });
    const choices = [...el.querySelectorAll('.fd-choice')];
    expect(choices[0].querySelector('.fd-option-icon svg')).not.toBeNull();
    expect(choices[0].querySelector('.fd-option-caption')?.textContent).toBe('30 min · EGP 4,500');
    expect((choices[1].querySelector('.fd-option-dot') as HTMLElement).style.getPropertyValue('--fd-option-color')).toBe('#d6145f');
    expect(choices[2].querySelector('.fd-option-caption, .fd-option-icon, .fd-option-dot')).toBeNull();
    // Named by its words, its second line describing it: read after its name, never part of it.
    const input = choices[0].querySelector('input') as HTMLInputElement;
    const caption = choices[0].querySelector('.fd-option-caption') as HTMLElement;
    expect(caption.getAttribute('aria-hidden')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(caption.id);
    expect(choices[2].querySelector('input')?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('are a dropdown drawn in Fieldia’s own list, its rows and its box showing them', () => {
    const { el, form } = mountKind({ type: 'selection', label: 'Service', options: SERVICES });
    expect(el.querySelector('select')).toBeNull();
    const button = el.querySelector('.fd-own-button') as HTMLButtonElement;
    button.click();
    const rows = [...el.querySelectorAll('[role=option]')];
    expect(rows.map((row) => row.querySelector('.fd-pick-words')?.firstChild?.textContent)).toEqual(['Botox', 'Filler', 'Chemical peel']);
    expect(rows[0].classList.contains('fd-pick-two')).toBe(true);
    expect(rows[0].getAttribute('aria-describedby')).toBe(rows[0].querySelector('.fd-option-caption')?.id);
    expect(rows[1].querySelector('.fd-option-dot')).not.toBeNull();
    (rows[1] as HTMLElement).click();
    expect(form.getState().values['x']).toBe('filler');
    // The box shows the colour of the option picked before its words.
    expect(el.querySelector('.fd-own-mark .fd-option-dot')).not.toBeNull();
    expect(el.querySelector('.fd-own-words')?.textContent).toBe('Filler');
  });

  it('keep the browser’s list for a choice whose options say nothing more', () => {
    const { el } = mountKind({ type: 'selection', label: 'Service', options: [{ value: 'a', label: 'A' }] });
    expect(el.matches('select')).toBe(true);
  });

  it('show their second line in a long list that searches', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ value: `s${i}`, label: `Service ${i}`, caption: `${10 + i} min` }));
    const { el } = mountKind({ type: 'selection', label: 'Service', options: many });
    const input = el.querySelector('input') as HTMLInputElement;
    input.focus();
    input.value = 'Service 1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const row = el.querySelector('[role=option]') as HTMLElement;
    expect(row.classList.contains('fd-option-rich')).toBe(true);
    expect(row.querySelector('.fd-option-caption')?.textContent).toBe('11 min');
    expect(row.getAttribute('aria-describedby')).toBe(row.querySelector('.fd-option-caption')?.id);
  });
});

describe('a link’s suggestions', () => {
  it('show each record’s picture or colour, its first line of details and its words at the end', async () => {
    const page = {
      fieldia: '0.1',
      id: 'booking',
      data: { kind: 'record', model: 'booking' },
      fields: { staff_id: { type: 'many2one', label: 'With', relation: 'staff' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'staff_id' }] },
    } as unknown as Page;
    const dataSource = createMemoryDataSource({
      records: { staff: { 1: { name: 'Dr Mona Adel', role: 'Dermatologist', tone: 9, free: 'Free today' }, 2: { name: 'Karim Fathy', photo: 'data:image/png;base64,iVBORw0KGgo=', role: 'Nurse' } } },
      shows: { staff: { details: ['role'], color: 'tone', aside: 'free', avatar: 'photo' } },
    });
    const form = createForm({ page, dataSource });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'staff_id', field: page.fields['staff_id'] as Field, node, id: 'fd-n', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    widget.update({ value: null, values: form.getState().values, readonly: false, required: false, invalid: false });
    const input = widget.element.querySelector('input') as HTMLInputElement;
    input.focus();
    input.value = 'a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rows = [...document.querySelectorAll('[role=option]')] as HTMLElement[];
    const mona = rows.find((row) => row.textContent?.includes('Mona')) as HTMLElement;
    expect(mona.querySelector('.fd-option-dot')?.getAttribute('data-color')).toBe('9');
    expect(mona.querySelector('.fd-option-caption')?.textContent).toBe('Dermatologist');
    expect(mona.querySelector('.fd-option-aside')?.textContent).toBe('Free today');
    // Named by the record's name alone, as it always was: its details and its words at the end describe it.
    const described = (mona.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['Dermatologist', 'Free today']);
    expect([...mona.querySelectorAll('.fd-option-caption, .fd-option-aside')].every((span) => span.getAttribute('aria-hidden') === 'true')).toBe(true);
    const karim = rows.find((row) => row.textContent?.includes('Karim')) as HTMLElement;
    expect(karim.querySelector('.fd-link-avatar img')).not.toBeNull();
  });
});
