import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing Supabase environment variables. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

// This client only ever holds the public/publishable (anon) key. It must
// NEVER be initialized with the service role / secret key — every
// privileged operation is instead enforced by Postgres RLS policies and
// SECURITY DEFINER functions declared in supabase/schema.sql.
//
// Note: we intentionally do not parametrize createClient<Database> here.
// supabase-js's generated-types generic requires a specific PostgREST
// introspection shape; our hand-written Database type (see
// src/types/database.ts) documents the schema but each service function
// applies its own explicit result types instead, which keeps this project
// buildable without depending on `supabase gen types`.
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
