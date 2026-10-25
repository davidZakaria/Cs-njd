"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  countryFlagEmoji,
  detectPhoneCountry,
  localizedCountryName,
} from "@/lib/phone/detect-country";
import { cn } from "@/lib/utils";

export function PhoneCountryBadge({
  phone,
  className,
}: {
  phone: string | null | undefined;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("client.phoneCountry");

  const label = useMemo(() => {
    const trimmed = phone?.trim();
    if (!trimmed) return null;

    const detection = detectPhoneCountry(trimmed);
    if (detection.isUnknown || !detection.countryCode) {
      return { flag: "", name: t("unknown") };
    }

    return {
      flag: countryFlagEmoji(detection.countryCode),
      name: localizedCountryName(detection.countryCode, locale),
    };
  }, [locale, phone, t]);

  if (!label) return null;

  return (
    <Badge
      variant="secondary"
      className={cn("max-w-full shrink-0 font-normal", className)}
      title={label.name}
    >
      {label.flag ? <span aria-hidden>{label.flag}</span> : null}
      <span className="truncate">{label.name}</span>
    </Badge>
  );
}
