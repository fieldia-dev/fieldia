import { keepUnchanged } from './keep-unchanged';

/** What an edit left alone keeps its identity, so a view can skip it by comparing objects. */

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('keepUnchanged', () => {
  const before = {
    title: 'Visit',
    fields: { a: { type: 'char', label: 'A' }, b: { type: 'char', label: 'B', help: 'Help' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's1', children: [{ type: 'field', id: 'f-a', field: 'a' }, { type: 'field', id: 'f-b', field: 'b' }] }] },
  };

  it('gives back the page before when nothing changed', () => {
    expect(keepUnchanged(before, copy(before))).toBe(before);
  });

  it('keeps every part an edit left alone, and takes the new parts and the path to them', () => {
    const next = copy(before);
    next.fields.b.label = 'Bee';
    const kept = keepUnchanged(before, next);
    expect(kept).toEqual(next);
    expect(kept).not.toBe(before);
    expect(kept.fields).not.toBe(before.fields);
    expect(kept.fields.b).not.toBe(before.fields.b);
    expect(kept.fields.a).toBe(before.fields.a);
    expect(kept.layout).toBe(before.layout);
    expect(kept.title).toBe('Visit');
  });

  it('matches parts by id, so a part put in before others leaves them as they were', () => {
    const next = copy(before);
    next.layout.children[0].children.unshift({ type: 'field', id: 'f-c', field: 'c' });
    const kept = keepUnchanged(before, next);
    expect(kept).toEqual(next);
    const [added, a, b] = kept.layout.children[0].children;
    expect(added).toEqual({ type: 'field', id: 'f-c', field: 'c' });
    expect(a).toBe(before.layout.children[0].children[0]);
    expect(b).toBe(before.layout.children[0].children[1]);
    expect(kept.layout.children[0].children).not.toBe(before.layout.children[0].children);
  });

  it('keeps the new order of parts moved, and of keys written in another order', () => {
    const moved = copy(before);
    moved.layout.children[0].children.reverse();
    const kept = keepUnchanged(before, moved);
    expect(kept.layout.children[0].children.map((n) => n.id)).toEqual(['f-b', 'f-a']);
    expect(kept.layout.children[0].children[0]).toBe(before.layout.children[0].children[1]);
    const reordered = { ...copy(before), fields: { b: copy(before.fields.b), a: copy(before.fields.a) } };
    const keys = keepUnchanged(before, reordered);
    expect(Object.keys(keys.fields)).toEqual(['b', 'a']);
    expect(keys.fields.a).toBe(before.fields.a);
  });

  it('takes a key taken away, and one added', () => {
    const next = copy(before) as typeof before & { description?: string };
    delete (next.fields.b as { help?: string }).help;
    next.description = 'New';
    const kept = keepUnchanged(before, next);
    expect(kept).toEqual(next);
    expect(kept.fields.b).not.toHaveProperty('help');
    expect(kept.fields.a).toBe(before.fields.a);
  });

  it('matches by place a list without ids, and takes what changed kind', () => {
    const a = { options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }], value: 1 as unknown };
    const b = { options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Why' }], value: [1] as unknown };
    const kept = keepUnchanged(a, b);
    expect(kept).toEqual(b);
    expect(kept.options[0]).toBe(a.options[0]);
    expect(kept.options[1]).not.toBe(a.options[1]);
    expect(kept.value).toBe(b.value);
  });
});
