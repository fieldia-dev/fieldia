import type { DesignerWords } from '../../designer-words';
import { displayName } from '../../language-names';

/** The designer's words in Turkish: languages by name, the page's own and those it keeps translations in. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const languages: DesignerWords['languages'] = {
  name: (tag) => displayName('tr', tag),
};
