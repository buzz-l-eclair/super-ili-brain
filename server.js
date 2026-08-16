const express  = require('express');
const Parser   = require('rss-parser');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

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
   BASE DE DONNÉES PERSISTANTE (fichier JSON sur disque)
   → survit aux redémarrages du process Node ("relancée à chaque fois")
   → source de vérité unique pour les flux RSS et la taxonomie de tags
════════════════════════════════════════════════════════════════ */
const DATA_DIR   = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Taxonomie ILI officielle — 11 catégories + 1 fallback "non classifié".
// Chaque tag porte ses propres termes de classification, en français
// (toujours vérifié) + dans la langue déclarée du flux (si disponible).
// Un signal n'est rattaché à un tag QUE SI un de ces termes apparaît
// littéralement dans son titre/résumé — aucune classification arbitraire.
const DEFAULT_TAGS = [
  { key:'GI', label:'Guerre Informationnelle', color:'#ffb800', builtin:true, terms:{
    FR:['guerre informationnelle',"guerre de l'information"],
    EN:['information warfare','infowar','information war'],
    DE:['informationskrieg','informationskriegsführung'],
    ES:['guerra de la información','guerra informativa'],
    IT:["guerra dell'informazione",'guerra informativa'],
    PT:['guerra da informação','guerra de informação'],
    RU:['информационная война','информационную войну'],
    UK:['інформаційна війна','інформаційну війну'],
    AR:['حرب المعلومات'],
    ZH:['信息战'],
    TR:['bilgi savaşı'],
    FA:['جنگ اطلاعاتی'],
    JA:['情報戦'],
    HI:['सूचना युद्ध'],
    PL:['wojna informacyjna'],
  }},
  { key:'GC', label:'Guerre Cognitive', color:'#c87fff', builtin:true, terms:{
    FR:['guerre cognitive'],
    EN:['cognitive warfare','cognitive war'],
    DE:['kognitive kriegsführung'],
    ES:['guerra cognitiva'],
    IT:['guerra cognitiva'],
    PT:['guerra cognitiva'],
    RU:['когнитивная война','когнитивную войну'],
    UK:['когнітивна війна'],
    AR:['الحرب المعرفية'],
    ZH:['认知战'],
    TR:['bilişsel savaş'],
    FA:['جنگ شناختی'],
    JA:['認知戦'],
    HI:['संज्ञानात्मक युद्ध'],
    PL:['wojna kognitywna'],
  }},
  { key:'INFLUENCE', label:'Influence', color:'#00aaff', builtin:true, terms:{
    FR:['influence','ingérence','opération d\'influence','manipulation de l\'information'],
    EN:['influence operation','foreign interference','information manipulation','malign influence'],
    DE:['einflussoperation','einflussnahme'],
    ES:['operación de influencia','injerencia'],
    IT:['operazione di influenza','ingerenza'],
    PT:['operação de influência','interferência'],
    RU:['операция влияния','вмешательство'],
    UK:['операція впливу','втручання'],
    AR:['عملية تأثير','تدخل'],
    ZH:['影响力行动','干涉'],
    TR:['etki operasyonu','müdahale'],
    FA:['عملیات نفوذ','دخالت'],
    JA:['影響工作'],
    HI:['प्रभाव अभियान'],
    PL:['operacja wpływu','ingerencja'],
  }},
  { key:'DECEPTION', label:'Déception', color:'#ff3a2e', builtin:true, terms:{
    FR:['déception','désinformation','mésinformation'],
    EN:['deception','disinformation','misinformation'],
    DE:['täuschung','desinformation','fehlinformation'],
    ES:['engaño','desinformación'],
    IT:['inganno','disinformazione'],
    PT:['engano','desinformação'],
    RU:['дезинформация','обман'],
    UK:['дезінформація','обман'],
    AR:['التضليل','خداع'],
    ZH:['虚假信息','欺骗'],
    TR:['dezenformasyon','aldatma'],
    FA:['اطلاعات نادرست'],
    JA:['偽情報'],
    HI:['दुष्प्रचार'],
    PL:['dezinformacja'],
  }},
  { key:'PSYOPS', label:'Opérations Psychologiques (PSYOPS)', color:'#a0ff00', builtin:true, terms:{
    FR:['opérations psychologiques','guerre psychologique','psyops'],
    EN:['psychological operations','psywar','psyops'],
    DE:['psychologische kriegsführung','psyop'],
    ES:['operaciones psicológicas','guerra psicológica'],
    IT:['operazioni psicologiche','guerra psicologica'],
    PT:['operações psicológicas','guerra psicológica'],
    RU:['психологические операции'],
    UK:['психологічні операції'],
    AR:['العمليات النفسية'],
    ZH:['心理战'],
    TR:['psikolojik harekat'],
    FA:['عملیات روانی'],
    JA:['心理作戦'],
    HI:['मनोवैज्ञानिक अभियान'],
    PL:['operacje psychologiczne'],
  }},
  { key:'COMOPS', label:'Communication Opérationnelle (COMOPS)', color:'#ff6a00', builtin:true, terms:{
    FR:['communication opérationnelle'],
    EN:['operational communication','operations communication'],
    DE:['operative kommunikation'],
    ES:['comunicación operacional'],
    IT:['comunicazione operativa'],
    PT:['comunicação operacional'],
    RU:['оперативная коммуникация'],
    UK:['оперативна комунікація'],
    AR:['الاتصال العملياتي'],
    ZH:['行动沟通'],
    TR:['operasyonel iletişim'],
    FA:['ارتباطات عملیاتی'],
    JA:['作戦コミュニケーション'],
    HI:['परिचालन संचार'],
    PL:['komunikacja operacyjna'],
  }},
  { key:'STRATCOM', label:'Communication Stratégique (STRATCOM)', color:'#00ffee', builtin:true, terms:{
    FR:['communication stratégique'],
    EN:['strategic communication','strategic communications'],
    DE:['strategische kommunikation'],
    ES:['comunicación estratégica'],
    IT:['comunicazione strategica'],
    PT:['comunicação estratégica'],
    RU:['стратегическая коммуникация'],
    UK:['стратегічна комунікація'],
    AR:['الاتصال الاستراتيجي'],
    ZH:['战略传播'],
    TR:['stratejik iletişim'],
    FA:['ارتباطات راهبردی'],
    JA:['戦略的コミュニケーション'],
    HI:['सामरिक संचार'],
    PL:['komunikacja strategiczna'],
  }},
  { key:'LIO', label:'Lutte Informatique Offensive (LIO)', color:'#ff5540', builtin:true, terms:{
    FR:['lutte informatique offensive'],
    EN:['offensive cyber operations','offensive cyber operation','offensive cyber'],
    DE:['offensive cyberoperationen'],
    ES:['operaciones cibernéticas ofensivas'],
    IT:['operazioni cibernetiche offensive'],
    PT:['operações cibernéticas ofensivas'],
    RU:['наступательные киберoперации'],
    UK:['наступальні кібероперації'],
    AR:['عمليات إلكترونية هجومية'],
    ZH:['进攻性网络行动'],
    TR:['saldırgan siber operasyonlar'],
    FA:['عملیات سایبری تهاجمی'],
    JA:['攻撃的サイバー作戦'],
    HI:['आक्रामक साइबर अभियान'],
    PL:['ofensywne operacje cybernetyczne'],
  }},
  { key:'LID', label:'Lutte Informatique Défensive (LID)', color:'#3ddc84', builtin:true, terms:{
    FR:['lutte informatique défensive'],
    EN:['defensive cyber operations','defensive cyber operation','defensive cyber'],
    DE:['defensive cyberoperationen'],
    ES:['operaciones cibernéticas defensivas'],
    IT:['operazioni cibernetiche difensive'],
    PT:['operações cibernéticas defensivas'],
    RU:['оборонительные киберoперации'],
    UK:['оборонні кібероперації'],
    AR:['عمليات إلكترونية دفاعية'],
    ZH:['防御性网络行动'],
    TR:['savunma amaçlı siber operasyonlar'],
    FA:['عملیات سایبری دفاعی'],
    JA:['防御的サイバー作戦'],
    HI:['रक्षात्मक साइबर अभियान'],
    PL:['defensywne operacje cybernetyczne'],
  }},
  { key:'L2I', label:"Lutte Informatique d'Influence (L2I)", color:'#ff2d9f', builtin:true, terms:{
    FR:["lutte informatique d'influence",'l2i'],
    EN:['cyber influence operations','cyber influence operation'],
    DE:['cyber-einflussoperationen'],
    ES:['operaciones cibernéticas de influencia'],
    IT:['operazioni cibernetiche di influenza'],
    PT:['operações cibernéticas de influência'],
    RU:['кибер-операции влияния'],
    UK:['кібер-операції впливу'],
    AR:['عمليات التأثير السيبراني'],
    ZH:['网络影响行动'],
    TR:['siber etki operasyonları'],
    FA:['عملیات نفوذ سایبری'],
    JA:['サイバー影響工作'],
    HI:['साइबर प्रभाव अभियान'],
    PL:['cybernetyczne operacje wpływu'],
  }},
  { key:'ILI', label:'Influence et Lutte Informationnelle (ILI)', color:'#00ffaa', builtin:true, terms:{
    FR:['influence et lutte informationnelle',' ili '],
    EN:['influence and information warfare'],
    DE:['einfluss und informationskrieg'],
    ES:['influencia y guerra de la información'],
    IT:["influenza e guerra dell'informazione"],
    PT:['influência e guerra da informação'],
    RU:['влияние и информационная война'],
    UK:['вплив та інформаційна війна'],
    AR:['التأثير وحرب المعلومات'],
    ZH:['影响与信息战'],
    TR:['etki ve bilgi savaşı'],
    FA:['نفوذ و جنگ اطلاعاتی'],
    JA:['影響と情報戦'],
    HI:['प्रभाव और सूचना युद्ध'],
    PL:['wpływ i wojna informacyjna'],
  }},
  { key:'NC', label:'Non Classifié', color:'#42607a', builtin:true, terms:{} },
];

function loadStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return {
        feeds: Array.isArray(raw.feeds) ? raw.feeds : [],
        tags:  Array.isArray(raw.tags) && raw.tags.length ? raw.tags : DEFAULT_TAGS,
      };
    }
  } catch (e) { console.error('  ⚠ Erreur lecture data/store.json :', e.message); }
  return { feeds: [], tags: DEFAULT_TAGS };
}

let store = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) { console.error('  ⚠ Erreur écriture data/store.json :', e.message); }
}
if (!fs.existsSync(STORE_FILE)) saveStore(); // amorce le fichier au 1er lancement

// Classifie un texte : ne retourne un tag QUE SI un de ses termes
// (français, systématiquement vérifié + langue déclarée du flux) apparaît.
function classifyText(text, lang, tags) {
  const lc = (' ' + (text || '') + ' ').toLowerCase();
  const L  = (lang || 'FR').toUpperCase();
  const matched = [];
  (tags || []).forEach(tag => {
    if (!tag.terms || tag.key === 'NC') return;
    const terms = [...(tag.terms.FR || []), ...(L !== 'FR' ? (tag.terms[L] || []) : [])];
    if (terms.some(t => t && lc.includes(t.toLowerCase()))) matched.push(tag.key);
  });
  return matched;
}

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
      const items = (feed.items || []).slice(0, 30).map(item => {
        const title = (item.title || '').trim();
        const desc  = stripHtml(item.contentSnippet || item.content || item.summary || item.description || '');
        // Classification réelle : un tag n'est attribué que si un de ses
        // termes (FR + langue déclarée du flux) apparaît dans le texte.
        const matchedTags = classifyText(title + ' ' + desc, f.lang, store.tags);
        return {
          title,
          link:    item.link || item.guid || '',
          desc,
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source:  f.name || feed.title || f.url,
          feedTag: f.tag,               // tag déclaré par la source (indicatif, sidebar uniquement)
          lang:    f.lang,
          matchedTags,                   // tous les tags dont un terme a matché
          tag:     matchedTags[0] || 'NC', // tag principal affiché / filtrable
        };
      });
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
   BASE DE DONNÉES — FLUX & TAGS (persistance disque, /data/store.json)
   Toute modification côté client passe par ces routes : la base est
   rechargée telle quelle à chaque redémarrage du serveur.
