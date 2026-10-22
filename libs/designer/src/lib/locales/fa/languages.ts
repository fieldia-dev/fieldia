/**
 * The designer's words in Farsi: languages by name — the page's own, those it keeps translations in. UNREVIEWED:
 * machine-assisted, not yet reviewed by a native speaker.
 */
import type { DesignerWords } from '../../designer-words';
import { displayName } from '../../language-names';

export const languages: DesignerWords['languages'] = {
  name: (tag) => displayName('fa', tag),
};
