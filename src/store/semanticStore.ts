// =============================================================================
// Semantic Store — Connects Data → Engines → Graph
// =============================================================================
// Loads data from Supabase, then runs semantic engines.
// Uses async initialization with IndexedDB cache for computed results.
// Only shows connected nodes in the graph (not all 6236).
// =============================================================================

import type { Verse, Word, TokenizedVerse, POS } from '@/engine/linguistic/types';
import type {
  SemanticCache,
  SemanticMode,
  VerseLink,
  VerseConcept,
  Concept,
  ConceptDomain,
  ActionEdge,
  ActionSummary,
  RootIndex,
  RootContext,
  RootCentrality,
  RootCentralitySummary,
} from '@/engine/semantic/types';
import type { GraphNode, GraphEdge, GraphRenderData } from '@/engine/visualization/types';

import { stripDiacritics } from '@/engine/linguistic/rootExtractor';
import { buildRootIndex } from '@/engine/semantic/rootEngine';
import { computeActionSummary } from '@/engine/semantic/actionEngine';
import { runPrecompute, loadCache, saveCache, clearCache } from '@/engine/semantic/precompute';
import {
  CONTRAST_DICTIONARY,
  CONTRAST_PAIR_HUES,
  CONTRAST_PAIR_ORDER,
  CONTRAST_LABEL_ENGLISH,
  CONTRAST_ROOT_ALIASES,
} from '@/engine/semantic/contrastEngine';
import {
  ACTION_FAMILY_MAP,
  CANONICAL_ACTION_MAP,
  ACTION_FAMILY_LABELS,
  ACTION_FAMILY_HUES,
  ACTION_FAMILY_INDONESIAN,
  ACTOR_ONTOLOGY_MAP,
  ACTOR_ONTOLOGY_HUES,
} from '@/engine/semantic/actionDictionaries';
import { loadDataFromSupabase } from '@/lib/dataLoader';
import type { SurahInfo } from '@/lib/dataLoader';
// Service A — Linguistic Core
import {
  setVerseTokens,
  getVerseLinguisticRoots,
} from '@/services/linguistic/linguisticService';
// Service B — Semantic AI Layer
import {
  setRootConcepts,
  setConceptGraphEdges,
  setConceptNames,
  getVerseSemanticDomains as _getVerseSemanticDomains,
  validateDomains,
} from '@/services/semantic/semanticDomainService';
export type { SemanticDomain } from '@/services/semantic/semanticDomainService';

// --- Root Translation (loaded from Supabase ayamakna_root_translations) ---
// Populated during initSemanticEngine(). Covers all 1,651 Quranic roots.
let _rootTranslations: Map<string, string> = new Map();

/** Returns the English conceptual meaning for an Arabic root, or '' if unknown. */
export function getRootTranslation(root: string): string {
  return _rootTranslations.get(root) ?? '';
}

// --- Root keyword search map ---
// Arabic root → English + transliteration + Indonesian keywords.
// Enables searching "patience", "sabar", "ilmu", etc. across all modes.
export const ROOT_KEYWORDS: Record<string, string> = {
  'صبر': 'patience patient endurance sabar kesabaran',
  'علم': 'knowledge ilm science ilmu pengetahuan',
  'رحم': 'mercy compassion rahmah rahmat kasih sayang',
  'ءمن': 'faith belief iman kepercayaan',
  'كفر': 'disbelief unbelief kufr kafir kekufuran',
  'هدي': 'guidance hidayah petunjuk',
  'نور': 'light nur cahaya',
  'ظلم': 'darkness oppression zulm kegelapan kezaliman',
  'قلب': 'heart qalb hati',
  'عبد': 'worship servant ibadah hamba',
  'ذكر': 'remembrance mention dhikr dzikir mengingat',
  'شكر': 'gratitude thankfulness shukr syukur',
  'تقو': 'piety taqwa takwa',
  'جنن': 'paradise garden jannah surga',
  'نار': 'fire hell nar neraka api',
  'توب': 'repentance tawbah taubat',
  'رزق': 'provision sustenance rizq rezeki',
  'دعو': 'prayer invocation dua doa',
  'حكم': 'wisdom judgment hikmah hukum',
  'صدق': 'truth truthfulness sidq kebenaran',
  'كذب': 'lie falsehood dusta bohong',
  'عدل': 'justice adl adil keadilan',
  'فسد': 'corruption fasad kerusakan',
  'خير': 'good goodness khayr kebaikan',
  'شرر': 'evil sharr kejahatan',
  'موت': 'death mawt mati kematian',
  'حيي': 'life hayat hidup kehidupan',
  'صلح': 'righteousness reform islah kebaikan',
  'حمد': 'praise hamd pujian',
  'سبح': 'glorification tasbih subhan',
  'طهر': 'purity purification suci',
  'كتب': 'book write kitab quran',
  'قرأ': 'read recite baca',
  'رسل': 'messenger prophet rasul utusan',
  'نبأ': 'prophet nabi',
  'ملك': 'king angel malak malik',
  'سمع': 'hear listen mendengar',
  'بصر': 'see sight melihat',
  'فكر': 'think reason fikr pikir',
  'عقل': 'intellect reason aql akal',
  'حق': 'truth right haqq hak benar',
  'بطل': 'falsehood batil bathil',
  'ءخر': 'afterlife hereafter akhirah akherat',
  'دنو': 'world worldly dunya dunia',
  'يوم': 'day yawm hari',
  'ءمر': 'command order amr perintah',
  'قتل': 'kill fight qatl bunuh',
  'جهد': 'strive struggle jihad',
  'صلو': 'prayer salah shalat sembahyang',
  'زكو': 'zakat charity zakah',
  'صوم': 'fast fasting puasa',
  'ربب': 'lord rabb tuhan',
  'خلق': 'create creation khalq ciptaan',
  'غفر': 'forgive forgiveness maghfirah ampun ampunan',
  'فلح': 'succeed success falah beruntung',
  'ضلل': 'stray astray dalal sesat',
  'توكل': 'trust reliance tawakkul tawakal',
  'نفس': 'soul self nafs jiwa',
  'بعث': 'resurrect raise bangkit',
  'شفع': 'intercede intercession syafaat',
  'حسب': 'reckon account hisab',
};

