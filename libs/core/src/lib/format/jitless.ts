import { z } from 'zod';

/**
 * The format's schemas made with no code compiled: zod 4, as it makes an object schema, tries `new Function("")` to see
 * whether it may compile a faster parser for it — which a strict Content-Security-Policy (no `'unsafe-eval'`) refuses
 * and reports as a violation, though zod catches the refusal. Fieldia's schemas are made `jitless` (they parse as they
 * always did, through zod's own code), so no Fieldia page ever asks a browser to run made-up code.
 *
 * Each module that makes schemas calls this before it makes them: zod's setting is on while they are made, and given
 * back as it was once the modules loaded together have run (a microtask later) — an app's own zod schemas, made
 * after, are as the app set them.
 */
let giving: { was: boolean | undefined } | null = null;
export function makeSchemasJitless(): void {
  const config = z.config();
  if (!giving) {
    const back = (giving = { was: config.jitless });
    void Promise.resolve().then(() => {
      z.config({ jitless: back.was });
      giving = null;
    });
  }
  z.config({ jitless: true });
}
