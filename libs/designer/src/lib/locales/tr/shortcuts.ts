import type { DesignerWords } from '../../designer-words';

/** The designer's words in Turkish: the sheet of shortcuts — its groups, when each works, and the keys of the bar and of typing (the canvas's, the outline's and the clipboard's are theirs). UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const shortcuts: DesignerWords['shortcuts'] = {
  title: 'Klavye kısayolları',
  findKey: 'Tuş bul',
  findPlaceholder: 'Bir tuşu ya da ne yaptığını arayın',
  close: 'Kapat',
  keys: 'Tuşlar',
  none: 'Bunu yapan bir tuş yok.',
  groups: { Anywhere: 'Her yerde', Canvas: 'Tasarım alanı', Outline: 'Ana hat', Typing: 'Yazarken' },
  when: {
    Anywhere: 'Yazı yazılan bir kutunun dışında',
    Canvas: 'Gelişmiş modda, bir öğe seçiliyken',
    Outline: 'Ana hattın bir satırı odaktayken',
    Typing: 'Bir etikette, yardım metninde ya da başlıkta',
  },
  anywhere: [
    ['⌘K ya da /', 'Her şeyde ara: bir alan, tür, ayar ya da eylem'],
    ['⌘Z', 'Geri al'],
    ['⌘⇧Z ya da ⌘Y', 'Yinele'],
    ['?', 'Bu tuş listesi'],
    ['Esc', 'Seçimi bırak'],
  ],
  typing: [
    ['Enter', 'Etiketten yardım metnine, yardım metninden dışarı'],
    ['Esc', 'Kutudan çık ve öğenin seçimini bırak'],
    ['⌘C / ⌘X / ⌘V', 'Metni her zamanki gibi kopyala, kes ve yapıştır'],
  ],
  surveyTyping: [
    ['⌘⇧Enter', 'Bundan sonra bir soru ekle'],
    ['⌘⇧D', 'Soruyu çoğalt'],
    ['⌘⇧K / ⌘⇧J', 'Soruyu yukarı ya da aşağı taşı'],
  ],
};
