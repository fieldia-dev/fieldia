import { validatePage, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/**
 * Proof of an email or a phone by a code (`options.verify`), as the designer sets it: Confirmed by a code in an email's
 * and a phone's own settings, and for a phone the ways the code is sent — WhatsApp, SMS — none ticked, the app's own.
 */

afterEach(() => document.body.replaceChildren());

function picked(kind: 'phone' | 'email') {
  const designer = createDesigner({ page: blankPage('screen', 'Enquiry') });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  designer.select(id);
  const { host } = mount(designer, { mode: 'simple' });
  const card = () => host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
  const toggle = (name: string) => card().querySelector(`[role="switch"][aria-label="${name}"]`) as HTMLButtonElement;
  const node = () => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  return { designer, toggle, node, card };
}

describe('a field confirmed by a code, in the designer', () => {
  it('asks a phone for a code, sent by the ways ticked', () => {
    const { designer, toggle, node, card } = picked('phone');
    expect(toggle('Confirmed by a code').getAttribute('aria-checked')).toBe('false');
    expect((toggle('WhatsApp').closest('.fd-inline-row') as HTMLElement).hidden).toBe(true);
    toggle('Confirmed by a code').click();
    expect(node().options?.['verify']).toBe(true);
    toggle('WhatsApp').click();
    toggle('SMS').click();
    expect(node().options?.['verify']).toEqual({ by: ['whatsapp', 'sms'] });
    toggle('WhatsApp').click();
    expect(node().options?.['verify']).toEqual({ by: ['sms'] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    toggle('Confirmed by a code').click();
    expect(node().options?.['verify']).toBeUndefined();
    expect(card().querySelector('[aria-label="SMS"]')).not.toBeNull();
  });

  it('asks an email for a code, with no ways to tick', () => {
    const { designer, toggle, node } = picked('email');
    toggle('Confirmed by a code').click();
    expect(node().options?.['verify']).toBe(true);
    expect(toggle('WhatsApp')).toBeNull();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});