// Concept Indonesian translations (for search tokens)
const CONCEPT_INDONESIAN: Record<string, string> = {
  'adl': 'keadilan adil',
  'akhlaq': 'akhlak moral etika',
  'amr_nahi': 'perintah larangan',
  'dhikr': 'dzikir mengingat zikir',
  'dua': 'doa berdoa',
  'hayat_mawt': 'hidup mati kehidupan kematian',
  'hidayah': 'hidayah petunjuk',
  'ihsan': 'ihsan berbuat baik',
  'ilm': 'ilmu pengetahuan',
  'iman': 'iman kepercayaan keyakinan',
  'jannah_nar': 'surga neraka',
  'jihad': 'jihad berjuang',
  'khawf_raja': 'takut harap',
  'kufr': 'kafir kekufuran',
  'kufr_nifaq': 'munafik kemunafikan',
  'maghfirah': 'ampunan maghfirah',
  'nur_zulm': 'cahaya kegelapan',
  'qadr': 'qadar takdir',
  'qiyamah': 'kiamat hari kebangkitan',
  'quran': 'alquran kitab',
  'rahmah': 'rahmat kasih sayang',
  'rizq': 'rezeki pemberian',
  'sabr': 'sabar kesabaran',
  'salah': 'shalat sembahyang',
  'shukr': 'syukur rasa syukur',
  'taqwa': 'takwa ketakwaan',
  'tawakkul': 'tawakal berserah',
  'tawbah': 'taubat pertobatan',
  'tawhid': 'tauhid keesaan Allah',
};

// --- Module State (populated by initSemanticEngine) ---

let _allVerses: Verse[] = [];
let _allConcepts: Concept[] = [];
let _allConceptDomains: ConceptDomain[] = [];
let _allVerseConcepts: VerseConcept[] = [];
let _rootLookup: Map<string, string> = new Map();
let _verseLookup: Map<string, Verse> = new Map();
let _surahLookup: Map<number, SurahInfo> = new Map();
let _conceptByVerse: Map<string, VerseConcept[]> = new Map();
// conceptId → ConceptDomain
let _conceptDomainMap: Map<string, ConceptDomain> = new Map();
// Precomputed concept verse links (from ayamakna_concept_verse_links)
let _conceptVerseLinks: VerseLink[] = [];
// Precomputed action verse links (from ayamakna_action_verse_links)
let _actionVerseLinks: VerseLink[] = [];
// Precomputed contrast verse links (from ayamakna_contrast_verse_links)
let _contrastVerseLinks: VerseLink[] = [];
// verseId → Set<pairId> — built from _contrastVerseLinks for fast search token lookup
let _verseContrastPairsMap: Map<string, Set<string>> = new Map();
let _tokenizedVerses: TokenizedVerse[] | null = null;
let _tokenizedVerseMap: Map<string, TokenizedVerse> = new Map();
let _semanticCache: SemanticCache | null = null;
let _initPromise: Promise<void> | null = null;
let _rootIndex: RootIndex | null = null;
let _dataLoaded = false;
// Root → primary conceptId (built from ayamakna_root_concepts, highest weight per root)
let _rootConceptMap: Map<string, string> = new Map();

// Root mode focus level — controls minimum similarity threshold for edge visibility
const ROOT_FOCUS_THRESHOLDS = { broad: 0.28, focused: 0.48, deep: 0.55 } as const;
export type RootFocusLevel = keyof typeof ROOT_FOCUS_THRESHOLDS;
let _rootFocusLevel: RootFocusLevel = 'focused';
export function setRootFocusLevel(level: RootFocusLevel): void { _rootFocusLevel = level; }
export function getRootFocusLevel(): RootFocusLevel { return _rootFocusLevel; }

// Concept mode focus level — controls minimum concept-Jaccard threshold for edge visibility
const CONCEPT_FOCUS_THRESHOLDS = { broad: 0.28, focused: 0.48, deep: 0.55 } as const;
export type ConceptFocusLevel = keyof typeof CONCEPT_FOCUS_THRESHOLDS;
let _conceptFocusLevel: ConceptFocusLevel = 'focused';
export function setConceptFocusLevel(level: ConceptFocusLevel): void { _conceptFocusLevel = level; }
export function getConceptFocusLevel(): ConceptFocusLevel { return _conceptFocusLevel; }

// Action mode focus level — controls minimum action-Jaccard threshold for edge visibility
const ACTION_FOCUS_THRESHOLDS = { broad: 0.12, focused: 0.25, deep: 0.40 } as const;
export type ActionFocusLevel = keyof typeof ACTION_FOCUS_THRESHOLDS;
let _actionFocusLevel: ActionFocusLevel = 'focused';
export function setActionFocusLevel(level: ActionFocusLevel): void { _actionFocusLevel = level; }
export function getActionFocusLevel(): ActionFocusLevel { return _actionFocusLevel; }

// Contrast mode focus level — controls per-verse edge cap
const CONTRAST_CAPS = { broad: 15, focused: 8, deep: 3 } as const;
export type ContrastFocusLevel = keyof typeof CONTRAST_CAPS;
let _contrastFocusLevel: ContrastFocusLevel = 'focused';
export function setContrastFocusLevel(level: ContrastFocusLevel): void { _contrastFocusLevel = level; }
export function getContrastFocusLevel(): ContrastFocusLevel { return _contrastFocusLevel; }

// --- Tokenizer ---

const PARTICLES = new Set(['في', 'من', 'الى', 'على', 'عن', 'مع', 'بين', 'ان', 'انما', 'الا', 'لا', 'ما', 'هل', 'قد', 'لن', 'لم', 'اذ', 'اذا', 'كل', 'بعد', 'قبل', 'عند', 'حيث', 'اي', 'كيف', 'متى', 'اين']);
const CONJUNCTIONS = new Set(['و', 'ف', 'ثم', 'او', 'لكن', 'بل', 'حتى', 'ام']);
const PRONOUNS = new Set(['هو', 'هي', 'هم', 'هن', 'انت', 'انتم', 'نحن', 'انا', 'الذي', 'الذين', 'التي', 'ذلك', 'هذا', 'اياك', 'هذه', 'تلك', 'اولئك', 'ما', 'من']);

function classifyPOS(word: string, root: string): POS {
  if (PARTICLES.has(word)) return 'particle';
  if (CONJUNCTIONS.has(word)) return 'conjunction';
  if (PRONOUNS.has(word)) return 'pronoun';
  if (/^[يتان]/.test(word) && root && word.length >= 4) return 'verb';
  if (word.endsWith('وا') && root) return 'verb';
  if (/^(ا[سعقف]|ف[ا])/.test(word) && root && word.length >= 4) return 'verb';
  if (word === 'الله' || word === 'لله') return 'proper_noun';
  return 'noun';
}

function tokenizeVerse(verse: Verse): TokenizedVerse {
  const rawWords = verse.textArabic.trim().split(/\s+/).filter(Boolean);
  const words: Word[] = rawWords.map((text, i) => {
    const clean = stripDiacritics(text);
    const root = _rootLookup.get(clean) ?? '';
    return {
      id: `${verse.id}:${i}`,
      verseId: verse.id,
      text,
      root,
      pos: classifyPOS(clean, root),
      lemma: clean,
    };
  });
  return { verse, words };
}

// --- Data Loading ---

function getTokenizedVerses(): TokenizedVerse[] {
  if (!_tokenizedVerses) {
    _tokenizedVerses = _allVerses.map(tokenizeVerse);
    _tokenizedVerseMap = new Map(_tokenizedVerses.map((tv) => [tv.verse.id, tv]));
  }
  return _tokenizedVerses;
}

