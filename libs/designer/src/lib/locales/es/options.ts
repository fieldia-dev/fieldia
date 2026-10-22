import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: a choice's options, typed in place — adding, “Other”, “None of these”, moving and
 * removing them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const options: DesignerWords['options'] = {
  addOption: 'Añadir opción',
  addOther: 'añadir “Otro”',
  or: 'o',
  removeOther: 'Quitar “Otro”',
  other: 'Otro…',
  addNone: 'añadir “Ninguna de las anteriores”',
  removeOption: 'Quitar opción',
  removeNamed: (label) => `Quitar la opción ${label}`,
  option: (n) => `Opción ${n}`,
  grip: 'Arrastre para moverla · Alt+↑ o ↓ también la mueve',
  alone: 'exclusiva',
  showWhen: 'Mostrar cuando…',
  shownWhen: 'Se muestra cuando',
  showOptionWhen: 'Mostrar esta opción',
  whenOptionShows: 'Cuándo se muestra esta opción',
};
