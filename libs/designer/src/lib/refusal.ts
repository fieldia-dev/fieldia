import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/** Why an edit was refused: words, or the words in the designer's language. */
export type RefusalWords = string | ((words: DesignerWords) => string);

/**
 * Thrown by an edit that cannot be made; the designer turns it into an issue,
 * the edit not applied, said in its own language. Its `message` is the English.
 */
export class Refusal extends Error {
  constructor(readonly words: RefusalWords) {
    super(typeof words === 'string' ? words : words(en));
  }

  /** Why, in a language's words. */
  in(words: DesignerWords): string {
    return typeof this.words === 'string' ? this.words : this.words(words);
  }
}
