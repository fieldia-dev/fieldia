// fieldia.dev's demo gallery: by business area as it opens, or by feature for developers (?by=feature), and a search
// that keeps only the demos whose name, words, area or feature hold every word typed, each at the start of a word of
// theirs — "booking" finding "booked" too, "dent" a dentist's demos, never "dependent" — and, for a word no demo
// holds, the demos with a word one letter off it ("invoce"), never in place of one that holds ("lease" is not
// "leave"). While a search is on, each heading counts the demos it still shows, of its whole count. The cards are
// drawn once, in their areas (site/pages/demos.mjs); the switch moves them into the feature groups and back. Featured
// stays on top, out of the way while a search is on, and so do the words for developers and each area's line about
// itself: the results come first under the search, on a phone too.
(function () {
  'use strict';
  var body = document.querySelector('.gallery-body');
  var find = document.getElementById('gallery-find');
  var said = document.getElementById('gallery-said');
  var none = document.querySelector('.gallery-none');
  var developers = document.querySelector('.gallery-dev');
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

  /** A word's stem, so a word typed finds the others of its family: booking, booked and books all "book". */
  function stem(word) {
    return word.length < 5 ? word : word.replace(/(ing|ed|es|s)$/, '');
  }
  /** A card's own words, one by one, kept the first time they are asked for. */
  function wordsOf(card) {
    return card.wordList || (card.wordList = card.dataset.words.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  }
  /** Whether two words are one letter off: one changed, added, taken away, or two side by side swapped. */
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a === b) return a === b;
    var i = 0;
    while (i < a.length && a[i] === b[i]) i += 1;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }
  /** Whether some words hold one at the start of a word of theirs: "dent" in "dentist", never in "dependent". */
  function starts(words, word) {
    for (var at = words.indexOf(word); at !== -1; at = words.indexOf(word, at + 1)) {
      if (at === 0 || !/[\p{L}\p{N}]/u.test(words[at - 1])) return true;
    }
    return false;
  }
  /** Whether a card holds a word typed: a word of its own starting so, as written or by its stem; with `loose`, a word of its own one letter off. */
  function holds(card, word, loose) {
    if (starts(card.dataset.words, word) || starts(card.dataset.words, stem(word))) return true;
    return loose && word.length >= 4 && wordsOf(card).some(function (own) { return near(word, own) || near(stem(word), stem(own)); });
  }

  function filter() {
    var words = find.value.trim().toLowerCase().replace(/[’']/g, '’').split(/\s+/).filter(Boolean);
    // A word some demo holds as typed is held so; only a word no demo holds is read as a slip of the keys writes it,
    // its demos those with a word one letter off it — never "leave" for "lease", which the real estate demos hold.
    var slips = words.map(function (word) { return !cards.some(function (card) { return holds(card, word, false); }); });
    var found = cards.filter(function (card) { return words.every(function (word, i) { return holds(card, word, slips[i]); }); });
    var loose = slips.some(Boolean);
    cards.forEach(function (card) { card.hidden = found.indexOf(card) === -1; });
    sections(by).forEach(function (section) {
      var left = section.querySelectorAll('.demo-card:not([hidden])').length;
      var count = section.querySelector('h2 .count');
      section.hidden = !left;
      // While a search is on, the heading counts what it still shows, of all it has: "Sales 1 of 12".
      if (count) count.textContent = words.length ? left + ' of ' + count.dataset.of : count.dataset.of;
    });
    if (featured) featured.hidden = words.length > 0;
    if (developers) developers.hidden = words.length > 0;
    // Each area's line about itself too: under its heading, its results.
    body.querySelectorAll('.gallery-about').forEach(function (about) { about.hidden = words.length > 0; });
    none.hidden = found.length > 0;
    var many = found.length === 1 ? '1 demo matches.' : found.length + ' demos match.';
    said.textContent = !words.length ? '' : loose && found.length ? 'Nothing has those words as typed: ' + (found.length === 1 ? '1 demo has' : found.length + ' demos have') + ' words close to them.' : many;
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
