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
  ActionEdge,
  ActionSummary,
  RootIndex,
  RootContext,
  RootCentrality,
  RootCentralitySummary,
} from '@/engine/semantic/types';
import type { SemanticCluster } from '@/engine/semantic/actionDictionaries';
import type { GraphNode, GraphEdge, GraphRenderData } from '@/engine/visualization/types';

import { stripDiacritics } from '@/engine/linguistic/rootExtractor';
import { buildRootIndex } from '@/engine/semantic/rootEngine';
import { computeActionSummary } from '@/engine/semantic/actionEngine';
import { runPrecompute, loadCache, saveCache, clearCache } from '@/engine/semantic/precompute';
import { loadDataFromSupabase } from '@/lib/dataLoader';
import type { SurahInfo } from '@/lib/dataLoader';

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
let _allVerseConcepts: VerseConcept[] = [];
let _rootLookup: Map<string, string> = new Map();
let _verseLookup: Map<string, Verse> = new Map();
let _surahLookup: Map<number, SurahInfo> = new Map();
let _conceptByVerse: Map<string, VerseConcept[]> = new Map();
let _tokenizedVerses: TokenizedVerse[] | null = null;
let _tokenizedVerseMap: Map<string, TokenizedVerse> = new Map();
let _semanticCache: SemanticCache | null = null;
let _initPromise: Promise<void> | null = null;
let _rootIndex: RootIndex | null = null;
let _dataLoaded = false;

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
    _allVerseConcepts = data.verseConcepts;
    _rootLookup = data.rootLookup;
    _rootTranslations = data.rootTranslations;
    _verseLookup = new Map(data.verses.map((v) => [v.id, v]));
    _surahLookup = new Map(data.surahs.map((s) => [s.number, s]));

    _conceptByVerse = new Map();
    for (const vc of data.verseConcepts) {
      if (!_conceptByVerse.has(vc.verseId)) _conceptByVerse.set(vc.verseId, []);
      _conceptByVerse.get(vc.verseId)!.push(vc);
    }

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

    const cache = runPrecompute(verses, conceptMap, _rootTranslations, undefined, undefined, undefined, data.actionEdges.length > 0 ? data.actionEdges : undefined);
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

  const nodes: GraphNode[] = [];
  for (const id of connectedIds) {
    const verse = _verseLookup.get(id);
    if (!verse) continue;

    const surah = _surahLookup.get(verse.surahId);
    const lc = linkCounts.get(id) ?? 0;
    const tv = _tokenizedVerseMap.get(id);

    // Root density heatmap score
    const heatScore = cache.rootAnalytics?.densityByVerse[id]?.heatScore;

    // Centrality score from dominant root in this verse
    let centralityScore: number | undefined;
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
    }

    nodes.push({
      id: verse.id,
      label: `${surah?.name ?? verse.surahId}:${verse.ayahNumber}`,
      labelAr: verse.textArabic.slice(0, 40) + (verse.textArabic.length > 40 ? '...' : ''),
      surahId: verse.surahId,
      ayahNumber: verse.ayahNumber,
      weight: Math.min(1, lc / 10),
      cluster: getPrimaryCluster(verse.id, mode, cache),
      searchTokens: buildSearchTokens(verse, tv),
      heatScore,
      centralityScore,
    });
  }

  return { nodes, edges };
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
      const concepts = _conceptByVerse.get(verseId);
      if (!concepts || concepts.length === 0) return 'unknown';
      let best = concepts[0];
      for (const c of concepts) { if (c.weight > best.weight) best = c; }
      return best.conceptId;
    }
    case 'action': {
      const actions = cache.actionEdges.filter((a) => a.verseId === verseId);
      if (actions.length === 0) return 'unknown';
      return actions[0].actorType;
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
    case 'root':
      links = cache.verseLinks.filter((l) => l.linkType === 'root');
      break;
    case 'concept':
      links = cache.verseLinks.filter((l) => l.linkType === 'concept');
      break;
    case 'action':
      links = cache.verseLinks.filter((l) => l.linkType === 'action');
      break;
    case 'contrast':
      links = cache.verseLinks.filter((l) => l.linkType === 'contrast');
      break;
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
 * Returns precomputed root insights for a verse, sorted by token frequency descending.
 * Uses only cached data — no runtime computation.
 */
export function getVerseRootsWithData(verseId: string): VerseRootInsight[] {
  const tv = _tokenizedVerseMap.get(verseId);
  if (!tv) return [];
  const cache = getSemanticCache();
  if (!cache) return [];

  const seen = new Set<string>();
  const results: VerseRootInsight[] = [];

  for (const w of tv.words) {
    if (!w.root || seen.has(w.root)) continue;
    seen.add(w.root);
    const entry = cache.rootIndex[w.root];
    if (!entry) continue;
    results.push({
      root: w.root,
      translation: _rootTranslations.get(w.root) ?? '',
      tokenFrequency: entry.count,
      verseFrequency: entry.verseIds.length,
      centralityScore: cache.rootAnalytics?.centralityByRoot[w.root]?.importance,
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
