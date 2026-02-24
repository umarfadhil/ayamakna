import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Swords, Dna, ChevronDown, ChevronRight, GitFork, List, Scale, Brain } from 'lucide-react';
import type { Verse } from '@/engine/linguistic/types';
import type { ActionEdge, ActionSummary, SemanticMode } from '@/engine/semantic/types';
import type { Concept } from '@/engine/semantic/types';
import type { SemanticCluster } from '@/engine/semantic/actionDictionaries';
import { SEMANTIC_CLUSTER_LABELS } from '@/engine/semantic/actionDictionaries';
import { computeActionSummary } from '@/engine/semantic/actionEngine';
import type { VerseRootInsight } from '@/store/semanticStore';
import { getVerseById, getSurahList } from '@/store/semanticStore';
import { CONTRAST_DICTIONARY } from '@/engine/semantic/contrastEngine';

interface ContrastLinkData {
  pairId: string;
  partnerVerseId: string;
  score: number;
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
}

// --- Labels ---

const ACTOR_LABELS: Record<string, string> = {
  divine: 'Allah',
  human: 'Human',
  believer: 'Believer',
  disbeliever: 'Disbeliever',
  angel: 'Angel',
  nature: 'Nature',
  prophet: 'Prophet',
  hypocrite: 'Hypocrite',
  shaytan: 'Shaytan',
  mankind: 'Mankind',
};

const ACTOR_COLORS: Record<string, string> = {
  divine: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  human: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  believer: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  disbeliever: 'text-red-400 bg-red-400/10 border-red-400/25',
  angel: 'text-purple-400 bg-purple-400/10 border-purple-400/25',
  nature: 'text-teal-400 bg-teal-400/10 border-teal-400/25',
  prophet: 'text-amber-300 bg-amber-300/10 border-amber-300/25',
  hypocrite: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  shaytan: 'text-rose-500 bg-rose-500/10 border-rose-500/25',
  mankind: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
};

const TENSE_LABELS: Record<string, string> = {
  past: 'Past',
  present: 'Present',
  future: 'Future',
  imperative: 'Command',
};

const POLARITY_STYLES: Record<string, { dot: string; border: string; bg: string }> = {
  positive: { dot: 'bg-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/5' },
  negative: { dot: 'bg-red-400', border: 'border-red-400/15', bg: 'bg-red-400/5' },
  neutral: { dot: 'bg-gray-400', border: 'border-gray-400/15', bg: 'bg-gray-400/5' },
};

// --- Root Badge (unchanged) ---

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

