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

// Parcourt data/sources/ RÉCURSIVEMENT : fonctionne aussi bien avec des
// fichiers .json à plat qu'avec une arborescence par pays/région
// (data/sources/france/presse.json, data/sources/usa/thinktanks.json, etc.).
// L'ancienne version utilisait fs.readdirSync() sans {recursive:true} :
// tout fichier .json situé dans un sous-dossier était silencieusement
// ignoré (aucune erreur, juste absent de la bibliothèque).
function walkJsonFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`❌ Erreur lecture dossier ${dir}:`, error.message);
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      results.push(fullPath);
    }
  }
  return results;
}

function loadSourceLibrary() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.warn('⚠️ Répertoire sources absent');
    return [];
  }

  const files = walkJsonFiles(SOURCES_DIR);
  const sources = [];

  for (const fullPath of files) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        console.warn(`⚠️ ${fullPath} n'est pas un tableau JSON`);
        continue;
      }

      sources.push(...data);
    } catch (error) {
      console.error(
        `❌ Erreur chargement ${fullPath}:`,
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
      FR: ['guerre cognitive'],
      EN: ['cognitive warfare', 'cognitive war'],
      DE: ['kognitive kriegsführung'],
      ES: ['guerra cognitiva'],
      IT: ['guerra cognitiva'],
      PT: ['guerra cognitiva'],
      RU: ['когнитивная война', 'когнитивную войну'],
      UK: ['когнітивна війна'],
      AR: ['الحرب المعرفية'],
      ZH: ['认知战'],
      TR: ['bilişsel savaş'],
      FA: ['جنگ شناختی'],
      JA: ['認知戦'],
      HI: ['संज्ञानात्मक युद्ध'],
      PL: ['wojna kognitywna']
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
      DE: ['einflussoperation', 'einflussnahme'],
      ES: ['operación de influencia', 'injerencia'],
      IT: ['operazione di influenza', 'ingerenza'],
      PT: ['operação de influência', 'interferência'],
      RU: ['операция влияния', 'вмешательство'],
      UK: ['операція впливу', 'втручання'],
      AR: ['عملية تأثير', 'تدخل'],
      ZH: ['影响力行动', '干涉'],
      TR: ['etki operasyonu', 'müdahale'],
      FA: ['عملیات نفوذ', 'دخالت'],
      JA: ['影響工作'],
      HI: ['प्रभाव अभियान'],
      PL: ['operacja wpływu', 'ingerencja']
    }
  },

  {
    key: 'DECEPTION',
    label: 'Déception',
    color: '#ff3a2e',
    builtin: true,
    terms: {
      FR: ['déception', 'desinformation', 'désinformation', 'mésinformation', 'mesinformation'],
      EN: ['deception', 'deception operation', 'disinformation', 'misinformation'],
      DE: ['täuschung', 'desinformation', 'fehlinformation'],
      ES: ['engaño', 'desinformación'],
      IT: ['inganno', 'disinformazione'],
      PT: ['engano', 'desinformação'],
      RU: ['дезинформация', 'обман'],
      UK: ['дезінформація', 'обман'],
      AR: ['التضليل', 'خداع'],
      ZH: ['虚假信息', '欺骗'],
      TR: ['dezenformasyon', 'aldatma'],
      FA: ['اطلاعات نادرست'],
      JA: ['偽情報'],
      HI: ['दुष्प्रचार'],
      PL: ['dezinformacja']
    }
  },

  {
    key: 'PSYOPS',
    label: 'Opérations Psychologiques (PSYOPS)',
    color: '#a0ff00',
    builtin: true,
    terms: {
      FR: ['opérations psychologiques', 'operations psychologiques', 'guerre psychologique', 'psyops'],
      EN: ['psychological operations', 'psychological operation', 'psywar', 'psyops'],
      DE: ['psychologische kriegsführung', 'psyop'],
      ES: ['operaciones psicológicas', 'guerra psicológica'],
      IT: ['operazioni psicologiche', 'guerra psicologica'],
      PT: ['operações psicológicas', 'guerra psicológica'],
      RU: ['психологические операции'],
      UK: ['психологічні операції'],
      AR: ['العمليات النفسية'],
      ZH: ['心理战'],
      TR: ['psikolojik harekat'],
      FA: ['عملیات روانی'],
      JA: ['心理作戦'],
      HI: ['मनोवैज्ञानिक अभियान'],
      PL: ['operacje psychologiczne']
    }
  },

  {
    key: 'COMOPS',
    label: 'Communication Opérationnelle (COMOPS)',
    color: '#ff6a00',
    builtin: true,
    terms: {
      FR: ['communication opérationnelle', 'communications opérationnelles'],
      EN: ['operational communication', 'operational communications', 'operations communication'],
      DE: ['operative kommunikation'],
      ES: ['comunicación operacional'],
      IT: ['comunicazione operativa'],
      PT: ['comunicação operacional'],
      RU: ['оперативная коммуникация'],
      UK: ['оперативна комунікація'],
      AR: ['الاتصال العملياتي'],
      ZH: ['行动沟通'],
      TR: ['operasyonel iletişim'],
      FA: ['ارتباطات عملیاتی'],
      JA: ['作戦コミュニケーション'],
      HI: ['परिचालन संचार'],
      PL: ['komunikacja operacyjna']
    }
  },

  {
    key: 'STRATCOM',
    label: 'Communication Stratégique (STRATCOM)',
    color: '#00ffee',
    builtin: true,
    terms: {
      FR: ['communication stratégique', 'communications stratégiques'],
      EN: ['strategic communication', 'strategic communications', 'stratcom'],
      DE: ['strategische kommunikation'],
      ES: ['comunicación estratégica'],
      IT: ['comunicazione strategica'],
      PT: ['comunicação estratégica'],
      RU: ['стратегическая коммуникация'],
      UK: ['стратегічна комунікація'],
      AR: ['الاتصال الاستراتيجي'],
      ZH: ['战略传播'],
      TR: ['stratejik iletişim'],
      FA: ['ارتباطات راهبردی'],
      JA: ['戦略的コミュニケーション'],
      HI: ['सामरिक संचार'],
      PL: ['komunikacja strategiczna']
    }
  },

  {
    key: 'LIO',
    label: 'Lutte Informatique Offensive (LIO)',
    color: '#ff5540',
    builtin: true,
    terms: {
      FR: ['lutte informatique offensive', 'cyberoffensive', 'cyber offensive'],
      EN: ['offensive cyber operations', 'offensive cyber operation', 'offensive cyber', 'cyber offensive operations'],
      DE: ['offensive cyberoperationen'],
      ES: ['operaciones cibernéticas ofensivas'],
      IT: ['operazioni cibernetiche offensive'],
      PT: ['operações cibernéticas ofensivas'],
      RU: ['наступательные кибероперации'],
      UK: ['наступальні кібероперації'],
      AR: ['عمليات إلكترونية هجومية'],
      ZH: ['进攻性网络行动'],
      TR: ['saldırgan siber operasyonlar'],
      FA: ['عملیات سایبری تهاجمی'],
      JA: ['攻撃的サイバー作戦'],
      HI: ['आक्रामक साइबर अभियान'],
      PL: ['ofensywne operacje cybernetyczne']
    }
  },

  {
    key: 'LID',
    label: 'Lutte Informatique Défensive (LID)',
    color: '#3ddc84',
    builtin: true,
    terms: {
      FR: ['lutte informatique défensive', 'cyberdéfense', 'cyber défense'],
      EN: ['defensive cyber operations', 'defensive cyber operation', 'defensive cyber', 'cyber defense operations', 'cyber defence operations'],
      DE: ['defensive cyberoperationen'],
      ES: ['operaciones cibernéticas defensivas'],
      IT: ['operazioni cibernetiche difensive'],
      PT: ['operações cibernéticas defensivas'],
      RU: ['оборонительные кибероперации'],
      UK: ['оборонні кібероперації'],
      AR: ['عمليات إلكترونية دفاعية'],
      ZH: ['防御性网络行动'],
      TR: ['savunma amaçlı siber operasyonlar'],
      FA: ['عملیات سایبری دفاعی'],
      JA: ['防御的サイバー作戦'],
      HI: ['रक्षात्मक साइबर अभियान'],
      PL: ['defensywne operacje cybernetyczne']
    }
  },

  {
    key: 'L2I',
    label: "Lutte Informatique d'Influence (L2I)",
    color: '#ff2d9f',
    builtin: true,
    terms: {
      FR: ["lutte informatique d'influence", 'lutte informatique d’influence', 'influence cyber', 'cyberinfluence', 'cyber influence'],
      EN: ['cyber influence operations', 'cyber influence operation', 'cyber influence'],
      DE: ['cyber-einflussoperationen'],
      ES: ['operaciones cibernéticas de influencia'],
      IT: ['operazioni cibernetiche di influenza'],
      PT: ['operações cibernéticas de influência'],
      RU: ['кибер-операции влияния'],
      UK: ['кібер-операції впливу'],
      AR: ['عمليات التأثير السيبراني'],
      ZH: ['网络影响行动'],
      TR: ['siber etki operasyonları'],
      FA: ['عملیات نفوذ سایبری'],
      JA: ['サイバー影響工作'],
      HI: ['साइबर प्रभाव अभियान'],
      PL: ['cybernetyczne operacje wpływu']
    }
  },

  {
    key: 'ILI',
    label: 'Influence et Lutte Informationnelle (ILI)',
    color: '#00ffaa',
    builtin: true,
    terms: {
      FR: ['influence et lutte informationnelle', 'influence & lutte informationnelle'],
      EN: ['influence and information warfare', 'influence and information operations'],
      DE: ['einfluss und informationskrieg'],
      ES: ['influencia y guerra de la información'],
      IT: ["influenza e guerra dell'informazione"],
      PT: ['influência e guerra da informação'],
      RU: ['влияние и информационная война'],
      UK: ['вплив та інформаційна війна'],
      AR: ['التأثير وحرب المعلومات'],
      ZH: ['影响与信息战'],
      TR: ['etki ve bilgi savaşı'],
      FA: ['نفوذ و جنگ اطلاعاتی'],
      JA: ['影響と情報戦'],
      HI: ['प्रभाव और सूचना युद्ध'],
      PL: ['wpływ i wojna informacyjna']
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

const VALID_TAG_KEYS = new Set(DEFAULT_TAGS.map(tag => tag.key));

function isValidTagKey(key) {
  return VALID_TAG_KEYS.has(key);
}


/* ================================================================
   STORE
================================================================ */

function loadStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));

      const feeds = Array.isArray(raw.feeds)
        ? raw.feeds.map(feed => {
            const clean = { ...feed };
            if (!isValidTagKey(clean.tag)) {
              clean.tag = 'NC';
            }
            return clean;
          })
        : [];

      const customTags = Array.isArray(raw.tags)
        ? raw.tags.filter(tag => tag && tag.builtin !== true && tag.key && tag.label)
        : [];

      return {
        feeds,
        tags: [
          ...DEFAULT_TAGS,
          ...customTags.filter(tag => !VALID_TAG_KEYS.has(tag.key))
        ]
      };
    }
  } catch (e) {
    console.error('⚠ Erreur lecture data/store.json:', e.message);
  }

  return { feeds: [], tags: DEFAULT_TAGS };
}

