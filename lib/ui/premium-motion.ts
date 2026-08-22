/** Shared motion tokens for dashboard / executive surfaces (Step 5). */

export const premiumCardHoverClass =
  "transition-all duration-300 ease-premium hover:-translate-y-1 hover:shadow-premium";

export const entranceAnimationClass =
  "animate-fade-up opacity-0 animate-fill-backwards";

const STAGGER_DELAYS = [
  "animate-delay-75",
  "animate-delay-100",
  "animate-delay-150",
  "animate-delay-200",
  "animate-delay-300",
  "animate-delay-400",
] as const;

export function staggerEntranceClass(index: number) {
  return STAGGER_DELAYS[index % STAGGER_DELAYS.length];
}
