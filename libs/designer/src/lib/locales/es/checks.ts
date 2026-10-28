import type { DesignerWords } from '../../designer-words';
import { listOf } from '../speak';

const q = (name: string) => `“${name}”`;

/**
 * The designer's words in Spanish: what people would trip over, as Checks lists it before publishing, and each fix's
 * button. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const checks: DesignerWords['checks'] = {
  noQuestions: 'La encuesta todavía no tiene preguntas, así que no hay nada que responder.',
  noWords: (question, label) => `${question ? 'Una pregunta' : 'Un campo'} todavía no tiene texto: las personas leerían ${q(label)}.`,
  typeItsWords: 'Escribir su texto',
  defaultOptions: (label, options) => `${q(label)} todavía ofrece ${listOf('es', options, 'and')} como opciones.`,
  typeItsOptions: 'Escribir sus opciones',
  linkedPicture: 'Una imagen que es un enlace no tiene descripción: un lector de pantalla la leería como un enlace sin nombre.',
  picture: 'Una imagen no tiene descripción: a quienes no pueden verla no se les dice nada de ella.',
  describeIt: 'Describirla',
  emptyPage: (name) => `${q(name)} no tiene preguntas: las personas verían una página vacía.`,
  emptySection: (name) => `${q(name)} no tiene campos: se mostraría como un cuadro vacío.`,
  nothingOnPaper: 'Todos los elementos de esta página quedan fuera del papel: al imprimirla solo saldría su título.',
  printEveryPart: 'Imprimirlos todos',
  deletePage: 'Eliminar la página',
  deleteSection: 'Eliminar la sección',
  neverShows: (name, field, value) => `${q(name)} solo se muestra cuando ${field} es ${q(value)}, que ${field} ya no ofrece, así que nunca se muestra.`,
  neverHolds: (name, field, value) => `${q(name)}: la regla ${q(`${field} es ${value}`)} nunca se puede cumplir, porque ${field} ya no lo ofrece.`,
  removeTheRule: 'Quitar la regla',
  twoQuestions: (label) => `Dos preguntas dicen ${q(label)}: puede que las personas no las distingan.`,
  twoFields: (label) => `Dos campos dicen ${q(label)}: puede que las personas no los distingan.`,
  renameSecond: 'Cambiar el nombre del duplicado',
  // The page's own check speaks English: said here without its words, as Arabic's table and the refusals do.
  invalid: (path, _message) => (path ? `Esta parte de la página no es válida: ${path}` : 'La página contiene algo que no se ajusta a su formato.'),
  showBracesAsWritten: 'Mostrar las llaves tal como se escriben',
  // ---- rules
  readsGone: (name, sentence, gone) =>
    `${q(name)}: ${q(sentence)} lee ${listOf('es', gone, 'and')}, que ya no ${gone.length === 1 ? 'está' : 'están'} en la página.`,
  formulaBroken: (name, problem) => `${q(name)}: su fórmula ya no se puede leer — ${problem}.`,
  givesNothing: (name, sentence, problem) => `${q(name)}: en ${q(sentence)}, ${problem} — esa parte no da ningún valor.`,
  removeTheFormula: 'Quitar la fórmula',
  setBroken: (name, sentence, problem) => `${q(name)}: ${q(sentence)} ya no se puede leer — ${problem}.`,
  setCannotHold: (name, sentence, problem) => `${q(name)}: ${q(sentence)} asigna un valor que no puede contener — ${problem}.`,
  removeIt: 'Quitar',
  patternBroken: (name, pattern) => `${q(name)}: no se puede leer el patrón de la regla ${q(pattern)}.`,
  asksNothing: (name) => `${q(name)}: una regla no pide nada, así que no comprueba nada.`,
  checksNothing: (name, sentence, stored) => `${q(name)}: la regla ${q(sentence)} no comprueba nada, porque ${name} contiene ${stored}.`,
};
