import { produce, sameJson } from './draft';

/**
 * An edit made on a draft that copies only what it writes (`produce`), held to the same edit made on a whole copy of
 * the page (as the designer made every edit before 0.35): on trees made at random and edits made at random — keys set,
 * taken away, parts put in, moved, copied, lists spliced, pushed, sorted, reversed — the page made is the same, the page
 * it was made from is left as it was, and what the edit did not touch is the page's own, the same objects.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Part = Json[] | { [key: string]: Json };

const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
type Random = () => number;
const pick = <T>(r: Random, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const isPart = (value: unknown): value is Part => typeof value === 'object' && value !== null;

function tree(r: Random, depth: number): Json {
  const roll = r();
  if (depth <= 0 || roll < 0.25) return pick(r, [null, true, false, 0, 7, 3.5, 'a', 'label', '']);
  if (roll < 0.6) return Array.from({ length: Math.floor(r() * 4) }, () => tree(r, depth - 1));
  const out: { [key: string]: Json } = {};
  for (let i = 0, n = 1 + Math.floor(r() * 4); i < n; i++) out[pick(r, ['id', 'label', 'children', 'fields', 'x', 'y', 'options', 'when'])] = tree(r, depth - 1);
  return out;
}

/** Every part of a tree, with the path to it: what an edit picks its places among. */
function parts(root: Json, path: (string | number)[] = []): { path: (string | number)[]; part: Part }[] {
  if (!isPart(root)) return [];
  const own = [{ path, part: root }];
  const inner = Array.isArray(root) ? root.flatMap((value, i) => parts(value, [...path, i])) : Object.entries(root).flatMap(([key, value]) => parts(value, [...path, key]));
  return [...own, ...inner];
}
const at = (root: Json, path: readonly (string | number)[]): Json => path.reduce<Json>((part, key) => (isPart(part) ? (part as Record<string | number, Json>)[key] : null), root);

/** An edit, as a list of steps by path: the same steps made on a whole copy and on a draft. */
type Step = (root: Json) => void;
function edits(r: Random, base: Json, count: number): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < count; i++) {
    const kind = Math.floor(r() * 11);
    const where = pick(r, parts(base)).path;
    const other = pick(r, parts(base)).path;
    const value = tree(r, 2);
    const key = pick(r, ['id', 'label', 'children', 'z']);
    const n = Math.floor(r() * 3);
    steps.push((root) => {
      const part = at(root, where);
      if (!isPart(part)) return;
      const there = at(root, other);
      if (Array.isArray(part)) {
        const list = part as Json[];
        if (kind === 0) list.push(JSON.parse(JSON.stringify(value)));
        else if (kind === 1) list.splice(Math.min(n, list.length), 1);
        else if (kind === 2) list.splice(Math.min(n, list.length), 0, JSON.parse(JSON.stringify(value)));
        else if (kind === 3) list.reverse();
        else if (kind === 4) list.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        else if (kind === 5 && list.length) {
          // A part moved within its list, as a drag moves a field among its section's.
          const [moved] = list.splice(0, 1);
          list.splice(Math.min(n, list.length), 0, moved);
        } else if (kind === 6 && isPart(there) && !Array.isArray(there) && !parts(there).some((p) => p.part === part)) list.push(there);
        else if (kind === 7 && list.length && isPart(list[0])) {
          const first = list[0] as { [key: string]: Json };
          if (!Array.isArray(first)) first[key] = 'set';
        } else if (kind === 8) list.unshift(n);
        else if (kind === 9 && list.length) list.pop();
        else list.length = Math.min(list.length, n);
      } else {
        const object = part as { [key: string]: Json };
        if (kind <= 2) object[key] = JSON.parse(JSON.stringify(value));
        else if (kind === 3) delete object[key];
        else if (kind === 4 && isPart(there) && !parts(there).some((p) => p.part === part)) {
          // Copied: a spread of another part, a key changed.
          object[key] = { ...(there as { [key: string]: Json }), copied: true } as Json;
        } else if (kind === 5) Object.assign(object, { label: 'assigned', [key]: n });
        else if (kind === 6 && isPart(there) && !parts(there).some((p) => p.part === part)) object[key] = there;
        else if (kind === 7 && isPart(object[key])) {
          const inner = object[key] as Part;
          if (Array.isArray(inner)) inner.push('pushed');
          else (inner as { [key: string]: Json })['deep'] = n;
        } else if (kind === 8) {
          for (const name of Object.keys(object)) if (typeof object[name] === 'number') object[name] = (object[name] as number) + 1;
        } else if (kind === 9) object['read'] = Object.values(object).filter((v) => typeof v === 'string').length;
        else if (kind === 10 && key in object) delete object[key];
      }
    });
  }
  return steps;
}

