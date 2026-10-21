import type { DataSource, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { elementPart } from './viewer-parts';
export { elementPart, type ElementPart } from './viewer-parts';

/** The attributes `<fieldia-form>` reads; a change of one draws the form again (a theme or a skin, in place). */
export const FORM_ATTRIBUTES = ['src', 'locale', 'theme', 'skin', 'record', 'action', 'resume', 'frame'] as const;

/**
 * `<fieldia-form>`: a page's form on any web page, with no code — `<fieldia-form src="enquiry.page.json"
 * action="/api/enquiries" locale="ar" theme="material"></fieldia-form>` — or with a little: its `page`, `source` (a
 * data source) and `options` (more of the viewer's) set as properties. It tells what happens as events that bubble:
 * `fieldia-ready` once drawn, `fieldia-send` and `fieldia-save` with what the form told, `fieldia-step`, and
 * `fieldia-error` when its page cannot be read. With `frame`, in an iframe placed by fieldia-embed.js, it tells the page
 * round it its height and those events.
 */
export interface FieldiaFormElement extends HTMLElement {
  /** The page, given whole, in place of `src`. */
  page: Page | null;
  /** The app's data source, in place of `action`. */
  source: DataSource | null;
  /** More of the viewer's options: labels, slots, widgets, functions… */
  options: Partial<ViewerOptions>;
  /** The viewer drawing it, once drawn; null before, and once it is taken off the page. */
  readonly handle: ViewerHandle | null;
}

/**
 * Define `<fieldia-form>` (or under another name) in a page's custom elements: the one-tag script does it as it starts;
 * an app built with a bundler calls it once. A name already defined is left as it is.
 */
export function defineFieldiaForm(name = 'fieldia-form', registry: CustomElementRegistry | undefined = globalThis.customElements): void {
  if (!registry || registry.get(name)) return;
  /** Its properties kept until the part comes; set after, the form drawn again. */
  class FieldiaForm extends HTMLElement implements FieldiaFormElement {
    static get observedAttributes(): readonly string[] {
      return FORM_ATTRIBUTES;
    }
    private given: { page: Page | null; source: DataSource | null; options: Partial<ViewerOptions> } = { page: null, source: null, options: {} };
    get page() {
      return this.given.page;
    }
    set page(page: Page | null) {
      this.given.page = page;
      elementPart.loaded?.changed(this, mountViewer);
    }
    get source() {
      return this.given.source;
    }
    set source(source: DataSource | null) {
      this.given.source = source;
      elementPart.loaded?.changed(this, mountViewer);
    }
    get options() {
      return this.given.options;
    }
    set options(options: Partial<ViewerOptions>) {
      this.given.options = options ?? {};
      elementPart.loaded?.changed(this, mountViewer);
    }
    get handle(): ViewerHandle | null {
      return elementPart.loaded?.handleOf(this) ?? null;
    }
    connectedCallback() {
      elementPart.load().then(
        (part) => this.isConnected && part.connect(this, mountViewer),
        (error: unknown) => this.dispatchEvent(new CustomEvent('fieldia-error', { bubbles: true, detail: { error } }))
      );
    }
    disconnectedCallback() {
      elementPart.loaded?.disconnect(this);
    }
    attributeChangedCallback(name: string, before: string | null, after: string | null) {
      if (before !== after) elementPart.loaded?.changed(this, mountViewer, name);
    }
  }
  registry.define(name, FieldiaForm);
}
