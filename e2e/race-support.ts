import { type Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * An order desk built on the one-tag demo (demos/script), from the global `Fieldia` an app with no build step has:
 * an order page with a pager over three orders, a trail back to the list, a gear (Archive, Duplicate, Delete), a
 * link to its customer, lines each opened in a dialog, and a statusbar drawn by the business part — on a memory
 * source whose calls a test holds (`hold(method)`) and lets go (`release(method)`). `window.zz` has the handle, the
 * source (`ds`), the trail pressed (`went`), dialogs' results (`closed`) and the page (`base`). `source` adds to the
 * source's options; `options` (a function of `zz`, as text) to the viewer's.
 */
export async function harness(page: Page, more: { options?: string; source?: string; wait?: boolean; page?: string } = {}) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  await page.evaluate(
    ({ options, source, pageJson }) => {
      const F = (window as any).Fieldia;
      (window as any).fieldiaDemo?.handle?.destroy();
      const app = document.getElementById('app') as HTMLElement;
      app.innerHTML = '';
      const order = pageJson
        ? JSON.parse(pageJson)
        : {
            fieldia: '0.1',
            id: 'order',
            title: 'Order',
            data: { kind: 'record', model: 'order' },
            fields: {
              name: { type: 'char', label: 'Name', required: true },
              phone: { type: 'char', label: 'Phone' },
              notes: { type: 'char', label: 'Notes' },
              partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
              stage: { type: 'selection', label: 'Stage', options: [ { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'done', label: 'Done' } ] },
              lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { label: { type: 'char', label: 'Label' }, qty: { type: 'float', label: 'Qty' } } },
              active: { type: 'boolean', label: 'Active', default: true },
            },
            layout: {
              type: 'sheet',
              id: 'sheet',
              title: { field: 'name' },
              statusbar: { field: 'stage', clickable: true },
              toolbar: { menu: [ { id: 'm-archive', builtin: 'archive' }, { id: 'm-duplicate', builtin: 'duplicate' }, { id: 'm-delete', builtin: 'delete' } ] },
              children: [
                {
                  type: 'section',
                  id: 'main',
                  columns: 2,
                  children: [
                    { type: 'field', id: 'f-phone', field: 'phone' },
                    { type: 'field', id: 'f-notes', field: 'notes' },
                    { type: 'field', id: 'f-partner', field: 'partner_id' },
                    { type: 'field', id: 'f-lines', field: 'lines', colspan: 2, lineOpens: 'fields' },
                  ],
                },
              ],
            },
          };
      const partner = {
        fieldia: '0.1',
        id: 'partner',
        title: 'Customer',
        data: { kind: 'record', model: 'partner' },
        fields: { name: { type: 'char', label: 'Name', required: true }, email: { type: 'char', label: 'Email' } },
        layout: { type: 'sections', id: 's', children: [ { type: 'section', id: 'm', children: [ { type: 'field', id: 'p-name', field: 'name' }, { type: 'field', id: 'p-email', field: 'email' } ] } ] },
      };
      const line = (key: string, id: number, label: string, qty: number) => ({ key, id, values: { label, qty } });
      const ds = F.createMemoryDataSource({
        records: {
          order: {
            1: { name: 'Order one', phone: '+1', notes: '', partner_id: { id: 1, label: 'Nile Traders' }, stage: 'draft', lines: [line('1', 1, 'Desk', 1)], active: true },
            2: { name: 'Order two', phone: '+2', notes: '', partner_id: null, stage: 'sent', lines: [line('1', 2, 'Chair', 4)], active: true },
            3: { name: 'Order three', phone: '+3', notes: '', partner_id: null, stage: 'draft', lines: [], active: true },
          },
          partner: { 1: { name: 'Nile Traders', email: 'n@example.com' }, 2: { name: 'Delta Foods', email: 'd@example.com' } },
        },
        ...(source ? new Function(`return (${source})`)() : {}),
      });
      const zz: any = { ds, went: [], closed: [], held: {}, base: order };
      zz.hold = (name: string, answer?: (request: any) => unknown) => {
        const real = ds[name].bind(ds);
        zz.held[name] = [];
        ds[name] = async (request: any, ...rest: unknown[]) => {
          await new Promise<void>((go) => zz.held[name].push(go));
          return answer ? answer(request) : real(request, ...rest);
        };
      };
      zz.release = (name: string) => zz.held[name].splice(0).forEach((go: () => void) => go());
      const viewerOptions = {
        page: order,
        dataSource: ds,
        recordId: 1,
        records: [1, 2, 3],
        breadcrumbs: [{ label: 'Orders', open: () => zz.went.push('orders') }],
        pages: { partner },
        ...(options ? new Function('zz', `return (${options})`)(zz) : {}),
      };
      zz.options = viewerOptions;
      zz.handle = F.mountViewer(app, viewerOptions);
      (window as any).zz = zz;
    },
    { options: more.options, source: more.source, pageJson: more.page }
  );
  if (more.wait !== false) await expect(page.locator('#app .fd-title textarea')).toHaveValue('Order one');
  return problems;
}

/** The order form's state. */
export const zzState = (page: Page) => page.evaluate(() => (window as any).zz.handle.form.getState());
/** Settles once a call of `method` is held. */
export const zzHeld = (page: Page, method: string) => expect.poll(() => page.evaluate((m) => (window as any).zz.held[m]?.length ?? 0, method)).toBeGreaterThan(0);
/** Lets every held call of `method` answer. */
export const zzRelease = (page: Page, method: string) => page.evaluate((m) => (window as any).zz.release(m), method);
/** Hold each call of `method` until released; `answer`, when given, the body of what it answers instead (of `request`). */
export const zzHold = (page: Page, method: string, answer?: string) =>
  page.evaluate(({ m, a }) => (window as any).zz.hold(m, a ? new Function('request', a) : undefined), { m: method, a: answer });
