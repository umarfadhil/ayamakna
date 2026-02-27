import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, GitBranch, Layers, Swords, Scale, Loader2, Eye, EyeOff, Info, Github, RotateCcw } from 'lucide-react';
import SemanticGraph, { type SemanticGraphHandle } from '@/components/graph/SemanticGraph';
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
  getActionRootVerseIds,
  setRootFocusLevel,
  setConceptFocusLevel,
  setActionFocusLevel,
  setContrastFocusLevel } from
'@/store/semanticStore';
import type { RootFocusLevel, ConceptFocusLevel, ActionFocusLevel, ContrastFocusLevel } from '@/store/semanticStore';
import { ACTION_PLACEHOLDER_WORDS } from '@/engine/semantic/actionDictionaries';
import { CONTRAST_PLACEHOLDER_WORDS } from '@/engine/semantic/contrastEngine';
import MobileControlsFab from '@/components/graph/MobileControlsFab';

// --- Root translation words to cycle through in the search placeholder ---
const ROOT_PLACEHOLDER_WORDS = [
'Forgiveness', 'Mercy', 'Knowledge', 'Guidance', 'Patience',
'Gratitude', 'Creation', 'Worship', 'Truth', 'Justice',
'Wisdom', 'Faith', 'Repentance', 'Prayer', 'Light',
'Fear', 'Hope', 'Strength', 'Trust', 'Resurrection'];


// --- Concept words to cycle through in concept mode search placeholder ---
// Keep these aligned with ayamakna_concepts.name so auto-highlight always hits.
const CONCEPT_PLACEHOLDER_WORDS = [
'Tawhid', 'Taqwa', 'Sabr', 'Tawakkul', 'Dhikr',
'Salah', 'Ilm', 'Rahmah', 'Hidayah', 'Ihsan',
'Iman', 'Kufr', 'Nifaq', 'Light & Darkness', 'Life & Death',
'Qadr', 'Akhlaq', 'Maghfirah', 'Amr & Nahi', 'Tawbah',
'Rizq', 'Adl', 'Shukr', "Du'a", 'Jihad',
'Jannah & Nar', 'Qiyamah', 'Quran', 'Khawf & Raja'];


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
    return () => {if (timerRef.current) clearTimeout(timerRef.current);};
  }, [wordIdx, charIdx, phase, words, typingMs, deletingMs, pauseMs]);

  const word = words[wordIdx].slice(0, charIdx);
  // currentWord is populated only when the word is fully typed (during the pause phase)
  const isFullyTyped = charIdx === words[wordIdx].length && phase !== 'deleting';
  return {
    display: word ? `Try "${word}"` : 'Search root translations…',
    currentWord: isFullyTyped ? word : ''
  };
}

const MODE_CONFIG: Array<{
  mode: SemanticMode;
  label: string;
  icon: React.FC<{className?: string;}>;
  color: string;
}> = [
{ mode: 'root', label: 'Root', icon: GitBranch, color: 'text-yellow-400' },
{ mode: 'concept', label: 'Concept', icon: Layers, color: 'text-blue-400' },
{ mode: 'action', label: 'Action', icon: Swords, color: 'text-green-400' },
{ mode: 'contrast', label: 'Contrast', icon: Scale, color: 'text-red-400' }
// similarity is intentionally excluded from the graph tab bar
// (still accessible in VerseDetail reading panel via similarityLinks prop)
];

