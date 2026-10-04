import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { conditionEditor } from './condition-editor';
import { blankPage, createDesigner } from './designer';
import { wearLook } from './panel-look';

/** Drawn again with nothing changed, a page's condition and a look worn write nothing: a long survey has one of each per page. */

function written(root: Element, act: () => void): number {
  const watch = new MutationObserver(() => undefined);
  watch.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  act();
  const count = watch.takeRecords().length;
  watch.disconnect();
  return count;
}

describe('drawn again as it was', () => {
  it('a page’s condition writes nothing, and shows its rule when it has one', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Visit') });
    designer.addQuestion('yes-no');
    const page2 = designer.addContainer('Page 2') as string;
    const editor = conditionEditor(elementFactory(document), designer, page2, 'page');
    const draw = () => {
      const page = designer.getPage();
      const step = (page.layout as WizardNode).children.find((s) => s.id === page2);
      editor.update(page, (page.layout as WizardNode).children[0].children as FieldNode[], step?.invisible);
    };
    draw();
    expect(written(editor.element, draw)).toBe(0);
    designer.setCondition(page2, { field: 'q_1', equals: true });
    draw();
    expect((editor.element.querySelector('.fd-when-answer') as HTMLSelectElement).hidden).toBe(false);
    expect(written(editor.element, draw)).toBe(0);
  });

  it('a look worn again writes nothing; a look changed is worn, a setting taken back taken off', () => {
    const host = document.createElement('div');
    host.setAttribute('data-fd-skin', 'outlined');
    const wearer = document.createElement('div');
    host.append(wearer);
    const look: Page['look'] = { font: 'serif', accent: '#225588' };
    wearLook(wearer, look);
    expect(wearer.getAttribute('data-font')).toBe('serif');
    expect(wearer.getAttribute('data-fd-skin')).toBe('outlined');
    expect(written(wearer, () => wearLook(wearer, look))).toBe(0);
    wearLook(wearer, { accent: '#225588' });
    expect(wearer.hasAttribute('data-font')).toBe(false);
    expect(wearer.getAttribute('data-accent')).not.toBeNull();
  });
});
