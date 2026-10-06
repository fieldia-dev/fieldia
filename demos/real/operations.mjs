/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-task',
    name: 'Project task',
    category: 'real',
    query: 'page=real-task&record=5201&skin=underline',
    blurb:
      'Sherkety ERP’s task form, rebuilt: the project’s stages on the statusbar, approval buttons, stat buttons, nine tabs with timesheets and sub-tasks in grids, hours that add themselves up, and the conversation beside it.',
    howTo: [
      'Open Timesheets and add a line: type the hours, and Hours Spent, Total Hours and Remaining Hours under the grid follow.',
      'Open Sub-tasks and add one: it takes the task’s project and customer, and the Sub-tasks count on the stat button grows.',
      'Press Mark Done / Send for Approval: the app answers, Approve and Request Changes appear, and so does the Waiting Approval badge.',
      'Change Work Item Type to Bug: the Task Details tab gives way to Bug Details.',
      'Click Client Review on the statusbar to move the task to that stage.',
    ],
  },
  {
    id: 'real-transfer',
    name: 'Warehouse receipt',
    category: 'real',
    query: 'page=real-transfer&record=5301&skin=underline',
    blurb:
      'Sherkety ERP’s transfer form, rebuilt: a receipt of timber from Alexandria with its operations grid and on-hand columns, the buttons that move it from Draft to Ready to Done, and the backorder question when less arrives than was ordered.',
    howTo: [
      'Press Mark as Todo: the receipt is Ready and every line’s Quantity is its Demand.',
      'Set the table legs’ Quantity to 12 of 16, then press Validate.',
      'Create Backorder? opens: keep Create Backorder and save it. The receipt is Done, and the rest goes to a backorder.',
      'Add a product in the grid: its unit and the stock on hand come with it.',
    ],
  },
  {
    id: 'real-manufacturing-order',
    name: 'Manufacturing order',
    category: 'real',
    query: 'page=real-manufacturing-order&record=5401&skin=underline',
    blurb:
      'Sherkety ERP’s manufacturing order, rebuilt: four beech dining tables, their components, work orders and by-products from the bill of materials, sixteen header buttons and fourteen stat buttons, each shown only when Flectra would.',
    howTo: [
      'Change To Produce to 6: the components, the offcuts and the work orders’ minutes follow.',
      'Press Confirm: the components are reserved, and the badge says they are not all available — WH/Stock has 12 table legs of 16.',
      'Open Work Orders and press Plan: each operation gets its start and end.',
      'Press Produce All: the tables are made, the components consumed, and the order is Done and locked.',
    ],
  },
];
