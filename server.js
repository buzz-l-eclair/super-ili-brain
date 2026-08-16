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
   BASE DE DONNÉES PERSISTANTE
════════════════════════════════════════════════════════════════ */

const DATA_DIR    = path.join(__dirname, 'data');
const STORE_FILE  = path.join(DATA_DIR, 'store.json');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');


/* ════════════════════════════════════════════════════════════════
   BIBLIOTHÈQUE DES SOURCES
════════════════════════════════════════════════════════════════ */

function loadSourceLibrary() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.warn('⚠️ Répertoire sources absent');
    return [];
  }

  const files = fs.readdirSync(SOURCES_DIR)
    .filter(file => file.endsWith('.json') && file !== 'index.json');

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
    if (!source.url) continue;
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


/* ════════════════════════════════════════════════════════════════
   TAXONOMIE ILI
   11 catégories officielles + NC
════════════════════════════════════════════════════════════════ */

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
        'information war',
        'infowar',
        'information operations'
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
      AR: [
        'حرب المعلومات'
      ],
      ZH: [
        '信息战'
      ],
      TR: [
        'bilgi savaşı'
      ],
      FA: [
        'جنگ اطلاعاتی'
      ],
      JA: [
        '情報戦'
      ],
      HI: [
        'सूचना युद्ध'
      ],
      PL: [
        'wojna informacyjna'
      ]
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
        "opération d'influence",
        'opérations d’influence',
        "opérations d'influence",
        'influence étrangère',
        'ingérence',
        'ingérence étrangère',
        'action d’influence',
        "action d'influence",
        'campagne d’influence',
        "campagne d'influence"
      ],
      EN: [
        'influence operation',
        'influence operations',
        'foreign influence',
        'foreign interference',
        'malign influence',
        'influence campaign'
      ],
      DE: [
        'einflussoperation',
        'einflussnahme'
      ],
      ES: [
        'operación de influencia',
        'operaciones de influencia',
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
        'désinformation',
        'mésinformation',
        'campagne de désinformation',
        'opération de désinformation'
      ],
      EN: [
        'deception',
        'disinformation',
        'misinformation',
        'disinformation campaign',
        'deception operation'
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
        'opération psychologique',
        'opérations psychologiques',
        'guerre psychologique',
        'psyops'
      ],
      EN: [
        'psychological operation',
        'psychological operations',
        'psychological warfare',
        'psywar',
        'psyops'
      ],
      DE: [
        'psychologische kriegsführung',
        'psychologische operation',
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
        'психологические операции',
        'психологическая война'
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
        'lutte informatique offensive'
      ],
      EN: [
        'offensive cyber operations',
        'offensive cyber operation',
        'offensive cyber',
        'offensive cyber warfare'
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
        'lutte informatique défensive'
      ],
      EN: [
        'defensive cyber operations',
        'defensive cyber operation',
        'defensive cyber',
        'cyber defence',
        'cyber defense'
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
        'lutte informatique influence',
        'l2i'
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
        'lutte informationnelle',
        'ili'
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


/* ════════════════════════════════════════════════════════════════
   ALIAS / NORMALISATION DES CATÉGORIES
   Permet de convertir les anciennes catégories des JSON sources
   vers les nouvelles clés GI / GC / INFLUENCE / etc.
════════════════════════════════════════════════════════════════ */

const CATEGORY_ALIASES = {

  GI: [
    'gi',
    'guerre informationnelle',
    "guerre de l'information",
    'information warfare',
    'information war',
    'infowar',
    'information_warfare',
    'information warfare / infowar'
  ],

  GC: [
    'gc',
    'guerre cognitive',
    'cognitive warfare',
    'cognitive war',
    'cognitive_warfare'
  ],

  INFLUENCE: [
    'influence',
    'influence operation',
    'influence operations',
    'influence_operation',
    'influence_operations',
    'influence warfare',
    'influence_warfare',
    'foreign influence',
    'foreign interference'
  ],

  DECEPTION: [
    'deception',
    'déception',
    'disinformation',
    'désinformation',
    'misinformation',
    'mésinformation',
    'deception warfare',
    'deception_warfare'
  ],

  PSYOPS: [
    'psyops',
    'psyop',
    'psy ops',
    'opérations psychologiques',
    'opération psychologique',
    'psychological operations',
    'psychological operation',
    'psychological warfare',
    'psywar',
    'psychological_warfare'
  ],

  COMOPS: [
    'comops',
    'communication opérationnelle',
    'communications opérationnelles',
    'operational communication',
    'operational communications',
    'operations communication'
  ],

  STRATCOM: [
    'stratcom',
    'communication stratégique',
    'communications stratégiques',
    'strategic communication',
    'strategic communications',
    'strategic_communication',
    'strategic_communications'
  ],

  LIO: [
    'lio',
    'lutte informatique offensive',
    'offensive cyber',
    'offensive cyber operation',
    'offensive cyber operations',
    'offensive cyber warfare',
    'offensive_cyber',
    'offensive_cyber_operations'
  ],

  LID: [
    'lid',
    'lutte informatique défensive',
    'defensive cyber',
    'defensive cyber operation',
    'defensive cyber operations',
    'cyber defence',
    'cyber defense',
    'defensive_cyber',
    'defensive_cyber_operations'
  ],

  L2I: [
    'l2i',
    "lutte informatique d'influence",
    'lutte informatique influence',
    'cyber influence',
    'cyber influence operation',
    'cyber influence operations',
    'cyber_influence',
    'cyber_influence_operations'
  ],

  ILI: [
    'ili',
    'influence et lutte informationnelle',
    'lutte informationnelle',
    'influence and information warfare',
    'influence and information operations',
    'influence_information_warfare'
  ]
};


/* ════════════════════════════════════════════════════════════════
   OUTILS DE CLASSIFICATION
════════════════════════════════════════════════════════════════ */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function canonicalCategory(value) {
  const normalized = normalizeText(value);

  if (!normalized) return null;

  for (const [key, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliases) {
      const a = normalizeText(alias);

      if (
        normalized === a ||
        normalized.includes(a)
      ) {
        return key;
      }
    }
  }

  return null;
}


/*
 * Récupère les catégories explicitement associées à une source.
 *
 * On regarde plusieurs champs possibles parce que les fichiers JSON
 * de la bibliothèque peuvent avoir évolué :
 *
 * topics
 * tags
 * tag
 * category
 * categories
 */
function getSourceCategories(source) {

  const values = [];

  const fields = [
    source.topics,
    source.tags,
    source.tag,
    source.category,
    source.categories
  ];

  for (const field of fields) {

    if (Array.isArray(field)) {
      values.push(...field);
    } else if (field !== undefined && field !== null) {
      values.push(field);
    }
  }

  const categories = [];

  for (const value of values) {

    const category = canonicalCategory(value);

    if (category && !categories.includes(category)) {
      categories.push(category);
    }
  }

  return categories;
}


/*
 * Classification du contenu d'un article.
 *
 * IMPORTANT :
 * Cette fonction n'utilise PAS les noms génériques comme
 * "influence" tout seuls.
 *
 * Elle cherche les expressions réellement discriminantes.
 */
function classifyText(text, lang, tags) {

  const normalized = normalizeText(text);
  const L = String(lang || 'FR').toUpperCase();

  const matched = [];

  for (const tag of (tags || [])) {

    if (!tag.terms || tag.key === 'NC') {
      continue;
    }

    const terms = [
      ...(tag.terms.FR || []),
      ...(tag.terms[L] || [])
    ];

    const found = terms.some(term => {

      const normalizedTerm = normalizeText(term);

      if (!normalizedTerm) return false;

      return normalized.includes(normalizedTerm);
    });

    if (found) {
      matched.push(tag.key);
    }
  }

  return matched;
}


/*
 * Classification complète d'une source.
 *
 * Priorité :
 *
 * 1. catégories explicitement présentes dans le JSON
 * 2. catégories déduites du nom / description de la source
 * 3. NC
 */
function classifySource(source) {

  const explicit = getSourceCategories(source);

  if (explicit.length) {
    return explicit;
  }

  const metadata = [
    source.name,
    source.title,
    source.description,
    source.about,
    source.type
  ]
    .filter(Boolean)
    .join(' ');

  const inferred = classifyText(
    metadata,
    source.language || source.lang || 'FR',
    DEFAULT_TAGS
  );

  return inferred.length ? inferred : ['NC'];
}


/* ════════════════════════════════════════════════════════════════
   STORE
════════════════════════════════════════════════════════════════ */

function loadStore() {

  try {

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {

      const raw = JSON.parse(
        fs.readFileSync(STORE_FILE, 'utf-8')
      );

      return {
        feeds: Array.isArray(raw.feeds)
          ? raw.feeds
          : [],

        tags: Array.isArray(raw.tags) && raw.tags.length
          ? raw.tags
          : DEFAULT_TAGS
      };
    }

  } catch (e) {

    console.error(
      '⚠ Erreur lecture data/store.json :',
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
      'utf-8'
    );

  } catch (e) {

    console.error(
      '⚠ Erreur écriture data/store.json :',
      e.message
    );
  }
}


/*
 * S'assure que la taxonomie active correspond toujours à nos
 * catégories officielles.
 *
 * Les tags personnalisés éventuellement créés par l'utilisateur
 * sont conservés.
 */
function ensureDefaultTags() {

  const customTags = (store.tags || [])
    .filter(tag => !DEFAULT_TAGS.some(
      d => d.key === tag.key
    ));

  store.tags = [
    ...DEFAULT_TAGS,
    ...customTags
  ];
}


/*
 * Migration automatique des flux déjà enregistrés.
 *
 * Elle est exécutée au démarrage.
 *
 * Aucun besoin de modifier manuellement store.json.
 */
function migrateExistingFeeds() {

  let changed = false;

  store.feeds = (store.feeds || []).map(feed => {

    const categories = classifySource(feed);

    const primaryTag =
      categories[0] || 'NC';

    const oldTopics = JSON.stringify(
      Array.isArray(feed.topics)
        ? feed.topics
        : []
    );

    const newTopics = JSON.stringify(categories);

    if (
      feed.tag !== primaryTag ||
      oldTopics !== newTopics
    ) {
      changed = true;
    }

    return {
      ...feed,
      tag: primaryTag,
      topics: categories,
      lang: feed.lang || feed.language || 'FR'
    };
  });

  if (changed) {

    console.log(
      '✓ Migration automatique des catégories ILI effectuée'
    );

    saveStore();
  }
}


ensureDefaultTags();

if (!fs.existsSync(STORE_FILE)) {
  saveStore();
}

migrateExistingFeeds();


/* ════════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════ */

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


function normalizeSocialItem(raw, platform, handle) {

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


function extractHashtags(text) {

  const m = text.match(/#[\wÀ-ÿ]+/g);

  return m
    ? [
        ...new Set(
          m.map(h => h.toLowerCase())
        )
      ].slice(0, 10)
    : [];
}


/* ════════════════════════════════════════════════════════════════
   RSS FEEDS
════════════════════════════════════════════════════════════════ */

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


/* ════════════════════════════════════════════════════════════════
   BIBLIOTHÈQUE DES SOURCES
════════════════════════════════════════════════════════════════ */

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
      .filter(feed => feed && feed.url)
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
      s =>
        s.language === language ||
        s.lang === language
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

    sources = sources.filter(source => {

      const categories =
        classifySource(source);

      return categories.includes(
        canonicalCategory(topic) || topic
      );
    });
  }

  res.json({
    ok: true,
    count: sources.length,
    sources
  });
});