const ActionSummaryPanel: React.FC<{ summary: ActionSummary }> = ({ summary }) => {
  const actorPct = Math.round((summary.dominantActorCount / summary.totalActions) * 100);
  const totalTense = summary.tenseDistribution.past + summary.tenseDistribution.present
    + summary.tenseDistribution.future + summary.tenseDistribution.imperative;
  const polarityColor = summary.dominantPolarity === 'positive' ? 'text-emerald-400'
    : summary.dominantPolarity === 'negative' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="rounded-lg border border-green-400/15 bg-green-400/5 p-3 space-y-2.5">
      <h4 className="text-[10px] font-medium text-green-400/70 uppercase tracking-wider">
        Behavioral Summary
      </h4>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Dominant Actor */}
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground/60 text-[9px] uppercase">Dominant Actor</span>
          <span className={`inline-flex items-center gap-1 ${ACTOR_COLORS[summary.dominantActor]?.split(' ')[0] ?? 'text-foreground'}`}>
            <span className="font-medium">{ACTOR_LABELS[summary.dominantActor]}</span>
            <span className="text-muted-foreground/50">({actorPct}%)</span>
          </span>
        </div>

        {/* Most Frequent Verb */}
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground/60 text-[9px] uppercase">Top Verb</span>
          <span className="text-foreground/80">
            <span className="font-arabic text-[12px]">{summary.mostFrequentRoot}</span>
            {summary.mostFrequentRootMeaning && (
              <span className="text-muted-foreground/60 ml-1">({summary.mostFrequentRootMeaning})</span>
            )}
          </span>
        </div>

        {/* Dominant Cluster */}
        {summary.dominantCluster && (
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground/60 text-[9px] uppercase">Category</span>
            <span className="text-foreground/80">
              {SEMANTIC_CLUSTER_LABELS[summary.dominantCluster]}
            </span>
          </div>
        )}

        {/* Polarity */}
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground/60 text-[9px] uppercase">Polarity</span>
          <span className={polarityColor + ' font-medium capitalize'}>
            {summary.dominantPolarity}
          </span>
        </div>
      </div>

      {/* Tense Distribution Bar */}
      {totalTense > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground/60 text-[9px] uppercase">Tense Distribution</span>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
            {summary.tenseDistribution.past > 0 && (
              <div
                className="bg-blue-400/70"
                style={{ width: `${(summary.tenseDistribution.past / totalTense) * 100}%` }}
                title={`Past: ${summary.tenseDistribution.past}`}
              />
            )}
            {summary.tenseDistribution.present > 0 && (
              <div
                className="bg-green-400/70"
                style={{ width: `${(summary.tenseDistribution.present / totalTense) * 100}%` }}
                title={`Present: ${summary.tenseDistribution.present}`}
              />
            )}
            {summary.tenseDistribution.imperative > 0 && (
              <div
                className="bg-amber-400/70"
                style={{ width: `${(summary.tenseDistribution.imperative / totalTense) * 100}%` }}
                title={`Command: ${summary.tenseDistribution.imperative}`}
              />
            )}
            {summary.tenseDistribution.future > 0 && (
              <div
                className="bg-purple-400/70"
                style={{ width: `${(summary.tenseDistribution.future / totalTense) * 100}%` }}
                title={`Future: ${summary.tenseDistribution.future}`}
              />
            )}
          </div>
          <div className="flex gap-3 text-[9px] text-muted-foreground/50">
            {summary.tenseDistribution.past > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/70" />Past</span>}
            {summary.tenseDistribution.present > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400/70" />Present</span>}
            {summary.tenseDistribution.imperative > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />Command</span>}
            {summary.tenseDistribution.future > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400/70" />Future</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Action Flow Graph (Mini SVG) ---

const ActionFlowGraph: React.FC<{ actions: ActionEdge[] }> = ({ actions }) => {
  // Collect unique nodes
  const actors = new Set<string>();
  const targets = new Set<string>();
  for (const a of actions) {
    actors.add(a.actorType);
    if (a.targetType) targets.add(typeof a.targetType === 'string' ? a.targetType : a.targetType);
  }

  const actorList = [...actors];
  const targetList = [...targets].filter((t) => !actors.has(t));
  const allTargets = [...targets];

  const ROW_H = 36;
  const leftX = 30;
  const midX = 160;
  const rightX = 290;
  const svgW = 330;
  const svgH = Math.max(actorList.length, allTargets.length, 1) * ROW_H + 20;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="text-xs">
      <defs>
        <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
          <path d="M0,0 L10,3 L0,6 Z" fill="currentColor" className="text-green-400/50" />
        </marker>
      </defs>

      {actions.map((a, i) => {
        const actorIdx = actorList.indexOf(a.actorType);
        const targetKey = a.targetType ? (typeof a.targetType === 'string' ? a.targetType : a.targetType) : null;
        const targetIdx = targetKey ? allTargets.indexOf(targetKey) : -1;

        const y1 = actorIdx * ROW_H + ROW_H / 2 + 10;
        const y2 = targetIdx >= 0 ? targetIdx * ROW_H + ROW_H / 2 + 10 : y1;

        const verbLabel = a.englishMeaning || a.actionRoot;

        return (
          <g key={a.id}>
            {/* Edge line */}
            <line
              x1={leftX + 40} y1={y1}
              x2={targetKey ? rightX - 40 : midX + 30} y2={y2}
              stroke="currentColor" className="text-green-400/30"
              strokeWidth={1} markerEnd="url(#arrow)"
            />
            {/* Verb label on edge */}
            <text
              x={midX} y={(y1 + y2) / 2 - 4}
              textAnchor="middle"
              className="fill-green-300/70 text-[9px]"
            >
              {verbLabel.length > 15 ? verbLabel.slice(0, 15) + '...' : verbLabel}
            </text>
          </g>
        );
      })}

      {/* Actor nodes */}
      {actorList.map((actor, i) => (
        <g key={`actor-${actor}`}>
          <rect
            x={leftX - 28} y={i * ROW_H + 10}
            width={68} height={ROW_H - 8}
            rx={6}
            className="fill-white/5 stroke-green-400/20"
            strokeWidth={0.5}
          />
          <text
            x={leftX + 6} y={i * ROW_H + ROW_H / 2 + 12}
            textAnchor="middle"
            className="fill-green-300 text-[10px] font-medium"
          >
            {ACTOR_LABELS[actor] ?? actor}
          </text>
        </g>
      ))}

      {/* Target nodes */}
      {allTargets.map((target, i) => (
        <g key={`target-${target}`}>
          <rect
            x={rightX - 28} y={i * ROW_H + 10}
            width={68} height={ROW_H - 8}
            rx={6}
            className="fill-white/5 stroke-orange-400/20"
            strokeWidth={0.5}
          />
          <text
            x={rightX + 6} y={i * ROW_H + ROW_H / 2 + 12}
            textAnchor="middle"
            className="fill-orange-300 text-[10px] font-medium"
          >
            {(ACTOR_LABELS[target] ?? target).length > 10
              ? (ACTOR_LABELS[target] ?? target).slice(0, 10) + '...'
              : ACTOR_LABELS[target] ?? target}
          </text>
        </g>
      ))}
    </svg>
  );
};

// --- Expandable Action Row ---

const ActionRow: React.FC<{ action: ActionEdge; verse?: Verse; searchQuery?: string }> = ({ action, verse, searchQuery }) => {
  const [expanded, setExpanded] = useState(false);
  const pStyle = POLARITY_STYLES[action.polarity] ?? POLARITY_STYLES.neutral;
  const actorColor = ACTOR_COLORS[action.actorType] ?? ACTOR_COLORS.human;

  // Highlight actor if search matches actor label, type key, or English meaning
  const q = searchQuery?.toLowerCase() ?? '';
  const actorLabel = ACTOR_LABELS[action.actorType] ?? action.actorType;
  const isActorMatch = q.length > 0 && (
    actorLabel.toLowerCase().includes(q) ||
    action.actorType.toLowerCase().includes(q)
  );
  const isVerbMatch = q.length > 0 && (
    (action.englishMeaning?.toLowerCase().includes(q) ?? false) ||
    action.actionRoot.includes(q)
  );

  return (
    <div className={`rounded-lg border ${pStyle.border} ${pStyle.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-xs px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {/* Polarity dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pStyle.dot}`} />

        {/* Actor badge */}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all ${actorColor} ${
          isActorMatch ? 'ring-2 ring-white/40 scale-110' : ''
        }`}>
          {ACTOR_LABELS[action.actorType] ?? action.actorType}
        </span>

        <span className="text-muted-foreground/60">→</span>

        {/* Verb: Arabic + English */}
        <span className={`flex items-center gap-1 min-w-0 ${isVerbMatch ? 'text-yellow-300' : ''}`}>
          <span className="font-arabic text-foreground/90 text-[13px]">{action.verbText || action.actionRoot}</span>
          {action.englishMeaning && (
            <span className={`truncate ${isVerbMatch ? 'text-yellow-300/80' : 'text-muted-foreground/70'}`}>
              ({action.englishMeaning})
            </span>
          )}
        </span>

        {/* Target */}
        {action.targetType && (
          <>
            <span className="text-muted-foreground/60">→</span>
            <span className="text-orange-300 text-[10px]">
              {ACTOR_LABELS[action.targetType as string] ?? action.targetType}
            </span>
          </>
        )}

        {/* Right side: tense + frequency */}
        <span className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-muted-foreground/50 text-[9px] uppercase">
            {TENSE_LABELS[action.tense] ?? action.tense}
          </span>
          {action.rootFrequency > 0 && (
            <span className="text-muted-foreground/40 text-[9px]">{action.rootFrequency}×</span>
          )}
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
        </span>
      </button>

      {/* Expanded: Verse Context */}
      {expanded && verse && (
        <div className="px-3 pb-2.5 pt-1 border-t border-white/5 space-y-1.5">
          <div
            className="text-sm font-arabic leading-relaxed text-foreground/80 text-right"
            dir="rtl"
            dangerouslySetInnerHTML={{
              __html: highlightVerbInArabic(verse.textArabic, action.verbText || action.actionRoot),
            }}
          />
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            {verse.textTranslation}
          </p>
          {action.semanticCluster && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border border-green-400/15 bg-green-400/5 text-green-400/70">
              {SEMANTIC_CLUSTER_LABELS[action.semanticCluster]}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/** Highlight the verb word inside the Arabic verse text. */
function highlightVerbInArabic(arabicText: string, verbText: string): string {
  if (!verbText) return arabicText;
  // Escape regex special chars
  const escaped = verbText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the verb (with possible diacritics differences)
  return arabicText.replace(
    new RegExp(`(${escaped})`, 'g'),
    '<span class="text-green-400 font-bold">$1</span>'
  );
}

// --- Cluster Section ---

const ClusterSection: React.FC<{
  clusterKey: string;
  actions: ActionEdge[];
  verse?: Verse;
  defaultOpen?: boolean;
  searchQuery?: string;
}> = ({ clusterKey, actions, verse, defaultOpen = false, searchQuery }) => {
  const [open, setOpen] = useState(defaultOpen);
  const label = clusterKey === 'uncategorized'
    ? 'Other Actions'
    : SEMANTIC_CLUSTER_LABELS[clusterKey as SemanticCluster] ?? clusterKey;

  return (
    <div className="rounded-lg border border-border/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground/50" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
        <span className="text-foreground/80 font-medium">{label}</span>
        <span className="text-muted-foreground/40 text-[10px]">{actions.length}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} verse={verse} searchQuery={searchQuery} />
          ))}
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
}) => {
  const surahList = useMemo(() => getSurahList(), []);
  const surahMap = useMemo(() => new Map(surahList.map((s) => [s.number, s.name])), [surahList]);
  const [actionViewMode, setActionViewMode] = useState<'list' | 'flow'>('list');

  // Group actions by semantic cluster
  const clusteredActions = useMemo(() => {
    const grouped = new Map<string, ActionEdge[]>();
    for (const a of actions) {
      const key = a.semanticCluster ?? 'uncategorized';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    }
    return new Map(
      [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)
    );
  }, [actions]);

  // Compute summary from actions if not provided
  const summary = useMemo(
    () => actionSummary ?? computeActionSummary(actions),
    [actionSummary, actions]
  );

  const hasMultipleClusters = clusteredActions.size > 1;

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
                    const isConceptMatch = q.length > 0 && (
                      concept.name.toLowerCase().includes(q) ||
                      concept.id.toLowerCase().includes(q) ||
                      (concept.nameAr?.includes(searchQuery ?? '') ?? false)
                    );
                    return (
                      <span
                        key={concept.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-blue-400/20 bg-blue-400/10 text-blue-300 transition-all ${
                          isConceptMatch ? 'ring-2 ring-blue-400/70 bg-blue-400/20 scale-105' : ''
                        }`}
                        title={concept.description}
                      >
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
                {/* Section Header with View Toggle */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-green-400" />
                    Action Intelligence
                    <span className="text-muted-foreground/40 text-[10px] normal-case ml-1">{actions.length} actions</span>
                  </h3>
                  <div className="flex items-center gap-0.5 bg-white/5 rounded-md p-0.5">
                    <button
                      onClick={() => setActionViewMode('list')}
                      className={`p-1 rounded transition-colors ${actionViewMode === 'list' ? 'bg-green-400/20 text-green-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                      title="List View"
                    >
                      <List className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setActionViewMode('flow')}
                      className={`p-1 rounded transition-colors ${actionViewMode === 'flow' ? 'bg-green-400/20 text-green-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                      title="Flow View"
                    >
                      <GitFork className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Behavioral Summary */}
                {summary && <ActionSummaryPanel summary={summary} />}

                {/* List View */}
                {actionViewMode === 'list' && (
                  <div className="space-y-2">
                    {hasMultipleClusters ? (
                      // Grouped by cluster
                      [...clusteredActions.entries()].map(([clusterKey, clusterActions], i) => (
                        <ClusterSection
                          key={clusterKey}
                          clusterKey={clusterKey}
                          actions={clusterActions}
                          verse={verse}
                          defaultOpen={i === 0}
                          searchQuery={searchQuery}
                        />
                      ))
                    ) : (
                      // Flat list (single or no cluster)
                      actions.map((action) => (
                        <ActionRow key={action.id} action={action} verse={verse} searchQuery={searchQuery} />
                      ))
                    )}
                  </div>
                )}

                {/* Flow View */}
                {actionViewMode === 'flow' && (
                  <div className="rounded-lg border border-green-400/15 bg-green-400/5 p-2">
                    <ActionFlowGraph actions={actions} />
                  </div>
                )}
              </div>
            )}

            {/* Contrast Intelligence */}
            {contrastLinks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-red-400" />
                  Contrast Intelligence
                  <span className="text-muted-foreground/40 text-[10px] normal-case ml-1">{contrastLinks.length} links</span>
                </h3>
                <div className="space-y-1.5">
                  {contrastLinks.slice(0, 5).map((cl) => {
                    const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === cl.pairId);
                    const partner = getVerseById(cl.partnerVerseId);
                    const partnerSurah = partner ? (surahMap.get(partner.surahId) ?? partner.surahId) : '';
                    return (
                      <div
                        key={`${cl.pairId}-${cl.partnerVerseId}`}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg border border-red-400/15 bg-red-400/5 text-xs"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          {pair && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-arabic text-red-300/90 text-[11px]">{pair.labelA}</span>
                              <span className="text-muted-foreground/50">↔</span>
                              <span className="font-arabic text-red-300/90 text-[11px]">{pair.labelB}</span>
                              <span className="text-[9px] text-muted-foreground/50 uppercase ml-1">{pair.category}</span>
                            </div>
                          )}
                          <div className="text-muted-foreground/60 text-[10px]">
                            ↳ {partnerSurah}:{partner?.ayahNumber}
                          </div>
                          {partner && (
                            <div className="text-muted-foreground/50 text-[10px] truncate">
                              {partner.textTranslation.slice(0, 60)}…
                            </div>
                          )}
                        </div>
                        <span className="text-red-400/50 text-[9px] flex-shrink-0 mt-0.5">
                          {Math.round(cl.score * 100)}%
                        </span>
                      </div>
                    );
                  })}
                  {contrastLinks.length > 5 && (
                    <p className="text-[9px] text-muted-foreground/40 pl-1">
                      +{contrastLinks.length - 5} more contrast links
                    </p>
                  )}
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