/**
 * Guard against stale or malformed IndexedDB cache payloads.
 */
function isCacheUsable(
  cache: SemanticCache,
  rootIndex: RootIndex,
  verseCount: number
): boolean {
  const rootCount = Object.keys(rootIndex).length;
  const totalLinks = cache.verseLinks.length;
  const hasRootLinks = cache.verseLinks.some((l) => l.linkType === 'root');

  if (verseCount > 500 && rootCount > 100 && totalLinks === 0) return false;
  if (rootCount > 100 && !hasRootLinks) return false;

  return true;
}

/**
 * Initialize the semantic engine asynchronously.
 */
export async function initSemanticEngine(): Promise<void> {
  if (_semanticCache && _dataLoaded) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const data = await loadDataFromSupabase();
    _allVerses = data.verses;
    _allConcepts = data.concepts;
    _allConceptDomains = data.conceptDomains;
    _allVerseConcepts = data.verseConcepts;
    _conceptVerseLinks = data.conceptVerseLinks;
    _actionVerseLinks = data.actionVerseLinks;
    _contrastVerseLinks = data.contrastVerseLinks;
    // Build verse → Set<pairId> index for fast search token lookup
    _verseContrastPairsMap = new Map();
    for (const l of _contrastVerseLinks) {
      if (!l.pairId) continue;
      for (const vid of [l.verseA, l.verseB]) {
        if (!_verseContrastPairsMap.has(vid)) _verseContrastPairsMap.set(vid, new Set());
        _verseContrastPairsMap.get(vid)!.add(l.pairId);
      }
    }
    _rootLookup = data.rootLookup;
    _rootTranslations = data.rootTranslations;
    _verseLookup = new Map(data.verses.map((v) => [v.id, v]));
    _surahLookup = new Map(data.surahs.map((s) => [s.number, s]));

    // --- Wire Service A (Linguistic) ---
    setVerseTokens(data.verseTokens);

    // --- Wire Service B (Semantic Domains) ---
    setRootConcepts(data.rootConcepts);
    setConceptGraphEdges(data.conceptGraphEdges);
    setConceptNames(data.concepts.map((c) => ({ id: c.id, name: c.name })));

    _conceptByVerse = new Map();
    for (const vc of data.verseConcepts) {
      if (!_conceptByVerse.has(vc.verseId)) _conceptByVerse.set(vc.verseId, []);
      _conceptByVerse.get(vc.verseId)!.push(vc);
    }

    // --- Build conceptId → ConceptDomain map ---
    const domainById = new Map<string, ConceptDomain>(data.conceptDomains.map((d) => [d.id, d]));
    _conceptDomainMap = new Map();
    for (const c of data.concepts) {
      if (c.domainId) {
        const domain = domainById.get(c.domainId);
        if (domain) _conceptDomainMap.set(c.id, domain);
      }
    }

    // --- Build root → primary concept map (for semantic cluster filtering + radial layout) ---
    // Takes highest-weight concept per root from ayamakna_root_concepts
    const rootConceptBest = new Map<string, { conceptId: string; weight: number }>();
    for (const rc of data.rootConcepts) {
      const existing = rootConceptBest.get(rc.root);
      if (!existing || rc.weight > existing.weight) {
        rootConceptBest.set(rc.root, { conceptId: rc.conceptId, weight: rc.weight });
      }
    }
    _rootConceptMap = new Map([...rootConceptBest.entries()].map(([root, v]) => [root, v.conceptId]));

    _dataLoaded = true;
    _tokenizedVerses = null;

    const verses = getTokenizedVerses();
    _rootIndex = buildRootIndex(verses);

    const cached = await loadCache();
    if (cached && isCacheUsable(cached, _rootIndex, _allVerses.length)) {
      _semanticCache = cached;
      _semanticCache.rootIndex = _rootIndex;
      // Restore verseIdsByRoot from rootIndex (not saved to IndexedDB to save space)
      if (_semanticCache.rootAnalytics) {
        for (const root of Object.keys(_rootIndex)) {
          _semanticCache.rootAnalytics.verseIdsByRoot[root] = _rootIndex[root].verseIds;
        }
      }
      console.log('Semantic cache loaded from IndexedDB');
      return;
    }
    if (cached) {
      console.warn('Ignoring stale/invalid semantic cache; recomputing...');
      await clearCache().catch((err) => console.warn('Failed to clear semantic cache:', err));
    }

    console.log('Computing semantic cache for', _allVerses.length, 'verses...');
    const conceptMap = new Map<string, VerseConcept[]>();
    for (const vc of _allVerseConcepts) {
      if (!conceptMap.has(vc.verseId)) conceptMap.set(vc.verseId, []);
      conceptMap.get(vc.verseId)!.push(vc);
    }

    const cache = runPrecompute(
      verses,
      conceptMap,
      _rootTranslations,
      undefined,
      undefined,
      undefined,
      data.actionEdges.length > 0 ? data.actionEdges : undefined,
      _rootConceptMap,
      data.rootVerseLinks.length > 0 ? data.rootVerseLinks : undefined
    );
    _semanticCache = cache;
    _rootIndex = cache.rootIndex;

    saveCache(cache).catch(console.warn);
    console.log('Semantic cache computed and saved');
  })();

  return _initPromise;
}

function getSemanticCache(): SemanticCache | null {
  return _semanticCache;
}

export function isEngineReady(): boolean {
  return _semanticCache !== null && _dataLoaded;
}

// --- Search Tokens Builder ---

/** Public: build full search tokens for a verse (used for isolated node overlay). */
export function getVerseSearchTokens(verseId: string): string[] {
  const verse = _verseLookup.get(verseId);
  if (!verse) return [];
  const tv = _tokenizedVerseMap.get(verseId);
  return buildSearchTokens(verse, tv);
}

/**
 * Mode-specific search tokens for a verse:
 * - root: root translations/keywords + English/Indonesian translation
 * - concept: concept names (EN/ID) + translation
 * - action: actor labels + verb English meanings + semantic cluster labels + translation
 * - contrast: contrast pair labels (labelA/labelB, e.g. "nur", "kufr", "iman") + translation
 * - similarity: full tokens (same as root)
 */
