import { validatePage, type LayoutNode, type Page } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { QUESTION_KINDS, SCREEN_KINDS } from './kinds';
import { pageSchemaPart } from './schema-part';

/**
 * The format's schemas and `validatePage`, with zod, come in a file of their own (`@fieldia/core/schema`), fetched as
 * the designer opens (0.35): it draws and takes edits before they have come, each held to the quick check every viewer
 * draws a page with, and checks the page whole once they have — the next edit, its checks, and always before it is
 * published. This file starts without them (a `*-lazy.spec.ts`: test-parts.ts leaves them out).
 *
 * The oracle: on generated edits — every kind of question added, labels, help, required, options, moves, copies,
 * removals, groups, conditions and rules, columns, kinds changed, the title — a designer that took them before the
 * schemas came keeps or refuses each exactly as one that had them from the start, keeps the same page, and every page
 * it kept passes `validatePage`.
 */

/** A small seeded generator (mulberry32): the same edits on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every node of a layout, and the field nodes among them. */
function nodesOf(page: Page): { all: LayoutNode[]; fields: (LayoutNode & { type: 'field'; field: string })[]; sections: LayoutNode[] } {
  const all: LayoutNode[] = [];
  const visit = (nodes: readonly LayoutNode[] | undefined) => {
    for (const node of nodes ?? []) {
      all.push(node);
      visit((node as { children?: LayoutNode[] }).children);
    }
  };
  visit((page.layout as { children?: LayoutNode[] }).children);
  return { all, fields: all.filter((node): node is LayoutNode & { type: 'field'; field: string } => node.type === 'field'), sections: all.filter((node) => node.type === 'section') };
}

const KINDS = [...QUESTION_KINDS, ...SCREEN_KINDS].map((kind) => kind.id);
const WORDS = ['Name', 'Visit date', 'Notes', 'Rooms', 'Floor area', '', '  ', 'Ünïcode — “quoted”', 'A very long label that goes on and on past where a box would end it'];

/** One generated edit: what it did, and whether the designer kept it. */
function edit(designer: Designer, random: () => number): string {
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)];
  const page = designer.getPage();
  const { all, fields, sections } = nodesOf(page);
  const node = pick(all);
  const field = pick(fields);
  const words = pick(WORDS) as string;
  switch (Math.floor(random() * 13)) {
    case 0:
    case 1: {
      const kind = pick(KINDS) as string;
      return `add ${kind} ${designer.addQuestion(kind, node && random() < 0.5 ? { after: node.id } : undefined) !== false}`;
    }
    case 2:
      return field ? `label ${field.id} ${designer.updateQuestion(field.id, { label: words, required: random() < 0.3, help: random() < 0.3 ? words : undefined })}` : 'none';
    case 3:
      return field ? `options ${field.id} ${designer.setOptions(field.id, [words || 'One', 'Two', random() < 0.5 ? 'Two' : 'Three'])}` : 'none';
    case 4:
      return node ? `move ${node.id} ${designer.moveNode(node.id, random() < 0.5 ? -1 : 1)}` : 'none';
    case 5:
      return node ? `copy ${node.id} ${designer.duplicateNode(node.id) !== false}` : 'none';
    case 6:
      return node && random() < 0.6 ? `remove ${node.id} ${designer.removeNode(node.id)}` : 'none';
    case 7:
      return `group ${designer.addContainer(words || 'Group', node && random() < 0.5 ? { after: node.id } : undefined) !== false}`;
    case 8: {
      const other = pick(fields);
      return field && other ? `when ${field.id} ${designer.setCondition(field.id, random() < 0.2 ? null : { field: random() < 0.9 ? other.field : 'nowhere', equals: words })}` : 'none';
    }
    case 9: {
      const other = pick(fields);
      return field && other ? `rule ${field.id} ${designer.setRule(field.id, random() < 0.5 ? 'required' : 'readonly', random() < 0.2 ? null : { field: other.field, equals: true })}` : 'none';
    }
    case 10: {
      const section = pick(sections);
      return section ? `columns ${section.id} ${designer.setColumns(section.id, (1 + Math.floor(random() * 4)) as 1 | 2 | 3 | 4)}` : 'none';
    }
    case 11:
      return field ? `kind ${field.id} ${designer.changeKind(field.id, pick(KINDS) as string)}` : 'none';
    default:
      return `title ${designer.setPageInfo({ title: words, description: random() < 0.3 ? words : undefined })}`;
  }
}

