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
