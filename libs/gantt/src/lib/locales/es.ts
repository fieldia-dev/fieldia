import type { GanttLabels } from '../labels';

/**
 * The Gantt timeline's words in Spanish. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 * The timeline is "cronograma", as everywhere in Fieldia's Spanish.
 */
export const es: GanttLabels = {
  timeline: 'Cronograma',
  today: 'Hoy',
  zooms: { day: 'Días', week: 'Semanas', month: 'Meses' },
  showAs: 'Mostrar el cronograma por',
  noGroup: 'Sin grupo',
  collapse: 'Ocultar {name}',
  expand: 'Mostrar {name}',
  holds: '{n} registros',
  holdsOne: '1 registro',
  holdsNoun: '{n} {records}',
  holdsNounOne: '1 {record}',
  loadFailed: 'No se pudo cargar el cronograma.',
  retry: 'Intentar de nuevo',
  nothing: 'No hay nada que mostrar en el cronograma.',
  tooMany: 'Se muestran los primeros {shown} de {total}: acote la búsqueda para verlos todos.',
  notPlanned: 'Aún sin fecha de inicio',
  fromTo: 'del {from} al {to}',
  on: 'el {day}',
  days: '{n} días',
  dayOne: '1 día',
  waitsFor: 'espera a {names}',
  late: 'empieza antes de que termine {name}',
  keysOpen: 'Enter lo abre.',
  keysMove: 'Las teclas de flecha izquierda y derecha lo mueven un día; con Mayús, su final.',
  keysRows: 'Las teclas de flecha arriba y abajo pasan a la barra de arriba o de abajo.',
  moved: 'Se movió {name}: del {from} al {to}.',
  stretched: '{name} ahora termina el {when}.',
  started: '{name} ahora empieza el {when}.',
  undo: 'Deshacer',
  undone: 'Se ha restablecido como estaba.',
  close: 'Cerrar',
  notMoved: 'No se movió: {why}',
  cannotMove: 'No puede modificar este registro.',
};
