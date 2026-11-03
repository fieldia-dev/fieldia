import { answerOf, FIELD_NAME, type FormNode, type Page } from '@fieldia/core';
import { containers } from './page-tree';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { Refusal } from './refusal';
import type { PageCheck } from './page-checks';

/**
 * Saved forms placed in the page being designed: an address, a contact
 * person, a consent made once on a page of its own and placed wherever a form
 * asks for it. The page keeps only which saved form, the version it keeps to
 * (the latest when it keeps to none), where its answers go and its title; the
 * saved form itself is edited on its own page.
 *
 * The designer reaches the app's saved forms through its PageStore: `list()`
 * names those that can be placed, and `load()` gives each one's versions. What
 * it has loaded is kept here, so a canvas, a panel and the checks ask for one
 * at once, and are told when it has come. One the store refuses to give is
 * none of that: what was loaded of it is kept, and it is asked for again a
 * while later (`ASK_AGAIN_MS`).
 */

/**
 * How long a saved form the store refused to give waits before it is asked for again, by the next that asks for it (a
 * draw, the checks): never in a loop of draws, each asking the store once more.
 */
const ASK_AGAIN_MS = 5_000;

/** A saved form the app's store lists: by its id, and the title people know it by. */
export interface SavedFormRef {
  id: string;
  title: string;
}

/** One published version of a saved form, as the store keeps it. */
interface Version {
  version: number;
  page: Page;
}

/** What the panel changes of a saved form placed on the page. */
export interface FormPartPatch {
  /** Another saved form in its place. */
  page?: string;
  /** A published version to keep to; `null` for the latest. */
  version?: number | null;
  /** Where its answers go: the name they are kept under. */
  name?: string;
  /** Words over it; `null` for the saved form's own title, empty for none. */
  title?: string | null;
}

/** The store a designer reaches saved forms through: loading each, and listing them when it can. */
export interface FormSource {
  load(id: string): Promise<{ versions: Version[] }>;
  list?(): Promise<SavedFormRef[]>;
}

/** Every saved form placed on the page, in reading order. */
export function formParts(page: Page): FormNode[] {
  return containers(page).flatMap((holder) => holder.children.filter((node): node is FormNode => node.type === 'form'));
}

/** Whether a name is taken where answers go: a field of the page, or another copy's answers. */
const taken = (page: Page, name: string, except?: string) => Object.prototype.hasOwnProperty.call(page.fields, name) || formParts(page).some((part) => part.name === name && part.id !== except);

/** A name for a field, free of the page's fields and of every copy's answers: `q_1`, `q_2`… */
export function freeFieldName(page: Page, prefix = 'q'): string {
  for (let n = 1; ; n++) if (!taken(page, `${prefix}_${n}`)) return `${prefix}_${n}`;
}

/** Where a new copy's answers go: named after the saved form — `address`, then `address_2` — free of the page's fields and other copies. */
export function answersName(page: Page, title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = !words ? 'form' : /^[0-9]/.test(words) ? `form_${words}` : words;
  if (!taken(page, base)) return base;
  for (let n = 2; ; n++) if (!taken(page, `${base}_${n}`)) return `${base}_${n}`;
}

/** A saved form placed here changed as the panel says: each value checked, `null` or empty taking one back. */
export function updateFormPart(page: Page, id: string, patch: FormPartPatch): void {
  const part = formParts(page).find((p) => p.id === id);
  if (!part) throw new Refusal((w) => w.savedForms.noForm(id));
  if (patch.page !== undefined) {
    if (!patch.page) throw new Refusal((w) => w.savedForms.pickForm);
    part.page = patch.page;
  }
  if (patch.version !== undefined) {
    if (patch.version === null) delete part.version;
    else if (!Number.isInteger(patch.version) || patch.version < 1) throw new Refusal((w) => w.savedForms.versionWhole);
    else part.version = patch.version;
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!FIELD_NAME.test(name)) {
      // Words of another script give no letters to keep: a name of the kind it takes, then.
      const kept = name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^[^A-Za-z_]+/, '');
      const hint = /[A-Za-z]/.test(kept) ? kept : 'answers';
      throw new Refusal((w) => w.savedForms.answersName(hint));
    }
    part.name = name;
  }
  if (patch.title !== undefined) {
    if (patch.title === null) delete part.title;
    else part.title = patch.title;
  }
}

/**
 * The saved forms the designer has loaded, as it has them now, loading those
 * asked for that it has not; `changed` is called each time one comes.
 */
export interface SavedFormsCache {
  /**
   * A saved form's published versions, newest last; undefined while it loads — or until the store, which refused it,
   * gives it — and null when the store has none.
   */
  versions(id: string): Version[] | null | undefined;
  /** The page placed: the version kept to, or the latest. Undefined while it loads, null when there is none. */
  page(id: string, version?: number): Page | null | undefined;
  /** Load a saved form afresh, and every saved form it places: what the store refuses to give stays as it was. */
  load(id: string): Promise<void>;
  /**
   * The way round, by title, when placing this saved form here would place
   * `self` inside itself: `self`, the forms between, `self` again. Null when
   * it would not, as far as what has loaded tells.
   */
  cycle(from: { page: string; version?: number }, self: { id: string; title: string }): string[] | null;
}

