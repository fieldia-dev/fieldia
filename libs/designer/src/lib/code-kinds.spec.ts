import { validatePage, type Field, type FieldNode } from '@fieldia/core';
import { CODE_LANGUAGES } from '../../../code/src/lib/languages';
import { blankPage, createDesigner, kindOfField, type Designer } from './designer';
import { DESIGNER_WORDS } from './designer-words';
import { inputChanges } from './input-changes';
import { findNode } from './page-tree';
import { choose, mount } from './test-editor';
import { TOOLBOX_GROUPS } from './toolbox';

/**
 * Code as a kind of field: in CodeMirror (`"widget": "code"`, @fieldia/code)
 * or in VS Code's editor (`"widget": "monaco"`, @fieldia/monaco), each drawn
 * where the app gives its widgets and a plain box where it does not; with
 * the language it is written in as the kind's own setting, in English and Arabic.
 */

const model: Record<string, Field> = {
  script: { type: 'text', label: 'Script' },
  expression: { type: 'char', label: 'Expression' },
  settings: { type: 'json', label: 'Settings' },
  stage: { type: 'selection', label: 'Stage', options: [{ value: 'draft', label: 'Draft' }] },
  hours: { type: 'float', label: 'Hours' },
};

const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
const screen = (locale?: 'ar') => createDesigner({ page: blankPage('screen', 'Job'), model, ...(locale ? { locale } : {}) });
/** The language list of the field being edited, by its name in the designer's words. */
const languageList = (host: Element, name = 'Language') => host.querySelector(`.fd-canvas-field.fd-editing select[aria-label="${name}"]`) as HTMLSelectElement | null;

describe('code as a kind of field', () => {
  it('is in the screen editor’s toolbox, in two editors, a new one a text field drawn by the editor’s widget', () => {
    expect(TOOLBOX_GROUPS.find(([group]) => group === 'More')?.[1]).toEqual(expect.arrayContaining(['code', 'vscode']));
    const designer = createDesigner({ page: blankPage('screen', 'Job') });
    for (const [kind, widget] of [['code', 'code'], ['vscode', 'monaco']]) {
      const id = designer.addQuestion(kind) as string;
      const node = nodeOf(designer, id);
      const field = designer.getPage().fields[node.field];
      expect([field.type, node.widget]).toEqual(['text', widget]);
      expect(kindOfField(field, node)).toBe(kind);
    }
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('is offered for a model’s text, char and JSON fields — VS Code’s editor for text and JSON — and for nothing else', () => {
    const designer = screen();
    // Each field placed once: placed again, it is not added, and has no kinds to offer.
    const kinds = Object.fromEntries(Object.keys(model).map((name) => [name, designer.kindsFor(designer.addModelField(name) as string).map((k) => k.id)]));
    expect(kinds['script']).toEqual(expect.arrayContaining(['paragraph', 'code', 'vscode']));
    expect(kinds['expression']).toEqual(expect.arrayContaining(['short-answer', 'code']));
    expect(kinds['expression']).not.toContain('vscode');
    expect(kinds['settings']).toEqual(expect.arrayContaining(['code', 'vscode']));
    for (const name of ['stage', 'hours']) {
      expect(kinds[name].length).toBeGreaterThan(0);
      expect(kinds[name]).not.toContain('code');
      expect(kinds[name]).not.toContain('vscode');
    }
  });

  it('shows a model’s field as code, keeping what it holds, as one undo step', () => {
    const designer = screen();
    const id = designer.addModelField('expression') as string;
    expect(designer.changeKind(id, 'code')).toBe(true);
    expect(nodeOf(designer, id).widget).toBe('code');
    expect(designer.getPage().fields['expression']).toEqual(model['expression']);
    designer.undo();
    expect(nodeOf(designer, id).widget).toBeUndefined();
  });

  it('is known again from a field’s widget: text, char and JSON in CodeMirror, text and JSON in VS Code’s editor', () => {
    const node = (widget: string): FieldNode => ({ type: 'field', id: 'n', field: 'f', widget });
    expect(kindOfField(model['script'], node('code'))).toBe('code');
    expect(kindOfField(model['expression'], node('code'))).toBe('code');
    expect(kindOfField(model['settings'], node('code'))).toBe('code');
    expect(kindOfField(model['script'], node('monaco'))).toBe('vscode');
    expect(kindOfField(model['settings'], node('monaco'))).toBe('vscode');
  });

  it('is named in Arabic', () => {
    const names: Record<string, string> = DESIGNER_WORDS.ar.kinds.names;
    expect(names['code']).toBe('شيفرة برمجية');
    expect(names['vscode']).toContain('VS Code');
  });
});

describe('the language code is written in', () => {
  it('is picked among every language the code editors know, plain text first, and kept as the node’s option', () => {
    const designer = screen();
    const id = designer.addModelField('script') as string;
    designer.changeKind(id, 'code');
    designer.select(id);
    const { host } = mount(designer);
    const list = languageList(host);
    expect([...(list?.options ?? [])].map((o) => o.value)).toEqual(['', ...CODE_LANGUAGES.map((l) => l.id)]);
    expect([...(list?.options ?? [])].map((o) => o.textContent)).toEqual(['Plain text', ...CODE_LANGUAGES.map((l) => l.name)]);
    choose(list ?? undefined, 'python');
    expect(nodeOf(designer, id).options).toEqual({ language: 'python' });
    expect(languageList(host)?.value).toBe('python');
    // VS Code's editor keeps it.
    designer.changeKind(id, 'vscode');
    expect(nodeOf(designer, id)).toMatchObject({ widget: 'monaco', options: { language: 'python' } });
    choose(languageList(host) ?? undefined, '');
    expect(nodeOf(designer, id).options).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('is not asked of a JSON field, which is JSON', () => {
    const designer = screen();
    const id = designer.addModelField('settings') as string;
    designer.changeKind(id, 'code');
    designer.select(id);
    const { host } = mount(designer);
    expect(languageList(host)?.closest('[hidden]')).not.toBeNull();
  });

  it('is offered in Arabic', () => {
    const designer = screen('ar');
    const id = designer.addModelField('script') as string;
    designer.changeKind(id, 'code');
    designer.select(id);
    const { host } = mount(designer);
    const list = languageList(host, 'اللغة');
    expect(list?.options[0].textContent).toBe('نص عادي');
    choose(list ?? undefined, 'sql');
    expect(nodeOf(designer, id).options).toEqual({ language: 'sql' });
  });

  it('is said in words when it changes, in English and Arabic', () => {
    const field = model['script'];
    const was = { field, node: { type: 'field', id: 'f', field: 'script', widget: 'code' } as FieldNode };
    const now = { field, node: { ...was.node, options: { language: 'python' } } };
    expect(inputChanges('Script', was, now).lines).toEqual(['“Script”: written in Python']);
    expect(inputChanges('Script', now, was).lines).toEqual(['“Script”: plain text']);
    expect(inputChanges('Script', was, now, DESIGNER_WORDS.ar).lines[0]).toContain('Python');
  });
});
