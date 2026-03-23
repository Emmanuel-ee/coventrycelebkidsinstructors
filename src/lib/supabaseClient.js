import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

const getConfigMessage = () => {
  if (!supabaseUrl && !supabaseAnonKey) {
    return 'Missing REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local.';
  }
  if (!supabaseUrl) {
    return 'Missing REACT_APP_SUPABASE_URL in .env.local.';
  }
  if (!supabaseAnonKey) {
    return 'Missing REACT_APP_SUPABASE_ANON_KEY in .env.local.';
  }
  if (supabaseUrl.startsWith('postgres://')) {
    return 'Supabase URL should be the project HTTPS URL, not the Postgres connection string.';
  }
  if (!supabaseAnonKey.startsWith('eyJ')) {
    return 'Supabase anon key should be the JWT anon public key from Project Settings → API.';
  }
  return '';
};

export const supabaseConfigMessage = getConfigMessage();

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabasePublic = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  : null;