export function getVerseSearchTokensForMode(verseId: string, mode: SemanticMode): string[] {
  const verse = _verseLookup.get(verseId);
  if (!verse) return [];
  const tv = _tokenizedVerseMap.get(verseId);

  // Base: always include translation tokens
  const base: string[] = [
    ...verse.textTranslation.toLowerCase().split(/\s+/).slice(0, 30),
  ];
  if (verse.textTranslationId) {
    base.push(...verse.textTranslationId.toLowerCase().split(/\s+/).slice(0, 30));
  }

  if (mode === 'root' || mode === 'similarity') {
    // Root mode: root translations + root keywords + verse body translations (EN + ID).
    // Use Service A (ayamakna_verse_tokens) as root source — same as VerseDetail badges.
    const { roots } = getVerseLinguisticRoots(verseId);
    for (const root of roots) {
      const kw = ROOT_KEYWORDS[root];
      if (kw) base.push(...kw.split(' '));
      const tr = _rootTranslations.get(root);
      if (tr) base.push(...tr.toLowerCase().split(/\s+/));
    }
    return base;
  }

  if (mode === 'concept') {
    // Concept mode: ONLY domain names + concept names/keywords — no translation noise.
    const tokens: string[] = [];
    const vcs = _conceptByVerse.get(verseId) ?? [];
    for (const vc of vcs) {
      const concept = _allConcepts.find((c) => c.id === vc.conceptId);
      if (concept) {
        tokens.push(concept.name.toLowerCase(), concept.id.toLowerCase());
        const indoKw = CONCEPT_INDONESIAN[concept.id];
        if (indoKw) tokens.push(...indoKw.split(' '));
        // Include domain name + id so searching "Divine Essence" highlights correctly
        const domain = _conceptDomainMap.get(concept.id);
        if (domain) {
          tokens.push(domain.name.toLowerCase(), domain.id.toLowerCase());
          // Multi-word domain: also push individual words (e.g. "divine", "essence")
          tokens.push(...domain.name.toLowerCase().split(/\s+/));
        }
      }
    }
    return tokens;
  }

  if (mode === 'action') {
    // Action mode: ONLY action family names + canonical action names — no translation noise.
    // This ensures "Worship" highlights verses with worship actions, not verses about worship in translation.
    const cache = getSemanticCache();
    const tokens: string[] = [];
    if (cache) {
      const actions = cache.actionEdges.filter((a) => a.verseId === verseId);
      const seenFamilies = new Set<string>();
      for (const a of actions) {
        // Canonical action name (e.g. "Pray", "Create", "Be Patient")
        const canonical = a.canonicalAction ?? CANONICAL_ACTION_MAP[a.actionRoot];
        if (canonical) tokens.push(...canonical.toLowerCase().split(/[\s/]+/));
        // Action family name + individual words (e.g. "worship", "devotion")
        const family = a.semanticCluster ?? ACTION_FAMILY_MAP[a.actionRoot];
        if (family && !seenFamilies.has(family)) {
          seenFamilies.add(family);
          const label = ACTION_FAMILY_LABELS[family];
          if (label) {
            tokens.push(label.toLowerCase(), family.toLowerCase().replace(/_/g, ' '));
            tokens.push(...label.toLowerCase().split(/\s+/));
          }
          const indo = ACTION_FAMILY_INDONESIAN[family];
          if (indo) tokens.push(...indo.split(' '));
        }
      }
    }
    return tokens;
  }

  if (mode === 'contrast') {
    // Contrast mode: ONLY contrast pair labels + English expansions — no translation noise.
    // This ensures "Light" highlights nur-pair verses, "Faith" highlights iman-pair verses.
    const tokens: string[] = [];
    const pairIds = _verseContrastPairsMap.get(verseId);
    if (pairIds) {
      for (const pairId of pairIds) {
        const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === pairId);
        if (pair) {
          // Transliteration labels (e.g. "nur", "zulumat", "iman", "kufr") + category
          tokens.push(pair.labelA.toLowerCase(), pair.labelB.toLowerCase(), pair.category.toLowerCase());
          // English keyword expansions from CONTRAST_LABEL_ENGLISH
          const kwA = CONTRAST_LABEL_ENGLISH[pair.labelA];
          if (kwA) tokens.push(...kwA.split(' '));
          const kwB = CONTRAST_LABEL_ENGLISH[pair.labelB];
          if (kwB) tokens.push(...kwB.split(' '));
        }
      }
    }
    return tokens;
  }

  return base;
}

function buildSearchTokens(verse: Verse, tv: TokenizedVerse | undefined): string[] {
  const tokens: string[] = [];

  // English translation words
  tokens.push(...verse.textTranslation.toLowerCase().split(/\s+/).slice(0, 30));

  // Indonesian translation words
  if (verse.textTranslationId) {
    tokens.push(...verse.textTranslationId.toLowerCase().split(/\s+/).slice(0, 30));
  }

  // Concept names + Indonesian equivalents
  const vcs = _conceptByVerse.get(verse.id) ?? [];
  for (const vc of vcs) {
    const concept = _allConcepts.find((c) => c.id === vc.conceptId);
    if (concept) {
      tokens.push(concept.name.toLowerCase(), concept.id.toLowerCase());
      const indoKw = CONCEPT_INDONESIAN[concept.id];
      if (indoKw) tokens.push(...indoKw.split(' '));
    }
  }

  // Root keywords (English + transliteration + Indonesian)
  if (tv) {
    const verseRoots = new Set(tv.words.map((w) => w.root).filter(Boolean));
    for (const root of verseRoots) {
      const kw = ROOT_KEYWORDS[root];
      if (kw) tokens.push(...kw.split(' '));
    }
  }

  return tokens;
}

// --- Graph Data Generation ---

