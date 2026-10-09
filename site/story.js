// fieldia.dev's front page, chapter 3: one record grows as the reader scrolls. A stage stays pinned
// while the captions change; each chapter sets the stage to where the story stands, so scrolling
// back works as well as forward. The record is the real viewer (fieldia.js); the chatter, the list
// and the server around it are drawn. With reduced motion, the chapters read as a list beside a
// finished stage.
(function () {
  'use strict';
  var section = document.getElementById('story');
  if (!section || !window.Fieldia) return;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scroller = section.querySelector('.story-scroll');
  var stage = section.querySelector('.story-stage');
  var screen = section.querySelector('.story-screen');
  var host = document.getElementById('story-form');
  var captions = Array.prototype.slice.call(section.querySelectorAll('.story-caption'));
  var dots = Array.prototype.slice.call(section.querySelectorAll('.story-rail button'));
  var rule = section.querySelector('.story-rule');
  var STEPS = captions.length;

  // ---- the record: one page, in English and in Arabic ----
  var WORDS = {
    en: {
      title: 'Office fit-out', name: 'Quote', email: 'Customer email', budget: 'Budget', sure: 'How likely to sign', tags: 'Rooms',
      start: 'Start date', visit: 'Site visit', visitOn: 'Visit on', state: 'Status', draft: 'Quotation', sent: 'Sent', confirmed: 'Confirmed',
      confirm: 'Confirm', lines: 'Items', item: 'Item', qty: 'Quantity', price: 'Unit price', subtotal: 'Subtotal', total: 'Total',
      rooms: ['Reception', 'Meeting rooms', 'Open office'], items: ['Standing desk', 'Ergonomic chair', 'LED panel'],
    },
    ar: {
      title: 'تجهيز مكتب', name: 'عرض السعر', email: 'بريد العميل', budget: 'الميزانية', sure: 'احتمال التوقيع', tags: 'الغرف',
      start: 'تاريخ البدء', visit: 'زيارة الموقع', visitOn: 'موعد الزيارة', state: 'الحالة', draft: 'عرض سعر', sent: 'مُرسل', confirmed: 'مؤكد',
      confirm: 'تأكيد', lines: 'البنود', item: 'البند', qty: 'الكمية', price: 'سعر الوحدة', subtotal: 'المجموع الفرعي', total: 'الإجمالي',
      rooms: ['الاستقبال', 'غرف الاجتماعات', 'المكتب المفتوح'], items: ['مكتب وقوف', 'كرسي مريح', 'لوح إضاءة'],
    },
  };
  function pageIn(w) {
    var node = function (id, field, extra) { return Object.assign({ type: 'field', id: id, field: field }, extra || {}); };
    return {
      fieldia: '0.1', id: 'fit-out', title: w.title, data: { kind: 'record', model: 'quote' }, maxWidth: 'full', look: { density: 'compact' },
      fields: {
        name: { type: 'char', label: w.name },
        state: { type: 'selection', label: w.state, options: [{ value: 'draft', label: w.draft }, { value: 'sent', label: w.sent }, { value: 'confirmed', label: w.confirmed }] },
        email: { type: 'char', label: w.email },
        budget: { type: 'monetary', label: w.budget, currency: 'USD' },
        sure: { type: 'integer', label: w.sure, min: 1, max: 5 },
        tag_ids: { type: 'many2many', label: w.tags, relation: 'room' },
        start: { type: 'date', label: w.start },
        site_visit: { type: 'boolean', label: w.visit },
        visit_on: { type: 'date', label: w.visitOn },
        line_ids: {
          type: 'one2many', label: w.lines, relation: 'quote.line',
          fields: {
            item: { type: 'char', label: w.item },
            qty: { type: 'integer', label: w.qty },
            price: { type: 'monetary', label: w.price, currency: 'USD' },
            subtotal: { type: 'monetary', label: w.subtotal, currency: 'USD', compute: 'qty * price' },
          },
        },
        total: { type: 'monetary', label: w.total, currency: 'USD', compute: "sum(line_ids, 'subtotal')" },
      },
      layout: {
        type: 'sheet', id: 'sheet', title: { field: 'name' }, statusbar: { field: 'state' },
        buttons: [{ type: 'button', id: 'b-confirm', label: w.confirm, style: 'primary', steps: [{ do: 'set', field: 'state', value: "'confirmed'" }], invisible: "state == 'confirmed'" }],
        children: [
          { type: 'section', id: 'head', columns: 2, children: [
            node('f-email', 'email', { widget: 'email' }), node('f-budget', 'budget'), node('f-sure', 'sure', { widget: 'rating', options: { clear: false } }),
            node('f-tags', 'tag_ids', { widget: 'tags' }), node('f-start', 'start'), node('f-visit', 'site_visit', { widget: 'toggle' }),
            node('f-visit-on', 'visit_on', { invisible: 'not site_visit', required: 'site_visit' }),
          ] },
          node('f-lines', 'line_ids'),
          { type: 'section', id: 'totals', columns: 2, children: [{ type: 'spacer', id: 'gap' }, node('f-total', 'total')] },
        ],
      },
    };
  }
  /** What the record holds at each chapter. */
  function valuesAt(step, w) {
    var v = { name: 'Q-2026-0142 · Delta Foods', email: 'nadia@deltafoods.example', state: 'draft' };
    if (step >= 1) Object.assign(v, { budget: 24000, sure: 4, start: '2026-11-02', tag_ids: [{ id: 1, label: w.rooms[0] }, { id: 2, label: w.rooms[1] }] });
    if (step >= 2) Object.assign(v, { site_visit: true, visit_on: '2026-10-20' });
    if (step >= 3) v.state = 'confirmed';
    return v;
  }
  /** Which parts of the sheet a chapter has shown: none of these before its chapter. */
  var ARRIVES = { 'f-budget': 1, 'f-sure': 1, 'f-tags': 1, 'f-start': 1, 'f-visit': 1, 'f-visit-on': 2, 'f-lines': 4, 'f-total': 4 };

  var locale = null;
  var viewer = null;
  var loaded = false;
  var wanted = 0;
  var shown = -1;
  var cycling = null;
  var lineKeys = [];
  function mount(code) {
    if (viewer) viewer.destroy();
    var w = WORDS[code];
    locale = code;
    // The quote as it was saved: what the story changes, it changes from here.
    var source = Fieldia.createMemoryDataSource({ records: { quote: { 1: valuesAt(0, w) }, room: { 1: { name: w.rooms[0] }, 2: { name: w.rooms[1] }, 3: { name: w.rooms[2] } } } });
    viewer = Fieldia.mountViewer(host, { page: pageIn(w), dataSource: source, recordId: 1, skin: 'outlined', locale: code === 'ar' ? 'ar' : undefined });
    host.dir = code === 'ar' ? 'rtl' : 'ltr';
    lineKeys = [];
    shown = -1;
    // The record loads first: a chapter set before it would be undone by the load.
    loaded = false;
    var mine = viewer;
    viewer.form.settled().then(function () {
      if (mine !== viewer) return;
      loaded = true;
      show(wanted);
    });
  }

  /** The lines and their quantities at a chapter: counted up as the chapter arrives. */
  function lines(step, w, animate) {
    var form = viewer.form;
    if (step < 4) {
      lineKeys.forEach(function (k) { form.removeLine('line_ids', k); });
      lineKeys = [];
      return;
    }
    var rows = [[w.items[0], 12, 640], [w.items[1], 12, 410], [w.items[2], 8, 95]];
    if (!lineKeys.length) lineKeys = rows.map(function (r) { return form.addLine('line_ids', { item: r[0], qty: animate ? 1 : r[1], price: r[2] }); });
    if (!animate) return;
    var tick = 1;
    (function count() {
      if (shown !== 4 || !viewer) return;
      tick += 1;
      rows.forEach(function (r, i) { form.updateLine('line_ids', lineKeys[i], 'qty', Math.min(r[1], tick)); });
      if (tick < 12) setTimeout(count, 110);
    })();
  }

  var THEMES = ['material', 'fluent', 'odoo', 'google-forms', 'apple'];
  var NAMES = { material: 'Material', fluent: 'Fluent', odoo: 'Odoo', 'google-forms': 'Google Forms', apple: 'Apple' };
  var themeName = section.querySelector('.story-theme');
  function themes(step) {
    if (cycling) { clearInterval(cycling); cycling = null; }
    if (step !== 7) {
      viewer.setTheme(null);
      viewer.setSkin('outlined');
      return;
    }
    var at = 0;
    var wear = function () {
      var t = THEMES[at % THEMES.length];
      viewer.setTheme(t);
      viewer.setSkin(Fieldia.skinFor(undefined, t));
      themeName.textContent = NAMES[t];
      at += 1;
    };
    wear();
    if (!calm) cycling = setInterval(wear, 1100);
  }

  /** The rule's chip, beside the field it shows. */
  function placeRule() {
    var target = host.querySelector('[data-node="f-visit-on"]');
    if (!target || !rule) return;
    var box = target.getBoundingClientRect();
    var frame = screen.getBoundingClientRect();
    var scale = frame.width / screen.offsetWidth || 1;
    rule.style.setProperty('--x', ((box.left - frame.left) / scale) + 'px');
    rule.style.setProperty('--y', ((box.bottom - frame.top) / scale + 6) + 'px');
  }

  function show(step) {
    wanted = step;
    var language = step === 8 ? 'ar' : 'en';
    if (language !== locale) mount(language);
    if (!loaded || step === shown) return;
    var w = WORDS[locale];
    var forward = step > shown;
    shown = step;
    stage.setAttribute('data-step', String(step));
    viewer.form.setValues(valuesAt(step, w));
    lines(step, w, forward && step === 4 && !calm);
    Object.keys(ARRIVES).forEach(function (id) {
      var el = host.querySelector('[data-node="' + id + '"]');
      if (!el) return;
      var on = step >= ARRIVES[id];
      if (on && el.classList.contains('story-off') && forward && !calm) el.classList.add('story-arrive');
      el.classList.toggle('story-off', !on);
    });
    themes(step);
    // The lines are below the fold of the window: brought up while they are the story, and the sheet's head after.
    var linesNode = host.querySelector('[data-node="f-lines"]');
    var onLines = (step === 4 || step === 5) && linesNode;
    host.scrollTo({ top: onLines ? Math.max(0, linesNode.offsetTop - 120) : 0, behavior: calm ? 'auto' : 'smooth' });
    // Saved by your backend: the save is real, and Save and Discard go.
    if (step >= 9 && forward) viewer.form.save();
    requestAnimationFrame(placeRule);
    captions.forEach(function (c, i) { c.classList.toggle('is-on', i === step); });
    dots.forEach(function (d, i) { d.setAttribute('aria-current', i === step ? 'step' : 'false'); });
  }

  // ---- the stage fits its column: drawn at 900px, scaled down on a narrower screen ----
  function fit() {
    var room = stage.clientWidth;
    stage.style.setProperty('--fit', String(Math.min(1, room / 900)));
    requestAnimationFrame(placeRule);
  }

  // ---- the scroll: each chapter a stretch of the section's height ----
  function stepNow() {
    var box = scroller.getBoundingClientRect();
    var travel = box.height - window.innerHeight;
    var done = Math.min(1, Math.max(0, -box.top / Math.max(1, travel)));
    return Math.min(STEPS - 1, Math.floor(done * STEPS));
  }
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; show(stepNow()); });
  }
  /** A dot jumps to its chapter: the middle of that chapter's stretch. */
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      if (calm) return show(i);
      var top = scroller.getBoundingClientRect().top + window.scrollY;
      var travel = scroller.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + travel * ((i + 0.5) / STEPS), behavior: 'smooth' });
    });
  });

  mount('en');
  window.addEventListener('resize', fit);
  fit();
  if (calm) {
    section.classList.add('story-still');
    show(6 - 1);
    return;
  }
  // Arabic's words, fetched before its chapter comes.
  var arabic = document.createElement('script');
  arabic.src = '/fieldia.ar.js';
  document.head.append(arabic);
  window.addEventListener('scroll', onScroll, { passive: true });
  show(stepNow());
})();
