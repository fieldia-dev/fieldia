/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-task',
    name: 'Project task',
    category: 'real',
    query: 'page=real-task&record=5201&skin=underline',
    blurb:
      'A task in a project: the project’s stages along the top, buttons to approve, counters, nine tabs with timesheets and sub-tasks as tables, hours that add themselves up, and the conversation with your team beside it.',
    howTo: [
      'Open Timesheets and add a line: type the hours, and Hours Spent, Total Hours and Remaining Hours under the grid follow.',
      'Open Sub-tasks and add one: it takes the task’s project and customer, and the Sub-tasks counter at the top grows.',
      'Press Mark Done / Send for Approval: the app answers, Approve and Request Changes appear, and so does the Waiting Approval badge.',
      'Change Work Item Type to Bug: the Task Details tab gives way to Bug Details.',
      'Click Client Review on the stages along the top to move the task to that stage.',
    ],
  },
  {
    id: 'real-transfer',
    name: 'Warehouse receipt',
    category: 'real',
    query: 'page=real-transfer&record=5301&skin=underline',
    blurb:
      'Goods coming into the warehouse: a receipt of timber from Alexandria, each product with what was ordered, what came and what is in stock, the buttons that move it from Draft to Ready to Done, and the question of what to do with the rest when less arrives than was ordered.',
    howTo: [
      'Add a product in the grid: its unit and the stock on hand come with it.',
      'Click Operation Type: opened from Receipts, it offers only incoming types.',
      'Press Mark as ready: the receipt moves from Draft to Ready, and every line’s Quantity is what was ordered (its Demand).',
      'Set the table legs’ Quantity to 12 of 16, then press Validate.',
      'Create Backorder? asks what to do with the rest: press Create Backorder. The receipt is Done, and the rest goes to a backorder.',
    ],
  },
  {
    id: 'real-manufacturing-order',
    name: 'Manufacturing order',
    category: 'real',
    query: 'page=real-manufacturing-order&record=5401&skin=underline',
    blurb:
      'An order to make four beech dining tables: their components, the work at each station and the offcuts, from the bill of materials; sixteen buttons and fourteen counters, each shown only when it applies.',
    howTo: [
      'Change To Produce to 6: the components, the offcuts and the work orders’ minutes follow.',
      'The glue, consumed by hand, leads the components; each has its × while the order is a draft.',
      'Press Confirm: the components are reserved, and the badge says they are not all available — WH/Stock has 12 of the 24 table legs. Confirmed, they can no longer be deleted.',
      'Open Work Orders and press Plan: each operation gets its start and end.',
      'Press Produce All: the tables are made, the components consumed, and the order is Done and locked.',
    ],
  },
];
