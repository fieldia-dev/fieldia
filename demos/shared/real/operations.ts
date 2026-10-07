import type { ActionRequest, ActionResult, Line, Page, PropertyDefinition, RelatedRecord, Values } from '@fieldia/core';
import task from '../../../examples/pages/real-task.page.json';
import transfer from '../../../examples/pages/real-transfer.page.json';
import manufacturingOrder from '../../../examples/pages/real-manufacturing-order.page.json';
import backorderConfirmation from '../../../examples/pages/real-backorder-confirmation.page.json';
import pickingSign from '../../../examples/pages/real-picking-sign.page.json';
import taskList from '../../../examples/pages/real-task-list.page.json';
import type { RealLane } from './lane';

/**
 * The operations lane: Sherkety ERP's project task, warehouse transfer and
 * manufacturing order, rebuilt in Fieldia (see demos/real/gaps/operations.json
 * for what Fieldia covers of each). A fit-out project in Cairo with its task,
 * timesheets and sub-tasks; a receipt of timber from Alexandria; a workshop
 * order for four beech dining tables. What Flectra's Python does on the server
 * — onchange, the header buttons' methods — is done here, as the app's
 * answers, the same in every framework's demo.
 *
 * Ids of shared models (res.partner, res.users, product.product…) are kept in
 * the 5100s, so this lane's records never replace another lane's.
 */

// ---------------------------------------------------------------------------
// The records the pages point to.
// ---------------------------------------------------------------------------

const link = (id: number, label: string): RelatedRecord => ({ id, label });

const USERS = {
  karim: link(5101, 'Karim Fathy'),
  mona: link(5102, 'Mona Adel'),
  salma: link(5103, 'Salma Nabil'),
  omar: link(5104, 'Omar Hegazy'),
  hany: link(5105, 'Hany Saad'),
  youssef: link(5106, 'Youssef Kamal'),
};
const EMPLOYEES = { karim: link(5111, 'Karim Fathy'), omar: link(5112, 'Omar Hegazy'), hany: link(5113, 'Hany Saad'), laila: link(5114, 'Laila Mostafa') };
const PARTNERS = {
  niletowers: link(5121, 'Nile Towers Management'),
  timber: link(5122, 'Alexandria Timber Co.'),
  hardware: link(5123, 'Delta Hardware Supplies'),
};
const UOM = { units: link(5151, 'Units'), m: link(5152, 'm'), kg: link(5153, 'kg'), l: link(5154, 'L') };
const LOCATIONS = { vendors: link(5161, 'Partners/Vendors'), stock: link(5162, 'WH/Stock'), production: link(5163, 'Virtual Locations/Production'), customers: link(5164, 'Partners/Customers') };
const PICKING_TYPES = {
  receipts: link(5171, 'Sherkety Furniture: Receipts'),
  deliveries: link(5172, 'Sherkety Furniture: Delivery Orders'),
  internal: link(5173, 'Sherkety Furniture: Internal Transfers'),
  manufacturing: link(5174, 'Sherkety Furniture: Manufacturing'),
};
const COMPANIES = { interiors: link(5291, 'Sherkety Interiors'), furniture: link(5292, 'Sherkety Furniture') };
const PROJECTS = { niletowers: link(5181, 'Nile Towers 12th floor fit-out'), hq: link(5182, 'Sherkety HQ maintenance') };
const STAGES = {
  new: link(5191, 'New'),
  progress: link(5192, 'In Progress'),
  review: link(5193, 'Client Review'),
  done: link(5194, 'Done'),
  cancelled: link(5195, 'Cancelled'),
};
const TAGS = { ceilings: link(5251, 'Ceilings'), acoustics: link(5252, 'Acoustics'), snags: link(5253, 'Snag list') };
const SALE_LINE = link(5271, 'S00231 - Acoustic ceiling, installation (hours)');

/** The products of the timber receipt and the workshop's order: on hand in WH/Stock, and their unit. */
interface Product {
  name: string;
  uom: RelatedRecord;
  onHand: number;
  type: 'product' | 'consu';
  /** Consumed by hand, as the bill of materials says (manual_consumption). */
  manual?: boolean;
}
const PRODUCTS: Record<number, Product> = {
  5131: { name: 'Beech wood plank 2400 × 200 × 40 mm', uom: UOM.units, onHand: 120, type: 'product' },
  5132: { name: 'MDF board 18 mm, 1220 × 2440 mm', uom: UOM.units, onHand: 14, type: 'product' },
  5133: { name: 'Table leg, beech, 72 cm', uom: UOM.units, onHand: 12, type: 'product' },
  5134: { name: 'Wood glue PVA, 5 L', uom: UOM.units, onHand: 3, type: 'product', manual: true },
  5135: { name: 'Wood screws 4 × 40, box of 200', uom: UOM.units, onHand: 30, type: 'product' },
  5136: { name: 'Dining table, beech, 6 seats', uom: UOM.units, onHand: 2, type: 'product' },
  5137: { name: 'Coffee table, beech', uom: UOM.units, onHand: 5, type: 'product' },
  5138: { name: 'Beech offcuts', uom: UOM.kg, onHand: 40, type: 'product' },
  5139: { name: 'Lacquer, matt, 4 L', uom: UOM.units, onHand: 8, type: 'consu' },
};
const product = (id: number) => link(id, PRODUCTS[id].name);

/** The bills of materials, per unit made: components, by-products and the operations with their minutes. */
interface Bom {
  name: string;
  product: number;
  components: [product: number, perUnit: number][];
  byproducts: [product: number, perUnit: number][];
  operations: [name: string, workcenter: RelatedRecord, minutesPerUnit: number][];
}
const WORKCENTERS = { saw: link(5431, 'Panel saw'), bench: link(5432, 'Assembly bench'), booth: link(5433, 'Lacquer booth') };
const BOMS: Record<number, Bom> = {
  5421: {
    name: 'Dining table, beech, 6 seats',
    product: 5136,
    components: [
      [5131, 6],
      [5132, 0.5],
      [5133, 4],
      [5134, 0.25],
      [5135, 0.5],
    ],
    byproducts: [[5138, 1.5]],
    operations: [
      ['Cutting', WORKCENTERS.saw, 45],
      ['Assembly', WORKCENTERS.bench, 90],
      ['Finishing', WORKCENTERS.booth, 60],
    ],
  },
  5422: {
    name: 'Coffee table, beech',
    product: 5137,
    components: [
      [5131, 3],
      [5133, 4],
      [5134, 0.1],
      [5135, 0.25],
      [5139, 0.2],
    ],
    byproducts: [[5138, 0.6]],
    operations: [
      ['Cutting', WORKCENTERS.saw, 20],
      ['Assembly', WORKCENTERS.bench, 40],
      ['Finishing', WORKCENTERS.booth, 30],
    ],
  },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
let keys = 0;
/** A new line's key, never one already on a page. */
const newKey = (prefix: string) => `${prefix}${++keys}`;
/** Now, as a datetime field keeps it. */
function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const idOf = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? Number((value as RelatedRecord).id) : null);
const linesOf = (values: Values, field: string) => ((values[field] as Line[] | null) ?? []) as Line[];

// ---------------------------------------------------------------------------
// The task: Nile Towers, the acoustic ceilings of the two meeting rooms.
// ---------------------------------------------------------------------------

