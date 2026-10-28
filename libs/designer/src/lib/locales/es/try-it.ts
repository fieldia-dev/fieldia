import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Spanish: Try it — the page working as people will use it, its bar, Find anything's ways in,
 * and the drawer of data and problems under it. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const tryIt: DesignerWords['tryIt'] = {
  design: 'Diseñar',
  tryIt: 'Probar',
  modes: 'Diseñar o probar la página',
  tryThePage: 'Probar la página',
  width: 'Ancho',
  sizes: { desktop: 'Escritorio', tablet: 'Tableta', phone: 'Teléfono' },
  note: 'La página funciona tal como la usarán las personas. Nada de lo que se escriba aquí se guarda.',
  lastPassed: (why) => `Probar muestra la página como era antes de tu último cambio, que la página no admite: ${why}`,
  language: 'Idioma',
  wordsIn: 'Textos en',
  // ---- Find anything
  backToDesigning: 'Volver al diseño',
  asPeopleWillUseIt: 'tal como la usarán las personas',
  atPhoneWidth: 'Probar con el ancho de un teléfono',
  inArabic: 'Probar en árabe, de derecha a izquierda',
  // ---- the drawer
  drawer: 'Datos y problemas',
  data: 'Datos',
  problems: 'Problemas',
  toAnswer: '{n} por responder',
  copyData: 'Copiar los datos',
  answersAsJson: 'Las respuestas en JSON',
  nothingInTheWay: 'Nada impide enviar esto.',
  show: 'Mostrar',
  hide: 'Ocultar',
  copied: 'Copiado.',
  selected: 'Seleccionado: cópielo con el teclado.',
};
