import { cn } from "@/lib/utils";

type JCommunitiesLogoProps = {
  className?: string;
  /** Render height in pixels; width follows aspect ratio. */
  height?: number;
  /** Force palette (e.g. print on white paper). */
  variant?: "light-ui" | "dark-ui";
};

const VIEWBOX_WIDTH = 252;
const VIEWBOX_HEIGHT = 34;

const paletteByVariant = {
  "light-ui":
    "[--logo-mark:#5c6778] [--logo-mark-letter:#eef1f4] [--logo-word:#2f3844]",
  "dark-ui":
    "[--logo-mark:#c5cdd6] [--logo-mark-letter:#1a2332] [--logo-word:#eef1f4]",
  auto: "[--logo-mark:#5c6778] [--logo-mark-letter:#eef1f4] [--logo-word:#2f3844] dark:[--logo-mark:#c5cdd6] dark:[--logo-mark-letter:#1a2332] dark:[--logo-word:#eef1f4]",
} as const;

/** J Communities wordmark — transparent SVG, theme-aware (no PNG black bar). */
export function JCommunitiesLogo({
  className,
  height = 36,
  variant,
}: JCommunitiesLogoProps) {
  const width = (height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT;
  const paletteClass =
    variant === "light-ui"
      ? paletteByVariant["light-ui"]
      : variant === "dark-ui"
        ? paletteByVariant["dark-ui"]
        : paletteByVariant.auto;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={width}
      height={height}
      className={cn("max-w-full shrink-0", paletteClass, className)}
      role="img"
      aria-label="J Communities"
    >
      <title>J Communities</title>
      <rect
        x="0"
        y="1"
        width="32"
        height="32"
        fill="var(--logo-mark)"
      />
      <text
        x="16"
        y="24.5"
        textAnchor="middle"
        fill="var(--logo-mark-letter)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="22"
      >
        J
      </text>
      <text
        x="27"
        y="7.5"
        fill="var(--logo-word)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="5.5"
      >
        TM
      </text>
      <text
        x="40"
        y="24"
        fill="var(--logo-word)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="18.5"
        letterSpacing="0.08em"
      >
        COMMUNITIES
      </text>
    </svg>
  );
}
