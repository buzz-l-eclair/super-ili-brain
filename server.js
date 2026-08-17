const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
      ['content:encoded', 'contentEncoded']
    ]
  }
});

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

/* ================================================================
   DONNÉES
================================================================ */

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');


/* ================================================================
   BIBLIOTHÈQUE DE SOURCES
================================================================ */

function loadSourceLibrary() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.warn('⚠️ Répertoire sources absent');
    return [];
  }

  const files = fs.readdirSync(SOURCES_DIR)
    .filter(file =>
      file.endsWith('.json') &&
      file !== 'index.json'
    );

  const sources = [];

  for (const file of files) {
    try {
      const fullPath = path.join(SOURCES_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        console.warn(`⚠️ ${file} n'est pas un tableau JSON`);
        continue;
      }

      sources.push(...data);
    } catch (error) {
      console.error(
        `❌ Erreur chargement ${file}:`,
        error.message
      );
    }
  }

  const unique = [];
  const seen = new Set();

  for (const source of sources) {
    if (!source || !source.url) continue;
    if (seen.has(source.url)) continue;

    seen.add(source.url);
    unique.push(source);
  }

  return unique;
}

const SOURCE_LIBRARY = loadSourceLibrary();

console.log(
  `✓ Bibliothèque ILI chargée : ${SOURCE_LIBRARY.length} sources`
);


/* ================================================================
   TAXONOMIE ILI
================================================================ */

/*
 * IMPORTANT :
 *
 * Les clés utilisées dans toute l'application sont UNIQUEMENT :
 *
 * GI
 * GC
 * INFLUENCE
 * DECEPTION
 * PSYOPS
 * COMOPS
 * STRATCOM
 * LIO
 * LID
 * L2I
 * ILI
 * NC
 *
 * Il ne faut notamment PLUS utiliser :
 *
 * information_warfare
 * cognitive_warfare
 * influence_operation
 * etc.
 */

