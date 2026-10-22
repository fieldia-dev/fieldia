import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Spanish: a form's endings — what people see once they send it, the first whose condition
 * holds — and the button beside a box of words that puts an answer in them (`{name}`). UNREVIEWED: machine-assisted,
 * not yet reviewed by a native speaker.
 */
export const endings: DesignerWords['endings'] = {
  heading: 'Después del envío',
  hint: 'Lo que ven las personas una vez que envían sus respuestas: el primer final cuya condición se cumpla o, si no, el que se muestra en los demás casos. {name} muestra una respuesta tal como la leen las personas; {id}, la referencia que su aplicación da a la respuesta.',
  ending: (n) => `Final ${n}`,
  otherwise: 'Se muestra en los demás casos',
  lead: 'Se muestra',
  conditionFor: (n) => `Cuándo se muestra el final ${n}`,
  title: 'Título',
  titleFor: (n) => `Título del final ${n}`,
  text: 'Texto',
  textFor: (n) => `Texto del final ${n}`,
  textHint: 'Cada línea aparte es un párrafo; [texto](https://…) es un enlace.',
  again: 'Botón para empezar de nuevo',
  againFor: (n) => `Botón del final ${n}`,
  againHint: 'Vacío: “Enviar otra respuesta”.',
  noAgain: 'Sin botón',
  noAgainFor: (n) => `Sin botón en el final ${n}`,
  add: 'Añadir un final',
  addNeedsQuestion: 'Otro final necesita una pregunta con la que elegirlo: una de opciones, o una de sí o no.',
  remove: (n) => `Quitar el final ${n}`,
  moveUp: (n) => `Subir el final ${n}`,
  moveDown: (n) => `Bajar el final ${n}`,
  newTitle: 'Gracias',
  plainThanks: 'Sin ninguno, las personas ven “Gracias. Sus respuestas se han enviado.”',
  forResponses: 'Los finales son para un formulario que recoge respuestas: la pantalla de un registro se queda en su registro después de guardar',
  changed: (n) =>
    n ? `Cambió lo que se muestra después del envío: ${plural('es', n, { one: '# final', other: '# finales' })}` : 'Después del envío, muestra el agradecimiento simple',
  // The button that puts an answer in words.
  insertAnswer: 'Insertar una respuesta',
  insertAnswerIn: (box) => `Insertar una respuesta en: ${box}`,
  answersTitle: 'Insertar la respuesta a',
  reference: 'La referencia que le da su aplicación',
  noAnswers: 'Todavía ninguna pregunta da una respuesta que insertar.',
  whenEmpty: 'Si está vacía',
  whenEmptyHint: 'Opcional: el texto mientras no tenga respuesta, “esta rama”',
};