/* ════════════════════════════════════════════════════════════════
   IMPORT DES SOURCES
════════════════════════════════════════════════════════════════ */

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
      source => ids.includes(source.id)
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

    /*
     * NOUVELLE LOGIQUE :
     * on convertit les catégories du JSON source vers
     * les clés officielles de notre taxonomie.
     */
    const categories =
      classifySource(source);

    const primaryTag =
      categories[0] || 'NC';

    store.feeds.push({

      name:
        source.name ||
        source.title ||
        source.url,

      url:
        source.url,

      tag:
        primaryTag,

      topics:
        categories,

      lang:
        source.language ||
        source.lang ||
        'FR'
    });

    added.push({
      ...source,
      tag: primaryTag,
      topics: categories
    });

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
      store.feeds.length,

    sources:
      added
  });
});


/* ════════════════════════════════════════════════════════════════
   FLUX UTILISATEUR
════════════════════════════════════════════════════════════════ */

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

                /*
                 * Catégorie définie par la source.
                 */
                const sourceCategories =
                  classifySource(f);

                const sourceTag =
                  sourceCategories[0] || 'NC';

                /*
                 * Catégories détectées dans le contenu.
                 */
                const contentTags =
                  classifyText(
                    `${title} ${desc}`,
                    f.lang || f.language || 'FR',
                    store.tags
                  );

                /*
                 * Le tag de la source est TOUJOURS prioritaire.
                 * Les autres catégories sont secondaires.
                 */
                const matchedTags = [
                  sourceTag,
                  ...contentTags.filter(
                    tag => tag !== sourceTag
                  )
                ];

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

                  feedTag:
                    sourceTag,

                  lang:
                    f.lang ||
                    f.language ||
                    'FR',

                  matchedTags,

                  tag:
                    matchedTags[0] || 'NC'
                };
              });

          return {

            name:
              f.name,

            url:
              f.url,

            ok:
              true,

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

            ok:
              false,

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


/* ════════════════════════════════════════════════════════════════
   TEST FEED
════════════════════════════════════════════════════════════════ */

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
      title: feed.title,
      count: (feed.items || []).length
    });

  } catch (err) {

    res.json({
      ok: false,
      error: err.message
    });
  }
});


