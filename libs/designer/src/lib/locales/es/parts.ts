import type { DesignerWords } from '../../designer-words';
import { listOf, plural } from '../speak';

/**
 * The designer's words in Spanish: what a part is called when it has no words of its own — an arrangement by how its
 * parts fall, a picture with no description. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const parts: DesignerWords['parts'] = {
  page: 'Página',
  column: 'Columna',
  columns: (n) => plural('es', n, { one: '# columna', other: '# columnas' }),
  sideBySide: 'Lado a lado',
  tabs: 'Pestañas',
  image: 'Imagen',
  map: 'Mapa',
  related: 'Lista relacionada',
  divider: 'Separador',
  spacer: 'Espaciador',
  untitledSection: 'Sección sin título',
  inTab: (tab, section) => `${tab} › ${section}`,
  quote: (name) => `“${name}”`,
  and: (names) => listOf('es', names, 'and'),
  commaList: (names) => names.join(', '),
  shares: { whole: 'toda la fila', threeQuarters: 'tres cuartos de la fila', twoThirds: 'dos tercios de la fila', half: 'media fila', third: 'un tercio de la fila', quarter: 'un cuarto de la fila' },
  percentOfRow: (n) => `${n} % de la fila`,
};
