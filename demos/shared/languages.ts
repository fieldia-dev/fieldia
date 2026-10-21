import type { Values } from '@fieldia/core';

/**
 * Texts kept in two languages, each typed by a person (examples/pages/listing-languages, services-languages,
 * service-languages): a portal's listings, their titles and descriptions in Arabic and English — one still waiting for
 * its English title, one for its Arabic — and a clinic's services, named in English and Arabic, one named in English
 * alone and one in Arabic alone, as a clinic's list is while its staff fill it in.
 */

/** A portal's listings, as its agents typed them. */
export function bilingualListings(): Record<number, Values> {
  return {
    1: {
      title: { ar: 'فيلا بحديقة في التجمع الخامس', en: 'Garden villa in the Fifth Settlement' },
      description: {
        ar: 'أربع غرف نوم وحديقة خاصة وحمام سباحة، على بُعد خطوات من الجامعة الأمريكية.',
        en: 'Four bedrooms, a private garden and a pool, a short walk from the American University.',
      },
      unit_type: 'villa',
      district: 'new_cairo',
      bedrooms: 4,
      price: 24500000,
      agent: 'Mona Adel',
    },
    2: {
      title: { ar: 'شقة بإطلالة على النيل في الزمالك' },
      description: { en: 'Three bedrooms on the eighth floor, the Nile from every room, a doorman day and night.' },
      unit_type: 'apartment',
      district: 'zamalek',
      bedrooms: 3,
      price: 18000000,
      agent: 'Karim Nabil',
    },
    3: {
      title: { en: 'Studio by the Maadi metro' },
      description: { en: 'A furnished studio two minutes from the metro, its rent paid three months ahead.', ar: 'استوديو مفروش على بُعد دقيقتين من المترو.' },
      unit_type: 'studio',
      district: 'maadi',
      bedrooms: 0,
      price: 3200000,
      agent: 'Sara Haddad',
    },
  };
}

/** A clinic's services, as its staff named them: most in both languages, two still in one. */
export function bilingualServices(): Record<number, Values> {
  const service = (en: string | null, ar: string | null, category: string, minutes: number, price: number, notes?: Values['notes']): Values => ({
    name: { ...(en ? { en } : {}), ...(ar ? { ar } : {}) },
    category,
    minutes,
    price,
    notes: notes ?? null,
  });
  return {
    1: service('Teeth cleaning', 'تنظيف الأسنان', 'dental', 30, 900, { en: '<p>Eat as usual before the visit.</p>', ar: '<p>تناول طعامك كالمعتاد قبل الزيارة.</p>' }),
    2: service('Teeth whitening', 'تبييض الأسنان', 'dental', 60, 4500),
    3: service('Tooth filling', 'حشو الأسنان', 'dental', 45, 1200),
    4: service(null, 'حشو تجميلي', 'dental', 45, 1800),
    5: service('Skin consultation', 'استشارة جلدية', 'skin', 20, 700),
    6: service('Laser hair removal', 'إزالة الشعر بالليزر', 'skin', 40, 2500),
    7: service('Chemical peel', null, 'skin', 45, 3000),
    8: service('Annual check-up', 'الفحص السنوي', 'checkup', 60, 1500, { en: '<p>Come fasting: nothing to eat after midnight.</p>' }),
  };
}