/* ════════════════════════════════════════════════════════════════
   STORE
════════════════════════════════════════════════════════════════ */

app.get('/api/store', (req, res) => {

  res.json({
    ok: true,
    feeds: store.feeds,
    tags: store.tags
  });
});


app.post('/api/store/feed', (req, res) => {

  const {
    name,
    url,
    tag,
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

  const requestedCategory =
    canonicalCategory(tag) || 'NC';

  store.feeds.push({

    name:
      name || url,

    url,

    tag:
      requestedCategory,

    topics: [
      requestedCategory
    ],

    lang:
      lang || 'FR'
  });

  saveStore();

  res.json({
    ok: true,
    feeds: store.feeds
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
      f &&
      f.url &&
      !store.feeds.find(
        x => x.url === f.url
      )
    ) {

      const categories =
        classifySource(f);

      store.feeds.push({

        name:
          f.name ||
          f.url,

        url:
          f.url,

        tag:
          categories[0] || 'NC',

        topics:
          categories,

        lang:
          f.lang ||
          f.language ||
          'FR'
      });

      added++;
    }
  });

  if (added > 0) {
    saveStore();
  }

  res.json({
    ok: true,
    added,
    feeds: store.feeds
  });
});


app.delete('/api/store/feed', (req, res) => {

  const { url } = req.body || {};

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
    feeds: store.feeds
  });
});


