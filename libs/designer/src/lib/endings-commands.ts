import type { Page, PageEnding } from '@fieldia/core';
import { Refusal } from './refusal';

/** A change to an ending: words set it, empty words or `null` take it away; `again: false` is no button at all. */
export interface EndingPatch {
  when?: string | null;
  title?: string | null;
  text?: string | null;
  again?: string | false | null;
}

export interface EndingsCommands {
  /**
   * A page of responses' ending (`endings`) changed — its condition (`when`, an expression as a `when` holds; null:
   * shown otherwise), its title, its words, its button's words or `false` for none — or, past the last, a new one
   * put before the one shown otherwise (the last stays the default); `null` takes it away, and with the last one the
   * setting. With `typing`, a run of typing in one of its boxes is one undo step. Each edit is checked as the page
   * is: a `{name}` that is no field, one after the default, one that says nothing are refused in words.
   */
  setEnding(index: number, patch: EndingPatch | null, options?: { typing?: boolean }): boolean;
  /** An ending moved to another place among them: the first whose condition holds is the one shown. */
  moveEnding(from: number, to: number): boolean;
}

export interface EndingsCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
}

/** The store's commands for a page's endings, each one edit through the designer's `apply`. */
export function endingsCommands({ apply }: EndingsCommandsDeps): EndingsCommands {
  return {
    setEnding(index, patch, options = {}) {
      return apply(
        (draft) => {
          const endings = [...(draft.endings ?? [])];
          if (patch === null) endings.splice(index, 1);
          else {
            if (draft.data.kind !== 'responses') throw new Refusal((w) => w.endings.forResponses);
            const adding = index >= endings.length;
            const ending: PageEnding = adding ? {} : { ...endings[index] };
            for (const key of ['when', 'title', 'text'] as const) {
              const value = patch[key];
              if (value === undefined) continue;
              if (value === null || !value.trim()) delete ending[key];
              else ending[key] = value;
            }
            if (patch.again !== undefined) {
              if (patch.again === null || (typeof patch.again === 'string' && !patch.again.trim())) delete ending.again;
              else ending.again = patch.again;
            }
            // A new one goes before the one shown otherwise, which stays last.
            const last = endings[endings.length - 1];
            if (adding) endings.splice(last && last.when === undefined ? endings.length - 1 : endings.length, 0, ending);
            else endings[index] = ending;
          }
          if (endings.length) draft.endings = endings;
          else delete draft.endings;
        },
        options.typing && patch ? `ending:${index}:${Object.keys(patch).join(',')}` : null
      );
    },

    moveEnding(from, to) {
      return apply((draft) => {
        const endings = [...(draft.endings ?? [])];
        if (from < 0 || from >= endings.length || to < 0 || to >= endings.length || from === to) return;
        const [moved] = endings.splice(from, 1);
        endings.splice(to, 0, moved);
        draft.endings = endings;
      });
    },
  };
}
