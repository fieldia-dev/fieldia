import type { FormState } from '@fieldia/core';
import type { WidgetLabels } from './labels';
import { fillIn, setAttr, setText } from './kind-parts';

/**
 * A choice's places left beside each option's words — "3 left", or "Full" on one whose places are all taken — from an
 * option's `seats` and what the data source told of them (`FormState.limits.seats`). A full option is shown, never
 * hidden nor turned off: picking it is refused by the form, and said under the field. Nothing shows until the source
 * told how many took them, and nothing on a page without places.
 */

type Places = NonNullable<FormState['limits']>['seats'][string][string];

/** The words for an option's places now: "3 left", "1 left", "Full"; none where the form knows none. */
export function seatWords(places: Places | undefined, words: WidgetLabels): string {
  if (!places) return '';
  return places.left === 0 ? words.seatsFull : fillIn(places.left === 1 ? words.seatsLeftOne : words.seatsLeft, { n: places.left });
}

/** The marks for a choice's options, by their values, kept to the form's places as it redraws: each a `small` beside the option's words. */
export function seatMarks(document: Document, form: { getState(): FormState }, name: string, words: WidgetLabels, values: readonly unknown[]): { marks: HTMLElement[]; update(): void } {
  const marks = values.map(() => {
    const mark = document.createElement('small');
    mark.className = 'fd-seats';
    mark.hidden = true;
    return mark;
  });
  return {
    marks,
    update() {
      const places = form.getState().limits?.seats?.[name];
      values.forEach((value, i) => {
        const shown = places?.[String(value)];
        const text = seatWords(shown, words);
        setText(marks[i], text);
        if (marks[i].hidden !== !text) marks[i].hidden = !text;
        setAttr(marks[i], 'data-full', shown?.left === 0 ? '' : null);
      });
    },
  };
}
