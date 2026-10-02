// Links between the example pages and skins, for people browsing the demos.
(function () {
  const params = new URLSearchParams(location.search);
  const current = { page: params.get('page') || 'signup', skin: params.get('skin') || 'underline' };
  const box = document.querySelector('[data-links]');
  const link = (page, skin, text) => {
    const a = document.createElement('a');
    a.href = `?page=${page}&skin=${skin}`;
    a.textContent = text;
    if (page === current.page && skin === current.skin) a.setAttribute('aria-current', 'page');
    return a;
  };
  for (const page of ['signup', 'survey', 'customer', 'fields']) {
    for (const skin of ['underline', 'outlined']) box.append(link(page, skin, `${page} · ${skin}`));
  }
})();
