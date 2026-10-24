// fieldia.dev's front page: the stage that writes four pages and draws each, the record that runs itself,
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

  // ---- the stage: four pages of JSON, a tab each, each written step by step where each part belongs, drawn at each
  // step, then used; the first plays once it is seen, and each the next once it is done, until someone touches it ----
  var stage = document.querySelector('.home-opening .stage');

  /**
   * The stage plays only while it is seen — a quarter of it or more on the screen: scrolled away, its typing and its
   * pauses wait where they are, and go on as it comes back, so no one returns to a tab played without them.
   */
  var SEEN = 0.25;
  var inView = !stage || !('IntersectionObserver' in window);
  /** What waits for the stage to come back into view, and what is told when it leaves. */
  var comeBack = [];
  var goneAway = [];
  if (!inView) {
    new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      var seen = entry.isIntersecting && entry.intersectionRatio >= SEEN;
      if (seen === inView) return;
      inView = seen;
      (seen ? comeBack : goneAway).splice(0).forEach(function (told) { told(); });
    }, { threshold: [0, SEEN, 0.5, 1] }).observe(stage);
  }
  /** Once the stage is in view: at once where it is (false), else when it comes back (true). */
  function inSight() {
    return inView ? Promise.resolve(false) : new Promise(function (done) { comeBack.push(function () { done(true); }); });
  }
  /** `ms` of the stage in view, or less where it leaves view first (`leave`): a call told when it leaves is let go as it ends. */
  function seenFor(ms, leave) {
    return new Promise(function (done) {
      if (!inView) return done();
      var told = function () { clearTimeout(timer); done(); if (leave) leave(); };
      var timer = setTimeout(function () {
        var at = goneAway.indexOf(told);
        if (at >= 0) goneAway.splice(at, 1);
        done();
      }, ms);
      goneAway.push(told);
    });
  }
  /** A pause of the stage's: `ms` of it seen, its clock stopped while it is out of view. */
  async function beat(ms) {
    if (calm) return;
    for (var left = ms; left > 0; ) {
      await inSight();
      var from = performance.now();
      await seenFor(left);
      left -= performance.now() - from;
    }
  }
  var panel = document.getElementById('stage-panel');
  var json = document.getElementById('stage-json');
  var stageForm = document.getElementById('stage-form');
  var fileName = document.getElementById('stage-file');
  var stepWords = document.getElementById('stage-step');
  var replay = document.getElementById('stage-replay');
  var skip = document.getElementById('stage-skip');
  var stageWait = document.getElementById('stage-wait');
  var waitWords = document.getElementById('stage-wait-words');
  var tabsData = document.getElementById('stage-tabs-data');
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.stage-tabs [role="tab"]'));
  /** Each tab: its steps (site/hero.mjs), each the whole page as it stands then and what it adds in words; then the words said as it is used, its finished state's last. */
  var TABS = tabsData ? JSON.parse(tabsData.textContent) : [];
  /** A phone's screen, where the stage is its whole width: a tab with steps of its own there (the list's cards) takes them. */
  var phone = window.matchMedia('(max-width: 520px)');
  var stepsOf = function (tab) { return phone.matches && tab.narrow ? tab.narrow : tab.steps; };
  var lastPage = function (tab) { var list = stepsOf(tab); return list[list.length - 1].text; };

  /** A day counted from today, as a date field keeps it: the invoices fall due round the reader's own today. */
  function day(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /**
   * A press, as a person's lands: the element's own click. A part pressed may move the focus into itself, as it does for
   * a person's press (a time said taken, its neighbour focused): for a few seconds after, the focus is given back
   * where the reader had it and the page left where it stood, so the stage never takes either from them.
   */
  var pressed = { until: 0, focus: null, x: 0, y: 0 };
  function press(el) {
    if (!el) return false;
    if (performance.now() > pressed.until) pressed = { until: 0, focus: document.activeElement, x: window.scrollX, y: window.scrollY };
    pressed.until = performance.now() + 3000;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }
  function giveBack(e) {
    if (performance.now() > pressed.until) return;
    var had = pressed.focus;
    if (had && had !== document.body && had.isConnected && !stageForm.contains(had)) had.focus({ preventScroll: true });
    else e.target.blur();
    if (window.scrollX !== pressed.x || window.scrollY !== pressed.y) window.scrollTo(pressed.x, pressed.y);
  }
  /** The first element that matches in the stage's form, once it is there: a part comes on its own (a list's rows, a map's pins). */
  function found(selector, test) {
    return new Promise(function (done) {
      var tries = 0;
      (function look() {
        var all = Array.prototype.slice.call(stageForm.querySelectorAll(selector));
        var el = test ? all.filter(test)[0] : all[0];
        if (el || ++tries > 60) return done(el || null);
        setTimeout(look, 50);
      })();
    });
  }
  var named = function (words) { return function (el) { return el.textContent.trim() === words; }; };

  // -- A record: a customer, and the app's own pages for an invoice --
  var KESSLER = { id: 1, label: 'Kessler Logistik GmbH' };
  /** One customer, not yet marked a company, and four of its invoices: one of them past its day. */
  function customerRecords() {
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
      fieldia: '0.13', id: 'invoice', title: 'Invoice', data: { kind: 'record', model: 'invoice' }, records: NAMED, fields: INVOICE_FIELDS,
      layout: { type: 'sheet', id: 'sheet', title: { field: 'number', placeholder: 'INV-0001' }, children: [{ type: 'section', id: 'main', columns: 2, children: ['customer', 'state', 'due', 'amount'].map(function (f) { return { type: 'field', id: f, field: f }; }) }] },
    },
    invoices: {
      fieldia: '0.13', id: 'invoices', title: 'Invoices', data: { kind: 'record', model: 'invoice' }, records: NAMED, fields: INVOICE_FIELDS,
      layout: { type: 'list', id: 'list', columns: ['number', 'customer', 'due', 'amount', 'state'], cells: { state: { widget: 'dot', options: { tones: { sent: 'info', paid: 'success' } } } } },
    },
  };

  // -- A list: a few customers' invoices, round the reader's today --
  function invoiceRecords() {
    var rows = [
      ['INV-0436', 'Nordlicht AG', 21, 1280, 'sent'],
      ['INV-0431', 'Kessler GmbH', 16, 2150.5, 'sent'],
      ['INV-0428', 'Café Amsel', 9, 640, 'sent'],
      ['INV-0419', 'Nordlicht AG', -4, 3125, 'sent'],
      ['INV-0412', 'Kessler GmbH', -12, 4860, 'sent'],
      ['INV-0407', 'Brandt & Söhne', -18, 12400, 'sent'],
      ['INV-0401', 'Café Amsel', -26, 980, 'paid'],
      ['INV-0394', 'Brandt & Söhne', -33, 8750, 'paid'],
      ['INV-0388', 'Kessler GmbH', -41, 9400, 'paid'],
    ];
    var invoice = {};
    rows.forEach(function (r, i) { invoice[i + 1] = { number: r[0], customer: r[1], due: day(r[2]), amount: r[3], state: r[4] }; });
    return { invoice: invoice };
  }

  // -- A map: homes for sale in central Cairo, each in its district --
  function homeRecords() {
    var rows = [
      ['Nile-view flat', 9500000, 'Zamalek', 30.0626, 31.2197],
      ['Garden duplex', 14200000, 'Garden City', 30.0398, 31.2337],
      ['Corner flat', 6800000, 'Dokki', 30.0391, 31.2087],
      ['Flat by the park', 5900000, 'Dokki', 30.0442, 31.2151],
      ['Family flat', 5400000, 'Mohandessin', 30.0553, 31.1986],
      ['Flat by the club', 7300000, 'Mohandessin', 30.0601, 31.2047],
      ['Old-town loft', 7900000, 'Downtown', 30.0489, 31.2441],
      ['Penthouse', 21000000, 'Garden City', 30.0342, 31.2299],
    ];
    var home = {};
    rows.forEach(function (r, i) { home[i + 1] = { name: r[0], price: r[1], district: r[2], place: { type: 'Point', coordinates: [r[4], r[3]] } }; });
    return { home: home };
  }
  /** The map's own code (site/hero-map.mjs, built into /hero/map.js): asked for once, the first time it is needed. */
  var mapViews = null;
  function loadMap() {
    mapViews = mapViews || import('/hero/map.js').then(function (made) { return made.heroMapViews(); });
    return mapViews;
  }

  // -- A booking: a showroom in Berlin, open Monday to Saturday, a drive 45 minutes and 15 kept free after it --
  var ZONE = 'Europe/Berlin';
  var HOURS = { 1: ['09:00', '17:00'], 2: ['09:00', '17:00'], 3: ['09:00', '17:00'], 4: ['09:00', '17:00'], 5: ['09:00', '17:00'], 6: ['10:00', '14:00'] };
  var minutesOf = function (time) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)); };
  /** A few drives already booked, the same each visit: two most days, at times the day has. */
  function driveRecords() {
    var drive = {};
    var id = 1;
    var today = Fieldia.dayIn(Date.now(), ZONE);
    var wall = Fieldia.wallOf(today);
    for (var n = 0; n < 35; n++) {
      var at = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + n));
      var open = HOURS[at.getUTCDay() || 7];
      if (!open) continue;
      [n % 3, 3 + (n % 4)].forEach(function (k) {
        var minutes = minutesOf(open[0]) + k * 60;
        if (minutes + 45 > minutesOf(open[1])) return;
        var start = Fieldia.instantsAt({ year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate(), hour: Math.floor(minutes / 60), minute: minutes % 60 }, ZONE)[0];
        drive[id++] = { name: 'Booked', start: new Date(start).toISOString() };
      });
    }
    return { drive: drive };
  }
  /**
   * The showroom's free times, as a data source's `slots` answers them: each day asked, its times an hour apart on
   * Berlin's clock, less those gone by and those a drive holds. Open with times left; full with none; closed where it
   * has no hours or every time has gone by.
   */
  function showroomSlots(request, records) {
    var length = request.length || 45;
    var held = Object.keys(records.drive || {}).map(function (key) { return String(key) === String(request.recordId) ? NaN : Date.parse(records.drive[key].start); });
    var days = {};
    var first = Fieldia.wallOf(request.from);
    var last = Fieldia.wallOf(request.to);
    for (var at = Date.UTC(first.year, first.month - 1, first.day); at <= Date.UTC(last.year, last.month - 1, last.day); at += 86400000) {
      var date = new Date(at);
      var open = HOURS[date.getUTCDay() || 7];
      if (!open) continue;
      var free = [];
      var ahead = false;
      for (var minutes = minutesOf(open[0]); minutes + length <= minutesOf(open[1]); minutes += 60) {
        var start = Fieldia.instantsAt({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: Math.floor(minutes / 60), minute: minutes % 60 }, ZONE)[0];
        if (start <= Date.now()) continue;
        ahead = true;
        if (held.some(function (h) { return Math.abs(h - start) < 60 * 60000; })) continue;
        free.push(new Date(start).toISOString());
      }
      days[date.toISOString().slice(0, 10)] = free.length ? { state: 'open', free: free } : { state: ahead ? 'full' : 'closed' };
    }
    return { days: days, length: length };
  }

  /**
   * What each tab draws with: its records, what the viewer is given beside the page, what each step adds to mark it as
   * it arrives, and someone using it — `use` says each of the tab's words in turn, `done` puts it as it ends at once.
   */
  var KITS = {
    record: {
      source: function () { return Fieldia.createMemoryDataSource({ records: customerRecords(), labelField: { customer: 'name', invoice: 'number' } }); },
      options: function () { return { recordId: 1, pages: PAGES }; },
      marks: function (before, p) {
        var added = Object.keys(p.fields).filter(function (f) { return !(f in before.fields); }).map(function (f) { return '[data-field="' + f + '"]'; });
        if (p.layout.statusbar && !before.layout.statusbar) added.push('.fd-statusbar');
        var related = function (q) { return q.layout.children.filter(function (c) { return c.type === 'related'; })[0]; };
        if (related(p) && (!related(before) || (related(p).rowTones && !related(before).rowTones))) added.push('.fd-related');
        return added;
      },
      // Marked a company: the rule shows its VAT number, now required, and it is typed.
      use: async function (say, alive) {
        var form = viewer.form;
        say(0);
        await beat(900);
        if (!alive()) return;
        form.setValue('company', true);
        say(1);
        await new Promise(function (done) { setTimeout(done, 60); });
        var vat = stageForm.querySelector('[data-field="vat"]');
        if (vat) bringIntoSight(vat);
        await beat(1300);
        var typed = 'DE 123456789';
        for (var i = 1; i <= typed.length; i++) {
          if (!alive()) return;
          form.setValue('vat', typed.slice(0, i));
          await beat(90);
        }
      },
      done: function () {
        viewer.form.setValue('company', true);
        viewer.form.setValue('vat', 'DE 123456789');
      },
    },
    list: {
      source: function () { return Fieldia.createMemoryDataSource({ records: invoiceRecords() }); },
      options: function () { return {}; },
      marks: function (before, p) {
        var was = before.layout;
        var now = p.layout;
        return [now.cells && !was.cells && '.fd-list-totals', now.rowTones && !was.rowTones && '.fd-list-key', now.filters && !was.filters && '.fd-facet'].filter(Boolean);
      },
      // Grouped by customer from the search's own menu, as a person groups it, and Kessler's opened: one invoice overdue, one not.
      use: async function (say, alive) {
        say(0);
        await beat(900);
        if (!alive() || !(await groupByCustomer())) return;
        say(1);
        await beat(1700);
        if (!alive()) return;
        press(await kessler());
        say(2);
        await beat(1500);
      },
      done: async function () {
        if (await groupByCustomer()) press(await kessler());
      },
    },
    map: {
      source: function () { return Fieldia.createMemoryDataSource({ records: homeRecords() }); },
      ready: loadMap,
      options: function (views) { return { listViews: views }; },
      // The map's own parts come into it as they are drawn: its pins, their words, its shades and key.
      marks: function () { return []; },
      // A district pressed searches for its homes; a pin pressed opens its home's card.
      use: async function (say, alive) {
        say(0);
        await beat(900);
        if (!alive() || !(await pressDistrict())) return;
        say(1);
        await beat(1800);
        if (!alive()) return;
        press(await found('.fd-map-mark[data-id="1"] .fd-map-face'));
        say(2);
        await beat(1500);
      },
      done: async function () {
        if (await pressDistrict()) press(await found('.fd-map-mark[data-id="1"] .fd-map-face'));
      },
    },
    booking: {
      source: function () { return Fieldia.createMemoryDataSource({ records: driveRecords(), slots: showroomSlots }); },
      options: function () { return { recordId: null }; },
      marks: function (before, p) {
        if (p.fields.stop && !before.fields.stop) return ['[data-field="stop"]'];
        return p.timeZone !== before.timeZone || p.layout.children[0].widget !== before.layout.children[0].widget ? ['[data-field="start"]'] : [];
      },
      // A day picked; one of its times booked on another screen meanwhile, which this one is not told of; that time
      // pressed, said taken; another booked.
      use: async function (say, alive) {
        say(0);
        await beat(900);
        if (!alive() || !(await pickDay())) return;
        say(1);
        bringIntoSight(stageForm.querySelector('.fd-slots-times'));
        await beat(1500);
        if (!alive()) return;
        var chips = stageForm.querySelectorAll('.fd-slots-chip');
        var taken = chips[1] || chips[0];
        if (!taken) return;
        source.records.drive[999] = { name: 'Someone else', start: new Date(Number(taken.dataset.at)).toISOString() };
        taken.classList.add('hero-taken');
        say(2);
        await beat(1800);
        if (!alive()) return;
        var at = taken.dataset.at;
        press(taken);
        // Told, and the times asked again without it.
        await found('.fd-slots-said', function (el) { return el.textContent.trim() !== ''; });
        say(3);
        await beat(2000);
        if (!alive()) return;
        var other = await found('.fd-slots-chip', function (el) { return el.dataset.at !== at; });
        if (!alive()) return;
        press(other);
        say(4);
        await backBy();
        await beat(1500);
      },
      done: async function () {
        if (await pickDay() && press(await found('.fd-slots-chip'))) await backBy();
      },
    },
  };
  /** The list's Group By, from its search's menu: Customer picked, the menu closed. */
  async function groupByCustomer() {
    var options = await found('button[aria-label="Search options"]');
    if (!press(options)) return false;
    var customer = await found('[data-group-kind="groupBy"] button', named('Customer'));
    press(customer);
    press(stageForm.querySelector('button[aria-label="Search options"]'));
    return !!customer;
  }
  /** Kessler's group in the list, by its heading. */
  var kessler = function () { return found('.fd-group-toggle', function (el) { return el.textContent.indexOf('Kessler') >= 0; }); };
  /**
   * A district of the map pressed, as a person presses it: its homes searched for, and the map showing only theirs
   * (Zamalek's one) — the map brought into sight, where the pane is a phone's strip and the map runs on under it.
   */
  async function pressDistrict() {
    if (!press(await found('path.fd-map-region', function (el) { return /^Zamalek/.test(el.getAttribute('aria-label') || ''); }))) return false;
    await found('.fd-facet');
    var box = stageForm.querySelector('.fd-map-box');
    if (box) bringIntoSight(box);
    return !!(await found('.fd-map-mark[data-id="1"]', function () { return !stageForm.querySelector('.fd-map-mark[data-id]:not([data-id="1"])'); }));
  }
  /** Back by, once the time picked has written it (and the record's bar has come with the change), brought into sight. */
  async function backBy() {
    var stop = await found('[data-field="stop"]', function (el) { var input = el.querySelector('input'); return !!input && input.value !== ''; });
    await new Promise(requestAnimationFrame);
    if (stop) bringIntoSight(stop);
  }
  /** The first day with times free, pressed: its times shown. */
  async function pickDay() {
    var open = await found('.fd-slots-days button[data-state="open"]');
    if (!press(open)) return false;
    return !!(await found('.fd-slots-chip'));
  }

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

  var current = 0;
  /** Whether the stage's JSON stands beside what it draws (home.css): a map fills the pane there; on a phone, its own height, scrolled to. */
  var tall = window.matchMedia('(min-width: 800px)');
  var shownPage = null;
  var viewer = null;
  var source = null;
  /** What the tab's kit gives the viewer beside the page: for the map, its map's code, once loaded. */
  var given = null;
  /**
   * The screen being made while a step's lines are typed (the typing is the work): `first` an empty pane sketched, from
   * the step's first letter; `update` the screen there under a light veil, only for a step whose typing is long enough
   * to be seen as work (`VEIL_AFTER`, with `VEIL_LEFT` still to go: never a flash) — the pane busy meanwhile, and a chip
   * in the stage's bar saying which, never over the screen (home.css). Its words are not read out: the bar's step words
   * are the stage's live region.
   */
  function making(kind) {
    stageWait.dataset.kind = kind;
    panel.dataset.making = kind;
    waitWords.textContent = kind === 'first' ? 'Drawing the screen…' : 'Updating…';
    stageForm.setAttribute('aria-busy', 'true');
  }
  /** The screen made, or the tab left or finished at once: never a sketch, a veil or a chip left behind. */
  function made() {
    delete panel.dataset.making;
    stageForm.setAttribute('aria-busy', 'false');
  }
  /** A later step's veil: once its typing has gone on this long (ms, at the hand's speed it is typed at)… */
  var VEIL_AFTER = 700;
  /** …and while as long as this is still to type: a step a moment longer is drawn without one. */
  var VEIL_LEFT = 400;

  /**
   * The page drawn, as the reader's scheme dresses it; the part it adds marked as it arrives, and brought into sight.
   * `lift`, as a step is played: the screen fades in where the sketch was (`first`) or comes out from under the veil,
   * from as dim as the screen before it stood.
   */
  function draw(p, lift) {
    var kit = KITS[TABS[current].id];
    var before = shownPage;
    var kept = stageForm.scrollTop;
    shownPage = p;
    if (lift) {
      var was = stageForm.firstElementChild;
      stageForm.style.setProperty('--lift-from', was ? getComputedStyle(was).opacity : '0');
      stageForm.dataset.lift = lift;
    } else delete stageForm.dataset.lift;
    if (viewer) viewer.destroy();
    // How tall the pane is, where the JSON stands beside it: a map fills it rather than running on under it. On a phone
    // the pane is a strip under the JSON, and a map keeps its own height, the pane scrolled to it.
    stageForm.style.setProperty('--pane', tall.matches ? stageForm.clientHeight + 'px' : '');
    viewer = Fieldia.mountViewer(stageForm, Object.assign({ page: readers(p), dataSource: source, skin: 'outlined' }, kit.options(given)));
    stageForm.scrollTop = kept;
    var added = before ? kit.marks(before, p) : [];
    var mine = viewer;
    return viewer.form.settled().then(function () {
      // A list's rows and a related list come on their own: wait for them before looking.
      return new Promise(function (done) { setTimeout(done, 80); });
    }).then(function () {
      if (viewer !== mine) return;
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
  /** The tab's own: a fresh source of its records, an empty pane, and what it draws with (the map's code) at hand. */
  async function begin(alive) {
    var tab = TABS[current];
    var kit = KITS[tab.id];
    made();
    delete stageForm.dataset.lift;
    if (viewer) { viewer.destroy(); viewer = null; }
    shownPage = null;
    stageForm.textContent = '';
    stageForm.scrollTop = 0;
    fileName.textContent = tab.file;
    source = kit.source();
    given = null;
    if (!kit.ready) return alive();
    try {
      given = await kit.ready();
    } catch (error) {
      if (alive()) { stepWords.textContent = 'The map could not load. Try again later.'; skip.hidden = true; replay.hidden = false; }
      return false;
    }
    return alive();
  }
  /** Letters typed a millisecond: four a frame at 60 frames a second. */
  var TYPED = 0.24;
  /** The tab's page written step by step, each step's new lines typed where they belong, then drawn; then someone uses it. */
  async function play() {
    var mine = ++run;
    var alive = function () { return mine === run; };
    var tab = TABS[current];
    replay.hidden = true;
    skip.hidden = false;
    json.innerHTML = '<code></code>';
    json.scrollTop = 0;
    stepWords.textContent = 'Writing ' + tab.file;
    if (!(await begin(alive))) return;
    var lines = [];
    var steps = stepsOf(tab);
    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      // The screen being made while the step is written: the tab's first sketched at once; a later one under a veil
      // only once its typing reads as work. Not with reduced motion, where Replay alone plays a tab.
      var kind = calm ? null : s === 0 ? 'first' : 'update';
      if (kind === 'first') making(kind);
      var plan = edits(lines, step.text.split('\n'));
      // How much the step types, and how long it has typed (the stage's clock: not while it is out of view).
      var toType = plan.reduce(function (sum, x) { return sum + ('write' in x ? x.write.length - x.from : 0); }, 0);
      var typed = 0;
      var typedFor = 0;
      var veiled = kind !== 'update';
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
        var others = plan.slice(k + 1).filter(function (x) { return 'keep' in x; }).map(function (x) { return x.keep; });
        paint(lines.concat(others), fresh, at);
        var typing = json.querySelectorAll('.ln')[at];
        // Typed by the clock, not by the frame: as quick on a slow screen, a few more letters a frame.
        var since = performance.now();
        while (written < e.write.length) {
          var now = await new Promise(requestAnimationFrame);
          if (!alive()) return;
          // Out of view: the line waits as it is, and goes on from there.
          if (await inSight()) {
            if (!alive()) return;
            since = now = performance.now();
          }
          var more = Math.min(e.write.length - written, Math.max(1, Math.round((now - since) * TYPED)));
          typedFor += now - since;
          written += more;
          typed += more;
          since = now;
          lines[at] = e.write.slice(0, written);
          retype(typing, lines[at]);
          if (!veiled && typedFor >= VEIL_AFTER && (toType - typed) / TYPED >= VEIL_LEFT) {
            veiled = true;
            making('update');
          }
        }
      }
      if (!alive()) return;
      paint(lines, fresh, -1);
      stepWords.textContent = step.words;
      var lift = stageForm.getAttribute('aria-busy') === 'true' ? kind : null;
      made();
      draw(JSON.parse(step.text), lift);
      await beat(s === 0 ? 1000 : 1400);
      if (!alive()) return;
    }
    // Someone uses it, saying each of the tab's words in turn but the last, its finished state's.
    await KITS[tab.id].use(function (i) { if (alive()) stepWords.textContent = tab.used[i]; }, alive);
    if (!alive()) return;
    finish();
    played();
  }

  /** The tab at rest: its page as written, Replay offered, and the words of its finished state. */
  function finish() {
    var tab = TABS[current];
    paint(lastPage(tab).split('\n'), [], -1);
    stepWords.textContent = tab.used[tab.used.length - 1];
    skip.hidden = true;
    replay.hidden = false;
  }

  /** The tab finished at once, as it ends when played: for Skip, and for reduced motion. */
  async function rest() {
    var mine = ++run;
    var alive = function () { return mine === run; };
    var tab = TABS[current];
    json.scrollTop = 0;
    finish();
    if (!(await begin(alive))) return;
    await draw(JSON.parse(lastPage(tab)));
    if (alive()) await KITS[tab.id].done();
  }

  // ---- which tab, and the stage moving on to the next by itself until someone touches it ----
  /** Whether the stage moves on to the next tab once one is done: until someone presses, types or points in it. */
  var onward = !calm;
  function hold() {
    onward = false;
    // The reader's own hand from now: where the focus goes is theirs.
    pressed.until = 0;
  }
  /** A tab shown: its tab marked, its panel named by it, and played (or at rest, with reduced motion). */
  function show(i, focus) {
    current = i;
    tabButtons.forEach(function (b, k) {
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabButtons[i].id);
    if (focus) tabButtons[i].focus();
    if (calm) rest();
    else play();
  }
  /** How long a tab played to its end rests, seen, for the reader to try what it drew, before the next tab plays. */
  var REST = 9000;
  /**
   * A tab played to its end by itself: the map's code fetched for later, and the next tab played after the tab has
   * rested `REST` in view — or, scrolled out of view before, once the stage is seen again.
   */
  function played() {
    loadMap().catch(function () { return null; });
    if (!onward || current >= TABS.length - 1) return;
    var mine = run;
    var goOn = function () { if (onward && mine === run) show(current + 1, false); };
    seenFor(REST).then(function () { whenSeen(stage, goOn, SEEN); });
  }

  if (stage && json && stageForm && TABS.length && window.Fieldia) {
    // Read by the site's tests: the tab shown, and the page the stage has drawn, as its JSON says it.
    window.fieldiaHero = { tab: function () { return TABS[current].id; }, page: function () { return shownPage; } };
    tabButtons.forEach(function (tab, i) {
      tab.addEventListener('click', function () { if (i !== current || !run) show(i, false); });
      tab.addEventListener('keydown', function (e) {
        var to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabButtons.length - 1 : null;
        if (to === null) return;
        e.preventDefault();
        show((to + tabButtons.length) % tabButtons.length, true);
      });
    });
    // Someone reading: a press, a key or a pointer in the stage keeps it on the tab it shows, for good.
    ['pointerdown', 'keydown', 'wheel'].forEach(function (type) { stage.addEventListener(type, hold, { passive: true }); });
    stage.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') hold(); }, { passive: true });
    // Focus come by the keyboard (the tabs come first); the form's own focus may move as it is used.
    stage.addEventListener('focusin', function (e) { if (!stageForm.contains(e.target)) hold(); });
    stageForm.addEventListener('focusin', giveBack);
    replay.addEventListener('click', function () { play(); });
    skip.addEventListener('click', function () { rest(); });
    if (calm) rest();
    else {
      // Played once it is seen: on a phone, under the words, not before the reader gets to it; empty until then.
      json.innerHTML = '<code></code>';
      stepWords.textContent = 'Writing ' + TABS[0].file;
      replay.hidden = true;
      skip.hidden = false;
      // Unless Skip or a tab came first.
      whenSeen(stage, function () { if (!run) play(); }, 0.3);
    }
  }

  // ---- the record: a quotation that is sent, changed and confirmed ----
  var sheet = document.getElementById('sheet-form');
  var caption = document.getElementById('sheet-caption');
  var ORDER = {
    fieldia: '0.13', id: 'order', title: 'Sales order', data: { kind: 'record', model: 'sale.order' },
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
