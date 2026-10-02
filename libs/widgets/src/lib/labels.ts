import type { Locale } from '@fieldia/core';

/** Every word a widget shows on its own. `{label}` and `{name}` are filled in. */
export interface WidgetLabels {
  search: string;
  noResults: string;
  remove: string;
  clear: string;
  addLine: string;
  addSection: string;
  addNote: string;
  deleteLine: string;
  upload: string;
  uploadImage: string;
  replace: string;
  removeFile: string;
  dropHere: string;
  invalidJson: string;
}

export const WIDGET_LABELS: Record<Locale, WidgetLabels> = {
  en: {
    search: 'Search…',
    noResults: 'No results',
    remove: 'Remove {name}',
    clear: 'Clear {label}',
    addLine: 'Add a line',
    addSection: 'Add a section',
    addNote: 'Add a note',
    deleteLine: 'Delete line',
    upload: 'Upload a file',
    uploadImage: 'Add a photo',
    replace: 'Replace',
    removeFile: 'Remove',
    dropHere: 'or drop it here',
    invalidJson: 'Not valid JSON',
  },
  ar: {
    search: 'بحث…',
    noResults: 'لا توجد نتائج',
    remove: 'إزالة {name}',
    clear: 'مسح {label}',
    addLine: 'إضافة سطر',
    addSection: 'إضافة قسم',
    addNote: 'إضافة ملاحظة',
    deleteLine: 'حذف السطر',
    upload: 'رفع ملف',
    uploadImage: 'إضافة صورة',
    replace: 'استبدال',
    removeFile: 'إزالة',
    dropHere: 'أو أفلته هنا',
    invalidJson: 'ليس JSON صالحًا',
  },
  de: {
    search: 'Suchen…',
    noResults: 'Keine Ergebnisse',
    remove: '{name} entfernen',
    clear: '{label} leeren',
    addLine: 'Zeile hinzufügen',
    addSection: 'Abschnitt hinzufügen',
    addNote: 'Notiz hinzufügen',
    deleteLine: 'Zeile löschen',
    upload: 'Datei hochladen',
    uploadImage: 'Foto hinzufügen',
    replace: 'Ersetzen',
    removeFile: 'Entfernen',
    dropHere: 'oder hier ablegen',
    invalidJson: 'Kein gültiges JSON',
  },
  fr: {
    search: 'Rechercher…',
    noResults: 'Aucun résultat',
    remove: 'Retirer {name}',
    clear: 'Effacer {label}',
    addLine: 'Ajouter une ligne',
    addSection: 'Ajouter une section',
    addNote: 'Ajouter une note',
    deleteLine: 'Supprimer la ligne',
    upload: 'Téléverser un fichier',
    uploadImage: 'Ajouter une photo',
    replace: 'Remplacer',
    removeFile: 'Retirer',
    dropHere: 'ou déposez-le ici',
    invalidJson: 'JSON invalide',
  },
};
