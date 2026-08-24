import { cn } from "@/lib/utils";

type NjdMarkProps = {
  className?: string;
  size?: number;
};

/** NJD Post-Sales CRM brand mark — building with service badge. */
export function NjdMark({ className, size = 32 }: NjdMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" fill="#0F172A" />
      <path
        d="M8 24V12.2l8-4.8 8 4.8V24H8Z"
        fill="#E2E8F0"
      />
      <path
        d="M8 12.2 16 7.4l8 4.8"
        stroke="#D4AF37"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11" y="14.5" width="3" height="3" rx="0.6" fill="#0F172A" />
      <rect x="18" y="14.5" width="3" height="3" rx="0.6" fill="#0F172A" />
      <rect x="11" y="19.5" width="3" height="3" rx="0.6" fill="#0F172A" />
      <rect x="18" y="19.5" width="3" height="3" rx="0.6" fill="#0F172A" />
      <rect x="14.2" y="21.8" width="3.6" height="2.2" rx="0.4" fill="#0F172A" />
      <circle cx="24.2" cy="24.2" r="5.2" fill="#D4AF37" />
      <path
        d="M22.1 24.2 23.6 25.7 26.5 22.6"
        stroke="#0F172A"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
