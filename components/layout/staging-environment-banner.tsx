import { AlertTriangle } from "lucide-react";

export function StagingEnvironmentBanner() {
  return (
    <div
      className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100"
      role="status"
      data-testid="staging-environment-banner"
    >
      <span className="inline-flex items-center justify-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Staging environment — fake data only. Changes here do not affect production.
      </span>
    </div>
  );
}