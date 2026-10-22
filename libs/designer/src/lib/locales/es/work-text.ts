import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Spanish: a work item's body in the designer — a group's own column widths and gap, its fold
 * control at the heading's end and its ⤢; help in a light box with an icon; a formatted text's toolbar, tools and
 * editors; a links box. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const workText: DesignerWords['workText'] = {
  // ---- a group's columns and heading
  columnWidths: 'Anchos de columna',
  columnWidthsHint:
    'Uno por cada columna, separados por espacios: píxeles (274px), una parte de la fila (50%) o de lo que queda (1fr). Columnas iguales si se deja vacío.',
  gap: 'Espacio entre columnas',
  gapHint: 'En píxeles, de 0 a 48; el de la apariencia si se deja vacío.',
  foldControl: 'Control para plegar',
  beforeTitle: 'Antes del título',
  atHeadingEnd: 'Al final del encabezado',
  maximise: 'Maximizar',
  maximiseHint: 'Un ⤢ al final del encabezado muestra el grupo solo, sobre el cuerpo del registro.',
  // ---- refusals
  tracksCount: (columns, widths) =>
    `El grupo tiene ${plural('es', columns, { one: '# columna', other: '# columnas' })} y ${plural('es', widths, { one: '# ancho', other: '# anchos' })}: indique un ancho por cada columna.`,
  noWidth: (track) => `“${track}” no es un ancho: escriba píxeles (274px), una parte de la fila (50%) o de lo que queda (1fr).`,
  gapRange: 'El espacio entre columnas es un número entero de píxeles de 0 a 48.',
  foldNeedsFolding: 'Active primero “Plegable”: el control para plegar solo existe en un grupo que se pliega.',
  maximiseNeedsTitle: 'Ponga primero un título al grupo: se maximiza desde su encabezado.',
  noIconHere: 'Solo el texto de un cuadro de ayuda tiene icono.',
  // ---- help in a light box
  helpBox: 'Cuadro de ayuda',
  helpBoxTitle: 'En un cuadro claro con espacio para un icono, como la ayuda de un elemento de trabajo; los [textos](https://…) que contiene son enlaces',
  icon: 'Icono',
  noIcon: 'Sin icono',
  // ---- formatted text
  toolbarShown: 'Barra de herramientas',
  always: 'Siempre',
  whileWorkedIn: 'Mientras se trabaja en él',
  never: 'Nunca',
  toolbarAt: 'Barra de herramientas en',
  atTop: 'La parte superior',
  atFoot: 'La parte inferior',
  editor: 'Editor',
  richText: 'Texto enriquecido',
  markdown: 'Markdown',
  switchEditor: 'Se puede cambiar de editor',
  readFirst: 'Primero en lectura; se cambia con su botón Editar',
  tools: 'Herramientas',
  mentions: 'Las personas mencionadas con @ son de',
  mentionsPlaceholder: 'res.users',
  references: 'Registros enlazados por una clave',
  referenceKey: 'Clave',
  referenceModel: 'Modelo',
  referenceLabel: 'Nombre',
  addReference: 'Añadir un tipo de registro',
  removeReference: (key) => `Quitar los registros enlazados por ${key}`,
  // ---- a links box
  shownAs: 'Se muestra como',
  tags: 'Tags',
  linksBox: 'Enlaces con “Añadir enlace”',
  addWay: 'Añadir enlace',
  addMenu: 'Un menú: “Elemento existente” o “Elemento nuevo”',
  addSearch: 'Busca directamente',
  addWords: 'Su texto',
  helpWords: 'Ayuda mientras está vacío',
  helpIcon: 'Icono de la ayuda',
  helpTiled: 'Icono sobre un mosaico',
  helpTile: 'Color del mosaico',
  emptyLink: 'Un enlace en el cuadro vacío',
};
