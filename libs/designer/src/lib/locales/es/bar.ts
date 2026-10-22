import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Spanish: the bar over both editors — the title, where the page stands, Undo, Checks,
 * Publish and its versions, Find anything, Simple and Advanced. UNREVIEWED: machine-assisted, not yet reviewed by a
 * native speaker.
 */
export const bar: DesignerWords['bar'] = {
  screenTitle: 'Título de la pantalla',
  untitledScreen: 'Pantalla sin título',
  formTitle: 'Título del formulario',
  untitledForm: 'Formulario sin título',
  versions: 'Versiones',
  undo: 'Deshacer',
  redo: 'Rehacer',
  publish: 'Publicar',
  showChecks: 'Mostrar las comprobaciones',
  publishHint: (version) => `versión ${version}`,
  openEarlier: 'Abrir una versión anterior',
  versionsHint: 'versiones',
  findAnything: 'Buscar cualquier cosa',
  findTitle: (keys) => `Buscar cualquier cosa · ${keys} o /`,
  // ---- where the page stands
  draft: 'Borrador, aún sin publicar',
  unpublished: 'Cambios aún sin publicar',
  published: (version) => `Publicado · versión ${version}`,
  // ---- the versions published
  version: (version, live, when) => `Versión ${version} · ${live ? 'activa · ' : ''}${when}`,
  versionsNote: 'Al seleccionar una, se convierte en el borrador; Deshacer recupera lo que había. Nada cambia para las personas hasta que se publique.',
  noVersions: 'Todavía no se ha publicado nada: al publicar se crea la versión 1.',
  // ---- Checks
  checks: 'Comprobaciones',
  mustFix: 'Hay que corregir',
  shouldFix: 'Conviene corregir',
  startHere: 'Empiece aquí',
  checksDialog: 'Comprobaciones antes de publicar',
  toLookAt: (n) => plural('es', n, { one: '# punto que revisar antes de publicar', other: '# puntos que revisar antes de publicar' }),
  allClear: 'Todo en orden',
  nothingToFix: 'Nada de lo que hay aquí impediría avanzar a nadie ni se leería mal.',
  checksCount: (n) => `Comprobaciones: ${plural('es', n, { one: '# punto que revisar', other: '# puntos que revisar' })}`,
  checksClear: 'Comprobaciones: todo en orden',
  // ---- Publish
  andMore: (n) => `y ${n} más`,
  mustFixFirst: 'Primero hay que corregir',
  keepEditing: 'Seguir editando',
  publishVersion: (version) => `Publicar la versión ${version}`,
  publishFailed: 'No se pudo publicar.',
  close: 'Cerrar',
  publishQuestion: (version) => `¿Publicar la versión ${version}?`,
  changesSince: (n, version) => `${plural('es', n, { one: '# cambio', other: '# cambios' })} desde la versión ${version}:`,
  firstVersion: 'Lo que recibirán las personas:',
  keepTheirs: (version) =>
    `Quienes ya lo hayan empezado conservan la versión con la que empezaron. La versión ${version} sigue a un clic, bajo el estado.`,
  keepTheirsFirst: 'Quienes ya lo hayan empezado conservan la versión con la que empezaron; las versiones posteriores nunca se la cambian.',
  // ---- Find anything
  findPlaceholder: 'Buscar un campo, un tipo, un ajuste, una acción…',
  found: 'Resultados',
  nothingFound: 'Nada con ese nombre.',
  settingChoice: (setting, choice) => `${setting}: ${choice.toLowerCase()}`,
  settingHint: (kind, tab) => `${kind} · ${tab}`,
  setting: 'ajuste',
  // ---- Simple and Advanced
  editingMode: 'Modo de edición',
  simple: 'Sencillo',
  advanced: 'Avanzado',
  simpleTitle: 'Sencillo: seleccione un elemento y edítelo donde está',
  advancedTitle: 'Avanzado: suelte elementos junto a otros, debajo o entre ellos, defina anchos y seleccione varios',
  more: 'Más',
  moreTitle: 'Estado, Buscar cualquier cosa, Deshacer, las vistas, Apariencia y Comprobaciones',
};