const DEFAULT_TAGS = [

  {
    key: 'GI',
    label: 'Guerre Informationnelle',
    color: '#ffb800',
    builtin: true,
    terms: {
      FR: [
        'guerre informationnelle',
        "guerre de l'information"
      ],
      EN: [
        'information warfare',
        'infowar',
        'information war'
      ],
      DE: [
        'informationskrieg',
        'informationskriegsführung'
      ],
      ES: [
        'guerra de la información',
        'guerra informativa'
      ],
      IT: [
        "guerra dell'informazione",
        'guerra informativa'
      ],
      PT: [
        'guerra da informação',
        'guerra de informação'
      ],
      RU: [
        'информационная война',
        'информационную войну'
      ],
      UK: [
        'інформаційна війна',
        'інформаційну війну'
      ],
      AR: ['حرب المعلومات'],
      ZH: ['信息战'],
      TR: ['bilgi savaşı'],
      FA: ['جنگ اطلاعاتی'],
      JA: ['情報戦'],
      HI: ['सूचना युद्ध'],
      PL: ['wojna informacyjna']
    }
  },

  {
    key: 'GC',
    label: 'Guerre Cognitive',
    color: '#c87fff',
    builtin: true,
    terms: {
      FR: [
        'guerre cognitive'
      ],
      EN: [
        'cognitive warfare',
        'cognitive war'
      ],
      DE: [
        'kognitive kriegsführung'
      ],
      ES: [
        'guerra cognitiva'
      ],
      IT: [
        'guerra cognitiva'
      ],
      PT: [
        'guerra cognitiva'
      ],
      RU: [
        'когнитивная война',
        'когнитивную войну'
      ],
      UK: [
        'когнітивна війна'
      ],
      AR: [
        'الحرب المعرفية'
      ],
      ZH: [
        '认知战'
      ],
      TR: [
        'bilişsel savaş'
      ],
      FA: [
        'جنگ شناختی'
      ],
      JA: [
        '認知戦'
      ],
      HI: [
        'संज्ञानात्मक युद्ध'
      ],
      PL: [
        'wojna kognitywna'
      ]
    }
  },

  {
    key: 'INFLUENCE',
    label: 'Influence',
    color: '#00aaff',
    builtin: true,
    terms: {
      FR: [
        'opération d’influence',
        'operation d’influence',
        "opération d'influence",
        'ingérence',
        'ingérence étrangère',
        'influence étrangère',
        'influence malveillante',
        'manipulation de l’information',
        "manipulation de l'information"
      ],
      EN: [
        'influence operation',
        'influence operations',
        'foreign interference',
        'information manipulation',
        'malign influence',
        'influence campaign'
      ],
      DE: [
        'einflussoperation',
        'einflussnahme'
      ],
      ES: [
        'operación de influencia',
        'injerencia'
      ],
      IT: [
        'operazione di influenza',
        'ingerenza'
      ],
      PT: [
        'operação de influência',
        'interferência'
      ],
      RU: [
        'операция влияния',
        'вмешательство'
      ],
      UK: [
        'операція впливу',
        'втручання'
      ],
      AR: [
        'عملية تأثير',
        'تدخل'
      ],
      ZH: [
        '影响力行动',
        '干涉'
      ],
      TR: [
        'etki operasyonu',
        'müdahale'
      ],
      FA: [
        'عملیات نفوذ',
        'دخالت'
      ],
      JA: [
        '影響工作'
      ],
      HI: [
        'प्रभाव अभियान'
      ],
      PL: [
        'operacja wpływu',
        'ingerencja'
      ]
    }
  },

  {
    key: 'DECEPTION',
    label: 'Déception',
    color: '#ff3a2e',
    builtin: true,
    terms: {
      FR: [
        'déception',
        'desinformation',
        'désinformation',
        'mésinformation',
        'mesinformation'
      ],
      EN: [
        'deception',
        'deception operation',
        'disinformation',
        'misinformation'
      ],
      DE: [
        'täuschung',
        'desinformation',
        'fehlinformation'
      ],
      ES: [
        'engaño',
        'desinformación'
      ],
      IT: [
        'inganno',
        'disinformazione'
      ],
      PT: [
        'engano',
        'desinformação'
      ],
      RU: [
        'дезинформация',
        'обман'
      ],
      UK: [
        'дезінформація',
        'обман'
      ],
      AR: [
        'التضليل',
        'خداع'
      ],
      ZH: [
        '虚假信息',
        '欺骗'
      ],
      TR: [
        'dezenformasyon',
        'aldatma'
      ],
      FA: [
        'اطلاعات نادرست'
      ],
      JA: [
        '偽情報'
      ],
      HI: [
        'दुष्प्रचार'
      ],
      PL: [
        'dezinformacja'
      ]
    }
  },

  {
    key: 'PSYOPS',
    label: 'Opérations Psychologiques (PSYOPS)',
    color: '#a0ff00',
    builtin: true,
    terms: {
      FR: [
        'opérations psychologiques',
        'operations psychologiques',
        'guerre psychologique',
        'psyops'
      ],
      EN: [
        'psychological operations',
        'psychological operation',
        'psywar',
        'psyops'
      ],
      DE: [
        'psychologische kriegsführung',
        'psyop'
      ],
      ES: [
        'operaciones psicológicas',
        'guerra psicológica'
      ],
      IT: [
        'operazioni psicologiche',
        'guerra psicologica'
      ],
      PT: [
        'operações psicológicas',
        'guerra psicológica'
      ],
      RU: [
        'психологические операции'
      ],
      UK: [
        'психологічні операції'
      ],
      AR: [
        'العمليات النفسية'
      ],
      ZH: [
        '心理战'
      ],
      TR: [
        'psikolojik harekat'
      ],
      FA: [
        'عملیات روانی'
      ],
      JA: [
        '心理作戦'
      ],
      HI: [
        'मनोवैज्ञानिक अभियान'
      ],
      PL: [
        'operacje psychologiczne'
      ]
    }
  },

  {
    key: 'COMOPS',
    label: 'Communication Opérationnelle (COMOPS)',
    color: '#ff6a00',
    builtin: true,
    terms: {
      FR: [
        'communication opérationnelle',
        'communications opérationnelles'
      ],
      EN: [
        'operational communication',
        'operational communications',
        'operations communication'
      ],
      DE: [
        'operative kommunikation'
      ],
      ES: [
        'comunicación operacional'
      ],
      IT: [
        'comunicazione operativa'
      ],
      PT: [
        'comunicação operacional'
      ],
      RU: [
        'оперативная коммуникация'
      ],
      UK: [
        'оперативна комунікація'
      ],
      AR: [
        'الاتصال العملياتي'
      ],
      ZH: [
        '行动沟通'
      ],
      TR: [
        'operasyonel iletişim'
      ],
      FA: [
        'ارتباطات عملیاتی'
      ],
      JA: [
        '作戦コミュニケーション'
      ],
      HI: [
        'परिचालन संचार'
      ],
      PL: [
        'komunikacja operacyjna'
      ]
    }
  },

  {
    key: 'STRATCOM',
    label: 'Communication Stratégique (STRATCOM)',
    color: '#00ffee',
    builtin: true,
    terms: {
      FR: [
        'communication stratégique',
        'communications stratégiques'
      ],
      EN: [
        'strategic communication',
        'strategic communications',
        'stratcom'
      ],
      DE: [
        'strategische kommunikation'
      ],
      ES: [
        'comunicación estratégica'
      ],
      IT: [
        'comunicazione strategica'
      ],
      PT: [
        'comunicação estratégica'
      ],
      RU: [
        'стратегическая коммуникация'
      ],
      UK: [
        'стратегічна комунікація'
      ],
      AR: [
        'الاتصال الاستراتيجي'
      ],
      ZH: [
        '战略传播'
      ],
      TR: [
        'stratejik iletişim'
      ],
      FA: [
        'ارتباطات راهبردی'
      ],
      JA: [
        '戦略的コミュニケーション'
      ],
      HI: [
        'सामरिक संचार'
      ],
      PL: [
        'komunikacja strategiczna'
      ]
    }
  },

  {
    key: 'LIO',
    label: 'Lutte Informatique Offensive (LIO)',
    color: '#ff5540',
    builtin: true,
    terms: {
      FR: [
        'lutte informatique offensive',
        'cyberoffensive',
        'cyber offensive'
      ],
      EN: [
        'offensive cyber operations',
        'offensive cyber operation',
        'offensive cyber',
        'cyber offensive operations'
      ],
      DE: [
        'offensive cyberoperationen'
      ],
      ES: [
        'operaciones cibernéticas ofensivas'
      ],
      IT: [
        'operazioni cibernetiche offensive'
      ],
      PT: [
        'operações cibernéticas ofensivas'
      ],
      RU: [
        'наступательные кибероперации'
      ],
      UK: [
        'наступальні кібероперації'
      ],
      AR: [
        'عمليات إلكترونية هجومية'
      ],
      ZH: [
        '进攻性网络行动'
      ],
      TR: [
        'saldırgan siber operasyonlar'
      ],
      FA: [
        'عملیات سایبری تهاجمی'
      ],
      JA: [
        '攻撃的サイバー作戦'
      ],
      HI: [
        'आक्रामक साइबर अभियान'
      ],
      PL: [
        'ofensywne operacje cybernetyczne'
      ]
    }
  },

  {
    key: 'LID',
    label: 'Lutte Informatique Défensive (LID)',
    color: '#3ddc84',
    builtin: true,
    terms: {
      FR: [
        'lutte informatique défensive',
        'cyberdéfense',
        'cyber défense'
      ],
      EN: [
        'defensive cyber operations',
        'defensive cyber operation',
        'defensive cyber',
        'cyber defense operations',
        'cyber defence operations'
      ],
      DE: [
        'defensive cyberoperationen'
      ],
      ES: [
        'operaciones cibernéticas defensivas'
      ],
      IT: [
        'operazioni cibernetiche difensive'
      ],
      PT: [
        'operações cibernéticas defensivas'
      ],
      RU: [
        'оборонительные кибероперации'
      ],
      UK: [
        'оборонні кібероперації'
      ],
      AR: [
        'عمليات إلكترونية دفاعية'
      ],
      ZH: [
        '防御性网络行动'
      ],
      TR: [
        'savunma amaçlı siber operasyonlar'
      ],
      FA: [
        'عملیات سایبری دفاعی'
      ],
      JA: [
        '防御的サイバー作戦'
      ],
      HI: [
        'रक्षात्मक साइबर अभियान'
      ],
      PL: [
        'defensywne operacje cybernetyczne'
      ]
    }
  },

  {
    key: 'L2I',
    label: "Lutte Informatique d'Influence (L2I)",
    color: '#ff2d9f',
    builtin: true,
    terms: {
      FR: [
        "lutte informatique d'influence",
        'lutte informatique d’influence',
        'influence cyber',
        'cyberinfluence',
        'cyber influence'
      ],
      EN: [
        'cyber influence operations',
        'cyber influence operation',
        'cyber influence'
      ],
      DE: [
        'cyber-einflussoperationen'
      ],
      ES: [
        'operaciones cibernéticas de influencia'
      ],
      IT: [
        'operazioni cibernetiche di influenza'
      ],
      PT: [
        'operações cibernéticas de influência'
      ],
      RU: [
        'кибер-операции влияния'
      ],
      UK: [
        'кібер-операції впливу'
      ],
      AR: [
        'عمليات التأثير السيبراني'
      ],
      ZH: [
        '网络影响行动'
      ],
      TR: [
        'siber etki operasyonları'
      ],
      FA: [
        'عملیات نفوذ سایبری'
      ],
      JA: [
        'サイバー影響工作'
      ],
      HI: [
        'साइबर प्रभाव अभियान'
      ],
      PL: [
        'cybernetyczne operacje wpływu'
      ]
    }
  },

  {
    key: 'ILI',
    label: 'Influence et Lutte Informationnelle (ILI)',
    color: '#00ffaa',
    builtin: true,
    terms: {
      FR: [
        'influence et lutte informationnelle',
        'influence & lutte informationnelle'
      ],
      EN: [
        'influence and information warfare',
        'influence and information operations'
      ],
      DE: [
        'einfluss und informationskrieg'
      ],
      ES: [
        'influencia y guerra de la información'
      ],
      IT: [
        "influenza e guerra dell'informazione"
      ],
      PT: [
        'influência e guerra da informação'
      ],
      RU: [
        'влияние и информационная война'
      ],
      UK: [
        'вплив та інформаційна війна'
      ],
      AR: [
        'التأثير وحرب المعلومات'
      ],
      ZH: [
        '影响与信息战'
      ],
      TR: [
        'etki ve bilgi savaşı'
      ],
      FA: [
        'نفوذ و جنگ اطلاعاتی'
      ],
      JA: [
        '影響と情報戦'
      ],
      HI: [
        'प्रभाव और सूचना युद्ध'
      ],
      PL: [
        'wpływ i wojna informacyjna'
      ]
    }
  },

  {
    key: 'NC',
    label: 'Non Classifié',
    color: '#42607a',
    builtin: true,
    terms: {}
  }

];


