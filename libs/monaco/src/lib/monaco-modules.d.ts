// monaco-editor's modules, as the loader imports them: by the paths its
// `exports` map gives (monaco-editor/editor, …/features/*, …/languages/*),
// which this workspace's module resolution does not read. Their types are
// written out in types.ts; nothing the package exports names these.
declare module 'monaco-editor/editor';
declare module 'monaco-editor/features/*';
declare module 'monaco-editor/languages/*';
