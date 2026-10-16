/**
 * The survey part (parts.ts): the question kinds a survey asks with and few
 * other pages use — a ranking (ranking.ts), a matrix (matrix.ts), a slider
 * (slider.ts), pictures to choose from (choice-images.ts), a colour
 * (colour.ts), properties (properties.ts), an address in its parts
 * (address.ts) and a progress bar (progress.ts) — with their sheets
 * (styles-survey.ts). Loaded the first time a page shows one, through
 * `surveyPart`; each value shown plainly meanwhile (survey-plain.ts). What they
 * share with the main script stays there: a property's rows are drawn by each
 * kind's own widget, an editable progress bar's box is the number box, and the
 * countries an address lists are the designer's and the map's too
 * (countries.ts).
 */
export { rankingWidget } from './ranking';
export { matrixWidget } from './matrix';
export { sliderWidget } from './slider';
export { imageChoiceWidget } from './choice-images';
export { colourWidget } from './colour';
export { propertiesWidget } from './properties';
export { addressWidget } from './address';
export { progressbarWidget } from './progress';