/* ================================================================
   VALIDATION DES TAGS
================================================================ */

const VALID_TAG_KEYS = new Set(
  DEFAULT_TAGS.map(tag => tag.key)
);

function isValidTagKey(key) {
  return VALID_TAG_KEYS.has(key);
}


/* ================================================================
   STORE
================================================================ */

function loadStore() {

  try {

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true
      });
    }

    if (fs.existsSync(STORE_FILE)) {

      const raw = JSON.parse(
        fs.readFileSync(STORE_FILE, 'utf8')
      );

      /*
       * On ne fait PAS confiance aveuglément à l'ancien store.
       *
       * Cela permet de corriger les anciennes valeurs comme :
       *
       * information_warfare
       * cognitive_warfare
       * etc.
       */

      const feeds = Array.isArray(raw.feeds)
        ? raw.feeds.map(feed => {

            const clean = {
              ...feed
            };

            if (!isValidTagKey(clean.tag)) {
              clean.tag = 'NC';
            }

            return clean;
          })
        : [];

      /*
       * Les tags personnalisés sont conservés.
       * Les tags builtin viennent toujours de la nouvelle taxonomie.
       */

      const customTags = Array.isArray(raw.tags)
        ? raw.tags.filter(tag =>
            tag &&
            tag.builtin !== true &&
            tag.key &&
            tag.label
          )
        : [];

      return {
        feeds,
        tags: [
          ...DEFAULT_TAGS,
          ...customTags.filter(
            tag => !VALID_TAG_KEYS.has(tag.key)
          )
        ]
      };
    }

  } catch (e) {

    console.error(
      '⚠ Erreur lecture data/store.json:',
      e.message
    );
  }

  return {
    feeds: [],
    tags: DEFAULT_TAGS
  };
}

let store = loadStore();


function saveStore() {

  try {

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true
      });
    }

    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify(store, null, 2),
      'utf8'
    );

  } catch (e) {

    console.error(
      '⚠ Erreur écriture data/store.json:',
      e.message
    );
  }
}

if (!fs.existsSync(STORE_FILE)) {
  saveStore();
}


/* ================================================================
   CLASSIFICATION
================================================================ */

/*
 * Normalisation du texte.
 *
 * On conserve les caractères Unicode afin que les langues comme
 * russe, arabe, chinois, etc. restent exploitables.
 */

