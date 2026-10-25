import { tableInChunks, wordsInChunks, type Locale } from '@fieldia/core';

/** Every word the chatter shows. `{name}`, `{n}` and `{date}` are filled in. */
export interface ChatterLabels {
  conversation: string;
  /** The History tab: the State Graph's and the list's headings. */
  stateGraph: string;
  history: string;
  /** What one change did, as a line of the history: `{name}` who, `{field}` the field's label, `{value}`, `{from}` and `{to}` its values. */
  changedTo: string;
  changedFromTo: string;
  changedFromToMore: string;
  madeChanges: string;
  cleared: string;
  /** `{kind}`: what the record is called (HistoryOptions.kind), else `recordKind`. */
  created: string;
  recordKind: string;
  /**
   * Its making told, and the conversation waiting for a first save, in the words the page names its records by
   * (`Page.records`): `{record}`. Where a language leaves one out, or the app gives its sentence before it alone, that one.
   */
  createdNoun?: string;
  notSavedNoun?: string;
  commented: string;
  /** The history's groups by age; the first is `today`. */
  yesterday: string;
  thisWeek: string;
  lastWeek: string;
  thisMonth: string;
  older: string;
  filterHistory: string;
  fieldChanges: string;
  comments: string;
  noHistory: string;
  /** The value a change replaced, as a screen reader says it. */
  wasValue: string;
  /** A heading's tools, `{name}` its heading. */
  maximiseNamed: string;
  restoreNamed: string;
  foldNamed: string;
  unfoldNamed: string;
  sendMessage: string;
  logNote: string;
  send: string;
  log: string;
  cancel: string;
  note: string;
  forFollowers: string;
  forTeam: string;
  empty: string;
  notSaved: string;
  attach: string;
  removeAttachment: string;
  react: string;
  reply: string;
  replyingTo: string;
  activities: string;
  scheduleActivity: string;
  activityType: string;
  summary: string;
  dueDate: string;
  assignedTo: string;
  schedule: string;
  markDone: string;
  whatHappened: string;
  done: string;
  cancelActivity: string;
  overdue: string;
  today: string;
  planned: string;
  dueOn: string;
  followers: string;
  addFollower: string;
  removeFollower: string;
  noFollowers: string;
  search: string;
  noOneFound: string;
  couldNotSend: string;
  /** Send pressed while files are still on their way: one, or `{n}`; and one that did not get there (`{name}`). */
  sendingAfterFile: string;
  sendingAfterFiles: string;
  notSentFile: string;
  /** A discussion's comment box and cards: when a comment was written (`{date}`), Save with nothing typed, its Save and its name; Escape asking before typed words go. */
  commentedOn: string;
  writeFirst: string;
  saveComment: string;
  comment: string;
  discardComment: string;
  discard: string;
  keepWriting: string;
  /**
   * A conversation that knows its channels (ChatterOptions.channels): the reply's choice of channel and to whom
   * (`{to}`), its box and its Send by the channel picked (`{channel}`).
   */
  sendBy: string;
  toWhom: string;
  writeBy: string;
  sendByChannel: string;
  /** Send, or Log, pressed with nothing typed and no file: said beside it. */
  typeMessageFirst: string;
  typeNoteFirst: string;
  /** A message's delivery, as its ticks say it; one not delivered, and why (`{reason}`). */
  sending: string;
  sent: string;
  delivered: string;
  read: string;
  notDelivered: string;
  notDeliveredWhy: string;
  /** A failed message sent again (the source's `resend`). */
  retry: string;
  /** Messages arriving while the conversation is shown, said politely: from `{name}`, by `{channel}`; `{n}` of them. */
  newMessage: string;
  newMessageBy: string;
  newMessages: string;
  /** An activity due at an hour: `{time}` on the page's clock, `{when}` the time alone today, else the day and the time. */
  todayAt: string;
  overdueSince: string;
  /** The time box beside the due date, as an activity is scheduled. */
  dueTime: string;
  /** A record's approval history, told among its messages (`chatterSlot`): sent for approval, and a decision at a `{level}`. */
  approvalAsked: string;
  approvalApproved: string;
  approvalRejected: string;
  /** Sent, and moved on at once as its rules asked no level of it. */
  approvalNotNeeded: string;
}

/**
 * The chatter's words in `locale`, the app's own over them; a sentence the app gives without its sentence in a page's
 * words for its records (`notSaved` without `notSavedNoun`) is said on such a page too.
 */
export function chatterLabels(locale: Locale, own: Partial<ChatterLabels> = {}): ChatterLabels {
  const words: ChatterLabels = { ...(CHATTER_LABELS[locale] ?? CHATTER_LABELS.en), ...own };
  for (const [noun, plain] of [['createdNoun', 'created'], ['notSavedNoun', 'notSaved']] as const) if (!(noun in own) && plain in own) delete words[noun];
  return words;
}