const TASK_ID = 5201;
const taskRecord: Values = {
  name: 'Fit acoustic ceiling panels, meeting rooms A and B',
  priority: '1',
  state: '01_in_progress',
  stage_id: STAGES.progress,
  // The time spent in each stage so far, in seconds, by the stage's id (statusbar_duration).
  duration_tracking: { 5191: 2 * 86400 + 3 * 3600, 5192: 3 * 86400 + 5 * 3600 },
  personal_stage_type_id: null,
  approval_required: true,
  approval_status: 'none',
  active: true,
  display_in_project: true,
  project_id: PROJECTS.niletowers,
  work_item_type: 'task',
  milestone_id: link(5241, 'Meeting rooms handed over'),
  epic_id: null,
  user_ids: [USERS.karim, USERS.omar],
  tag_ids: [TAGS.ceilings, TAGS.acoustics],
  partner_id: PARTNERS.niletowers,
  sale_order_id: link(5261, 'S00231'),
  project_sale_order_id: link(5261, 'S00231'),
  sale_line_id: SALE_LINE,
  allow_billable: true,
  pricing_type: 'fixed_rate',
  is_project_map_empty: true,
  has_multi_sol: false,
  opportunity_id: link(5281, 'Nile Towers: 12th floor fit-out'),
  allocated_hours: 40,
  date_deadline: '2026-10-15T16:00',
  recurring_task: false,
  recurrence_id: null,
  recurring_count: 0,
  repeat_interval: 1,
  repeat_unit: 'week',
  repeat_type: 'forever',
  repeat_until: null,
  task_properties: { site_zone: 'a', permit_needed: false, lift_slot: 'Sundays 08:00 to 10:00', panels: 64 },
  description:
    '<p>Suspended acoustic ceiling in both meeting rooms: 600 × 600 mm mineral-fibre tiles, <strong>NRC 0.85</strong>, on a white exposed grid.</p><ul><li>Room A: 32 tiles, light fittings cut in by the electrician</li><li>Room B: 32 tiles, sprinkler heads kept at their drawn height</li></ul><p>Freight lift booked on Sundays, 08:00 to 10:00.</p>',
  allow_timesheets: true,
  analytic_account_active: true,
  encode_uom_in_days: false,
  is_timeoff_task: false,
  timesheet_ids: [
    { key: 't1', id: 5501, values: { readonly_timesheet: false, date: '2026-10-04', employee_id: EMPLOYEES.karim, name: 'Set out the grid levels, room A', so_line: SALE_LINE, unit_amount: 6 } },
    { key: 't2', id: 5502, values: { readonly_timesheet: false, date: '2026-10-05', employee_id: EMPLOYEES.omar, name: 'Hang the main runners, room A', so_line: SALE_LINE, unit_amount: 7.5 } },
    { key: 't3', id: 5503, values: { readonly_timesheet: false, date: '2026-10-05', employee_id: EMPLOYEES.karim, name: 'Cut in the light fittings with the electrician', so_line: SALE_LINE, unit_amount: 4 } },
  ],
  remaining_hours_so: 52.5,
  remaining_hours_available: true,
  epic_color: null,
  epic_progress: 0,
  child_story_ids: [],
  story_points: 5,
  acceptance_criteria: null,
  bug_severity: null,
  steps_to_reproduce: null,
  allow_milestones: true,
  child_ids: [
    {
      key: 's1',
      id: 5202,
      values: {
        sequence: 1,
        priority: false,
        state: '1_done',
        name: 'Fix the suspension grid, room A',
        project_id: PROJECTS.niletowers,
        milestone_id: link(5241, 'Meeting rooms handed over'),
        partner_id: PARTNERS.niletowers,
        sale_line_id: SALE_LINE,
        user_ids: [USERS.omar],
        company_id: COMPANIES.interiors,
        allocated_hours: 8,
        effective_hours: 7.5,
        subtask_effective_hours: 0,
        date_deadline: '2026-10-06T16:00',
        my_activity_date_deadline: null,
        tag_ids: [TAGS.ceilings],
        stage_id: STAGES.done,
      },
    },
    {
      key: 's2',
      id: 5203,
      values: {
        sequence: 2,
        priority: true,
        state: '01_in_progress',
        name: 'Fix the suspension grid, room B',
        project_id: PROJECTS.niletowers,
        milestone_id: link(5241, 'Meeting rooms handed over'),
        partner_id: PARTNERS.niletowers,
        sale_line_id: SALE_LINE,
        user_ids: [USERS.omar, USERS.karim],
        company_id: COMPANIES.interiors,
        allocated_hours: 8,
        effective_hours: 3,
        subtask_effective_hours: 0,
        date_deadline: '2026-10-08T16:00',
        my_activity_date_deadline: '2026-10-07',
        tag_ids: [TAGS.ceilings],
        stage_id: STAGES.progress,
      },
    },
    {
      key: 's3',
      id: 5204,
      values: {
        sequence: 3,
        priority: false,
        state: '04_waiting_normal',
        name: 'Fit the tiles and edge trims, both rooms',
        project_id: PROJECTS.niletowers,
        milestone_id: link(5241, 'Meeting rooms handed over'),
        partner_id: PARTNERS.niletowers,
        sale_line_id: SALE_LINE,
        user_ids: [USERS.karim],
        company_id: COMPANIES.interiors,
        allocated_hours: 12,
        effective_hours: 0,
        subtask_effective_hours: 0,
        date_deadline: '2026-10-13T16:00',
        my_activity_date_deadline: null,
        tag_ids: [TAGS.ceilings, TAGS.acoustics],
        stage_id: STAGES.new,
      },
    },
  ],
  closed_subtask_count: 1,
  allow_task_dependencies: true,
  depend_on_ids: [link(5205, 'Electrical first fix, meeting rooms')],
  dependent_tasks_count: 1,
  parent_id: null,
  analytic_account_id: link(5295, 'Nile Towers 12F'),
  company_id: COMPANIES.interiors,
  sequence: 10,
  email_cc: 'site@niletowers.example',
  displayed_image_id: null,
  date_assign: '2026-10-01T09:12',
  date_last_stage_update: '2026-10-04T11:30',
  working_hours_open: 3.2,
  working_days_open: 0.4,
  working_hours_close: 0,
  working_days_close: 0,
  rating_active: true,
  rating_count: 1,
  rating_avg: 4,
  rating_last_value: 4,
  rating_avg_text: 'top',
};

/** The other tasks the links find: the sub-tasks, the task this one waits on, the task it blocks, an epic. */
const otherTasks: Record<number, Values> = {
  5202: { name: 'Fix the suspension grid, room A', project_id: PROJECTS.niletowers, parent_id: link(TASK_ID, taskRecord['name'] as string), work_item_type: 'task', state: '1_done', active: true, stage_id: STAGES.done },
  5203: { name: 'Fix the suspension grid, room B', project_id: PROJECTS.niletowers, parent_id: link(TASK_ID, taskRecord['name'] as string), work_item_type: 'task', state: '01_in_progress', active: true, stage_id: STAGES.progress },
  5204: { name: 'Fit the tiles and edge trims, both rooms', project_id: PROJECTS.niletowers, parent_id: link(TASK_ID, taskRecord['name'] as string), work_item_type: 'task', state: '04_waiting_normal', active: true, stage_id: STAGES.new },
  5205: { name: 'Electrical first fix, meeting rooms', project_id: PROJECTS.niletowers, work_item_type: 'task', state: '1_done', active: true, stage_id: STAGES.done, user_ids: [USERS.mona], date_deadline: '2026-10-02T16:00' },
  5206: { name: 'Meeting rooms', project_id: PROJECTS.niletowers, work_item_type: 'epic', state: '01_in_progress', active: true, stage_id: STAGES.progress },
  5207: { name: 'Snag walk with the client', project_id: PROJECTS.niletowers, work_item_type: 'task', state: '01_in_progress', active: true, stage_id: STAGES.new, depend_on_ids: [link(TASK_ID, taskRecord['name'] as string)] },
};