════════════════════════════════════════════════════════════════ */
app.get('/api/store', (req, res) => {
  res.json({ ok: true, feeds: store.feeds, tags: store.tags });
});

app.post('/api/store/feed', (req, res) => {
  const { name, url, tag, lang } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: 'url requis' });
  if (store.feeds.find(f => f.url === url)) {
    return res.json({ ok: false, error: 'Flux déjà présent', feeds: store.feeds });
  }
  store.feeds.push({ name: name || url, url, tag: tag || 'GI', lang: lang || 'FR' });
  saveStore();
  res.json({ ok: true, feeds: store.feeds });
});

app.post('/api/store/feeds-bulk', (req, res) => {
  const { feeds } = req.body || {};
  if (!Array.isArray(feeds)) return res.status(400).json({ ok: false, error: 'feeds doit être un tableau' });
  let added = 0;
  feeds.forEach(f => {
    if (f && f.url && !store.feeds.find(x => x.url === f.url)) {
      store.feeds.push({ name: f.name || f.url, url: f.url, tag: f.tag || 'GI', lang: f.lang || 'FR' });
      added++;
    }
  });
  if (added > 0) saveStore();
  res.json({ ok: true, added, feeds: store.feeds });
});

app.delete('/api/store/feed', (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: 'url requis' });
  const before = store.feeds.length;
  store.feeds = store.feeds.filter(f => f.url !== url);
  if (store.feeds.length !== before) saveStore();
  res.json({ ok: true, feeds: store.feeds });
});

app.post('/api/store/tag', (req, res) => {
  const { key, label, color, terms } = req.body || {};
  if (!key || !label) return res.status(400).json({ ok: false, error: 'key et label requis' });
  const k = String(key).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16);
  if (!k) return res.status(400).json({ ok: false, error: 'clé de tag invalide' });
  if (store.tags.find(t => t.key === k)) {
    return res.json({ ok: false, error: 'Ce tag existe déjà', tags: store.tags });
  }
  // terms attendu : { FR:[...], EN:[...], ... } — au moins FR requis pour être opérant
  const cleanTerms = {};
  if (terms && typeof terms === 'object') {
    Object.entries(terms).forEach(([langCode, list]) => {
      if (Array.isArray(list)) {
        const arr = list.map(s => String(s).trim().toLowerCase()).filter(Boolean);
        if (arr.length) cleanTerms[langCode.toUpperCase().slice(0, 4)] = arr;
      }
    });
  }
  store.tags.push({
    key: k, label: String(label).slice(0, 80),
    color: /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#7a9bbf',
    builtin: false, terms: cleanTerms,
  });
  saveStore();
  res.json({ ok: true, tags: store.tags });
});

app.delete('/api/store/tag', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'key requis' });
  const before = store.tags.length;
  store.tags = store.tags.filter(t => t.key !== key);
  if (store.tags.length !== before) saveStore();
  res.json({ ok: true, tags: store.tags });
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
