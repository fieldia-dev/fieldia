import type { MonacoApi } from './types';

/**
 * JSON coloured with no worker: a small Monarch grammar of the widgets' own —
 * keys, strings, numbers, true, false and null, and comments for JSON with
 * comments. Monaco's own JSON is a language service that runs in a worker; an
 * app that gives workers gets that instead (`getWorker`).
 */
export const JSON_GRAMMAR = {
  defaultToken: '',
  tokenPostfix: '.json',
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key'],
      [/"(?:[^"\\]|\\.)*"/, 'string.value'],
      [/"(?:[^"\\]|\\.)*$/, 'string.invalid'],
      [/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/[{}[\]]/, '@brackets'],
      [/[,:]/, 'delimiter'],
      [/\s+/, 'white'],
    ],
    comment: [
      [/[^*/]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[*/]/, 'comment'],
    ],
  },
};

/** How JSON is edited: its brackets close themselves, and a quote its string. */
export const JSON_CONFIGURATION = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [
    ['{', '}'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}', notIn: ['string'] },
    { open: '[', close: ']', notIn: ['string'] },
    { open: '"', close: '"', notIn: ['string'] },
  ],
};

/** JSON in Monaco, once: unless Monaco knows it already, from its own service. */
export function registerJson(monaco: MonacoApi): void {
  if (monaco.languages.getLanguages().some((language) => language.id === 'json')) return;
  monaco.languages.register({ id: 'json', extensions: ['.json'], aliases: ['JSON', 'json'] });
  monaco.languages.setMonarchTokensProvider('json', JSON_GRAMMAR);
  monaco.languages.setLanguageConfiguration('json', JSON_CONFIGURATION);
}