let store = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('⚠ Erreur écriture data/store.json:', e.message);
  }
}

if (!fs.existsSync(STORE_FILE)) {
  saveStore();
}


/* ================================================================
   CLASSIFICATION
================================================================ */

function normalizeClassificationText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u0060]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTerm(text, term) {
  if (!term) return false;
  const t = normalizeClassificationText(term);
  if (t.length <= 3) {
    const re = new RegExp(
      `(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
      'i'
    );
    return re.test(text);
  }
  return text.includes(t);
}

const CLASSIFICATION_EXCLUSIONS = [
  'football', 'soccer', 'basketball', 'baseball', 'tennis', 'rugby', 'cycling', 'cyclisme',
  'tour de france', 'champions league', 'premier league', 'nba', 'nfl', 'nhl',
  'olympics', 'olympic games', 'olympique', 'athletics', 'athlete', 'athletes',
  'match', 'matches', 'score', 'scores', 'league', 'cup', 'championship', 'championships',
  'transfer', 'transfers', 'coach', 'coaches', 'player', 'players', 'goal', 'goals',
  'movie', 'movies', 'film review', 'cinema', 'music', 'concert', 'celebrity', 'celebrities',
  'actor', 'actress', 'netflix', 'television', 'tv show', 'gaming', 'video game', 'videogame',
  'weather', 'forecast', 'temperature', 'meteo', 'météo', 'horoscope',
  'stock market', 'stock price', 'share price', 'earnings report', 'quarterly earnings', 'market forecast',
  'medical research', 'clinical trial', 'hospital', 'patients', 'disease outbreak',
  'car review', 'vehicle review', 'new model', 'test drive', 'smartphone review', 'product review',
];

function hasStrongNonILISignal(text) {
  const normalized = normalizeClassificationText(text);
  let hits = 0;
  for (const term of CLASSIFICATION_EXCLUSIONS) {
    if (containsTerm(normalized, term)) hits++;
  }
  return hits >= 2;
}

function classifyText(text, lang, tags) {
  const normalized = normalizeClassificationText(text);
  if (!normalized) return [];
  const L = String(lang || 'EN').toUpperCase();

  const SIGNALS = {
    GI: {
      threshold: 4,
      terms: [
        ['guerre informationnelle', 5], ["guerre de l'information", 5], ['guerre de linformation', 5],
        ['lutte informationnelle', 5], ['opération informationnelle', 4], ['operations informationnelles', 4],
        ['operations d information', 4], ['opération de l information', 4],
        ['opérations dans le domaine informationnel', 4], ['environnement informationnel', 3],
        ['campagne informationnelle', 4], ['campagne de désinformation', 4], ['influence informationnelle', 3],
        ['information warfare', 5], ['information war', 5], ['infowar', 5], ['information operations', 5],
        ['information operation', 5], ['information operations campaign', 5], ['information environment', 3],
        ['information confrontation', 4], ['information campaign', 4], ['information influence', 3],
        ['informational warfare', 5], ['weaponized information', 4], ['narrative warfare', 4],
        ['hybrid warfare', 4], ['hybrid threats', 3], ['guerre hybride', 4], ['menaces hybrides', 3],
        ['информационная война', 5], ['информационная операция', 5], ['информационные операции', 5],
        ['信息战', 5], ['信息作战', 5], ['信息行动', 5],
      ]
    },
    GC: {
      threshold: 4,
      terms: [
        ['guerre cognitive', 5], ['domaine cognitif', 4], ['espace cognitif', 4],
        ['opération cognitive', 4], ['opérations cognitives', 4], ['attaque cognitive', 4],
        ['menace cognitive', 4], ['supériorité cognitive', 4], ['guerre des cerveaux', 4],
        ['cognitive warfare', 5], ['cognitive war', 5], ['cognitive domain', 4],
        ['cognitive operations', 5], ['cognitive operation', 5], ['cognitive attack', 4],
        ['cognitive attacks', 4], ['cognitive threat', 4], ['cognitive superiority', 4],
        ['cognitive security', 3], ['brain warfare', 4], ['cognitive manipulation', 4],
        ['perception management', 4], ['mental domain', 3], ['neurocognitive', 3],
        ['gestion de la perception', 4], ['domaine mental', 3],
        ['认知战', 5], ['认知作战', 5],
      ]
    },
    INFLUENCE: {
      threshold: 4,
      terms: [
        ['opération d influence', 5], ["opération d'influence", 5], ['opérations d influence', 5],
        ["opérations d'influence", 5], ['operation influence', 4], ['operation of influence', 5],
        ['influence operation', 5], ['influence operations', 5], ['foreign influence operation', 5],
        ['foreign influence operations', 5], ['foreign interference', 5], ['foreign interference operation', 5],
        ['influence campaign', 4], ['influence campaigns', 4], ['influence activity', 4],
        ['influence activities', 4], ['malign influence', 5], ['information influence operation', 5],
        ['ingérence étrangère', 5], ['ingérence', 3], ['influence étrangère', 4],
        ['campagne d influence', 4], ["campagne d'influence", 4], ['activité d influence', 4],
        ["activité d'influence", 4],
        ['coordinated inauthentic behavior', 6], ['coordinated inauthentic behaviour', 6],
        ['network of fake accounts', 5], ['fake accounts', 3], ['sockpuppet', 4], ['sockpuppets', 4],
        ['troll farm', 5], ['troll factory', 5], ['bot farm', 4], ['bot network', 4],
        ['election interference', 5], ['electoral interference', 5], ['meddling in elections', 5],
        ['astroturfing', 5], ['amplified pro-kremlin', 4], ['amplify pro-kremlin', 4],
        ['comportement coordonné inauthentique', 6], ['fermes de trolls', 5], ['ferme de trolls', 5],
        ['faux comptes', 3], ['ingérence électorale', 5], ['ingérence dans les élections', 5],
        ['операция влияния', 5], ['иностранное вмешательство', 5], ['фабрика троллей', 5],
      ]
    },
    DECEPTION: {
      threshold: 4,
      terms: [
        ['déception militaire', 5], ['opération de déception', 5], ['opérations de déception', 5],
        ['manoeuvre de déception', 5], ['manœuvre de déception', 5], ['déception', 4],
        ['disinformation', 5], ['disinformation campaign', 5], ['disinformation campaigns', 5],
        ['misinformation', 5], ['misinformation campaign', 5], ['deception operation', 5],
        ['deception operations', 5], ['military deception', 5], ['deception campaign', 5],
        ['deceptive operations', 4],
        ['désinformation', 5], ['campagne de désinformation', 5], ['mésinformation', 5],
        ['propagande', 4], ['propaganda', 4],
        ['fake news', 4], ['fake video', 4], ['fake videos', 4], ['deepfake', 5], ['deep fake', 5],
        ['fabricated video', 5], ['manipulated video', 5], ['hoax', 3], ['false claim', 3],
        ['fausse vidéo', 4], ['vidéo truquée', 5], ['infox', 4], ['intox', 3],
        ['дезинформация', 5], ['дезинформационная кампания', 5], ['фейк', 4],
      ]
    },
    PSYOPS: {
      threshold: 4,
      terms: [
        ['opération psychologique', 5], ['opérations psychologiques', 5], ['guerre psychologique', 5],
        ['action psychologique', 4], ['actions psychologiques', 4], ['psyops', 5], ['psyop', 5],
        ['psychological operation', 5], ['psychological operations', 5], ['psychological warfare', 5],
        ['psychological operation campaign', 5], ['psychological operations campaign', 5],
        ['psychological influence', 4], ['leaflet drop', 4], ['loudspeaker operations', 5],
        ['hearts and minds', 4], ['tract aérien', 4], ['opération de tracts', 4],
        ['psychologische kriegsführung', 5],
        ['психологическая операция', 5], ['психологические операции', 5], ['психологическая война', 5],
      ]
    },
    COMOPS: {
      threshold: 4,
      terms: [
        ['communication opérationnelle', 5], ['communications opérationnelles', 5],
        ['communication en opération', 4], ['communication des opérations', 4],
        ['operational communication', 5], ['operational communications', 5], ['operations communication', 5],
        ['communication during operations', 4],
        ['operative kommunikation', 5], ['оперативная коммуникация', 5],
      ]
    },
    STRATCOM: {
      threshold: 4,
      terms: [
        ['communication stratégique', 5], ['communications stratégiques', 5], ['stratégie de communication', 4],
        ['strategic communication', 5], ['strategic communications', 5], ['strategic communications strategy', 5],
        ['stratcom', 5], ['strategic messaging', 4], ['strategic narrative', 4], ['strategic narratives', 4],
        ['public diplomacy', 4], ['messaging strategy', 3], ['diplomatie publique', 4],
        ['strategische kommunikation', 5],
        ['стратегическая коммуникация', 5], ['стратегические коммуникации', 5],
      ]
    },
    LIO: {
      threshold: 4,
      terms: [
        ['lutte informatique offensive', 5], ['opération cyber offensive', 5], ['opérations cyber offensives', 5],
        ['opération informatique offensive', 5],
        ['offensive cyber operation', 5], ['offensive cyber operations', 5], ['offensive cyber', 4],
        ['offensive cyberspace operations', 5], ['cyber attack', 3], ['cyber attacks', 3],
        ['cyberattack', 3], ['cyber offensive', 5], ['cyber warfare', 4], ['cyberwarfare', 4],
        ['state-sponsored hackers', 4], ['state-backed hackers', 4], ['nation-state hackers', 4],
        ['pirates soutenus par un état', 4], ['hackers étatiques', 4], ['groupe de hackers', 3],
        ['наступательная кибероперация', 5], ['наступательные кибероперации', 5],
      ]
    },
    LID: {
      threshold: 4,
      terms: [
        ['lutte informatique défensive', 5], ['cyberdéfense', 5], ['cyber defense', 5], ['cyber defence', 5],
        ['défense cyber', 5], ['défense informatique', 4],
        ['defensive cyber operation', 5], ['defensive cyber operations', 5], ['defensive cyber', 5],
        ['cyber defense operations', 5], ['cyber defence operations', 5], ['cybersecurity defense', 4],
        ['cybersecurity', 2], ['cyber security', 2], ['incident response', 3], ['security operations center', 3],
        ['zero-day', 4], ['zero day exploit', 4], ['ransomware', 3], ['data breach', 3], ['data leak', 3],
        ['exploited vulnerability', 4], ['critical vulnerability', 3], ['patch now', 2],
        ['rançongiciel', 3], ['fuite de données', 3], ['vulnérabilité critique', 3], ['faille exploitée', 4],
        ['оборонительная кибероперация', 5], ['оборонительные кибероперации', 5],
      ]
    },
    L2I: {
      threshold: 4,
      terms: [
        ["lutte informatique d'influence", 5], ['lutte informatique d influence', 5],
        ['opération cyber d influence', 5], ["opération cyber d'influence", 5],
        ['opérations cybernétiques influence', 5],
        ['cyber influence operation', 5], ['cyber influence operations', 5], ['cyber-enabled influence', 5],
        ['cyber influence campaign', 5], ['cyber influence campaigns', 5],
        ['cyber-enabled information operation', 5], ['cyber-enabled influence operation', 5],
        ['кибероперация влияния', 5], ['кибер-операция влияния', 5],
      ]
    },
    ILI: {
      threshold: 5,
      terms: [
        ['influence et lutte informationnelle', 6], ['influence and information warfare', 6],
        ['influence and information operations', 6], ['influence informationnelle et lutte', 6],
        ['influence informationnelle', 4], ['information influence', 4],
      ]
    }
  };

  const scores = {};
  Object.entries(SIGNALS).forEach(([key, config]) => {
    let score = 0;
    for (const [term, weight] of config.terms) {
      if (containsTerm(normalized, term)) score += weight;
    }
    if (score >= config.threshold) scores[key] = score;
  });

  // Tags personnalisés (créés via l'interface, stockés dans store.tags) :
  // ils étaient reçus en paramètre mais jamais exploités — un tag maison
  // ne classifiait donc jamais rien. On les évalue ici avec leurs propres
  // termes FR + langue déclarée du flux, seuil fixe à 1 terme trouvé
  // (l'utilisateur contrôle la précision de ses propres termes).
  (tags || []).forEach(tag => {
    if (!tag || tag.builtin || !tag.terms || scores[tag.key] !== undefined) return;
    const termList = [...(tag.terms.FR || []), ...(L !== 'FR' ? (tag.terms[L] || []) : [])];
    const hit = termList.some(t => t && containsTerm(normalized, t));
    if (hit) scores[tag.key] = 5;
  });

  const nonILI = hasStrongNonILISignal(normalized);
  if (nonILI) {
    Object.keys(scores).forEach(key => {
      if (scores[key] < 8) delete scores[key];
    });
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

const TAG_PRIORITY = ['L2I', 'LIO', 'LID', 'PSYOPS', 'DECEPTION', 'STRATCOM', 'COMOPS', 'GC', 'GI', 'INFLUENCE', 'ILI', 'NC'];

function selectPrimaryTag(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return 'NC';
  for (const key of TAG_PRIORITY) {
    if (tags.includes(key)) return key;
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
  const m = String(text || '').match(/#[\wÀ-ÿ]+/g);
  return m ? [...new Set(m.map(h => h.toLowerCase()))].slice(0, 10) : [];
}

function normalizeSocialItem(raw, platform, handle) {
  return {
    title: (raw.title || raw.text || '').trim().slice(0, 200),
    link: raw.link || raw.url || raw.guid || '',
    desc: stripHtml(raw.contentSnippet || raw.content || raw.summary || raw.description || raw.text || ''),
    pubDate: raw.pubDate || raw.isoDate || raw.date || new Date().toISOString(),
    source: handle || raw.author || platform,
    platform,
    handle: handle || '',
    likes: raw.likes || raw.retweet_count || 0,
    reposts: raw.reposts || raw.retweet_count || 0,
    views: raw.views || 0,
    replies: raw.replies || 0,
    verified: raw.verified || false,
    hashtags: extractHashtags(raw.title || raw.text || raw.description || '')
  };
}


/* ================================================================
   RSS
================================================================ */

app.get('/api/feed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 50).map(item => ({
      title: (item.title || '').trim(),
      link: item.link || item.guid || '',
      desc: stripHtml(item.contentSnippet || item.content || item.summary || item.description || ''),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: feed.title || url
    }));
    res.json({ ok: true, title: feed.title || url, count: items.length, items });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message, items: [] });
  }
});


/* ================================================================
   SOURCE LIBRARY
================================================================ */

app.get('/api/source-library', (req, res) => {
  const { language, country, region, type, priority, topic } = req.query;

  let sources = [
    ...SOURCE_LIBRARY,
    ...store.feeds.filter(feed => feed && feed.url).map(feed => ({
      ...feed,
      id: `manual-${encodeURIComponent(feed.url)}`,
      custom: true,
      source: 'manual'
    }))
  ];

  if (language) sources = sources.filter(s => s.language === language);
  if (country) sources = sources.filter(s => s.country === country);
  if (region) sources = sources.filter(s => s.region === region);
  if (type) sources = sources.filter(s => s.type === type);
  if (priority) sources = sources.filter(s => s.priority === priority);
  if (topic) sources = sources.filter(s => Array.isArray(s.topics) && s.topics.includes(topic));

  res.json({ ok: true, count: sources.length, sources });
});


/* ================================================================
   IMPORT DES SOURCES
================================================================ */

const LEGACY_TOPIC_MAP = {
  information_warfare: 'GI', information_war: 'GI', 'information warfare': 'GI',
  cognitive_warfare: 'GC', cognitive_war: 'GC', 'cognitive warfare': 'GC',
  influence: 'INFLUENCE', influence_operations: 'INFLUENCE', influence_operation: 'INFLUENCE',
  deception: 'DECEPTION', disinformation: 'DECEPTION', misinformation: 'DECEPTION',
  psyops: 'PSYOPS', psychological_operations: 'PSYOPS',
  communication_operationnelle: 'COMOPS', operational_communication: 'COMOPS',
  strategic_communication: 'STRATCOM', stratcom: 'STRATCOM',
  offensive_cyber: 'LIO', offensive_cyber_operations: 'LIO',
  defensive_cyber: 'LID', defensive_cyber_operations: 'LID',
  cyber_influence: 'L2I', cyber_influence_operations: 'L2I',
  ili: 'ILI', influence_information_warfare: 'ILI'
};

function normalizeSourceTopic(topic) {
  if (!topic) return 'NC';
  const raw = String(topic).trim();
  if (isValidTagKey(raw)) return raw;

  const normalized = raw.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  if (LEGACY_TOPIC_MAP[normalized]) return LEGACY_TOPIC_MAP[normalized];

  const found = store.tags.find(tag => String(tag.label || '').toLowerCase() === raw.toLowerCase());
  if (found) return found.key;

  return 'NC';
}

function normalizeSourceTopics(source) {
  if (!source) return ['NC'];
  const topics = Array.isArray(source.topics) ? source.topics : [];
  const normalized = topics.map(normalizeSourceTopic).filter(isValidTagKey).filter(key => key !== 'NC');
  return normalized.length ? [...new Set(normalized)] : ['NC'];
}

app.post('/api/source-library/import', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ ok: false, error: 'ids doit être un tableau' });

  const selected = SOURCE_LIBRARY.filter(source => ids.includes(source.id));
  const existing = new Set(store.feeds.map(feed => feed.url));
  const added = [];

  for (const source of selected) {
    if (existing.has(source.url)) continue;
    const topics = normalizeSourceTopics(source);
    const primaryTag = topics[0] || 'NC';

    store.feeds.push({
      name: source.name || source.title || source.url,
      url: source.url,
      tag: primaryTag,
      tags: topics,
      lang: source.language || source.lang || 'FR'
    });

    added.push(source);
    existing.add(source.url);
  }

  saveStore();

  res.json({
    ok: true,
    requested: ids.length,
    found: selected.length,
    added: added.length,
    totalFeeds: store.feeds.length
  });
});

// Import en masse de TOUTE la bibliothèque (ou d'un sous-ensemble filtré),
// pratique pour activer d'un coup des centaines de sources déposées dans
// data/sources/ sans devoir cliquer/importer une par une.
app.post('/api/source-library/import-all', (req, res) => {
  const { language, country, region, type, priority, topic } = req.body || {};

  let sources = [...SOURCE_LIBRARY];
  if (language) sources = sources.filter(s => s.language === language);
  if (country) sources = sources.filter(s => s.country === country);
  if (region) sources = sources.filter(s => s.region === region);
  if (type) sources = sources.filter(s => s.type === type);
  if (priority) sources = sources.filter(s => s.priority === priority);
  if (topic) sources = sources.filter(s => Array.isArray(s.topics) && s.topics.includes(topic));

  const existing = new Set(store.feeds.map(feed => feed.url));
  const added = [];

  for (const source of sources) {
    if (!source.url || existing.has(source.url)) continue;
    const topics = normalizeSourceTopics(source);
    const primaryTag = topics[0] || 'NC';

    store.feeds.push({
      name: source.name || source.title || source.url,
      url: source.url,
      tag: primaryTag,
      tags: topics,
      lang: source.language || source.lang || 'FR'
    });

    added.push(source.url);
    existing.add(source.url);
  }

  if (added.length > 0) saveStore();

  res.json({
    ok: true,
    matched: sources.length,
    added: added.length,
    totalFeeds: store.feeds.length
  });
});


/* ================================================================
   RÉCUPÉRATION DES FLUX
================================================================ */

/* ================================================================
   CLASSIFICATION LLM (2ᵉ passe, uniquement sur ce que les mots-clés
   n'ont pas su classer) — via OmniRoute (github.com/diegosouzapw/OmniRoute),
   une passerelle IA auto-hébergée, compatible OpenAI, qui agrège
   340+ fournisseurs dont 90+ gratuits derrière un seul endpoint.
   ----------------------------------------------------------------
   IMPORTANT : OmniRoute doit tourner quelque part JOIGNABLE PAR RENDER
   (Docker sur un VPS, ou un second service Render) — pas seulement en
   local sur ta machine, sinon ce serveur ne peut pas l'atteindre
   (même contrainte que pour Ollama en local).
   ----------------------------------------------------------------
   Principe :
   1. La passe mots-clés (classifyText) reste la 1ʳᵉ ligne : rapide,
      gratuite, déterministe.
   2. Seuls les articles qui ressortent NC après cette passe sont
      envoyés au LLM — en LOTS (batch), pas un par un, pour rester
      sous les quotas des fournisseurs gratuits connectés à OmniRoute.
   3. Chaque classification LLM est mise en cache durablement
      (par URL d'article, dans data/llm-cache.json) : un même article
      n'est jamais reclassifié deux fois, même si le flux est
      réactualisé toutes les 10 minutes.
   4. Si OMNIROUTE_BASE_URL / OMNIROUTE_API_KEY ne sont pas configurées
      sur Render, cette passe est simplement ignorée — l'appli continue
      de fonctionner en mode mots-clés seul (rien ne casse).
================================================================ */

const OMNIROUTE_BASE_URL = (process.env.OMNIROUTE_BASE_URL || '').replace(/\/+$/, '');
const OMNIROUTE_API_KEY  = process.env.OMNIROUTE_API_KEY || '';
// 'auto/cheap' = routage zéro-config d'OmniRoute vers le fournisseur gratuit
// disponible le moins cher/le plus dispo. Surchargeable par ex. avec
// 'gemini/gemini-2.0-flash' si tu préfères cibler un fournisseur précis
// que tu as connecté dans le dashboard OmniRoute.
const OMNIROUTE_MODEL      = process.env.OMNIROUTE_MODEL || 'auto/cheap';
const OMNIROUTE_BATCH_SIZE = parseInt(process.env.OMNIROUTE_BATCH_SIZE || '25', 10);
const OMNIROUTE_MAX_BATCHES_PER_CYCLE = parseInt(process.env.OMNIROUTE_MAX_BATCHES || '12', 10);
const OMNIROUTE_DELAY_MS   = parseInt(process.env.OMNIROUTE_DELAY_MS || '3000', 10);
const LLM_ENABLED = !!(OMNIROUTE_BASE_URL && OMNIROUTE_API_KEY);

const LLM_CACHE_FILE = path.join(DATA_DIR, 'llm-cache.json');

function loadLlmCache() {
  try {
    if (fs.existsSync(LLM_CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LLM_CACHE_FILE, 'utf8'));
      return raw && typeof raw === 'object' ? raw : {};
    }
  } catch (e) {
    console.error('⚠ Erreur lecture data/llm-cache.json:', e.message);
  }
  return {};
}

let llmCache = loadLlmCache();
let llmCacheDirty = false;

function saveLlmCacheIfDirty() {
  if (!llmCacheDirty) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LLM_CACHE_FILE, JSON.stringify(llmCache, null, 2), 'utf8');
    llmCacheDirty = false;
  } catch (e) {
    console.error('⚠ Erreur écriture data/llm-cache.json:', e.message);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const ILI_TAG_GUIDE = DEFAULT_TAGS
  .filter(t => t.key !== 'NC')
  .map(t => `- ${t.key} : ${t.label}`)
  .join('\n');

// Appel via l'endpoint OpenAI-compatible d'OmniRoute (/v1/chat/completions).
async function classifyBatchWithOmniRoute(batch) {
  // batch: [{ id, title, desc }]
  const prompt = `Tu es un analyste en guerre informationnelle / influence et lutte informationnelle (ILI) pour l'armée française. Classe chaque article ci-dessous selon la taxonomie suivante (un article peut recevoir plusieurs tags, ou aucun s'il n'a clairement aucun rapport) :

${ILI_TAG_GUIDE}

Règle stricte : n'attribue un tag que si l'article traite RÉELLEMENT de ce sujet (opérations d'influence, désinformation, cyber, communication stratégique/militaire, guerre cognitive/psychologique, etc.), même si le vocabulaire exact diffère de celui ci-dessus (ex: "troll farm", "deepfake", "état-hackers", "coordinated inauthentic behavior" comptent). Un article de sport, météo, économie générale, culture, etc. sans lien avec ces thèmes doit recevoir un tableau vide.

Articles à classer (JSON) :
${JSON.stringify(batch.map(b => ({ id: b.id, title: b.title, desc: b.desc.slice(0, 300) })))}

Réponds UNIQUEMENT avec un JSON de cette forme, sans aucun texte autour :
{"results":[{"id":"<id de l'article>","tags":["GI","DECEPTION"]}, ...]}
Chaque "id" du tableau d'entrée doit apparaître exactement une fois dans "results". "tags" doit être un sous-ensemble des clés listées ci-dessus (tableau vide si aucun rapport).`;

  const url = `${OMNIROUTE_BASE_URL}/v1/chat/completions`;

  const body = {
    model: OMNIROUTE_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OMNIROUTE_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`OmniRoute ${r.status}: ${errText.slice(0, 200)}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);

  const out = {};
  (parsed.results || []).forEach(entry => {
    if (!entry || !entry.id) return;
    const tags = Array.isArray(entry.tags) ? entry.tags.filter(isValidTagKey) : [];
    out[entry.id] = tags;
  });
  return out;
}

// Classifie via LLM tout item resté NC après la passe mots-clés,
// en respectant le cache et les plafonds de lots/débit.
// Modifie `items` en place (matchedTags / tag) et alimente llmCache.
async function enrichWithLLM(allItemsFlat) {
  if (!LLM_ENABLED) return; // fonctionnalité désactivée tant qu'OmniRoute n'est pas configuré

  const toClassify = [];
  allItemsFlat.forEach(it => {
    if (it.matchedTags.length > 0) return; // déjà classé par mots-clés
    const cached = llmCache[it.link];
    if (cached !== undefined) {
      it.matchedTags = cached;
      it.tag = selectPrimaryTag(cached);
      it.classifiedBy = 'llm-cache';
      return;
    }
    if (it.link) toClassify.push(it);
  });

  if (toClassify.length === 0) return;

  const batches = [];
  for (let i = 0; i < toClassify.length; i += OMNIROUTE_BATCH_SIZE) {
    batches.push(toClassify.slice(i, i + OMNIROUTE_BATCH_SIZE));
  }
  const limitedBatches = batches.slice(0, OMNIROUTE_MAX_BATCHES_PER_CYCLE);

  for (let i = 0; i < limitedBatches.length; i++) {
    const batch = limitedBatches[i].map(it => ({ id: it.link, title: it.title, desc: it.desc }));
    try {
      const results = await classifyBatchWithOmniRoute(batch);
      limitedBatches[i].forEach(it => {
        const tags = results[it.link] || [];
        it.matchedTags = tags;
        it.tag = selectPrimaryTag(tags);
        it.classifiedBy = 'llm';
        llmCache[it.link] = tags;
        llmCacheDirty = true;
      });
    } catch (err) {
      console.error('⚠ Erreur classification OmniRoute (lot ignoré, reste NC):', err.message);
    }
    if (i < limitedBatches.length - 1) await sleep(OMNIROUTE_DELAY_MS);
  }

  saveLlmCacheIfDirty();
}


app.post('/api/feeds', async (req, res) => {
  const { feeds } = req.body;
  if (!Array.isArray(feeds)) return res.status(400).json({ error: 'feeds must be array' });


  const results = await Promise.all(feeds.map(async f => {
    try {
      const feed = await parser.parseURL(f.url);
      const items = (feed.items || []).slice(0, 30).map(item => {
        const title = (item.title || '').trim();
        const desc = stripHtml(item.contentSnippet || item.content || item.summary || item.description || '');
        const text = `${title} ${desc}`;

        const matchedTags = classifyText(text, f.lang, store.tags);
        const primaryTag = selectPrimaryTag(matchedTags);

        return {
          title,
          link: item.link || item.guid || '',
          desc,
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source: f.name || feed.title || f.url,
          feedTag: normalizeSourceTopic(f.tag),
          sourceTags: Array.isArray(f.tags) ? f.tags : [normalizeSourceTopic(f.tag)],
          lang: f.lang,
          matchedTags,
          tag: primaryTag,
          classifiedBy: matchedTags.length ? 'keywords' : 'none'
        };
      });

      return { name: f.name, url: f.url, ok: true, count: items.length, items };
    } catch (err) {
      return { name: f.name, url: f.url, ok: false, error: err.message, items: [] };
    }
  }));

  // 2ᵉ passe optionnelle (si OMNIROUTE_BASE_URL + OMNIROUTE_API_KEY configurées) :
  // tout item resté
  // NC après les mots-clés est envoyé au LLM, en lots, avec cache durable.
  const allItemsFlat = results.flatMap(r => r.items || []);
  await enrichWithLLM(allItemsFlat);

  res.json({ results, llmEnabled: LLM_ENABLED });
});


/* ================================================================
   TEST FLUX
================================================================ */

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


/* ================================================================
   STORE API
================================================================ */

app.get('/api/store', (req, res) => {
  res.json({ ok: true, feeds: store.feeds, tags: store.tags });
});

app.post('/api/store/feed', (req, res) => {
  const { name, url, tag, tags, lang } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: 'url requis' });
  if (store.feeds.find(f => f.url === url)) {
    return res.json({ ok: false, error: 'Flux déjà présent', feeds: store.feeds });
  }

  let sourceTags = [];
  if (Array.isArray(tags)) {
    sourceTags = tags.map(normalizeSourceTopic).filter(isValidTagKey);
  }
  if (!sourceTags.length) {
    sourceTags = [normalizeSourceTopic(tag)];
  }

  store.feeds.push({
    name: name || url,
    url,
    tag: sourceTags[0] || 'NC',
    tags: sourceTags,
    lang: lang || 'FR'
  });

  saveStore();
  res.json({ ok: true, feeds: store.feeds });
});

app.post('/api/store/feeds-bulk', (req, res) => {
  const { feeds } = req.body || {};
  if (!Array.isArray(feeds)) return res.status(400).json({ ok: false, error: 'feeds doit être un tableau' });

  let added = 0;
  feeds.forEach(f => {
    if (!f || !f.url || store.feeds.find(x => x.url === f.url)) return;

    const sourceTags = Array.isArray(f.tags) ? f.tags.map(normalizeSourceTopic).filter(isValidTagKey) : [];
    if (!sourceTags.length) sourceTags.push(normalizeSourceTopic(f.tag));

    store.feeds.push({
      name: f.name || f.url,
      url: f.url,
      tag: sourceTags[0] || 'NC',
      tags: sourceTags,
      lang: f.lang || f.language || 'FR'
    });

    added++;
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


/* ================================================================
   TAGS PERSONNALISÉS
================================================================ */

app.post('/api/store/tag', (req, res) => {
  const { key, label, color, terms } = req.body || {};
  if (!key || !label) return res.status(400).json({ ok: false, error: 'key et label requis' });

  const k = String(key).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16);
  if (!k) return res.status(400).json({ ok: false, error: 'clé de tag invalide' });
  if (store.tags.find(t => t.key === k)) {
    return res.json({ ok: false, error: 'Ce tag existe déjà', tags: store.tags });
  }

  const cleanTerms = {};
  if (terms && typeof terms === 'object') {
    Object.entries(terms).forEach(([langCode, list]) => {
      if (!Array.isArray(list)) return;
      const arr = list.map(s => String(s).trim().toLowerCase()).filter(Boolean);
      if (arr.length) cleanTerms[langCode.toUpperCase().slice(0, 4)] = arr;
    });
  }

  store.tags.push({
    key: k,
    label: String(label).slice(0, 80),
    color: /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#7a9bbf',
    builtin: false,
    terms: cleanTerms
  });

  saveStore();
  res.json({ ok: true, tags: store.tags });
});

app.delete('/api/store/tag', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'key requis' });

  const builtin = DEFAULT_TAGS.find(tag => tag.key === key);
  if (builtin) {
    return res.status(400).json({
      ok: false,
      error: 'Les catégories intégrées ne peuvent pas être supprimées',
      tags: store.tags
    });
  }

  const before = store.tags.length;
  store.tags = store.tags.filter(t => t.key !== key);
  if (store.tags.length !== before) saveStore();

  res.json({ ok: true, tags: store.tags });
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

async function fetchNitterRSS(handle, type = 'user') {
  const slug = type === 'hashtag'
    ? `/search/rss?q=${encodeURIComponent(handle)}&f=tweets`
    : `/${handle.replace('@', '')}/rss`;

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = instance + slug;
      const feed = await parser.parseURL(url);
      return {
        ok: true,
        instance,
        handle,
        items: (feed.items || []).slice(0, 30).map(item => normalizeSocialItem(item, 'twitter', handle))
      };
    } catch (_) {}
  }

  return { ok: false, handle, items: [], error: 'Toutes les instances Nitter KO' };
}

app.get('/api/social/twitter', async (req, res) => {
  const { handle, type } = req.query;
  if (!handle) return res.status(400).json({ ok: false, error: 'Missing handle' });
  res.json(await fetchNitterRSS(handle, type || 'user'));
});

app.get('/api/social/youtube', async (req, res) => {
  const { channel_id, handle } = req.query;
  let url;

  if (channel_id) {
    url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel_id}`;
  } else if (handle) {
    try {
      const r = await fetch(`https://www.youtube.com/@${handle}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const txt = await r.text();
      const m = txt.match(/"channelId":"([^"]+)"/);
      if (!m) return res.json({ ok: false, error: 'Channel ID introuvable', items: [] });
      url = `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`;
    } catch (e) {
      return res.json({ ok: false, error: e.message, items: [] });
    }
  } else {
    return res.status(400).json({ ok: false, error: 'channel_id ou handle requis' });
  }

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 20).map(item => ({
      ...normalizeSocialItem(item, 'youtube', handle || channel_id),
      thumbnail: item.mediaContent?.$?.url || item.mediaThumbnail?.$?.url || ''
    }));
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/social/mastodon', async (req, res) => {
  const { handle, hashtag, instance } = req.query;
  let url;

  try {
    if (hashtag) {
      const inst = instance || 'mastodon.social';
      url = `https://${inst}/tags/${hashtag.replace('#', '')}.rss`;
    } else if (handle) {
      const parts = handle.replace('@', '').split('@');
      const user = parts[0];
      const inst = parts[1] || instance || 'mastodon.social';
      const apiUrl = `https://${inst}/api/v1/accounts/lookup?acct=${user}`;
      const r = await fetch(apiUrl, { headers: { 'User-Agent': 'SUPER-ILI-BRAIN/1.0' } });
      const acct = await r.json();
      if (!acct.id) return res.json({ ok: false, error: 'Compte Mastodon introuvable', items: [] });
      url = `https://${inst}/@${user}.rss`;
    } else {
      return res.status(400).json({ ok: false, error: 'handle ou hashtag requis' });
    }

    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 30).map(item => normalizeSocialItem(item, 'mastodon', handle || hashtag));
    res.json({ ok: true, items, count: items.length, url });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/social/bluesky', async (req, res) => {
  const { handle, hashtag } = req.query;
  let url;

  try {
    if (hashtag) {
      url = `https://bsky.app/search?q=${encodeURIComponent('#' + hashtag.replace('#', ''))}&rss=1`;
    } else if (handle) {
      url = `https://bsky.app/profile/${handle}/rss`;
    } else {
      return res.status(400).json({ ok: false, error: 'handle ou hashtag requis' });
    }

    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 30).map(item => normalizeSocialItem(item, 'bluesky', handle || hashtag));
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/social/reddit', async (req, res) => {
  const { subreddit, search, sort } = req.query;
  let url;

  if (search) {
    url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(search)}&sort=${sort || 'new'}&limit=25`;
  } else if (subreddit) {
    url = `https://www.reddit.com/r/${subreddit}/${sort || 'new'}.rss?limit=25`;
  } else {
    return res.status(400).json({ ok: false, error: 'subreddit ou search requis' });
  }

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 25).map(item => normalizeSocialItem(item, 'reddit', subreddit || search));
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/social/telegram', async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ ok: false, error: 'channel requis' });

  const bridges = [
    `https://rsshub.app/telegram/channel/${channel}`,
    `https://tg.i-c-a.su/rss/${channel}`,
    `https://telegramrss.com/rss/${channel}`
  ];

  for (const url of bridges) {
    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, 30).map(item => normalizeSocialItem(item, 'telegram', channel));
      return res.json({ ok: true, items, count: items.length, bridge: url });
    } catch (_) {}
  }

  res.json({ ok: false, error: 'Tous les bridges Telegram KO', items: [] });
});


