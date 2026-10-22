import type { FieldNode } from '../format/layout';
import type { VerifiedValue } from './data-source';
import type { FormInner, FormJoin } from './joins';
import { fillMessage } from './messages';

/** A form's verify code, made for it (`join`; `form.joined('verify')`). */
export interface FormVerify extends FormJoin {
  /** Whether a field shown asks for a code (any, with none named): never where the source cannot send and check one. */
  asks(field?: string): boolean;
  /** Each field asking for a code whose value is not the one proved, with why: said under it, and nothing sent. */
  unverified(): Record<string, string>;
  /**
   * Keep that the person proved a field's value by a code — what the viewer's verify part does once `checkCode` said
   * right — or forget it (null). Laid only while the field holds that value: an answer for one changed meanwhile is let go.
   */
  mark(field: string, proved: VerifiedValue | null): void;
  /** The proofs a send carries: each field's that still holds the value proved. */
  proved(): { verified?: Record<string, VerifiedValue> };
}

/** The field nodes of a layout, at any depth. */
const fieldNodes = (node: { type: string; children?: unknown }): FieldNode[] => [...(node.type === 'field' ? [node as FieldNode] : []), ...(Array.isArray(node.children) ? (node.children as { type: string }[]).flatMap(fieldNodes) : [])];

/**
 * The verify part's side of a form — proof by a code (`options.verify` on a field's node): a shown field asks for one
 * where the data source has `sendCode` and `checkCode`; before a send, one holding a value not proved (`state.verified`)
 * is said under it and nothing goes — an empty one asks none; a send carries the proofs (`verified`).
 */
export function join(host: FormInner): FormVerify {
  const { form, page, options, messages, set } = host;
  const asked = fieldNodes(page.layout).filter((node) => node.options?.['verify'] !== undefined && node.options['verify'] !== false);
  const asking = (field?: string): FieldNode[] => {
    const source = options.dataSource;
    if (!source?.sendCode || !source.checkCode) return [];
    const shown = form.shownFields();
    return asked.filter((node) => (field === undefined || node.field === field) && shown.includes(node.field) && !form.node(node.id).invisible);
  };
  const verify: FormVerify = {
    asks: (field) => asking(field).length > 0,
    unverified() {
      const state = form.getState();
      const out: Record<string, string> = {};
      for (const node of asking()) {
        const value = state.values[node.field];
        if (typeof value !== 'string' || !value.trim() || state.verified?.[node.field]?.value === value) continue;
        out[node.field] = fillMessage(messages, messages.notVerified, { label: form.words(node.label ?? page.fields[node.field]?.label ?? node.field) });
      }
      return out;
    },
    mark(field, proved) {
      const state = form.getState();
      const verified = { ...state.verified };
      if (!proved) delete verified[field];
      else if (state.values[field] !== proved.value) return;
      else verified[field] = { value: proved.value, ...(proved.proof !== undefined ? { proof: proved.proof } : {}) };
      const errors = { ...state.errors };
      if (proved) delete errors[field];
      set({ verified, errors });
    },
    proved() {
      const state = form.getState();
      const kept = Object.entries(state.verified ?? {}).filter(([name, proved]) => state.values[name] === proved.value);
      return kept.length ? { verified: Object.fromEntries(kept.map(([name, proved]) => [name, { ...proved }])) } : {};
    },
    // Before a send: a field not proved said under it, beside the form's own problems — its own one kept where it has one.
    before(problems) {
      for (const [field, why] of Object.entries(verify.unverified())) problems[field] ??= why;
    },
    around: (kind, sent, go) => go(kind === 'upload' ? sent : { ...sent, ...verify.proved() }),
    // Another response, or another record: nothing proved yet.
    reset: () => set({ verified: {} }),
  };
  return verify;
}
