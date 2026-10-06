import { validatePage } from '../format/validate';
import type { Page } from '../format/page';
import { createForm } from './form';
import { orderPage, orderSource, recordingHost } from './test-steps';

/**
 * Steps that leave the form or bring it back: a web address opened, a list of
 * the records related to this one, and the record loaded again once the app
 * has changed it on its server — as Flectra's object buttons do.
 */

describe('form.run — reload', () => {
  it('loads the record again, as the server now has it', async () => {
    const dataSource = orderSource();
    const form = createForm({ page: orderPage(), dataSource, recordId: 7 });
    await form.load();
    dataSource.records['sale.order'][7]['quantity'] = 5;
    expect(await form.run([{ do: 'reload' }])).toEqual({ done: true });
    expect(form.getState().values['quantity']).toBe(5);
  });

  it('cannot load a record not yet saved', async () => {
    const result = await createForm({ page: orderPage(), dataSource: orderSource() }).run([{ do: 'reload' }]);
    expect(result).toMatchObject({ done: false, reason: 'cannot', message: expect.stringMatching(/not saved yet/) });
  });

  it('loads it again when the app answers that its server changed it', async () => {
    const dataSource = orderSource();
    const form = createForm({
      page: orderPage(),
      dataSource,
      recordId: 7,
      onAction: () => {
        dataSource.records['sale.order'][7]['quantity'] = 9;
        return { reload: true, say: 'Confirmed' };
      },
    });
    await form.load();
    expect(await form.run([{ do: 'call', action: 'action_confirm' }])).toEqual({ done: true });
    expect(form.getState().values['quantity']).toBe(9);
  });
});

describe('form.run — openUrl', () => {
  it('asks the host to open a web address worked out from the record, in a new tab unless told', async () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage(), host, values: { name: 'SO007' } });
    await form.run([{ do: 'openUrl', url: "'https://portal.example/my/orders/' + name" }, { do: 'openUrl', url: "'/help'", newTab: false }]);
    expect(host.calls).toEqual([
      ['openUrl', 'https://portal.example/my/orders/SO007', true],
      ['openUrl', '/help', false],
    ]);
  });

  it('cannot without a host that opens addresses, or with no address', async () => {
    expect(await createForm({ page: orderPage() }).run([{ do: 'openUrl', url: "'https://example.com'" }])).toMatchObject({ reason: 'cannot' });
    expect(await createForm({ page: orderPage(), host: recordingHost() }).run([{ do: 'openUrl', url: 'note' }])).toMatchObject({ reason: 'cannot', message: expect.stringMatching(/no address/) });
  });
});

describe('form.run — a list of related records', () => {
  it('opens a list page with only the records related to this one', async () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage(), host, values: { name: 'SO007', customer_id: { id: 1, label: 'Nile Traders' } } });
    await form.run([
      {
        do: 'open',
        page: 'invoices',
        as: 'page',
        title: 'Invoices of SO007',
        filter: [
          { field: 'invoice_origin', op: '=', valueFrom: 'name' },
          { field: 'partner_id', op: '=', valueFrom: 'customer_id' },
          { field: 'state', op: '!=', value: 'cancel' },
        ],
      },
    ]);
    expect(host.opened[0]).toEqual({
      page: 'invoices',
      as: 'page',
      title: 'Invoices of SO007',
      recordId: null,
      filter: [
        { field: 'invoice_origin', op: '=', value: 'SO007' },
        { field: 'partner_id', op: '=', value: 1 },
        { field: 'state', op: '!=', value: 'cancel' },
      ],
    });
  });

  it('is checked as the page is read: an address that reads, a filter on fields of this page', () => {
    const withButton = (steps: unknown[]) => {
      const page = orderPage() as Page & { layout: { buttons?: unknown[] } };
      return validatePage({ ...page, layout: { ...page.layout, buttons: [{ type: 'button', id: 'go', label: 'Go', steps }] } } as Page);
    };
    expect(withButton([{ do: 'openUrl', url: "'https://example.com/' + name" }, { do: 'reload' }]).ok).toBe(true);
    expect(withButton([{ do: 'openUrl', url: "'https://example.com/' +" }]).ok).toBe(false);
    expect(withButton([{ do: 'open', page: 'invoices', filter: [{ field: 'origin', op: '=', valueFrom: 'nope' }] }]).ok).toBe(false);
  });
});
