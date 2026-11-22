import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { LOCALE_IDENTIFIER_DATA_ATTR } from "@/lib/format/locale-display";

/** Tailwind classes for phone inputs in RTL layouts (digits stay LTR, align to field end). */
export const phoneLtrInputClassName = "text-end";

export function mergePhoneInputClassName(className?: string) {
  return cn(phoneLtrInputClassName, className);
}

export const phoneLtrInputDir = "ltr" satisfies ComponentProps<"input">["dir"];

export function PhoneLtrText({
  children,
  className,
  markAsIdentifier = true,
}: {
  children: ReactNode;
  className?: string;
  /** Phones stay Western + LTR; excluded from ar digit lint. */
  markAsIdentifier?: boolean;
}) {
  return (
    <bdi
      dir="ltr"
      {...(markAsIdentifier ? { [LOCALE_IDENTIFIER_DATA_ATTR]: "phone" } : {})}
      className={cn(
        "inline-block text-end [unicode-bidi:isolate]",
        className
      )}
    >
      {children}
    </bdi>
  );
}

export function LocaleIdentifierText({
  kind,
  children,
  className,
}: {
  kind: "phone" | "nationalId" | "unitCode";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      {...{ [LOCALE_IDENTIFIER_DATA_ATTR]: kind }}
      className={className}
    >
      {children}
    </span>
  );
}
