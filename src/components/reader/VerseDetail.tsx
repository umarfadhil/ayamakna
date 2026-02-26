import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Swords, Dna, Scale, Brain } from 'lucide-react';
import type { Verse } from '@/engine/linguistic/types';
import type { ActionEdge, ActionSummary, SemanticMode } from '@/engine/semantic/types';
import type { Concept } from '@/engine/semantic/types';
import type { ActionFamily } from '@/engine/semantic/actionDictionaries';
import {
  ACTION_FAMILY_HUES,
  ACTION_FAMILY_LABELS,
} from '@/engine/semantic/actionDictionaries';
import { computeActionSummary } from '@/engine/semantic/actionEngine';
import type { VerseRootInsight } from '@/store/semanticStore';
import {
  getVerseById,
  getSurahList,
  getDomainForConcept,
  getActionRootVerseCount,
} from '@/store/semanticStore';
import { CONTRAST_DICTIONARY, CONTRAST_PAIR_HUES } from '@/engine/semantic/contrastEngine';

interface ContrastLinkData {
  pairId: string;
  category: string;
  partnerVerseId: string;
  score: number;
  thisSide: 'A' | 'B';
  topicStats: {
    freqA: number; freqB: number; ratio: number; dominantSide: 'A' | 'B'; dominanceGap: number;
  } | null;
}

interface SimilarityLinkData {
  partnerVerseId: string;
  score: number;
  breakdown: { rootScore: number; conceptScore: number; verbScore: number };
}

interface VerseDetailProps {
  isOpen: boolean;
  onClose: () => void;
  verse?: Verse;
  surahName: string;
  concepts: Array<{ concept: Concept; weight: number }>;
  actions: ActionEdge[];
  actionSummary?: ActionSummary | null;
  mode: SemanticMode;
  verseRoots?: VerseRootInsight[];
  searchQuery?: string;
  contrastLinks?: ContrastLinkData[];
  similarityLinks?: SimilarityLinkData[];
  onActionFilter?: (actionRoot: string) => void;
}

// --- Root Badge ---

function getRootBadgeClass(verseFrequency: number): string {
  if (verseFrequency >= 500)
    return 'border-border/25 bg-white/5 text-muted-foreground/80';
  if (verseFrequency >= 150)
    return 'border-yellow-400/20 bg-yellow-400/8 text-yellow-400/80';
  if (verseFrequency >= 40)
    return 'border-yellow-400/35 bg-yellow-400/12 text-yellow-300';
  return 'border-orange-400/45 bg-orange-400/15 text-orange-300';
}

const RootBadge: React.FC<{ insight: VerseRootInsight; searchQuery?: string }> = ({ insight, searchQuery }) => {
  const [showTip, setShowTip] = useState(false);
  const label = insight.translation || insight.root;
  const badgeClass = getRootBadgeClass(insight.verseFrequency);

  // Highlight if searchQuery matches label, root, or any keyword
  const q = searchQuery?.toLowerCase() ?? '';
  const isMatch = q.length > 0 && (
    label.toLowerCase().includes(q) ||
    insight.root.toLowerCase().includes(q)
  );

  return (
    <span className="relative inline-block">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-default select-none transition-all ${badgeClass} ${
          isMatch ? 'ring-2 ring-yellow-400/70 bg-yellow-400/15 scale-105' : ''
        }`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <span>{label}</span>
        <span className="opacity-60 text-[10px]">{insight.tokenFrequency}×</span>
        {insight.verseFrequency < 40 && (
          <span className="w-1 h-1 rounded-full bg-orange-400/70 ml-0.5" />
        )}
      </span>

      {showTip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 flex flex-col gap-0.5 glass-panel px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap pointer-events-none"
          style={{ minWidth: '140px' }}
        >
          <span className="font-arabic text-primary text-sm leading-relaxed">{insight.root}</span>
          <span className="text-muted-foreground">{insight.verseFrequency} verses in Qur'an</span>
          {insight.centralityScore != null && (
            <span className="text-muted-foreground/70">
              Centrality: {Math.round(insight.centralityScore * 100)}%
            </span>
          )}
        </span>
      )}
    </span>
  );
};

// --- Behavioral Summary Panel ---

const ActionBehavioralSummary: React.FC<{
  summary: ActionSummary;
  actions: ActionEdge[];
  onActionFilter?: (actionRoot: string) => void;
}> = ({ summary, actions, onActionFilter }) => {
  const familyLabel = summary.dominantCluster
    ? (ACTION_FAMILY_LABELS[summary.dominantCluster as ActionFamily] ?? summary.dominantCluster)
    : '—';
  const familyHue = summary.dominantCluster
    ? (ACTION_FAMILY_HUES[summary.dominantCluster as ActionFamily] ?? null)
    : null;

  // Deduplicated action list (by canonical name), max 10
  const uniqueActions = useMemo(() => {
    const seen = new Set<string>();
    return actions.filter((a) => {
      const canonical = a.canonicalAction ?? a.englishMeaning ?? a.actionRoot;
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    }).slice(0, 10);
  }, [actions]);

  return (
    <div className="rounded-lg border border-green-400/15 bg-green-400/5 p-3 space-y-2.5">
      <h4 className="text-[10px] font-medium text-green-400/70 uppercase tracking-wider">
        Behavioral Summary
      </h4>

      {/* Category */}
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground/60 text-[9px] uppercase">Category</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          {familyHue != null && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: `hsl(${familyHue}, 55%, 48%)` }} />
          )}
          <span className="text-foreground/85 font-medium">{familyLabel}</span>
        </span>
      </div>

      {/* Actions */}
      {uniqueActions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground/60 text-[9px] uppercase">Actions</span>
          <div className="flex flex-col gap-1">
            {uniqueActions.map((a) => {
              const canonical = a.canonicalAction ?? a.englishMeaning ?? a.actionRoot;
              const rootVerseCount = getActionRootVerseCount(a.actionRoot);
              return (
                <div key={a.id} className="flex items-center gap-2 text-xs group">
                  {a.verbText && (
                    <span className="font-arabic text-foreground/85 text-sm leading-tight flex-shrink-0">
                      {a.verbText}
                    </span>
                  )}
                  <span className="text-foreground/70">{canonical}</span>
                  {rootVerseCount > 0 && onActionFilter && (
                    <button
                      onClick={() => onActionFilter(a.actionRoot)}
                      className="ml-auto text-[9px] text-muted-foreground/40 hover:text-green-400/70 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Highlight ${rootVerseCount} verses with this root`}
                    >
                      {rootVerseCount} verses ↗
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};