export function buildGraphData(mode: SemanticMode): GraphRenderData {
  const cache = getSemanticCache();
  if (!cache) return { nodes: [], edges: [] };

  const edges = getEdgesForMode(mode, cache);

  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(typeof e.source === 'string' ? e.source : e.source.id);
    connectedIds.add(typeof e.target === 'string' ? e.target : e.target.id);
  }

  const linkCounts = new Map<string, number>();
  for (const e of edges) {
    const src = typeof e.source === 'string' ? e.source : e.source.id;
    const tgt = typeof e.target === 'string' ? e.target : e.target.id;
    linkCounts.set(src, (linkCounts.get(src) ?? 0) + 1);
    linkCounts.set(tgt, (linkCounts.get(tgt) ?? 0) + 1);
  }

  // In root mode: compute per-node sum of shared roots across all root edges
  const nodeSharedRoots = new Map<string, number>();
  if (mode === 'root') {
    for (const e of edges) {
      const src = typeof e.source === 'string' ? e.source : e.source.id;
      const tgt = typeof e.target === 'string' ? e.target : e.target.id;
      const count = e.sharedRootsCount ?? 1;
      nodeSharedRoots.set(src, (nodeSharedRoots.get(src) ?? 0) + count);
      nodeSharedRoots.set(tgt, (nodeSharedRoots.get(tgt) ?? 0) + count);
    }
  }

  // In concept mode: compute per-node sum of shared concepts across all concept edges
  const nodeSharedConcepts = new Map<string, number>();
  if (mode === 'concept') {
    for (const e of edges) {
      const src = typeof e.source === 'string' ? e.source : e.source.id;
      const tgt = typeof e.target === 'string' ? e.target : e.target.id;
      const count = e.sharedConceptsCount ?? 1;
      nodeSharedConcepts.set(src, (nodeSharedConcepts.get(src) ?? 0) + count);
      nodeSharedConcepts.set(tgt, (nodeSharedConcepts.get(tgt) ?? 0) + count);
    }
  }

  // In action mode: compute per-node behavioral centrality (sum of sharedActionsCount)
  const nodeSharedActions = new Map<string, number>();
  if (mode === 'action') {
    for (const e of edges) {
      const src = typeof e.source === 'string' ? e.source : e.source.id;
      const tgt = typeof e.target === 'string' ? e.target : e.target.id;
      const count = e.sharedActionsCount ?? 1;
      nodeSharedActions.set(src, (nodeSharedActions.get(src) ?? 0) + count);
      nodeSharedActions.set(tgt, (nodeSharedActions.get(tgt) ?? 0) + count);
    }
  }

  const nodes: GraphNode[] = [];
  for (const id of connectedIds) {
    const verse = _verseLookup.get(id);
    if (!verse) continue;

    const surah = _surahLookup.get(verse.surahId);
    const lc = linkCounts.get(id) ?? 0;
    const tv = _tokenizedVerseMap.get(id);

    // Root density heatmap score (kept for compat)
    const heatScore = cache.rootAnalytics?.densityByVerse[id]?.heatScore;

    // In root mode: compute dominant root for frequency coloring + semantic cluster for radial layout
    let centralityScore: number | undefined;
    let rootVerseFrequency: number | undefined;
    let semanticCluster: string | undefined;
    if (mode === 'root' && tv && cache.rootAnalytics) {
      const rootCounts = new Map<string, number>();
      for (const w of tv.words) {
        if (w.root) rootCounts.set(w.root, (rootCounts.get(w.root) ?? 0) + 1);
      }
      let maxRoot = '', maxCount = 0;
      for (const [root, count] of rootCounts) {
        if (count > maxCount) { maxRoot = root; maxCount = count; }
      }
      centralityScore = cache.rootAnalytics.centralityByRoot[maxRoot]?.importance;
      rootVerseFrequency = cache.rootAnalytics.centralityByRoot[maxRoot]?.verseFrequency;
      semanticCluster = _rootConceptMap.get(maxRoot); // concept ID for radial positioning
    }

    // In concept mode: resolve domain data for the verse's primary concept
    let domainId: string | undefined;
    let domainColorHue: number | undefined;
    let domainOrder: number | undefined;
    if (mode === 'concept') {
      const vcs = _conceptByVerse.get(id);
      if (vcs && vcs.length > 0) {
        let best = vcs[0];
        for (const c of vcs) { if (c.weight > best.weight) best = c; }
        const conceptMeta = _allConcepts.find((c) => c.id === best.conceptId);
        const domain = _conceptDomainMap.get(best.conceptId);
        if (domain) {
          domainId = domain.id;
          domainColorHue = domain.colorHue;
          domainOrder = conceptMeta?.domainOrder ?? 1;
          semanticCluster = domain.id; // radial layout keyed by domain
        }
      }
    }

    // In contrast mode: resolve primary pair, side, hue, and root frequency for bipartite layout
    let contrastSide: 'A' | 'B' | undefined;
    let contrastHue: number | undefined;
    let contrastPairIdx: number | undefined;
    let contrastRootFreq: number | undefined;
    let contrastPairId: string | undefined;
    if (mode === 'contrast') {
      const verseLinks = _contrastVerseLinks.length > 0 ? _contrastVerseLinks : [];
      // Count links per pair involving this verse to find primary pair
      const pairCounts = new Map<string, number>();
      for (const l of verseLinks) {
        if ((l.verseA === id || l.verseB === id) && l.pairId) {
          pairCounts.set(l.pairId, (pairCounts.get(l.pairId) ?? 0) + 1);
        }
      }
      let topPair = ''; let topCount = 0;
      for (const [pid, cnt] of pairCounts) { if (cnt > topCount) { topPair = pid; topCount = cnt; } }
      if (topPair) {
        contrastPairId = topPair;
        // Determine side: if this verse is verseA in any link of this pair → side A, else side B
        const isA = verseLinks.some((l) => l.pairId === topPair && l.verseA === id);
        contrastSide = isA ? 'A' : 'B';
        const hues = CONTRAST_PAIR_HUES[topPair];
        contrastHue = hues ? (isA ? hues.hueA : hues.hueB) : undefined;
        contrastPairIdx = CONTRAST_PAIR_ORDER.indexOf(topPair);
        // Root frequency: total token occurrences of this verse's primary contrast root
        const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === topPair);
        if (pair) {
          const rawRoot = isA ? pair.rootA : pair.rootB;
          const root = CONTRAST_ROOT_ALIASES[rawRoot] ?? rawRoot;
          contrastRootFreq = cache.rootIndex[root]?.count;
        }
        // semanticCluster for bipartite radial layout
        semanticCluster = `${topPair}:${contrastSide}`;
      }
    }

    // In action mode: resolve dominant action family + dominant actor ontology
    let actionFamilyId: string | undefined;
    let actionFamilyHue: number | undefined;
    let actorOntology: string | undefined;
    let actorOntologyHue: number | undefined;
    if (mode === 'action') {
      const dominantFamily = getPrimaryCluster(id, 'action', cache);
      if (dominantFamily !== 'unknown') {
        actionFamilyId = dominantFamily;
        actionFamilyHue = ACTION_FAMILY_HUES[dominantFamily as keyof typeof ACTION_FAMILY_HUES];
        semanticCluster = dominantFamily; // radial layout keyed by action family
      } else {
        // Skip verses with no valid action family — isolate them from the connected graph
        continue;
      }
      // Dominant actor ontology: find most frequent actor across verse's action edges
      const verseActions = cache.actionEdges.filter((a) => a.verseId === id);
      if (verseActions.length > 0) {
        const ontologyCounts = new Map<string, number>();
        for (const a of verseActions) {
          const ont = ACTOR_ONTOLOGY_MAP[a.actorType] ?? 'human';
          ontologyCounts.set(ont, (ontologyCounts.get(ont) ?? 0) + 1);
        }
        let maxOnt = 'human';
        let maxCount = 0;
        for (const [ont, cnt] of ontologyCounts) {
          if (cnt > maxCount) { maxOnt = ont; maxCount = cnt; }
        }
        actorOntology = maxOnt;
        actorOntologyHue = ACTOR_ONTOLOGY_HUES[maxOnt as keyof typeof ACTOR_ONTOLOGY_HUES];
      }
    }

    nodes.push({
      id: verse.id,
      label: `${surah?.name ?? verse.surahId}:${verse.ayahNumber}`,
      labelAr: verse.textArabic.slice(0, 40) + (verse.textArabic.length > 40 ? '...' : ''),
      surahId: verse.surahId,
      ayahNumber: verse.ayahNumber,
      weight: Math.min(1, lc / 10),
      cluster: getPrimaryCluster(verse.id, mode, cache),
      searchTokens: getVerseSearchTokensForMode(verse.id, mode),
      heatScore,
      centralityScore,
      sharedRootsCount: nodeSharedRoots.get(id),
      rootVerseFrequency,
      semanticCluster,
      sharedConceptsCount: nodeSharedConcepts.get(id),
      domainId,
      domainColorHue,
      domainOrder,
      sharedActionsCount: nodeSharedActions.get(id),
      actionFamilyId,
      actionFamilyHue,
      actorOntology,
      actorOntologyHue,
      contrastSide,
      contrastHue,
      contrastPairIdx,
      contrastRootFreq,
      contrastPairId,
    });
  }

  // In action mode: filter out edges that reference nodes skipped due to no valid action family
  const finalEdges = mode === 'action'
    ? (() => {
        const nodeIdSet = new Set(nodes.map((n) => n.id));
        return edges.filter((e) => {
          const src = typeof e.source === 'string' ? e.source : e.source.id;
          const tgt = typeof e.target === 'string' ? e.target : e.target.id;
          return nodeIdSet.has(src) && nodeIdSet.has(tgt);
        });
      })()
    : edges;

  return { nodes, edges: finalEdges };
}

