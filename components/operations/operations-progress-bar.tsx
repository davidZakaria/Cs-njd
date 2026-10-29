import { cn } from "@/lib/utils";

export function OperationsProgressBar({
  doneCount,
  applicableCount,
  className,
}: {
  doneCount: number;
  applicableCount: number;
  className?: string;
}) {
  const percent =
    applicableCount === 0 ? 100 : Math.round((doneCount / applicableCount) * 100);

  return (
    <div className={cn("flex min-w-[8rem] flex-col gap-1", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {doneCount}/{applicableCount}
      </span>
    </div>
  );
}
