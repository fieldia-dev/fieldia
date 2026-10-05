import { displayName } from '../../language-names';

/** Languages by name: the page's own, those it keeps translations in. */
export const languages = {
  /** A language's name: `ar` is Arabic. */
  name: (tag: string) => displayName('en', tag),
};