/* ================================================================
   PLAYWRIGHT
================================================================ */

let playwrightAvailable = false;
let chromium;

try {
  ({ chromium } = require('playwright'));
  playwrightAvailable = true;
  console.log('  ✓ Playwright disponible');
} catch (_) {
  console.log('  ⚠ Playwright non installé');
}

const scraperCache = new Map();
const SCRAPE_TTL = 5 * 60 * 1000;

async function withBrowser(fn) {
  if (!playwrightAvailable) throw new Error('Playwright non installé');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

app.get('/api/scrape/twitter-hashtag', async (req, res) => {
  const { hashtag } = req.query;
  if (!hashtag) return res.status(400).json({ ok: false, error: 'hashtag requis' });

  const cacheKey = `tw_ht_${hashtag}`;
  const cached = scraperCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCRAPE_TTL) return res.json(cached.data);

  const rssResult = await fetchNitterRSS(hashtag, 'hashtag');
  if (rssResult.ok && rssResult.items.length > 0) {
    const data = { ok: true, method: 'nitter-rss', items: rssResult.items };
    scraperCache.set(cacheKey, { ts: Date.now(), data });
    return res.json(data);
  }

  if (!playwrightAvailable) {
    return res.json({ ok: false, error: 'RSS KO et Playwright non installé', items: [] });
  }

  try {
    const items = await withBrowser(async browser => {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });
      const tag = hashtag.replace('#', '');
      await page.goto(`${NITTER_INSTANCES[0]}/search?q=%23${tag}&f=tweets`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      return page.evaluate(() =>
        Array.from(document.querySelectorAll('.timeline-item')).slice(0, 30).map(el => ({
          title: el.querySelector('.tweet-content')?.innerText?.trim() || '',
          link: 'https://twitter.com' + (el.querySelector('a.tweet-link')?.getAttribute('href') || ''),
          pubDate: el.querySelector('.tweet-date a')?.getAttribute('title') || new Date().toISOString(),
          likes: parseInt(el.querySelector('.icon-heart')?.closest('.tweet-stat')?.innerText || '0') || 0,
          reposts: parseInt(el.querySelector('.icon-retweet')?.closest('.tweet-stat')?.innerText || '0') || 0,
          replies: parseInt(el.querySelector('.icon-comment')?.closest('.tweet-stat')?.innerText || '0') || 0
        }))
      );
    });

    const normalized = items.map(it => normalizeSocialItem({ ...it, text: it.title }, 'twitter', '#' + hashtag.replace('#', '')));
    const data = { ok: true, method: 'playwright-nitter', items: normalized };
    scraperCache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/scrape/youtube-search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: 'q requis' });

  const cacheKey = `yt_${q}`;
  const cached = scraperCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCRAPE_TTL) return res.json(cached.data);

  if (!playwrightAvailable) return res.json({ ok: false, error: 'Playwright non installé', items: [] });

  try {
    const items = await withBrowser(async browser => {
      const page = await browser.newPage();
      await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAISAhAB`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForSelector('ytd-video-renderer', { timeout: 8000 }).catch(() => {});

      return page.evaluate(() =>
        Array.from(document.querySelectorAll('ytd-video-renderer')).slice(0, 15).map(el => ({
          title: el.querySelector('#video-title')?.innerText?.trim() || '',
          link: 'https://youtube.com' + (el.querySelector('#video-title')?.getAttribute('href') || ''),
          source: el.querySelector('#channel-name a')?.innerText?.trim() || '',
          views: el.querySelector('#metadata-line span:first-child')?.innerText || '0',
          pubDate: el.querySelector('#metadata-line span:last-child')?.innerText || '',
          thumbnail: el.querySelector('img')?.src || ''
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

app.get('/api/scrape/reddit-search', async (req, res) => {
  const { q, sort } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: 'q requis' });

  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=${sort || 'new'}&limit=25`;

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 25).map(item => normalizeSocialItem(item, 'reddit', q));
    res.json({ ok: true, method: 'rss', items, count: items.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, items: [] });
  }
});

