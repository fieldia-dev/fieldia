import type { Field, FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { choose, mount, type } from './test-editor';

/**
 * A field's own settings — a rating's levels, a slider's range, the kinds of
 * file it takes — are in the side panel as well as on its card, the same
 * controls on both, each showing what the other set. Settings the panel had
 * of its own for a kind (a link's records, an amount's currency, a table's
 * columns) are now these, so none shows twice.
 */

const nodes = (designer: ReturnType<typeof createDesigner>) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]);
const fieldOf = (designer: ReturnType<typeof createDesigner>, id: string) => designer.getPage().fields[nodes(designer).find((n) => n.id === id)?.field as string];
const panel = (host: Element) => host.querySelector('.fd-properties') as HTMLElement;
const inPanel = (host: Element, name: string) => [...panel(host).querySelectorAll<HTMLInputElement & HTMLSelectElement>(`[aria-label="${name}"]`)];
const onCard = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as (HTMLInputElement & HTMLSelectElement) | null;

function picked(kind: string, model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer, { mode: 'simple' });
  designer.select(id);
  return { designer, id, host };
}

describe('a field’s own settings in the side panel', () => {
  it('a rating’s levels: set in the panel, shown on its card too, and the other way round', () => {
    const { designer, id, host } = picked('rating');
    const [levels] = inPanel(host, 'Levels');
    expect(levels?.value).toBe('5');
    choose(levels, '7');
    expect(fieldOf(designer, id)).toMatchObject({ min: 1, max: 7 });
    expect(onCard(host, 'Levels')?.value).toBe('7');
    choose(onCard(host, 'Levels') ?? undefined, '4');
    expect(inPanel(host, 'Levels')[0].value).toBe('4');
    // Headed by the kind it belongs to.
    expect(panel(host).querySelector('[data-setting="Settings for its kind"] .fd-prop-name')?.textContent).toBe('Rating');
  });

  it('a file’s kinds and largest size, and a slider’s range', () => {
    const file = picked('file');
    expect(inPanel(file.host, 'Kinds of file')).toHaveLength(1);
    expect(inPanel(file.host, 'Largest file')).toHaveLength(1);
    const slider = picked('slider');
    const to = inPanel(slider.host, 'To')[0];
    type(to, '20');
    // A range is saved once a number is typed and left.
    to.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOf(slider.designer, slider.id)).toMatchObject({ max: 20 });
  });

  it('a link’s records, an amount’s currency and a table’s columns once each, not twice', () => {
    const link = picked('link');
    expect(inPanel(link.host, 'Links to')).toHaveLength(1);
    type(inPanel(link.host, 'Links to')[0], 'company');
    expect(fieldOf(link.designer, link.id)).toMatchObject({ relation: 'company' });
    const amount = picked('amount');
    expect(inPanel(amount.host, 'Currency')).toHaveLength(1);
    const lines = picked('lines');
    expect([...panel(lines.host).querySelectorAll('button')].filter((b) => b.textContent === 'Add column')).toHaveLength(1);
  });

  it('a short answer has none, and a field from the model keeps its own', () => {
    const text = picked('short-answer');
    expect((panel(text.host).querySelector('[data-setting="Settings for its kind"]') as HTMLElement | null)?.hidden ?? true).toBe(true);
    const model: Record<string, Field> = { score: { type: 'integer', label: 'Score', min: 1, max: 5 } };
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
    const id = designer.addModelField('score', { parent: 'section-1' }) as string;
    const { host } = mount(designer, { mode: 'simple' });
    designer.select(id);
    expect(inPanel(host, 'Levels')).toHaveLength(0);
  });
});
