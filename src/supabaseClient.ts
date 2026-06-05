import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'https://your-project-id.supabase.co' && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'your-anon-public-key'

if (!isConfigured) {
  console.warn("Supabase credentials are not configured or are using placeholders. Falling back to LocalStorage.")
}

export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder-id.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder-key'
)

export const isSupabaseConfigured = !!isConfigured
