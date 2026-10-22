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
  ar: {
    conversation: 'المحادثة',
    stateGraph: 'مخطط الحالات',
    history: 'سجل التغييرات',
    changedTo: 'غيّر {name} {field} إلى {value}',
    changedFromTo: 'غيّر {name} {field} من {from} إلى {to}',
    changedFromToMore: 'غيّر {name} {field} من {from} إلى {to} وغيّر حقولًا أخرى',
    madeChanges: 'غيّر {name} حقولًا',
    cleared: 'أفرغ {name} {field}',
    created: 'أنشأ {name} {kind}',
    recordKind: 'السجل',
    commented: 'علّق {name}',
    yesterday: 'أمس',
    thisWeek: 'هذا الأسبوع',
    lastWeek: 'الأسبوع الماضي',
    thisMonth: 'هذا الشهر',
    older: 'أقدم',
    filterHistory: 'تصفية',
    fieldChanges: 'تغييرات الحقول',
    comments: 'التعليقات',
    noHistory: 'لا تغييرات بعد',
    wasValue: 'كان {value}',
    maximiseNamed: 'تكبير {name}',
    restoreNamed: 'إعادة {name} إلى حجمه',
    foldNamed: 'طيّ {name}',
    unfoldNamed: 'فتح {name}',
    sendMessage: 'إرسال رسالة',
    logNote: 'تسجيل ملاحظة',
    send: 'إرسال',
    log: 'تسجيل',
    cancel: 'إلغاء',
    note: 'ملاحظة',
    forFollowers: 'اكتب إلى المتابعين…',
    forTeam: 'سجّل ملاحظة داخلية…',
    empty: 'لا رسائل بعد.',
    notSaved: 'تبدأ المحادثة بعد حفظ السجل.',
    attach: 'إرفاق ملف',
    removeAttachment: 'إزالة {name}',
    react: 'أضف تفاعلًا',
    reply: 'رد',
    replyingTo: 'ردًا على {name}',
    activities: 'الأنشطة',
    scheduleActivity: 'جدولة نشاط',
    activityType: 'النشاط',
    summary: 'الملخص',
    dueDate: 'تاريخ الاستحقاق',
    assignedTo: 'مُسند إلى',
    schedule: 'جدولة',
    markDone: 'تم الإنجاز',
    whatHappened: 'ما الذي نتج عنه؟',
    done: 'تم',
    cancelActivity: 'إلغاء النشاط',
    overdue: 'متأخر',
    today: 'اليوم',
    planned: 'مخطط',
    dueOn: 'يستحق في {date}',
    followers: 'المتابعون',
    addFollower: 'إضافة متابع',
    removeFollower: 'إيقاف متابعة {name}',
    noFollowers: 'لا متابعين بعد.',
    search: 'بحث…',
    noOneFound: 'لم يُعثر على أحد',
    couldNotSend: 'لم يُرسل: {reason}',
    sendingAfterFile: 'ملف واحد ما زال يُرفع. سيُرسل عند انتهائه.',
    sendingAfterFiles: 'ما زالت الملفات تُرفع: {n}. سيُرسل عند انتهائها.',
    notSentFile: 'لم يُرسل: لم يُرفع {name}. أعد المحاولة أو أزله.',
    commentedOn: 'علّق في {date}',
    writeFirst: 'اكتب تعليقًا أولاً.',
    saveComment: 'حفظ',
    comment: 'تعليق',
    discardComment: 'هل تريد تجاهل تعليقك؟',
    discard: 'تجاهل',
    keepWriting: 'متابعة الكتابة',
    sendBy: 'الإرسال عبر',
    toWhom: 'إلى {to}',
    writeBy: 'رسالة عبر {channel}…',
    sendByChannel: 'إرسال عبر {channel}',
    typeMessageFirst: 'اكتب رسالة أولًا',
    typeNoteFirst: 'اكتب ملاحظة أولًا',
    sending: 'جارٍ الإرسال',
    sent: 'أُرسلت',
    delivered: 'وصلت',
    read: 'قُرئت',
    notDelivered: 'لم تصل',
    notDeliveredWhy: 'لم تصل: {reason}',
    retry: 'إعادة المحاولة',
    newMessage: 'رسالة جديدة من {name}',
    newMessageBy: 'رسالة جديدة عبر {channel} من {name}',
    newMessages: 'رسائل جديدة: {n}',
    todayAt: 'اليوم الساعة {time}',
    overdueSince: 'متأخر منذ {when}',
    dueTime: 'الوقت',
    approvalAsked: 'طلب الموافقة',
    approvalApproved: 'وافق ({level})',
    approvalRejected: 'رفض ({level})',
    approvalNotNeeded: 'لا حاجة إلى موافقة',
  },
  de: {
    conversation: 'Unterhaltung',
    stateGraph: 'Statusverlauf',
    history: 'Verlauf',
    changedTo: '{name} hat {field} in {value} geändert',
    changedFromTo: '{name} hat {field} von {from} in {to} geändert',
    changedFromToMore: '{name} hat {field} von {from} in {to} und weitere Felder geändert',
    madeChanges: '{name} hat Felder geändert',
    cleared: '{name} hat {field} geleert',
    created: '{name} hat {kind} erstellt',
    recordKind: 'den Datensatz',
    commented: '{name} hat kommentiert',
    yesterday: 'Gestern',
    thisWeek: 'Diese Woche',
    lastWeek: 'Letzte Woche',
    thisMonth: 'Diesen Monat',
    older: 'Älter',
    filterHistory: 'Filtern',
    fieldChanges: 'Feldänderungen',
    comments: 'Kommentare',
    noHistory: 'Noch keine Änderungen',
    wasValue: 'war {value}',
    maximiseNamed: '{name} maximieren',
    restoreNamed: '{name} wiederherstellen',
    foldNamed: '{name} einklappen',
    unfoldNamed: '{name} ausklappen',
    sendMessage: 'Nachricht senden',
    logNote: 'Notiz erfassen',
    send: 'Senden',
    log: 'Erfassen',
    cancel: 'Abbrechen',
    note: 'Notiz',
    forFollowers: 'An die Follower schreiben…',
    forTeam: 'Eine interne Notiz erfassen…',
    empty: 'Noch keine Nachrichten.',
    notSaved: 'Die Unterhaltung beginnt, sobald der Datensatz gespeichert ist.',
    attach: 'Datei anhängen',
    removeAttachment: '{name} entfernen',
    react: 'Reaktion hinzufügen',
    reply: 'Antworten',
    replyingTo: 'Antwort an {name}',
    activities: 'Aktivitäten',
    scheduleActivity: 'Aktivität planen',
    activityType: 'Aktivität',
    summary: 'Zusammenfassung',
    dueDate: 'Fällig am',
    assignedTo: 'Zugewiesen an',
    schedule: 'Planen',
    markDone: 'Als erledigt markieren',
    whatHappened: 'Was ist daraus geworden?',
    done: 'Erledigt',
    cancelActivity: 'Aktivität streichen',
    overdue: 'Überfällig',
    today: 'Heute',
    planned: 'Geplant',
    dueOn: 'Fällig am {date}',
    followers: 'Follower',
    addFollower: 'Follower hinzufügen',
    removeFollower: '{name} nicht mehr folgen lassen',
    noFollowers: 'Noch keine Follower.',
    search: 'Suchen…',
    noOneFound: 'Niemand gefunden',
    couldNotSend: 'Nicht gesendet: {reason}',
    sendingAfterFile: '1 Datei wird noch hochgeladen. Gesendet wird, sobald sie fertig ist.',
    sendingAfterFiles: '{n} Dateien werden noch hochgeladen. Gesendet wird, sobald sie fertig sind.',
    notSentFile: 'Nicht gesendet: {name} wurde nicht hochgeladen. Erneut versuchen oder entfernen.',
    commentedOn: 'hat am {date} kommentiert',
    writeFirst: 'Schreiben Sie zuerst einen Kommentar.',
    saveComment: 'Speichern',
    comment: 'Kommentar',
    discardComment: 'Kommentar verwerfen?',
    discard: 'Verwerfen',
    keepWriting: 'Weiterschreiben',
    sendBy: 'Senden per',
    toWhom: 'An {to}',
    writeBy: 'Nachricht per {channel}…',
    sendByChannel: 'Per {channel} senden',
    typeMessageFirst: 'Schreiben Sie zuerst eine Nachricht',
    typeNoteFirst: 'Schreiben Sie zuerst eine Notiz',
    sending: 'Wird gesendet',
    sent: 'Gesendet',
    delivered: 'Zugestellt',
    read: 'Gelesen',
    notDelivered: 'Nicht zugestellt',
    notDeliveredWhy: 'Nicht zugestellt: {reason}',
    retry: 'Erneut versuchen',
    newMessage: 'Neue Nachricht von {name}',
    newMessageBy: 'Neue Nachricht per {channel} von {name}',
    newMessages: '{n} neue Nachrichten',
    todayAt: 'Heute um {time}',
    overdueSince: 'Überfällig seit {when}',
    dueTime: 'Uhrzeit',
    approvalAsked: 'Hat um Genehmigung gebeten',
    approvalApproved: 'Genehmigt ({level})',
    approvalRejected: 'Abgelehnt ({level})',
    approvalNotNeeded: 'Keine Genehmigung nötig',
  },
  fr: {
    conversation: 'Conversation',
    stateGraph: 'Graphique des états',
    history: 'Historique',
    changedTo: '{name} a changé {field} en {value}',
    changedFromTo: '{name} a changé {field} de {from} en {to}',
    changedFromToMore: '{name} a changé {field} de {from} en {to} et modifié d’autres champs',
    madeChanges: '{name} a modifié des champs',
    cleared: '{name} a vidé {field}',
    created: '{name} a créé {kind}',
    recordKind: 'l’enregistrement',
    commented: '{name} a commenté',
    yesterday: 'Hier',
    thisWeek: 'Cette semaine',
    lastWeek: 'La semaine dernière',
    thisMonth: 'Ce mois-ci',
    older: 'Plus ancien',
    filterHistory: 'Filtrer',
    fieldChanges: 'Modifications de champs',
    comments: 'Commentaires',
    noHistory: 'Pas encore de modification',
    wasValue: 'était {value}',
    maximiseNamed: 'Agrandir {name}',
    restoreNamed: 'Rétablir {name}',
    foldNamed: 'Replier {name}',
    unfoldNamed: 'Déplier {name}',
    sendMessage: 'Envoyer un message',
    logNote: 'Noter',
    send: 'Envoyer',
    log: 'Noter',
    cancel: 'Annuler',
    note: 'Note',
    forFollowers: 'Écrire aux abonnés…',
    forTeam: 'Noter en interne…',
    empty: 'Pas encore de message.',
    notSaved: 'La conversation commence une fois l’enregistrement sauvegardé.',
    attach: 'Joindre un fichier',
    removeAttachment: 'Retirer {name}',
    react: 'Réagir',
    reply: 'Répondre',
    replyingTo: 'En réponse à {name}',
    activities: 'Activités',
    scheduleActivity: 'Planifier une activité',
    activityType: 'Activité',
    summary: 'Résumé',
    dueDate: 'Échéance',
    assignedTo: 'Assignée à',
    schedule: 'Planifier',
    markDone: 'Marquer comme faite',
    whatHappened: 'Qu’en est-il sorti ?',
    done: 'Faite',
    cancelActivity: 'Annuler l’activité',
    overdue: 'En retard',
    today: 'Aujourd’hui',
    planned: 'Prévue',
    dueOn: 'Échéance le {date}',
    followers: 'Abonnés',
    addFollower: 'Ajouter un abonné',
    removeFollower: 'Désabonner {name}',
    noFollowers: 'Pas encore d’abonné.',
    search: 'Rechercher…',
    noOneFound: 'Personne trouvée',
    couldNotSend: 'Non envoyé : {reason}',
    sendingAfterFile: '1 fichier encore en cours d’envoi. Envoi dès qu’il est arrivé.',
    sendingAfterFiles: '{n} fichiers encore en cours d’envoi. Envoi dès qu’ils sont arrivés.',
    notSentFile: 'Non envoyé : {name} n’a pas été envoyé. Réessayez, ou retirez-le.',
    commentedOn: 'a commenté le {date}',
    writeFirst: 'Écrivez d’abord un commentaire.',
    saveComment: 'Enregistrer',
    comment: 'Commentaire',
    discardComment: 'Abandonner votre commentaire ?',
    discard: 'Abandonner',
    keepWriting: 'Continuer à écrire',
    sendBy: 'Envoyer par',
    toWhom: 'À {to}',
    writeBy: 'Message par {channel}…',
    sendByChannel: 'Envoyer par {channel}',
    typeMessageFirst: 'Écrivez d’abord un message',
    typeNoteFirst: 'Écrivez d’abord une note',
    sending: 'Envoi en cours',
    sent: 'Envoyé',
    delivered: 'Distribué',
    read: 'Lu',
    notDelivered: 'Non distribué',
    notDeliveredWhy: 'Non distribué : {reason}',
    retry: 'Réessayer',
    newMessage: 'Nouveau message de {name}',
    newMessageBy: 'Nouveau message par {channel} de {name}',
    newMessages: '{n} nouveaux messages',
    todayAt: 'Aujourd’hui à {time}',
    overdueSince: 'En retard depuis {when}',
    dueTime: 'Heure',
    approvalAsked: 'A demandé l’approbation',
    approvalApproved: 'Approuvé ({level})',
    approvalRejected: 'Refusé ({level})',
    approvalNotNeeded: 'Aucune approbation nécessaire',
  },
} as Record<Locale, ChatterLabels>;

/**
 * Turkish, Persian, Urdu and Spanish — UNREVIEWED: machine-assisted, not yet reviewed by a native speaker (locales/) —
 * each in a chunk of its own, fetched where it is spoken (`wordsReady` in @fieldia/core), English till it came: a chatter
 * in any other language never carries them. A chatter shown in one waits for them before it draws.
 */
wordsInChunks(
  tableInChunks(CHATTER_LABELS, {
    tr: () => import('./locales/tr').then((words) => words.tr),
    fa: () => import('./locales/fa').then((words) => words.fa),
    ur: () => import('./locales/ur').then((words) => words.ur),
    es: () => import('./locales/es').then((words) => words.es),
  })
);
