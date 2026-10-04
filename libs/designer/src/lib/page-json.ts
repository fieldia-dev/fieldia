import { validatePage, type Page } from '@fieldia/core';
import { placeOf, readJson, type Place, type Spot } from './json-text';

/**
 * The whole page as JSON, read and written as one edit: what a person who
 * knows the format types, checked as they type it. Text that is not JSON is
 * refused with the line and column of the mistake; a page the format would
 * refuse, with each problem on the line where it sits. Only a page with no
 * problem replaces the one being edited — as one step, which Undo takes back.
 */

/** A problem with the text: where it is, what it is, and for a problem with the page, the path into it. */
export interface JsonProblem extends Place {
  message: string;
  path?: string;
}

export type PageJsonResult = { ok: true } | { ok: false; problems: JsonProblem[] };

/** Text read as a page: the value and where its parts sit, when it is JSON; and the problems that stop it being the page. */
export interface ReadPage {
  value: unknown;
  tree: Spot | null;
  page: Page | null;
  problems: JsonProblem[];
}

/** The page as JSON: two spaces deep, its keys in the order the page keeps them. */
export function pageToJson(page: Page): string {
  return JSON.stringify(page, null, 2);
}

/** Read text as a page: first as JSON, then by the format's every check. */
export function readPage(text: string): ReadPage {
  const read = readJson(text);
  if (!read.ok) return { value: undefined, tree: null, page: null, problems: [read.problem] };
  const checked = validatePage(read.value);
  if (checked.ok) return { value: read.value, tree: read.tree, page: checked.page, problems: [] };
  const problems = checked.issues.map((issue) => ({ ...placeOf(text, read.tree, issue.path), path: issue.path, message: issue.message }));
  // In reading order, as the person meets them going down the text.
  problems.sort((a, b) => a.line - b.line || a.column - b.column);
  return { value: read.value, tree: read.tree, page: null, problems };
}

export interface PageJsonCommands {
  pageJson(): string;
  setPageJson(text: string): PageJsonResult;
}

/** What the commands need of the designer: the page, and an edit kept as one undo step. */
export interface PageJsonDeps {
  getPage(): Page;
  apply(edit: (draft: Page) => void): boolean;
}

export function pageJsonCommands({ getPage, apply }: PageJsonDeps): PageJsonCommands {
  return {
    pageJson: () => pageToJson(getPage()),
    setPageJson(text) {
      const { page, problems } = readPage(text);
      if (!page) return { ok: false, problems };
      // The page as it is already: nothing to undo.
      if (pageToJson(page) === pageToJson(getPage())) return { ok: true };
      // Checked already, by the same checks the edit runs: it cannot be refused.
      apply((draft) => {
        for (const key of Object.keys(draft)) delete (draft as unknown as Record<string, unknown>)[key];
        Object.assign(draft, JSON.parse(JSON.stringify(page)));
      });
      return { ok: true };
    },
  };
}
