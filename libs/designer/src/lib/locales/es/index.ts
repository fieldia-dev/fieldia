import type { DesignerWords } from '../../designer-words';
import { bar } from './bar';
import { kinds } from './kinds';
import { defaults } from './defaults';
import { toolbox } from './toolbox';
import { options } from './options';
import { refusals } from './refusals';
import { rules } from './rules';
import { parts } from './parts';
import { rulesUi } from './rules-ui';
import { languages } from './languages';
import { changes } from './changes';
import { settingsChanges } from './settings-changes';
import { checks } from './checks';
import { questions } from './questions';
import { layout } from './layout';
import { canvas } from './canvas';
import { panel } from './panel';
import { looks } from './looks';
import { outline, clipboard } from './outline';
import { list } from './list';
import { tryIt } from './try-it';
import { json } from './json';
import { translations } from './translations';
import { shortcuts } from './shortcuts';
import { templates, assistant } from './templates';
import { partLooks } from './part-looks';
import { savedForms } from './saved-forms';
import { steps } from './steps';
import { tables } from './tables';
import { mapPart } from './map-part';
import { relatedPart } from './related-part';
import { head } from './head';
import { workText } from './work-text';
import { inputs } from './inputs';
import { endings } from './endings';

/**
 * The designer's words in Spanish. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 *
 * Neutral international Spanish, formal "usted"; sentences written so no article or adjective must agree with a name
 * they cannot see; numbers in Latin digits.
 *
 * Glossary — one word for one thing, across the whole designer and Fieldia's Spanish tables:
 *   form formulario · screen pantalla · page página · section sección · group grupo · tab pestaña · row fila
 *   a table's line línea · column columna · part elemento · field campo · question pregunta · option opción
 *   answer respuesta · kind tipo · label etiqueta · tags (the kind) tags · help texto de ayuda · placeholder texto de
 *   ejemplo · title título · heading encabezado · a record's head cabecera · description descripción · words (a part,
 *   a page's text) texto / textos · required obligatorio · read-only solo lectura · hidden oculto · rule regla
 *   condition condición · formula fórmula · worked out calculado · publish publicar · version versión · draft borrador
 *   Checks Comprobaciones · bot check verificación contra bots · undo deshacer · redo rehacer · Simple / Advanced
 *   Sencillo / Avanzado · toolbox herramientas · outline esquema · schema (JSON Schema, OpenAPI) definición de datos
 *   panel panel · a setting ajuste · settings (all of them) configuración · look apariencia · theme tema · skin estilo
 *   base · quiet discreto · layout disposición · fold plegar / plegable · template plantilla · assistant asistente
 *   translation traducción · language idioma · add añadir · pick / choose seleccionar · fill in completar · model
 *   modelo de datos · data source fuente de datos · record registro · list lista · a list's saved view vista · survey
 *   encuesta · canvas lienzo · link (to records) enlace · badge insignia · ribbon cinta · pill píldora · places (of an
 *   option) plazas · range rango · fence geocerca · pin marcador · try it Probar
 *   Keys as a Spanish keyboard names them: Enter, Esc, Tab, Mayús, Supr, Retroceso, Inicio / Fin, teclas de flecha;
 *   a key typed as text ("Shift+G") stays as written.
 */
export const es: DesignerWords = { bar, kinds, defaults, toolbox, options, refusals, rules, parts, rulesUi, languages, changes, settingsChanges, checks, questions, layout, canvas, panel, looks, outline, clipboard, list, tryIt, json, translations, shortcuts, templates, assistant, partLooks, savedForms, steps, tables, mapPart, relatedPart, head, workText, inputs, endings };
