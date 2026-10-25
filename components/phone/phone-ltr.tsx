import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Tailwind classes for phone inputs in RTL layouts (digits stay LTR, align to field end). */
export const phoneLtrInputClassName = "text-end";

export function mergePhoneInputClassName(className?: string) {
  return cn(phoneLtrInputClassName, className);
}

export const phoneLtrInputDir = "ltr" satisfies ComponentProps<"input">["dir"];

export function PhoneLtrText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi
      dir="ltr"
      className={cn(
        "inline-block text-end [unicode-bidi:isolate]",
        className
      )}
    >
      {children}
    </bdi>
  );
}
