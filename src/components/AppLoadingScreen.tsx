import { Loader2, PlayCircle } from "lucide-react";

/**
 * Branded full-screen loading state used while auth/session initialization
 * is in flight. Deliberately shows the product name and a spinner rather
 * than an empty dark viewport, which is indistinguishable from a crash.
 */
export default function AppLoadingScreen({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight">StreamVault</span>
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
