import type { DesignerWords } from '../../designer-words';

const q = (name: string) => `“${name}”`;

/**
 * The designer's words in Spanish: looks to start from, and looks of one's own — saving, renaming, removing, and what
 * failed. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const looks: DesignerWords['looks'] = {
  /** Each a look's name ("apariencia", feminine). */
  presets: { fieldia: 'Fieldia', calm: 'Serena', compact: 'Compacta', rounded: 'Redondeada', night: 'Nocturna' },
  sample: 'Aa',
  needsName: 'Una apariencia necesita un nombre',
  tooLong: (most) => `Un nombre tiene como máximo ${most} caracteres`,
  taken: (name) => `Ya hay una apariencia llamada ${q(name)}`,
  yourLooks: 'Sus apariencias',
  saveThisLook: 'Guardar esta apariencia…',
  cancel: 'Cancelar',
  undo: 'Deshacer',
  tryAgain: 'Intentar de nuevo',
  lookPresets: 'Apariencias predefinidas',
  startFrom: 'Empezar a partir de',
  presetsHint:
    'Define a la vez el color de acento, la fuente, el espaciado, las esquinas y los colores. Cada uno sigue siendo suyo para cambiarlo, y puede guardar una apariencia propia para volver a usarla.',
  failed: (what, reason) => (reason ? `${what}: ${reason}` : `${what}. Inténtelo de nuevo en un momento.`),
  renameOrRemoveNamed: (name) => `Cambiar el nombre de ${q(name)} o quitarla`,
  renameOrRemove: 'Cambiar nombre o quitar',
  rename: 'Cambiar nombre…',
  remove: 'Quitar',
  newNameFor: (name) => `Nombre nuevo para ${q(name)}`,
  nameThisLook: 'Asigne un nombre a esta apariencia',
  renameButton: 'Cambiar nombre',
  save: 'Guardar',
  couldNotRename: (name) => `No se pudo cambiar el nombre de ${q(name)}`,
  couldNotSave: (name) => `No se pudo guardar ${q(name)}`,
  couldNotRemove: (name) => `No se pudo quitar ${q(name)}`,
  removed: (name) => `Se quitó ${q(name)}.`,
  couldNotBringBack: (name) => `No se pudo recuperar ${q(name)}`,
  yourOwn: 'Propia',
  asTheSkin: 'Según el estilo base',
  couldNotLoad: 'No se pudieron cargar sus apariencias',
};
