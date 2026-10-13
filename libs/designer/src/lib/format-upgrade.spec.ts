import type { Page } from '@fieldia/core';

/**
 * A page saved by an older Fieldia is edited, and saved, in the current format: as the designer opens it, as an old
 * version is brought back, and as its JSON is pasted. Fieldia has had one format so far, so this spec gives it a
 * made-up second: format 0.1 there called a field's label `caption`, and 0.2 calls it `label`.
 */
jest.mock('../../../core/src/lib/format/version', () => {
  const actual = jest.requireActual('../../../core/src/lib/format/version');
  return { ...actual, FORMAT_VERSION: '0.2', FORMAT_VERSIONS: ['0.1', '0.2'], formatProblem: (version: unknown) => actual.formatProblem(version, ['0.1', '0.2']) };
});
jest.mock('../../../core/src/lib/format/upgrade', () => {
  const actual = jest.requireActual('../../../core/src/lib/format/upgrade');
  const steps = [
    {
      to: '0.2',
      changes: "A field's caption is its label.",
      upgrade(page: { fields: Record<string, Record<string, unknown>> }) {
        for (const field of Object.values(page.fields)) {
          if (!('caption' in field)) continue;
          field['label'] = field['caption'];
          delete field['caption'];
        }
        return page;
      },
      example: { before: {}, after: {} },
    },
  ];
  return { ...actual, PAGE_UPGRADES: steps, upgradePage: (page: unknown) => actual.upgradePage(page, { versions: ['0.1', '0.2'], steps }) };
});

// Read again under the made-up history: the test setup (test-parts.ts) loaded Fieldia before these mocks.
let createDesigner: typeof import('./designer').createDesigner;
beforeAll(() => {
  jest.resetModules();
  ({ createDesigner } = jest.requireActual<typeof import('./designer')>('./designer'));
});

const older = (caption: string) =>
  ({
    fieldia: '0.1',
    id: 'visit',
    title: 'Visit',
    data: { kind: 'responses' },
    fields: { name: { type: 'char', caption } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-name', field: 'name' }] },
  }) as unknown as Page;

describe('the designer and a page in an older format', () => {
  it('opens it in the current format', () => {
    const designer = createDesigner({ page: older('Full name') });
    expect(designer.getPage()).toMatchObject({ fieldia: '0.2', fields: { name: { type: 'char', label: 'Full name' } } });
    expect(designer.getPage().fields['name']).not.toHaveProperty('caption');
  });

  it('brings an old version back in the current format', () => {
    const designer = createDesigner({ page: older('Now'), versions: [{ version: 1, publishedAt: '2026-10-01T10:00:00Z', page: older('Then') }] });
    expect(designer.revertTo(1)).toBe(true);
    expect(designer.getPage()).toMatchObject({ fieldia: '0.2', fields: { name: { label: 'Then' } } });
  });

  it('takes its JSON, pasted, in the current format', () => {
    const designer = createDesigner({ page: older('Now') });
    expect(designer.setPageJson(JSON.stringify(older('Pasted'))).ok).toBe(true);
    expect(designer.getPage()).toMatchObject({ fieldia: '0.2', fields: { name: { label: 'Pasted' } } });
  });
});