function getPrimaryCluster(
  verseId: string,
  mode: SemanticMode,
  cache: SemanticCache
): string {
  switch (mode) {
    case 'root': {
      const tv = _tokenizedVerseMap.get(verseId);
      if (!tv) return 'unknown';
      const rootCounts = new Map<string, number>();
      for (const w of tv.words) {
        if (w.root) rootCounts.set(w.root, (rootCounts.get(w.root) ?? 0) + 1);
      }
      let maxRoot = '', maxCount = 0;
      for (const [root, count] of rootCounts) {
        if (count > maxCount) { maxRoot = root; maxCount = count; }
      }
      return maxRoot || 'unknown';
    }
    case 'concept': {
      const vcs = _conceptByVerse.get(verseId);
      if (!vcs || vcs.length === 0) return 'unknown';
      let best = vcs[0];
      for (const c of vcs) { if (c.weight > best.weight) best = c; }
      // Return domain_id for radial layout (groups by domain), fall back to concept id
      return _conceptDomainMap.get(best.conceptId)?.id ?? best.conceptId;
    }
    case 'action': {
      const actions = cache.actionEdges.filter((a) => a.verseId === verseId);
      if (actions.length === 0) return 'unknown';
      // Return dominant action family (most frequent among verse's actions)
      const familyCounts = new Map<string, number>();
      for (const a of actions) {
        const fam = a.semanticCluster ?? ACTION_FAMILY_MAP[a.actionRoot];
        if (fam) familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1);
      }
      let topFamily = 'unknown'; let topCount = 0;
      for (const [fam, cnt] of familyCounts) if (cnt > topCount) { topFamily = fam; topCount = cnt; }
      return topFamily;
    }
    case 'contrast': {
      const hasContrast = cache.contrastLinks.some(
        (cl) => cl.verseA === verseId || cl.verseB === verseId
      );
      return hasContrast ? 'contrast' : 'neutral';
    }
    case 'similarity':
      return 'similarity';
    default:
      return 'unknown';
  }
}

function getEdgesForMode(mode: SemanticMode, cache: SemanticCache): GraphEdge[] {
  let links: VerseLink[];

  switch (mode) {
    case 'root': {
      // Per-node edge cap: prevents hairball clusters from hub verses.
      // Top 7 hop=1 (direct) + top 3 hop=2 (multi-hop) edges per node survive.
      // Union rule: edge lives if it is in the top-N for EITHER endpoint.
      const ROOT_HOP1_CAP = 7;
      const ROOT_HOP2_CAP = 3;
      // Similarity threshold applied BEFORE the cap — drops weakly-similar pairs,
      // which removes their exclusive nodes from the graph entirely.
      const minSim = ROOT_FOCUS_THRESHOLDS[_rootFocusLevel];
      const rootLinks = cache.verseLinks.filter(
        (l) => l.linkType === 'root' && l.similarityScore >= minSim
      );

      const hop1ByNode = new Map<string, VerseLink[]>();
      const hop2ByNode = new Map<string, VerseLink[]>();
      for (const l of rootLinks) {
        const bucket = (l.hopCount ?? 1) === 2 ? hop2ByNode : hop1ByNode;
        for (const nodeId of [l.verseA, l.verseB]) {
          if (!bucket.has(nodeId)) bucket.set(nodeId, []);
          bucket.get(nodeId)!.push(l);
        }
      }
      for (const list of hop1ByNode.values()) list.sort((a, b) => b.similarityScore - a.similarityScore);
      for (const list of hop2ByNode.values()) list.sort((a, b) => b.similarityScore - a.similarityScore);

      const survivingLinks = new Set<VerseLink>();
      for (const [, list] of hop1ByNode) for (const l of list.slice(0, ROOT_HOP1_CAP)) survivingLinks.add(l);
      for (const [, list] of hop2ByNode) for (const l of list.slice(0, ROOT_HOP2_CAP)) survivingLinks.add(l);

      links = [...survivingLinks];
      break;
    }
    case 'concept': {
      const minSim = CONCEPT_FOCUS_THRESHOLDS[_conceptFocusLevel];
      // Use preloaded concept verse links when available; fall back to cached similarity links
      const base = _conceptVerseLinks.length > 0
        ? _conceptVerseLinks
        : cache.verseLinks.filter((l) => l.linkType === 'concept');
      // Per-node edge cap: top 10 edges per node (union survival rule)
      const CONCEPT_NODE_CAP = 10;
      const filtered = base.filter((l) => l.similarityScore >= minSim);
      const byNode = new Map<string, VerseLink[]>();
      for (const l of filtered) {
        for (const nodeId of [l.verseA, l.verseB]) {
          if (!byNode.has(nodeId)) byNode.set(nodeId, []);
          byNode.get(nodeId)!.push(l);
        }
      }
      for (const list of byNode.values()) list.sort((a, b) => b.similarityScore - a.similarityScore);
      const surviving = new Set<VerseLink>();
      for (const [, list] of byNode) for (const l of list.slice(0, CONCEPT_NODE_CAP)) surviving.add(l);
      links = [...surviving];
      break;
    }
    case 'action': {
      // Use preloaded action verse links when available (seeded); fall back to cached action links
      const minSim = ACTION_FOCUS_THRESHOLDS[_actionFocusLevel];
      const base = _actionVerseLinks.length > 0
        ? _actionVerseLinks
        : cache.verseLinks.filter((l) => l.linkType === 'action');
      const ACTION_NODE_CAP = 10;
      const filtered = base.filter((l) => l.similarityScore >= minSim);
      const byNode = new Map<string, VerseLink[]>();
      for (const l of filtered) {
        for (const nodeId of [l.verseA, l.verseB]) {
          if (!byNode.has(nodeId)) byNode.set(nodeId, []);
          byNode.get(nodeId)!.push(l);
        }
      }
      for (const list of byNode.values()) list.sort((a, b) => b.similarityScore - a.similarityScore);
      const surviving = new Set<VerseLink>();
      for (const [, list] of byNode) for (const l of list.slice(0, ACTION_NODE_CAP)) surviving.add(l);
      links = [...surviving];
      break;
    }
    case 'contrast': {
      // Use preloaded contrast verse links when available; fall back to cached contrast links.
      // Apply per-verse edge cap (union survival rule) per focus level.
      const cap = CONTRAST_CAPS[_contrastFocusLevel];
      const base = _contrastVerseLinks.length > 0
        ? _contrastVerseLinks
        : cache.verseLinks.filter((l) => l.linkType === 'contrast');
      const byNode = new Map<string, VerseLink[]>();
      for (const l of base) {
        for (const nodeId of [l.verseA, l.verseB]) {
          if (!byNode.has(nodeId)) byNode.set(nodeId, []);
          byNode.get(nodeId)!.push(l);
        }
      }
      for (const list of byNode.values()) list.sort((a, b) => b.similarityScore - a.similarityScore);
      const contrastSurviving = new Set<VerseLink>();
      for (const [, list] of byNode) for (const l of list.slice(0, cap)) contrastSurviving.add(l);
      links = [...contrastSurviving];
      break;
    }
    case 'similarity':
      links = cache.verseLinks;
      break;
    default:
      links = cache.verseLinks;
  }

  return links.map((l) => ({
    source: l.verseA,
    target: l.verseB,
    linkType: l.linkType,
    strength: l.similarityScore,
    sharedRootsCount: l.sharedRootsCount,
    hopCount: l.hopCount,
    sharedConceptsCount: l.sharedConceptsCount,
    sharedActionsCount: l.sharedActionsCount,
  }));
}

