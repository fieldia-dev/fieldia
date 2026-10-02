import type { Activity, ActivityType, Attachment, ChatterId, ChatterMessage, ChatterSource, Follower, Person, RecordRef } from './source';

export interface MemoryChatterOptions {
  /** The person using the chatter: the author of what is posted, the one who reacts. */
  me: Person;
  people?: Person[];
  activityTypes?: ActivityType[];
  /** What each record starts with, by `model:id`. */
  records?: Record<string, { messages?: ChatterMessage[]; activities?: Activity[]; followers?: Follower[] }>;
  /** The clock; the real one unless a test pins it. */
  now?: () => Date;
}

/** Who reacted with what, per message: kept apart so "mine" can be worked out for whoever asks. */
type Reactors = Map<string, Set<ChatterId>>;

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * A chatter source that keeps everything in memory: for demos, tests and
 * prototypes, the way the memory data source is for records.
 */
export function createMemoryChatter(options: MemoryChatterOptions): ChatterSource & { readonly posted: ChatterMessage[] } {
  const now = options.now ?? (() => new Date());
  const people = options.people ?? [options.me];
  const types = options.activityTypes ?? [];
  const records = new Map<string, { messages: ChatterMessage[]; activities: Activity[]; followers: Follower[]; reactions: Map<ChatterId, Reactors> }>();
  const posted: ChatterMessage[] = [];
  let next = 1000;
  const key = (record: RecordRef) => `${record.model}:${record.id}`;
  const of = (record: RecordRef) => {
    let found = records.get(key(record));
    if (!found) {
      const start = options.records?.[key(record)];
      found = {
        messages: [...(start?.messages ?? [])],
        activities: [...(start?.activities ?? [])],
        followers: [...(start?.followers ?? [])],
        reactions: new Map(),
      };
      records.set(key(record), found);
    }
    return found;
  };
  const person = (id: ChatterId) => {
    const found = people.find((p) => p.id === id);
    if (!found) throw new Error(`No person ${id}`);
    return found;
  };
  const add = (record: RecordRef, message: Omit<ChatterMessage, 'id' | 'author' | 'date'>) => {
    const made: ChatterMessage = { id: next++, author: options.me, date: now().toISOString(), ...message };
    of(record).messages.unshift(made);
    posted.push(made);
    return made;
  };

  return {
    posted,
    async messages(record) {
      const { messages, reactions } = of(record);
      // Each message's reactions as the person asking sees them.
      return messages.map((message) => {
        const reactors = reactions.get(message.id);
        if (!reactors) return { ...message };
        const list = [...reactors].filter(([, who]) => who.size).map(([emoji, who]) => ({ emoji, count: who.size, mine: who.has(options.me.id) }));
        return { ...message, reactions: list };
      });
    },
    async post(record, message) {
      return add(record, { kind: message.kind, body: message.body, attachments: message.attachments ?? [], parentId: message.parentId ?? null, mentions: message.mentions ?? [] });
    },
    async upload(_record, file) {
      // Kept as a data address, so a preview needs nothing else.
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const stored: Attachment = { id: next++, name: file.name, type: file.type || 'application/octet-stream', size: file.size, url };
      return stored;
    },
    async react(record, messageId, emoji) {
      const { reactions } = of(record);
      const reactors: Reactors = reactions.get(messageId) ?? new Map();
      reactions.set(messageId, reactors);
      const who = reactors.get(emoji) ?? new Set<ChatterId>();
      if (who.has(options.me.id)) who.delete(options.me.id);
      else who.add(options.me.id);
      reactors.set(emoji, who);
      return [...reactors].filter(([, set]) => set.size).map(([e, set]) => ({ emoji: e, count: set.size, mine: set.has(options.me.id) }));
    },
    async people(query) {
      const typed = query.trim().toLowerCase();
      return people.filter((p) => p.name.toLowerCase().includes(typed));
    },
    async activityTypes() {
      return types;
    },
    async activities(record) {
      return [...of(record).activities].sort((a, b) => a.due.localeCompare(b.due));
    },
    async schedule(record, activity) {
      const type = types.find((t) => t.id === activity.typeId);
      if (!type) throw new Error(`No activity type ${activity.typeId}`);
      const made: Activity = { id: next++, type, summary: activity.summary ?? null, note: activity.note ?? null, due: activity.due, assignee: person(activity.assigneeId) };
      of(record).activities.push(made);
      return made;
    },
    async markDone(record, activityId, feedback) {
      const { activities } = of(record);
      const done = activities.find((a) => a.id === activityId);
      if (!done) throw new Error(`No activity ${activityId}`);
      activities.splice(activities.indexOf(done), 1);
      const what = [done.type.name, done.summary].filter(Boolean).join(': ');
      add(record, { kind: 'note', body: `<p>✓ ${escape(what)} done</p>${feedback ? `<p>${escape(feedback)}</p>` : ''}` });
    },
    async cancel(record, activityId) {
      const { activities } = of(record);
      const index = activities.findIndex((a) => a.id === activityId);
      if (index >= 0) activities.splice(index, 1);
    },
    async followers(record) {
      return [...of(record).followers];
    },
    async follow(record, personId) {
      const made: Follower = { id: next++, person: person(personId) };
      of(record).followers.push(made);
      return made;
    },
    async unfollow(record, followerId) {
      const { followers } = of(record);
      const index = followers.findIndex((f) => f.id === followerId);
      if (index >= 0) followers.splice(index, 1);
    },
  };
}
