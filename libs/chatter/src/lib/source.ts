/**
 * How the chatter reaches the server: an object the app writes for its own
 * backend, as it writes a data source. Reading and posting messages are all a
 * chatter needs; each other method adds a part (uploads, reactions, mentions,
 * activities, followers), and a part whose method is missing is not shown.
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
}

export interface NewMessage {
  kind: 'message' | 'note';
  /** HTML made from what was typed, every character escaped. */
  body: string;
  attachments?: Attachment[];
  parentId?: ChatterId | null;
  /** The people @mentioned. */
  mentions?: Person[];
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
  /** The day it is due: `YYYY-MM-DD`. */
  due: string;
  assignee: Person;
}

export interface NewActivity {
  typeId: ChatterId;
  summary?: string;
  note?: string;
  due: string;
  assigneeId: ChatterId;
}

export interface Follower {
  id: ChatterId;
  person: Person;
}

export interface ChatterSource {
  /** The record's messages, notes and events, newest first. */
  messages(record: RecordRef): Promise<ChatterMessage[]>;
  post(record: RecordRef, message: NewMessage): Promise<ChatterMessage>;
  /** Store a file, to send with a message. */
  upload?(record: RecordRef, file: File): Promise<Attachment>;
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
}
