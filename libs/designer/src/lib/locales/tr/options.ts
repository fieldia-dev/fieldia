import type { DesignerWords } from '../../designer-words';

/** The designer's words in Turkish: a choice's options, typed in place — adding, “Other”, “None of these”, moving and removing them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const options: DesignerWords['options'] = {
  addOption: 'Seçenek ekle',
  addOther: '“Diğer” ekle',
  or: 'veya',
  removeOther: '“Diğer” seçeneğini kaldır',
  other: 'Diğer…',
  addNone: '“Hiçbiri” ekle',
  removeOption: 'Seçeneği kaldır',
  removeNamed: (label) => `“${label}” seçeneğini kaldır`,
  option: (n) => `Seçenek ${n}`,
  grip: 'Taşımak için sürükleyin · Alt+↑ veya ↓ ile de taşınır',
  alone: 'tek başına seçilir',
  showWhen: 'Şu durumda göster…',
  shownWhen: 'Şu durumda görünür',
  showOptionWhen: 'Bu seçeneği göster',
  whenOptionShows: 'Bu seçeneğin göründüğü durum',
};