/** What a project brings to its tasks, as Flectra's related fields read them. */
const PROJECT_SETTINGS: Record<number, Values> = {
  5181: { partner_id: PARTNERS.niletowers, allow_timesheets: true, allow_milestones: true, allow_task_dependencies: true, allow_billable: true, analytic_account_active: true, company_id: COMPANIES.interiors, analytic_account_id: link(5295, 'Nile Towers 12F'), approval_required: true, rating_active: true },
  5182: { partner_id: null, allow_timesheets: true, allow_milestones: false, allow_task_dependencies: false, allow_billable: false, analytic_account_active: true, company_id: COMPANIES.interiors, analytic_account_id: link(5296, 'Sherkety HQ'), approval_required: false, rating_active: false },
};

const CLOSED = ['1_done', '1_canceled'];

/** A project's own values, its first stage, and no milestone of another project. */
function taskProjectChanged(values: Values): Values {
  const project = idOf(values['project_id']);
  const settings = project ? PROJECT_SETTINGS[project] : null;
  if (!settings) {
    return { allow_timesheets: false, allow_milestones: false, allow_task_dependencies: false, allow_billable: false, approval_required: false, stage_id: null, milestone_id: null, display_in_project: true };
  }
  return { ...settings, stage_id: project === 5181 ? STAGES.new : null, milestone_id: null, epic_id: null, display_in_project: true };
}

/** A new sub-task takes the task's project, customer and milestone, as Flectra's context defaults give them; the closed ones are counted. */
function taskSubtasksChanged(values: Values): Values {
  const lines = linesOf(values, 'child_ids').map((line, i) => {
    if (line.id !== undefined) return line;
    const v = { ...line.values };
    v['state'] ??= '01_in_progress';
    v['project_id'] ??= values['project_id'] ?? null;
    v['partner_id'] ??= values['partner_id'] ?? null;
    v['milestone_id'] ??= values['allow_milestones'] ? (values['milestone_id'] ?? null) : null;
    v['company_id'] ??= values['company_id'] ?? null;
    v['stage_id'] ??= idOf(values['project_id']) === 5181 ? STAGES.new : null;
    v['effective_hours'] ??= 0;
    v['subtask_effective_hours'] ??= 0;
    v['sequence'] ??= i + 1;
    if (!Array.isArray(v['user_ids']) || !(v['user_ids'] as unknown[]).length) v['user_ids'] = (values['user_ids'] as RelatedRecord[] | null) ?? [];
    return { ...line, values: v };
  });
  return { child_ids: lines, closed_subtask_count: lines.filter((line) => CLOSED.includes(line.values['state'] as string)).length };
}

/** A new timesheet line is today's, by whoever the task is assigned to first. */
function taskTimesheetsChanged(values: Values): Values {
  const firstEmployee: Record<number, RelatedRecord> = { 5101: EMPLOYEES.karim, 5104: EMPLOYEES.omar, 5105: EMPLOYEES.hany };
  const assignee = ((values['user_ids'] as RelatedRecord[] | null) ?? [])[0];
  const lines = linesOf(values, 'timesheet_ids').map((line) => {
    if (line.id !== undefined || line.values['employee_id']) return line;
    return { ...line, values: { ...line.values, employee_id: (assignee && firstEmployee[Number(assignee.id)]) || null, so_line: values['sale_line_id'] ?? null, readonly_timesheet: false } };
  });
  return { timesheet_ids: lines };
}

