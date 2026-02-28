
-- Single-row table to hold the cumulative visitor count
CREATE TABLE public.ayamakna_stats (
  id text PRIMARY KEY DEFAULT 'global',
  visitor_count bigint NOT NULL DEFAULT 0
);

-- Seed with current known count
INSERT INTO public.ayamakna_stats (id, visitor_count) VALUES ('global', 51);

-- Enable RLS
ALTER TABLE public.ayamakna_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read the count
CREATE POLICY "Anyone can read stats"
  ON public.ayamakna_stats FOR SELECT USING (true);

-- No direct writes from client — only edge function (service role) can update
-- Atomic increment function
CREATE OR REPLACE FUNCTION public.increment_visitor_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  UPDATE ayamakna_stats
    SET visitor_count = visitor_count + 1
    WHERE id = 'global'
    RETURNING visitor_count INTO new_count;
  RETURN new_count;
END;
$$;
