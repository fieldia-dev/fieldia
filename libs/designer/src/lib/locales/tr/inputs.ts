import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Turkish: what the designer says of a setting typed into one of its own boxes that it cannot
 * take — out of range, not a number, half-typed — and of a formula that does not read yet. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const inputs: DesignerWords['inputs'] = {
  settingRange: (setting, min, max) => `${setting}: ${min} ile ${max} arasında bir tam sayı olmalıdır`,
  settingNumberRange: (setting, min, max) => `${setting}: ${min} ile ${max} arasında bir sayı olmalıdır`,
  settingAtLeast: (setting, min) => `${setting}: ${min} veya daha büyük bir tam sayı olmalıdır`,
  settingMoreThan: (setting, min) => `${setting}: ${min} değerinden büyük olmalıdır`,
  settingFewer: (setting, n) => `${setting}: seçenek sayısından (${n}) az olmalıdır`,
  settingNeedsNumber: (setting) => `${setting}: bir sayı gerekir`,
  settingDateRefused: (setting) => `${setting}: bu sayfada bu tarih olamaz`,
  settingStays: (value) => `Değer ${value} olarak kalır.`,
  settingSetTo: (setting, min, max, value) => `${setting}: ${min} ile ${max} arasında olmalıdır, bu yüzden ${value} olarak ayarlandı`,
  formulaKept: (problem, formula) => `Henüz geçerli değil: ${problem}. Sayfa şu formülü korur: ${formula}.`,
  formulaNone: (problem) => `Henüz geçerli değil: ${problem}. Bu formül okunabilir olana kadar sayfada formül yok.`,
  // A formula's decimal mark is a point, not the comma Turkish writes numbers with: said so (the Arabic mark English also names is no Turkish reader's).
  formulaPoint: 'Formülde ondalık işareti virgül değil, noktadır; örneğin 1.5',
  trackRange: (track, min, max) => `“${track}”: sütun genişliği ${min} ile ${max} px arasında olmalıdır`,
};
