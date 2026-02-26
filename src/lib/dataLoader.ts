// =============================================================================
// Data Loader — Fetches AyaMakna data from Supabase
// =============================================================================

import { supabase } from './supabase';
import type { Verse } from '@/engine/linguistic/types';
import type { Concept, ConceptDomain, VerseConcept, ActionEdge, VerseLink } from '@/engine/semantic/types';
import type { ActionFamily, ActionPolarity } from '@/engine/semantic/actionDictionaries';
import { ACTION_FAMILY_MAP, CANONICAL_ACTION_MAP, LEGACY_CLUSTER_MAP } from '@/engine/semantic/actionDictionaries';
import type { VerseToken } from '@/services/linguistic/linguisticService';
import type { RootConceptEntry, ConceptGraphEdge } from '@/services/semantic/semanticDomainService';

export interface SurahInfo {
  number: number;
  name: string;
  nameAr: string;
  totalAyah: number;
}

export interface LoadedData {
  verses: Verse[];
  surahs: SurahInfo[];
  rootLookup: Map<string, string>;
  rootTranslations: Map<string, string>;
  concepts: Concept[];
  conceptDomains: ConceptDomain[];
  verseConcepts: VerseConcept[];
  actionEdges: ActionEdge[];
  // Service A — Linguistic layer
  verseTokens: VerseToken[];
  // Service B — Semantic layer
  rootConcepts: RootConceptEntry[];
  conceptGraphEdges: ConceptGraphEdge[];
  // Precomputed root verse links (from ayamakna_root_verse_links)
  rootVerseLinks: VerseLink[];
  // Precomputed concept verse links (from ayamakna_concept_verse_links)
  conceptVerseLinks: VerseLink[];
  // Precomputed action verse links (from ayamakna_action_verse_links)
  actionVerseLinks: VerseLink[];
  // Precomputed contrast verse links (from ayamakna_contrast_verse_links)
  contrastVerseLinks: VerseLink[];
}

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) {
      done = true;
    } else {
      all.push(...(data as T[]));
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }

  return all;
}

