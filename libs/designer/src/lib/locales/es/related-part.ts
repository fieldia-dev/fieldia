import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: a related list on a record's page, in the designer — its tile, its panel (its
 * title, the records it lists and their link to this one, its columns, its cards on a phone, rows a page, New and View
 * all) and the words its new one starts with. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const relatedPart: DesignerWords['relatedPart'] = {
  tile: 'Lista relacionada',
  tileTip: 'Registros de otro tipo que apuntan a este, listados dentro de él: las facturas de un cliente, las visitas de un inmueble',
  newTitle: 'Registros relacionados',
  name: 'Nombre',
  title: 'Título',
  model: 'Registros de',
  modelHint: 'Su modelo, tal como lo nombra su fuente de datos: invoice, sale.order.',
  field: 'Su enlace a este registro',
  fieldHint: (model) => `Un campo de esos registros que apunta a ${model}: partner_id. La lista muestra aquellos cuyo enlace es este registro.`,
  columns: 'Columnas',
  columnName: (n) => `Columna ${n}: su campo`,
  columnLabel: (n) => `Columna ${n}: su texto`,
  columnKind: (n) => `Columna ${n}: su tipo`,
  kinds: {
    char: 'Texto',
    integer: 'Número entero',
    float: 'Número',
    monetary: 'Importe',
    date: 'Fecha',
    datetime: 'Fecha y hora',
    boolean: 'Sí o no',
    selection: 'Opción',
    many2one: 'Enlace',
    text: 'Texto largo',
  },
  removeColumn: (label) => `Quitar la columna ${label}`,
  addColumn: 'Añadir una columna',
  newColumn: (n) => `Columna ${n}`,
  lastColumn: 'Una lista relacionada muestra al menos una columna.',
  rows: 'Filas por página',
  rowsHint: '5 si no se indica otra cosa: a partir de ahí, se muestran un paginador y una búsqueda.',
  newWord: 'Crear',
  create: 'Ofrecer “Crear”, que crea uno con su enlace a este registro ya completado',
  createHint: 'En un cuadro de diálogo de la página que su aplicación da para su modelo; si no da ninguna, no se ofrece “Crear”.',
  viewAll: '“Ver todo” abre la página',
  viewAllHint: 'La lista de esos registros en su aplicación, por su id, que muestra solo los de este registro. Vacío: sin “Ver todo”.',
  opensIn: '“Ver todo” se abre en',
  opens: { dialog: 'Cuadro de diálogo', panel: 'Panel lateral', page: 'En el mismo lugar' },
  rowsOpen: 'Las filas y “Crear” se abren',
  rowsOpenHint:
    'A la manera de su aplicación: primero se consulta su onOpen, con la página y el id del registro, o con el enlace de uno nuevo a este registro; si no lo acepta, en un cuadro de diálogo.',
  rowsOpenIn: { dialog: 'Cuadro de diálogo', app: 'A la manera de su aplicación' },
  onlyOnRecords: 'Una lista relacionada va en la página de un registro: esta recoge respuestas.',
  noModel: 'Indique el modelo de los registros que lista, tal como lo nombra su fuente de datos.',
  notAName: (name) => `“${name}” no es el nombre de un campo: letras, dígitos y _, sin empezar por un dígito`,
  columnTwice: (name) => `“${name}” ya es una columna`,
  cards: 'Tarjetas en un teléfono',
  notTheirs: (name) => `“${name}” no es ninguno de los campos de sus registros: añádalo primero como columna`,
  previewNote: 'Sus registros se muestran en “Probar”, una vez guardado el registro.',
  more: (n) => `${n} más en su propio JSON: un filtro, un orden, sus celdas`,
};
