import { saveRefused, type CheckCodeRequest, type CodeChecked, type SendCodeRequest, type SentCode } from './data-source';

/**
 * How a memory source sends and checks the codes that prove an email or a phone (`sendCode`, `checkCode`), as an app's
 * own service would — its mail, its SMS or its WhatsApp gateway: each code `length` digits (6), working `expiresIn`
 * seconds (600), another asked for no sooner than `retryAfter` seconds (30), `tries` wrong ones taken (3); `refuse`
 * turns a value away in its own words. `code` makes each (a test's or a demo's fixed one); `now` is its clock.
 */
export interface MemoryCodes {
  code?: (request: SendCodeRequest, count: number) => string;
  length?: number;
  expiresIn?: number;
  retryAfter?: number;
  tries?: number;
  refuse?: (request: SendCodeRequest) => string | undefined;
  now?: () => number;
}

/** A code a memory source sent: what the message would have said, kept for a demo to show and a test to read. */
export interface SentCodeKept {
  id: string;
  pageId: string;
  field: string;
  value: string;
  by?: string;
  code: string;
  /** When it was sent and when it stops working, in ms. */
  sentAt: number;
  expiresAt: number;
  /** Wrong codes it takes still. */
  triesLeft: number;
  /** Taken: proved once, it proves no more. */
  used?: boolean;
}

/** A memory source's `sendCode` and `checkCode`, over the codes it keeps. */
export function memoryCodes(options: MemoryCodes = {}, codes: SentCodeKept[]): { sendCode(request: SendCodeRequest): SentCode; checkCode(request: CheckCodeRequest): CodeChecked } {
  const now = options.now ?? (() => Date.now());
  const length = options.length ?? 6;
  const retryAfter = options.retryAfter ?? 30;
  const sameValue = (request: { pageId: string; field: string; value: string }) => (code: SentCodeKept) => code.pageId === request.pageId && code.field === request.field && code.value === request.value;
  return {
    sendCode(request) {
      const refused = options.refuse?.(request);
      if (refused) throw saveRefused({ kind: 'rule', message: refused });
      const last = codes.filter(sameValue(request)).pop();
      const wait = last ? Math.ceil(retryAfter - (now() - last.sentAt) / 1000) : 0;
      if (wait > 0) throw saveRefused({ kind: 'rule', message: `Wait ${wait} seconds before asking for another code` });
      const code = options.code?.(request, codes.length + 1) ?? String(Math.floor(Math.random() * 10 ** length)).padStart(length, '0');
      const sent: SentCodeKept = {
        id: `code-${codes.length + 1}`,
        pageId: request.pageId,
        field: request.field,
        value: request.value,
        ...(request.by ? { by: request.by } : {}),
        code,
        sentAt: now(),
        expiresAt: now() + (options.expiresIn ?? 600) * 1000,
        triesLeft: options.tries ?? 3,
      };
      codes.push(sent);
      return { id: sent.id, expiresAt: new Date(sent.expiresAt).toISOString(), retryAfter, length: code.length };
    },
    checkCode(request) {
      const sent = (request.id ? codes.find((code) => code.id === request.id) : undefined) ?? codes.filter(sameValue(request)).pop();
      if (!sent || sent.used || sent.value !== request.value || now() > sent.expiresAt) return { ok: false, expired: true };
      if (sent.triesLeft <= 0) return { ok: false, triesLeft: 0 };
      if (request.code !== sent.code) {
        sent.triesLeft -= 1;
        return { ok: false, triesLeft: sent.triesLeft };
      }
      sent.used = true;
      return { ok: true, proof: `proved:${sent.id}` };
    },
  };
}
