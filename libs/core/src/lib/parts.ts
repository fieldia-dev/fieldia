/**
 * Code a page loads the first time it uses it — a work item's text editor,
 * its path picker, a record's head, a form's functions beyond the plain ones —
 * so that a page using none of it never downloads it. Each part is a module of its own (a `*-part.ts` file) asked
 * for with `import()`: an app's bundler makes it a file of its own, and the
 * script bundle a script beside fieldia.js, `fieldia.<name>.js`
 * (tools/script-bundle.mjs).
 *
 * A part is asked for once; a failure (offline, say) is forgotten, so the next
 * use asks again. What draws from a part draws from it at once when it has
 * come; the viewer waits for the parts a page needs before it draws that page,
 * and a widget made before its part has come is drawn plainly, then by its
 * part in the same place as soon as it comes (`partWidget`).
 */
export interface Part<M = unknown> {
  /** Its name: the script bundle's file for it is `fieldia.<name>.js`. */
  readonly name: string;
  /** Its code, once it has come; undefined until then. */
  readonly loaded: M | undefined;
  /** Its code: asked for the first time, then the same answer — unless that failed, when it is asked for again. */
  load(): Promise<M>;
  /**
   * Whether asking again once it failed can bring it: true where parts come by a script tag of their own (the one-tag
   * script, `partsComeByScriptTag`), which is asked for anew; false where they come by `import()` — an app's bundler —
   * whose module the browser keeps failed for the page's life, so only a reload brings it. What offers to try again
   * offers it only where it can work.
   */
  readonly asksAgain?: boolean;
  /** Whether it is asked for now and has not come nor failed yet: what waits for it waits for that answer first. */
  readonly coming?: boolean;
}

/** Whether this page's parts come by script tags of their own (the one-tag script) rather than by import(). */
let byScriptTag = false;
/** Said by the one-tag script as it starts: its parts come by script tags, each asked for anew after a failure. */
export function partsComeByScriptTag(): void {
  byScriptTag = true;
}

/** A part, asked for by `load` (a dynamic import of the part's module) the first time something needs it. */
export function lazyPart<M>(name: string, load: () => Promise<M>): Part<M> {
  let pending: Promise<M> | undefined;
  let loaded: M | undefined;
  return {
    name,
    get loaded() {
      return loaded;
    },
    get asksAgain() {
      return byScriptTag;
    },
    get coming() {
      return pending !== undefined && loaded === undefined;
    },
    load() {
      return (pending ??= load().then(
        (module) => (loaded = module),
        (error: unknown) => {
          pending = undefined;
          throw error;
        }
      ));
    },
  };
}

/** Every part asked for, and settled: each one in, or failed (and drawn plainly). Never rejects. */
export function settleParts(parts: readonly Part[]): Promise<void> {
  return Promise.all(parts.map((part) => part.load().then(
    () => undefined,
    () => undefined
  ))).then(() => undefined);
}

/**
 * A part that draws with others' widgets — an analytic distribution's lines, each with a link's box: in once they all
 * are, its own code its answer. A page that needs it waits for them all; a widget drawn from it before they came is
 * drawn plainly until they have.
 */
export function partWith<M>(part: Part<M>, ...others: readonly Part[]): Part<M> & { readonly parts: readonly Part[] } {
  return {
    name: part.name,
    parts: [part, ...others],
    get loaded() {
      return others.every((other) => other.loaded) ? part.loaded : undefined;
    },
    get asksAgain() {
      return part.asksAgain === true && others.every((other) => other.asksAgain === true);
    },
    get coming() {
      return [part, ...others].some((one) => one.coming === true);
    },
    load: () => Promise.all([part.load(), ...others.map((other) => other.load())]).then(([module]) => module),
  };
}

/** The parts a part stands for: those it was made `partWith`, or itself. */
export function partsOf(part: Part): readonly Part[] {
  return (part as { parts?: readonly Part[] }).parts ?? [part];
}
