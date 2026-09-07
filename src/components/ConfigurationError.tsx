import { AlertTriangle, PlayCircle } from "lucide-react";
import {
  hasMalformedSupabaseUrl,
  missingSupabaseEnvVars,
} from "@/lib/supabase";

/**
 * Shown instead of the app when the Supabase environment variables are
 * absent or malformed. Without this, `createClient()` throwing at module
 * scope would leave an empty #root over the dark body background — a
 * completely black page with no explanation of what went wrong.
 *
 * Only variable NAMES are ever displayed here, never their values.
 */
export default function ConfigurationError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <PlayCircle className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">StreamVault</span>
        </div>

        <div className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-xl sm:p-8">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h1 className="text-lg font-semibold">Configuration required</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The app can&apos;t start because its Supabase connection settings are
                missing from this build.
              </p>
            </div>
          </div>

          {missingSupabaseEnvVars.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">Missing environment variables</p>
              <ul className="space-y-1">
                {missingSupabaseEnvVars.map((name) => (
                  <li
                    key={name}
                    className="rounded-md border border-border bg-secondary/60 px-3 py-2 font-mono text-xs"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasMalformedSupabaseUrl && (
            <div className="mb-4 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs">
              <span className="font-mono">VITE_SUPABASE_URL</span> is set but is not a
              valid http(s) URL. It should look like{" "}
              <span className="font-mono">https://your-project.supabase.co</span>.
            </div>
          )}

          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="mb-2 text-sm font-medium">How to fix</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
              <li>
                Locally: copy <span className="font-mono text-xs">.env.example</span> to{" "}
                <span className="font-mono text-xs">.env</span> and fill in both values
                from Supabase → Settings → API.
              </li>
              <li>
                This repo ships a committed{" "}
                <span className="font-mono text-xs">.env.production</span>, so a fresh
                build should already have these values.
              </li>
              <li>
                If you see this screen anyway, check Vercel → Project Settings →
                Environment Variables for an{" "}
                <strong className="text-foreground">empty or wrong value</strong> of
                either name — a variable set there overrides the committed file, and an
                empty one shadows the good value.
              </li>
              <li>
                <strong className="text-foreground">Redeploy after any change.</strong>{" "}
                Vite embeds these values at build time, so an existing build will never
                pick them up — and a cached browser tab may still show an old bundle.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
