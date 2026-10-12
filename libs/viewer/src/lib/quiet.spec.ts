import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * The quiet look: which fields wear it — the page's skin, a section's word or
 * a field's own — the words an empty one shows, Escape putting back what a
 * field held as it was entered, and the lock of a field a rule keeps
 * read-only, with why.
 */

const bug = (look?: Page['look'], children?: unknown[]): Page =>
  ({
    fieldia: '0.1',
    id: 'bug',
    data: { kind: 'record', model: 'bug' },
    fields: {
      title: { type: 'char', label: 'Title' },
      points: { type: 'float', label: 'Story points' },
      vat: { type: 'char', label: 'VAT number' },
      state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }] },
      priority: { type: 'selection', label: 'Priority', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
      reason: { type: 'char', label: 'Reason' },
      blocked: { type: 'boolean', label: 'Blocked' },
      notes: { type: 'html', label: 'Notes' },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: children ?? [
        { type: 'field', id: 'f-title', field: 'title' },
        { type: 'field', id: 'f-points', field: 'points' },
        { type: 'field', id: 'f-vat', field: 'vat' },
        { type: 'field', id: 'f-state', field: 'state', widget: 'dot' },
        { type: 'field', id: 'f-priority', field: 'priority' },
        { type: 'field', id: 'f-reason', field: 'reason', readonly: "state == 'closed'", readonlyReason: 'Set when the bug is closed' },
        { type: 'field', id: 'f-blocked', field: 'blocked', widget: 'toggle' },
        { type: 'field', id: 'f-notes', field: 'notes' },
      ],
    },
    ...(look ? { look } : {}),
  }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  const field = (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
  return { host, form: handle.form, field, quiet: (id: string) => field(id).hasAttribute('data-quiet') };
}

const focusInto = (element: HTMLElement) => {
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: document.body }));
  element.focus();
};
const escape = (element: HTMLElement) => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};

