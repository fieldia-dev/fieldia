import { blankPage, createDesigner } from './designer';
import { rolesOf } from './roles-setting';
import { field, mount, openTab } from './test-editor';

/** Shown only to: the roles a part shows to, as Flectra's groups=, typed in the panel's Rules. */

function order() {
  const page = blankPage('screen', 'Order');
  page.fields = { margin: { type: 'float', label: 'Margin' } };
  (page.layout as { children: unknown[] }).children = [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-margin', field: 'margin' }] }];
  return createDesigner({ page });
}

describe('roles on a part', () => {
  it('keeps the roles typed, each once, and takes them away when emptied — one undo step each', () => {
    const designer = order();
    expect(designer.setRoles('f-margin', ['sales_team.group_sale_manager', '!base.group_portal', 'sales_team.group_sale_manager'])).toBe(true);
    expect(rolesOf(designer.getPage(), 'f-margin')).toEqual(['sales_team.group_sale_manager', '!base.group_portal']);
    expect(designer.setRoles('main', ['account.group_account_invoice'])).toBe(true);
    expect(rolesOf(designer.getPage(), 'main')).toEqual(['account.group_account_invoice']);
    designer.setRoles('f-margin', null);
    expect('roles' in (designer.getPage().layout as { children: { children: object[] }[] }).children[0].children[0]).toBe(false);
    designer.undo();
    expect(rolesOf(designer.getPage(), 'f-margin')).toHaveLength(2);
  });

  it('refuses what is not a role’s name, saying why', () => {
    const designer = order();
    expect(designer.setRoles('f-margin', ['sales manager'])).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/“sales manager” is not a role’s name/);
  });

  it('is typed in the panel’s Rules, apart by commas, and kept once left', () => {
    const designer = order();
    designer.select('f-margin');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const box = field(host, 'Shown only to') as HTMLInputElement;
    box.focus();
    box.value = 'sales_team.group_sale_manager, !base.group_portal';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(rolesOf(designer.getPage(), 'f-margin')).toEqual(['sales_team.group_sale_manager', '!base.group_portal']);
  });
});
