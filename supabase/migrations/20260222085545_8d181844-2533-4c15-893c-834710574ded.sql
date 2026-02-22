
-- Create table for precomputed action edges
CREATE TABLE public.ayamakna_action_edges (
  id text PRIMARY KEY,
  verse_id text NOT NULL REFERENCES public.ayamakna_verses(id),
  actor_type text NOT NULL,
  action_root text NOT NULL,
  target_type text,
  tense text NOT NULL,
  verb_text text NOT NULL,
  english_meaning text,
  root_frequency integer,
  semantic_cluster text,
  polarity text NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX idx_action_edges_verse_id ON public.ayamakna_action_edges(verse_id);
CREATE INDEX idx_action_edges_semantic_cluster ON public.ayamakna_action_edges(semantic_cluster);
CREATE INDEX idx_action_edges_actor_type ON public.ayamakna_action_edges(actor_type);

-- Enable RLS with public read-only access
ALTER TABLE public.ayamakna_action_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for action edges"
  ON public.ayamakna_action_edges
  FOR SELECT
  USING (true);