function taskAction(request: ActionRequest): ActionResult | undefined {
  const values = request.values;
  const approver = 'Salma Nabil';
  switch (request.action.slice('project.task.'.length)) {
    case 'action_send_for_approval':
      if (!values['approval_required']) return { stop: 'This project does not require task approval.' };
      return { values: { approval_status: 'to_approve' }, say: { message: `Submitted for approval to ${approver}.`, tone: 'success' } };
    case 'action_approve':
      return { values: { approval_status: 'approved' }, say: { message: `Approved by ${approver}.`, tone: 'success' } };
    case 'action_request_changes':
      return { values: { approval_status: 'rejected' }, say: { message: `Changes requested by ${approver}.`, tone: 'warning' } };
    case 'action_view_so':
      return { say: `Opens sales order ${(values['sale_order_id'] as RelatedRecord | null)?.label ?? ''}.` };
    case 'action_open_ratings':
      return { say: `Opens the ${values['rating_count']} rating(s) of this task.` };
    case 'action_recurring_tasks':
      return { say: `Opens the ${values['recurring_count']} tasks of this recurrence.` };
    case 'action_dependent_tasks':
      return { say: 'Opens the tasks this one blocks: Snag walk with the client.' };
    case 'action_view_subtask_timesheet':
      return { say: 'Opens the timesheets logged on the sub-tasks.' };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// The transfer: a receipt of timber and hardware for the workshop.
// ---------------------------------------------------------------------------

const PICKING_ID = 5301;

/** A move of the transfer, with Sherkety's on-hand columns. */
function move(key: string, id: number | undefined, productId: number, demand: number, extra: Values = {}): Line {
  const p = PRODUCTS[productId];
  return {
    key,
    ...(id === undefined ? {} : { id }),
    values: {
      state: 'draft',
      product_id: product(productId),
      description_picking: p.name,
      date: '2026-10-08T09:00',
      date_deadline: '2026-10-09T17:00',
      description_bom_line: null,
      product_uom_qty: demand,
      forecast_availability: 0,
      quantity: 0,
      product_uom: p.uom,
      qty_on_hand_now: p.onHand,
      qty_on_hand_at_date: p.onHand,
      analytic_distribution: [link(5296, 'Furniture workshop')],
      picked: false,
      lot_ids: [],
      scrapped: false,
      additional: false,
      has_tracking: 'none',
      is_initial_demand_editable: true,
      is_quantity_done_editable: true,
      display_assign_serial: false,
      ...extra,
    },
  };
}

const pickingRecord: Values = {
  name: 'WH/IN/00042',
  priority: '0',
  state: 'draft',
  is_locked: true,
  show_check_availability: false,
  show_lots_text: false,
  picking_type_code: 'incoming',
  hide_picking_type: false,
  show_allocation: false,
  show_reserved: true,
  move_line_exist: false,
  has_packages: false,
  picking_type_entire_packs: false,
  use_create_lots: true,
  has_kits: false,
  has_scrap_move: false,
  has_tracking: false,
  country_code: 'EG',
  company_id: COMPANIES.furniture,
  sherkety_transfer_id: null,
  return_count: 0,
  batch_id: null,
  partner_id: PARTNERS.timber,
  picking_type_id: PICKING_TYPES.receipts,
  location_id: LOCATIONS.vendors,
  location_dest_id: LOCATIONS.stock,
  backorder_id: null,
  scheduled_date: '2026-10-08T09:00',
  json_popover: null,
  date_deadline: '2026-10-09T17:00',
  products_availability_state: null,
  products_availability: null,
  date_done: null,
  origin: 'P00117',
  owner_id: null,
  picking_properties: { truck_plate: 'ق ط ر 4831', driver: 'Mahmoud Ali', inspected: false, dock: 'd1' },
  move_ids_without_package: [move('m1', 5311, 5131, 60), move('m2', 5312, 5132, 25), move('m3', 5313, 5133, 16), move('m4', 5314, 5134, 6)],
  package_level_ids: [],
  move_type: 'direct',
  user_id: USERS.youssef,
  group_id: link(5175, 'P00117'),
  note: '<p>Unload at dock 1. Count the legs against the packing list: <strong>16 pieces</strong>.</p>',
  signature: null,
  backorder_choice: null,
};

/** A picking type's code and default locations, as its onchange gives them. */
const PICKING_TYPE_SETTINGS: Record<number, Values> = {
  5171: { picking_type_code: 'incoming', location_id: LOCATIONS.vendors, location_dest_id: LOCATIONS.stock },
  5172: { picking_type_code: 'outgoing', location_id: LOCATIONS.stock, location_dest_id: LOCATIONS.customers },
  5173: { picking_type_code: 'internal', location_id: LOCATIONS.stock, location_dest_id: LOCATIONS.stock },
};

/** A product picked on a line brings its unit, its description and the stock on hand; a new line asks for one. */
function pickingMovesChanged(values: Values): Values {
  const confirmed = values['state'] !== 'draft';
  const lines = linesOf(values, 'move_ids_without_package').map((line) => {
    const id = idOf(line.values['product_id']);
    const p = id ? PRODUCTS[id] : null;
    if (!p) return line;
    const v = { ...line.values };
    const productChanged = v['description_picking'] !== p.name;
    if (productChanged || !v['product_uom']) {
      v['product_uom'] = p.uom;
      v['description_picking'] = p.name;
      v['qty_on_hand_now'] = p.onHand;
      v['qty_on_hand_at_date'] = p.onHand;
    }
    v['product_uom_qty'] ??= 1;
    v['quantity'] ??= 0;
    v['state'] ??= confirmed ? 'assigned' : 'draft';
    v['date'] ??= values['scheduled_date'] ?? null;
    v['additional'] ??= confirmed;
    v['picked'] ??= false;
    v['has_tracking'] ??= 'none';
    return { ...line, values: v };
  });
  return { move_ids_without_package: lines };
}

/** Reserve what WH/Stock holds: a receipt is ready at once, anything else as far as the stock goes. */
function reserve(values: Values): Values {
  const incoming = values['picking_type_code'] === 'incoming';
  const lines = linesOf(values, 'move_ids_without_package').map((line) => {
    const id = idOf(line.values['product_id']);
    const demand = Number(line.values['product_uom_qty'] ?? 0);
    const available = incoming ? demand : Math.min(demand, id ? PRODUCTS[id].onHand : 0);
    const state = available >= demand ? 'assigned' : available > 0 ? 'partially_available' : 'confirmed';
    // Reserved, the demand is the order's: only the quantity is typed now (is_initial_demand_editable).
    return { ...line, values: { ...line.values, quantity: available, forecast_availability: incoming ? demand : (id ? PRODUCTS[id].onHand : 0), state, is_initial_demand_editable: false } };
  });
  const ready = lines.every((line) => line.values['state'] === 'assigned');
  const some = lines.some((line) => Number(line.values['quantity']) > 0);
  const policyOne = values['move_type'] === 'one';
  const state = ready || (!policyOne && some) ? 'assigned' : 'confirmed';
  return {
    move_ids_without_package: lines,
    state,
    show_check_availability: !ready,
    products_availability_state: ready ? 'available' : 'late',
    products_availability: ready ? 'Available' : 'Not Available',
  };
}

/** Done: what was processed is kept, the rest goes to a backorder or is dropped. */
function finishPicking(values: Values, choice: 'create' | 'none' | null): ActionResult {
  const lines = linesOf(values, 'move_ids_without_package');
  const short = lines.filter((line) => Number(line.values['quantity'] ?? 0) < Number(line.values['product_uom_qty'] ?? 0));
  // A line processed short keeps what was processed: the rest is in the backorder, or dropped. A line not processed at all is cancelled.
  const done = lines.map((line) => {
    const quantity = Number(line.values['quantity'] ?? 0);
    const demand = Number(line.values['product_uom_qty'] ?? 0);
    return {
      ...line,
      values: { ...line.values, product_uom_qty: Math.min(quantity, demand) || demand, picked: quantity > 0, state: quantity > 0 ? 'done' : 'cancel', qty_on_hand_now: Number(line.values['qty_on_hand_now'] ?? 0) + quantity },
    };
  });
  const name = String(values['name']);
  const next = name.replace(/(\d+)$/, (digits) => String(Number(digits) + 1).padStart(digits.length, '0'));
  const said =
    choice === 'create' && short.length
      ? `${name} validated. Backorder ${next} created for the rest of ${short.map((line) => (line.values['product_id'] as RelatedRecord).label).join(', ')}.`
      : `${name} validated.`;
  return {
    values: { move_ids_without_package: done, state: 'done', date_done: now(), is_locked: true, show_check_availability: false, backorder_choice: null },
    say: { message: said, tone: 'success' },
  };
}

function pickingAction(request: ActionRequest): ActionResult | undefined {
  const values = request.values;
  const name = String(values['name']);
  switch (request.action.slice('stock.picking.'.length)) {
    case 'action_confirm': {
      const lines = linesOf(values, 'move_ids_without_package');
      if (!lines.length) return { stop: 'Please add some items to move.' };
      return { values: reserve(values), say: { message: `${name}: marked as to do.`, tone: 'success' } };
    }
    case 'action_assign':
      return { values: reserve(values) };
    case 'button_validate': {
      const lines = linesOf(values, 'move_ids_without_package');
      if (!lines.some((line) => Number(line.values['quantity'] ?? 0) > 0)) {
        return { stop: 'You cannot validate a transfer if no quantities are reserved nor done. To force the transfer, encode quantities.' };
      }
      const short = lines.some((line) => Number(line.values['quantity'] ?? 0) < Number(line.values['product_uom_qty'] ?? 0));
      if (short) {
        return {
          open: {
            page: 'real-backorder-confirmation',
            as: 'dialog',
            title: 'Create Backorder?',
            values: { pickings: 'name' },
            into: { backorder_choice: 'choice' },
            then: [{ do: 'call', action: 'stock.picking.process_backorder' }],
          },
        };
      }
      return finishPicking(values, null);
    }
    case 'process_backorder':
      return finishPicking(values, values['backorder_choice'] === 'none' ? 'none' : 'create');
    case 'action_cancel':
      return {
        values: { state: 'cancel', move_ids_without_package: linesOf(values, 'move_ids_without_package').map((line) => ({ ...line, values: { ...line.values, state: 'cancel', quantity: 0 } })) },
        say: { message: `${name} cancelled.`, tone: 'warning' },
      };
    case 'act_stock_return_picking': {
      const returns = Number(values['return_count'] ?? 0) + 1;
      return { values: { return_count: returns }, say: { message: `Return of ${name} created: WH/OUT/${String(18 + returns).padStart(5, '0')}, to Alexandria Timber Co.`, tone: 'success' } };
    }
    case 'do_print_picking':
      return { say: `Picking Operations of ${name} sent to the printer (PDF).` };
    case 'action_report_delivery':
      return { say: `Delivery Slip of ${name} sent to the printer (PDF).` };
    case 'action_open_label_type':
      return { say: 'Choose the labels to print: product labels or lot/serial labels.' };
    case 'action_put_in_pack':
      return { values: { has_packages: true }, say: { message: 'Put in pack PACK0000107.', tone: 'success' } };
    case 'action_see_returns':
      return { say: `Opens the ${values['return_count']} return(s) of ${name}.` };
    case 'action_see_move_scrap':
    case 'action_see_packages':
    case 'action_stock_report':
    case 'action_view_reception_report':
    case 'action_picking_move_tree':
    case 'action_detailed_operations':
    case 'action_view_batch':
    case 'action_view_stock_valuation_layers':
      return { say: `Opens ${request.action.slice('stock.picking.action_'.length).replace(/_/g, ' ')} for ${name}.` };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// The manufacturing order: four beech dining tables for the Nile Towers job.
// ---------------------------------------------------------------------------

const PRODUCTION_ID = 5401;

/** The order's components, by-products and work orders from a bill of materials, for so many made: stored lines have their ids, new ones none yet. */
let storedIds = 5600;
function explode(bomId: number, quantity: number, stored = false): Values {
  const ids = () => (stored ? { id: ++storedIds } : {});
  const bom = BOMS[bomId];
  if (!bom) return { move_raw_ids: [], move_byproduct_ids: [], workorder_ids: [] };
  return {
    move_raw_ids: bom.components.map(([id, perUnit], i) => ({
      key: newKey('c'),
      ...ids(),
      values: {
        // In the bill's order; glue is consumed by hand (manual_consumption), so Flectra's list puts it first.
        sequence: i + 1,
        manual_consumption: PRODUCTS[id].manual === true,
        product_id: product(id),
        location_id: LOCATIONS.stock,
        product_uom_qty: round2(perUnit * quantity),
        forecast_availability: null,
        quantity: 0,
        product_uom: PRODUCTS[id].uom,
        picked: false,
        lot_ids: [],
        unit_factor: perUnit,
        should_consume_qty: 0,
        is_done: false,
        has_tracking: 'none',
        state: 'draft',
      },
    })),
    move_byproduct_ids: bom.byproducts.map(([id, perUnit]) => ({
      key: newKey('b'),
      ...ids(),
      values: { product_id: product(id), location_dest_id: LOCATIONS.stock, product_uom_qty: round2(perUnit * quantity), quantity: 0, product_uom: PRODUCTS[id].uom, cost_share: 0, lot_ids: [], unit_factor: perUnit, is_done: false },
    })),
    workorder_ids: bom.operations.map(([name, workcenter, minutes]) => ({
      key: newKey('w'),
      ...ids(),
      values: {
        name,
        workcenter_id: workcenter,
        product_id: product(bom.product),
        qty_remaining: quantity,
        qty_produced: 0,
        finished_lot_id: null,
        date_start: null,
        date_finished: null,
        duration_expected: minutes * quantity,
        duration: 0,
        state: 'pending',
        working_state: 'normal',
        is_user_working: false,
        timer_start: null,
      },
    })),
  };
}

const productionRecord: Values = {
  name: 'WH/MO/00031',
  priority: '0',
  state: 'draft',
  reservation_state: null,
  show_serial_mass_produce: false,
  is_locked: true,
  is_planned: false,
  qty_produced: 0,
  reserve_visible: false,
  unreserve_visible: false,
  consumption: 'flexible',
  show_allocation: false,
  show_valuation: false,
  use_create_components_lots: false,
  show_lot_ids: false,
  show_final_lots: false,
  product_tracking: 'none',
  forecasted_issue: false,
  is_outdated_bom: false,
  product_tmpl_id: link(5141, 'Dining table, beech, 6 seats'),
  company_id: COMPANIES.furniture,
  warehouse_id: link(5177, 'WH'),
  production_location_id: LOCATIONS.production,
  json_popover: null,
  delay_alert_date: null,
  mrp_production_child_count: 0,
  mrp_production_source_count: 0,
  mrp_production_backorder_count: 1,
  unbuild_count: 0,
  scrap_count: 0,
  delivery_count: 0,
  sale_order_count: 1,
  purchase_order_count: 1,
  product_id: product(5136),
  product_description_variants: null,
  qty_producing: 0,
  product_qty: 4,
  product_uom_id: UOM.units,
  bom_id: link(5421, BOMS[5421].name),
  lot_producing_id: null,
  date_start: '2026-10-08T08:00',
  date_finished: '2026-10-08T16:30',
  components_availability_state: null,
  components_availability: null,
  user_id: USERS.hany,
  ...explode(5421, 4, true),
  picking_type_id: PICKING_TYPES.manufacturing,
  location_src_id: LOCATIONS.stock,
  location_dest_id: LOCATIONS.stock,
  origin: 'S00231',
  date_deadline: '2026-10-12T17:00',
  // Shares by analytic account id, as Flectra's analytic_distribution.
  analytic_distribution: { 5295: 100 },
};

/** A product or a bill of materials picked brings the bill's components, by-products and work orders. */
function productionProductChanged(values: Values): Values {
  const productId = idOf(values['product_id']);
  const bomEntry = Object.entries(BOMS).find(([, bom]) => bom.product === productId);
  if (!productId || !bomEntry) return { bom_id: null, move_raw_ids: [], move_byproduct_ids: [], workorder_ids: [] };
  const quantity = Number(values['product_qty'] ?? 1) || 1;
  return {
    bom_id: link(Number(bomEntry[0]), bomEntry[1].name),
    product_uom_id: PRODUCTS[productId].uom,
    product_tmpl_id: link(5140 + (productId - 5135), PRODUCTS[productId].name),
    product_qty: quantity,
    ...explode(Number(bomEntry[0]), quantity),
  };
}

function productionBomChanged(values: Values): Values {
  const bomId = idOf(values['bom_id']);
  if (!bomId || !BOMS[bomId]) return {};
  return { product_id: product(BOMS[bomId].product), ...explode(bomId, Number(values['product_qty'] ?? 1) || 1) };
}

/** A new quantity to produce scales the components, the by-products and the minutes of each work order. */
function productionQuantityChanged(values: Values): Values {
  const quantity = Number(values['product_qty'] ?? 0);
  const scale = (field: string, perUnit: (line: Line) => Values) => linesOf(values, field).map((line) => ({ ...line, values: { ...line.values, ...perUnit(line) } }));
  const minutes = (line: Line): Values => {
    const bom = BOMS[idOf(values['bom_id']) ?? 0];
    const operation = bom?.operations.find(([name]) => name === line.values['name']);
    return operation ? { duration_expected: operation[2] * quantity, qty_remaining: quantity } : { qty_remaining: quantity };
  };
  return {
    move_raw_ids: scale('move_raw_ids', (line) => ({ product_uom_qty: round2(Number(line.values['unit_factor'] ?? 0) * quantity) })),
    move_byproduct_ids: scale('move_byproduct_ids', (line) => ({ product_uom_qty: round2(Number(line.values['unit_factor'] ?? 0) * quantity) })),
    workorder_ids: scale('workorder_ids', minutes),
  };
}

/** Producing so many sets what each component should consume, and its quantity, as Flectra's _set_qty_producing does. */
function productionProducingChanged(values: Values): Values {
  const producing = Number(values['qty_producing'] ?? 0);
  return {
    move_raw_ids: linesOf(values, 'move_raw_ids').map((line) => {
      const should = round2(Number(line.values['unit_factor'] ?? 0) * producing);
      return { ...line, values: { ...line.values, should_consume_qty: should, quantity: should, picked: producing > 0 } };
    }),
    move_byproduct_ids: linesOf(values, 'move_byproduct_ids').map((line) => ({ ...line, values: { ...line.values, quantity: round2(Number(line.values['unit_factor'] ?? 0) * producing) } })),
  };
}

/** A component picked by hand brings its unit; it is consumed from WH/Stock. */
function productionComponentsChanged(values: Values): Values {
  return {
    move_raw_ids: linesOf(values, 'move_raw_ids').map((line) => {
      const id = idOf(line.values['product_id']);
      if (!id || !PRODUCTS[id] || (line.values['product_uom'] && line.values['location_id'])) return line;
      return { ...line, values: { ...line.values, product_uom: PRODUCTS[id].uom, location_id: LOCATIONS.stock, product_uom_qty: line.values['product_uom_qty'] ?? 1, quantity: line.values['quantity'] ?? 0, unit_factor: line.values['unit_factor'] ?? 0, state: line.values['state'] ?? (values['state'] === 'draft' ? 'draft' : 'confirmed'), has_tracking: 'none', is_done: false } };
    }),
  };
}

/** Reserve each component from WH/Stock: the order is ready when every one is. */
function reserveComponents(values: Values): Values {
  const lines = linesOf(values, 'move_raw_ids').map((line): Line => {
    const id = idOf(line.values['product_id']);
    const demand = Number(line.values['product_uom_qty'] ?? 0);
    const onHand = id && PRODUCTS[id] ? PRODUCTS[id].onHand : 0;
    const reserved = round2(Math.min(demand, onHand));
    const state = reserved >= demand ? 'assigned' : reserved > 0 ? 'partially_available' : 'confirmed';
    return { ...line, values: { ...line.values, quantity: reserved, forecast_availability: onHand, state } };
  });
  const ready = lines.every((line) => line.values['state'] === 'assigned');
  const short = lines.filter((line) => line.values['state'] !== 'assigned').map((line) => (line.values['product_id'] as RelatedRecord).label);
  const workorders = linesOf(values, 'workorder_ids').map((line, i) => ({ ...line, values: { ...line.values, state: i === 0 ? (ready ? 'ready' : 'waiting') : 'pending' } }));
  return {
    move_raw_ids: lines,
    workorder_ids: workorders,
    reservation_state: ready ? 'assigned' : 'confirmed',
    components_availability_state: ready ? 'available' : 'unavailable',
    components_availability: ready ? 'Available' : 'Not Available',
    reserve_visible: !ready,
    unreserve_visible: lines.some((line) => Number(line.values['quantity']) > 0),
    ...(short.length ? { forecasted_issue: false } : {}),
  };
}

function productionAction(request: ActionRequest): ActionResult | undefined {
  const values = request.values;
  const name = String(values['name']);
  switch (request.action.slice('mrp.production.'.length)) {
    case 'action_confirm': {
      if (!values['product_id']) return { stop: 'Choose the product to build first.' };
      if (Number(values['product_qty'] ?? 0) <= 0) return { stop: 'The quantity to produce must be positive!' };
      const reserved = reserveComponents(values);
      const ready = reserved['reservation_state'] === 'assigned';
      return {
        values: { state: 'confirmed', name: name === 'New' ? 'WH/MO/00032' : name, ...reserved },
        say: ready ? { message: `${name} confirmed: every component is reserved.`, tone: 'success' } : { message: `${name} confirmed: some components are not available yet.`, tone: 'warning' },
      };
    }
    case 'action_assign': {
      const reserved = reserveComponents(values);
      return { values: reserved, ...(reserved['reservation_state'] === 'assigned' ? {} : { say: { message: 'Nothing more could be reserved: WH/Stock has no more of the missing components.', tone: 'warning' as const } }) };
    }
    case 'do_unreserve':
      return {
        values: {
          move_raw_ids: linesOf(values, 'move_raw_ids').map((line) => ({ ...line, values: { ...line.values, quantity: 0, state: 'confirmed' } })),
          reservation_state: 'confirmed',
          components_availability_state: 'unavailable',
          components_availability: 'Not Available',
          reserve_visible: true,
          unreserve_visible: false,
        },
      };
    case 'button_plan': {
      let start = new Date(String(values['date_start'] ?? now()));
      const workorders = linesOf(values, 'workorder_ids').map((line) => {
        const finish = new Date(start.getTime() + Number(line.values['duration_expected'] ?? 0) * 60000);
        const at = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const planned = { ...line, values: { ...line.values, date_start: at(start), date_finished: at(finish) } };
        start = finish;
        return planned;
      });
      const last = workorders[workorders.length - 1]?.values['date_finished'] ?? values['date_finished'];
      return { values: { is_planned: true, workorder_ids: workorders, date_finished: last }, say: { message: `${name} planned: ${workorders.length} work orders in the work centres' calendars.`, tone: 'success' } };
    }
    case 'button_unplan':
      return { values: { is_planned: false, workorder_ids: linesOf(values, 'workorder_ids').map((line) => ({ ...line, values: { ...line.values, date_start: null, date_finished: null } })) } };
    case 'button_mark_done': {
      const total = Number(values['product_qty'] ?? 0);
      const producing = Number(values['qty_producing'] ?? 0);
      const quantity = producing > 0 && producing < total ? producing : total;
      const partial = quantity < total;
      const consumed = linesOf(values, 'move_raw_ids').map((line) => {
        const q = round2(Number(line.values['unit_factor'] ?? 0) * quantity) || Number(line.values['quantity'] ?? 0);
        return { ...line, values: { ...line.values, quantity: q, should_consume_qty: q, picked: true, is_done: true, state: 'done', product_uom_qty: partial ? q : line.values['product_uom_qty'] } };
      });
      const byproducts = linesOf(values, 'move_byproduct_ids').map((line) => ({ ...line, values: { ...line.values, quantity: round2(Number(line.values['unit_factor'] ?? 0) * quantity), is_done: true } }));
      const workorders = linesOf(values, 'workorder_ids').map((line) => ({
        ...line,
        values: { ...line.values, state: 'done', qty_produced: quantity, qty_remaining: 0, duration: Number(line.values['duration'] ?? 0) || Number(line.values['duration_expected'] ?? 0) * (quantity / (total || 1)) },
      }));
      const productLabel = (values['product_id'] as RelatedRecord | null)?.label ?? '';
      return {
        values: {
          state: 'done',
          name: partial ? `${name}-001` : name,
          qty_producing: quantity,
          qty_produced: quantity,
          product_qty: quantity,
          move_raw_ids: consumed,
          move_byproduct_ids: byproducts,
          workorder_ids: workorders,
          date_finished: now(),
          is_locked: true,
          reserve_visible: false,
          unreserve_visible: false,
          ...(partial ? { mrp_production_backorder_count: 2 } : {}),
        },
        say: partial
          ? { message: `${quantity} × ${productLabel} produced. Backorder ${name}-002 created for the other ${round2(total - quantity)}.`, tone: 'success' }
          : { message: `${quantity} × ${productLabel} produced.`, tone: 'success' },
      };
    }
    case 'button_scrap':
      return { values: { scrap_count: Number(values['scrap_count'] ?? 0) + 1 }, say: { message: 'Scrap order SP/00009 created: 1 × Table leg, beech, 72 cm.', tone: 'success' } };
    case 'action_cancel':
      return {
        values: {
          state: 'cancel',
          move_raw_ids: linesOf(values, 'move_raw_ids').map((line) => ({ ...line, values: { ...line.values, quantity: 0, state: 'cancel' } })),
          workorder_ids: linesOf(values, 'workorder_ids').map((line) => ({ ...line, values: { ...line.values, state: 'cancel' } })),
          reserve_visible: false,
          unreserve_visible: false,
        },
        say: { message: `${name} cancelled.`, tone: 'warning' },
      };
    case 'button_unbuild':
      return { values: { unbuild_count: Number(values['unbuild_count'] ?? 0) + 1 }, say: { message: 'Unbuild order UB/00003 created.', tone: 'success' } };
    case 'action_update_bom':
      return { values: { is_outdated_bom: false, ...explode(idOf(values['bom_id']) ?? 0, Number(values['product_qty'] ?? 1)) } };
    case 'action_open_label_type':
      return { say: 'Choose the labels to print: product labels or lot/serial labels.' };
    case 'action_serial_mass_produce_wizard':
      return { say: 'Opens the mass production of serial numbers.' };
    case 'action_change_production_qty':
      return { say: 'Opens Change Quantity To Produce.' };
    case 'action_product_forecast_report':
      return { say: `Opens the forecast of ${(values['product_id'] as RelatedRecord | null)?.label ?? 'the product'}.` };
    case 'action_generate_bom':
      return { say: 'Opens a new bill of materials made from these components.' };
    case 'action_generate_serial':
      return { values: { lot_producing_id: link(5441, '0000031') } };
    default:
      if (request.action.startsWith('mrp.production.action_')) return { say: `Opens ${request.action.slice('mrp.production.action_'.length).replace(/_/g, ' ')} for ${name}.` };
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// A work order's own buttons, on its line or on the lines chosen.
// ---------------------------------------------------------------------------

const minutesSince = (from: unknown) => (typeof from === 'string' ? Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000)) : 0);

/** mrp.workorder's buttons: the line (or lines) changed as the server would, the timer running while someone works. */
function workorderAction(request: ActionRequest): ActionResult | undefined {
  const what = request.action.slice('mrp.workorder.'.length);
  const one = request.line ? [request.line.key] : [];
  const chosen = new Set<string>(request.lines ? request.lines.keys.map(String) : one.map(String));
  if (!chosen.size) return undefined;
  const change = (v: Values): Values => {
    switch (what) {
      case 'button_start':
        return { ...v, state: 'progress', is_user_working: true, timer_start: now(), date_start: v['date_start'] ?? now() };
      case 'button_pending':
        return { ...v, is_user_working: false, duration: Number(v['duration'] ?? 0) + minutesSince(v['timer_start']), timer_start: null };
      case 'button_finish':
      case 'action_mark_as_done':
        return { ...v, state: 'done', is_user_working: false, duration: Number(v['duration'] ?? 0) + minutesSince(v['timer_start']), timer_start: null, date_finished: now(), qty_remaining: 0 };
      case 'button_block':
        return { ...v, working_state: 'blocked', is_user_working: false, duration: Number(v['duration'] ?? 0) + minutesSince(v['timer_start']), timer_start: null };
      case 'button_unblock':
        return { ...v, working_state: 'normal' };
      default:
        return v;
    }
  };
  const workorders = linesOf(request.values, 'workorder_ids').map((line) => (chosen.has(String(line.key)) ? { ...line, values: change(line.values) } : line));
  const names = workorders.filter((line) => chosen.has(String(line.key))).map((line) => line.values['name']).join(', ');
  const said: Record<string, string> = { button_start: 'started', button_pending: 'paused', button_finish: 'done', action_mark_as_done: 'done', button_block: 'blocked', button_unblock: 'unblocked' };
  return { values: { workorder_ids: workorders, ...(what === 'button_start' ? { state: 'progress' } : {}) }, say: { message: `${names}: ${said[what] ?? what}.`, tone: 'info' } };
}

// ---------------------------------------------------------------------------
// The lane.
// ---------------------------------------------------------------------------

/** The person using the demo: a project manager and salesman with the timesheet, rating, recurrence and dependency groups — not developer mode. */
const OPERATIONS_USER = {
  id: 5102,
  name: 'Mona Adel',
  roles: [
    'base.group_user',
    'base.group_multi_company',
    'stock.group_stock_user',
    'uom.group_uom',
    'project.group_project_manager',
    'project.group_project_rating',
    'project.group_project_recurring_tasks',
    'project.group_project_task_dependencies',
    'hr_timesheet.group_hr_timesheet_user',
    'sales_team.group_sale_salesman',
    'analytic.group_analytic_accounting',
    'stock.group_stock_manager',
    'stock.group_stock_multi_locations',
    'stock.group_production_lot',
    'stock.group_tracking_lot',
    'mrp.group_mrp_routings',
    'mrp.group_mrp_byproducts',
    'mrp.group_mrp_manager',
  ],
};

/** The properties each project keeps for its tasks (project.project task_properties_definition). */
const TASK_PROPERTIES: Record<number, PropertyDefinition[]> = {
  5181: [
    { name: 'site_zone', label: 'Site zone', type: 'selection', options: [{ value: 'a', label: 'Meeting room A' }, { value: 'b', label: 'Meeting room B' }, { value: 'open', label: 'Open plan' }] },
    { name: 'permit_needed', label: 'Building permit needed', type: 'boolean' },
    { name: 'lift_slot', label: 'Freight lift slot', type: 'char' },
    { name: 'panels', label: 'Panels to fit', type: 'integer' },
  ],
  5182: [{ name: 'floor', label: 'Floor', type: 'integer' }],
};

/** The properties each operation type keeps for its transfers (stock.picking.type picking_properties_definition). */
const PICKING_PROPERTIES: Record<number, PropertyDefinition[]> = {
  5171: [
    { name: 'truck_plate', label: 'Truck plate', type: 'char' },
    { name: 'driver', label: 'Driver', type: 'char' },
    { name: 'inspected', label: 'Quality inspected', type: 'boolean' },
    { name: 'dock', label: 'Dock', type: 'selection', options: [{ value: 'd1', label: 'Dock 1' }, { value: 'd2', label: 'Dock 2' }] },
  ],
  5172: [{ name: 'carrier', label: 'Carrier', type: 'char' }],
};

/** A person's initials on a colour, as a link's picture. */
const FACES = ['#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be185d', '#0e7490'];
function face(name: string, colour: string): string {
  const initials = name.split(' ').map((word) => word[0]).join('').slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${colour}"/><text x="32" y="41" font-family="sans-serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** An answer comes after a moment, as one from a server does. */
const ANSWER_MS = 250;

export const lane: RealLane = {
  pages: {
    'real-task': task as Page,
    'real-transfer': transfer as Page,
    'real-manufacturing-order': manufacturingOrder as Page,
  },
  opened: {
    'real-task': task as Page,
    'real-backorder-confirmation': backorderConfirmation as Page,
    'real-picking-sign': pickingSign as Page,
    // The task's Sub-tasks button lists them.
    'real-task-list': taskList as Page,
  },
  users: {
    'real-task': OPERATIONS_USER,
    'real-transfer': OPERATIONS_USER,
    'real-manufacturing-order': OPERATIONS_USER,
  },
  navigation: {
    'real-task': { records: [TASK_ID, 5205, 5207], breadcrumbs: [{ label: 'Nile Towers 12th floor fit-out', href: '#tasks' }] },
    'real-transfer': { records: [PICKING_ID, 5302], breadcrumbs: [{ label: 'Receipts', href: '#receipts' }] },
    'real-manufacturing-order': { records: [PRODUCTION_ID], breadcrumbs: [{ label: 'Manufacturing Orders', href: '#manufacturing' }] },
  },
  // Opened from Receipts, as Flectra's action: only incoming operation types (context restricted_picking_type_code).
  around: { 'real-transfer': { context: { restricted_picking_type_code: 'incoming' } } },
  shows: {
    'res.users': { avatar: 'image_128' },
    'project.tags': { color: 'color' },
    'project.task.type': { folded: 'fold' },
  },
  definitions: {
    task_properties: (values) => TASK_PROPERTIES[idOf(values['project_id']) ?? 0] ?? [],
    picking_properties: (values) => PICKING_PROPERTIES[idOf(values['picking_type_id']) ?? 0] ?? [],
  },
  related: { 'project.task': task as Page, 'stock.picking': transfer as Page },
  records: {
    'project.task': { [TASK_ID]: taskRecord, ...otherTasks },
    'project.project': {
      5181: { name: PROJECTS.niletowers.label, active: true, partner_id: PARTNERS.niletowers },
      5182: { name: PROJECTS.hq.label, active: true },
    },
    'project.task.type': {
      5191: { name: 'New', project_ids: [PROJECTS.niletowers], fold: false },
      5192: { name: 'In Progress', project_ids: [PROJECTS.niletowers, PROJECTS.hq], fold: false },
      5193: { name: 'Client Review', project_ids: [PROJECTS.niletowers], fold: false },
      5194: { name: 'Done', project_ids: [PROJECTS.niletowers, PROJECTS.hq], fold: true },
      5195: { name: 'Cancelled', project_ids: [PROJECTS.niletowers, PROJECTS.hq], fold: true },
    },
    'project.milestone': {
      5241: { name: 'Meeting rooms handed over', project_id: PROJECTS.niletowers },
      5242: { name: 'Open plan handed over', project_id: PROJECTS.niletowers },
    },
    'project.tags': { 5251: { name: 'Ceilings', color: 4 }, 5252: { name: 'Acoustics', color: 10 }, 5253: { name: 'Snag list', color: 1 } },
    'project.task.recurrence': {},
    'res.users': Object.fromEntries(Object.values(USERS).map((user, i) => [user.id, { name: user.label, share: false, image_128: face(user.label, FACES[i % FACES.length]) }])),
    'hr.employee': Object.fromEntries(Object.values(EMPLOYEES).map((employee) => [employee.id, { name: employee.label }])),
    'res.partner': {
      5121: { name: PARTNERS.niletowers.label },
      5122: { name: PARTNERS.timber.label },
      5123: { name: PARTNERS.hardware.label },
    },
    'res.company': { 5291: { name: COMPANIES.interiors.label }, 5292: { name: COMPANIES.furniture.label } },
    'sale.order': { 5261: { name: 'S00231' } },
    'sale.order.line': {
      5271: { name: SALE_LINE.label, order_partner_id: PARTNERS.niletowers },
      5272: { name: 'S00231 - Site supervision (hours)', order_partner_id: PARTNERS.niletowers },
    },
    'crm.lead': { 5281: { name: 'Nile Towers: 12th floor fit-out', type: 'opportunity' } },
    'account.analytic.account': { 5295: { name: 'Nile Towers 12F' }, 5296: { name: 'Furniture workshop' } },
    'ir.attachment': {},
    'stock.picking': {
      [PICKING_ID]: pickingRecord,
      // The last receipt, done: what the pager moves to.
      5302: {
        ...pickingRecord,
        name: 'WH/IN/00038',
        state: 'done',
        origin: 'P00109',
        scheduled_date: '2026-09-28T09:00',
        date_deadline: '2026-09-29T17:00',
        date_done: '2026-09-28T11:40',
        partner_id: PARTNERS.hardware,
        picking_properties: { truck_plate: 'ج ه د 1290', driver: 'Sayed Omar', inspected: true, dock: 'd2' },
        move_ids_without_package: [
          move('d1', 5315, 5135, 20, { state: 'done', quantity: 20, picked: true, is_initial_demand_editable: false }),
          move('d2', 5316, 5134, 4, { state: 'done', quantity: 4, picked: true, is_initial_demand_editable: false }),
        ],
        note: null,
      },
    },
    'product.product': Object.fromEntries(Object.entries(PRODUCTS).map(([id, p]) => [id, { name: p.name, type: p.type, uom_id: p.uom }])),
    'product.template': { 5141: { name: 'Dining table, beech, 6 seats' }, 5142: { name: 'Coffee table, beech' } },
    'uom.uom': Object.fromEntries(Object.values(UOM).map((uom) => [uom.id, { name: uom.label }])),
    'stock.location': Object.fromEntries(Object.values(LOCATIONS).map((location) => [location.id, { name: location.label }])),
    'stock.picking.type': {
      5171: { name: PICKING_TYPES.receipts.label, code: 'incoming' },
      5172: { name: PICKING_TYPES.deliveries.label, code: 'outgoing' },
      5173: { name: PICKING_TYPES.internal.label, code: 'internal' },
      5174: { name: PICKING_TYPES.manufacturing.label, code: 'mrp_operation' },
    },
    'stock.warehouse': { 5177: { name: 'WH' } },
    'procurement.group': { 5175: { name: 'P00117' } },
    'stock.lot': { 5441: { name: '0000031', product_id: product(5136) } },
    'stock.quant.package': { 5451: { name: 'PACK0000106' } },
    'stock.picking.batch': {},
    'sherkety.stock.transfer': {},
    'mrp.production': { [PRODUCTION_ID]: productionRecord },
    'mrp.bom': Object.fromEntries(Object.entries(BOMS).map(([id, bom]) => [id, { name: bom.name, product_id: product(bom.product) }])),
    'mrp.workcenter': Object.fromEntries(Object.values(WORKCENTERS).map((workcenter) => [workcenter.id, { name: workcenter.label }])),
  },
  onchange: {
    'project.task': { project_id: taskProjectChanged, child_ids: taskSubtasksChanged, timesheet_ids: taskTimesheetsChanged },
    'stock.picking': {
      picking_type_id: (values) => PICKING_TYPE_SETTINGS[idOf(values['picking_type_id']) ?? 0] ?? {},
      move_ids_without_package: pickingMovesChanged,
    },
    'mrp.production': {
      product_id: productionProductChanged,
      bom_id: productionBomChanged,
      product_qty: productionQuantityChanged,
      qty_producing: productionProducingChanged,
      move_raw_ids: productionComponentsChanged,
    },
  },
  warnings: {
    'project.task': {
      date_deadline: (values) => (values['date_deadline'] && String(values['date_deadline']) < now() && !CLOSED.includes(String(values['state'])) ? 'This deadline is already past.' : null),
    },
    'mrp.production': {
      product_qty: (values) => (Number(values['product_qty'] ?? 0) <= 0 ? 'The quantity to produce must be positive!' : null),
    },
  },
  action(request: ActionRequest): ActionResult | undefined | Promise<ActionResult | undefined> {
    const answer = request.action.startsWith('project.task.')
      ? taskAction(request)
      : request.action.startsWith('stock.picking.')
        ? pickingAction(request)
        : request.action.startsWith('mrp.production.')
          ? productionAction(request)
          : request.action.startsWith('mrp.workorder.')
            ? workorderAction(request)
            : undefined;
    if (answer === undefined) return undefined;
    return new Promise((resolve) => setTimeout(() => resolve(answer), ANSWER_MS));
  },
};
