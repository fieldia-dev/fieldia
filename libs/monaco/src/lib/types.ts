/**
 * The part of Monaco's API the widgets use, written out here: the package
 * names no type of monaco-editor's in what it exports, so an app's types
 * check whichever way it resolves modules, and a test's stand-in can
 * implement all of it.
 */

export interface MonacoDisposable {
  dispose(): void;
}

export interface MonacoModel extends MonacoDisposable {
  getValue(): string;
  setValue(value: string): void;
  getLanguageId(): string;
}

export interface MonacoEditor extends MonacoDisposable {
  getModel(): MonacoModel | null;
  updateOptions(options: Record<string, unknown>): void;
  focus(): void;
  hasTextFocus(): boolean;
  layout(): void;
  getContentHeight(): number;
  onDidChangeModelContent(listener: () => void): MonacoDisposable;
  onDidContentSizeChange(listener: (event: { contentHeight: number }) => void): MonacoDisposable;
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
