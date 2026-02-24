import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, GitBranch, Layers, Swords, Scale, Brain, Loader2, Eye, EyeOff } from 'lucide-react';
import SemanticGraph from '@/components/graph/SemanticGraph';
import ParticleBackground from '@/components/graph/ParticleBackground';
import VerseDetail from '@/components/reader/VerseDetail';
import type { GraphNode } from '@/engine/visualization/types';
import type { SemanticMode } from '@/engine/semantic/types';
import {
  initSemanticEngine,
  isEngineReady,
  buildGraphData,
  getVerseById,
  getVerseConcepts,
  getVerseActions,
  getVerseActionSummary,
  getStats,
  getSurahList,
  getVerseRootsWithData,
  getAllVerses,
  getConnectedVerseIds,
  getVerseSearchTokensForMode,
  getVerseContrastLinks,
  getVerseSimilarityLinks,
  setRootFocusLevel,
} from '@/store/semanticStore';
import type { RootFocusLevel } from '@/store/semanticStore';

// --- Root translation words to cycle through in the search placeholder ---
const ROOT_PLACEHOLDER_WORDS = [
  'Forgiveness', 'Mercy', 'Knowledge', 'Guidance', 'Patience',
  'Gratitude', 'Creation', 'Worship', 'Truth', 'Justice',
  'Wisdom', 'Faith', 'Repentance', 'Prayer', 'Light',
  'Fear', 'Hope', 'Strength', 'Trust', 'Resurrection',
];

/**
 * Animated typing placeholder. Cycles through words at ~10s per word.
 * Returns:
 *   display  — the formatted string to show in the placeholder
 *   currentWord — the fully-typed current word (non-empty only during the pause phase)
 *                 Used to auto-highlight matching graph nodes when no search query is active.
 */
