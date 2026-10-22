import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Spanish: the editor's left side — the toolbox, its tabs (Add, Outline, Data), and the Data
 * pane. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const toolbox: DesignerWords['toolbox'] = {
  find: 'Buscar un campo o un tipo',
  nothing: 'No hay nada con ese nombre.',
  addAField: 'Añadir un campo',
  addNew: (kind) => `${kind}: añadir un campo nuevo`,
  fromTheModel: 'Del modelo de datos',
  inTheModel: (label, stored) => `${label}: ya está en el modelo de datos; se guarda como ${stored}`,
  layout: 'Disposición',
  tabs: 'Pestañas',
  tabsTip: 'Pestañas: páginas de secciones en la hoja de un registro',
  section: 'Sección',
  sectionTip: 'Sección: un grupo de campos con título',
  blocks: {
    group: ['Grupo', 'Un grupo con título y sus propias columnas'],
    side: ['Lado a lado', 'Dos grupos uno junto al otro'],
    tabs: ['Pestañas', 'Páginas de grupos; se muestra una cada vez'],
    heading: ['Encabezado', 'Un título entre elementos'],
    text: ['Texto', 'Un párrafo o una nota'],
    divider: ['Separador', 'Una línea de lado a lado'],
    spacer: ['Espaciador', 'Espacio, o una celda vacía'],
    image: ['Imagen', 'Una imagen o un logotipo'],
    button: ['Botón', 'Enviar, u otra acción'],
    map: ['Mapa', 'Los lugares del registro, una ruta entre ellos y la ubicación de quien lo lee'],
  },
  blockTip: (name, tip) => `${name}: ${tip}`,
  add: 'Añadir',
  outline: 'Esquema',
  data: 'Datos',
  besideThePage: 'Junto a la página',
  railLabel: 'Añadir, esquema y datos',
  // "Answers are kept as responses": answer and response are one word in Spanish, so it says how they are kept.
  responses: 'Las respuestas se guardan así:',
  responsesModel: 'un registro por persona, un campo por pregunta',
  surveyFields: 'Una encuesta crea sus propios campos: cada pregunta que se añade es un campo nuevo, así que se ofrecen todos los tipos.',
  addAsColumn: 'Añadir como columna',
  addField: 'Añadir',
  onThePage: 'En la página',
  notUsed: 'Sin usar',
  storedTitle: (label, stored) => `${label}: ${stored}`,
  recordOnCanvas: 'Registro en el lienzo',
  empty: 'Vacío',
  record: (n) => `Registro ${n}`,
  madeUp: 'Un registro ficticio llena la página, para que se lea como se leerá con registros reales. Aquí no se guarda nada.',
  listShows: 'Esta lista muestra registros de',
  pageShows: 'Esta página muestra registros de',
  fieldCount: (all, onPage) => `${plural('es', all, { one: '# campo', other: '# campos' })} · ${onPage} en esta página`,
};
