// fieldia.dev's demo gallery: by business area as it opens, or by feature for developers (?by=feature), and a search
// that keeps only the demos whose name, words, area or feature hold every word typed. The cards are drawn once, in
// their areas (site/pages/demos.mjs); the switch moves them into the feature groups and back. Featured stays on top,
// out of the way while a search is on.
(function () {
  'use strict';
  var body = document.querySelector('.gallery-body');
  var find = document.getElementById('gallery-find');
  var said = document.getElementById('gallery-said');
  var none = document.querySelector('.gallery-none');
  if (!body || !find) return;
  var featured = document.getElementById('featured');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.gallery-by button'));
  var sections = function (group) { return Array.prototype.slice.call(body.querySelectorAll('.gallery-section[data-group="' + group + '"]')); };
  var cards = Array.prototype.slice.call(body.querySelectorAll('.gallery-section[data-group] .demo-card'));
  cards.sort(function (a, b) { return Number(a.dataset.at) - Number(b.dataset.at); });
  var by = 'area';

  function group(next) {
    by = next === 'feature' ? 'feature' : 'area';
    var key = by === 'feature' ? 'category' : 'area';
    var homes = {};
    sections(by).forEach(function (section) { homes[section.id] = section.querySelector('.gallery'); });
    cards.forEach(function (card) { var home = homes[card.dataset[key]]; if (home) home.append(card); });
    ['area', 'feature'].forEach(function (g) { sections(g).forEach(function (section) { section.hidden = g !== by; }); });
    document.body.classList.toggle('by-feature', by === 'feature');
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.by === by)); });
    var address = new URL(location.href);
    if (by === 'feature') address.searchParams.set('by', 'feature');
    else address.searchParams.delete('by');
    history.replaceState(null, '', address.pathname + address.search + address.hash);
    filter();
  }

  function filter() {
    var words = find.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (card) {
      var holds = words.every(function (word) { return card.dataset.words.indexOf(word) !== -1; });
      card.hidden = !holds;
      if (holds) shown += 1;
    });
    sections(by).forEach(function (section) { section.hidden = !section.querySelector('.demo-card:not([hidden])'); });
    if (featured) featured.hidden = words.length > 0;
    none.hidden = shown > 0;
    said.textContent = words.length ? (shown === 1 ? '1 demo matches.' : shown + ' demos match.') : '';
  }

  buttons.forEach(function (button) { button.addEventListener('click', function () { group(button.dataset.by); }); });
  find.addEventListener('input', filter);
  find.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !find.value) return;
    event.preventDefault();
    find.value = '';
    filter();
  });
  none.querySelector('.gallery-clear').addEventListener('click', function () { find.value = ''; filter(); find.focus(); });
  // "/" finds a demo from anywhere outside a box being typed in.
  document.addEventListener('keydown', function (event) {
    var target = event.target;
    if (event.key !== '/' || (target.closest && target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    event.preventDefault();
    find.focus();
  });
  // A business area's address (/demos/#sales, from the front page) opens by area, whatever was picked.
  var areaAsked = function () { return location.hash && document.querySelector('.gallery-section[data-group="area"]' + location.hash.replace(/[^#\w-]/g, '')); };
  window.addEventListener('hashchange', function () { if (areaAsked() && by !== 'area') group('area'); });
  group(new URLSearchParams(location.search).get('by') === 'feature' && !areaAsked() ? 'feature' : 'area');
})();
