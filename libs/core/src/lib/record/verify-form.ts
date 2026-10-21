import type { FieldNode } from '../format/layout';
import type { DataSource, VerifiedValue } from './data-source';
import type { FormState } from './form';
import { fillMessage, type Messages } from './messages';

/** What a form's verify code asks of the form it is made for. */
export interface VerifyHost {
  readonly dataSource: DataSource | undefined;
  readonly messages: Messages;
  /** The field nodes shown now, of one field when named. */
  shown(field?: string): FieldNode[];
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** A field's label as the page shows it now, its `{field}`s read. */
  label(node: FieldNode): string;
}

/** A form's verify code, made for it (`formVerify`). */
export interface FormVerify {
  /** Whether a field shown asks for a code (all of them, with none named): never where the source cannot send and check one. */
  asks(field?: string): boolean;
  /** Each field asking for a code whose value is not the one proved, with why: said under it, and nothing sent. */
  unverified(): Record<string, string>;
  /** Keep a field's value proved — laid only while the field holds it — or forget it (null); what said it was not goes. */
  mark(field: string, proved: VerifiedValue | null): void;
  /** The proofs a send carries: each field's that still holds the value proved. */
  proved(): { verified?: Record<string, VerifiedValue> };
}

/**
 * The form's side of proof by a code (`options.verify`): a shown field asks for one where the data source has
 * `sendCode` and `checkCode`; one holding a value not proved (`state.verified`) stops a send, an empty one asks none.
 */
export function formVerify(host: VerifyHost): FormVerify {
  const asking = (field?: string): FieldNode[] => {
    const source = host.dataSource;
    if (!source?.sendCode || !source.checkCode) return [];
    return host.shown(field).filter((node) => node.options?.['verify'] !== undefined && node.options['verify'] !== false);
  };
  return {
    asks: (field) => asking(field).length > 0,
    unverified() {
      const state = host.state();
      const out: Record<string, string> = {};
      for (const node of asking()) {
        const value = state.values[node.field];
        if (typeof value !== 'string' || !value.trim() || state.verified[node.field]?.value === value) continue;
        out[node.field] = fillMessage(host.messages, host.messages.notVerified, { label: host.label(node) });
      }
      return out;
    },
    mark(field, proved) {
      const state = host.state();
      const verified = { ...state.verified };
      if (!proved) delete verified[field];
      else if (state.values[field] !== proved.value) return;
      else verified[field] = { value: proved.value, ...(proved.proof !== undefined ? { proof: proved.proof } : {}) };
      const errors = { ...state.errors };
      if (proved) delete errors[field];
      host.set({ verified, errors });
    },
    proved() {
      const state = host.state();
      const kept = Object.entries(state.verified).filter(([name, proved]) => state.values[name] === proved.value);
      return kept.length ? { verified: Object.fromEntries(kept.map(([name, proved]) => [name, { ...proved }])) } : {};
    },
  };
}
