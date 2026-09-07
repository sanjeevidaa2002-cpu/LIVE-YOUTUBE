import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Inline error surface for failed data fetches. Distinguishes "we couldn't
 * load this" from "there's nothing here" — showing an empty state when the
 * request actually failed misrepresents the problem to the user.
 */
export default function ErrorState({
  title = "Couldn't load this content",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-14 text-center">
      <AlertTriangle className="mb-4 h-9 w-9 text-destructive" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5">
          <RotateCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
