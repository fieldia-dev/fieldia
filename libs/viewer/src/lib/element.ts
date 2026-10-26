import type { DataSource, Page } from '@fieldia/core';
import { ownLocale, viewerWords } from './labels';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { elementPart } from './viewer-parts';
export { elementPart, type ElementPart } from './viewer-parts';

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
  /** The viewer drawing it, once drawn; null before (undefined until its part came), and once it is taken off the page. */
  readonly handle: ViewerHandle | null;
}

/**
 * Define `<fieldia-form>` (or under another name) in a page's custom elements: the one-tag script does it as it starts;
 * an app built with a bundler calls it once. A name already defined is left as it is. What is defined is a stub: put on
 * a page, it asks for its part (fieldia.element.js), which makes it what it is in place — its `page`, `source`,
 * `options` and `handle`, what was set on it before kept, its attributes watched — and draws its form; a page with none
 * never downloads it.
 */
export function defineFieldiaForm(name = 'fieldia-form', registry: CustomElementRegistry | undefined = globalThis.customElements): void {
  if (registry && !registry.get(name))
    registry.define(
      name,
      class extends HTMLElement {
        connectedCallback() {
          drawFrom(this);
        }
        disconnectedCallback() {
          elementPart.loaded?.disconnect(this as unknown as FieldiaFormElement);
        }
      }
    );
}

/**
 * An element's part asked for, and its form drawn from it. Where it cannot come (offline, or not the file its fieldia.js
 * was built with), the element is never an empty box: it says in its place that its form could not be loaded — in the
 * main script's words, as what could not come cannot say it — with Retry where asking again can bring it, and tells
 * `fieldia-error` with why.
 */
function drawFrom(element: HTMLElement): void {
  elementPart.load().then(
    (part) => part.connect(element as FieldiaFormElement, mountViewer),
    (error: unknown) => {
      if (!element.isConnected) return;
      const doc = element.ownerDocument;
      const words = viewerWords(ownLocale(element.getAttribute('locale') ?? undefined), (element as Partial<FieldiaFormElement>).options?.labels);
      const box = doc.createElement('p');
      box.className = 'fd-element-broken';
      box.setAttribute('role', 'alert');
      box.append(words.formNotLoaded);
      if (elementPart.asksAgain) {
        const retry = doc.createElement('button');
        retry.type = 'button';
        retry.className = 'fd-button fd-button-link';
        retry.textContent = words.retry;
        retry.addEventListener('click', () => {
          box.remove();
          drawFrom(element);
        });
        box.append(' ', retry);
      }
      element.replaceChildren(box);
      element.dispatchEvent(new CustomEvent('fieldia-error', { bubbles: true, composed: true, detail: { message: error instanceof Error ? error.message : String(error) } }));
    }
  );
}
