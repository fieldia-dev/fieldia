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

describe('links with pictures, lines under them and colours', () => {
  const mona = { id: 5, label: 'Mona Adel', avatar: 'data:image/png;base64,AAAA', details: '12 Nile St\nCairo, Egypt' };

  it('shows the person’s picture in a link, or the initials of one with none', () => {
    const { el, form } = mountKind({ type: 'many2one', relation: 'res.users' }, { options: { avatar: true } });
    form.setValue('x', mona);
    expect((el.querySelector('.fd-link-avatar img') as HTMLImageElement).src).toBe(mona.avatar);
    form.setValue('x', { id: 6, label: 'Karim Fathy' });
    expect(el.querySelector('.fd-link-avatar img')).toBeNull();
    expect(el.querySelector('.fd-link-avatar')?.textContent).toBe('KF');
    form.setValue('x', null);
    expect((el.querySelector('.fd-link-avatar') as HTMLElement).hidden).toBe(true);
  });

  it('shows lines of the record under the link, as Flectra’s address under a customer', () => {
    const { el, form } = mountKind({ type: 'many2one', relation: 'res.partner' }, { options: { details: true } });
    form.setValue('x', mona);
    const lines = el.querySelector('.fd-link-details') as HTMLElement;
    expect([...lines.children].map((l) => l.textContent)).toEqual(['12 Nile St', 'Cairo, Egypt']);
    expect(lines.hidden).toBe(false);
    form.setValue('x', { id: 7, label: 'Nile Traders' });
    expect(lines.hidden).toBe(true);
  });

  it('has no button to open the record when told not to, as Flectra’s no_open', () => {
    const dialogs = { canOpen: () => true, openRecord: async () => null, searchMore: async () => null, editValues: async () => null };
    const shown = mountKind({ type: 'many2one', relation: 'res.partner' }, {}, { dialogs });
    shown.form.setValue('x', mona);
    expect(shown.el.querySelector('.fd-combo-open')).not.toBeNull();
    const none = mountKind({ type: 'many2one', relation: 'res.partner' }, { options: { open: false } }, { dialogs });
    none.form.setValue('x', mona);
    expect(none.el.querySelector('.fd-combo-open')).toBeNull();
    const tags = mountKind({ type: 'many2many', relation: 'tag' }, { options: { open: false } }, { dialogs });
    tags.form.setValue('x', [{ id: 1, label: 'VIP' }]);
    expect(tags.el.querySelector('button.fd-chip-label')).toBeNull();
  });

  it('colours each tag by its record’s colour, and shows pictures on tags', () => {
    const { el, form } = mountKind({ type: 'many2many', relation: 'tag' }, { options: { colors: true, avatar: true } });
    form.setValue('x', [{ id: 1, label: 'VIP', color: 4 }, { id: 2, label: 'Lead', color: 0 }, { id: 3, label: 'Mona Adel', avatar: mona.avatar }]);
    const chips = [...el.querySelectorAll('.fd-chip')] as HTMLElement[];
    expect(chips.map((c) => c.getAttribute('data-color'))).toEqual(['4', null, null]);
    expect(chips[2].querySelector('.fd-link-avatar img')).not.toBeNull();
    expect(chips[0].querySelector('.fd-link-avatar')?.textContent).toBe('V');
  });

  it('draws no colour unless asked: a colour is the page’s choice, as Flectra’s color_field', () => {
    const { el, form } = mountKind({ type: 'many2many', relation: 'tag' });
    form.setValue('x', [{ id: 1, label: 'VIP', color: 4 }]);
    expect(el.querySelector('.fd-chip')?.getAttribute('data-color')).toBeNull();
    expect(el.querySelector('.fd-link-avatar')).toBeNull();
  });
});
