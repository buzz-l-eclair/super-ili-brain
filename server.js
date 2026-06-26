const express  = require('express');
const Parser   = require('rss-parser');
const cors     = require('cors');
const path     = require('path');

const app = express();
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SUPER-ILI-BRAIN/1.0 (RSS Reader)',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
  },
  customFields: {
    item: [
      ['media:content',   'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ]
  }
});

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

/* ════════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════ */
function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim().slice(0, 400);
}

function normalizeSocialItem(raw, platform, handle) {
  return {
    title:    (raw.title || raw.text || '').trim().slice(0, 200),
    link:     raw.link || raw.url || raw.guid || '',
    desc:     stripHtml(raw.contentSnippet || raw.content || raw.summary || raw.description || raw.text || ''),
    pubDate:  raw.pubDate || raw.isoDate || raw.date || new Date().toISOString(),
    source:   handle || raw.author || platform,
    platform: platform,
    handle:   handle || '',
    likes:    raw.likes    || raw.retweet_count || 0,
    reposts:  raw.reposts  || raw.retweet_count || 0,
    views:    raw.views    || 0,
    replies:  raw.replies  || 0,
    verified: raw.verified || false,
    hashtags: extractHashtags(raw.title || raw.text || raw.description || ''),
  };
}

function extractHashtags(text) {
  const m = text.match(/#[\wÀ-ÿ]+/g);
  return m ? [...new Set(m.map(h => h.toLowerCase()))].slice(0, 10) : [];
}

/* ════════════════════════════════════════════════════════════════
   RSS FEEDS (existing)
════════════════════════════════════════════════════════════════ */
app.get('/api/feed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });
  try {
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 50).map(item => ({
      title:   (item.title || '').trim(),
      link:    item.link || item.guid || '',
      desc:    stripHtml(item.contentSnippet || item.content || item.summary || item.description || ''),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source:  feed.title || url,
    }));
    res.json({ ok: true, title: feed.title || url, count: items.length, items });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message, items: [] });
  }
});

app.post('/api/feeds', async (req, res) => {
  const { feeds } = req.body;
  if (!Array.isArray(feeds)) return res.status(400).json({ error: 'feeds must be array' });
  const results = await Promise.all(feeds.map(async (f) => {
    try {
      const feed  = await parser.parseURL(f.url);
      const items = (feed.items || []).slice(0, 30).map(item => ({
        title:   (item.title || '').trim(),
        link:    item.link || item.guid || '',
        desc:    stripHtml(item.contentSnippet || item.content || item.summary || item.description || ''),
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source:  f.name || feed.title || f.url,
        tag:     f.tag,
        lang:    f.lang,
      }));
      return { name: f.name, url: f.url, ok: true, count: items.length, items };
    } catch (err) {
      return { name: f.name, url: f.url, ok: false, error: err.message, items: [] };
    }
  }));
  res.json({ results });
});