app.get('/api/scrape/status', (req, res) => {
  res.json({ playwright: playwrightAvailable, cache_entries: scraperCache.size });
});

app.post('/api/social/batch', async (req, res) => {
  const { sources } = req.body;
  if (!Array.isArray(sources)) return res.status(400).json({ error: 'sources must be array' });

  const results = await Promise.allSettled(sources.map(async s => {
    const base = { platform: s.platform, handle: s.handle || s.id, label: s.label };

    try {
      let r;
      switch (s.platform) {
        case 'twitter':
          r = await fetchNitterRSS(s.handle, s.type || 'user');
          break;
        case 'youtube': {
          const params = s.channel_id ? `channel_id=${s.channel_id}` : `handle=${s.handle}`;
          const response = await fetch(`http://localhost:${PORT}/api/social/youtube?${params}`);
          r = await response.json();
          break;
        }
        case 'mastodon': {
          const q = s.hashtag
            ? `hashtag=${encodeURIComponent(s.hashtag)}&instance=${s.instance || 'mastodon.social'}`
            : `handle=${encodeURIComponent(s.handle)}`;
          const response = await fetch(`http://localhost:${PORT}/api/social/mastodon?${q}`);
          r = await response.json();
          break;
        }
        case 'bluesky': {
          const q = s.hashtag ? `hashtag=${encodeURIComponent(s.hashtag)}` : `handle=${encodeURIComponent(s.handle)}`;
          const response = await fetch(`http://localhost:${PORT}/api/social/bluesky?${q}`);
          r = await response.json();
          break;
        }
        case 'reddit': {
          const q = s.subreddit ? `subreddit=${encodeURIComponent(s.subreddit)}` : `search=${encodeURIComponent(s.search || '')}`;
          const response = await fetch(`http://localhost:${PORT}/api/social/reddit?${q}`);
          r = await response.json();
          break;
        }
        case 'telegram': {
          const response = await fetch(`http://localhost:${PORT}/api/social/telegram?channel=${encodeURIComponent(s.handle)}`);
          r = await response.json();
          break;
        }
        default:
          r = { ok: false, error: 'Plateforme inconnue', items: [] };
      }

      return { ...base, ok: r.ok, items: r.items || [], count: (r.items || []).length, error: r.error };
    } catch (e) {
      return { ...base, ok: false, items: [], count: 0, error: e.message };
    }
  }));

  res.json({
    results: results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, items: [], error: r.reason?.message })
  });
});


/* ================================================================
   CATCH-ALL
================================================================ */

app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ◈ SUPER-ILI-BRAIN');
  console.log(`  ▶ http://localhost:${PORT}`);
  console.log(`  ▶ Playwright : ${playwrightAvailable ? 'ACTIVÉ' : 'désactivé'}`);
  console.log(`  ▶ Sources : ${SOURCE_LIBRARY.length}`);
  console.log(`  ▶ Tags : ${store.tags.length}`);
  console.log(`  ▶ Serving static from: ${publicDir}\n`);
});
