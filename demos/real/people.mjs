/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-clinic-appointment',
    name: 'Clinic appointment',
    category: 'real',
    query: 'page=real-clinic-appointment&record=4001&skin=underline',
    blurb:
      'An aesthetic clinic’s appointment: its stages along the top and nine buttons, each shown only when it applies, rooms and equipment as tags, the check-in times, the deposit and the no-show risk, and the conversation with your team beside it.',
    howTo: [
      'Press Confirm, then Check In: the status moves along, the arrival time and the Checked In stage are filled, and other buttons take their place.',
      'Press Take to Room, then Open Session: the session is made and the patient counted as in the room.',
      'Change Duration (min) or Start: End follows. Pick a service and its duration comes with it.',
      'Type a Deposit: Register Deposit appears, and the risk score drops.',
      'Press Cancel with no reason: it is refused, as the clinic’s rules say; pick a reason and press it again.',
    ],
  },
  {
    id: 'real-time-off',
    name: 'Time off, to approve',
    category: 'real',
    query: 'page=real-time-off&record=4171&skin=underline',
    blurb:
      'A request for time off as the approver sees it: the type’s own rules decide what shows — a date range, half a day, custom hours — the duration follows the working week, and Approve, Validate and Refuse move it through two approvals.',
    howTo: [
      'Press Approve: Paid Time Off needs two approvals, so it waits in Second Approval; press Validate to approve it.',
      'Change the end date: the duration in days and hours follows, counting Sunday to Thursday.',
      'Open record 4172 (Compensatory Days, in hours) and tick Half Day: the end date and the day count go, one date and Morning or Afternoon take their place, and the duration reads 4 Hours.',
      'Tick Custom Hours instead and pick From and To: the hours follow.',
      'Pick Sick Time Off: Supporting Document appears, to attach the doctor’s note.',
    ],
  },
  {
    id: 'real-employee',
    name: 'An employee’s file',
    category: 'real',
    query: 'page=real-employee&record=4122&skin=underline',
    blurb:
      'An employee’s record as HR keeps it: a photo, tags, counters for time off, the team chart and equipment, extra details, a resume and skills, work, private and HR settings tabs, and the people she manages.',
    howTo: [
      'Open Private Information and change Marital Status to Single: the spouse’s fields go.',
      'Pick another Department: the Manager follows it.',
      'Change Private Country: a region of another country is cleared, and the region list follows the country.',
      'In HR Settings, clear the Badge ID: Generate appears; press it for a new one.',
      'Press Launch Plan, pick Onboarding: the plan summary lists who does what.',
    ],
  },
  {
    id: 'real-maintenance-request',
    name: 'Maintenance request',
    category: 'real',
    query: 'page=real-maintenance-request&record=4371&skin=underline',
    blurb:
      'A maintenance request for the clinic’s laser: stages to click through, priority stars, a duration in hours, corrective or preventive with its repeat rule, Cancel and Reopen, and the service manual as a PDF in the instructions.',
    howTo: [
      'Click Repaired on the stages at the top: the request is done, and its close date appears.',
      'Click the stars to change the priority, and type a new duration in hours.',
      'Pick Preventive: Recurrent appears; tick it and the repeat rule follows; pick Until to give it an end date.',
      'Pick another equipment: its category, team and technician come with it.',
      'Open Instructions and the service manual; press Cancel: the Canceled badge and Reopen Request take over.',
    ],
  },
];
