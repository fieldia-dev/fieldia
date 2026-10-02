import type { Locale } from '@fieldia/core';

/** Every word the chatter shows. `{name}`, `{n}` and `{date}` are filled in. */
export interface ChatterLabels {
  conversation: string;
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
}

export const CHATTER_LABELS: Record<Locale, ChatterLabels> = {
  en: {
    conversation: 'Conversation',
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
  },
  ar: {
    conversation: 'المحادثة',
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
  },
  de: {
    conversation: 'Unterhaltung',
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
  },
  fr: {
    conversation: 'Conversation',
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
  },
};
