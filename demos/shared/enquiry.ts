import type { Activity, ActivityType, Channel, ChatterMessage, ChatterOptions, ReplyChannel, createMemoryChatter } from '@fieldia/chatter';
import { instantsAt, wallTime, type Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * A property enquiry's request page: the buyer's details beside the conversation with them, as an estate agency's
 * most used screen has it — WhatsApp, e-mail, a text message and the team's notes mixed, each reply by the buyer's
 * own channel, ticks that turn as the buyer's phone tells, and follow-ups at an hour on the office's clock (Cairo's).
 * Made round now, `?now=` as the browser tests pin it.
 */

/** The office's clock: the page's `timeZone`. */
const CAIRO = 'Africa/Cairo';

/** The agency's channels, as the app lists them: its own icons and words for each. */
export const ENQUIRY_CHANNELS: Channel[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { id: 'email', label: 'E-mail', icon: 'mail' },
  { id: 'sms', label: 'SMS', icon: 'sms' },
  { id: 'note', label: 'Team note', icon: 'note', note: true },
];

/** The app's own icons for them (24×24, drawn in lines as Fieldia's are): a chat bubble with a handset — no brand's mark —, a text message, a note. */
export const ENQUIRY_ICONS = {
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7z"/><path d="M9.3 8.4c0 3.1 2.8 6.1 6.3 6.4l1-1.4-1.9-1-1 .8a4.6 4.6 0 0 1-2.4-2.5l.8-1-1-1.9z"/>',
  sms: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 17v3.5l4.5-3.5M7.5 10.5h.01M12 10.5h.01M16.5 10.5h.01"/>',
  note: '<path d="M5 3.5h10l4 4V20.5H5z"/><path d="M15 3.5v4h4M8.5 12h7M8.5 16h4.5"/>',
};

/**
 * What the enquiry page's chatter is given, beside its source: the agency's channels and their icons, and the demos'
 * clock for what is due today (`?now=`) — in every framework, as their forms do not all take one.
 */
export function enquiryChatterOptions(params: URLSearchParams): Pick<ChatterOptions, 'channels' | 'icons' | 'now'> {
  return params.get('page') === 'enquiry' ? { channels: ENQUIRY_CHANNELS, icons: ENQUIRY_ICONS, now: demoNow } : {};
}

/** What the agency's gateways refuse: a text message to Yasmin's number, which takes none — sent again, refused again. */
export function enquiryRefuses(message: ChatterMessage, record: { model: string; id: string | number }): string | null {
  return record.model === 'enquiry' && String(record.id) === '1' && message.channel === 'sms' ? 'This number does not take text messages' : null;
}

/** The buyers. */
const yasmin = { id: 41, name: 'Yasmin Farouk' };
const omar = { id: 42, name: 'Omar Said' };

/** The enquiries, as the agency's server keeps them. */
export const ENQUIRY_RECORDS: Record<number, Values> = {
  1: {
    name: 'Garden flat in Zamalek for a family of four',
    customer: 'Yasmin Farouk',
    phone: '+201004821937',
    email: 'yasmin.farouk@example.com',
    came_by: 'email',
    stage: 'viewing',
    property: 'Garden flat, 12 Mohamed Mazhar St., Zamalek',
    budget: 15000000,
    bedrooms: 3,
    agent: 'Salma Nabil',
    looking_for: 'Three bedrooms and a garden for the children, near a school. Ready to move in by the spring.',
  },
  2: {
    name: 'A studio near the university',
    customer: 'Omar Said',
    phone: '+201227654321',
    email: null,
    came_by: 'walk_in',
    stage: 'talking',
    property: 'Studio, Fifth Settlement',
    budget: 4200000,
    bedrooms: 0,
    agent: 'Karim Fathy',
    looking_for: 'A furnished studio within walking distance of the campus, for a student.',
  },
};

/** A time on Cairo's clock, `days` from the demos' today there: as Fieldia keeps one, an instant. */
function cairo(days: number, hour: number, minute = 0): string {
  const today = wallTime(demoNow().getTime(), CAIRO);
  const day = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  const wall = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour, minute };
  return new Date(instantsAt(wall, CAIRO)[0] ?? Date.UTC(wall.year, wall.month - 1, wall.day, hour - 2, minute)).toISOString();
}
/** `minutes` before the demos' now. */
const ago = (minutes: number) => new Date(demoNow().getTime() - minutes * 60000).toISOString();

/** The floor plan sent by e-mail: a drawing of the flat, as a PDF would be. */
const floorPlan =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="#eef3ee"/><g fill="none" stroke="#4d6152" stroke-width="3"><rect x="12" y="12" width="216" height="110"/><path d="M90 12v110M150 12v60M150 72h78"/></g><rect x="12" y="128" width="216" height="40" fill="#b9d3b5"/><text x="120" y="153" font-family="sans-serif" font-size="13" fill="#2f4a33" text-anchor="middle">garden</text></svg>'
  );

