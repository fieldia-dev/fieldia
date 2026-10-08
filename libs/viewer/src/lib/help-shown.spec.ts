import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** A field's help under it, behind a (?) beside its label, or both: the page's way, and a field's own. */

const contact = (look?: Page['look'], helpShown?: 'below' | 'tooltip' | 'both'): Page => ({
  fieldia: '0.1',
  id: 'contact',
  data: { kind: 'record', model: 'res.partner' },
  fields: { vat: { type: 'char', label: 'Tax ID', help: 'The number on the tax card, 9 digits.', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-vat', field: 'vat', ...(helpShown ? { helpShown } : {}) }] },
  ...(look ? { look } : {}),
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page, locale?: string) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...(locale ? { locale: locale as 'ar' } : {}) });
  const field = host.querySelector('[data-node="f-vat"]') as HTMLElement;
  return {
    field,
    under: () => field.querySelector('.fd-help'),
    tip: () => field.querySelector('.fd-label .fd-help-tip') as HTMLButtonElement | null,
    bubble: () => field.querySelector('[role="tooltip"]') as HTMLElement | null,
    input: () => field.querySelector('input') as HTMLInputElement,
  };
}

describe('where a field’s help shows', () => {
  it('shows it under the field unless told, as before', () => {
    const { under, tip } = mount(contact());
    expect(under()?.textContent).toBe('The number on the tax card, 9 digits.');
    expect(tip()).toBeNull();
  });

  it('keeps it behind a (?) by the label when the page says tooltip: named, described, shown on hover, focus or a press, gone with Escape', () => {
    const { under, tip, bubble, input } = mount(contact({ helpShown: 'tooltip' }));
    expect(under()).toBeNull();
    expect(tip()?.getAttribute('aria-label')).toBe('Help for Tax ID');
    expect(bubble()?.textContent).toBe('The number on the tax card, 9 digits.');
    expect(bubble()?.hidden).toBe(true);
    // The box is still described by its help, for a screen reader.
    expect(input().getAttribute('aria-describedby')?.split(' ')).toContain(bubble()?.id);
    tip()!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(bubble()?.hidden).toBe(false);
    tip()!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(bubble()?.hidden).toBe(true);
    tip()!.focus();
    expect(bubble()?.hidden).toBe(false);
    tip()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bubble()?.hidden).toBe(true);
    // A press — a tap on a phone — keeps it open, and another closes it.
    tip()!.click();
    expect(bubble()?.hidden).toBe(false);
    expect(tip()?.getAttribute('aria-expanded')).toBe('true');
    tip()!.click();
    expect(bubble()?.hidden).toBe(true);
    // Pressing the (?) does not move into the box, as pressing its label would.
    expect(document.activeElement).not.toBe(input());
  });

  it('only toggles the help when the (?) of a picker is pressed: its list stays shut and the box keeps no focus', () => {
    const page: Page = {
      ...contact({ helpShown: 'tooltip' }),
      fields: { vat: { type: 'many2one', label: 'Incoterm', relation: 'incoterm', help: 'The trade terms of the delivery.' } },
    };
    const { tip, bubble, field } = mount(page);
    const input = field.querySelector('input') as HTMLInputElement;
    tip()!.click();
    expect(bubble()?.hidden).toBe(false);
    expect(document.activeElement).not.toBe(input);
    // A press on the bubble's words does not reach the box either.
    bubble()!.click();
    expect(document.activeElement).not.toBe(input);
    // The label's own words still move into the box.
    (field.querySelector('.fd-label') as HTMLElement).click();
    expect(document.activeElement).toBe(input);
  });

  it('keeps an open bubble on the screen: moved back in from whichever edge it ran past', () => {
    const { tip, bubble } = mount(contact({ helpShown: 'tooltip' }));
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 });
    const at = (left: number, width: number) => ({ left, right: left + width, width, top: 0, bottom: 20, height: 20, x: left, y: 0, toJSON: () => ({}) });
    // Past the right edge: pulled left by what runs over, and a margin.
    bubble()!.getBoundingClientRect = () => at(164, 273) as DOMRect;
    tip()!.click();
    expect(bubble()!.style.transform).toBe('translateX(-55px)');
    tip()!.click();
    // Past the left edge, as in a right-to-left page: pushed right.
    bubble()!.getBoundingClientRect = () => at(-30, 273) as DOMRect;
    tip()!.click();
    expect(bubble()!.style.transform).toBe('translateX(38px)');
    tip()!.click();
    // On the screen already: left where it is.
    bubble()!.getBoundingClientRect = () => at(40, 273) as DOMRect;
    tip()!.click();
    expect(bubble()!.style.transform).toBe('');
    delete (document.documentElement as unknown as Record<string, unknown>)['clientWidth'];
  });

  it('keeps a label’s (?) and a lone mark at its end on the line of its last word', () => {
    const { field } = mount(contact({ helpShown: 'tooltip' }));
    const label = field.querySelector('.fd-label') as HTMLElement;
    // A word joiner between the words and the (?): no line may break there.
    const wrap = label.querySelector('.fd-help-tip-wrap') as HTMLElement;
    expect(wrap.previousSibling?.textContent).toBe('\u2060');
    // The words are still the label's first part, as an error list reads them.
    expect(label.firstChild?.textContent).toBe('Tax ID');
    const percent = mount({ ...contact(), fields: { vat: { type: 'float', label: 'Milestone Completion %' } } });
    expect(percent.field.querySelector('.fd-label')?.textContent).toBe('Milestone Completion\u00a0%');
    const question = mount({ ...contact(), fields: { vat: { type: 'char', label: 'Would you come again ?' } } });
    expect(question.field.querySelector('.fd-label')?.textContent).toBe('Would you come again\u00a0?');
    // A word at the end is left as written.
    const words = mount({ ...contact(), fields: { vat: { type: 'char', label: 'Tax ID' } } });
    expect(words.field.querySelector('.fd-label')?.textContent).toBe('Tax ID');
  });

  it('lets a field have its own way over the page’s, both included', () => {
    const { under, tip } = mount(contact({ helpShown: 'tooltip' }, 'both'));
    expect(under()?.textContent).toBe('The number on the tax card, 9 digits.');
    expect(tip()).not.toBeNull();
    const below = mount(contact({ helpShown: 'tooltip' }, 'below'));
    expect(below.tip()).toBeNull();
  });

  it('names the (?) in the page’s language', () => {
    const { tip } = mount(contact({ helpShown: 'tooltip' }), 'ar');
    expect(tip()?.getAttribute('aria-label')).toBe('مساعدة حول Tax ID');
  });
});