app.get('/api/test-feed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });
  try {
    const feed = await parser.parseURL(url);
    res.json({ ok: true, title: feed.title, count: (feed.items || []).length });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════
   SOCIAL — RSS BRIDGE (Nitter / YouTube / Mastodon / Bluesky)
   Ces endpoints résolvent les flux RSS publics sans API key.
════════════════════════════════════════════════════════════════ */

// Nitter instances de fallback (ordre de priorité)
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
];

async function fetchNitterRSS(handle, type = 'user') {
  // type: 'user' | 'hashtag' | 'search'
  const slug = type === 'hashtag'
    ? `/search/rss?q=${encodeURIComponent(handle)}&f=tweets`
    : `/${handle.replace('@','')}/rss`;

  for (const instance of NITTER_INSTANCES) {
    try {
      const url  = instance + slug;
      const feed = await parser.parseURL(url);
      return {
        ok: true, instance, handle,
        items: (feed.items || []).slice(0, 30).map(item =>
          normalizeSocialItem(item, 'twitter', handle)
        )
      };
    } catch (_) { /* essaie la suivante */ }
  }
  return { ok: false, handle, items: [], error: 'Toutes les instances Nitter KO' };
}

// Twitter/X — compte ou hashtag via Nitter RSS
app.get('/api/social/twitter', async (req, res) => {
  const { handle, type } = req.query;  // type: user|hashtag
  if (!handle) return res.status(400).json({ ok: false, error: 'Missing handle' });
  const result = await fetchNitterRSS(handle, type || 'user');
  res.json(result);
});

// YouTube — RSS natif (pas d'API key nécessaire)
app.get('/api/social/youtube', async (req, res) => {
  const { channel_id, handle } = req.query;
  let url;
  if (channel_id) {
    url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel_id}`;
  } else if (handle) {
    // Résolution handle → channel_id via scraping léger
    try {
      const r   = await fetch(`https://www.youtube.com/@${handle}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS-Fetcher/1.0)' }
      });
      const txt = await r.text();
      const m   = txt.match(/"channelId":"([^"]+)"/);
      if (!m) return res.json({ ok: false, error: 'Channel ID introuvable', items: [] });
      url = `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`;
    } catch (e) {
      return res.json({ ok: false, error: e.message, items: [] });
    }
  } else {
    return res.status(400).json({ ok: false, error: 'channel_id ou handle requis' });
  }
  try {
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 20).map(item => ({
      ...normalizeSocialItem(item, 'youtube', handle || channel_id),
      thumbnail: item.mediaContent?.$.url || item.mediaThumbnail?.$.url || '',
    }));
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Mastodon — RSS natif par compte ou hashtag
app.get('/api/social/mastodon', async (req, res) => {
  const { handle, hashtag, instance } = req.query;
  // handle: @user@instance.social  |  hashtag: #hashtag + instance
  let url;
  try {
    if (hashtag) {
      const inst = instance || 'mastodon.social';
      url = `https://${inst}/tags/${hashtag.replace('#','')}.rss`;
    } else if (handle) {
      const parts  = handle.replace('@','').split('@');
      const user   = parts[0];
      const inst   = parts[1] || instance || 'mastodon.social';
      // Récupère l'account ID
      const apiUrl = `https://${inst}/api/v1/accounts/lookup?acct=${user}`;
      const r      = await fetch(apiUrl, { headers: { 'User-Agent': 'SUPER-ILI-BRAIN/1.0' } });
      const acct   = await r.json();
      if (!acct.id) return res.json({ ok: false, error: 'Compte Mastodon introuvable', items: [] });
      url = `https://${inst}/@${user}.rss`;
    } else {
      return res.status(400).json({ ok: false, error: 'handle ou hashtag requis' });
    }
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 30).map(item =>
      normalizeSocialItem(item, 'mastodon', handle || hashtag)
    );
    res.json({ ok: true, items, count: items.length, url });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Bluesky — RSS via bsky.app RSS bridge
app.get('/api/social/bluesky', async (req, res) => {
  const { handle, hashtag } = req.query;
  let url;
  try {
    if (hashtag) {
      // Bridgy Fed / recherche hashtag via AT Protocol public
      url = `https://bsky.app/search?q=${encodeURIComponent('#' + hashtag.replace('#',''))}&rss=1`;
    } else if (handle) {
      url = `https://bsky.app/profile/${handle}/rss`;
    } else {
      return res.status(400).json({ ok: false, error: 'handle ou hashtag requis' });
    }
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 30).map(item =>
      normalizeSocialItem(item, 'bluesky', handle || hashtag)
    );
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Reddit — RSS natif
app.get('/api/social/reddit', async (req, res) => {
  const { subreddit, search, sort } = req.query;
  let url;
  if (search) {
    url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(search)}&sort=${sort||'new'}&limit=25`;
  } else if (subreddit) {
    url = `https://www.reddit.com/r/${subreddit}/${sort||'new'}.rss?limit=25`;
  } else {
    return res.status(400).json({ ok: false, error: 'subreddit ou search requis' });
  }
  try {
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 25).map(item =>
      normalizeSocialItem(item, 'reddit', subreddit || search)
    );
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Telegram — canaux publics via RSS bridges publics
app.get('/api/social/telegram', async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ ok: false, error: 'channel requis' });
  // Essaie plusieurs bridges Telegram→RSS
  const bridges = [
    `https://rsshub.app/telegram/channel/${channel}`,
    `https://tg.i-c-a.su/rss/${channel}`,
    `https://telegramrss.com/rss/${channel}`,
  ];
  for (const url of bridges) {
    try {
      const feed  = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, 30).map(item =>
        normalizeSocialItem(item, 'telegram', channel)
      );
      return res.json({ ok: true, items, count: items.length, bridge: url });
    } catch (_) {}
  }
  res.json({ ok: false, error: 'Tous les bridges Telegram KO', items: [] });
});

/* ════════════════════════════════════════════════════════════════
   SOCIAL — BATCH : fetch toutes les sources sociales en une fois
════════════════════════════════════════════════════════════════ */
app.post('/api/social/batch', async (req, res) => {
  const { sources } = req.body;  // [{platform, handle, type, id}]
  if (!Array.isArray(sources)) return res.status(400).json({ error: 'sources must be array' });

  const results = await Promise.allSettled(sources.map(async s => {
    const base = { platform: s.platform, handle: s.handle || s.id, label: s.label };
    try {
      let r;
      switch (s.platform) {
        case 'twitter':  r = await fetchNitterRSS(s.handle, s.type || 'user'); break;
        case 'youtube':  {
          const resp = await fetch(`http://localhost:${PORT}/api/social/youtube?${s.channel_id ? 'channel_id='+s.channel_id : 'handle='+s.handle}`);
          r = await resp.json();
          break;
        }
        case 'mastodon': {
          const q = s.hashtag ? `hashtag=${s.hashtag}&instance=${s.instance||'mastodon.social'}` : `handle=${s.handle}`;
          const resp = await fetch(`http://localhost:${PORT}/api/social/mastodon?${q}`);
          r = await resp.json();
          break;
        }
        case 'bluesky':  {
          const q = s.hashtag ? `hashtag=${s.hashtag}` : `handle=${s.handle}`;
          const resp = await fetch(`http://localhost:${PORT}/api/social/bluesky?${q}`);
          r = await resp.json();
          break;
        }
        case 'reddit':   {
          const q = s.subreddit ? `subreddit=${s.subreddit}` : `search=${encodeURIComponent(s.search)}`;
          const resp = await fetch(`http://localhost:${PORT}/api/social/reddit?${q}`);
          r = await resp.json();
          break;
        }
        case 'telegram': {
          const resp = await fetch(`http://localhost:${PORT}/api/social/telegram?channel=${s.handle}`);
          r = await resp.json();
          break;
        }
        default: r = { ok: false, error: 'Plateforme inconnue', items: [] };
      }
      return { ...base, ok: r.ok, items: r.items || [], count: (r.items||[]).length, error: r.error };
    } catch (e) {
      return { ...base, ok: false, items: [], count: 0, error: e.message };
    }
  }));

  res.json({
    results: results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, items: [], error: r.reason?.message })
  });
});

