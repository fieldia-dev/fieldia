// fieldia.dev's front page: the stage that writes a page and draws it, the record that runs itself,
// the framework tabs and the counters. Every form here is the real viewer (fieldia.js),
// driven through its public API; with reduced motion, each part shows its finished state at once.
(function () {
  'use strict';
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wait = function (ms) { return new Promise(function (done) { setTimeout(done, calm ? 0 : ms); }); };

  /** Run `start` once the element is on screen. */
  function whenSeen(el, start, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return start();
    var seen = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { seen.disconnect(); start(); }
    }, { threshold: threshold || 0.35 });
    seen.observe(el);
  }

  // ---- the stage: a page of JSON written line by line, drawn at each step ----
  var json = document.getElementById('stage-json');
  var stageForm = document.getElementById('stage-form');
  var stepWords = document.getElementById('stage-step');
  var replay = document.getElementById('stage-replay');
  var skip = document.getElementById('stage-skip');
  var FULL = json ? json.textContent : '';

  var NAME = { type: 'char', label: 'Your name', required: true };
  var BUILDS = { type: 'selection', label: 'You build with', options: [{ value: 'react', label: 'React' }, { value: 'vue', label: 'Vue' }, { value: 'other', label: 'Something else' }] };
  var OTHER = { type: 'char', label: 'Which one?' };
  var BUDGET = { type: 'monetary', label: 'Budget', currency: 'EGP' };
  function page(fields, nodes) {
    return {
      fieldia: '0.1', id: 'project-brief', title: 'Start a project', data: { kind: 'responses' }, fields: fields,
      layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: nodes }] },
    };
  }
  var node = function (id, field, extra) { return Object.assign({ type: 'field', id: id, field: field }, extra || {}); };
  var all = { name: NAME, builds: BUILDS, other: OTHER, budget: BUDGET };
  // Where the text stands at each step, what the page holds then, and what the step shows.
  var STEPS = [
    { at: '"name": {', words: 'A field', page: page({ name: NAME }, [node('n', 'name')]) },
    { at: '"other": {', words: 'A choice of three', page: page({ name: NAME, builds: BUILDS }, [node('n', 'name'), node('b', 'builds')]) },
    { at: '"budget": {', words: 'A box for the answer', page: page({ name: NAME, builds: BUILDS, other: OTHER }, [node('n', 'name'), node('b', 'builds'), node('o', 'other')]) },
    { at: '"layout": {', words: 'Money, in its currency', page: page(all, [node('n', 'name'), node('b', 'builds'), node('o', 'other'), node('m', 'budget')]) },
    { at: '{ "type": "field", "id": "o"', words: 'The choice as radio buttons', page: page(all, [node('n', 'name'), node('b', 'builds', { widget: 'radio' }), node('o', 'other'), node('m', 'budget')]) },
    { at: '{ "type": "field", "id": "m"', words: 'A condition hides “Which one?”', page: page(all, [node('n', 'name'), node('b', 'builds', { widget: 'radio' }), node('o', 'other', { invisible: "builds != 'other'", required: true }), node('m', 'budget')]) },
  ];
  STEPS.forEach(function (step) { step.cut = FULL.indexOf(step.at); });

  var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  /** The JSON written so far, coloured: keys, strings, and literals. */
  function paint(text, caret) {
    var out = esc(text).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null|-?\d+(?:\.\d+)?)\b/g, function (m, str, colon, lit) {
      if (str) return colon ? '<span class="k">' + str + '</span>' + colon : '<span class="s">' + str + '</span>';
      return '<span class="l">' + lit + '</span>';
    });
    json.innerHTML = '<code>' + out + (caret ? '<span class="caret" aria-hidden="true"></span>' : '') + '</code>';
  }

  var viewer = null;
  function draw(p) {
    var before = viewer ? Object.keys(viewer.form.getState().values) : [];
    if (viewer) viewer.destroy();
    viewer = Fieldia.mountViewer(stageForm, { page: p, dataSource: Fieldia.createMemoryDataSource(), skin: 'outlined' });
    // The field this step added is marked as it arrives.
    Object.keys(p.fields).filter(function (f) { return before.indexOf(f) === -1; }).forEach(function (f) {
      var el = stageForm.querySelector('[data-field="' + f + '"]');
      if (el && !calm) el.classList.add('just-drawn');
    });
  }

  var run = 0;
  async function play() {
    var mine = ++run;
    var alive = function () { return mine === run; };
    replay.hidden = true;
    skip.hidden = false;
    if (viewer) { viewer.destroy(); viewer = null; }
    stageForm.textContent = '';
    var shown = 0;
    for (var i = 0; i < STEPS.length; i++) {
      var step = STEPS[i];
      while (shown < step.cut) {
        if (!alive()) return;
        shown = Math.min(step.cut, shown + 3);
        paint(FULL.slice(0, shown), true);
        await new Promise(requestAnimationFrame);
      }
      stepWords.textContent = step.words;
      draw(step.page);
      await wait(1100);
      if (!alive()) return;
    }
    while (shown < FULL.length) {
      if (!alive()) return;
      shown = Math.min(FULL.length, shown + 3);
      paint(FULL.slice(0, shown), true);
      await new Promise(requestAnimationFrame);
    }
    await use(alive);
  }

  /** Someone uses the finished page: the condition shows its box, a budget is typed and read as money. */
  async function use(alive) {
    paint(FULL, false);
    stepWords.textContent = 'Now someone uses it';
    var form = viewer.form;
    await wait(700);
    if (!alive()) return;
    form.setValue('name', 'Lina Haddad');
    await wait(700);
    if (!alive()) return;
    form.setValue('builds', 'other');
    stepWords.textContent = 'Picked “Something else”: the condition shows the box';
    await wait(1300);
    if (!alive()) return;
    form.setValue('other', 'Svelte');
    await wait(700);
    var typed = '2400000';
    for (var i = 1; i <= typed.length; i++) {
      if (!alive()) return;
      form.setValue('budget', Number(typed.slice(0, i)));
      await wait(110);
    }
    stepWords.textContent = 'The budget, read as Egyptian pounds';
    finish();
  }

  function finish() {
    skip.hidden = true;
    replay.hidden = false;
  }

  /** The finished page at once: for Skip, and for reduced motion. */
  function rest() {
    run++;
    paint(FULL, false);
    draw(STEPS[STEPS.length - 1].page);
    viewer.form.setValue('builds', 'other');
    viewer.form.setValue('other', 'Svelte');
    viewer.form.setValue('budget', 2400000);
    stepWords.textContent = 'The finished page: try it';
    finish();
  }

  if (json && stageForm && window.Fieldia) {
    replay.addEventListener('click', function () { play(); });
    skip.addEventListener('click', rest);
    if (calm) rest();
    else play();
  }

  // ---- the record: a quotation that is sent, changed and confirmed ----
  var sheet = document.getElementById('sheet-form');
  var caption = document.getElementById('sheet-caption');
  var ORDER = {
    fieldia: '0.1', id: 'order', title: 'Sales order', data: { kind: 'record', model: 'sale.order' },
    fields: {
      name: { type: 'char', label: 'Order', readonly: true },
      partner: { type: 'char', label: 'Customer' },
      date_order: { type: 'date', label: 'Order date' },
      state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Quotation' }, { value: 'sent', label: 'Quotation Sent' }, { value: 'sale', label: 'Sales Order' }] },
      invoice_count: { type: 'integer', label: 'Invoices' },
      delivery_count: { type: 'integer', label: 'Deliveries' },
      order_line: {
        type: 'one2many', label: 'Order lines', relation: 'sale.order.line',
        fields: {
          product: { type: 'char', label: 'Product' },
          qty: { type: 'float', label: 'Quantity' },
          price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
          subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', compute: 'qty * price' },
        },
      },
      amount_untaxed: { type: 'monetary', label: 'Untaxed', currency: 'EGP', compute: "sum(order_line, 'subtotal')" },
      amount_tax: { type: 'monetary', label: 'VAT 14%', currency: 'EGP', compute: 'amount_untaxed * 0.14' },
      amount_total: { type: 'monetary', label: 'Total', currency: 'EGP', compute: 'amount_untaxed + amount_tax' },
    },
    layout: {
      type: 'sheet', id: 'sheet',
      title: { field: 'name' },
      statusbar: { field: 'state' },
      statButtons: [
        { id: 'invoices', label: 'Invoices', field: 'invoice_count', icon: 'receipt', action: 'open_invoices' },
        { id: 'deliveries', label: 'Deliveries', field: 'delivery_count', icon: 'truck', action: 'open_deliveries' },
      ],
      badges: [{ id: 'confirmed', label: 'Confirmed', tone: 'success', icon: 'check', invisible: "state != 'sale'" }],
      children: [
        { type: 'section', id: 'head', columns: 2, children: [{ type: 'field', id: 'f-partner', field: 'partner' }, { type: 'field', id: 'f-date', field: 'date_order' }] },
        { type: 'field', id: 'f-lines', field: 'order_line', columns: ['product', 'qty', 'price', 'subtotal'] },
        { type: 'section', id: 'totals', columns: 3, children: [{ type: 'field', id: 'f-untaxed', field: 'amount_untaxed' }, { type: 'field', id: 'f-tax', field: 'amount_tax' }, { type: 'field', id: 'f-total', field: 'amount_total' }] },
      ],
    },
  };
  var RECORD = {
    name: 'S00071', partner: 'Dar El Shifa Hospital', date_order: '2026-10-08', state: 'draft', invoice_count: 0, delivery_count: 0,
    order_line: [
      { key: 'l1', id: 11, values: { product: '[PM-12] Patient monitor', qty: 4, price: 42750 } },
      { key: 'l2', id: 12, values: { product: '[IP-200] Infusion pump', qty: 6, price: 18500 } },
    ],
  };
  var sheetViewer = null;
  async function runSheet() {
    if (sheetViewer) sheetViewer.destroy();
    var source = Fieldia.createMemoryDataSource({ records: { 'sale.order': { 1: JSON.parse(JSON.stringify(RECORD)) } } });
    sheetViewer = Fieldia.mountViewer(sheet, { page: ORDER, dataSource: source, recordId: 1, skin: 'underline' });
    await sheetViewer.form.settled();
    var form = sheetViewer.form;
    var say = function (t) { caption.textContent = t; };
    say('S00071 · a quotation for Dar El Shifa Hospital');
    await wait(1400);
    form.setValue('state', 'sent');
    say('Sent to the customer: the status bar moves');
    await wait(1600);
    for (var q = 7; q <= 10; q++) { form.updateLine('order_line', 'l2', 'qty', q); await wait(260); }
    say('Ten pumps, not six: the line and the totals follow as it is typed');
    await wait(1800);
    form.setValue('state', 'sale');
    form.setValue('delivery_count', 1);
    say('Confirmed: a badge, and a delivery to open');
    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'sheet-again';
    again.textContent = 'Play again';
    again.addEventListener('click', runSheet);
    caption.append(' · ', again);
  }
  // Seen by its card: the empty host has no height to be seen by.
  if (sheet && window.Fieldia) whenSeen(sheet.closest('.sheet-live'), runSheet, 0.25);

  // ---- the framework tabs ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  function choose(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { choose(tab); });
    tab.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (to === null) return;
      e.preventDefault();
      choose(tabs[(to + tabs.length) % tabs.length], true);
    });
  });

  // ---- the counters: they count once seen ----
  Array.prototype.forEach.call(document.querySelectorAll('.count'), function (el) {
    var to = Number(el.dataset.to);
    if (calm || !to) return;
    whenSeen(el, function () {
      var start = performance.now();
      (function tick(now) {
        var t = Math.min(1, (now - start) / 1200);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))).toLocaleString('en');
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }, 0.6);
  });

  // ---- copy the install line ----
  var copy = document.getElementById('copy-install');
  if (copy) {
    copy.addEventListener('click', function () {
      var word = copy.querySelector('.copy-word');
      var said = function (t) { word.textContent = t; setTimeout(function () { word.textContent = 'Copy'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(function () { said('Copied'); }, function () { said('Select it'); });
    });
  }
})();