export function savedFormsCache(source: FormSource | undefined, changed: () => void): SavedFormsCache {
  const known = new Map<string, Version[] | null>();
  const loading = new Map<string, Promise<void>>();
  /** When the store last refused each, by id: asked for again once `ASK_AGAIN_MS` has passed. */
  const refused = new Map<string, number>();

  /** Its versions, null when the store has none, undefined when it refused to say. */
  async function ask(id: string): Promise<Version[] | null | undefined> {
    try {
      // The store's answer handled as it is given (`answerOf`): one refused at once is never the zone's to say.
      const found = source ? await answerOf(source.load(id)) : { versions: [] };
      return found.versions.length ? found.versions : null;
    } catch {
      return undefined;
    }
  }

  function fetch(id: string): Promise<void> {
    const running = loading.get(id);
    if (running) return running;
    // Known, and no longer loading, in one step: a load asked for after it starts afresh. Refused, what was known is
    // kept, and nothing changed is told.
    const done = ask(id).then((found) => {
      loading.delete(id);
      if (found === undefined) return void refused.set(id, Date.now());
      refused.delete(id);
      known.set(id, found);
      changed();
    });
    loading.set(id, done);
    return done;
  }

  const versions = (id: string) => {
    if (known.has(id)) return known.get(id) as Version[] | null;
    const at = refused.get(id);
    if (at === undefined || Date.now() - at >= ASK_AGAIN_MS) void fetch(id);
    return undefined;
  };

  const page = (id: string, version?: number) => {
    const all = versions(id);
    if (!all) return all;
    return (version === undefined ? all[all.length - 1] : all.find((v) => v.version === version))?.page ?? null;
  };

  return {
    versions,
    page,
    async load(id) {
      const seen = new Set<string>();
      const walk = async (at: string): Promise<void> => {
        if (seen.has(at)) return;
        seen.add(at);
        await fetch(at);
        // Every version it has: the parts it places may keep to any of them.
        const pages = (known.get(at) ?? []).map((v) => v.page);
        await Promise.all(pages.flatMap((p) => formParts(p).map((part) => walk(part.page))));
      };
      // What is known of it stays drawn while it loads afresh, and stays where the store refuses it.
      await walk(id);
    },
    cycle(from, self) {
      const seen = new Set<string>();
      const walk = (at: { page: string; version?: number }, way: string[]): string[] | null => {
        if (at.page === self.id) return [...way, self.title];
        const key = `${at.page}@${at.version ?? ''}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const found = page(at.page, at.version);
        if (!found) return null;
        const here = [...way, found.title || found.id];
        for (const part of formParts(found)) {
          const round = walk(part, here);
          if (round) return round;
        }
        return null;
      };
      return walk(from, [self.title]);
    },
  };
}

/** A saved form's title as the page shows it: in the page's language, where the saved form keeps a translation of it. */
export function shownTitle(saved: Page | null | undefined, language: string | undefined): string | undefined {
  if (!saved?.title) return undefined;
  return (language ? saved.translations?.[language]?.[saved.title] : undefined) || saved.title;
}

/** Refuse a saved form placed where it would hold the page itself, once what it places has loaded. */
export function refuseCycle(cache: SavedFormsCache, part: { page: string; version?: number }, self: Page): void {
  const title = self.title || self.id;
  if (part.page === self.id) throw new Refusal((w) => w.savedForms.insideItself);
  const round = cache.cycle(part, { id: self.id, title });
  if (round) throw new Refusal((w) => w.savedForms.holdsThisPage(round[1], w.savedForms.way(round)));
}

/**
 * What the Checks list says of the saved forms placed on the page: one the
 * store cannot find, a version it has not got, one that would hold the page
 * itself, and copies whose answers would mix. A saved form still loading
 * says nothing yet.
 */
export function formChecks(page: Page, cache: SavedFormsCache | null, words: DesignerWords = en): PageCheck[] {
  const w = words.savedForms;
  const found: PageCheck[] = [];
  const fix = (id: string) => ({ label: w.takeItOff, action: { kind: 'remove' as const, id } });
  const names = new Set<string>();
  for (const part of formParts(page)) {
    if (Object.prototype.hasOwnProperty.call(page.fields, part.name)) {
      found.push({ at: part.id, severity: 'must', text: w.mixWithField(part.name) });
    } else if (names.has(part.name)) {
      found.push({ at: part.id, severity: 'must', text: w.mixWithCopy(part.name) });
    }
    names.add(part.name);
    if (part.page === page.id) {
      found.push({ at: part.id, severity: 'must', text: w.placedInItself, fix: fix(part.id) });
      continue;
    }
    if (!cache) continue;
    const all = cache.versions(part.page);
    if (all === undefined) continue;
    const placed = cache.page(part.page, part.version);
    const title = all?.[all.length - 1]?.page.title || part.page;
    if (!all) found.push({ at: part.id, severity: 'must', text: w.cannotBeFound(part.page), fix: fix(part.id) });
    else if (!placed) found.push({ at: part.id, severity: 'must', text: w.noVersion(title, part.version as number) });
    else if (placed.layout.type !== 'sections' && placed.layout.type !== 'tabs') {
      found.push({ at: part.id, severity: 'must', text: w.notSections(placed.title || part.page), fix: fix(part.id) });
    } else {
      const round = cache.cycle(part, { id: page.id, title: page.title || page.id });
      if (round) found.push({ at: part.id, severity: 'must', text: w.holdsThisPageCheck(round[1], w.way(round)), fix: fix(part.id) });
    }
  }
  return found;
}

/** The format's own words for what `formChecks` says better: left out of the Checks list. */
export const SAID_BY_FORM_CHECKS = /saved form|placed inside itself/;
