import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: a table's own rules and a field's tone, as the panel words them — what each
 * column's cells do line by line, the lines' tones, the table's buttons, how it shows on a phone, and the widths a part
 * is hidden at. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const tables: DesignerWords['tables'] = {
  // ---- the settings' names, as the panel shows them
  tone: 'Tono',
  lineRules: 'Reglas de las líneas',
  tableButtons: 'Botones de la tabla',
  table: 'Tabla',
  hiddenOn: 'Oculto en',
  // ---- tones
  tones: { info: 'Azul', success: 'Verde', warning: 'Ámbar', danger: 'Rojo', muted: 'Gris' },
  toneOf: 'Tono',
  addTone: 'Añadir un tono',
  toneHint: 'Su valor en un color mientras se cumple una condición: la primera que se cumpla.',
  boldWhen: 'En negrita cuando',
  when: 'Cuando',
  whenPlaceholder: 'Cantidad > Demanda — escriba el nombre de un campo, o @',
  removeTone: (n) => `Quitar el tono ${n}`,
  // ---- a table's lines and columns
  linesTone: 'Tonos de las líneas',
  deletedOnlyWhen: 'Las líneas solo se eliminan cuando',
  linesHint: 'La condición de una línea lee sus propios campos, y el registro como parent: parent.state.',
  column: 'Columna',
  hiddenOnLineWhen: 'En blanco en una línea cuando',
  readonlyWhen: 'Solo lectura cuando',
  requiredWhen: 'Obligatorio cuando',
  columnHiddenWhen: 'Columna oculta cuando',
  columnHiddenHint: 'Se lee en el registro, no en una línea: desaparece toda la columna.',
  badge: 'Como píldora',
  shownAs: 'Se muestra como',
  asItsType: 'Como lo muestra su tipo',
  width: 'Ancho, en caracteres',
  columnShownTo: 'Columna visible solo para',
  // ---- buttons
  onEachLine: 'En cada línea',
  forChosenLines: 'Para las líneas seleccionadas',
  besideAdd: 'Junto a “Añadir una línea”',
  buttonWords: 'Texto',
  action: 'Acción de la aplicación',
  hiddenWhen: 'Oculto cuando',
  addButton: 'Añadir un botón',
  removeButton: (label) => `Quitar “${label}”`,
  newButton: 'Botón',
  // ---- the table's shape
  lineOpens: 'Una línea abre',
  opensFields: 'Sus campos',
  opensRecord: 'Su propia página',
  opensForm: 'Un formulario propio',
  onAPhone: 'En un teléfono',
  rows: 'Filas',
  cardsOnPhone: 'Tarjetas',
  cardsAlways: 'Tarjetas, siempre',
  columnWidths: 'Anchos de columna',
  shareWidth: 'Repartir el ancho',
  fitContent: 'Tan anchas como su contenido',
  shrinkToFit: 'Encoger para ajustar, con encabezados en varias líneas (una cuadrícula)',
  copyLine: 'Copiar una línea',
  linesOrder: 'Líneas ordenadas por',
  linesOrderPlaceholder: 'is_done, manual_consumption desc, sequence',
  // ---- widths a part is hidden at
  widths: { narrow: 'Teléfono', medium: 'Tableta', wide: 'Pantalla ancha' },
  hiddenOnHint: 'Oculto mientras el formulario tiene ese ancho: un teléfono hasta 520px, una tableta hasta 760px.',
  // ---- refusals
  onlyTables: 'Solo una tabla de líneas tiene reglas para sus líneas, botones y tarjetas',
  notAColumn: (name) => `“${name}” no es una columna de esta tabla`,
  widthRange: 'El ancho es de 1 a 200 caracteres',
  widgetUnsuited: (column, widget) => `${column} no se puede mostrar como ${widget}: no contiene lo que este muestra`,
  buttonNeedsWords: 'Un botón necesita un texto',
  notARole: (role) =>
    `“${role}” no es el nombre de un rol: letras, dígitos, puntos y guiones bajos, con ! delante para ocultar la columna a quienes lo tengan`,
  // ---- what changed, for the Publish dialog
  tableChanged: (name) => `“${name}”: cambiaron las reglas de su tabla`,
  toneChanged: (name) => `“${name}”: cambió su tono`,
};
