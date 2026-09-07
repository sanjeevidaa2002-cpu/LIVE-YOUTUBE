import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const supabaseUrl = rawUrl?.trim() ?? "";
const supabaseAnonKey = rawKey?.trim() ?? "";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Which required environment variables are missing or malformed.
 * Vite inlines `import.meta.env.VITE_*` at BUILD time, so if these were not
 * present in the build environment (e.g. Vercel project settings) they are
 * `undefined` in the shipped bundle no matter what the runtime environment
 * looks like.
 */
export const missingSupabaseEnvVars: string[] = [
  ...(supabaseUrl ? [] : ["VITE_SUPABASE_URL"]),
  ...(supabaseAnonKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
];

export const hasMalformedSupabaseUrl =
  supabaseUrl.length > 0 && !isValidHttpUrl(supabaseUrl);

export const isSupabaseConfigured =
  missingSupabaseEnvVars.length === 0 && !hasMalformedSupabaseUrl;

// Boot diagnostic. Prints only whether each value is present — never the
// values themselves — so a production deployment can be checked from the
// browser console without disclosing anything.
console.info(
  `[StreamVault] Supabase URL configured: ${supabaseUrl ? "YES" : "NO"}\n` +
    `[StreamVault] Supabase publishable key configured: ${supabaseAnonKey ? "YES" : "NO"}`,
);

if (!isSupabaseConfigured) {
  // Log for developers, but DO NOT throw. A module-level throw here would
  // propagate through the import chain (supabase -> AuthContext -> App ->
  // main) before React ever mounts, leaving an empty #root over the dark
  // body background — i.e. a completely black screen with no explanation.
  // Instead the app renders <ConfigurationError /> so the failure is visible.
  console.error(
    "[StreamVault] Supabase is not configured correctly.\n" +
      (missingSupabaseEnvVars.length
        ? `Missing environment variable(s): ${missingSupabaseEnvVars.join(", ")}.\n`
        : "") +
      (hasMalformedSupabaseUrl
        ? `VITE_SUPABASE_URL is not a valid http(s) URL.\n`
        : "") +
      "Set these in your hosting provider's environment variables (and in a " +
      "local .env file) and REBUILD — Vite bakes them in at build time.",
  );
}

// When configuration is absent we still construct a client so that every
// module importing `supabase` can load without throwing. It points at an
// unroutable placeholder host; the UI gates all Supabase usage behind
// `isSupabaseConfigured`, so this client is never actually exercised.
const clientUrl = isSupabaseConfigured ? supabaseUrl : "https://unconfigured.invalid";
const clientKey = isSupabaseConfigured ? supabaseAnonKey : "unconfigured-anon-key";

/**
 * Every Supabase request goes through this wrapper so a request that never
 * settles (captive portal, dropped mobile connection, blocked host) fails
 * with a readable error instead of hanging forever — which would otherwise
 * leave the UI on a skeleton or spinner indefinitely.
 *
 * Implemented with AbortController + setTimeout rather than
 * AbortSignal.timeout()/AbortSignal.any() so it works on older mobile
 * browsers too.
 *
 * Note: this does not affect video/thumbnail uploads, which use a separate
 * XHR transport in storageService.ts (large uploads legitimately exceed
 * this timeout).
 */
const REQUEST_TIMEOUT_MS = 20_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((err: unknown) => {
      if (controller.signal.aborted && !callerSignal?.aborted) {
        throw new Error(
          `The server did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. ` +
            "Please check your connection and try again.",
        );
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
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
export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
