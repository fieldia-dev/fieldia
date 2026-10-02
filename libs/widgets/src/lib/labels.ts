import type { Locale } from '@fieldia/core';

/** Every word a widget shows on its own. `{label}` and `{name}` are filled in. */
export interface WidgetLabels {
  search: string;
  noResults: string;
  remove: string;
  clear: string;
  addLine: string;
  deleteLine: string;
  upload: string;
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
    deleteLine: 'Delete line',
    upload: 'Upload a file',
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
    deleteLine: 'حذف السطر',
    upload: 'رفع ملف',
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
    deleteLine: 'Zeile löschen',
    upload: 'Datei hochladen',
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
    deleteLine: 'Supprimer la ligne',
    upload: 'Téléverser un fichier',
    replace: 'Remplacer',
    removeFile: 'Retirer',
    dropHere: 'ou déposez-le ici',
    invalidJson: 'JSON invalide',
  },
};
