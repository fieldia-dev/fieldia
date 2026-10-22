import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: the sheet of shortcuts — its groups, when each works, and the keys of the bar and
 * of typing (the canvas's, the outline's and the clipboard's are theirs). UNREVIEWED: machine-assisted, not yet
 * reviewed by a native speaker.
 */
export const shortcuts: DesignerWords['shortcuts'] = {
  title: 'Atajos de teclado',
  findKey: 'Buscar una tecla',
  findPlaceholder: 'Buscar una tecla o lo que hace',
  close: 'Cerrar',
  keys: 'Las teclas',
  none: 'Ninguna tecla hace eso.',
  groups: { Anywhere: 'En cualquier lugar', Canvas: 'Lienzo', Outline: 'Esquema', Typing: 'Al escribir' },
  when: {
    Anywhere: 'Fuera de un cuadro en el que se escribe',
    Canvas: 'En Avanzado, con un elemento seleccionado',
    Outline: 'Con una fila del esquema enfocada',
    Typing: 'En una etiqueta, un texto de ayuda o un título',
  },
  anywhere: [
    ['⌘K o /', 'Buscar cualquier cosa: un campo, un tipo, un ajuste, una acción'],
    ['⌘Z', 'Deshacer'],
    ['⌘⇧Z o ⌘Y', 'Rehacer'],
    ['?', 'Esta lista de atajos'],
    ['Esc', 'Deseleccionar lo seleccionado'],
  ],
  typing: [
    ['Enter', 'De una etiqueta a su texto de ayuda, y del texto de ayuda hacia fuera'],
    ['Esc', 'Salir del cuadro y deseleccionar el elemento'],
    ['⌘C / ⌘X / ⌘V', 'Copiar, cortar y pegar texto, como siempre'],
  ],
  surveyTyping: [
    ['⌘⇧Enter', 'Añadir una pregunta después de esta'],
    ['⌘⇧D', 'Copiar la pregunta'],
    ['⌘⇧K / ⌘⇧J', 'Subir o bajar la pregunta'],
  ],
};
