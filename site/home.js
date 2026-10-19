// fieldia.dev's front page: the stage that writes a page and draws it, the record that runs itself,
// the framework tabs and the counters. Every form here is the real viewer (fieldia.js),
// driven through its public API; with reduced motion, each part shows its finished state at once.
(function () {
  'use strict';
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wait = function (ms) { return new Promise(function (done) { setTimeout(done, calm ? 0 : ms); }); };
  /** A page in the reader's own scheme, light or dark, as the site around it is (the JSON shown stays as written). */
  var readers = function (p) { return Object.assign({}, p, { look: Object.assign({}, p.look, { scheme: 'auto' }) }); };

  /** Run `start` once the element is on screen. */
  function whenSeen(el, start, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return start();
    var seen = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { seen.disconnect(); start(); }
    }, { threshold: threshold || 0.35 });
    seen.observe(el);
  }

  // ---- the stage: a customer's page of JSON, written step by step where each part belongs, drawn at each step ----
  var stage = document.querySelector('.home-opening .stage');
  var json = document.getElementById('stage-json');
  var stageForm = document.getElementById('stage-form');
  var stepWords = document.getElementById('stage-step');
  var replay = document.getElementById('stage-replay');
  var skip = document.getElementById('stage-skip');
  var stepsData = document.getElementById('stage-steps');
  /** Each step: the whole page as it stands then (site/hero.mjs), and what it adds in words. The last is the page shown. */
  var STEPS = stepsData ? JSON.parse(stepsData.textContent) : [];
  var FULL = STEPS.length ? STEPS[STEPS.length - 1].text : '';

  /** A day counted from today, as a date field keeps it: the invoices fall due round the reader's own today. */
  function day(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var KESSLER = { id: 1, label: 'Kessler Logistik GmbH' };
  /** One customer, not yet marked a company, and four of its invoices: one of them past its day. */
  function records() {
    return {
      customer: { 1: { name: KESSLER.label, phone: '+493012345678', company: false, vat: '', credit: 25000, stage: 'customer' } },
      invoice: {
        11: { number: 'INV-0431', due: day(16), amount: 2150.5, state: 'sent', customer: KESSLER },
        12: { number: 'INV-0412', due: day(-12), amount: 4860, state: 'sent', customer: KESSLER },
        13: { number: 'INV-0388', due: day(-41), amount: 9400, state: 'paid', customer: KESSLER },
        14: { number: 'INV-0359', due: day(-70), amount: 7300, state: 'paid', customer: KESSLER },
      },
    };
  }
  // The app's own pages for an invoice: a row, and New, open one in a dialog; View all opens them all. Each names its
  // records, so the list inside the customer says "New invoice" and "View all invoices".
  var INVOICE_FIELDS = {
    number: { type: 'char', label: 'Number', required: true },
    customer: { type: 'many2one', label: 'Customer', relation: 'customer', required: true },
    due: { type: 'date', label: 'Due' },
    amount: { type: 'monetary', label: 'Amount', currency: 'EUR' },
    state: { type: 'selection', label: 'Status', default: 'sent', options: [{ value: 'sent', label: 'Sent' }, { value: 'paid', label: 'Paid' }] },
  };
  var NAMED = { one: 'invoice', other: 'invoices', a: 'an invoice' };
  var PAGES = {
    invoice: {
      fieldia: '0.5', id: 'invoice', title: 'Invoice', data: { kind: 'record', model: 'invoice' }, records: NAMED, fields: INVOICE_FIELDS,
      layout: { type: 'sheet', id: 'sheet', title: { field: 'number', placeholder: 'INV-0001' }, children: [{ type: 'section', id: 'main', columns: 2, children: ['customer', 'state', 'due', 'amount'].map(function (f) { return { type: 'field', id: f, field: f }; }) }] },
    },
    invoices: {
      fieldia: '0.5', id: 'invoices', title: 'Invoices', data: { kind: 'record', model: 'invoice' }, records: NAMED, fields: INVOICE_FIELDS,
      layout: { type: 'list', id: 'list', columns: ['number', 'customer', 'due', 'amount', 'state'], cells: { state: { widget: 'dot', options: { tones: { sent: 'info', paid: 'success' } } } } },
    },
  };

  var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  /** One line of the JSON, coloured: keys, strings and literals. */
  function colour(line) {
    return esc(line).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null|-?\d+(?:\.\d+)?)\b/g, function (m, str, colon, lit) {
      if (str) return colon ? '<span class="k">' + str + '</span>' + colon : '<span class="s">' + str + '</span>';
      return '<span class="l">' + lit + '</span>';
    });
  }
  /** One line's inside: its words coloured, the caret after them while it is the line being written. */
  var lineHtml = function (line, caret) { return colour(line) + (caret ? '<span class="caret" aria-hidden="true"></span>' : '') + '\n'; };
  /**
   * The JSON as it stands: a line each, a line too long for the pane wrapping under its own indent; the lines this step
   * added marked, the caret at the end of the line being written, and that line kept in sight.
   */
  function paint(lines, fresh, at) {
    json.innerHTML = '<code>' + lines.map(function (line, i) {
      return '<span class="ln' + (fresh[i] ? ' fresh' : '') + '" style="--i:' + (line.length - line.trimStart().length) + '">' + lineHtml(line, i === at) + '</span>';
    }).join('') + '</code>';
    if (at >= 0) keepInSight(json.querySelectorAll('.ln')[at]);
  }
  /** The line being written, as it grows: that line alone drawn again. */
  function retype(line, text) {
    line.innerHTML = lineHtml(text, true);
    keepInSight(line);
  }
  /** The line being written kept in the pane's middle third. */
  function keepInSight(line) {
    var top = line.offsetTop;
    if (top < json.scrollTop + json.clientHeight / 3 || top + line.offsetHeight > json.scrollTop + (json.clientHeight * 2) / 3) json.scrollTop = Math.max(0, top - json.clientHeight / 2);
  }

  /**
   * How one step's lines become the next's: the lines both keep (their longest run in common), and for the rest, a
   * line changed (typed on from what the two share at its start) or a line added (typed in where it belongs).
   */
  function edits(before, after) {
    var n = before.length;
    var m = after.length;
    var common = [];
    for (var i = 0; i <= n; i++) common.push(new Array(m + 1).fill(0));
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) common[i][j] = before[i] === after[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    var out = [];
    var gone = [];
    i = 0;
    j = 0;
    while (j < m) {
      // A line both have is kept, unless one like it comes later and this one is new: a part is typed whole, top down.
      if (i < n && before[i] === after[j] && common[i][j + 1] < common[i][j]) {
        out.push({ keep: after[j] });
        gone = [];
        i++;
        j++;
      } else if (i < n && common[i + 1][j] >= common[i][j + 1]) {
        gone.push(before[i]);
        i++;
      } else {
        // A line where one went: typed on from the start they share.
        var was = gone.shift();
        // Its indent at once: only the words are typed.
        var from = after[j].length - after[j].trimStart().length;
        if (was !== undefined) while (from < was.length && was[from] === after[j][from]) from++;
        out.push({ write: after[j], from: from });
        j++;
      }
    }
    return out;
  }

  var shownPage = null;
  var viewer = null;
  var source = null;
  /** The page drawn, as the reader's scheme dresses it; the part it adds marked as it arrives, and brought into sight. */
  function draw(p) {
    var before = shownPage;
    var kept = stageForm.scrollTop;
    shownPage = p;
    if (viewer) viewer.destroy();
    viewer = Fieldia.mountViewer(stageForm, { page: readers(p), dataSource: source, recordId: 1, pages: PAGES, skin: 'outlined' });
    stageForm.scrollTop = kept;
    var added = [];
    if (before) {
      Object.keys(p.fields).filter(function (f) { return !(f in before.fields); }).forEach(function (f) { added.push('[data-field="' + f + '"]'); });
      if (p.layout.statusbar && !before.layout.statusbar) added.push('.fd-statusbar');
      var related = function (q) { return q.layout.children.filter(function (c) { return c.type === 'related'; })[0]; };
      if (related(p) && !related(before)) added.push('.fd-related');
      if (related(p) && related(before) && related(p).rowTones && !related(before).rowTones) added.push('.fd-related');
    }
    viewer.form.settled().then(function () {
      // The related list's part comes on its own: wait for its rows before looking for them.
      return new Promise(function (done) { setTimeout(done, 80); });
    }).then(function () {
      if (viewer === null || shownPage !== p) return;
      var shown = added.map(function (s) { return stageForm.querySelector(s); }).filter(Boolean);
      shown.forEach(function (el) { if (!calm) el.classList.add('just-drawn'); });
      if (shown[0]) bringIntoSight(shown[0]);
    });
  }
  /** The form's pane scrolled, the page itself never: the part just drawn in sight. */
  function bringIntoSight(el) {
    if (stageForm.scrollHeight <= stageForm.clientHeight) return;
    var top = el.getBoundingClientRect().top - stageForm.getBoundingClientRect().top + stageForm.scrollTop;
    var bottom = top + el.offsetHeight;
    var to = bottom > stageForm.scrollTop + stageForm.clientHeight ? Math.min(top - 16, bottom - stageForm.clientHeight + 16) : top < stageForm.scrollTop ? top - 16 : stageForm.scrollTop;
    stageForm.scrollTo({ top: Math.max(0, to), behavior: calm ? 'auto' : 'smooth' });
  }

  var run = 0;
  /** Letters typed a millisecond: four a frame at 60 frames a second. */
  var TYPED = 0.24;
  /** The page written step by step, each step's new lines typed where they belong, then drawn. */
  async function play() {
    var mine = ++run;
    var alive = function () { return mine === run; };
    replay.hidden = true;
    skip.hidden = false;
    if (viewer) { viewer.destroy(); viewer = null; }
    shownPage = null;
    source = Fieldia.createMemoryDataSource({ records: records(), labelField: { customer: 'name', invoice: 'number' } });
    stageForm.textContent = '';
    stageForm.scrollTop = 0;
    var lines = [];
    for (var s = 0; s < STEPS.length; s++) {
      var step = STEPS[s];
      var plan = edits(lines, step.text.split('\n'));
      var fresh = [];
      lines = [];
      for (var k = 0; k < plan.length; k++) {
        var e = plan[k];
        if ('keep' in e) { lines.push(e.keep); fresh.push(false); continue; }
        lines.push(e.write.slice(0, e.from));
        // What the step adds is marked, once there is a page round it to mark it in.
        fresh.push(s > 0);
        var at = lines.length - 1;
        var written = e.from;
        // The rest of the step's lines as they stood, so the pane shows the whole page round the line being written.
        var rest = plan.slice(k + 1).filter(function (x) { return 'keep' in x; }).map(function (x) { return x.keep; });
        paint(lines.concat(rest), fresh, at);
        var typing = json.querySelectorAll('.ln')[at];
        // Typed by the clock, not by the frame: as quick on a slow screen, a few more letters a frame.
        var since = performance.now();
        while (written < e.write.length) {
          var now = await new Promise(requestAnimationFrame);
          if (!alive()) return;
          written = Math.min(e.write.length, written + Math.max(1, Math.round((now - since) * TYPED)));
          since = now;
          lines[at] = e.write.slice(0, written);
          retype(typing, lines[at]);
        }
      }
      if (!alive()) return;
      paint(lines, fresh, -1);
      stepWords.textContent = step.words;
      draw(JSON.parse(step.text));
      await wait(s === 0 ? 900 : 1300);
      if (!alive()) return;
    }
    await use(alive);
  }

  /** Someone uses the finished record: marked a company, the rule shows its VAT number, now required, and it is typed. */
  async function use(alive) {
    var form = viewer.form;
    stepWords.textContent = 'Now someone uses it';
    await wait(900);
    if (!alive()) return;
    form.setValue('company', true);
    stepWords.textContent = 'Marked a company: the VAT number appears, now required';
    await new Promise(function (done) { setTimeout(done, 60); });
    var vat = stageForm.querySelector('[data-field="vat"]');
    if (vat) bringIntoSight(vat);
    await wait(1300);
    var typed = 'DE 123456789';
    for (var i = 1; i <= typed.length; i++) {
      if (!alive()) return;
      form.setValue('vat', typed.slice(0, i));
      await wait(90);
    }
    if (!alive()) return;
    finish('The finished record: try it');
  }

  function finish(words) {
    paint(FULL.split('\n'), [], -1);
    stepWords.textContent = words;
    skip.hidden = true;
    replay.hidden = false;
  }

  /** The finished record at once: for Skip, and for reduced motion. */
  function rest() {
    run++;
    if (!source) source = Fieldia.createMemoryDataSource({ records: records(), labelField: { customer: 'name', invoice: 'number' } });
    draw(JSON.parse(FULL));
    viewer.form.settled().then(function () {
      viewer.form.setValue('company', true);
      viewer.form.setValue('vat', 'DE 123456789');
    });
    finish('The finished record: try it');
  }

  if (stage && json && stageForm && STEPS.length && window.Fieldia) {
    // Read by the site's tests: the page the stage has drawn, as its JSON says it.
    window.fieldiaHero = { page: function () { return shownPage; } };
    replay.addEventListener('click', function () { play(); });
    skip.addEventListener('click', rest);
    if (calm) rest();
    else {
      // Played once it is seen: on a phone, under the words, not before the reader gets to it; empty until then.
      json.innerHTML = '<code></code>';
      stepWords.textContent = 'Writing customer.page.json';
      replay.hidden = true;
      skip.hidden = false;
      // Unless Skip came first.
      whenSeen(stage, function () { if (!run) play(); }, 0.3);
    }
  }

  // ---- the record: a quotation that is sent, changed and confirmed ----
  var sheet = document.getElementById('sheet-form');
  var caption = document.getElementById('sheet-caption');
  var ORDER = {
    fieldia: '0.5', id: 'order', title: 'Sales order', data: { kind: 'record', model: 'sale.order' },
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
    sheetViewer = Fieldia.mountViewer(sheet, { page: readers(ORDER), dataSource: source, recordId: 1, skin: 'underline' });
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

  // ---- a template in each theme: the real file, the real viewer, the theme changed in place ----
  var tplHost = document.getElementById('tpl-form');
  var tplCaption = document.getElementById('tpl-caption');
  var picks = Array.prototype.slice.call(document.querySelectorAll('.theme-picks button'));
  var tplViewer = null;
  var cycling = null;
  var held = false;
  /** Dress the form in a theme, on the theme's own skin; the answers typed stay. */
  function wear(theme) {
    if (!tplViewer) return;
    tplViewer.setTheme(theme);
    tplViewer.setSkin(Fieldia.skinFor(undefined, theme));
    picks.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === theme)); });
    var name = picks.filter(function (b) { return b.dataset.theme === theme; })[0];
    tplCaption.textContent = 'The newsletter template · ' + (name ? name.textContent : theme) + (held ? '' : ' · changing as you watch');
  }
  function stop() {
    held = true;
    if (cycling) clearInterval(cycling);
    cycling = null;
  }
  function startTemplates() {
    fetch('/templates/newsletter.page.json').then(function (r) { return r.json(); }).then(function (page) {
      var order = picks.map(function (b) { return b.dataset.theme; });
      tplViewer = Fieldia.mountViewer(tplHost, { page: readers(page), dataSource: Fieldia.createMemoryDataSource() });
      // With reduced motion, one theme, still, until one is picked.
      if (calm) held = true;
      wear(order[0]);
      if (calm) return;
      var at = 0;
      cycling = setInterval(function () {
        // Not while someone is reading or typing in it.
        if (tplHost.matches(':hover, :focus-within')) return;
        at = (at + 1) % order.length;
        wear(order[at]);
      }, 2600);
    });
  }
  picks.forEach(function (b) {
    b.addEventListener('click', function () { stop(); wear(b.dataset.theme); });
  });
  // Someone using the form keeps the theme it is in.
  if (tplHost) tplHost.addEventListener('input', stop);
  if (tplHost && window.Fieldia) whenSeen(tplHost.closest('.tpl-live'), startTemplates, 0.25);

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
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))).toLocaleString('en') + (el.dataset.more || '');
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
