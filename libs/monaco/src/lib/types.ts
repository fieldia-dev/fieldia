/**
 * The part of Monaco's API the widgets use, written out here: the package
 * names no type of monaco-editor's in what it exports, so an app's types
 * check whichever way it resolves modules, and a test's stand-in can
 * implement all of it.
 */

export interface MonacoDisposable {
  dispose(): void;
}

/** A place in the text: its line and column, each from 1. */
export interface MonacoPosition {
  lineNumber: number;
  column: number;
}

/** A stretch of the text, from one place to another. */
export interface MonacoRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** What is chosen: from where it starts to where the cursor is. */
export interface MonacoSelection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}

/** A change to the text, as Monaco tells of it: what each edit put in, and whether Undo or Redo made it. */
export interface MonacoContentChange {
  changes: readonly { text: string }[];
  isUndoing: boolean;
  isRedoing: boolean;
}

/** A key bound to a command, or to none (`null`: Monaco does nothing, and leaves the key to the page), where `when` holds. */
export interface MonacoKeybindingRule {
  keybinding: number;
  command: string | null;
  when?: string;
}

export interface MonacoModel extends MonacoDisposable {
  getValue(): string;
  setValue(value: string): void;
  getLanguageId(): string;
  getLineCount(): number;
  getFullModelRange(): MonacoRange;
  getOffsetAt(position: MonacoPosition): number;
}

export interface MonacoEditor extends MonacoDisposable {
  getModel(): MonacoModel | null;
  updateOptions(options: Record<string, unknown>): void;
  focus(): void;
  hasTextFocus(): boolean;
  layout(): void;
  getContentHeight(): number;
  getPosition(): MonacoPosition | null;
  onDidChangeModelContent(listener: (event: MonacoContentChange) => void): MonacoDisposable;
  onDidContentSizeChange(listener: (event: { contentHeight: number }) => void): MonacoDisposable;
  /** Edits made as one step of Undo, the cursor left where `endCursorState` says. */
  executeEdits(source: string, edits: { range: MonacoRange; text: string }[], endCursorState?: MonacoSelection[]): boolean;
  /** One of the editor's own actions, as the keyboard runs it: `paste` with its text, `undo`, `redo`. */
  trigger(source: string, handlerId: string, payload: unknown): void;
  /** A key this editor alone has, for keybinding rules to name in their `when`. */
  createContextKey(key: string, defaultValue: boolean): { set(value: boolean): void };
}

/** A theme as Monaco defines one: its base, rules for tokens and colours for the editor's parts. */
export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

export interface MonacoApi {
  editor: {
    create(element: HTMLElement, options: Record<string, unknown>): MonacoEditor;
    createModel(value: string, language?: string): MonacoModel;
    defineTheme(name: string, theme: MonacoThemeData): void;
    setTheme(name: string): void;
    addKeybindingRules(rules: MonacoKeybindingRule[]): MonacoDisposable;
  };
  languages: {
    register(language: { id: string; extensions?: string[]; aliases?: string[] }): void;
    getLanguages(): { id: string }[];
    setMonarchTokensProvider(id: string, language: unknown): MonacoDisposable;
    setLanguageConfiguration(id: string, configuration: unknown): MonacoDisposable;
  };
}

/**
 * How the widgets get Monaco and a language's tokenizer. The default imports
 * monaco-editor's own modules, each when first needed; an app that loads
 * Monaco its own way, or a test, hands its own.
 */
export interface MonacoLoader {
  /** Monaco, with the editing features the widgets use; with `services`, the features language services need too. */
  monaco(services: boolean): Promise<MonacoApi>;
  /**
   * Monaco's id for the language a page names, its tokenizer registered — with
   * `services`, its language service where Monaco has one. `plaintext` for a
   * language Monaco has none for.
   */
  language(monaco: MonacoApi, name: unknown, services: boolean): Promise<string>;
}
