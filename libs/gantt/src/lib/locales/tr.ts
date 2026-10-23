import type { GanttLabels } from '../labels';

/**
 * The Gantt timeline's own words in Turkish. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 * A blank never takes a suffix; after a number the page's noun is singular (`{n} {record}`).
 */
export const tr: GanttLabels = {
  timeline: 'Zaman çizelgesi',
  today: 'Bugün',
  zooms: { day: 'Günler', week: 'Haftalar', month: 'Aylar' },
  showAs: 'Zaman çizelgesi görünümü',
  noGroup: 'Yok',
  collapse: '{name} grubunu gizle',
  expand: '{name} grubunu göster',
  holds: '{n} kayıt',
  holdsOne: '1 kayıt',
  holdsNoun: '{n} {record}',
  holdsNounOne: '1 {record}',
  loadFailed: 'Zaman çizelgesi yüklenemedi.',
  retry: 'Yeniden dene',
  nothing: 'Zaman çizelgesinde gösterilecek bir şey yok.',
  tooMany: '{total} sonuçtan ilk {shown} tanesi gösteriliyor: tümünü görmek için aramayı daraltın.',
  notPlanned: 'Henüz başlangıç tarihi yok',
  fromTo: '{from} ile {to} arası',
  on: '{day} tarihinde',
  days: '{n} gün',
  dayOne: '1 gün',
  waitsFor: 'bekliyor: {names}',
  late: '{name} bitmeden başlıyor',
  keysOpen: 'Enter ile açılır.',
  keysMove: 'Sol ve sağ ok tuşları onu bir gün taşır; Shift ile bitişini taşır.',
  keysRows: 'Yukarı ve aşağı ok tuşları üstteki ya da alttaki çubuğa geçer.',
  moved: '{name} taşındı: {from} ile {to} arası.',
  stretched: '{name} artık şu tarihte bitiyor: {when}.',
  started: '{name} artık şu tarihte başlıyor: {when}.',
  undo: 'Geri al',
  undone: 'Eski hâline getirildi.',
  close: 'Kapat',
  notMoved: 'Taşınmadı: {why}',
  cannotMove: 'Bunu değiştiremezsiniz.',
  edgeBefore: 'Gösterilen günlerden önce: {n}',
  edgeAfter: 'Gösterilen günlerden sonra: {n}',
};
