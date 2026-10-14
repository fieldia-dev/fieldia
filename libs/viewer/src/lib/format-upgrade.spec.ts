import type { Page } from '@fieldia/core';
import type { ViewerHandle } from './viewer';

/**
 * A page saved by an older Fieldia is shown as the current one: the viewer, a saved form placed in it, and a form made
 * on its own all read it through upgradePage. Fieldia has had one format so far, so this spec gives it a made-up
 * second: format 0.1 there called a field's label `caption`, and 0.2 calls it `label`.
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

const older = (id: string, children: unknown[] = [{ type: 'field', id: `${id}-name`, field: 'name' }]) =>
  ({
    fieldia: '0.1',
    id,
    title: id,
    data: { kind: 'responses' },
    fields: { name: { type: 'char', caption: 'Full name', required: true } },
    layout: { type: 'sections', id: 'root', children },
  }) as unknown as Page;

// Read again under the made-up history: the test setup (test-parts.ts) loaded Fieldia before these mocks.
let mountViewer: typeof import('./viewer').mountViewer;
let createForm: typeof import('@fieldia/core').createForm;
beforeAll(() => {
  jest.resetModules();
  ({ mountViewer } = jest.requireActual<typeof import('./viewer')>('./viewer'));
  ({ createForm } = jest.requireActual<typeof import('@fieldia/core')>('@fieldia/core'));
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

describe('a page in an older format', () => {
  it('is shown as the current one, its saved forms too', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: older('outer', [{ type: 'field', id: 'outer-name', field: 'name' }, { type: 'form', id: 'inner', page: 'inner', name: 'inner' }]), pages: { inner: older('inner') } });
    expect([...host.querySelectorAll('.fd-label')].map((label) => label.textContent)).toEqual(['Full name', 'Full name']);
  });

  it('newer than this Fieldia: the viewer says to update Fieldia', () => {
    expect(() => mountViewer(document.createElement('div'), { page: { ...older('p'), fieldia: '0.3' } as unknown as Page })).toThrow(
      'fieldia: this page is in format 0.3, newer than this Fieldia reads (0.2): update Fieldia to show it'
    );
  });

  it('given to a form made on its own, is read in the current format', () => {
    const form = createForm({ page: older('alone') });
    expect(form.validate()).toBe(false);
    // Its label, as the current format names it.
    expect(form.getState().errors['name']).toBe('Full name is required');
  });
});
