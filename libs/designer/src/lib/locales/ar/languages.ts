import type { DesignerWords } from '../../designer-words';
import { displayName } from '../../language-names';

export const languages: DesignerWords['languages'] = {
  name: (tag) => displayName('ar', tag),
};
