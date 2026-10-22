import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

const elements = (n: number) => plural('es', n, { one: '# elemento', other: '# elementos' });
/** What is moved when its row has no name: capitalised alone, small inside a sentence. */
const IT = 'El elemento';
/** The end of a page or a group a part stands at, after "al": "al principio", "al final". */
const END = { top: 'principio', bottom: 'final' } as const;

/**
 * The designer's words in Spanish: the outline — the page's parts as a tree, each row named with its kind, and what
 * moving rows by drag or by key says. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const outline: DesignerWords['outline'] = {
  label: 'Esquema',
  tree: 'Los elementos de la página',
  empty: 'Todavía no hay nada en la página.',
  help: (survey) =>
    `${survey ? 'Las páginas y sus preguntas. Arrastre una fila para moverla.' : 'Arrastre una fila para moverla; suéltela en el centro de un grupo para meterla en él.'} {⇧} + clic selecciona varias; {Alt} con una flecha mueve lo seleccionado; {?} muestra todas las teclas.`,
  // ---- a row, as it is drawn and read aloud
  ruled: (survey) => (survey ? 'se muestra solo para algunas respuestas' : 'se muestra solo para algunos registros'),
  ruledTitle: (survey) => (survey ? 'Se muestra solo para algunas respuestas' : 'Se muestra solo para algunos registros'),
  required: 'obligatorio',
  requiredTitle: 'Obligatorio',
  rowWords: (parts) => parts.join(', '),
  kinds: {
    custom: 'Personalizado',
    sideBySide: 'Lado a lado',
    group: 'Grupo',
    tabs: 'Pestañas',
    tabCount: (n) => plural('es', n, { one: '# pestaña', other: '# pestañas' }),
    tab: 'Pestaña',
    untitledTab: 'Pestaña sin título',
    page: 'Página',
    untitledPage: 'Página sin título',
    column: 'Columna',
    statusSteps: 'Pasos de estado',
    status: 'Estado',
    button: 'Botón',
    counter: 'Contador',
    badge: 'Insignia',
    heading: 'Encabezado',
    note: 'Nota',
    words: 'Texto',
    divider: 'Línea',
    spacer: 'Espacio',
    image: 'Imagen',
    map: 'Mapa',
    related: 'Lista relacionada',
    slot: 'Elemento de la aplicación',
    form: 'Formulario guardado',
    part: 'Elemento',
  },
  columnsStacked: (n) => `${n} columnas, apiladas en pantallas más pequeñas según el estilo base`,
  columnsAt: (desktop, tablet, phone) => {
    const at = (count: number | undefined, screen: string) => (count === undefined ? `${screen} según las apile el estilo base` : `${screen} ${count}`);
    return `Columnas: ${at(desktop, 'escritorio')}, ${at(tablet, 'tableta')}, ${at(phone, 'teléfono')}`;
  },
  // ---- moving rows
  it: IT,
  part: 'Elemento',
  parts: elements,
  tookOff: (what) =>
    typeof what === 'number'
      ? plural('es', what, { one: 'Se quitó # elemento de la página', other: 'Se quitaron # elementos de la página' })
      : `Se quitó ${what === IT ? 'el elemento' : what} de la página`,
  notTakenOff: 'No se quitó',
  notMoved: 'No se movió',
  notHere: 'Aquí no',
  stays: (one) => (one ? 'donde está' : 'donde están'),
  before: (name) => `antes de ${name}`,
  after: (name) => `después de ${name}`,
  into: (into, before) => `${into === null ? 'en la página' : `dentro de ${into}`}, ${before === null ? 'al final' : `antes de ${before}`}`,
  // ---- refused
  pickToMove: 'Seleccione un elemento para moverlo',
  tabNotInTab: 'Una pestaña contiene elementos, no otras pestañas',
  tabAmongItsTabs: 'Una pestaña solo se mueve entre sus pestañas',
  tabAmongTabs: 'Una pestaña va entre pestañas: seleccione la pestaña tras la que desea pegarla',
  inOneOfTheTabs: 'Póngalo en una de las pestañas',
  pageNotInPage: 'Una página contiene preguntas, no otras páginas',
  questionOnPage: 'Una pregunta va en una página',
  notInsideItself: 'Un elemento no puede ir dentro de sí mismo',
  holdsNoParts: (name) => `${name} no contiene elementos`,
  // ---- what Alt and an arrow cannot do
  sameGroup: 'Seleccione elementos del mismo grupo para moverlos juntos',
  atEdgeOfPage: (one, end) => `${one ? 'Ya está' : 'Ya están'} al ${END[end]} de la página`,
  atEdgeOfSurvey: (one, end) => `${one ? 'Ya está' : 'Ya están'} ${end === 'bottom' ? 'al final de la última' : 'al principio de la primera'} página`,
  atEdgeOf: (one, end, name, arrow) => `${one ? 'Ya está' : 'Ya están'} al ${END[end]} de ${name}: Alt+${arrow} ${one ? 'lo saca' : 'los saca'}`,
  onPageItself: (one) => `${one ? 'Está' : 'Están'} en la propia página, fuera de cualquier grupo`,
  noGroupBefore: (one) => (one ? 'No hay ningún grupo antes de él en el que ponerlo' : 'No hay ningún grupo antes de ellos en el que ponerlos'),
  keys: [
    ['↑ / ↓', 'Ir a la fila anterior o siguiente'],
    ['← / →', 'Contraer o expandir una fila, o ir a la fila que la contiene o a su primer elemento'],
    ['Inicio / Fin', 'Ir a la primera o a la última fila'],
    ['Una letra', 'Ir a la siguiente fila cuyo nombre empiece por ella'],
    ['Enter', 'Seleccionarla y mostrarla en la página'],
    ['Espacio', 'Seleccionarla (con ⌘ o Ctrl se añade a lo seleccionado)'],
    ['Mayús+↑ / ↓', 'Seleccionar también las filas intermedias'],
    ['Mayús + clic', 'Seleccionar todas las filas desde la seleccionada hasta esta'],
    ['⌘ + clic', 'Añadir una fila a la selección o quitarla de ella (Ctrl + clic en Windows)'],
    ['Alt+↑ / Alt+↓', 'Mover lo seleccionado antes de la fila de arriba o después de la de abajo'],
    ['Alt+← / Alt+→', 'Sacar lo seleccionado de su grupo o ponerlo en el grupo anterior'],
    ['Supr', 'Quitar lo seleccionado de la página'],
  ],
};

/** Copying, cutting and pasting parts, and what each says it did. */
export const clipboard: DesignerWords['clipboard'] = {
  keys: [
    ['⌘C', 'Copiar lo seleccionado, para pegarlo aquí o en otro diseñador'],
    ['⌘X', 'Cortar lo seleccionado'],
    ['⌘V', 'Pegar después de lo seleccionado, o dentro del grupo seleccionado'],
  ],
  part: 'elemento',
  parts: elements,
  copied: (what) => `Copiado: ${what}`,
  cut: (what) => `Cortado: ${what}`,
  copiedNotCut: 'Copiado, pero no se quitó de la página',
  nothingPasted: 'No se pegó nada',
  pasted: (what, dropped) =>
    `Pegado: ${what}${dropped ? `; ${plural('es', dropped, { one: 'se omitió # regla: lee un campo que esta página no tiene', other: 'se omitieron # reglas: leen un campo que esta página no tiene' })}` : ''}`,
  // ---- refused
  nothingToPaste: 'No hay elementos de Fieldia para pegar: primero copie elementos en un diseñador de Fieldia',
  listTakesColumns: 'Una lista admite columnas, no elementos: péguelos en una pantalla o en una encuesta',
  pagesOrQuestions: 'Pegue páginas o preguntas, no ambas a la vez',
  surveyPages: 'Las páginas de una encuesta van en una encuesta',
};
