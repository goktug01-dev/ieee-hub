/* WordPress ana sayfasındaki Duyurular bölümüne Hub duyurularını ekler. */
(() => {
  const script = document.currentScript;
  const database = script?.dataset.databaseUrl;
  const path = script?.dataset.path || 'public_announcements';
  if (!database || window.ieeeHubAnnouncementsInstalled) return;
  let endpoint;
  try {
    endpoint = new URL(`${path.replace(/^\/+|\/+$/g, '')}.json`, `${database.replace(/\/$/, '')}/`);
    if (endpoint.protocol !== 'https:') return;
  } catch { return; }
  window.ieeeHubAnnouncementsInstalled = true;
  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const start = () => {
    const existing = document.querySelector('#ikh-duyurular');
    if (!existing) return;
    const feed = element('div', 'ikh-news');
    feed.id = 'ikh-hub-duyurular';
    feed.hidden = true;
    feed.style.marginBottom = '20px';
    feed.setAttribute('aria-live', 'polite');
    existing.before(feed);
    let loading = false, previous = '';
    const refresh = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(endpoint, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Duyuru bağlantısı: ${response.status}`);
        const records = await response.json();
        // Bu kutu yalnız Hub duyurularını gösterir; mevcut WordPress duyuruları korunur.
        const items = Object.entries(records || {}).filter(([id, item]) => id.startsWith('hub-') && item && typeof item.title === 'string' && typeof item.content === 'string')
          .sort((a, b) => Number(!!b[1].pinned) - Number(!!a[1].pinned) || Number(b[1].createdAt) - Number(a[1].createdAt)).slice(0, 5);
        const version = JSON.stringify(items);
        if (version === previous) return;
        previous = version;
        const fragment = document.createDocumentFragment();
        for (const [id, item] of items) {
          let url;
          try { const candidate = new URL(item.link, location.href); if (item.link && ['https:', 'http:'].includes(candidate.protocol)) url = candidate; } catch { /* Bağlantısız duyuru */ }
          const card = element(url ? 'a' : 'article', 'ikh-news__item');
          card.id = `ikh-${id}`;
          if (url) card.href = url.href;
          const date = element('div', 'ikh-date');
          const created = new Date(Number(item.createdAt));
          if (Number.isFinite(created.getTime())) {
            date.append(element('b', '', created.toLocaleDateString('tr-TR', { day: '2-digit' })), element('span', '', created.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })));
          }
          const body = element('div');
          if (item.pinned) body.append(element('span', 'ikh-chip', 'Sabitlenmiş duyuru'));
          body.append(element('h3', 'ikh-news__title', item.title));
          const content = element('p', '', item.content);
          content.style.whiteSpace = 'pre-wrap';
          content.style.marginTop = '8px';
          body.append(content);
          card.append(date, body);
          fragment.append(card);
        }
        feed.replaceChildren(fragment);
        feed.hidden = items.length === 0;
      } catch (error) { console.warn('Hub duyuruları alınamadı.', error); }
      finally { loading = false; }
    };
    void refresh();
    window.setInterval(() => void refresh(), 60000);
    document.addEventListener('visibilitychange', () => void refresh());
    window.addEventListener('online', () => void refresh());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
