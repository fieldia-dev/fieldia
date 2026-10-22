import { type ButtonNode, type Page, type SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { kindOfField, kindsFor } from './kinds';

/**
 * A record's comforts as the designer keeps them: Undo after a button's press in place of asking first, record
 * templates people save on a record's screen, and the Repeat rule and Opening hours kinds.
 */

function sheet(): Page {
  const children = [{ type: 'button' as const, id: 'b-done', label: 'Mark done', action: 'done' }];
  const layout = {
    type: 'sheet',
    id: 'sheet',
    buttons: [{ type: 'button', id: 'confirm', label: 'Confirm', action: 'confirm' }],
    toolbar: { menu: [{ id: 'm-archive', builtin: 'archive' }] },
    children: [{ type: 'section', id: 'section-1', children }],
  } as SheetNode;
  return { ...blankPage('screen', 'Course'), id: 'course', fields: { name: { type: 'char', label: 'Name' } }, layout };
}

describe('a record’s comforts in the designer', () => {
  it('turns Undo after a press on and off: a body button, a header button, a menu item', () => {
    const designer = createDesigner({ page: sheet() });
    const layout = () => designer.getPage().layout as SheetNode;
    expect(designer.updateBlock('b-done', { undo: true })).toBe(true);
    expect(((layout().children[0] as { children: ButtonNode[] }).children[0]).undo).toBe(true);
    expect(designer.updateHeaderPart('confirm', { undo: true })).toBe(true);
    expect(layout().buttons?.[0].undo).toBe(true);
    expect(designer.updateHeaderPart('m-archive', { undo: true })).toBe(true);
    expect(layout().toolbar?.menu?.[0].undo).toBe(true);
    designer.updateBlock('b-done', { undo: false });
    expect(((layout().children[0] as { children: ButtonNode[] }).children[0]).undo).toBeUndefined();
  });

  it('keeps record templates on a record’s screen, never on a form of responses', () => {
    const designer = createDesigner({ page: sheet() });
    expect(designer.setTemplates(true)).toBe(true);
    expect(designer.getPage().templates).toBe(true);
    expect(designer.setTemplates(false)).toBe(true);
    expect(designer.getPage().templates).toBeUndefined();
    const survey = createDesigner({ page: blankPage('survey', 'Feedback') });
    expect(survey.setTemplates(true)).toBe(false);
  });

  it('offers a repeat rule on text and opening hours on JSON, and knows them again', () => {
    const offered = kindsFor({ type: 'char', label: 'Sessions' }, { fromModel: true, survey: false }).map((kind) => kind.id);
    expect(offered).toContain('repeat');
    expect(kindsFor({ type: 'json', label: 'Hours' }, { fromModel: true, survey: false }).map((kind) => kind.id)).toContain('opening-hours');
    expect(kindOfField({ type: 'char', label: 'Sessions' }, { type: 'field', id: 'f', field: 'sessions', widget: 'repeat' })).toBe('repeat');
    expect(kindOfField({ type: 'json', label: 'Hours' }, { type: 'field', id: 'f', field: 'hours', widget: 'hours' })).toBe('opening-hours');
  });
});
