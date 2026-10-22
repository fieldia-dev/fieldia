import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Spanish: the page as JSON — its view, the state of the text, what each problem is, and the
 * mistakes a person makes typing JSON. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const json: DesignerWords['json'] = {
  pageAsJson: 'La página en JSON',
  copyJson: 'Copiar JSON',
  apply: 'Aplicar',
  discard: 'Descartar',
  keepEditing: 'Seguir editando',
  notApplied: 'Los cambios escritos aquí aún no se han aplicado.',
  problems: 'Problemas',
  hint: (chord) => `Tab aplica sangría. Para salir del cuadro, presione Esc y luego Tab. ${chord}Enter aplica los cambios.`,
  severity: { error: 'No se puede aplicar', must: 'Hay que corregir', should: 'Conviene corregir' },
  goToLine: (line, column) => `Ir a la línea ${line}, columna ${column}`,
  line: (line) => `Línea ${line}`,
  toPutRight: (n) => `${plural('es', n, { one: '# problema', other: '# problemas' })} por corregir antes de poder aplicar.`,
  changed: (chord) => `Cambiado aquí, aún sin aplicar: presione “Aplicar” o ${chord}Enter.`,
  nothingToApply: 'No hay nada que aplicar: el texto es la página tal como está.',
  cannotFix: 'Esa corrección no se puede hacer en el texto tal como está.',
  fixed: 'Corregido en el texto. Aplíquelo para conservarlo.',
  applied: 'Aplicado. Deshacer lo revierte.',
  copied: 'Copiado.',
  selected: (chord) => `Seleccionado: presione ${chord}C para copiar.`,
  // The format's own words (from @fieldia/core) are English and technical, as its keys are: kept as written, said so.
  formatProblem: (message) => `El formato de la página no lo admite: ${message}`,
  editAsJson: 'Editar la página en JSON',
  backToDesigning: 'Volver al diseño',
  mistakes: {
    anyValue: 'Esto no es un valor que JSON reconozca: texto entre comillas dobles, un número, true, false, null, [ … ] o { … }',
    endsTooSoon: (wanted) => `El texto termina antes de tiempo: ${wanted}`,
    valueMissing: 'falta un valor',
    closingMissing: (close) => `falta un ${close} de cierre`,
    noComments: 'JSON no admite comentarios',
    doubleQuotes: 'El texto va entre comillas dobles',
    noClosingQuote: 'A este texto le falta la comilla doble de cierre',
    lineBreak: 'Un salto de línea no puede ir dentro del texto: escriba \\n',
    controlCharacter: 'Un carácter de control no puede ir dentro del texto',
    escape: (escape) => `"\\${escape}" no es algo que JSON reconozca: escriba \\\\ para una barra invertida`,
    extraZeros: 'Un número no puede empezar con ceros de más',
    nothingAfterComma: 'No hay nada después de esta coma: quítela',
    commaMissing: 'Falta una coma antes de esto',
    commaOrClosing: (close) => `Aquí falta una coma o un ${close} de cierre`,
    keyQuotes: (word) => `Una clave va entre comillas dobles, como "${word}"`,
    colonMissing: 'Faltan los dos puntos después de la clave',
    empty: 'El cuadro está vacío: una página es un objeto JSON, { … }',
    moreAfterEnd: 'Hay más texto después del final: un solo { … } es toda la página',
  },
};
