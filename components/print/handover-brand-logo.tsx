import type { ReactNode } from "react";

import { JCommunitiesLogo } from "@/components/brand/j-communities-logo";
import { cn } from "@/lib/utils";

export function HandoverBrandLogo({ className }: { className?: string }) {
  return (
    <JCommunitiesLogo
      variant="light-ui"
      height={48}
      className={cn(
        "mx-auto max-w-[11rem] shrink-0 object-center print:h-[14mm] print:max-w-[52mm]",
        className
      )}
    />
  );
}

export function HandoverProtocolHeader({
  accentClass,
  children,
}: {
  accentClass: string;
  children: ReactNode;
}) {
  return (
    <header className={cn("mb-4 border-b-2 pb-3", accentClass)}>
      <div className="mb-3 flex justify-center">
        <HandoverBrandLogo className="h-14 max-w-[11rem] print:h-[16mm] print:max-w-[52mm]" />
      </div>
      <div className="text-center">{children}</div>
    </header>
  );
}