const Index = () => {
  const [semanticMode, setSemanticMode] = useState<SemanticMode>('root');
  const [searchQuery, setSearchQuery] = useState('');
  const { display: typingPlaceholder, currentWord: placeholderWord } = useTypingPlaceholder(ROOT_PLACEHOLDER_WORDS);
  const { display: conceptTypingPlaceholder, currentWord: conceptPlaceholderWord } = useTypingPlaceholder(CONCEPT_PLACEHOLDER_WORDS);
  const { display: actionTypingPlaceholder, currentWord: actionPlaceholderWord } = useTypingPlaceholder(ACTION_PLACEHOLDER_WORDS);
  const { display: contrastTypingPlaceholder, currentWord: contrastPlaceholderWord } = useTypingPlaceholder(CONTRAST_PLACEHOLDER_WORDS);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading Quranic data...');
  const [showIsolated, setShowIsolated] = useState(false);
  const [rootFocusLevel, setRootFocusLevelState] = useState<RootFocusLevel>('focused');
  const [conceptFocusLevel, setConceptFocusLevelState] = useState<ConceptFocusLevel>('focused');
  const [actionFocusLevel, setActionFocusLevelState] = useState<ActionFocusLevel>('focused');
  const [contrastFocusLevel, setContrastFocusLevelState] = useState<ContrastFocusLevel>('focused');
  const [highlightedVerseIds, setHighlightedVerseIds] = useState<Set<string> | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const graphRef = useRef<SemanticGraphHandle | null>(null);

  const handleRootFocusLevel = useCallback((level: RootFocusLevel) => {
    setRootFocusLevel(level);
    setRootFocusLevelState(level);
  }, []);

  const handleConceptFocusLevel = useCallback((level: ConceptFocusLevel) => {
    setConceptFocusLevel(level);
    setConceptFocusLevelState(level);
  }, []);

  const handleActionFocusLevel = useCallback((level: ActionFocusLevel) => {
    setActionFocusLevel(level);
    setActionFocusLevelState(level);
  }, []);

  const handleContrastFocusLevel = useCallback((level: ContrastFocusLevel) => {
    setContrastFocusLevel(level);
    setContrastFocusLevelState(level);
  }, []);

  const handleActionFilter = useCallback((actionRoot: string) => {
    const ids = getActionRootVerseIds(actionRoot);
    setHighlightedVerseIds(ids.size > 0 ? ids : null);
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
    return () => {cancelled = true;};
  }, []);

  // Visitor metric (client-local unique visitors)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const idKey = 'ayamakna_visitor_id';
      const countKey = 'ayamakna_visitor_count';
      let count = Number(localStorage.getItem(countKey) ?? '0');
      if (!localStorage.getItem(idKey)) {
        const id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        localStorage.setItem(idKey, id);
        count += 1;
        localStorage.setItem(countKey, String(count));
      }
      setVisitorCount(count);
    } catch (err) {
      console.warn('Visitor metric unavailable:', err);
      setVisitorCount(null);
    }
  }, []);

  const graphData = useMemo(
    () => engineReady ? buildGraphData(semanticMode) : { nodes: [], edges: [] },
    [semanticMode, engineReady, rootFocusLevel, conceptFocusLevel, actionFocusLevel, contrastFocusLevel]
  );
  const stats = useMemo(
    () => engineReady ? getStats() : { verses: 0, roots: 0, concepts: 0, links: 0 },
    [engineReady]
  );

  // Auto-highlight: when no search query is active, highlight nodes matching
  // the current fully-typed placeholder word. Creates an animated 10s highlight tour.
  const effectiveSearchQuery = useMemo(() => {
    if (searchQuery) return searchQuery;
    // Pause auto-highlight when a node is selected so it doesn't interfere with focus
    if (semanticMode === 'root' && placeholderWord && !selectedNode) return placeholderWord.toLowerCase();
    if (semanticMode === 'concept' && conceptPlaceholderWord && !selectedNode) return conceptPlaceholderWord.toLowerCase();
    if (semanticMode === 'action' && actionPlaceholderWord && !selectedNode) return actionPlaceholderWord.toLowerCase();
    if (semanticMode === 'contrast' && contrastPlaceholderWord && !selectedNode) return contrastPlaceholderWord.toLowerCase();
    return '';
  }, [searchQuery, semanticMode, placeholderWord, conceptPlaceholderWord, actionPlaceholderWord, contrastPlaceholderWord, selectedNode]);

  // Isolated verses: all verses not in current mode's connected set
  const isolatedNodes = useMemo((): GraphNode[] => {
    if (!engineReady || !showIsolated) return [];
    const connectedIds = getConnectedVerseIds(semanticMode);
    const surahList = getSurahList();
    const surahMap = new Map(surahList.map((s) => [s.number, s.name]));
    return getAllVerses().
    filter((v) => !connectedIds.has(v.id)).
    map((v) => ({
      id: v.id,
      label: `${surahMap.get(v.surahId) ?? v.surahId}:${v.ayahNumber}`,
      labelAr: v.textArabic.slice(0, 40) + (v.textArabic.length > 40 ? '...' : ''),
      surahId: v.surahId,
      ayahNumber: v.ayahNumber,
      weight: 0,
      cluster: 'unknown',
      searchTokens: getVerseSearchTokensForMode(v.id, semanticMode)
    }));
  }, [engineReady, showIsolated, semanticMode]);

  // Coverage: connected verses / total verses
  const coverage = useMemo(() => {
    if (!engineReady || stats.verses === 0) return null;
    const connected = graphData.nodes.length;
    return { connected, total: stats.verses, pct: Math.round(connected / stats.verses * 100) };
  }, [engineReady, graphData.nodes.length, stats.verses]);

  // Root insights for selected verse (Service A — Linguistic Roots)
  const selectedVerseRoots = useMemo(
    () => selectedNode ? getVerseRootsWithData(selectedNode.id) : [],
    [selectedNode]
  );


  // Action summary for selected verse
  const selectedActionSummary = useMemo(
    () => selectedNode ? getVerseActionSummary(selectedNode.id) : null,
    [selectedNode]
  );

  // Contrast & similarity links for selected verse
  const selectedContrastLinks = useMemo(
    () => selectedNode ? getVerseContrastLinks(selectedNode.id) : [],
    [selectedNode]
  );
  const selectedSimilarityLinks = useMemo(
    () => selectedNode ? getVerseSimilarityLinks(selectedNode.id) : [],
    [selectedNode]
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => prev?.id === node.id ? null : node);
    setDetailOpen(true);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setDetailOpen(false);
  }, []);

  const selectedVerse = selectedNode ? getVerseById(selectedNode.id) : null;
  const selectedConcepts = selectedNode ? getVerseConcepts(selectedNode.id) : [];
  const selectedActions = selectedNode ? getVerseActions(selectedNode.id) : [];
  const surahName = selectedVerse ?
  getSurahList().find((s) => s.number === selectedVerse.surahId)?.name ?? '' :
  '';

  // Loading state
  if (!engineReady) {
    return (
      <div className="min-h-screen bg-background overflow-hidden relative flex items-center justify-center">
        <ParticleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel px-8 py-6 flex flex-col items-center gap-4"
          style={{ zIndex: 10 }}>

          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center gold-glow">
            <span className="text-primary font-arabic text-lg font-bold">ق</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">AyaMakna</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{loadingMessage}</span>
          </div>
        </motion.div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      <ParticleBackground />

      <AnimatePresence>
        <>
          {/* Semantic Graph */}
          <SemanticGraph
            ref={graphRef}
            data={graphData}
            searchQuery={effectiveSearchQuery}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            selectedNodeId={selectedNode?.id ?? null}
            mode={semanticMode}
            isolatedNodes={isolatedNodes}
            highlightedVerseIds={highlightedVerseIds} />


          {/* Top Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="fixed top-0 left-0 right-0 p-4"
            style={{ zIndex: 30 }}>

            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-3 flex-1">
                {/* Logo */}
                <div className="flex items-center gap-3 mr-2">
                  <div className="hidden sm:flex w-8 h-8 rounded-full bg-primary/20 border border-primary/30 items-center justify-center gold-glow">
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
                    placeholder={
                    semanticMode === 'root' ? typingPlaceholder :
                    semanticMode === 'concept' ? conceptTypingPlaceholder :
                    semanticMode === 'action' ? actionTypingPlaceholder :
                    semanticMode === 'contrast' ? contrastTypingPlaceholder :
                    'Search verses…'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full glass-panel pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all" />

                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                {/* Mode Toggle — hidden on mobile, shown via FAB */}
                <div className="glass-panel hidden md:flex p-1 gap-0.5">
                  {MODE_CONFIG.map(({ mode, label, icon: Icon, color }) =>
                  <button
                    key={mode}
                    onClick={() => setSemanticMode(mode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    semanticMode === mode ?
                    'bg-primary/20 text-primary border border-primary/30' :
                    'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                    }
                    title={`${label} Mode`}>

                      <Icon className={`w-3.5 h-3.5 ${semanticMode === mode ? color : ''}`} />
                      <span className="hidden lg:inline">{label}</span>
                    </button>
                  )}
                </div>

                {/* Root Focus Level — hidden on mobile */}
                {semanticMode === 'root' &&
                <div className="glass-panel hidden md:flex p-1 gap-0.5" title="Coverage: how many verse connections to show">
                    {(['broad', 'focused', 'deep'] as RootFocusLevel[]).map((level) =>
                  <button
                    key={level}
                    onClick={() => handleRootFocusLevel(level)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    rootFocusLevel === level ?
                    'bg-primary/20 text-primary border border-primary/30' :
                    'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                    }>

                        {level}
                      </button>
                  )}
                  </div>
                }

                {/* Concept Focus Level — hidden on mobile */}
                {semanticMode === 'concept' &&
                <div className="glass-panel hidden md:flex p-1 gap-0.5" title="Coverage: how many domain connections to show">
                    {(['broad', 'focused', 'deep'] as ConceptFocusLevel[]).map((level) =>
                  <button
                    key={level}
                    onClick={() => handleConceptFocusLevel(level)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    conceptFocusLevel === level ?
                    'bg-blue-400/20 text-blue-300 border border-blue-400/30' :
                    'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                    }>

                        {level}
                      </button>
                  )}
                  </div>
                }

                {/* Action Focus Level — hidden on mobile */}
                {semanticMode === 'action' &&
                <div className="glass-panel hidden md:flex p-1 gap-0.5" title="Coverage: how many behavioral connections to show">
                    {(['broad', 'focused', 'deep'] as ActionFocusLevel[]).map((level) =>
                  <button
                    key={level}
                    onClick={() => handleActionFocusLevel(level)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    actionFocusLevel === level ?
                    'bg-green-400/20 text-green-300 border border-green-400/30' :
                    'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                    }>

                        {level}
                      </button>
                  )}
                  </div>
                }

                {/* Contrast Focus Level — hidden on mobile */}
                {semanticMode === 'contrast' &&
                <div className="glass-panel hidden md:flex p-1 gap-0.5" title="Coverage: how many opposing connections to show">
                    {(['broad', 'focused', 'deep'] as ContrastFocusLevel[]).map((level) =>
                  <button
                    key={level}
                    onClick={() => handleContrastFocusLevel(level)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    contrastFocusLevel === level ?
                    'bg-red-400/20 text-red-300 border border-red-400/30' :
                    'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                    }>

                        {level}
                      </button>
                  )}
                  </div>
                }
              </div>

              {/* Isolated Verses Toggle — hidden on mobile */}
              <button
                onClick={() => setShowIsolated((v) => !v)}
                className={`glass-panel hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showIsolated ?
                'bg-slate-400/15 text-slate-300 border border-slate-400/30' :
                'text-muted-foreground hover:text-foreground hover:bg-white/5'}`
                }
                title="Show isolated verses (not yet semantically mapped)">

                {showIsolated ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">Isolated</span>
              </button>

              {/* Reset View — hidden on mobile */}
              <button
                onClick={() => graphRef.current?.resetView()}
                className="glass-panel hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                title="Reset view to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Default</span>
              </button>
            </div>

          </motion.div>

          {/* Bottom Info Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="fixed bottom-4 left-4 right-4 flex items-center justify-between"
            style={{ zIndex: 30 }}>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAboutOpen(true)}
                className="glass-panel hidden md:flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="About AyaMakna"
              >
                <Info className="w-3.5 h-3.5 text-primary" />
                About
              </button>

              <div className="glass-panel px-4 py-2 text-xs text-muted-foreground flex gap-3 items-center">
                <span>
                  <span className="text-primary font-semibold">{getSurahList().length}</span> surahs
                </span>
                <span>
                  <span className="text-primary font-semibold">{stats.verses}</span> verses
                </span>
                {coverage &&
                <>
                    <span className="text-muted-foreground/40">·</span>
                    <span title={`${coverage.connected} of ${coverage.total} verses connected in ${semanticMode} mode`}>
                      <span
                      className={`font-semibold ${
                      coverage.pct >= 70 ?
                      'text-emerald-400' :
                      coverage.pct >= 40 ?
                      'text-yellow-400' :
                      'text-red-400'}`
                      }>

                        {coverage.pct}%
                      </span>{' '}
                      coverage
                    </span>
                  </>
                }
              </div>

              <div className="glass-panel hidden md:flex px-3 py-2 text-xs text-muted-foreground items-center gap-2">
                <span>Visitors</span>
                <span className="text-primary font-semibold">
                  {visitorCount != null ? visitorCount.toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {selectedNode && selectedVerse &&
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel px-4 py-2 hidden md:flex items-center gap-3 max-w-lg">

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
                title="Read details">

                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </button>
              </motion.div>
            }

            


          </motion.div>

          {/* Mobile FAB Controls */}
          <MobileControlsFab
            semanticMode={semanticMode}
            onModeChange={setSemanticMode}
            showIsolated={showIsolated}
            onToggleIsolated={() => setShowIsolated((v) => !v)}
            onAboutOpen={() => setAboutOpen(true)}
            onResetView={() => graphRef.current?.resetView()}
            visitorCount={visitorCount}
            focusLevel={
              semanticMode === 'root' ? rootFocusLevel :
              semanticMode === 'concept' ? conceptFocusLevel :
              semanticMode === 'action' ? actionFocusLevel :
              contrastFocusLevel
            }
            onFocusLevelChange={(level) => {
              if (semanticMode === 'root') handleRootFocusLevel(level as RootFocusLevel);
              else if (semanticMode === 'concept') handleConceptFocusLevel(level as ConceptFocusLevel);
              else if (semanticMode === 'action') handleActionFocusLevel(level as ActionFocusLevel);
              else handleContrastFocusLevel(level as ContrastFocusLevel);
            }}
          />

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
            onActionFilter={handleActionFilter} />

          <AnimatePresence>
            {aboutOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
                style={{ zIndex: 60 }}
                onClick={() => setAboutOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="glass-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 text-sm text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">AyaMakna - Qur'anic Semantic Intelligence System</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        AyaMakna is a web application that tried to reveal hidden structural and thematic patterns in the Qur'an through computational semantic analysis. All 6,236 verses across 114 surahs are loaded, processed, and visualized as an interactive force graph. Each view mode exposes a different layer of meaning.
                      </p>
                    </div>
                    <button
                      onClick={() => setAboutOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/80">Disclaimer</div>
                      <p className="mt-2">
                        This project is a computational exploration of the Qur'anic text using root analysis, semantic clustering, and graph-based modeling.
                      </p>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/80">It is intended as</div>
                      <ul className="mt-2 list-disc pl-4">
                        <li>A research and educational tool</li>
                        <li>A structural and linguistic visualization system</li>
                        <li>A semantic analysis experiment</li>
                      </ul>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/80">It is not</div>
                      <ul className="mt-2 list-disc pl-4">
                        <li>A tafsir (exegetical interpretation)</li>
                        <li>A theological authority</li>
                        <li>A replacement for classical scholarship</li>
                        <li>A definitive explanation of meaning</li>
                      </ul>
                    </div>

                    <p>
                      All semantic groupings, behavioral classifications, contrast pairings, and centrality measures are derived through algorithmic and linguistic modeling. They reflect structural patterns in the corpus and may not fully capture traditional interpretive nuance.
                    </p>
                    <p></p>
                    <code><strong><i>
                      This project does not claim doctrinal authority and does not promote any specific theological position. Users are encouraged to consult qualified scholars and classical sources for religious guidance and interpretation.
                    </i></strong></code>
                    <p></p>
      
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/80">Sources</div>
                      <ul className="mt-2 list-disc pl-4">
                        <li>Arabic: quran.com</li>
                        <li>Translation (EN): Saheeh International</li>
                        <li>Translation (ID): King Fahad Quran Complex</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span><i>Powered by Petalytix</i></span>
                    <a
                      href="https://github.com/umarfadhil/ayamakna"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="GitHub"
                    >
                      <Github className="w-4 h-4" />
                      GitHub
                    </a>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </>
      </AnimatePresence>
    </div>);

};

export default Index;