export const CHATTER_LABELS = {
  en: {
    conversation: 'Conversation',
    stateGraph: 'State Graph',
    history: 'History',
    changedTo: '{name} changed {field} to {value}',
    changedFromTo: '{name} changed {field} from {from} to {to}',
    changedFromToMore: '{name} changed {field} from {from} to {to} and made field changes',
    madeChanges: '{name} made field changes',
    cleared: '{name} cleared {field}',
    created: '{name} created the {kind}',
    createdNoun: '{name} created the {record}',
    recordKind: 'record',
    commented: '{name} commented',
    yesterday: 'Yesterday',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    thisMonth: 'This month',
    older: 'Older',
    filterHistory: 'Filter',
    fieldChanges: 'Field changes',
    comments: 'Comments',
    noHistory: 'No changes yet',
    wasValue: 'was {value}',
    maximiseNamed: 'Maximise {name}',
    restoreNamed: 'Restore {name}',
    foldNamed: 'Collapse {name}',
    unfoldNamed: 'Expand {name}',
    sendMessage: 'Send message',
    logNote: 'Log note',
    send: 'Send',
    log: 'Log',
    cancel: 'Cancel',
    note: 'Note',
    forFollowers: 'Write to the followers…',
    forTeam: 'Log an internal note…',
    empty: 'No messages yet.',
    notSaved: 'The conversation starts once the record is saved.',
    notSavedNoun: 'The conversation starts once the {record} is saved.',
    attach: 'Attach a file',
    removeAttachment: 'Remove {name}',
    react: 'Add a reaction',
    reply: 'Reply',
    replyingTo: 'Replying to {name}',
    activities: 'Activities',
    scheduleActivity: 'Schedule activity',
    activityType: 'Activity',
    summary: 'Summary',
    dueDate: 'Due date',
    assignedTo: 'Assigned to',
    schedule: 'Schedule',
    markDone: 'Mark done',
    whatHappened: 'What came of it?',
    done: 'Done',
    cancelActivity: 'Cancel activity',
    overdue: 'Overdue',
    today: 'Today',
    planned: 'Planned',
    dueOn: 'Due {date}',
    followers: 'Followers',
    addFollower: 'Add follower',
    removeFollower: 'Stop {name} following',
    noFollowers: 'No followers yet.',
    search: 'Search…',
    noOneFound: 'No one found',
    couldNotSend: 'Not sent: {reason}',
    sendingAfterFile: '1 file still uploading. Sending when it is done.',
    sendingAfterFiles: '{n} files still uploading. Sending when they are done.',
    notSentFile: 'Not sent: {name} was not uploaded. Retry it, or remove it.',
    commentedOn: 'commented {date}',
    writeFirst: 'Write a comment first.',
    saveComment: 'Save',
    comment: 'Comment',
    discardComment: 'Discard your comment?',
    discard: 'Discard',
    keepWriting: 'Keep writing',
    sendBy: 'Send by',
    toWhom: 'To {to}',
    writeBy: 'Message by {channel}…',
    sendByChannel: 'Send by {channel}',
    typeMessageFirst: 'Type a message first',
    typeNoteFirst: 'Type a note first',
    sending: 'Sending',
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    notDelivered: 'Not delivered',
    notDeliveredWhy: 'Not delivered: {reason}',
    retry: 'Retry',
    newMessage: 'New message from {name}',
    newMessageBy: 'New {channel} message from {name}',
    newMessages: '{n} new messages',
    todayAt: 'Today at {time}',
    overdueSince: 'Overdue since {when}',
    dueTime: 'Time',
    approvalAsked: 'Asked for approval',
    approvalApproved: 'Approved ({level})',
    approvalRejected: 'Rejected ({level})',
    approvalNotNeeded: 'No approval needed',
  },
} as Record<Locale, ChatterLabels>;

/**
 * Every language but English — Arabic, German and French (0.35), and Turkish, Persian, Urdu and Spanish, UNREVIEWED:
 * machine-assisted, not yet reviewed by a native speaker (locales/) — each in a chunk of its own, fetched where it is
 * spoken (`wordsReady` in @fieldia/core), English till it came: a chatter in any other language never carries them. A
 * chatter shown in one waits for them before it draws.
 */
wordsInChunks(
  tableInChunks(CHATTER_LABELS, {
    ar: () => import('./locales/ar').then((words) => words.ar),
    de: () => import('./locales/de').then((words) => words.de),
    fr: () => import('./locales/fr').then((words) => words.fr),
    tr: () => import('./locales/tr').then((words) => words.tr),
    fa: () => import('./locales/fa').then((words) => words.fa),
    ur: () => import('./locales/ur').then((words) => words.ur),
    es: () => import('./locales/es').then((words) => words.es),
  })
);