/** The enquiries' conversations, to-dos and channels, by `model:id`: for the demos' chatter. */
export function enquiryChatter(people: { me: { id: number; name: string }; karim: { id: number; name: string } }, types: { call: ActivityType; todo: ActivityType; meeting: ActivityType }): NonNullable<Parameters<typeof createMemoryChatter>[0]['records']> {
  const { me, karim } = people;
  const messages: ChatterMessage[] = [
    {
      id: 307,
      kind: 'message',
      author: me,
      date: ago(100),
      body: '<p>Here it is on the map: 12 Mohamed Mazhar St., ground floor. The doorman will expect you.</p>',
      channel: 'whatsapp',
      direction: 'out',
      delivery: 'delivered',
    },
    { id: 306, kind: 'message', author: me, date: ago(104), body: '<p>Thursday at 18:30 works. I will meet you at the gate.</p>', channel: 'whatsapp', direction: 'out', delivery: 'delivered' },
    { id: 305, kind: 'message', author: yasmin, date: ago(130), body: '<p>Hello Salma! Can we see the flat on Thursday after work?</p>', channel: 'whatsapp', direction: 'in' },
    { id: 304, kind: 'note', author: karim, date: cairo(-1, 16, 5), body: '<p>The owner would take <b>14.2M</b> for a quick close. Keep it to yourself for now.</p>', channel: 'note' },
    {
      id: 303,
      kind: 'message',
      author: me,
      date: cairo(-1, 11, 40),
      body: '<p>Your viewing link, as asked: fieldia.dev/v/zm12</p>',
      channel: 'sms',
      direction: 'out',
      delivery: 'failed',
      failure: 'This number does not take text messages',
    },
    {
      id: 302,
      kind: 'message',
      author: me,
      date: cairo(-1, 11, 30),
      body: '<p>It is still for sale. The floor plan is attached; viewings are open on Thursday and Saturday.</p>',
      channel: 'email',
      direction: 'out',
      delivery: 'read',
      attachments: [{ id: 381, name: 'zamalek-garden-flat.svg', type: 'image/svg+xml', size: 640, url: floorPlan }],
    },
    {
      id: 301,
      kind: 'message',
      author: yasmin,
      date: cairo(-1, 10, 12),
      body: '<p>Good morning. Is the garden flat in Zamalek still available? We are a family of four, looking to move by the spring.</p>',
      channel: 'email',
      direction: 'in',
    },
  ];
  const activities: Activity[] = [
    { id: 391, type: types.todo, summary: 'Send the mortgage calculation', due: cairo(-1, 17), assignee: me },
    { id: 392, type: types.call, summary: 'Call Yasmin to confirm Thursday', due: cairo(0, 15, 30), assignee: me },
    { id: 393, type: types.meeting, summary: 'Viewing at the flat', due: cairo(2, 18, 30), assignee: me },
  ];
  const yasminChannels: ReplyChannel[] = [
    { id: 'whatsapp', to: '+20 10 0482 1937' },
    { id: 'email', to: 'yasmin.farouk@example.com' },
    { id: 'sms', to: '+20 10 0482 1937' },
  ];
  return {
    'enquiry:1': { messages, activities, replyChannels: yasminChannels },
    // A walk-in with no e-mail: a reply goes by WhatsApp or as a text, never by e-mail.
    'enquiry:2': {
      messages: [
        { id: 312, kind: 'message', author: omar, date: ago(45), body: '<p>Is the studio furnished? My son starts in February.</p>', channel: 'whatsapp', direction: 'in' },
        { id: 311, kind: 'note', author: karim, date: cairo(-2, 13), body: '<p>Walked in with his father; the budget is firm.</p>', channel: 'note' },
      ],
      activities: [{ id: 395, type: types.call, summary: 'Ask the landlord about furniture', due: cairo(1, 10), assignee: karim }],
      replyChannels: [
        { id: 'whatsapp', to: '+20 12 2765 4321' },
        { id: 'sms', to: '+20 12 2765 4321' },
      ],
    },
  };
}

/** The buyer's words, one after another, as her WhatsApp messages arrive. */
const YASMIN_WRITES = ['Perfect, see you on Thursday at 18:30. Is there parking for two cars?', 'My husband will come too. Can we bring the children?', 'One more question: is the kitchen as in the photos?'];

/**
 * A bar over the enquiry: the buyer's phone, as the agency's WhatsApp gateway tells of it — she reads what was sent
 * to her (its ticks turn read), and writes back (her message arrives, the conversation never fetched again whole).
 */
export function buyerBar(chatter: ReturnType<typeof createMemoryChatter>): HTMLElement {
  const enquiry = { model: 'enquiry', id: 1 };
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const reads = document.createElement('button');
  reads.type = 'button';
  reads.className = 'fd-button';
  reads.textContent = 'Yasmin reads your WhatsApp messages';
  const writes = document.createElement('button');
  writes.type = 'button';
  writes.className = 'fd-button';
  writes.textContent = 'Yasmin writes on WhatsApp';
  const said = document.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  said.textContent = 'Yasmin’s phone, as the agency’s WhatsApp gateway tells of it.';
  reads.addEventListener('click', async () => {
    const unread = (await chatter.messages(enquiry)).filter((message) => message.channel === 'whatsapp' && message.direction === 'out' && message.delivery !== 'read' && message.delivery !== 'failed');
    for (const message of unread) chatter.deliver(enquiry, message.id, 'read');
    said.textContent = unread.length ? 'Yasmin opened WhatsApp on her phone: what was sent to her is read.' : 'Yasmin has read everything sent to her.';
  });
  let written = 0;
  writes.addEventListener('click', () => {
    chatter.receive(enquiry, { author: yasmin, body: `<p>${YASMIN_WRITES[written % YASMIN_WRITES.length]}</p>`, channel: 'whatsapp' });
    written++;
    said.textContent = 'Yasmin wrote on WhatsApp: her message is at the top of the conversation.';
  });
  bar.append(reads, writes, said);
  return bar;
}