export async function loadDataFromSupabase(): Promise<LoadedData> {
  console.time('supabase:load');

  const [rawVerses, rawSurahs, rawRoots, rawRootTrans, rawConcepts, rawConceptDomains, rawVC, rawActionEdges, rawVerseTokens, rawRootConcepts, rawConceptEdges, rawRootVerseLinks, rawConceptVerseLinks, rawActionVerseLinks, rawContrastVerseLinks] = await Promise.all([
    fetchAll<{ id: string; surah_id: number; ayah_number: number; text_arabic: string; text_translation: string; text_translation_id: string | null }>(
      'ayamakna_verses', 'id,surah_id,ayah_number,text_arabic,text_translation,text_translation_id'
    ),
    fetchAll<{ number: number; name: string; name_ar: string; total_ayah: number }>(
      'ayamakna_surahs', 'number,name,name_ar,total_ayah'
    ),
    fetchAll<{ word: string; root: string }>(
      'ayamakna_root_lookups', 'word,root'
    ),
    fetchAll<{ root: string; translation: string }>(
      'ayamakna_root_translations', 'root,translation'
    ),
    fetchAll<{ id: string; name: string; name_ar: string | null; description: string; domain_id: string | null; domain_order: number | null }>(
      'ayamakna_concepts', 'id,name,name_ar,description,domain_id,domain_order'
    ),
    fetchAll<{ id: string; name: string; name_id: string | null; description: string; color_hue: number; display_order: number }>(
      'ayamakna_concept_domains', 'id,name,name_id,description,color_hue,display_order'
    ),
    fetchAll<{ verse_id: string; concept_id: string; weight: number }>(
      'ayamakna_verse_concepts', 'verse_id,concept_id,weight'
    ),
    fetchAll<{
      id: string; verse_id: string; actor_type: string; action_root: string;
      target_type: string | null; tense: string; verb_text: string;
      english_meaning: string | null; root_frequency: number | null;
      semantic_cluster: string | null; polarity: string;
    }>(
      'ayamakna_action_edges', 'id,verse_id,actor_type,action_root,target_type,tense,verb_text,english_meaning,root_frequency,semantic_cluster,polarity'
    ),
    // Service A — Linguistic layer: verse tokens (ground truth)
    fetchAll<{ id: string; verse_id: string; surface: string; lemma: string; root: string | null; pos: string | null; position: number }>(
      'ayamakna_verse_tokens', 'id,verse_id,surface,lemma,root,pos,position'
    ),
    // Service B — Semantic layer: root→concept associations
    fetchAll<{ root: string; concept_id: string; weight: number; verse_count: number }>(
      'ayamakna_root_concepts', 'root,concept_id,weight,verse_count'
    ),
    // Service B — Semantic layer: concept co-occurrence graph
    fetchAll<{ concept_a: string; concept_b: string; strength: number; shared_verse_count: number }>(
      'ayamakna_concept_graph_edges', 'concept_a,concept_b,strength,shared_verse_count'
    ),
    // Precomputed root verse links (direct hop=1 + multi-hop hop=2 via concept neighbor)
    fetchAll<{ verse_a_id: string; verse_b_id: string; shared_roots_count: number; semantic_cluster: string; similarity_score: number; hop_count: number }>(
      'ayamakna_root_verse_links', 'verse_a_id,verse_b_id,shared_roots_count,semantic_cluster,similarity_score,hop_count'
    ),
    // Precomputed concept verse links (pure concept Jaccard connections)
    fetchAll<{ verse_a_id: string; verse_b_id: string; shared_concepts_count: number; primary_concept_id: string | null; domain_id: string | null; similarity_score: number }>(
      'ayamakna_concept_verse_links', 'verse_a_id,verse_b_id,shared_concepts_count,primary_concept_id,domain_id,similarity_score'
    ),
    // Precomputed action verse links (behavioral pattern connections)
    fetchAll<{ verse_a_id: string; verse_b_id: string; shared_actions_count: number; primary_action_family: string | null; similarity_score: number }>(
      'ayamakna_action_verse_links', 'verse_a_id,verse_b_id,shared_actions_count,primary_action_family,similarity_score'
    ).catch(() => [] as { verse_a_id: string; verse_b_id: string; shared_actions_count: number; primary_action_family: string | null; similarity_score: number }[]),
    // Precomputed contrast verse links (bipartite cross-pole connections)
    fetchAll<{ verse_a_id: string; verse_b_id: string; pair_id: string; category: string; contrast_strength: number }>(
      'ayamakna_contrast_verse_links', 'verse_a_id,verse_b_id,pair_id,category,contrast_strength'
    ).catch(() => [] as { verse_a_id: string; verse_b_id: string; pair_id: string; category: string; contrast_strength: number }[]),
  ]);

  // Map Supabase column names → app types
  const verses: Verse[] = rawVerses.map((v) => ({
    id: v.id,
    surahId: v.surah_id,
    ayahNumber: v.ayah_number,
    textArabic: v.text_arabic,
    textTranslation: v.text_translation,
    textTranslationId: v.text_translation_id ?? undefined,
  }));

  const surahs: SurahInfo[] = rawSurahs.map((s) => ({
    number: s.number,
    name: s.name,
    nameAr: s.name_ar,
    totalAyah: s.total_ayah,
  }));

  // Build root lookup map with diacritics stripped from keys
  const rootLookup = new Map<string, string>();
  for (const r of rawRoots) {
    rootLookup.set(r.word.replace(DIACRITICS, ''), r.root);
  }

  // Build root translation map (Arabic root → English conceptual meaning)
  const rootTranslations = new Map<string, string>();
  for (const r of rawRootTrans) {
    rootTranslations.set(r.root, r.translation);
  }

  const concepts: Concept[] = rawConcepts.map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.name_ar ?? undefined,
    description: c.description,
    domainId: c.domain_id ?? undefined,
    domainOrder: c.domain_order ?? undefined,
  }));

  const conceptDomains: ConceptDomain[] = rawConceptDomains.map((d) => ({
    id: d.id,
    name: d.name,
    nameId: d.name_id ?? undefined,
    description: d.description,
    colorHue: d.color_hue,
    displayOrder: d.display_order,
  }));

  const verseConcepts: VerseConcept[] = rawVC.map((vc) => ({
    verseId: vc.verse_id,
    conceptId: vc.concept_id,
    weight: vc.weight,
  }));

  // Map action edges from Supabase → ActionEdge[]
  // Filter: only keep edges with a resolved semantic family to remove falsely-detected non-verbs
  // (noun roots like شيأ/يوم/نفس that passed the weak POS heuristic during seeding are excluded)
  const actionEdges: ActionEdge[] = rawActionEdges.map((a) => ({
    id: a.id,
    verseId: a.verse_id,
    actorType: a.actor_type as ActionEdge['actorType'],
    actionRoot: a.action_root,
    targetType: a.target_type ?? undefined,
    tense: a.tense as ActionEdge['tense'],
    verbText: a.verb_text,
    englishMeaning: a.english_meaning ?? '',
    rootFrequency: a.root_frequency ?? 0,
    // Normalize DB cluster: legacy 10-cluster IDs → new 12-family IDs, then fall back to root map
    semanticCluster: (
      (a.semantic_cluster ? (LEGACY_CLUSTER_MAP[a.semantic_cluster] ?? (ACTION_FAMILY_MAP[a.action_root] ?? undefined)) : ACTION_FAMILY_MAP[a.action_root])
    ) as ActionFamily | undefined,
    canonicalAction: CANONICAL_ACTION_MAP[a.action_root] ?? undefined,
    polarity: (a.polarity ?? 'neutral') as ActionPolarity,
  })).filter((a) => a.semanticCluster !== undefined);

  // Map Service A data: verse_tokens
  const verseTokens: VerseToken[] = rawVerseTokens.map((t) => ({
    id: t.id,
    verseId: t.verse_id,
    surface: t.surface,
    lemma: t.lemma,
    root: t.root,
    pos: t.pos,
    position: t.position,
  }));

  // Map Service B data: root_concepts
  const rootConcepts: RootConceptEntry[] = rawRootConcepts.map((r) => ({
    root: r.root,
    conceptId: r.concept_id,
    weight: r.weight,
    verseCount: r.verse_count,
  }));

  // Map Service B data: concept_graph_edges
  const conceptGraphEdges: ConceptGraphEdge[] = rawConceptEdges.map((e) => ({
    conceptA: e.concept_a,
    conceptB: e.concept_b,
    strength: e.strength,
    sharedVerseCount: e.shared_verse_count,
  }));

  // Map precomputed root verse links → VerseLink[]
  const rootVerseLinks: VerseLink[] = rawRootVerseLinks.map((r) => ({
    verseA: r.verse_a_id,
    verseB: r.verse_b_id,
    similarityScore: r.similarity_score,
    linkType: 'root',
    sharedRootsCount: r.shared_roots_count,
    semanticCluster: r.semantic_cluster,
    hopCount: r.hop_count ?? 1,
  }));

  // Map precomputed concept verse links → VerseLink[]
  const conceptVerseLinks: VerseLink[] = rawConceptVerseLinks.map((r) => ({
    verseA: r.verse_a_id,
    verseB: r.verse_b_id,
    similarityScore: r.similarity_score,
    linkType: 'concept',
    sharedConceptsCount: r.shared_concepts_count,
    semanticCluster: r.primary_concept_id ?? undefined,
    domainId: r.domain_id ?? undefined,
  }));

  // Map precomputed action verse links → VerseLink[]
  const actionVerseLinks: VerseLink[] = (rawActionVerseLinks as { verse_a_id: string; verse_b_id: string; shared_actions_count: number; primary_action_family: string | null; similarity_score: number }[]).map((r) => ({
    verseA: r.verse_a_id,
    verseB: r.verse_b_id,
    similarityScore: r.similarity_score,
    linkType: 'action',
    sharedActionsCount: r.shared_actions_count,
    semanticCluster: r.primary_action_family ?? undefined,
  }));

  // Map precomputed contrast verse links → VerseLink[]
  const contrastVerseLinks: VerseLink[] = (rawContrastVerseLinks as { verse_a_id: string; verse_b_id: string; pair_id: string; category: string; contrast_strength: number }[]).map((r) => ({
    verseA: r.verse_a_id,
    verseB: r.verse_b_id,
    similarityScore: r.contrast_strength,
    linkType: 'contrast',
    pairId: r.pair_id,
    contrastCategory: r.category,
  }));

  console.timeEnd('supabase:load');
  console.log(
    `Loaded: ${verses.length} verses, ${surahs.length} surahs, ${rootLookup.size} roots, ` +
    `${rootTranslations.size} root translations, ${concepts.length} concepts (${conceptDomains.length} domains), ` +
    `${verseConcepts.length} verse-concepts, ${actionEdges.length} action edges, ` +
    `${verseTokens.length} verse tokens, ${rootConcepts.length} root-concepts, ` +
    `${conceptGraphEdges.length} concept graph edges, ${rootVerseLinks.length} root verse links, ` +
    `${conceptVerseLinks.length} concept verse links, ${actionVerseLinks.length} action verse links`
  );

  return { verses, surahs, rootLookup, rootTranslations, concepts, conceptDomains, verseConcepts, actionEdges, verseTokens, rootConcepts, conceptGraphEdges, rootVerseLinks, conceptVerseLinks, actionVerseLinks, contrastVerseLinks };
}
