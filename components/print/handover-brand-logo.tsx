import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const NJD_LOGO_SRC = "/brand/njd-logo.png";

export function HandoverBrandLogo({ className }: { className?: string }) {
  return (
    // Native img for reliable print/PDF output (Next/Image can skip in print).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={NJD_LOGO_SRC}
      alt="New Jersey Development"
      className={cn(
        "h-12 w-auto max-w-[7.5rem] shrink-0 object-contain object-center print:h-[14mm] print:max-w-[42mm]",
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
      <div className="flex items-center justify-between gap-4">
        <HandoverBrandLogo />
        <div className="min-w-0 flex-1 text-center">{children}</div>
        <HandoverBrandLogo />
      </div>
    </header>
  );
}
