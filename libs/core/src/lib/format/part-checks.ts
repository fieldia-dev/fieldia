import type { Field, LineField } from './field';
import type { Page } from './page';

/**
 * What the checks of a field drawn by a part, or of what a part shows, are handed: the reference check's own tools, so
 * what they say reads as the rest of its findings. In the one-tag script such checks come with the part (booking
 * slots' with the slots part, a signature's with the files part, a page's endings with the answers part), run once it
 * came (later-checks.ts); the packages' checks run them at once.
 */
export interface FieldTools {
  readonly page: Page;
  need(name: string, path: string): Field | LineField | undefined;
  report(path: string, message: string): void;
  /** Said where checks come in a part that has not come (the one-tag script's): they are owed. */
  owe(part: string): void;
}

/** What a page's endings are checked with, besides a field's tools: conditions, and words that show the answers. */
export interface EndingTools extends FieldTools {
  checkModifiers(owner: object, path: string, keys?: readonly string[]): void;
  checkWords(owner: object, path: string, keys: readonly string[], sent?: boolean): void;
}