describe('an edit made on a draft that copies only what it writes', () => {
  for (let seed = 1; seed <= 400; seed++) {
    it(`makes the page a whole copy would, on random tree ${seed}`, () => {
      const r = seeded(seed);
      const base = { page: tree(r, 4), layout: tree(r, 3), fields: tree(r, 3) } as Json;
      const was = JSON.stringify(base);
      const steps = edits(r, base, 1 + Math.floor(r() * 5));
      const copy = JSON.parse(was) as Json;
      for (const step of steps) step(copy);
      const made = produce(base as object, (draft) => {
        for (const step of steps) step(draft as Json);
      });
      expect(JSON.stringify(made)).toBe(JSON.stringify(copy));
      // The page it was made from, untouched.
      expect(JSON.stringify(base)).toBe(was);
      expect(sameJson(made, copy)).toBe(true);
      expect(sameJson(made, base)).toBe(JSON.stringify(copy) === was);
    });
  }

  it('gives the page itself back where nothing was written, and reads alone write nothing', () => {
    const base = { fields: { a: { label: 'A' } }, layout: { children: [{ id: 'n1' }, { id: 'n2' }] } };
    expect(produce(base, () => undefined)).toBe(base);
    const read = (draft: typeof base) => {
      JSON.stringify(draft);
      Object.keys(draft.fields);
      draft.layout.children.find((c) => c.id === 'n2');
    };
    expect(produce(base, read)).toBe(base);
  });

  it('copies the objects on the way to what it writes, and keeps every other the page’s own', () => {
    const fields = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`f${i}`, { type: 'char', label: `Field ${i}` }]));
    const base = { fields, layout: { type: 'sections', children: [{ id: 's', children: [{ id: 'n' }] }] }, look: { theme: {} } };
    const made = produce(base, (draft) => void (draft.fields['f7'].label = 'Seven'));
    expect(made.fields['f7']).toEqual({ type: 'char', label: 'Seven' });
    expect(base.fields['f7'].label).toBe('Field 7');
    // The field, the fields' table and the page: new. Every other field, the layout and the look: the page's own.
    expect([made === base, made.fields === base.fields, made.fields['f7'] === base.fields['f7']]).toEqual([false, false, false]);
    expect(Object.keys(made.fields).filter((name) => made.fields[name] !== base.fields[name])).toEqual(['f7']);
    expect(made.layout).toBe(base.layout);
    expect(made.look).toBe(base.look);
    // In the same order of keys.
    expect(Object.keys(made.fields)).toEqual(Object.keys(base.fields));
  });

  it('moves a part as it is when moved, its writes after the move going where it went', () => {
    const base = { a: { children: [{ id: 'x', label: 'X' }, { id: 'y' }] }, b: { children: [] as { id: string; label?: string }[] } };
    const made = produce(base, (draft) => {
      const [moved] = draft.a.children.splice(0, 1);
      draft.b.children.push(moved);
      moved.label = 'moved';
    });
    expect(made).toEqual({ a: { children: [{ id: 'y' }] }, b: { children: [{ id: 'x', label: 'moved' }] } });
    expect(base.a.children[0]).toEqual({ id: 'x', label: 'X' });
    expect(made.a.children[0]).toBe(base.a.children[1]);
  });
});

describe('two pages compared as their JSON would be', () => {
  it('as JSON.stringify says, by the parts they share when they share them', () => {
    const r = seeded(9);
    for (let i = 0; i < 300; i++) {
      const a = tree(r, 4);
      const b = r() < 0.5 ? (JSON.parse(JSON.stringify(a)) as Json) : tree(r, 4);
      expect(sameJson(a, b)).toBe(JSON.stringify(a) === JSON.stringify(b));
    }
    expect(sameJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
