import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

const options = (page: Page) => {
  const node = (page.layout as { children: SectionNode[] }).children[0].children[0] as FieldNode;
  return (page.fields[node.field] as Field & { options: { value: string | number; label: string }[] }).options;
};

describe('options typed one after another', () => {
  it('keeps each option’s stored value when one is put between them', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('dropdown') as string;
    designer.setOptions(id, ['Yes', 'No']);
    const [yes, no] = options(designer.getPage()).map((o) => o.value);
    designer.setOptions(id, ['Yes', 'Maybe', 'No']);
    expect(options(designer.getPage())).toEqual([
      { value: yes, label: 'Yes' },
      { value: 'maybe', label: 'Maybe' },
      { value: no, label: 'No' },
    ]);
    // Taken away from the middle, the others keep theirs too.
    designer.setOptions(id, ['Yes', 'No']);
    expect(options(designer.getPage()).map((o) => o.value)).toEqual([yes, no]);
  });

  it('keeps an option’s value while its words are changed in place', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('dropdown') as string;
    designer.setOptions(id, ['Send a quote', 'Close']);
    const before = options(designer.getPage()).map((o) => o.value);
    designer.setOptions(id, ['Send the quote', 'Close']);
    expect(options(designer.getPage()).map((o) => o.value)).toEqual(before);
  });
});