/* ════════════════════════════════════════════════════════════════
   TAGS PERSONNALISÉS
════════════════════════════════════════════════════════════════ */

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
      .forEach(([langCode, list]) => {

        if (Array.isArray(list)) {

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
      });
  }

  store.tags.push({

    key: k,

    label:
      String(label).slice(0, 80),

    color:
      /^#[0-9a-fA-F]{6}$/.test(
        color || ''
      )
        ? color
        : '#7a9bbf',

    builtin:
      false,

    terms:
      cleanTerms
  });

  saveStore();

  res.json({
    ok: true,
    tags: store.tags
  });
});


app.delete('/api/store/tag', (req, res) => {

  const { key } = req.body || {};

  if (!key) {

    return res.status(400).json({
      ok: false,
      error: 'key requis'
    });
  }

  const before =
    store.tags.length;

  /*
   * On empêche la suppression accidentelle
   * des catégories officielles.
   */
  const builtin =
    DEFAULT_TAGS.some(
      tag => tag.key === key
    );

  if (builtin) {

    return res.status(400).json({
      ok: false,
      error:
        'Les catégories ILI officielles ne peuvent pas être supprimées'
    });
  }

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
    tags: store.tags
  });
});


/* ════════════════════════════════════════════════════════════════
   SOCIAL — RSS BRIDGE
════════════════════════════════════════════════════════════════ */

