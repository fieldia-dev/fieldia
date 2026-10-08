// The live form on fieldia.dev's front page: the script bundle, a short page, and two controls.
(function () {
  // One page per language, as the docs advise: Fieldia translates its own words, the page author the rest.
  var WORDS = {
    en: ['Tell us what you build', 'Your name', 'Email', 'You build with', 'Something else', 'Which one?', 'How many forms does your app have?'],
    ar: ['أخبرنا بما تبنيه', 'اسمك', 'البريد الإلكتروني', 'تبني باستخدام', 'شيء آخر', 'أيّها؟', 'كم نموذجًا في تطبيقك؟'],
    de: ['Erzählen Sie uns, was Sie bauen', 'Ihr Name', 'E-Mail', 'Sie entwickeln mit', 'Etwas anderem', 'Womit?', 'Wie viele Formulare hat Ihre App?'],
    fr: ['Dites-nous ce que vous construisez', 'Votre nom', 'E-mail', 'Vous développez avec', 'Autre chose', 'Lequel ?', 'Combien de formulaires compte votre application ?'],
  };
  function pageIn(locale) {
    var w = WORDS[locale] || WORDS.en;
    return {
      fieldia: '0.1',
      id: 'early-access',
      title: w[0],
      data: { kind: 'responses' },
      fields: {
        name: { type: 'char', label: w[1], required: true },
        email: { type: 'char', label: w[2], required: true, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
        framework: {
          type: 'selection',
          label: w[3],
          required: true,
          options: [
            { value: 'react', label: 'React' },
            { value: 'vue', label: 'Vue' },
            { value: 'angular', label: 'Angular' },
            { value: 'other', label: w[4] },
          ],
        },
        other: { type: 'char', label: w[5] },
        forms: { type: 'integer', label: w[6], min: 1 },
      },
      layout: {
        type: 'sections',
        id: 'sections',
        children: [
          {
            type: 'section',
            id: 'you',
            columns: 2,
            children: [
              { type: 'field', id: 'name', field: 'name' },
              { type: 'field', id: 'email', field: 'email', widget: 'email' },
              { type: 'field', id: 'framework', field: 'framework', widget: 'radio', colspan: 2 },
              { type: 'field', id: 'other', field: 'other', invisible: "framework != 'other'", required: true },
              { type: 'field', id: 'forms', field: 'forms' },
            ],
          },
        ],
      },
    };
  }
  var host = document.getElementById('live-form');
  var skin = document.getElementById('live-skin');
  var locale = document.getElementById('live-locale');
  var note = document.getElementById('live-note');
  var memory = Fieldia.createMemoryDataSource();
  // A response lands in memory; say so, since nothing leaves the page.
  var dataSource = Object.assign({}, memory, {
    submit: function (request) {
      return memory.submit(request).then(function (result) {
        note.textContent = 'Received by the page’s in-memory data source — nothing was sent anywhere. In your app, this is your backend.';
        return result;
      });
    },
  });
  var viewer = null;
  function mount() {
    if (viewer) viewer.destroy();
    viewer = Fieldia.mountViewer(host, { page: pageIn(locale.value), dataSource: dataSource, skin: skin.value, locale: locale.value });
  }
  // fieldia.js speaks English; another language's words come in its own script, fetched the first time it is picked.
  var loaded = { en: true };
  function mountInLanguage() {
    var code = locale.value;
    if (loaded[code]) return mount();
    var words = document.createElement('script');
    words.src = '/fieldia.' + code + '.js';
    words.onload = function () {
      loaded[code] = true;
      if (locale.value === code) mount();
    };
    document.head.appendChild(words);
  }
  skin.addEventListener('change', function () {
    viewer.setSkin(skin.value);
  });
  locale.addEventListener('change', mountInLanguage);
  mountInLanguage();
  window.fieldiaLive = { dataSource: memory };
})();
