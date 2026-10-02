import type { Locale } from '@fieldia/core';

/** Every word the viewer shows, so a page can be translated. `{n}`, `{total}` and `{time}` are filled in. */
export interface ViewerLabels {
  save: string;
  /** Switching a read-only form to editing, and back. */
  edit: string;
  done: string;
  discard: string;
  saving: string;
  saved: string;
  submit: string;
  next: string;
  back: string;
  /** Passing over an optional step. */
  skip: string;
  /** The list of a wizard's steps, for screen readers. */
  steps: string;
  stepOf: string;
  submitted: string;
  submitAnother: string;
  draftFound: string;
  restore: string;
  discardDraft: string;
  ok: string;
  cancel: string;
  loading: string;
  /** A form in a dialog: the button that saves it and closes the dialog, and the × that closes it. */
  saveClose: string;
  close: string;
  /** The × on an alert that may be dismissed. */
  dismiss: string;
  /** Saving again after a save failed. */
  retry: string;
  notSaved: string;
  notSent: string;
  /** What was not saved or sent, and the fields to look at. */
  checkFields: string;
  /** The banner when the server cannot be reached. */
  offline: string;
}

export const VIEWER_LABELS: Record<Locale, ViewerLabels> = {
  en: {
    save: 'Save',
    edit: 'Edit',
    done: 'Done',
    discard: 'Discard',
    saving: 'Saving…',
    saved: 'Saved',
    submit: 'Submit',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    steps: 'Steps',
    stepOf: 'Step {n} of {total}',
    submitted: 'Thank you. Your answers were sent.',
    submitAnother: 'Submit another response',
    draftFound: 'You have unsaved answers from {time}.',
    restore: 'Restore',
    discardDraft: 'Discard',
    ok: 'OK',
    cancel: 'Cancel',
    loading: 'Loading…',
    saveClose: 'Save & Close',
    close: 'Close',
    dismiss: 'Dismiss',
    retry: 'Retry',
    notSaved: 'Not saved',
    notSent: 'Not sent',
    checkFields: '{what}. Check: {fields}',
    offline: 'Could not reach the server. Your changes are still here.',
  },
  ar: {
    save: 'حفظ',
    edit: 'تعديل',
    done: 'تم',
    discard: 'تجاهل',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    submit: 'إرسال',
    next: 'التالي',
    back: 'رجوع',
    skip: 'تخطٍّ',
    steps: 'الخطوات',
    stepOf: 'الخطوة {n} من {total}',
    submitted: 'شكرًا لك. تم إرسال إجاباتك.',
    submitAnother: 'إرسال إجابة أخرى',
    draftFound: 'لديك إجابات غير محفوظة من {time}.',
    restore: 'استعادة',
    discardDraft: 'تجاهل',
    ok: 'موافق',
    cancel: 'إلغاء',
    loading: 'جارٍ التحميل…',
    saveClose: 'حفظ وإغلاق',
    close: 'إغلاق',
    dismiss: 'إخفاء',
    retry: 'أعد المحاولة',
    notSaved: 'لم يُحفظ',
    notSent: 'لم يُرسل',
    checkFields: '{what}. راجِع: {fields}',
    offline: 'تعذّر الوصول إلى الخادم. تعديلاتك ما زالت هنا.',
  },
  de: {
    save: 'Speichern',
    edit: 'Bearbeiten',
    done: 'Fertig',
    discard: 'Verwerfen',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    submit: 'Absenden',
    next: 'Weiter',
    back: 'Zurück',
    skip: 'Überspringen',
    steps: 'Schritte',
    stepOf: 'Schritt {n} von {total}',
    submitted: 'Vielen Dank. Ihre Antworten wurden gesendet.',
    submitAnother: 'Weitere Antwort senden',
    draftFound: 'Sie haben ungespeicherte Antworten vom {time}.',
    restore: 'Wiederherstellen',
    discardDraft: 'Verwerfen',
    ok: 'OK',
    cancel: 'Abbrechen',
    loading: 'Wird geladen…',
    saveClose: 'Speichern und schließen',
    close: 'Schließen',
    dismiss: 'Ausblenden',
    retry: 'Erneut versuchen',
    notSaved: 'Nicht gespeichert',
    notSent: 'Nicht gesendet',
    checkFields: '{what}. Bitte prüfen: {fields}',
    offline: 'Der Server ist nicht erreichbar. Ihre Änderungen sind noch da.',
  },
  fr: {
    save: 'Enregistrer',
    edit: 'Modifier',
    done: 'Terminé',
    discard: 'Annuler les modifications',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    submit: 'Envoyer',
    next: 'Suivant',
    back: 'Retour',
    skip: 'Passer',
    steps: 'Étapes',
    stepOf: 'Étape {n} sur {total}',
    submitted: 'Merci. Vos réponses ont été envoyées.',
    submitAnother: 'Envoyer une autre réponse',
    draftFound: 'Vous avez des réponses non enregistrées du {time}.',
    restore: 'Restaurer',
    discardDraft: 'Ignorer',
    ok: 'OK',
    cancel: 'Annuler',
    loading: 'Chargement…',
    saveClose: 'Enregistrer et fermer',
    close: 'Fermer',
    dismiss: 'Masquer',
    retry: 'Réessayer',
    notSaved: 'Non enregistré',
    notSent: 'Non envoyé',
    checkFields: '{what}. À vérifier : {fields}',
    offline: 'Le serveur est injoignable. Vos modifications sont toujours là.',
  },
};

/** English, kept under its old name. */
export const DEFAULT_LABELS: ViewerLabels = VIEWER_LABELS.en;