// --- Main Component ---

const VerseDetail: React.FC<VerseDetailProps> = ({
  isOpen,
  onClose,
  verse,
  surahName,
  concepts,
  actions,
  actionSummary,
  mode,
  verseRoots,
  searchQuery,
  contrastLinks = [],
  similarityLinks = [],
  onActionFilter,
}) => {
  const surahList = useMemo(() => getSurahList(), []);
  const surahMap = useMemo(() => new Map(surahList.map((s) => [s.number, s.name])), [surahList]);

  // Compute summary from actions if not provided
  const summary = useMemo(
    () => actionSummary ?? computeActionSummary(actions),
    [actionSummary, actions]
  );

  if (!verse) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 w-full max-w-md glass-panel-strong border-l border-border/50 overflow-y-auto"
          style={{ zIndex: 40 }}
        >
          {/* Header */}
          <div className="sticky top-0 glass-panel border-b border-border/30 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {surahName} : {verse.ayahNumber}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">{verse.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Arabic Text */}
            <div>
              <div
                className="text-2xl font-arabic leading-loose text-foreground/95 text-right"
                dir="rtl"
              >
                {verse.textArabic}
              </div>
            </div>

            {/* Translation — English */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="text-[10px] border border-border/40 rounded px-1 py-0.5 text-muted-foreground/70">EN</span>
                Translation
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {verse.textTranslation}
              </p>
            </div>

            {/* Translation — Bahasa Indonesia */}
            {verse.textTranslationId && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="text-[10px] border border-border/40 rounded px-1 py-0.5 text-muted-foreground/70">ID</span>
                  Terjemahan
                </h3>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {verse.textTranslationId}
                </p>
              </div>
            )}

            {/* Root Intelligence */}
            {verseRoots && verseRoots.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Dna className="w-3.5 h-3.5 text-yellow-400/80" />
                  Root Intelligence
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {verseRoots.map((insight) => (
                    <RootBadge key={insight.root} insight={insight} searchQuery={searchQuery} />
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-2">
                  Sorted by corpus frequency · <span className="text-orange-400/60">●</span> rare root · Hover for details
                </p>
              </div>
            )}

            {/* Concepts Intelligence */}
            {concepts.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Concepts Intelligence
                </h3>
                <div className="flex flex-wrap gap-2">
                  {concepts.map(({ concept, weight }) => {
                    const q = searchQuery?.toLowerCase() ?? '';
                    const domain = getDomainForConcept(concept.id);
                    const isConceptMatch = q.length > 0 && (
                      concept.name.toLowerCase().includes(q) ||
                      concept.id.toLowerCase().includes(q) ||
                      (concept.nameAr?.includes(searchQuery ?? '') ?? false) ||
                      (domain?.name.toLowerCase().includes(q) ?? false) ||
                      (domain?.id.toLowerCase().includes(q) ?? false)
                    );
                    // Domain dot color — uses HSL hue from domain
                    const dotStyle = domain
                      ? { backgroundColor: `hsla(${domain.colorHue}, 70%, 55%, 0.9)` }
                      : undefined;
                    return (
                      <span
                        key={concept.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-blue-400/20 bg-blue-400/10 text-blue-300 transition-all ${
                          isConceptMatch ? 'ring-2 ring-blue-400/70 bg-blue-400/20 scale-105' : ''
                        }`}
                        title={domain ? `${domain.name} — ${concept.description}` : concept.description}
                      >
                        {/* Domain indicator dot */}
                        {domain && (
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={dotStyle}
                            title={domain.name}
                          />
                        )}
                        {concept.nameAr && (
                          <span className="font-arabic text-[11px]">{concept.nameAr}</span>
                        )}
                        <span>{concept.name}</span>
                        <span className="text-blue-400/50 text-[10px]">
                          {Math.round(weight * 100)}%
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Intelligence */}
            {actions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-green-400" />
                  Action Intelligence
                  <span className="text-muted-foreground/40 text-[10px] normal-case ml-1">{actions.length} actions</span>
                </h3>

                {/* Behavioral Summary */}
                {summary && (
                  <ActionBehavioralSummary
                    summary={summary}
                    actions={actions}
                    onActionFilter={onActionFilter}
                  />
                )}
              </div>
            )}

            {/* Contrast Intelligence */}
            {contrastLinks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-red-400/80" />
                  Contrast Intelligence
                </h3>
                <div className="space-y-3">
                  {(() => {
                    // Group by pairId — one card per pair with freq asymmetry + partner list
                    const seenPairs = new Map<string, ContrastLinkData>();
                    const pairPartners = new Map<string, ContrastLinkData[]>();
                    for (const cl of contrastLinks) {
                      if (!seenPairs.has(cl.pairId)) seenPairs.set(cl.pairId, cl);
                      if (!pairPartners.has(cl.pairId)) pairPartners.set(cl.pairId, []);
                      pairPartners.get(cl.pairId)!.push(cl);
                    }
                    return [...seenPairs.entries()].map(([pairId, firstLink]) => {
                      const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === pairId);
                      const hues = CONTRAST_PAIR_HUES[pairId];
                      const hueA = hues?.hueA ?? 43;
                      const hueB = hues?.hueB ?? 270;
                      const stats = firstLink.topicStats;
                      const thisSide = firstLink.thisSide;
                      const myHue = thisSide === 'A' ? hueA : hueB;
                      const oppHue = thisSide === 'A' ? hueB : hueA;
                      const myLabel = thisSide === 'A' ? (pair?.labelA ?? 'A') : (pair?.labelB ?? 'B');
                      const oppLabel = thisSide === 'A' ? (pair?.labelB ?? 'B') : (pair?.labelA ?? 'A');
                      const partners = pairPartners.get(pairId) ?? [];
                      const maxFreq = stats ? Math.max(stats.freqA, stats.freqB, 1) : 1;
                      const barA = stats ? (stats.freqA / maxFreq) * 100 : 50;
                      const barB = stats ? (stats.freqB / maxFreq) * 100 : 50;
                      const ratioDisplay = stats
                        ? (stats.ratio >= 1
                          ? `${stats.ratio.toFixed(2)}:1`
                          : `1:${(1 / stats.ratio).toFixed(2)}`)
                        : null;
                      return (
                        <div key={pairId} className="rounded-lg border border-border/20 bg-white/[0.02] p-3 space-y-3">
                          {/* Pair header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: `hsla(${hueA}, 75%, 65%, 1)` }}>
                                {pair?.labelA ?? '—'}
                              </span>
                              <span className="text-muted-foreground/35 text-xs">↔</span>
                              <span className="text-sm font-medium" style={{ color: `hsla(${hueB}, 75%, 65%, 1)` }}>
                                {pair?.labelB ?? '—'}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground/45 uppercase tracking-wider border border-border/25 rounded px-1.5 py-0.5">
                              {pair?.category ?? firstLink.category}
                            </span>
                          </div>

                          {/* Side indicator */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `hsla(${myHue}, 70%, 55%, 1)` }} />
                            <span className="text-muted-foreground/55">This verse is on the</span>
                            <span className="font-semibold" style={{ color: `hsla(${myHue}, 75%, 65%, 1)` }}>{myLabel}</span>
                            <span className="text-muted-foreground/55">side</span>
                          </div>

                          {/* Frequency Asymmetry bars */}
                          {stats && (
                            <div className="space-y-2">
                              <div className="text-[9px] text-muted-foreground/45 uppercase tracking-wider">
                                Frequency Asymmetry
                              </div>
                              {/* Bar A */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px]">
                                  <span style={{ color: `hsla(${hueA}, 70%, 65%, 1)` }}>{pair?.labelA}</span>
                                  <span className="text-muted-foreground/55">{stats.freqA} verses</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${barA}%`, backgroundColor: `hsla(${hueA}, 65%, 50%, 0.75)` }}
                                  />
                                </div>
                              </div>
                              {/* Bar B */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px]">
                                  <span style={{ color: `hsla(${hueB}, 70%, 65%, 1)` }}>{pair?.labelB}</span>
                                  <span className="text-muted-foreground/55">{stats.freqB} verses</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${barB}%`, backgroundColor: `hsla(${hueB}, 65%, 50%, 0.75)` }}
                                  />
                                </div>
                              </div>
                              {/* Stats row */}
                              <div className="flex gap-2.5 text-[9px] text-muted-foreground/45 pt-0.5 flex-wrap">
                                <span>Gap: {stats.dominanceGap > 0 ? '+' : ''}{stats.dominanceGap}</span>
                                <span>·</span>
                                <span>Ratio: {ratioDisplay}</span>
                                <span>·</span>
                                <span>
                                  Dominant:{' '}
                                  <span style={{ color: `hsla(${stats.dominantSide === 'A' ? hueA : hueB}, 70%, 65%, 1)` }}>
                                    {stats.dominantSide === 'A' ? (pair?.labelA ?? 'A') : (pair?.labelB ?? 'B')}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Partner verses */}
                          {partners.slice(0, 3).map((cl) => {
                            const partner = getVerseById(cl.partnerVerseId);
                            const partnerSurah = partner ? (surahMap.get(partner.surahId) ?? partner.surahId) : '';
                            return (
                              <div key={cl.partnerVerseId} className="border-t border-border/15 pt-2 text-[10px]">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: `hsla(${oppHue}, 65%, 55%, 0.9)` }} />
                                  <span className="text-muted-foreground/65 font-medium">{partnerSurah}:{partner?.ayahNumber}</span>
                                  <span className="ml-auto" style={{ color: `hsla(${oppHue}, 60%, 60%, 0.65)` }}>{oppLabel}</span>
                                </div>
                                {partner && (
                                  <p className="text-muted-foreground/45 leading-relaxed truncate">
                                    {partner.textTranslation.slice(0, 70)}…
                                  </p>
                                )}
                              </div>
                            );
                          })}
                          {partners.length > 3 && (
                            <p className="text-[9px] text-muted-foreground/30 pt-0.5">
                              +{partners.length - 3} more opposing verses
                            </p>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Similarity Intelligence */}
            {similarityLinks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  Similarity Intelligence
                  <span className="text-muted-foreground/40 text-[10px] normal-case ml-1">top {similarityLinks.length}</span>
                </h3>
                <div className="space-y-1.5">
                  {similarityLinks.map((sl) => {
                    const partner = getVerseById(sl.partnerVerseId);
                    const partnerSurah = partner ? (surahMap.get(partner.surahId) ?? partner.surahId) : '';
                    return (
                      <div
                        key={sl.partnerVerseId}
                        className="px-2.5 py-1.5 rounded-lg border border-purple-400/15 bg-purple-400/5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-purple-300/80 font-medium">
                            {partnerSurah}:{partner?.ayahNumber}
                          </span>
                          <span className="text-purple-400/60 text-[9px]">
                            {Math.round(sl.score * 100)}% match
                          </span>
                        </div>
                        {partner && (
                          <p className="text-muted-foreground/60 text-[10px] leading-relaxed truncate">
                            {partner.textTranslation.slice(0, 70)}…
                          </p>
                        )}
                        <div className="flex gap-2 text-[9px] text-muted-foreground/40">
                          <span>Root {Math.round(sl.breakdown.rootScore * 100)}%</span>
                          <span>·</span>
                          <span>Concept {Math.round(sl.breakdown.conceptScore * 100)}%</span>
                          <span>·</span>
                          <span>Verb {Math.round(sl.breakdown.verbScore * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode Info */}
            <div className="border-t border-border/20 pt-4">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                Viewing in {mode} mode
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VerseDetail;
