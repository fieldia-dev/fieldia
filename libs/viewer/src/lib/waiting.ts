import { uploadGoing, type FormState } from '@fieldia/core';
import type { ViewerLabels } from './labels';

/**
 * What a page says while something waits, where "Saving…" would be: a save waiting for files still on their way, or a
 * way out waiting — for the save on its way, or for files on theirs — before it checks the person's work
 * (`state.leaving`). Empty while nothing waits.
 */
export function waitWords(state: FormState, labels: ViewerLabels, sending: boolean, fill: (template: string, values: Record<string, string | number>) => string): string {
  const going = (state.uploads ?? []).filter(uploadGoing).length;
  if (state.status === 'saving' && going) return fill(going === 1 ? (sending ? labels.sendingAfterFile : labels.savingAfterFile) : sending ? labels.sendingAfterFiles : labels.savingAfterFiles, { n: going });
  if (!state.leaving) return '';
  if (state.status === 'saving') return labels.leaveAfterSave;
  return going ? fill(going === 1 ? labels.leaveAfterFile : labels.leaveAfterFiles, { n: going }) : '';
}