/* ════════════════════════════════════════════════════════════════
   SOCIAL — SCRAPING PLAYWRIGHT (hashtags / recherche avancée)
   Lazy-load : Playwright importé seulement si dispo
════════════════════════════════════════════════════════════════ */
let playwrightAvailable = false;
let chromium;
try {
  ({ chromium } = require('playwright'));
  playwrightAvailable = true;
  console.log('  ✓ Playwright disponible — scraping avancé activé');
} catch (_) {
  console.log('  ⚠ Playwright non installé — scraping avancé désactivé');
  console.log('    Pour activer : npm install playwright && npx playwright install chromium');
}

// Cache scraping (5 min par requête)
const scraperCache = new Map();
const SCRAPE_TTL   = 5 * 60 * 1000;

async function withBrowser(fn) {
  if (!playwrightAvailable) throw new Error('Playwright non installé');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  try   { return await fn(browser); }
  finally { await browser.close(); }
}

// Scraping Twitter hashtag via Nitter (fallback Playwright si RSS KO)
app.get('/api/scrape/twitter-hashtag', async (req, res) => {
  const { hashtag } = req.query;
  if (!hashtag) return res.status(400).json({ ok: false, error: 'hashtag requis' });

  const cacheKey = `tw_ht_${hashtag}`;
  const cached   = scraperCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCRAPE_TTL) return res.json(cached.data);

  // Essaie d'abord RSS Nitter
  const rssResult = await fetchNitterRSS(hashtag, 'hashtag');
  if (rssResult.ok && rssResult.items.length > 0) {
    const data = { ok: true, method: 'nitter-rss', items: rssResult.items };
    scraperCache.set(cacheKey, { ts: Date.now(), data });
    return res.json(data);
  }

  // Fallback Playwright sur Nitter
  if (!playwrightAvailable) return res.json({ ok: false, error: 'RSS KO et Playwright non installé', items: [] });

  try {
    const items = await withBrowser(async browser => {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });
      const tag = hashtag.replace('#','');
      await page.goto(`${NITTER_INSTANCES[0]}/search?q=%23${tag}&f=tweets`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return page.evaluate(() =>
        Array.from(document.querySelectorAll('.timeline-item')).slice(0, 30).map(el => ({
          title:   el.querySelector('.tweet-content')?.innerText?.trim() || '',
          link:    'https://twitter.com' + (el.querySelector('a.tweet-link')?.getAttribute('href') || ''),
          pubDate: el.querySelector('.tweet-date a')?.getAttribute('title') || new Date().toISOString(),
          likes:   parseInt(el.querySelector('.icon-heart')?.closest('.tweet-stat')?.innerText || '0') || 0,
          reposts: parseInt(el.querySelector('.icon-retweet')?.closest('.tweet-stat')?.innerText || '0') || 0,
          replies: parseInt(el.querySelector('.icon-comment')?.closest('.tweet-stat')?.innerText || '0') || 0,
        }))
      );
    });
    const normalized = items.map(it => normalizeSocialItem({ ...it, text: it.title }, 'twitter', '#' + hashtag.replace('#','')));
    const data = { ok: true, method: 'playwright-nitter', items: normalized };
    scraperCache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Scraping YouTube — recherche par terme/hashtag
app.get('/api/scrape/youtube-search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: 'q requis' });

  const cacheKey = `yt_${q}`;
  const cached   = scraperCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCRAPE_TTL) return res.json(cached.data);

  if (!playwrightAvailable) return res.json({ ok: false, error: 'Playwright non installé', items: [] });

  try {
    const items = await withBrowser(async browser => {
      const page = await browser.newPage();
      await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAISAhAB`, {
        waitUntil: 'networkidle', timeout: 20000
      });
      await page.waitForSelector('ytd-video-renderer', { timeout: 8000 }).catch(() => {});
      return page.evaluate(() =>
        Array.from(document.querySelectorAll('ytd-video-renderer')).slice(0, 15).map(el => ({
          title:   el.querySelector('#video-title')?.innerText?.trim() || '',
          link:    'https://youtube.com' + (el.querySelector('#video-title')?.getAttribute('href') || ''),
          source:  el.querySelector('#channel-name a')?.innerText?.trim() || '',
          views:   el.querySelector('#metadata-line span:first-child')?.innerText || '0',
          pubDate: el.querySelector('#metadata-line span:last-child')?.innerText || '',
          thumbnail: el.querySelector('img')?.src || '',
        }))
      );
    });
    const normalized = items.map(it => normalizeSocialItem({ ...it, text: it.title }, 'youtube', it.source));
    const data = { ok: true, method: 'playwright', items: normalized };
    scraperCache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Scraping Reddit — recherche par terme
app.get('/api/scrape/reddit-search', async (req, res) => {
  const { q, sort } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: 'q requis' });
  // Reddit a un RSS natif, on l'utilise directement
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=${sort||'new'}&limit=25`;
  try {
    const feed  = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 25).map(item =>
      normalizeSocialItem(item, 'reddit', q)
    );
    res.json({ ok: true, method: 'rss', items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

// Statut Playwright
app.get('/api/scrape/status', (req, res) => {
  res.json({ playwright: playwrightAvailable, cache_entries: scraperCache.size });
});

/* ════════════════════════════════════════════════════════════════
   CATCH-ALL
════════════════════════════════════════════════════════════════ */
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ◈ SUPER-ILI-BRAIN`);
  console.log(`  ▶ http://localhost:${PORT}`);
  console.log(`  ▶ Playwright : ${playwrightAvailable ? 'ACTIVÉ' : 'désactivé (npm install playwright)'}`);
  console.log(`  ▶ Serving static from: ${publicDir}\n`);
});
