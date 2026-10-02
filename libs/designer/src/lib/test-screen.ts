import type { Designer } from './designer';
import type { Grafloria, GrafloriaBoardOptions } from './grafloria';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';

/** A stand-in for Grafloria: paints every widget, and lets a test play the board's part in a gesture. */
export interface FakeBoard {
  options: GrafloriaBoardOptions;
  host: HTMLElement | null;
  hosts: Map<string, HTMLElement>;
  selected: string | undefined;
  disposed: boolean;
}
export function fakeGrafloria() {
  const boards: FakeBoard[] = [];
  const kit: Grafloria = {
    dashboard(options) {
      const board: FakeBoard = { options, host: null, hosts: new Map(), selected: undefined, disposed: false };
      boards.push(board);
      const handle = {
        selectWidget(id: string | undefined) {
          board.selected = id;
          return true;
        },
        getSelectedWidget: () => board.selected,
        widget(id: string) {
          const widget = options.widgets.find((w) => w.id === id);
          const host = board.hosts.get(id);
          return widget && host ? { repaint: () => (host.replaceChildren(), options.renderWidget(widget, host)) } : undefined;
        },
        dispose() {
          board.disposed = true;
        },
      };
      return Object.assign({ handle }, { board });
    },
    render(spec, host) {
      const board = (spec as unknown as { board: FakeBoard }).board;
      board.host = host;
      for (const widget of board.options.widgets) {
        const cell = host.ownerDocument.createElement('div');
        cell.dataset['widget'] = widget.id;
        host.append(cell);
        board.hosts.set(widget.id, cell);
        board.options.renderWidget(widget, cell);
      }
      return { dispose: () => host.replaceChildren() };
    },
  };
  const live = () => boards.filter((b) => !b.disposed);
  const boardOf = (sectionId: string) => live().find((b) => b.host?.closest(`[data-node="${sectionId}"]`)) as FakeBoard;
  return { kit, boards, live, boardOf };
}

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

let handle: ScreenEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** Take the mounted editor down, as an app would. */
export function unmount() {
  handle?.destroy();
  handle = null;
}

export function mount(designer: Designer) {
  const host = document.createElement('div');
  document.body.append(host);
  const grafloria = fakeGrafloria();
  handle = mountScreenEditor(host, { designer, grafloria: grafloria.kit });
  return { host, ...grafloria };
}

export const button = (root: Element, name: string) =>
  [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement;
export const field = (root: Element, label: string) => {
  const found = [...root.querySelectorAll<HTMLElement>('[aria-label]')].find((e) => e.getAttribute('aria-label') === label && !e.closest('[hidden]'));
  return found as HTMLInputElement & HTMLSelectElement;
};
export function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
export function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