const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
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
    const instance of NITTER_INSTANCES
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


/* Twitter */

app.get(
  '/api/social/twitter',
  async (req, res) => {

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

    const result =
      await fetchNitterRSS(
        handle,
        type || 'user'
      );

    res.json(result);
  }
);


/* YouTube */

app.get(
  '/api/social/youtube',
  async (req, res) => {

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
                  'Mozilla/5.0 (compatible; RSS-Fetcher/1.0)'
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
            error:
              'Channel ID introuvable',
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
        error:
          'channel_id ou handle requis'
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
              item.mediaContent?.$.url ||
              item.mediaThumbnail?.$.url ||
              ''
          }));

      res.json({
        ok: true,
        items,
        count: items.length
      });

    } catch (e) {

      res.json({
        ok: false,
        error: e.message,
        items: []
      });
    }
  }
);


/* Mastodon */

app.get(
  '/api/social/mastodon',
  async (req, res) => {

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
            error:
              'Compte Mastodon introuvable',
            items: []
          });
        }

        url =
          `https://${inst}/@${user}.rss`;

      } else {

        return res.status(400).json({
          ok: false,
          error:
            'handle ou hashtag requis'
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
        count: items.length,
        url
      });

    } catch (e) {

      res.json({
        ok: false,
        error: e.message,
        items: []
      });
    }
  }
);


/* Bluesky */

app.get(
  '/api/social/bluesky',
  async (req, res) => {

    const {
      handle,
      hashtag
    } = req.query;

    let url;

    try {

      if (hashtag) {

        url =
          `https://bsky.app/search?q=${encodeURIComponent('#' + hashtag.replace('#', ''))}&rss=1`;

      } else if (handle) {

        url =
          `https://bsky.app/profile/${handle}/rss`;

      } else {

        return res.status(400).json({
          ok: false,
          error:
            'handle ou hashtag requis'
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
        count: items.length
      });

    } catch (e) {

      res.json({
        ok: false,
        error: e.message,
        items: []
      });
    }
  }
);


/* Reddit */

app.get(
  '/api/social/reddit',
  async (req, res) => {

    const {
      subreddit,
      search,
      sort
    } = req.query;

    let url;

    if (search) {

      url =
        `https://www.reddit.com/search.rss?q=${encodeURIComponent(search)}&sort=${sort || 'new'}&limit=25`;

    } else if (subreddit) {

      url =
        `https://www.reddit.com/r/${subreddit}/${sort || 'new'}.rss?limit=25`;

    } else {

      return res.status(400).json({
        ok: false,
        error:
          'subreddit ou search requis'
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
        count: items.length
      });

    } catch (e) {

      res.json({
        ok: false,
        error: e.message,
        items: []
      });
    }
  }
);


/* Telegram */

app.get(
  '/api/social/telegram',
  async (req, res) => {

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

    for (const url of bridges) {

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
          count: items.length,
          bridge: url
        });

      } catch (_) {}
    }

    res.json({
      ok: false,
      error:
        'Tous les bridges Telegram KO',
      items: []
    });
  }
);


