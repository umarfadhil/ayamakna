function resolveEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    console.error('Missing Supabase env vars.');
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_ equivalents).');
    process.exit(1);
  }

  return { url, anonKey };
}

export function getSupabaseEnv() {
  return resolveEnv();
}