// --- Query Helpers ---

export function getVerseById(id: string): Verse | undefined {
  return _verseLookup.get(id);
}

export function getVerseConcepts(verseId: string): Array<{ concept: Concept; weight: number }> {
  const vcs = _conceptByVerse.get(verseId) ?? [];
  return vcs
    .map((vc) => ({
      concept: _allConcepts.find((c) => c.id === vc.conceptId)!,
      weight: vc.weight,
    }))
    .filter((c) => c.concept);
}

export function getVerseActions(verseId: string): ActionEdge[] {
  const cache = getSemanticCache();
  if (!cache) return [];
  return cache.actionEdges.filter((a) => a.verseId === verseId);
}

/** Number of unique verses in the corpus that contain a given action root. */
export function getActionRootVerseCount(root: string): number {
  const cache = getSemanticCache();
  if (!cache) return 0;
  const verseIds = new Set(cache.actionEdges.filter((a) => a.actionRoot === root).map((a) => a.verseId));
  return verseIds.size;
}

/** Set of verse IDs in the corpus that contain a given action root (for graph highlight). */
export function getActionRootVerseIds(root: string): Set<string> {
  const cache = getSemanticCache();
  if (!cache) return new Set();
  return new Set(cache.actionEdges.filter((a) => a.actionRoot === root).map((a) => a.verseId));
}

/** Number of unique verses in the corpus that contain any action in a given action family. */
export function getActionFamilyVerseCount(family: string): number {
  const cache = getSemanticCache();
  if (!cache) return 0;
  const verseIds = new Set(
    cache.actionEdges
      .filter((a) => (a.semanticCluster ?? ACTION_FAMILY_MAP[a.actionRoot]) === family)
      .map((a) => a.verseId)
  );
  return verseIds.size;
}

export function getRootIndex(): RootIndex {
  return getSemanticCache()?.rootIndex ?? {};
}

export function searchVerses(query: string): Verse[] {
  if (!query.trim()) return _allVerses;
  const q = query.toLowerCase();
  return _allVerses.filter(
    (v) =>
      v.textArabic.includes(query) ||
      v.textTranslation.toLowerCase().includes(q) ||
      (v.textTranslationId?.toLowerCase().includes(q) ?? false) ||
      v.id.includes(q)
  );
}

export function getStats(): { verses: number; roots: number; concepts: number; links: number } {
  const cache = getSemanticCache();
  return {
    verses: _allVerses.length,
    roots: cache ? Object.keys(cache.rootIndex).length : 0,
    concepts: _allConcepts.length,
    links: cache?.verseLinks.length ?? 0,
  };
}

export function getSurahList(): SurahInfo[] {
  return [..._surahLookup.values()].sort((a, b) => a.number - b.number);
}

// --- Root Analytics Exports ---

/** Top N roots by token frequency, with verse count */
export function getTopRoots(limit: number = 60): Array<{ root: string; count: number; verseCount: number }> {
  const cache = getSemanticCache();
  if (!cache) return [];
  return Object.values(cache.rootIndex)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => ({ root: r.root, count: r.count, verseCount: r.verseIds.length }));
}

/** Set of verse IDs that contain the given root */
export function getVersesByRoot(root: string): Set<string> {
  const cache = getSemanticCache();
  if (!cache) return new Set();
  return new Set(cache.rootIndex[root]?.verseIds ?? []);
}

/** Root context: forms, POS distribution, Meccan/Medinan */
export function getRootContext(root: string): RootContext | null {
  return getSemanticCache()?.rootAnalytics?.contextsByRoot[root] ?? null;
}

/** Centrality data for a single root */
export function getRootCentrality(root: string): RootCentrality | null {
  return getSemanticCache()?.rootAnalytics?.centralityByRoot[root] ?? null;
}

/** Summary: most connected, bridge, most frequent root */
export function getRootAnalyticsSummary(): RootCentralitySummary | null {
  return getSemanticCache()?.rootAnalytics?.centralitySummary ?? null;
}

// --- Root Intelligence per verse ---

export interface VerseRootInsight {
  root: string;
  translation: string;
  tokenFrequency: number;  // total word-level occurrences in entire corpus
  verseFrequency: number;  // total verses containing this root
  centralityScore?: number;
}

/**
 * Returns root insights for a verse, sorted by token frequency descending.
 *
 * STRICT: Root list comes EXCLUSIVELY from Service A (ayamakna_verse_tokens).
 * The legacy tokenizer (_tokenizedVerseMap) is NOT used here.
 * Frequency + translation metadata is layered on top as read-only decoration.
 */
