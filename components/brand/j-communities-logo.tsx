import { cn } from "@/lib/utils";

const LOGO_FOR_LIGHT_UI = "/brand/j-communities-light.png";
const LOGO_FOR_DARK_UI = "/brand/j-communities-dark.png";

type JCommunitiesLogoProps = {
  className?: string;
  /** Render height in pixels; width follows aspect ratio. */
  height?: number;
  /** Force one variant (e.g. print on white paper). */
  variant?: "light-ui" | "dark-ui";
};

/** J Communities wordmark — light/dark assets swap with site theme via CSS. */
export function JCommunitiesLogo({
  className,
  height = 36,
  variant,
}: JCommunitiesLogoProps) {
  const sizeStyle = { height, width: "auto" as const };

  if (variant === "light-ui") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_FOR_LIGHT_UI}
        alt="J Communities"
        style={sizeStyle}
        className={cn("max-w-full object-contain object-left", className)}
      />
    );
  }

  if (variant === "dark-ui") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_FOR_DARK_UI}
        alt="J Communities"
        style={sizeStyle}
        className={cn("max-w-full object-contain object-left", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex max-w-full items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_FOR_LIGHT_UI}
        alt="J Communities"
        style={sizeStyle}
        className="max-w-full object-contain object-left dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_FOR_DARK_UI}
        alt=""
        aria-hidden
        style={sizeStyle}
        className="hidden max-w-full object-contain object-left dark:block"
      />
    </span>
  );
}
