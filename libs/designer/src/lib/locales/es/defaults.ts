import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: the words the designer writes into a page as a part is made — a new question's
 * label, its first option, a new page's or section's name. UNREVIEWED: machine-assisted, not yet reviewed by a native
 * speaker.
 */
export const defaults: DesignerWords['defaults'] = {
  untitledQuestion: 'Pregunta sin título',
  option: (n) => `Opción ${n}`,
  row: (n) => `Fila ${n}`,
  column: (n) => `Columna ${n}`,
  page: (n) => `Página ${n}`,
  section: (n) => `Sección ${n}`,
  tab: (n) => `Pestaña ${n}`,
  name: 'Nombre',
  description: 'Descripción',
  quantity: 'Cantidad',
  draft: 'Borrador',
  confirmed: 'Confirmado',
  done: 'Hecho',
  newButton: 'Nuevo botón',
  counter: 'Contador',
  newMenuAction: 'Nueva acción',
  newSubmenu: 'Nuevo menú',
  newReport: 'Informe',
  badge: 'Insignia',
  ribbon: 'Cinta',
  alert: 'Algo que debe saber sobre este registro.',
  noneOfThese: 'Ninguna de las anteriores',
  newGroup: 'Nuevo grupo',
  newMap: 'Mapa',
  // The map layer of the person's own place.
  you: 'Su ubicación',
  left: 'Izquierda',
  right: 'Derecha',
  // Two new tabs' names: "pestaña" is feminine.
  first: 'Primera',
  second: 'Segunda',
  newHeading: 'Nuevo encabezado',
  helpText: 'Indicaciones que ayudan a completar este campo.',
  button: 'Botón',
  npsStart: 'Nada probable',
  npsEnd: 'Extremadamente probable',
  // A priority's levels: "prioridad" is feminine.
  priorityNone: 'Normal',
  priorityLevels: ['Alta', 'Muy alta'],
  dotStates: ['En curso', 'Bloqueado', 'Listo'],
};