export function getVerseRootsWithData(verseId: string): VerseRootInsight[] {
  // SERVICE A — authoritative root list (ayamakna_verse_tokens only)
  const { roots } = getVerseLinguisticRoots(verseId);
  const cache = getSemanticCache();
  if (!cache) return [];

  const results: VerseRootInsight[] = [];

  for (const root of roots) {
    // roots from Service A are already Arabic-validated; skip any that slipped through
    const entry = cache.rootIndex[root];
    results.push({
      root,
      translation: _rootTranslations.get(root) ?? '',
      tokenFrequency: entry?.count ?? 0,
      verseFrequency: entry?.verseIds.length ?? 0,
      centralityScore: cache.rootAnalytics?.centralityByRoot[root]?.importance,
    });
  }

  return results.sort((a, b) => b.tokenFrequency - a.tokenFrequency);
}

// --- Action Intelligence Exports ---

/** Compute behavioral summary for a verse's actions. */
export function getVerseActionSummary(verseId: string): ActionSummary | null {
  const actions = getVerseActions(verseId);
  return computeActionSummary(actions);
}

/** Group a verse's actions by semantic cluster, sorted by count descending. */
export function getActionsByCluster(verseId: string): Map<string, ActionEdge[]> {
  const actions = getVerseActions(verseId);
  const grouped = new Map<string, ActionEdge[]>();

  for (const a of actions) {
    const key = a.semanticCluster ?? 'uncategorized';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  return new Map(
    [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)
  );
}

/** Returns all 6236 verses (for isolated verse overlay). */
export function getAllVerses(): Verse[] {
  return _allVerses;
}

// --- Concept Domain Exports ---

/** All 9 concept domains, sorted by display order. */
export function getConceptDomains(): ConceptDomain[] {
  return [..._allConceptDomains].sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Returns the domain for a given concept ID, or undefined if not mapped. */
export function getDomainForConcept(conceptId: string): ConceptDomain | undefined {
  return _conceptDomainMap.get(conceptId);
}

/** Returns the primary domain_id for a verse (based on highest-weight concept). */
export function getPrimaryDomainForVerse(verseId: string): string | undefined {
  const vcs = _conceptByVerse.get(verseId);
  if (!vcs || vcs.length === 0) return undefined;
  let best = vcs[0];
  for (const c of vcs) { if (c.weight > best.weight) best = c; }
  return _conceptDomainMap.get(best.conceptId)?.id;
}

/**
 * Corpus-level frequency statistics for a contrast pair.
 * freqA/freqB = total token occurrences in the Quran for rootA/rootB.
 * Applies CONTRAST_ROOT_ALIASES to resolve DB root names (e.g. ءمن→أمن, نار→نور).
 * Used for Frequency Asymmetry bars in the Contrast Intelligence panel.
 */
export function getContrastTopicStats(pairId: string): {
  freqA: number; freqB: number; ratio: number; dominantSide: 'A' | 'B'; dominanceGap: number;
} | null {
  const cache = getSemanticCache();
  if (!cache) return null;
  const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === pairId);
  if (!pair) return null;
  const resolvedA = CONTRAST_ROOT_ALIASES[pair.rootA] ?? pair.rootA;
  const resolvedB = CONTRAST_ROOT_ALIASES[pair.rootB] ?? pair.rootB;
  const freqA = cache.rootIndex[resolvedA]?.count ?? 0;
  const freqB = cache.rootIndex[resolvedB]?.count ?? 0;
  if (freqA === 0 && freqB === 0) return null;
  const dominantSide: 'A' | 'B' = freqA >= freqB ? 'A' : 'B';
  const dominanceGap = Math.abs(freqA - freqB);
  const ratio = freqB > 0 ? freqA / freqB : freqA;
  return { freqA, freqB, ratio, dominantSide, dominanceGap };
}

/** Returns contrast pairs that involve the given verse, with partner verse IDs, side, and topic stats. */
export function getVerseContrastLinks(verseId: string): Array<{
  pairId: string;
  category: string;
  partnerVerseId: string;
  score: number;
  thisSide: 'A' | 'B';
  topicStats: ReturnType<typeof getContrastTopicStats>;
}> {
  // Prefer preloaded Supabase links (has pairId + category); fall back to cached links
  const base = _contrastVerseLinks.length > 0 ? _contrastVerseLinks : [];
  return base
    .filter((l) => l.verseA === verseId || l.verseB === verseId)
    .slice(0, 20) // cap to avoid flooding VerseDetail
    .map((l) => {
      const thisSide: 'A' | 'B' = l.verseA === verseId ? 'A' : 'B';
      return {
        pairId: l.pairId ?? '',
        category: l.contrastCategory ?? '',
        partnerVerseId: l.verseA === verseId ? l.verseB : l.verseA,
        score: l.similarityScore,
        thisSide,
        topicStats: l.pairId ? getContrastTopicStats(l.pairId) : null,
      };
    });
}

/** Returns top-N most similar verses to the given verse. */
export function getVerseSimilarityLinks(verseId: string, limit: number = 5): Array<{
  partnerVerseId: string; score: number; breakdown: { rootScore: number; conceptScore: number; verbScore: number };
}> {
  const cache = getSemanticCache();
  if (!cache) return [];
  return cache.similarityLinks
    .filter((sl) => sl.verseA === verseId || sl.verseB === verseId)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((sl) => ({
      partnerVerseId: sl.verseA === verseId ? sl.verseB : sl.verseA,
      score: sl.score,
      breakdown: sl.breakdown,
    }));
}

/** Returns the set of verse IDs that are connected in the given mode's graph. */
export function getConnectedVerseIds(mode: SemanticMode): Set<string> {
  const cache = getSemanticCache();
  if (!cache) return new Set();
  const edges = getEdgesForMode(mode, cache);
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(typeof e.source === 'string' ? e.source : (e.source as GraphNode).id);
    ids.add(typeof e.target === 'string' ? e.target : (e.target as GraphNode).id);
  }
  return ids;
}

// =============================================================================
// Two-Layer Root Intelligence API
// =============================================================================

/**
 * SERVICE A — returns roots physically present in the verse.
 * Ground truth. Reads ONLY from ayamakna_verse_tokens.
 */
export function getVerseLinguisticRootsFromStore(verseId: string): string[] {
  return getVerseLinguisticRoots(verseId).roots;
}

/**
 * SERVICE B — returns semantic domains inferred from the verse's roots.
 * Every domain includes a full, validated trace.
 * Rejects domains whose from_root is not in Service A's root list.
 *
 * In development, violations are logged to the console.
 */
export function getVerseSemanticDomains(verseId: string, limit: number = 5) {
  const linguisticRoots = getVerseLinguisticRoots(verseId).roots;
  const domains = _getVerseSemanticDomains(linguisticRoots, limit);

  // Development validation — logs any cross-leakage violations
  if (process.env.NODE_ENV !== 'production') {
    const violations = validateDomains(domains, linguisticRoots);
    if (violations.length > 0) {
      console.warn(`[SemanticDomainService] Validation violations for ${verseId}:`, violations);
    }
  }

  return domains;
}
