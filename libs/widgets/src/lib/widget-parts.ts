import type { FieldNode } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import type * as TextModule from './text-part';
import type * as PathModule from './path-part';
import type { Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/** The text part: a work item's formatted text editor (rich and Markdown), Markdown both ways, its menus and the links box. */
export type TextPart = typeof TextModule;
/** The path part: a path picker, with its suggestions and its tree. */
export type PathPart = typeof PathModule;

/** A work item's formatted text, loaded the first time a page shows one: `await textPart.load()` gives its editor. */
export const textPart: Part<TextPart> = lazyPart('text', () => import('./text-part'));
/** A path picker, loaded the first time a page shows one. */
export const pathPart: Part<PathPart> = lazyPart('path', () => import('./path-part'));

/** A factory whose widget comes in a part, for a field `when` says (every one unless it says). */
export type PartFactory = WidgetFactory & {
  /** The part a field's widget comes in, or undefined when it needs none. */
  partOf(node: FieldNode): Part | undefined;
};

/** A field's widget drawn by `part`'s factory, or `plain` where `when` says it needs no part. */
export function partFactory<M>(part: Part<M>, real: (module: M) => WidgetFactory, plain: WidgetFactory, when: (node: FieldNode) => boolean = () => true): PartFactory {
  const factory: WidgetFactory = (context) => (when(context.node) ? partWidget(part, context, (module) => real(module)(context), plain) : plain(context));
  return Object.assign(factory, { partOf: (node: FieldNode) => (when(node) ? part : undefined) });
}

/**
 * A widget whose code comes in a part. With the part in, it is the part's own, at once. Otherwise — a widget made
 * before its part came, by something that did not wait for it as the viewer does — it is drawn by `plain` and asks for
 * the part; when that comes, the part's widget takes the plain one's place in the page, with the last state the plain
 * one was given, and the focus if the plain one had it. A part that cannot come leaves the plain widget, which works.
 */
export function partWidget<M>(part: Part<M>, context: WidgetContext, real: (module: M) => Widget, plain: WidgetFactory): Widget {
  const loaded = part.loaded;
  if (loaded) return real(loaded);
  let current = plain(context);
  let last: WidgetState | undefined;
  let gone = false;
  part.load().then(
    (module) => {
      if (gone) return;
      const was = current;
      const next = real(module);
      const doc = context.document;
      const focused = !!doc.activeElement && was.element.contains(doc.activeElement);
      was.element.replaceWith(next.element);
      was.destroy?.();
      current = next;
      if (last) next.update(last);
      if (focused) next.focus();
    },
    () => undefined
  );
  return {
    get element() {
      return current.element;
    },
    get tools() {
      return current.tools;
    },
    update(state) {
      last = state;
      current.update(state);
    },
    focus: () => current.focus(),
    destroy() {
      gone = true;
      current.destroy?.();
    },
  };
}