function useTypingPlaceholder(words: string[], typingMs = 80, deletingMs = 45, pauseMs = 9000) {
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'paused' | 'deleting'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const word = words[wordIdx];
    if (timerRef.current) clearTimeout(timerRef.current);

    if (phase === 'typing') {
      if (charIdx < word.length) {
        timerRef.current = setTimeout(() => setCharIdx((c) => c + 1), typingMs);
      } else {
        // Word fully typed — pause for pauseMs before deleting
        timerRef.current = setTimeout(() => setPhase('paused'), pauseMs);
      }
    } else if (phase === 'paused') {
      setPhase('deleting');
    } else {
      if (charIdx > 0) {
        timerRef.current = setTimeout(() => setCharIdx((c) => c - 1), deletingMs);
      } else {
        setWordIdx((i) => (i + 1) % words.length);
        setPhase('typing');
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [wordIdx, charIdx, phase, words, typingMs, deletingMs, pauseMs]);

  const word = words[wordIdx].slice(0, charIdx);
  // currentWord is populated only when the word is fully typed (during the pause phase)
  const isFullyTyped = charIdx === words[wordIdx].length && phase !== 'deleting';
  return {
    display: word ? `Try "${word}"` : 'Search root translations…',
    currentWord: isFullyTyped ? word : '',
  };
}

const MODE_CONFIG: Array<{
  mode: SemanticMode;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}> = [
  { mode: 'root', label: 'Root', icon: GitBranch, color: 'text-yellow-400' },
  { mode: 'concept', label: 'Concept', icon: Layers, color: 'text-blue-400' },
  { mode: 'action', label: 'Action', icon: Swords, color: 'text-green-400' },
  { mode: 'contrast', label: 'Contrast', icon: Scale, color: 'text-red-400' },
  { mode: 'similarity', label: 'Similarity', icon: Brain, color: 'text-purple-400' },
];

const Index = () => {
  const [semanticMode, setSemanticMode] = useState<SemanticMode>('root');
  const [searchQuery, setSearchQuery] = useState('');
  const { display: typingPlaceholder, currentWord: placeholderWord } = useTypingPlaceholder(ROOT_PLACEHOLDER_WORDS);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading Quranic data...');
  const [showIsolated, setShowIsolated] = useState(false);
  const [rootFocusLevel, setRootFocusLevelState] = useState<RootFocusLevel>('focused');

  const handleFocusLevel = useCallback((level: RootFocusLevel) => {
    setRootFocusLevel(level);      // update store module variable
    setRootFocusLevelState(level); // trigger re-render + graphData recompute
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingMessage('Fetching data from Supabase...');
        await initSemanticEngine();
        if (!cancelled) {
          setEngineReady(true);
        }
      } catch (err) {
        console.error('Failed to initialize semantic engine:', err);
        if (!cancelled) {
          setLoadingMessage('Failed to load data. Please refresh.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const graphData = useMemo(
    () => (engineReady ? buildGraphData(semanticMode) : { nodes: [], edges: [] }),
    [semanticMode, engineReady, rootFocusLevel]
  );
  const stats = useMemo(
    () => (engineReady ? getStats() : { verses: 0, roots: 0, concepts: 0, links: 0 }),
    [engineReady]
  );

  // Auto-highlight: when no search query is active in root mode, highlight nodes matching
  // the current fully-typed placeholder word. This creates a 10s animated highlight tour.
  const effectiveSearchQuery = useMemo(() => {
    if (searchQuery) return searchQuery;
    // Pause auto-highlight when a node is selected so it doesn't interfere with focus
    if (semanticMode === 'root' && placeholderWord && !selectedNode) return placeholderWord.toLowerCase();
    return '';
  }, [searchQuery, semanticMode, placeholderWord, selectedNode]);

  // Isolated verses: all verses not in current mode's connected set
  const isolatedNodes = useMemo((): GraphNode[] => {
    if (!engineReady || !showIsolated) return [];
    const connectedIds = getConnectedVerseIds(semanticMode);
    const surahList = getSurahList();
    const surahMap = new Map(surahList.map((s) => [s.number, s.name]));
    return getAllVerses()
      .filter((v) => !connectedIds.has(v.id))
      .map((v) => ({
        id: v.id,
        label: `${surahMap.get(v.surahId) ?? v.surahId}:${v.ayahNumber}`,
        labelAr: v.textArabic.slice(0, 40) + (v.textArabic.length > 40 ? '...' : ''),
        surahId: v.surahId,
        ayahNumber: v.ayahNumber,
        weight: 0,
        cluster: 'unknown',
        searchTokens: getVerseSearchTokensForMode(v.id, semanticMode),
      }));
  }, [engineReady, showIsolated, semanticMode]);

  // Coverage: connected verses / total verses
  const coverage = useMemo(() => {
    if (!engineReady || stats.verses === 0) return null;
    const connected = graphData.nodes.length;
    return { connected, total: stats.verses, pct: Math.round((connected / stats.verses) * 100) };
  }, [engineReady, graphData.nodes.length, stats.verses]);

  // Root insights for selected verse (Service A — Linguistic Roots)
  const selectedVerseRoots = useMemo(
    () => (selectedNode ? getVerseRootsWithData(selectedNode.id) : []),
    [selectedNode]
  );


  // Action summary for selected verse
  const selectedActionSummary = useMemo(
    () => (selectedNode ? getVerseActionSummary(selectedNode.id) : null),
    [selectedNode]
  );

  // Contrast & similarity links for selected verse
  const selectedContrastLinks = useMemo(
    () => (selectedNode ? getVerseContrastLinks(selectedNode.id) : []),
    [selectedNode]
  );
  const selectedSimilarityLinks = useMemo(
    () => (selectedNode ? getVerseSimilarityLinks(selectedNode.id) : []),
    [selectedNode]
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    setDetailOpen(true);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setDetailOpen(false);
  }, []);

  const selectedVerse = selectedNode ? getVerseById(selectedNode.id) : null;
  const selectedConcepts = selectedNode ? getVerseConcepts(selectedNode.id) : [];
  const selectedActions = selectedNode ? getVerseActions(selectedNode.id) : [];
  const surahName = selectedVerse
    ? getSurahList().find((s) => s.number === selectedVerse.surahId)?.name ?? ''
    : '';

  // Loading state
  if (!engineReady) {
    return (
      <div className="min-h-screen bg-background overflow-hidden relative flex items-center justify-center">
        <ParticleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel px-8 py-6 flex flex-col items-center gap-4"
          style={{ zIndex: 10 }}
        >
          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center gold-glow">
            <span className="text-primary font-arabic text-lg font-bold">ق</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">AyaMakna</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{loadingMessage}</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      <ParticleBackground />

      <AnimatePresence>
        <>
          {/* Semantic Graph */}
          <SemanticGraph
            data={graphData}
            searchQuery={effectiveSearchQuery}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            selectedNodeId={selectedNode?.id ?? null}
            mode={semanticMode}
            isolatedNodes={isolatedNodes}
          />

          {/* Top Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="fixed top-0 left-0 right-0 p-4 flex items-center gap-3"
            style={{ zIndex: 30 }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mr-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center gold-glow">
                <span className="text-primary font-arabic text-sm font-bold">ق</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground leading-none">AyaMakna</h1>
                <p className="text-[10px] text-muted-foreground">Semantic Intelligence</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={semanticMode === 'root' ? typingPlaceholder : 'Search verses…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass-panel pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>

            {/* Mode Toggle */}
            <div className="glass-panel flex p-1 gap-0.5">
              {MODE_CONFIG.map(({ mode, label, icon: Icon, color }) => (
                <button
                  key={mode}
                  onClick={() => setSemanticMode(mode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    semanticMode === mode
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  title={`${label} Mode`}
                >
                  <Icon className={`w-3.5 h-3.5 ${semanticMode === mode ? color : ''}`} />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Isolated Verses Toggle */}
            <button
              onClick={() => setShowIsolated((v) => !v)}
              className={`glass-panel flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showIsolated
                  ? 'bg-slate-400/15 text-slate-300 border border-slate-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              title="Show isolated verses (not yet semantically mapped)"
            >
              {showIsolated ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">Isolated</span>
            </button>

            {/* Root Focus Level — root mode only */}
            {semanticMode === 'root' && (
              <div className="glass-panel flex p-1 gap-0.5" title="Coverage: how many verse connections to show">
                {(['broad', 'focused', 'deep'] as RootFocusLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleFocusLevel(level)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      rootFocusLevel === level
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}

          </motion.div>

          {/* Bottom Info Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="fixed bottom-4 left-4 right-4 flex items-center justify-between"
            style={{ zIndex: 30 }}
          >
            <div className="glass-panel px-4 py-2 text-xs text-muted-foreground flex gap-3 items-center">
              <span>
                <span className="text-primary font-semibold">{stats.verses}</span> verses
              </span>
              <span>
                <span className="text-primary font-semibold">{stats.roots}</span> roots
              </span>
              <span>
                <span className="text-primary font-semibold">{stats.concepts}</span> concepts
              </span>
              <span>
                <span className="text-primary font-semibold">{graphData.edges.length}</span> links
              </span>
              {coverage && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span title={`${coverage.connected} of ${coverage.total} verses connected in ${semanticMode} mode`}>
                    <span
                      className={`font-semibold ${
                        coverage.pct >= 70
                          ? 'text-emerald-400'
                          : coverage.pct >= 40
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {coverage.pct}%
                    </span>{' '}
                    coverage
                  </span>
                </>
              )}
            </div>

            {selectedNode && selectedVerse && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-panel px-4 py-2 flex items-center gap-3 max-w-lg"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {surahName} : {selectedVerse.ayahNumber}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedVerse.textTranslation.slice(0, 60)}...
                  </div>
                </div>
                <button
                  onClick={() => setDetailOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                  title="Read details"
                >
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </button>
              </motion.div>
            )}

            <div className="glass-panel px-4 py-2 text-xs text-muted-foreground">
              Scroll to zoom · Drag to pan · Click to select
            </div>
          </motion.div>

          {/* Verse Detail Panel */}
          <VerseDetail
            isOpen={detailOpen && !!selectedVerse}
            onClose={() => setDetailOpen(false)}
            verse={selectedVerse ?? undefined}
            surahName={surahName}
            concepts={selectedConcepts}
            actions={selectedActions}
            actionSummary={selectedActionSummary}
            mode={semanticMode}
            verseRoots={selectedVerseRoots}
            searchQuery={searchQuery}
            contrastLinks={selectedContrastLinks}
            similarityLinks={selectedSimilarityLinks}
          />
        </>
      </AnimatePresence>
    </div>
  );
};

export default Index;
