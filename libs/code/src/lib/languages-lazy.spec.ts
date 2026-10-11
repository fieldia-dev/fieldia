/**
 * Each language's grammar is loaded when a field asks for it, and no other:
 * a page with one Python field carries Python's grammar alone. Every grammar
 * package is wrapped here to note when it is first loaded.
 */
const mockLoaded: string[] = [];
const mockNoting = (name: string) => () => {
  mockLoaded.push(name);
  return jest.requireActual(name);
};
jest.mock('@codemirror/lang-cpp', () => mockNoting('@codemirror/lang-cpp')());
jest.mock('@codemirror/lang-css', () => mockNoting('@codemirror/lang-css')());
jest.mock('@codemirror/lang-go', () => mockNoting('@codemirror/lang-go')());
jest.mock('@codemirror/lang-html', () => mockNoting('@codemirror/lang-html')());
jest.mock('@codemirror/lang-java', () => mockNoting('@codemirror/lang-java')());
jest.mock('@codemirror/lang-javascript', () => mockNoting('@codemirror/lang-javascript')());
jest.mock('@codemirror/lang-markdown', () => mockNoting('@codemirror/lang-markdown')());
jest.mock('@codemirror/lang-php', () => mockNoting('@codemirror/lang-php')());
jest.mock('@codemirror/lang-python', () => mockNoting('@codemirror/lang-python')());
jest.mock('@codemirror/lang-rust', () => mockNoting('@codemirror/lang-rust')());
jest.mock('@codemirror/lang-sql', () => mockNoting('@codemirror/lang-sql')());
jest.mock('@codemirror/lang-xml', () => mockNoting('@codemirror/lang-xml')());
jest.mock('@codemirror/lang-yaml', () => mockNoting('@codemirror/lang-yaml')());
jest.mock('@codemirror/legacy-modes/mode/shell', () => mockNoting('@codemirror/legacy-modes/mode/shell')());
jest.mock('@codemirror/legacy-modes/mode/ruby', () => mockNoting('@codemirror/legacy-modes/mode/ruby')());
jest.mock('@codemirror/legacy-modes/mode/clike', () => mockNoting('@codemirror/legacy-modes/mode/clike')());

import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
import { codeWidgets } from './code';
import { loadCodeLanguage } from './languages';

const page: Page = {
  fieldia: '0.1',
  id: 'job',
  title: 'Job',
  data: { kind: 'record', model: 'job' },
  fields: { script: { type: 'text', label: 'Script' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-script', field: 'script', widget: 'code', options: { language: 'python' } }] }],
  },
};

it('loads no grammar until a field asks for one, then only the one asked for', async () => {
  // The package itself, and the widgets, carry none.
  expect(mockLoaded).toEqual([]);
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { job: { 1: { script: 'print(1)' } } } }), recordId: 1, widgets: codeWidgets });
  await handle.form.settled();
  await loadCodeLanguage('python');
  expect(mockLoaded).toEqual(['@codemirror/lang-python']);
  handle.destroy();
});