/* ════════════════════════════════════════════════════════════════
   SOCIAL — BATCH
════════════════════════════════════════════════════════════════ */

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
                s.handle || s.id,

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
                      s.type || 'user'
                    );

                  break;

                case 'youtube': {

                  const resp =
                    await fetch(
                      `http://localhost:${PORT}/api/social/youtube?${s.channel_id ? 'channel_id=' + s.channel_id : 'handle=' + s.handle}`
                    );

                  r =
                    await resp.json();

                  break;
                }

                case 'mastodon': {

                  const q =
                    s.hashtag
                      ? `hashtag=${s.hashtag}&instance=${s.instance || 'mastodon.social'}`
                      : `handle=${s.handle}`;

                  const resp =
                    await fetch(
                      `http://localhost:${PORT}/api/social/mastodon?${q}`
                    );

                  r =
                    await resp.json();

                  break;
                }

                case 'bluesky': {

                  const q =
                    s.hashtag
                      ? `hashtag=${s.hashtag}`
                      : `handle=${s.handle}`;

                  const resp =
                    await fetch(
                      `http://localhost:${PORT}/api/social/bluesky?${q}`
                    );

                  r =
                    await resp.json();

                  break;
                }

                case 'reddit': {

                  const q =
                    s.subreddit
                      ? `subreddit=${s.subreddit}`
                      : `search=${encodeURIComponent(s.search)}`;

                  const resp =
                    await fetch(
                      `http://localhost:${PORT}/api/social/reddit?${q}`
                    );

                  r =
                    await resp.json();

                  break;
                }

                case 'telegram': {

                  const resp =
                    await fetch(
                      `http://localhost:${PORT}/api/social/telegram?channel=${s.handle}`
                    );

                  r =
                    await resp.json();

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
                  (r.items || []).length,

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


/* ════════════════════════════════════════════════════════════════
   PLAYWRIGHT
════════════════════════════════════════════════════════════════ */

let playwrightAvailable = false;
let chromium;

try {

  ({
    chromium
  } = require('playwright'));

  playwrightAvailable = true;

  console.log(
    '  ✓ Playwright disponible — scraping avancé activé'
  );

} catch (_) {

  console.log(
    '  ⚠ Playwright non installé — scraping avancé désactivé'
  );

  console.log(
    '    Pour activer : npm install playwright && npx playwright install chromium'
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


/* Twitter hashtag */

app.get(
  '/api/scrape/twitter-hashtag',
  async (req, res) => {

    const { hashtag } =
      req.query;

    if (!hashtag) {

      return res.status(400).json({
        ok: false,
        error:
          'hashtag requis'
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
                timeout:
                  15000
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
                      )?.getAttribute(
                        'href'
                      ) || ''
                    ),

                  pubDate:
                    el.querySelector(
                      '.tweet-date a'
                    )?.getAttribute(
                      'title'
                    ) ||
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


/* YouTube search */

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
                timeout:
                  20000
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
                      )?.getAttribute(
                        'href'
                      ) || ''
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


/* Reddit search */

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
      `https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=${sort || 'new'}&limit=25`;

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


/* Statut Playwright */

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


/* ════════════════════════════════════════════════════════════════
   CATCH-ALL
════════════════════════════════════════════════════════════════ */

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
      `\n  ◈ SUPER-ILI-BRAIN`
    );

    console.log(
      `  ▶ http://localhost:${PORT}`
    );

    console.log(
      `  ▶ Playwright : ${
        playwrightAvailable
          ? 'ACTIVÉ'
          : 'désactivé (npm install playwright)'
      }`
    );

    console.log(
      `  ▶ Sources : ${SOURCE_LIBRARY.length}`
    );

    console.log(
      `  ▶ Catégories : GI / GC / INFLUENCE / DECEPTION / PSYOPS / COMOPS / STRATCOM / LIO / LID / L2I / ILI`
    );

    console.log(
      `  ▶ Serving static from: ${publicDir}\n`
    );
  }
);
