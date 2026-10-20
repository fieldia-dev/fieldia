/**
 * How the chatter reaches the server: an object the app writes for its own
 * backend, as it writes a data source. Reading and posting messages are all a
 * chatter needs; each other method adds a part (uploads, reactions, mentions,
 * activities, followers, the channels a reply can go by, messages arriving
 * live), and a part whose method is missing is not shown.
 */

export type ChatterId = string | number;

/** The record the conversation is about. */
export interface RecordRef {
  model: string;
  id: ChatterId;
}

export interface Person {
  id: ChatterId;
  name: string;
  /** An image address; without one, the person's initials stand in. */
  avatar?: string | null;
}

export interface Attachment {
  id: ChatterId;
  name: string;
  /** Its media type, such as `image/png`: an image gets a preview. */
  type: string;
  size: number;
  /** Where to open or download it. */
  url?: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  /** Whether the person using the chatter is among those who reacted. */
  mine: boolean;
}

/** A field's change, as a record's history keeps it. */
export interface TrackedChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

/**
 * How far a message sent outside got, as its channel tells: on its way (`pending`), `sent`, `delivered` to the
 * person's phone or inbox, `read` by them — or `failed`, the message's `failure` saying why.
 */
export type Delivery = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatterMessage {
  id: ChatterId;
  /** A message the record's followers get, a note for the team only, or an event such as a tracked change. */
  kind: 'message' | 'note' | 'event';
  author: Person | null;
  /** When it was posted, as an ISO date and time. */
  date: string;
  /** HTML. The chatter cleans it before it shows it. */
  body: string;
  tracking?: TrackedChange[];
  attachments?: Attachment[];
  reactions?: Reaction[];
  /** The message this one answers. */
  parentId?: ChatterId | null;
  /** The people it @mentions. */
  mentions?: Person[];
  /**
   * The channel it came or went by, by its id in the app's `channels` (ChatterOptions): "whatsapp", "email", "sms".
   * Drawn with that channel's icon and words. None for a message to the followers or an event.
   */
  channel?: string | null;
  /** Which way it went: `in`, from outside — the customer wrote it —, or `out`, sent from here. */
  direction?: 'in' | 'out' | null;
  /** How far a message sent outside got: its ticks. None for one whose channel tells nothing. */
  delivery?: Delivery | null;
  /** Why it was not delivered, in the app's words: "The number is not on WhatsApp". Said under it. */
  failure?: string | null;
}

export interface NewMessage {
  kind: 'message' | 'note';
  /** HTML made from what was typed, every character escaped. */
  body: string;
  attachments?: Attachment[];
  parentId?: ChatterId | null;
  /** The people @mentioned. */
  mentions?: Person[];
  /** The channel picked to send it by (the app's `channels`); a note posted where the app has a note channel names it. */
  channel?: string;
  /** Who it goes to on that channel, as `replyChannels` said and the person saw it. */
  to?: string;
}

export interface ActivityType {
  id: ChatterId;
  name: string;
  /** An icon by name, one of Fieldia's own or the app's. */
  icon?: string;
  /** Days from today an activity of this type is due, unless a date is chosen. */
  daysUntilDue?: number;
}

export interface Activity {
  id: ChatterId;
  type: ActivityType;
  summary?: string | null;
  note?: string | null;
  /**
   * When it is due: a day, `YYYY-MM-DD`; or a day and an hour — an instant written with its offset, as Fieldia keeps
   * a date and time (`2026-10-20T12:30:00Z`), or a day and a time on the page's clock (`2026-10-20T15:30`). An hour is
   * shown, and counted overdue from, on the page's clock (ChatterOptions.timeZone).
   */
  due: string;
  assignee: Person;
}

export interface NewActivity {
  typeId: ChatterId;
  summary?: string;
  note?: string;
  /** A day, `YYYY-MM-DD`; or, where a time was chosen, the instant it names on the page's clock, in UTC: `2026-10-20T12:30:00.000Z`. */
  due: string;
  assigneeId: ChatterId;
}

export interface Follower {
  id: ChatterId;
  person: Person;
}

