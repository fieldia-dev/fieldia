import type { DesignerWords } from '../../designer-words';
import { listOf, ltr, quoteAr } from '../speak';

const q = quoteAr;

export const checks: DesignerWords['checks'] = {
  noQuestions: 'لا أسئلة في الاستبيان بعد، فلا شيء يُجاب عنه.',
  noWords: (question, label) => `${question ? 'سؤال' : 'حقل'} بلا نص بعد: سيقرأ الناس ${q(label)}.`,
  typeItsWords: 'اكتب نصه',
  defaultOptions: (label, options) => `${q(label)} ما زال يعرض ${listOf('ar', options, 'and')} خياراتٍ له.`,
  typeItsOptions: 'اكتب خياراته',
  linkedPicture: 'صورة هي رابط بلا وصف: سيقرؤها قارئ الشاشة رابطًا بلا اسم.',
  picture: 'صورة بلا وصف: من لا يرونها لا يعرفون عنها شيئًا.',
  describeIt: 'صِفها',
  emptyPage: (name) => `لا أسئلة في ${q(name)}: سيرى الناس صفحة فارغة.`,
  emptySection: (name) => `لا حقول في ${q(name)}: سيظهر مربعًا فارغًا.`,
  deletePage: 'حذف الصفحة',
  deleteSection: 'حذف القسم',
  neverShows: (name, field, value) => `لا يظهر ${q(name)} إلا عندما يساوي ${field} ${q(value)}، و${field} لم يعد يعرض هذه القيمة، فلن يظهر أبدًا.`,
  neverHolds: (name, field, value) => `${q(name)}: القاعدة ${q(`${field} يساوي ${value}`)} لن تتحقق أبدًا، لأن ${field} لم يعد يعرض هذه القيمة.`,
  removeTheRule: 'إزالة القاعدة',
  twoQuestions: (label) => `سؤالان نصهما ${q(label)}: قد لا يميّز الناس بينهما.`,
  twoFields: (label) => `حقلان نصهما ${q(label)}: قد لا يميّز الناس بينهما.`,
  renameSecond: 'إعادة تسمية الثاني',
  invalid: (path, _message) => (path ? `هذا الجزء من الصفحة غير صالح: ${ltr(path)}` : 'في الصفحة ما لا يطابق صيغتها.'),
  readsGone: (name, sentence, gone) => `${q(name)}: ${q(sentence)} تقرأ ${listOf('ar', gone, 'and')}، ولم يعد ${gone.length === 1 ? 'موجودًا' : 'موجودين'} في الصفحة.`,
  formulaBroken: (name, problem) => `${q(name)}: لم تعد صيغته تُقرأ — ${problem}.`,
  removeTheFormula: 'إزالة الصيغة',
  setBroken: (name, sentence, problem) => `${q(name)}: لم تعد ${q(sentence)} تُقرأ — ${problem}.`,
  setCannotHold: (name, sentence, problem) => `${q(name)}: ${q(sentence)} تضبط قيمة لا يمكنه حملها — ${problem}.`,
  removeIt: 'إزالتها',
  patternBroken: (name, pattern) => `${q(name)}: تعذّرت قراءة نمط القاعدة ${ltr(pattern)}.`,
  asksNothing: (name) => `${q(name)}: قاعدة لا تطلب شيئًا، فلا تتحقق من شيء.`,
  checksNothing: (name, sentence, stored) => `${q(name)}: القاعدة ${q(sentence)} لا تتحقق من شيء، لأن ${q(name)} من نوع: ${stored}.`,
};
