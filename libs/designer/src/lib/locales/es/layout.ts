import type { DesignerWords } from '../../designer-words';

const PARTS_IN: Record<number, string> = { 2: 'mitades', 3: 'tercios', 4: 'cuartos' };
/** A part by what it is, as the refusals name it: each one singular, so the verb after it agrees. */
const NOUNS: Record<string, string> = {
  field: 'Un campo',
  section: 'Un grupo',
  tabs: 'Un grupo de pestañas',
  tab: 'Una pestaña',
  text: 'Un texto',
  button: 'Un botón',
  spacer: 'Un espaciador',
  divider: 'Un separador',
  image: 'Una imagen',
  slot: 'El elemento propio de la aplicación',
};

/**
 * The designer's words in Spanish: the layout's edits in words — where a drop puts a part, as the drag chip says it
 * ("entre “Cliente” y “Fecha de visita” — la fila dividida en tercios"), why a layout edit is refused, and a row's
 * fractions. A name in one is quoted already; one in a refusal is quoted here. UNREVIEWED: machine-assisted, not yet
 * reviewed by a native speaker.
 */
export const layout: DesignerWords['layout'] = {
  // ---- where a drop goes
  columnInside: (group, after) => `columna nueva dentro de “${group}”, ${after ? 'después de' : 'antes de'} todas sus filas — dividida en mitades`,
  intoThePage: 'en la página',
  into: (name) => `dentro de “${name}”`,
  before: (name) => `antes de “${name}”`,
  atEndOf: (name) => `al final de “${name}”`,
  newRowAbove: (name) => `fila nueva de ancho completo encima de “${name}”`,
  newRowAtEnd: (name) => `fila nueva de ancho completo al final de “${name}”`,
  beside: (name, whole) => `${whole ? 'columna nueva ' : ''}junto a ${name}`,
  under: (name, whole) => `${whole ? 'fila nueva ' : ''}debajo de ${name}`,
  above: (name, whole) => `${whole ? 'fila nueva ' : ''}encima de ${name}`,
  inRoomLeft: (name) => `junto a ${name}, en el espacio que queda`,
  between: (a, b) => `entre ${a} y ${b}`,
  atRowEnd: (name) => `al final de la fila, después de ${name}`,
  atRowStart: (name) => `al principio de la fila, antes de ${name}`,
  divided: (where, parts) => `${where} — la fila dividida en ${PARTS_IN[parts] ?? parts}`,
  // ---- why a drop or a layout edit cannot be made
  noPart: (id) => `No hay ningún elemento “${id}”`,
  tabMoves: 'Una pestaña solo se mueve entre sus pestañas',
  notInsideItself: 'Un elemento no puede ir dentro de sí mismo',
  columnInGroup: 'Una columna nueva va dentro de un grupo',
  putInATab: 'Póngalo en una de las pestañas',
  holdsNoParts: (name) => `“${name}” no contiene elementos`,
  notBesideItself: 'Un elemento no puede ir junto a sí mismo ni debajo de sí mismo',
  rowHoldsFour: 'Una fila admite cuatro elementos',
  noKindOfPart: (kind) => `No hay ningún tipo de elemento “${kind}”`,
  sameGroup: 'Seleccione elementos que estén en el mismo grupo',
  twoOrMore: 'Seleccione dos o más para ponerlos lado a lado',
  onlyUngroup: 'Solo se puede desagrupar un grupo o un grupo de pestañas',
  tabAlone: 'Una pestaña no se puede duplicar sola: duplique las pestañas o lo que contiene',
  noGroupOrTab: (id) => `No hay ningún grupo ni pestaña “${id}”`,
  groupColumns: 'Un grupo tiene de una a cuatro columnas, o doceavos',
  smallerScreens: 'Una tableta o un teléfono no muestra más columnas que un escritorio',
  phoneScreen: 'Un teléfono no muestra más columnas que una tableta',
  tabWidth: 'Una pestaña es tan ancha como sus pestañas',
  nouns: { ...NOUNS },
  it: 'Este elemento',
  runsAcross: (type) => `${NOUNS[type] ?? `“${type}”`} ocupa toda la fila`,
  noWiderThanRow: (noun) => `${noun} no puede superar el ancho de su fila`,
  noWiderThanSection: (noun, columns) => `${noun} no puede superar el ancho de las ${columns} columnas de su sección`,
  aloneInRow: 'Al estar solo en su fila, la ocupa entera: permita huecos en las filas del grupo para hacerlo más estrecho',
  restNeedsRoom: 'El resto de su fila necesita espacio junto a él',
  labelWidth: 'Las etiquetas colocadas al lado miden de 60 a 320 px de ancho',
  noGroup: (id) => `No hay ningún grupo “${id}”`,
  onlyGroupRows: 'Solo un grupo mantiene sus filas completas o con huecos',
  noField: (id) => `No hay ningún campo “${id}”`,
  colour: 'Un color se escribe #rrggbb, como #1f7a4d',
  wordsNotLabel: 'Un texto tiene contenido, no una etiqueta',
  lineHoldsParts: 'Una línea contiene campos, textos y botones: saque primero de ella los grupos y las pestañas',
  onlyAlertColour: 'Solo el texto dentro del cuadro de una alerta tiene color',
  buttonNotText: 'Un botón tiene una etiqueta, no un texto',
  pictureWords: 'Una imagen tiene una dirección y una descripción',
  pictureAddress: 'Una imagen necesita su dirección',
  onlyBlocks: 'Aquí solo se cambian textos, botones o imágenes',
  pictureWidth: 'El ancho de una imagen es de 16 a 4000 píxeles',
  link: 'Un enlace es una dirección web, https://…, o una dirección de correo, mailto:…',
  pickFirst: 'Seleccione primero los elementos que desea cambiar',
  notAnswered: (noun) => `${noun} no se responde: solo los campos son obligatorios`,
  noLabels: (noun) => `${noun} no tiene etiquetas que colocar`,
  foldsByTitle: 'Un grupo se pliega desde su título: póngale primero un título',
  onlyGroupFolds: 'Solo un grupo se puede plegar',
  rowParts: {
    whole: { words: 'Entera', label: 'Toda la fila', name: 'Toda la fila' },
    threeQuarters: { words: '¾', label: '¾ de la fila', name: 'Tres cuartos' },
    twoThirds: { words: '⅔', label: '⅔ de la fila', name: 'Dos tercios' },
    half: { words: '½', label: '½ de la fila', name: 'Mitad' },
    third: { words: '⅓', label: '⅓ de la fila', name: 'Un tercio' },
    quarter: { words: '¼', label: '¼ de la fila', name: 'Un cuarto' },
  },
};
