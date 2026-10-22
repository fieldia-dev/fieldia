import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: what the designer says of a setting typed into one of its own boxes that it cannot
 * take — out of range, not a number, half-typed — and of a formula that does not read yet. UNREVIEWED: machine-assisted,
 * not yet reviewed by a native speaker.
 */
export const inputs: DesignerWords['inputs'] = {
  settingRange: (setting, min, max) => `${setting} es un número entero de ${min} a ${max}`,
  settingNumberRange: (setting, min, max) => `${setting} es un número de ${min} a ${max}`,
  settingAtLeast: (setting, min) => `${setting} es un número entero, ${min} o más`,
  settingMoreThan: (setting, min) => `${setting} es mayor que ${min}`,
  settingFewer: (setting, n) => `${setting} es menor que el número de opciones (${n})`,
  settingNeedsNumber: (setting) => `${setting} necesita un número`,
  settingDateRefused: (setting) => `${setting} no puede ser esa fecha en esta página`,
  settingStays: (value) => `Se mantiene en ${value}.`,
  settingSetTo: (setting, min, max, value) => `${setting} va de ${min} a ${max}, así que queda en ${value}`,
  formulaKept: (problem, formula) => `Aún no está en vigor: ${problem}. La página mantiene ${formula}.`,
  formulaNone: (problem) => `Aún no está en vigor: ${problem}. La página no tiene fórmula hasta que esta se pueda leer.`,
  // English names the Arabic decimal mark too; a Spanish reader types a point or a comma, so the point is named alone.
  formulaPoint: 'En una fórmula, el separador decimal es el punto, como en 1.5',
  trackRange: (track, min, max) => `“${track}”: una columna mide de ${min} a ${max} px de ancho`,
};