describe('which fields wear the quiet look', () => {
  it('is the page’s skin: its fields that read as words wear it, a toggle keeps its own face', () => {
    const { host, quiet } = mount(bug({ skin: 'quiet' }));
    expect(host.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('quiet');
    for (const id of ['f-title', 'f-points', 'f-state', 'f-priority', 'f-reason', 'f-notes']) expect([id, quiet(id)]).toEqual([id, true]);
    expect(quiet('f-blocked')).toBe(false);
  });

  it('gives way to the app’s skin, as a theme does', () => {
    const { host, quiet } = mount(bug({ skin: 'quiet' }), { skin: 'outlined' });
    expect(host.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
    expect(quiet('f-title')).toBe(false);
  });

  it('can be a section’s, in a page of boxes, and a field inside can keep its box', () => {
    const { quiet } = mount(
      bug({ skin: 'outlined' }, [
        {
          type: 'section', id: 'head', quiet: true, labels: 'beside',
          children: [{ type: 'field', id: 'f-title', field: 'title' }, { type: 'field', id: 'f-vat', field: 'vat', quiet: false }, { type: 'section', id: 'inner', style: 'plain', children: [{ type: 'field', id: 'f-points', field: 'points' }] }],
        },
        { type: 'section', id: 'body', children: [{ type: 'field', id: 'f-reason', field: 'reason' }, { type: 'field', id: 'f-priority', field: 'priority', quiet: true }] },
      ])
    );
    expect([quiet('f-title'), quiet('f-vat'), quiet('f-points'), quiet('f-reason'), quiet('f-priority')]).toEqual([true, false, true, false, true]);
  });

  it('quietens every label in a quiet place, a field that keeps its own face and a line’s title too', () => {
    const { host, field } = mount(
      bug({ skin: 'outlined' }, [
        { type: 'section', id: 'head', quiet: true, children: [{ type: 'field', id: 'f-blocked', field: 'blocked', widget: 'toggle' }, { type: 'section', id: 'line', style: 'inline', title: 'Points', children: [{ type: 'field', id: 'f-points', field: 'points' }] }] },
        { type: 'field', id: 'f-title', field: 'title' },
      ])
    );
    expect(field('f-blocked').hasAttribute('data-in-quiet')).toBe(true);
    expect(field('f-blocked').hasAttribute('data-quiet')).toBe(false);
    expect(host.querySelector('[data-node="line"]')?.hasAttribute('data-in-quiet')).toBe(true);
    expect(field('f-title').hasAttribute('data-in-quiet')).toBe(false);
  });

  it('follows the skin as it changes, its words with it', () => {
    const { field, quiet } = mount(bug());
    const box = () => field('f-points').querySelector('input') as HTMLInputElement;
    expect(quiet('f-points')).toBe(false);
    expect(box().placeholder).toBe('');
    handle!.setSkin('quiet');
    expect(quiet('f-points')).toBe(true);
    expect(box().placeholder).toBe('Add story points');
    handle!.setSkin('underline');
    expect(quiet('f-points')).toBe(false);
    expect(box().placeholder).toBe('');
  });
});

describe('an empty quiet field', () => {
  it('says what to add, in the page’s words: a name stays as written, the page’s own words win', () => {
    const page = bug({ skin: 'quiet' });
    ((page.layout as { children: unknown[] }).children[0] as { placeholder?: string }).placeholder = 'Name the bug';
    const { field } = mount(page);
    expect((field('f-title').querySelector('input') as HTMLInputElement).placeholder).toBe('Name the bug');
    expect((field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('Add story points');
    expect((field('f-vat').querySelector('input') as HTMLInputElement).placeholder).toBe('Add VAT number');
    // A choice says it in its blank option, the one shown while nothing is picked; formatted text in its empty box.
    expect((field('f-priority').querySelector('select') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Add priority');
    expect(field('f-notes').querySelector('.fd-richtext')?.getAttribute('data-placeholder')).toBe('Add notes');
    expect(field('f-points').hasAttribute('data-empty')).toBe(true);
  });

  it('says it in German and in Arabic', () => {
    expect((mount(bug({ skin: 'quiet' }), { locale: 'de' }).field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('Story points hinzufügen');
    handle?.destroy();
    expect((mount(bug({ skin: 'quiet' }), { locale: 'ar' }).field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('أضف Story points');
  });

  it('asks a question’s answer in plain words, and says nothing in a field of several boxes', () => {
    const page = bug({ skin: 'quiet' }, [
      { type: 'field', id: 'f-q', field: 'title', label: 'Which rooms will you use?' },
      { type: 'field', id: 'f-where', field: 'where', widget: 'address' },
    ]);
    (page.fields as Record<string, unknown>)['where'] = { type: 'json', label: 'Where should we post it?' };
    const { field } = mount(page);
    expect((field('f-q').querySelector('input') as HTMLInputElement).placeholder).toBe('Your answer');
    expect([...field('f-where').querySelectorAll('input')].map((input) => input.placeholder).filter(Boolean)).toEqual([]);
  });

  it('keeps its label in the box where the label is out of sight', () => {
    const { field } = mount(bug({ skin: 'quiet', labels: 'hidden' }));
    expect((field('f-points').querySelector('input') as HTMLInputElement).placeholder).toBe('Story points');
  });

  it('is no longer empty once filled in', () => {
    const { field, form } = mount(bug({ skin: 'quiet' }));
    form.setValue('points', 3);
    expect(field('f-points').hasAttribute('data-empty')).toBe(false);
  });
});

describe('Escape in a quiet field', () => {
  it('puts back the value the field had as it was entered, and goes no further', () => {
    const { field, form } = mount(bug({ skin: 'quiet' }));
    form.setValue('title', 'Stock count wrong');
    const input = field('f-title').querySelector('input') as HTMLInputElement;
    focusInto(input);
    input.value = 'Stock count wrong after a release';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['title']).toBe('Stock count wrong after a release');
    let reached = false;
    document.body.addEventListener('keydown', () => (reached = true), { once: true });
    const event = escape(input);
    expect(event.defaultPrevented).toBe(true);
    expect(reached).toBe(false);
    expect(form.getState().values['title']).toBe('Stock count wrong');
    expect(input.value).toBe('Stock count wrong');
  });

  it('is left alone when nothing changed, for a dialog round the form to close', () => {
    const { field } = mount(bug({ skin: 'quiet' }));
    const input = field('f-title').querySelector('input') as HTMLInputElement;
    focusInto(input);
    expect(escape(input).defaultPrevented).toBe(false);
  });

  it('puts back a choice too, and only in the quiet look', () => {
    const quietly = mount(bug({ skin: 'quiet' }));
    const select = quietly.field('f-priority').querySelector('select') as HTMLSelectElement;
    focusInto(select);
    quietly.form.setValue('priority', '2');
    escape(select);
    expect(quietly.form.getState().values['priority'] ?? null).toBeNull();
    handle?.destroy();
    const boxed = mount(bug({ skin: 'outlined' }));
    const input = boxed.field('f-title').querySelector('input') as HTMLInputElement;
    focusInto(input);
    boxed.form.setValue('title', 'Typed');
    expect(escape(input).defaultPrevented).toBe(false);
    expect(boxed.form.getState().values['title']).toBe('Typed');
  });
});

describe('a field a rule keeps read-only', () => {
  const lockOf = (field: HTMLElement) => field.querySelector('.fd-lock-wrap') as HTMLElement;

  it('shows a lock by its label that says why, pointed at or focused, and its box is described by the reason', () => {
    const { field, form } = mount(bug({ skin: 'quiet' }));
    const reason = field('f-reason');
    // None until a rule first locks the field.
    expect(lockOf(reason)).toBeNull();
    form.setValue('state', 'closed');
    expect(lockOf(reason).hidden).toBe(false);
    expect(reason.hasAttribute('data-locked')).toBe(true);
    const button = lockOf(reason).querySelector('button.fd-lock') as HTMLButtonElement;
    const bubble = lockOf(reason).querySelector('[role="tooltip"]') as HTMLElement;
    expect(button.getAttribute('aria-label')).toBe('Locked: Reason');
    expect(button.getAttribute('aria-describedby')).toBe(bubble.id);
    expect(bubble.textContent).toBe('Set when the bug is closed');
    expect(lockOf(reason).closest('.fd-label')).not.toBeNull();
    const input = reason.querySelector('input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(bubble.id);
    button.focus();
    expect(bubble.hidden).toBe(false);
    button.blur();
    expect(bubble.hidden).toBe(true);
    // Pointing at the value says it too.
    input.dispatchEvent(new MouseEvent('mouseenter'));
    expect(bubble.hidden).toBe(false);
    input.dispatchEvent(new MouseEvent('mouseleave'));
    expect(bubble.hidden).toBe(true);
    // A press on the lock does not move into the box.
    button.click();
    expect(document.activeElement).not.toBe(input);
    // Unlocked again, the lock goes, and the box is no longer described by why.
    form.setValue('state', 'active');
    expect(lockOf(reason).hidden).toBe(true);
    expect(input.getAttribute('aria-describedby')?.split(' ') ?? []).not.toContain(bubble.id);
  });

  it('shows a lock without words where the page gives no reason, in the quiet look only', () => {
    const page = bug({ skin: 'quiet' });
    const node = (page.layout as { children: unknown[] }).children[5] as { readonlyReason?: string };
    delete node.readonlyReason;
    const quietly = mount(page);
    quietly.form.setValue('state', 'closed');
    const lock = lockOf(quietly.field('f-reason'));
    expect(lock.hidden).toBe(false);
    expect(lock.querySelector('button')).toBeNull();
    expect(lock.querySelector('[aria-hidden="true"]')).not.toBeNull();
    handle?.destroy();
    const boxed = mount({ ...page, look: { skin: 'outlined' } });
    boxed.form.setValue('state', 'closed');
    expect(lockOf(boxed.field('f-reason'))?.hidden ?? true).toBe(true);
  });

  it('has no lock when it is read-only by its nature — worked out, or always read-only — unless the page says why', () => {
    const page = bug({ skin: 'quiet' }, [
      { type: 'field', id: 'f-total', field: 'points', readonly: true },
      { type: 'field', id: 'f-why', field: 'title', readonly: true, readonlyReason: 'Named by the reporter' },
    ]);
    const { field } = mount(page);
    expect(lockOf(field('f-total'))).toBeNull();
    expect(field('f-total').hasAttribute('data-locked')).toBe(false);
    expect(lockOf(field('f-why')).hidden).toBe(false);
    expect(field('f-why').hasAttribute('data-locked')).toBe(true);
  });

  it('keeps its reason in any skin', () => {
    const { field, form } = mount(bug({ skin: 'outlined' }));
    form.setValue('state', 'closed');
    expect(lockOf(field('f-reason')).hidden).toBe(false);
    expect(field('f-reason').hasAttribute('data-locked')).toBe(false);
  });

  it('takes its section’s reason when it gives none', () => {
    const { field } = mount(
      bug({ skin: 'quiet' }, [{ type: 'section', id: 's', readonly: true, readonlyReason: 'Planned by the team lead', children: [{ type: 'field', id: 'f-points', field: 'points' }] }])
    );
    expect(lockOf(field('f-points')).hidden).toBe(false);
    expect(lockOf(field('f-points')).textContent).toContain('Planned by the team lead');
  });

  it('shows no lock while the whole form is read, nor after Edit', () => {
    const { field } = mount(bug({ skin: 'quiet' }), { readonly: true });
    expect(lockOf(field('f-reason'))).toBeNull();
    expect(field('f-title').hasAttribute('data-locked')).toBe(false);
    handle!.setReadonly(false);
    expect(lockOf(field('f-reason'))).toBeNull();
  });
});

describe('a state’s dot in the quiet look', () => {
  it('keeps its words beside it, the value it reads, and ticks the one picked in its menu', () => {
    const { field, form } = mount(bug({ skin: 'quiet' }));
    form.setValue('state', 'active');
    const words = field('f-state').querySelector('.fd-dot-label') as HTMLElement;
    expect(words.textContent).toBe('Active');
    expect(field('f-state').querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toBe('Active');
  });
});
