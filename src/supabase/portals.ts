import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// -- SUPABASE portal schema:
// DROP TABLE IF EXISTS portals CASCADE;

// CREATE TABLE portals (
//   latitude DECIMAL(10, 8) NOT NULL,
//   longitude DECIMAL(11, 8) NOT NULL,
//   user_id TEXT NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
//   PRIMARY KEY (latitude, longitude)
// );

// -- Enable RLS
// ALTER TABLE portals ENABLE ROW LEVEL SECURITY;

// -- Simple read policy
// CREATE POLICY "Anyone can read portals" ON portals FOR SELECT USING (true);
// CREATE POLICY "Anyone can create portals" ON portals FOR INSERT WITH CHECK (true);

// -- Grant permissions
// GRANT ALL ON portals TO anon, authenticated;