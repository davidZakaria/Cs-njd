import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LocaleHomePage() {
  redirect({ href: "/dashboard", locale: routing.defaultLocale });
}
