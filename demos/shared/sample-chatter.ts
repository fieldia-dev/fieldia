import { createMemoryChatter } from '@fieldia/chatter';

/** A chatter for the demos: Nile Traders' conversation, to-dos and followers, kept in memory. */
const salma = { id: 23, name: 'Salma Nabil' };
const mona = { id: 21, name: 'Mona Adel' };
const karim = { id: 22, name: 'Karim Fathy' };
const youssef = { id: 24, name: 'Youssef Kamal' };

/** A day from today, as `YYYY-MM-DD`, so the demo's to-dos are always late, due or ahead. */
function fromToday(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** A drawing of a floor, as the photo a client sends. */
const floorPlan =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="#f4f1ea"/><g fill="none" stroke="#5b6470" stroke-width="3"><rect x="12" y="12" width="216" height="156"/><path d="M12 92h96v76M108 12v50M150 92h78M150 92v40"/></g><g fill="#c9b99a"><rect x="24" y="24" width="60" height="24"/><rect x="124" y="104" width="22" height="22"/></g></svg>'
  );

export function sampleChatter() {
  const call = { id: 'call', name: 'Call', icon: 'phone', daysUntilDue: 2 };
  const todo = { id: 'todo', name: 'To-do', icon: 'check', daysUntilDue: 0 };
  const meeting = { id: 'meeting', name: 'Meeting', icon: 'calendar', daysUntilDue: 7 };
  return createMemoryChatter({
    me: salma,
    people: [salma, mona, karim, youssef],
    activityTypes: [call, todo, meeting],
    records: {
      // The vendor bill's conversation: what was tracked as it was confirmed, and the vendor's own word.
      'account.move:3': {
        messages: [
          { id: 202, kind: 'message', author: mona, date: '2026-10-05T11:30:00Z', body: '<p>Bill NT-8907 attached; the chairs come on Sunday.</p>' },
          { id: 201, kind: 'event', author: youssef, date: '2026-10-05T10:00:00Z', body: '', tracking: [{ field: 'state', label: 'Status', from: 'Draft', to: 'Posted' }] },
        ],
        followers: [{ id: 73, person: mona }],
      },
      'partner:1': {
        messages: [
          { id: 3, kind: 'note', author: karim, date: '2026-10-01T14:20:00Z', body: '<p>Pays within 30 days. Prefers deliveries on <b>Sundays</b>.</p>' },
          {
            id: 2,
            kind: 'message',
            author: mona,
            date: '2026-10-01T09:05:00Z',
            body: '<p>Here is the 12th floor as it stands. Can the reception move to the river side?</p>',
            attachments: [{ id: 81, name: 'floor-12.svg', type: 'image/svg+xml', size: 512, url: floorPlan }],
          },
          { id: 1, kind: 'event', author: youssef, date: '2026-09-28T08:00:00Z', body: '', tracking: [{ field: 'state', label: 'Status', from: 'Draft', to: 'Active' }] },
        ],
        activities: [
          { id: 91, type: todo, summary: 'Send the revised floor plan', due: fromToday(-2), assignee: salma },
          { id: 92, type: call, summary: 'Confirm the delivery day', due: fromToday(0), assignee: karim },
          { id: 93, type: meeting, summary: 'Site visit with Mona', due: fromToday(5), assignee: salma },
        ],
        followers: [
          { id: 71, person: mona },
          { id: 72, person: karim },
        ],
      },
    },
  });
}