/**
 * A page as JSON, each object's keys in one order: the format's whole check hands back its pages with their keys in
 * the order the format lists them, the quick check as they were written — the same page.
 */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, own: unknown) => (own && typeof own === 'object' && !Array.isArray(own) ? Object.fromEntries(Object.entries(own).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : own));

/** A designer's run of generated edits: each edit's verdict, and each page it kept, as JSON. */
function run(seed: number, steps: number): { said: string[]; pages: string[]; kept: Page[] } {
  const random = seeded(seed);
  const designer = createDesigner({ page: blankPage(seed % 2 ? 'screen' : 'survey', 'Site visit') });
  const said: string[] = [];
  const pages: string[] = [];
  const kept: Page[] = [];
  for (let i = 0; i < steps; i++) {
    said.push(edit(designer, random));
    kept.push(designer.getPage());
    pages.push(canonical(designer.getPage()));
  }
  return { said, pages, kept };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];
const STEPS = 60;

describe('the designer before the format’s schemas have come', () => {
  it('keeps or refuses every generated edit as one with them does, keeps the same pages, and every page it kept passes validatePage', async () => {
    expect(pageSchemaPart.loaded).toBeUndefined();
    // Before: each run made and edited at once, in one go, before the part asked for as the designer opened has come.
    const before = SEEDS.map((seed) => run(seed, STEPS));
    expect(pageSchemaPart.loaded).toBeUndefined();
    await pageSchemaPart.load();
    const after = SEEDS.map((seed) => run(seed, STEPS));
    let refused = 0;
    for (const [i, seed] of SEEDS.entries()) {
      expect({ seed, said: before[i].said }).toEqual({ seed, said: after[i].said });
      // The first page that differs, with the edit that made it: what to look at when one does.
      const at = before[i].pages.findIndex((page, step) => page !== after[i].pages[step]);
      expect({ seed, at, edit: before[i].said[at], page: before[i].pages[at] }).toEqual({ seed, at: -1, edit: undefined, page: undefined });
      for (const page of before[i].kept) expect(validatePage(page).ok).toBe(true);
      refused += before[i].said.filter((line) => line.endsWith(' false')).length;
    }
    // The generated edits are not all kept: what is refused is compared too.
    expect(refused).toBeGreaterThan(0);
  });
});

describe('a page the quick check lets by and the format refuses', () => {
  /** The designer in a module registry of its own: the format's schemas not fetched yet. */
  async function fresh(): Promise<{ createDesigner: typeof createDesigner; pageSchemaPart: typeof pageSchemaPart }> {
    let made!: { createDesigner: typeof createDesigner; pageSchemaPart: typeof pageSchemaPart };
    await jest.isolateModulesAsync(async () => {
      const [designer, part] = await Promise.all([import('./designer'), import('./schema-part')]);
      made = { createDesigner: designer.createDesigner, pageSchemaPart: part.pageSchemaPart };
    });
    return made;
  }
  // A size the format takes as a whole number, written as words: every viewer draws the page, as 0.35 drew it — its
  // whole check says it after the first draw (0.36), refused from 0.37 — and the format refuses it.
  const page = (): Page => ({ ...blankPage('screen', 'Visit'), fields: { name: { type: 'char', label: 'Name', size: 'big' as unknown as number } } });

  it('is said once the schemas have come, its checks told again, and never published', async () => {
    const { createDesigner: make, pageSchemaPart: part } = await fresh();
    expect(validatePage(page()).ok).toBe(false);
    const designer = make({ page: page() });
    expect(part.loaded).toBeUndefined();
    const told = jest.fn();
    designer.subscribe(told);
    // Before they came: the quick check's checks, which do not read a size.
    expect(designer.checks().some((check) => /size/.test(check.text))).toBe(false);
    // Publishing waits for them, and refuses.
    await expect(designer.publish()).rejects.toThrow('This page has problems and cannot be published');
    expect(part.loaded).toBeDefined();
    // Once they came, the checks were told again, and say it.
    expect(told).toHaveBeenCalled();
    expect(designer.checks().some((check) => check.severity === 'must' && /size/.test(check.text))).toBe(true);
  });
});
