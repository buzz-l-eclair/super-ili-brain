const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SUPER-ILI-BRAIN/1.0 (RSS Reader)',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from /public — robust absolute path
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ── API: fetch a single RSS feed ──────────────────────────────────────────
app.get('/api/feed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });
  try {
    const feed = await parser.parseURL(url);
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

// ── API: fetch multiple feeds at once ─────────────────────────────────────
app.post('/api/feeds', async (req, res) => {
  const { feeds } = req.body;
  if (!Array.isArray(feeds)) return res.status(400).json({ error: 'feeds must be array' });

  const results = await Promise.all(feeds.map(async (f) => {
    try {
      const feed = await parser.parseURL(f.url);
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

// ── API: validate / test a single feed URL ────────────────────────────────
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

// ── Catch-all: serve index.html for any non-API route ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 400);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ◈ SUPER-ILI-BRAIN`);
  console.log(`  ▶ http://localhost:${PORT}`);
  console.log(`  ▶ Serving static from: ${publicDir}\n`);
});