/** A way the app reaches people outside — WhatsApp, e-mail, SMS — or the team's own notes: one of the app's `channels`. */
export interface Channel {
  /** As messages name it (`ChatterMessage.channel`): "whatsapp". */
  id: string;
  /** Its name, as people read it: "WhatsApp". */
  label: string;
  /** An icon by name, the app's own (`icons`) or Fieldia's: "mail", "phone", "chat". */
  icon?: string;
  /**
   * The team's own: a note, read by no one outside. Notes are drawn with its name and icon, offered as it among the
   * channels a reply goes by, and posted naming it. Without one, a note is the chatter's own Note.
   */
  note?: boolean;
}

/** A channel this record can be written to by, and who a message by it goes to. */
export interface ReplyChannel {
  /** The channel's id, among the app's `channels`. */
  id: string;
  /** Who a message by it goes to, as people read it: "+20 100 123 4567", "mona@example.com". Shown by the reply. */
  to?: string | null;
}

/** What `subscribe` pushes: a message new to the conversation or changed, or a message's delivery alone. */
export type ChatterChange =
  /** A message new to the record's conversation — or one shown, changed (by its id): its words, its reactions, its delivery. */
  | { type: 'message'; message: ChatterMessage }
  /** How far a message got: `failure` says why one failed. */
  | { type: 'delivery'; id: ChatterId; delivery: Delivery; failure?: string | null };

export interface ChatterSource {
  /** The record's messages, notes and events, newest first. */
  messages(record: RecordRef): Promise<ChatterMessage[]>;
  post(record: RecordRef, message: NewMessage): Promise<ChatterMessage>;
  /**
   * Store a file, to send with a message: as soon as it is chosen. `how`
   * carries what a progress bar and Cancel need — call `onProgress` as the
   * bytes go, and stop with an AbortError when `signal` aborts. Throw to
   * fail: the composer offers Retry.
   */
  upload?(record: RecordRef, file: File, how?: { signal?: AbortSignal; onProgress?: (sent: number, total: number) => void }): Promise<Attachment>;
  /** Add the person's reaction, or take it away when it is there already. Returns the message's reactions. */
  react?(record: RecordRef, messageId: ChatterId, emoji: string): Promise<Reaction[]>;
  /** People to @mention, to give an activity to, or to add as followers. */
  people?(query: string): Promise<Person[]>;
  activityTypes?(): Promise<ActivityType[]>;
  activities?(record: RecordRef): Promise<Activity[]>;
  schedule?(record: RecordRef, activity: NewActivity): Promise<Activity>;
  /** Done, with what came of it: the backend usually posts it as a message. */
  markDone?(record: RecordRef, activityId: ChatterId, feedback?: string): Promise<void>;
  cancel?(record: RecordRef, activityId: ChatterId): Promise<void>;
  followers?(record: RecordRef): Promise<Follower[]>;
  follow?(record: RecordRef, personId: ChatterId): Promise<Follower>;
  unfollow?(record: RecordRef, followerId: ChatterId): Promise<void>;
  /**
   * The channels this record can be written to by — those its customer has an address on, and the app can send by
   * — each with who it goes to. A channel of the app's left out is hidden for this record; none, and Send message
   * is hidden (a note is always the team's). Without it, every channel of the app's is offered. Asked as the record
   * is shown, and after each save.
   */
  replyChannels?(record: RecordRef): Promise<ReplyChannel[]>;
  /**
   * Send a message that failed again, by its channel: Retry under its failure. The chatter shows it on its way
   * (`pending`) at once; how far it gets then is told as any delivery is (`subscribe`, or asked again). Throw to say
   * it could not be sent again: the failure is said again, with why. Without it, no Retry is offered.
   */
  resend?(record: RecordRef, messageId: ChatterId): Promise<void>;
  /**
   * New messages and changes to those shown, pushed as they happen — over the app's own socket, server-sent events,
   * a database's listener: call `push` with each, and return what stops it. Asked as a record is shown, stopped as
   * another is shown or the chatter goes; what is pushed after is laid on none. Without it, the chatter asks
   * `messages` again now and then, where it is live (ChatterOptions.live).
   */
  subscribe?(record: RecordRef, push: (change: ChatterChange) => void): () => void;
}