function normalizeText(text) {

  return String(text || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


/*
 * Vérifie un terme avec une logique plus stricte.
 *
 * On évite notamment que :
 *
 * "war"
 *
 * classe arbitrairement un article sportif contenant "warriors".
 *
 * Pour les expressions composées, includes() reste approprié.
 * Pour les termes courts, on exige des limites lexicales.
 */

function termMatches(text, term) {

  const t = normalizeText(text);
  const q = normalizeText(term);

  if (!q) return false;

  /*
   * Expressions longues :
   * recherche directe.
   */

  if (q.length >= 5 || q.includes(' ')) {
    return t.includes(q);
  }

  /*
   * Termes courts :
   * frontière lexicale.
   */

  const escaped = q.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const regex = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`,
    'iu'
  );

  return regex.test(t);
}


/*
 * Classification d'un article.
 *
 * IMPORTANT :
 *
 * Aucun tag par défaut.
 * Aucun GI par défaut.
 *
 * Si aucun terme ne correspond :
 *
 * NC
 */

function classifyText(text, lang, tags) {

  const matched = [];
  const L = String(lang || 'FR').toUpperCase();

  for (const tag of tags || []) {

    if (!tag || tag.key === 'NC') {
      continue;
    }

    if (!tag.terms) {
      continue;
    }

    const terms = [
      ...(tag.terms.FR || []),
      ...(tag.terms[L] || [])
    ];

    for (const term of terms) {

      if (termMatches(text, term)) {

        matched.push(tag.key);
        break;
      }
    }
  }

  return matched;
}


/*
 * Priorité des catégories lorsque plusieurs tags matchent.
 *
 * On ne choisit PAS simplement le premier tag du tableau.
 *
 * Une occurrence très précise de L2I doit par exemple passer
 * devant une occurrence générique d'influence.
 */

const TAG_PRIORITY = [
  'L2I',
  'LIO',
  'LID',
  'PSYOPS',
  'DECEPTION',
  'STRATCOM',
  'COMOPS',
  'GC',
  'GI',
  'INFLUENCE',
  'ILI',
  'NC'
];


function selectPrimaryTag(tags) {

  if (!Array.isArray(tags) || tags.length === 0) {
    return 'NC';
  }

  for (const key of TAG_PRIORITY) {

    if (tags.includes(key)) {
      return key;
    }
  }

  return 'NC';
}


/* ================================================================
   UTILITAIRES
================================================================ */

function stripHtml(html) {

  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}


function extractHashtags(text) {

  const m = String(text || '')
    .match(/#[\wÀ-ÿ]+/g);

  return m
    ? [...new Set(
        m.map(h => h.toLowerCase())
      )].slice(0, 10)
    : [];
}


function normalizeSocialItem(
  raw,
  platform,
  handle
) {

  return {

    title:
      (raw.title || raw.text || '')
        .trim()
        .slice(0, 200),

    link:
      raw.link ||
      raw.url ||
      raw.guid ||
      '',

    desc:
      stripHtml(
        raw.contentSnippet ||
        raw.content ||
        raw.summary ||
        raw.description ||
        raw.text ||
        ''
      ),

    pubDate:
      raw.pubDate ||
      raw.isoDate ||
      raw.date ||
      new Date().toISOString(),

    source:
      handle ||
      raw.author ||
      platform,

    platform,

    handle:
      handle || '',

    likes:
      raw.likes ||
      raw.retweet_count ||
      0,

    reposts:
      raw.reposts ||
      raw.retweet_count ||
      0,

    views:
      raw.views ||
      0,

    replies:
      raw.replies ||
      0,

    verified:
      raw.verified ||
      false,

    hashtags:
      extractHashtags(
        raw.title ||
        raw.text ||
        raw.description ||
        ''
      )
  };
}


/* ================================================================
   RSS
================================================================ */

app.get('/api/feed', async (req, res) => {

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: 'Missing url param'
    });
  }

  try {

    const feed = await parser.parseURL(url);

    const items = (feed.items || [])
      .slice(0, 50)
      .map(item => ({

        title:
          (item.title || '').trim(),

        link:
          item.link ||
          item.guid ||
          '',

        desc:
          stripHtml(
            item.contentSnippet ||
            item.content ||
            item.summary ||
            item.description ||
            ''
          ),

        pubDate:
          item.pubDate ||
          item.isoDate ||
          new Date().toISOString(),

        source:
          feed.title ||
          url
      }));

    res.json({
      ok: true,
      title: feed.title || url,
      count: items.length,
      items
    });

  } catch (err) {

    res.status(200).json({
      ok: false,
      error: err.message,
      items: []
    });
  }
});


/* ================================================================
   SOURCE LIBRARY
================================================================ */

app.get('/api/source-library', (req, res) => {

  const {
    language,
    country,
    region,
    type,
    priority,
    topic
  } = req.query;

  let sources = [
    ...SOURCE_LIBRARY,

    ...store.feeds
      .filter(feed =>
        feed &&
        feed.url
      )
      .map(feed => ({

        ...feed,

        id:
          `manual-${encodeURIComponent(feed.url)}`,

        custom: true,

        source: 'manual'
      }))
  ];


  if (language) {

    sources = sources.filter(
      s => s.language === language
    );
  }

  if (country) {

    sources = sources.filter(
      s => s.country === country
    );
  }

  if (region) {

    sources = sources.filter(
      s => s.region === region
    );
  }

  if (type) {

    sources = sources.filter(
      s => s.type === type
    );
  }

  if (priority) {

    sources = sources.filter(
      s => s.priority === priority
    );
  }

  if (topic) {

    sources = sources.filter(
      s =>
        Array.isArray(s.topics) &&
        s.topics.includes(topic)
    );
  }

  res.json({
    ok: true,
    count: sources.length,
    sources
  });
});


/* ================================================================
   IMPORT DES SOURCES
================================================================ */

/*
 * CORRECTION MAJEURE :
 *
 * On ne fait PLUS :
 *
 * source.topics?.[0] || 'information_warfare'
 *
 * car information_warfare n'existe pas.
 *
 * On convertit les éventuels anciens noms de topics vers
 * les nouvelles clés.
 */

const LEGACY_TOPIC_MAP = {

  information_warfare: 'GI',
  information_war: 'GI',
  'information warfare': 'GI',

  cognitive_warfare: 'GC',
  cognitive_war: 'GC',
  'cognitive warfare': 'GC',

  influence: 'INFLUENCE',
  influence_operations: 'INFLUENCE',
  influence_operation: 'INFLUENCE',

  deception: 'DECEPTION',
  disinformation: 'DECEPTION',
  misinformation: 'DECEPTION',

  psyops: 'PSYOPS',
  psychological_operations: 'PSYOPS',

  communication_operationnelle: 'COMOPS',
  operational_communication: 'COMOPS',

  strategic_communication: 'STRATCOM',
  stratcom: 'STRATCOM',

  offensive_cyber: 'LIO',
  offensive_cyber_operations: 'LIO',

  defensive_cyber: 'LID',
  defensive_cyber_operations: 'LID',

  cyber_influence: 'L2I',
  cyber_influence_operations: 'L2I',

  ili: 'ILI',
  influence_information_warfare: 'ILI'
};


function normalizeSourceTopic(topic) {

  if (!topic) {
    return 'NC';
  }

  const raw = String(topic)
    .trim();

  /*
   * Déjà une clé correcte.
   */

  if (isValidTagKey(raw)) {
    return raw;
  }

  /*
   * Anciennes clés.
   */

  const normalized = raw
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');

  if (LEGACY_TOPIC_MAP[normalized]) {
    return LEGACY_TOPIC_MAP[normalized];
  }

  /*
   * Si la source possède un label textuel correspondant exactement
   * à un tag actuel.
   */

  const found = store.tags.find(
    tag =>
      String(tag.label || '')
        .toLowerCase() === raw.toLowerCase()
  );

  if (found) {
    return found.key;
  }

  /*
   * JAMAIS GI par défaut.
   */

  return 'NC';
}


function normalizeSourceTopics(source) {

  if (!source) {
    return ['NC'];
  }

  const topics = Array.isArray(source.topics)
    ? source.topics
    : [];

  const normalized = topics
    .map(normalizeSourceTopic)
    .filter(isValidTagKey)
    .filter(key => key !== 'NC');

  return normalized.length
    ? [...new Set(normalized)]
    : ['NC'];
}


app.post('/api/source-library/import', (req, res) => {

  const { ids } = req.body;

  if (!Array.isArray(ids)) {

    return res.status(400).json({
      ok: false,
      error: 'ids doit être un tableau'
    });
  }

  const selected =
    SOURCE_LIBRARY.filter(
      source =>
        ids.includes(source.id)
    );

  const existing =
    new Set(
      store.feeds.map(
        feed => feed.url
      )
    );

  const added = [];

  for (const source of selected) {

    if (existing.has(source.url)) {
      continue;
    }

    const topics =
      normalizeSourceTopics(source);

    /*
     * Une source peut avoir plusieurs topics.
     * Le premier devient uniquement le tag source principal.
     */

    const primaryTag =
      topics[0] || 'NC';

    store.feeds.push({

      name:
        source.name ||
        source.title ||
        source.url,

      url:
        source.url,

      tag:
        primaryTag,

      tags:
        topics,

      lang:
        source.language ||
        source.lang ||
        'FR'
    });

    added.push(source);

    existing.add(source.url);
  }

  saveStore();

  res.json({

    ok: true,

    requested:
      ids.length,

    found:
      selected.length,

    added:
      added.length,

    totalFeeds:
      store.feeds.length
  });
});


/* ================================================================
   RÉCUPÉRATION DES FLUX
================================================================ */

app.post('/api/feeds', async (req, res) => {

  const { feeds } = req.body;

  if (!Array.isArray(feeds)) {

    return res.status(400).json({
      error: 'feeds must be array'
    });
  }

  const results =
    await Promise.all(
      feeds.map(async f => {

        try {

          const feed =
            await parser.parseURL(f.url);

          const items =
            (feed.items || [])
              .slice(0, 30)
              .map(item => {

                const title =
                  (item.title || '').trim();

                const desc =
                  stripHtml(
                    item.contentSnippet ||
                    item.content ||
                    item.summary ||
                    item.description ||
                    ''
                  );

                const text =
                  `${title} ${desc}`;

                /*
                 * Classification par le CONTENU.
                 *
                 * On ne se sert PAS du tag de la source pour
                 * transformer tous ses articles en GI.
                 */

                const matchedTags =
                  classifyText(
                    text,
                    f.lang,
                    store.tags
                  );

                const primaryTag =
                  selectPrimaryTag(
                    matchedTags
                  );

                return {

                  title,

                  link:
                    item.link ||
                    item.guid ||
                    '',

                  desc,

                  pubDate:
                    item.pubDate ||
                    item.isoDate ||
                    new Date().toISOString(),

                  source:
                    f.name ||
                    feed.title ||
                    f.url,

                  /*
                   * Tag de la source.
                   * Informatif uniquement.
                   */

                  feedTag:
                    normalizeSourceTopic(
                      f.tag
                    ),

                  sourceTags:
                    Array.isArray(f.tags)
                      ? f.tags
                      : [normalizeSourceTopic(f.tag)],

                  lang:
                    f.lang,

                  /*
                   * Classification réellement détectée
                   * dans l'article.
                   */

                  matchedTags,

                  tag:
                    primaryTag
                };
              });

          return {

            name:
              f.name,

            url:
              f.url,

            ok: true,

            count:
              items.length,

            items
          };

        } catch (err) {

          return {

            name:
              f.name,

            url:
              f.url,

            ok: false,

            error:
              err.message,

            items: []
          };
        }
      })
    );

  res.json({
    results
  });
});


/* ================================================================
   TEST FLUX
================================================================ */

app.get('/api/test-feed', async (req, res) => {

  const { url } = req.query;

  if (!url) {

    return res.status(400).json({
      ok: false,
      error: 'Missing url'
    });
  }

  try {

    const feed =
      await parser.parseURL(url);

    res.json({

      ok: true,

      title:
        feed.title,

      count:
        (feed.items || []).length
    });

  } catch (err) {

    res.json({

      ok: false,

      error:
        err.message
    });
  }
});


/* ================================================================
   STORE API
================================================================ */

app.get('/api/store', (req, res) => {

  res.json({

    ok: true,

    feeds:
      store.feeds,

    tags:
      store.tags
  });
});


app.post('/api/store/feed', (req, res) => {

  const {
    name,
    url,
    tag,
    tags,
    lang
  } = req.body || {};

  if (!url) {

    return res.status(400).json({
      ok: false,
      error: 'url requis'
    });
  }

  if (
    store.feeds.find(
      f => f.url === url
    )
  ) {

    return res.json({
      ok: false,
      error: 'Flux déjà présent',
      feeds: store.feeds
    });
  }

  let sourceTags = [];

  if (Array.isArray(tags)) {

    sourceTags =
      tags
        .map(normalizeSourceTopic)
        .filter(isValidTagKey);

  }

  if (!sourceTags.length) {

    const normalized =
      normalizeSourceTopic(tag);

    sourceTags = [normalized];
  }

  store.feeds.push({

    name:
      name ||
      url,

    url,

    tag:
      sourceTags[0] || 'NC',

    tags:
      sourceTags,

    lang:
      lang ||
      'FR'
  });

  saveStore();

  res.json({

    ok: true,

    feeds:
      store.feeds
  });
});


app.post('/api/store/feeds-bulk', (req, res) => {

  const { feeds } = req.body || {};

  if (!Array.isArray(feeds)) {

    return res.status(400).json({
      ok: false,
      error: 'feeds doit être un tableau'
    });
  }

  let added = 0;

  feeds.forEach(f => {

    if (
      !f ||
      !f.url ||
      store.feeds.find(
        x => x.url === f.url
      )
    ) {
      return;
    }

    const sourceTags =
      Array.isArray(f.tags)
        ? f.tags
            .map(normalizeSourceTopic)
            .filter(isValidTagKey)
        : [];

    if (!sourceTags.length) {

      sourceTags.push(
        normalizeSourceTopic(
          f.tag
        )
      );
    }

    store.feeds.push({

      name:
        f.name ||
        f.url,

      url:
        f.url,

      tag:
        sourceTags[0] || 'NC',

      tags:
        sourceTags,

      lang:
        f.lang ||
        f.language ||
        'FR'
    });

    added++;
  });

  if (added > 0) {
    saveStore();
  }

  res.json({

    ok: true,

    added,

    feeds:
      store.feeds
  });
});


app.delete('/api/store/feed', (req, res) => {

  const { url } =
    req.body || {};

  if (!url) {

    return res.status(400).json({
      ok: false,
      error: 'url requis'
    });
  }

  const before =
    store.feeds.length;

  store.feeds =
    store.feeds.filter(
      f => f.url !== url
    );

  if (
    store.feeds.length !== before
  ) {
    saveStore();
  }

  res.json({

    ok: true,

    feeds:
      store.feeds
  });
});


/* ================================================================
   TAGS PERSONNALISÉS
================================================================ */

app.post('/api/store/tag', (req, res) => {

  const {
    key,
    label,
    color,
    terms
  } = req.body || {};

  if (!key || !label) {

    return res.status(400).json({
      ok: false,
      error: 'key et label requis'
    });
  }

  const k =
    String(key)
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '')
      .slice(0, 16);

  if (!k) {

    return res.status(400).json({
      ok: false,
      error: 'clé de tag invalide'
    });
  }

  if (
    store.tags.find(
      t => t.key === k
    )
  ) {

    return res.json({
      ok: false,
      error: 'Ce tag existe déjà',
      tags: store.tags
    });
  }

  const cleanTerms = {};

  if (
    terms &&
    typeof terms === 'object'
  ) {

    Object.entries(terms)
      .forEach(
        ([langCode, list]) => {

          if (
            !Array.isArray(list)
          ) {
            return;
          }

          const arr =
            list
              .map(
                s =>
                  String(s)
                    .trim()
                    .toLowerCase()
              )
              .filter(Boolean);

          if (arr.length) {

            cleanTerms[
              langCode
                .toUpperCase()
                .slice(0, 4)
            ] = arr;
          }
        }
      );
  }

  store.tags.push({

    key: k,

    label:
      String(label)
        .slice(0, 80),

    color:
      /^#[0-9a-fA-F]{6}$/
        .test(color || '')
        ? color
        : '#7a9bbf',

    builtin: false,

    terms:
      cleanTerms
  });

  saveStore();

  res.json({

    ok: true,

    tags:
      store.tags
  });
});


app.delete('/api/store/tag', (req, res) => {

  const { key } =
    req.body || {};

  if (!key) {

    return res.status(400).json({
      ok: false,
      error: 'key requis'
    });
  }

  /*
   * Les tags builtin ne doivent pas être supprimés.
   */

  const builtin =
    DEFAULT_TAGS.find(
      tag => tag.key === key
    );

  if (builtin) {

    return res.status(400).json({

      ok: false,

      error:
        'Les catégories intégrées ne peuvent pas être supprimées',

      tags:
        store.tags
    });
  }

  const before =
    store.tags.length;

  store.tags =
    store.tags.filter(
      t => t.key !== key
    );

  if (
    store.tags.length !== before
  ) {
    saveStore();
  }

  res.json({

    ok: true,

    tags:
      store.tags
  });
});


/* ================================================================
   SOCIAL
================================================================ */

const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks'
];


async function fetchNitterRSS(
  handle,
  type = 'user'
) {

  const slug =
    type === 'hashtag'
      ? `/search/rss?q=${encodeURIComponent(handle)}&f=tweets`
      : `/${handle.replace('@', '')}/rss`;

  for (
    const instance
    of NITTER_INSTANCES
  ) {

    try {

      const url =
        instance + slug;

      const feed =
        await parser.parseURL(url);

      return {

        ok: true,

        instance,

        handle,

        items:
          (feed.items || [])
            .slice(0, 30)
            .map(item =>
              normalizeSocialItem(
                item,
                'twitter',
                handle
              )
            )
      };

    } catch (_) {}
  }

  return {

    ok: false,

    handle,

    items: [],

    error:
      'Toutes les instances Nitter KO'
  };
}


app.get('/api/social/twitter', async (req, res) => {

  const {
    handle,
    type
  } = req.query;

  if (!handle) {

    return res.status(400).json({
      ok: false,
      error: 'Missing handle'
    });
  }

  res.json(
    await fetchNitterRSS(
      handle,
      type || 'user'
    )
  );
});


/* ================================================================
   YOUTUBE
================================================================ */

app.get('/api/social/youtube', async (req, res) => {

  const {
    channel_id,
    handle
  } = req.query;

  let url;

  if (channel_id) {

    url =
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channel_id}`;

  } else if (handle) {

    try {

      const r =
        await fetch(
          `https://www.youtube.com/@${handle}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0'
            }
          }
        );

      const txt =
        await r.text();

      const m =
        txt.match(
          /"channelId":"([^"]+)"/
        );

      if (!m) {

        return res.json({
          ok: false,
          error: 'Channel ID introuvable',
          items: []
        });
      }

      url =
        `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`;

    } catch (e) {

      return res.json({
        ok: false,
        error: e.message,
        items: []
      });
    }

  } else {

    return res.status(400).json({
      ok: false,
      error: 'channel_id ou handle requis'
    });
  }

  try {

    const feed =
      await parser.parseURL(url);

    const items =
      (feed.items || [])
        .slice(0, 20)
        .map(item => ({

          ...normalizeSocialItem(
            item,
            'youtube',
            handle || channel_id
          ),

          thumbnail:
            item.mediaContent?.$?.url ||
            item.mediaThumbnail?.$?.url ||
            ''
        }));

    res.json({

      ok: true,

      items,

      count:
        items.length
    });

  } catch (e) {

    res.json({

      ok: false,

      error:
        e.message,

      items: []
    });
  }
});


/* ================================================================
   MASTODON
================================================================ */

app.get('/api/social/mastodon', async (req, res) => {

  const {
    handle,
    hashtag,
    instance
  } = req.query;

  let url;

  try {

    if (hashtag) {

      const inst =
        instance ||
        'mastodon.social';

      url =
        `https://${inst}/tags/${hashtag.replace('#', '')}.rss`;

    } else if (handle) {

      const parts =
        handle
          .replace('@', '')
          .split('@');

      const user =
        parts[0];

      const inst =
        parts[1] ||
        instance ||
        'mastodon.social';

      const apiUrl =
        `https://${inst}/api/v1/accounts/lookup?acct=${user}`;

      const r =
        await fetch(
          apiUrl,
          {
            headers: {
              'User-Agent':
                'SUPER-ILI-BRAIN/1.0'
            }
          }
        );

      const acct =
        await r.json();

      if (!acct.id) {

        return res.json({
          ok: false,
          error: 'Compte Mastodon introuvable',
          items: []
        });
      }

      url =
        `https://${inst}/@${user}.rss`;

    } else {

      return res.status(400).json({
        ok: false,
        error: 'handle ou hashtag requis'
      });
    }

    const feed =
      await parser.parseURL(url);

    const items =
      (feed.items || [])
        .slice(0, 30)
        .map(item =>
          normalizeSocialItem(
            item,
            'mastodon',
            handle || hashtag
          )
        );

    res.json({

      ok: true,

      items,

      count:
        items.length,

      url
    });

  } catch (e) {

    res.json({

      ok: false,

      error:
        e.message,

      items: []
    });
  }
});


/* ================================================================
   BLUESKY
================================================================ */

app.get('/api/social/bluesky', async (req, res) => {

  const {
    handle,
    hashtag
  } = req.query;

  let url;

  try {

    if (hashtag) {

      url =
        `https://bsky.app/search?q=${encodeURIComponent(
          '#' + hashtag.replace('#', '')
        )}&rss=1`;

    } else if (handle) {

      url =
        `https://bsky.app/profile/${handle}/rss`;

    } else {

      return res.status(400).json({
        ok: false,
        error: 'handle ou hashtag requis'
      });
    }

    const feed =
      await parser.parseURL(url);

    const items =
      (feed.items || [])
        .slice(0, 30)
        .map(item =>
          normalizeSocialItem(
            item,
            'bluesky',
            handle || hashtag
          )
        );

    res.json({

      ok: true,

      items,

      count:
        items.length
    });

  } catch (e) {

    res.json({

      ok: false,

      error:
        e.message,

      items: []
    });
  }
});


/* ================================================================
   REDDIT
================================================================ */

app.get('/api/social/reddit', async (req, res) => {

  const {
    subreddit,
    search,
    sort
  } = req.query;

  let url;

  if (search) {

    url =
      `https://www.reddit.com/search.rss?q=${encodeURIComponent(
        search
      )}&sort=${sort || 'new'}&limit=25`;

  } else if (subreddit) {

    url =
      `https://www.reddit.com/r/${subreddit}/${sort || 'new'}.rss?limit=25`;

  } else {

    return res.status(400).json({
      ok: false,
      error: 'subreddit ou search requis'
    });
  }

  try {

    const feed =
      await parser.parseURL(url);

    const items =
      (feed.items || [])
        .slice(0, 25)
        .map(item =>
          normalizeSocialItem(
            item,
            'reddit',
            subreddit || search
          )
        );

    res.json({

      ok: true,

      items,

      count:
        items.length
    });

  } catch (e) {

    res.json({

      ok: false,

      error:
        e.message,

      items: []
    });
  }
});


/* ================================================================
   TELEGRAM
================================================================ */

app.get('/api/social/telegram', async (req, res) => {

  const { channel } =
    req.query;

  if (!channel) {

    return res.status(400).json({
      ok: false,
      error: 'channel requis'
    });
  }

  const bridges = [

    `https://rsshub.app/telegram/channel/${channel}`,

    `https://tg.i-c-a.su/rss/${channel}`,

    `https://telegramrss.com/rss/${channel}`
  ];

  for (
    const url
    of bridges
  ) {

    try {

      const feed =
        await parser.parseURL(url);

      const items =
        (feed.items || [])
          .slice(0, 30)
          .map(item =>
            normalizeSocialItem(
              item,
              'telegram',
              channel
            )
          );

      return res.json({

        ok: true,

        items,

        count:
          items.length,

        bridge:
          url
      });

    } catch (_) {}
  }

  res.json({

    ok: false,

    error:
      'Tous les bridges Telegram KO',

    items: []
  });
});


/* ================================================================
   PLAYWRIGHT
================================================================ */

let playwrightAvailable = false;
let chromium;

try {

  ({
    chromium
  } = require('playwright'));

  playwrightAvailable = true;

  console.log(
    '  ✓ Playwright disponible'
  );

} catch (_) {

  console.log(
    '  ⚠ Playwright non installé'
  );
}


const scraperCache =
  new Map();

const SCRAPE_TTL =
  5 * 60 * 1000;


async function withBrowser(fn) {

  if (!playwrightAvailable) {

    throw new Error(
      'Playwright non installé'
    );
  }

  const browser =
    await chromium.launch({

      headless: true,

      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

  try {

    return await fn(browser);

  } finally {

    await browser.close();
  }
}


/* ================================================================
   SCRAPE TWITTER
================================================================ */

app.get(
  '/api/scrape/twitter-hashtag',
  async (req, res) => {

    const { hashtag } =
      req.query;

    if (!hashtag) {

      return res.status(400).json({
        ok: false,
        error: 'hashtag requis'
      });
    }

    const cacheKey =
      `tw_ht_${hashtag}`;

    const cached =
      scraperCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.ts <
        SCRAPE_TTL
    ) {

      return res.json(
        cached.data
      );
    }

    const rssResult =
      await fetchNitterRSS(
        hashtag,
        'hashtag'
      );

    if (
      rssResult.ok &&
      rssResult.items.length > 0
    ) {

      const data = {

        ok: true,

        method:
          'nitter-rss',

        items:
          rssResult.items
      };

      scraperCache.set(
        cacheKey,
        {
          ts: Date.now(),
          data
        }
      );

      return res.json(data);
    }

    if (!playwrightAvailable) {

      return res.json({

        ok: false,

        error:
          'RSS KO et Playwright non installé',

        items: []
      });
    }

    try {

      const items =
        await withBrowser(
          async browser => {

            const page =
              await browser.newPage();

            await page.setExtraHTTPHeaders({
              'Accept-Language':
                'fr-FR,fr;q=0.9,en;q=0.8'
            });

            const tag =
              hashtag.replace('#', '');

            await page.goto(
              `${NITTER_INSTANCES[0]}/search?q=%23${tag}&f=tweets`,
              {
                waitUntil:
                  'domcontentloaded',
                timeout: 15000
              }
            );

            return page.evaluate(
              () =>

                Array.from(
                  document.querySelectorAll(
                    '.timeline-item'
                  )
                )
                .slice(0, 30)
                .map(el => ({

                  title:
                    el.querySelector(
                      '.tweet-content'
                    )?.innerText?.trim() ||
                    '',

                  link:
                    'https://twitter.com' +
                    (
                      el.querySelector(
                        'a.tweet-link'
                      )?.getAttribute('href') ||
                      ''
                    ),

                  pubDate:
                    el.querySelector(
                      '.tweet-date a'
                    )?.getAttribute('title') ||
                    new Date().toISOString(),

                  likes:
                    parseInt(
                      el.querySelector(
                        '.icon-heart'
                      )?.closest(
                        '.tweet-stat'
                      )?.innerText ||
                      '0'
                    ) || 0,

                  reposts:
                    parseInt(
                      el.querySelector(
                        '.icon-retweet'
                      )?.closest(
                        '.tweet-stat'
                      )?.innerText ||
                      '0'
                    ) || 0,

                  replies:
                    parseInt(
                      el.querySelector(
                        '.icon-comment'
                      )?.closest(
                        '.tweet-stat'
                      )?.innerText ||
                      '0'
                    ) || 0
                }))
            );
          }
        );

      const normalized =
        items.map(it =>
          normalizeSocialItem(
            {
              ...it,
              text: it.title
            },
            'twitter',
            '#' +
              hashtag.replace('#', '')
          )
        );

      const data = {

        ok: true,

        method:
          'playwright-nitter',

        items:
          normalized
      };

      scraperCache.set(
        cacheKey,
        {
          ts: Date.now(),
          data
        }
      );

      res.json(data);

    } catch (e) {

      res.json({

        ok: false,

        error:
          e.message,

        items: []
      });
    }
  }
);


/* ================================================================
   SCRAPE YOUTUBE
================================================================ */

app.get(
  '/api/scrape/youtube-search',
  async (req, res) => {

    const { q } =
      req.query;

    if (!q) {

      return res.status(400).json({
        ok: false,
        error: 'q requis'
      });
    }

    const cacheKey =
      `yt_${q}`;

    const cached =
      scraperCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.ts <
        SCRAPE_TTL
    ) {

      return res.json(
        cached.data
      );
    }

    if (!playwrightAvailable) {

      return res.json({

        ok: false,

        error:
          'Playwright non installé',

        items: []
      });
    }

    try {

      const items =
        await withBrowser(
          async browser => {

            const page =
              await browser.newPage();

            await page.goto(
              `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAISAhAB`,
              {
                waitUntil:
                  'networkidle',
                timeout: 20000
              }
            );

            await page
              .waitForSelector(
                'ytd-video-renderer',
                {
                  timeout: 8000
                }
              )
              .catch(() => {});

            return page.evaluate(
              () =>

                Array.from(
                  document.querySelectorAll(
                    'ytd-video-renderer'
                  )
                )
                .slice(0, 15)
                .map(el => ({

                  title:
                    el.querySelector(
                      '#video-title'
                    )?.innerText?.trim() ||
                    '',

                  link:
                    'https://youtube.com' +
                    (
                      el.querySelector(
                        '#video-title'
                      )?.getAttribute('href') ||
                      ''
                    ),

                  source:
                    el.querySelector(
                      '#channel-name a'
                    )?.innerText?.trim() ||
                    '',

                  views:
                    el.querySelector(
                      '#metadata-line span:first-child'
                    )?.innerText ||
                    '0',

                  pubDate:
                    el.querySelector(
                      '#metadata-line span:last-child'
                    )?.innerText ||
                    '',

                  thumbnail:
                    el.querySelector(
                      'img'
                    )?.src ||
                    ''
                }))
            );
          }
        );

      const normalized =
        items.map(it =>
          normalizeSocialItem(
            {
              ...it,
              text: it.title
            },
            'youtube',
            it.source
          )
        );

      const data = {

        ok: true,

        method:
          'playwright',

        items:
          normalized
      };

      scraperCache.set(
        cacheKey,
        {
          ts: Date.now(),
          data
        }
      );

      res.json(data);

    } catch (e) {

      res.json({

        ok: false,

        error:
          e.message,

        items: []
      });
    }
  }
);


/* ================================================================
   SCRAPE REDDIT
================================================================ */

app.get(
  '/api/scrape/reddit-search',
  async (req, res) => {

    const {
      q,
      sort
    } = req.query;

    if (!q) {

      return res.status(400).json({
        ok: false,
        error: 'q requis'
      });
    }

    const url =
      `https://www.reddit.com/search.rss?q=${encodeURIComponent(
        q
      )}&sort=${sort || 'new'}&limit=25`;

    try {

      const feed =
        await parser.parseURL(url);

      const items =
        (feed.items || [])
          .slice(0, 25)
          .map(item =>
            normalizeSocialItem(
              item,
              'reddit',
              q
            )
          );

      res.json({

        ok: true,

        method:
          'rss',

        items,

        count:
          items.length
      });

    } catch (e) {

      res.json({

        ok: false,

        error:
          e.message,

        items: []
      });
    }
  }
);


/* ================================================================
   STATUS PLAYWRIGHT
================================================================ */

app.get(
  '/api/scrape/status',
  (req, res) => {

    res.json({

      playwright:
        playwrightAvailable,

      cache_entries:
        scraperCache.size
    });
  }
);


/* ================================================================
   SOCIAL BATCH
================================================================ */

app.post(
  '/api/social/batch',
  async (req, res) => {

    const { sources } =
      req.body;

    if (!Array.isArray(sources)) {

      return res.status(400).json({
        error:
          'sources must be array'
      });
    }

    const results =
      await Promise.allSettled(
        sources.map(
          async s => {

            const base = {

              platform:
                s.platform,

              handle:
                s.handle ||
                s.id,

              label:
                s.label
            };

            try {

              let r;

              switch (s.platform) {

                case 'twitter':

                  r =
                    await fetchNitterRSS(
                      s.handle,
                      s.type ||
                        'user'
                    );

                  break;

                case 'youtube': {

                  const params =
                    s.channel_id
                      ? `channel_id=${s.channel_id}`
                      : `handle=${s.handle}`;

                  const response =
                    await fetch(
                      `http://localhost:${PORT}/api/social/youtube?${params}`
                    );

                  r =
                    await response.json();

                  break;
                }

                case 'mastodon': {

                  const q =
                    s.hashtag
                      ? `hashtag=${encodeURIComponent(s.hashtag)}&instance=${s.instance || 'mastodon.social'}`
                      : `handle=${encodeURIComponent(s.handle)}`;

                  const response =
                    await fetch(
                      `http://localhost:${PORT}/api/social/mastodon?${q}`
                    );

                  r =
                    await response.json();

                  break;
                }

                case 'bluesky': {

                  const q =
                    s.hashtag
                      ? `hashtag=${encodeURIComponent(s.hashtag)}`
                      : `handle=${encodeURIComponent(s.handle)}`;

                  const response =
                    await fetch(
                      `http://localhost:${PORT}/api/social/bluesky?${q}`
                    );

                  r =
                    await response.json();

                  break;
                }

                case 'reddit': {

                  const q =
                    s.subreddit
                      ? `subreddit=${encodeURIComponent(s.subreddit)}`
                      : `search=${encodeURIComponent(s.search || '')}`;

                  const response =
                    await fetch(
                      `http://localhost:${PORT}/api/social/reddit?${q}`
                    );

                  r =
                    await response.json();

                  break;
                }

                case 'telegram': {

                  const response =
                    await fetch(
                      `http://localhost:${PORT}/api/social/telegram?channel=${encodeURIComponent(s.handle)}`
                    );

                  r =
                    await response.json();

                  break;
                }

                default:

                  r = {

                    ok: false,

                    error:
                      'Plateforme inconnue',

                    items: []
                  };
              }

              return {

                ...base,

                ok:
                  r.ok,

                items:
                  r.items || [],

                count:
                  (r.items || [])
                    .length,

                error:
                  r.error
              };

            } catch (e) {

              return {

                ...base,

                ok: false,

                items: [],

                count: 0,

                error:
                  e.message
              };
            }
          }
        )
      );

    res.json({

      results:
        results.map(
          r =>
            r.status === 'fulfilled'
              ? r.value
              : {
                  ok: false,
                  items: [],
                  error:
                    r.reason?.message
                }
        )
    });
  }
);


/* ================================================================
   CATCH-ALL
================================================================ */

app.get(
  '*',
  (req, res) =>
    res.sendFile(
      path.join(
        publicDir,
        'index.html'
      )
    )
);


const PORT =
  process.env.PORT || 3000;


app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      '\n  ◈ SUPER-ILI-BRAIN'
    );

    console.log(
      `  ▶ http://localhost:${PORT}`
    );

    console.log(
      `  ▶ Playwright : ${
        playwrightAvailable
          ? 'ACTIVÉ'
          : 'désactivé'
      }`
    );

    console.log(
      `  ▶ Sources : ${
        SOURCE_LIBRARY.length
      }`
    );

    console.log(
      `  ▶ Tags : ${
        store.tags.length
      }`
    );

    console.log(
      `  ▶ Serving static from: ${publicDir}\n`
    );
  }
);
