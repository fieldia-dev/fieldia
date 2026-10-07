import { mountKind } from './test-kinds';

/** How a record sheet reads: a choice drawn as a coloured badge, toned by its value, as Flectra's widget="badge". */

describe('a choice as a badge', () => {
  const risk = { type: 'selection', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] };

  it('shows the chosen option’s words in a pill toned by the value, and nothing when none is chosen', () => {
    const { el, form } = mountKind(risk, { widget: 'badge', options: { tones: { high: 'danger', medium: 'warning', low: 'success' } } });
    expect(el.classList.contains('fd-badge')).toBe(true);
    expect(el.hidden).toBe(true);
    form.setValue('x', 'high');
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('High');
    expect(el.className).toContain('fd-tone-danger');
    form.setValue('x', 'low');
    expect(el.className).toContain('fd-tone-success');
    expect(el.className).not.toContain('fd-tone-danger');
  });

  it('is muted for a value given no tone', () => {
    const { el, form } = mountKind(risk, { widget: 'badge' });
    form.setValue('x', 'medium');
    expect(el.className).toContain('fd-tone-muted');
  });
});
