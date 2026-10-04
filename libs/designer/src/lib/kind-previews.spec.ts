import { blankPage, createDesigner, type Designer } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** The newer kinds' closed cards, as people will see them: a signature line, an address's lines, tags, a card to repeat, or the real answer box. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function closed(kind: string, before?: (designer: Designer, id: string) => void) {
  const designer = createDesigner({ page: blankPage('survey', 'Move') });
  const id = designer.addQuestion(kind) as string;
  before?.(designer, id);
  designer.select(null);
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountSurveyEditor(host, { designer });
  const answer = host.querySelector(`.fd-q[data-node="${id}"] .fd-q-answer`) as HTMLElement;
  return { answer, designer, id };
}
const texts = (scope: Element, selector: string) => [...scope.querySelectorAll(selector)].map((n) => n.textContent);

describe('closed cards of the newer kinds', () => {
  it('shows a signature as a line to sign on', () => {
    const { answer } = closed('signature');
    expect(answer.hasAttribute('inert')).toBe(true);
    expect(answer.querySelector('.fd-q-preview-signature')?.textContent).toBe('Sign here');
  });

  it('shows an address as a line for each part it asks for', () => {
    expect(texts(closed('address').answer, '.fd-q-preview-part')).toEqual(['Street address', 'City', 'Postcode', 'Country']);
    const some = closed('address', (designer, id) => designer.setAddressParts(id, ['city', 'country']));
    expect(texts(some.answer, '.fd-q-preview-part')).toEqual(['City', 'Country']);
  });

  it('shows tags as the options to pick from', () => {
    const { answer } = closed('tags', (designer, id) => designer.setOptions(id, ['Kitchen', 'Gym']));
    expect(texts(answer, '.fd-q-preview-tag')).toEqual(['Kitchen', 'Gym']);
  });

  it('shows a repeating group as its first card and the button that adds another, in the page’s words', () => {
    const plain = closed('repeating');
    expect(plain.answer.querySelector('.fd-q-preview-card-title')?.textContent).toBe('Entry 1');
    expect(texts(plain.answer, '.fd-q-preview-card .fd-q-preview-part')).toEqual(['Name']);
    expect(plain.answer.querySelector('.fd-q-preview-add')?.textContent).toBe('+ Add another');
    const named = closed('repeating', (designer, id) => designer.setWidgetOptions(id, { itemLabel: 'Person', addLabel: 'Add a person' }));
    expect(named.answer.querySelector('.fd-q-preview-card-title')?.textContent).toBe('Person 1');
    expect(named.answer.querySelector('.fd-q-preview-add')?.textContent).toBe('+ Add a person');
  });

  it.each([
    ['slider', '.fd-slider'],
    ['image-choice', '.fd-image-choices'],
    ['ranking', '.fd-ranking'],
    ['matrix', '.fd-matrix'],
    ['tick', '.fd-tick'],
  ])('shows a %s as its real answer box, not to be used here', (kind, selector) => {
    const { answer } = closed(kind);
    expect(answer.querySelector('.fd-q-preview')).toBeNull();
    expect(answer.querySelector(selector)).not.toBeNull();
  });
});
