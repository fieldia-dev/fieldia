/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-legal-case',
    name: 'Legal case',
    category: 'real',
    query: 'page=real-legal-case&record=42&skin=underline',
    blurb:
      'Sherkety ERP’s largest record: a commercial dispute at the Cairo Economic Court, with 15 tabs, 12 tables of lines, 12 stat buttons, a statusbar and the case’s buttons — hearings, deadlines, time, budget, trust money and the conversation beside it.',
    howTo: [
      'Press Hearings on the stat buttons: the Hearings tab opens. Add a hearing with a date ahead of the next one: Next Hearing and the count follow.',
      'In Timesheets, type COURT in a new line’s Shortcode: the category, description and rate fill in, and the budget’s progress follows the hours.',
      'Open Billing and pick Flat Fee: the matter rate goes, the flat fee schedule appears.',
      'Press Close Case, pick an outcome and write the closing notes: the case closes, its pending tasks are cancelled and the Outcome tab opens.',
      'Open the Trust tab and press Deposit: the deposit is made in a dialog and lands in the ledger as a draft.',
    ],
  },
  {
    id: 'real-survey',
    name: 'Survey settings',
    category: 'real',
    query: 'page=real-survey&record=7&skin=underline',
    blurb:
      'Sherkety ERP’s survey record, as its owner edits it: the sections and questions in order, pagination, who may answer, scoring and certification, exam mode and live sessions — options that show and switch off as the survey’s type changes.',
    howTo: [
      'Add a question at the end of a section, then move it up with its grip or Alt+↑.',
      'Pick Assessment over the title: Time & Scoring appears, scoring turns on and access becomes invitation only.',
      'Tick Is a Certification, then Require Login: Give Badge appears; untick Require Login and it goes.',
      'Press Close: the survey is archived and Reopen takes its place.',
    ],
  },
];
