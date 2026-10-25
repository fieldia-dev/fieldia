import type { DesignerWords } from '../../designer-words';
import { intlFormat } from '@fieldia/core';

const q = (name: string) => `“${name}”`;
const DATE = intlFormat('DateTimeFormat', 'es-u-nu-latn', { dateStyle: 'medium' });

/**
 * The designer's words in Spanish: a saved form placed in another — the toolbox's tile and its menu, the frame on the
 * canvas, its panel, what the Checks list and the edits say of it. UNREVIEWED: machine-assisted, not yet reviewed by a
 * native speaker.
 */
export const savedForms: DesignerWords['savedForms'] = {
  savedForm: 'Formulario guardado',
  copy: (n) => (n === 1 ? 'Formulario guardado' : `Formulario guardado ${n}`),
  tile: 'Un formulario guardado',
  tileTip: 'Un formulario guardado: coloque uno de los formularios guardados de la aplicación, como una dirección',
  menuNote: (any) =>
    any
      ? 'Se coloca entero, con sus respuestas aparte; se cambia en su propia página.'
      : 'La aplicación todavía no tiene ningún formulario guardado que colocar: publique primero uno.',
  add: 'Añadir un formulario guardado',
  hint: 'formulario guardado',
  // ---- the frame on the canvas
  tag: (name, version) => `Formulario guardado ${q(name)} · ${version === undefined ? 'última versión' : `versión ${version}`}`,
  openIt: 'Abrirlo',
  openTitle: (name) => `Abrir ${q(name)} en su propia página para cambiarlo`,
  loading: (id) => `Cargando ${q(id)}…`,
  cannotShow: (name, why) => `${q(name)} no se puede mostrar: ${why}`,
  // ---- its panel
  version: 'Versión',
  title: 'Título',
  showTitle: 'Mostrar un título',
  answersGoUnder: 'Las respuestas se guardan en',
  latest: 'Última versión',
  versionOn: (version, publishedAt) => `Versión ${version} · ${DATE.format(new Date(publishedAt))}`,
  versionOnly: (version) => `Versión ${version}`,
  notFound: (id) => `${id} (no encontrado)`,
  openHint: 'Un formulario guardado se cambia en su propia página: todos los formularios que lo colocan siguen sus cambios, salvo los que se fijan a una versión.',
  versionHint: 'La última: cada versión publicada aparece aquí en cuanto se publica. Una versión fijada se mantiene tal como estaba.',
  titleHint: 'Su propio título, salvo que se escriba un texto aquí.',
  answersHint: 'Sus respuestas se guardan con este nombre, aparte de las de una segunda copia: { "home": { "street": … } }.',
  // ---- refused
  noForm: (id) => `No hay ningún formulario guardado ${q(id)} en esta página`,
  pickForm: 'Seleccione el formulario guardado que desea colocar',
  versionWhole: 'Una versión es un número entero a partir de 1',
  answersName: (hint) => `El lugar de sus respuestas es un nombre de letras, dígitos y _ que empieza por una letra: ${q(hint)}, por ejemplo`,
  insideItself: 'Una página no se puede colocar dentro de sí misma',
  way: (titles) => titles.join(' → '),
  holdsThisPage: (name, way) => `${q(name)} contiene esta página: quedaría colocada dentro de sí misma (${way})`,
  // ---- Checks
  mixWithField: (name) =>
    `Un formulario guardado conserva sus respuestas en ${q(name)}, el nombre de un campo: sus respuestas se mezclarían. Dele un nombre propio.`,
  mixWithCopy: (name) => `Dos formularios guardados conservan sus respuestas en ${q(name)}: sus respuestas se mezclarían. Dé a cada copia un nombre propio.`,
  placedInItself: 'Esta página está colocada dentro de sí misma: el formulario no puede mostrarla.',
  cannotBeFound: (id) => `No se encuentra el formulario guardado ${q(id)}: el formulario lo indicaría en su lugar.`,
  noVersion: (title, version) => `${q(title)} no tiene una versión ${version}: el formulario indicaría que no se encuentra.`,
  notSections: (title) => `${q(title)} no es un formulario de secciones o pestañas: no se puede colocar en otro.`,
  holdsThisPageCheck: (name, way) => `${q(name)} contiene esta página: quedaría colocada dentro de sí misma (${way}).`,
  takeItOff: 'Quitarlo de la página',
};
