import type { DesignerWords } from '../../designer-words';

/** The choices, as each setting takes them: corners ("las esquinas", feminine plural) and a text size ("el tamaño"). */
const VALUES: Record<string, string> = { square: 'Rectas', soft: 'Suaves', round: 'Redondeadas', small: 'Pequeño', large: 'Grande' };

/**
 * The designer's words in Spanish: each kind of part's look, on the Look tab — the kinds as people think of them, each
 * setting by what it draws on that kind (a table's background is its heading row, a button's accent its colour) and
 * what is said of them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const partLooks: DesignerWords['partLooks'] = {
  setting: 'Cada tipo de elemento',
  hint: 'Cada uno por encima de la apariencia de la página. Un color sobre el que costaría leer el texto se dibuja más claro o más oscuro, solo lo necesario.',
  kindOfPart: 'Tipo de elemento',
  kinds: { inputs: 'Cuadros de texto', choices: 'Opciones', groups: 'Grupos', buttons: 'Botones', tables: 'Tablas' },
  hints: {
    inputs: 'Cuadros de texto, número y fecha, y listas desplegables. El color de acento es el borde del cuadro en el que se escribe y el día seleccionado.',
    choices: 'Los círculos y las marcas de verificación toman el color de acento; los puntos de una escala, Sí y No, las imágenes y las líneas de una clasificación toman el resto.',
    groups: 'Secciones y tarjetas. Con el estilo base Subrayado, un grupo con fondo o borde se dibuja como una tarjeta.',
    buttons: 'Enviar, Siguiente, Guardar, Añadir otra entrada.',
    tables: 'Tablas de líneas y la cuadrícula de preguntas de una matriz.',
  },
  settings: { background: 'Fondo', border: 'Borde', corners: 'Esquinas', textSize: 'Tamaño del texto', accent: 'Color de acento' },
  own: { buttons: { accent: 'Color' }, tables: { background: 'Fila de encabezado', border: 'Líneas' } },
  values: VALUES,
  named: (kind, setting) => `${kind}: ${setting.toLowerCase()}`,
  asThePage: 'Como la página',
  namedAsThePage: (named) => `${named}, como la página`,
  ownLook: (kind) => `${kind}: apariencia propia`,
  pageLook: (kind) => `${kind}: como la página`,
  said: (value) => (value === undefined ? 'como la página' : (VALUES[value]?.toLowerCase() ?? value)),
  change: (kind, setting, was, now) => `${kind}, ${setting.toLowerCase()}: ${was} → ${now}`,
  // ---- refused
  noKind: (kind) => `No hay ningún tipo de elemento “${kind}”`,
  noSetting: (kind, setting) => `${kind}: no tienen un ajuste propio de ${setting.toLowerCase()}`,
  corners: 'Las esquinas son rectas, suaves o redondeadas',
  textSize: 'El texto es pequeño o grande',
  colour: 'Un color se escribe #rrggbb, como #1f7a4d',
};
