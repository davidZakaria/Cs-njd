import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function CsAgentPreviewBanner({
  previewSourceEmail,
}: {
  previewSourceEmail: string;
}) {
  const t = await getTranslations("csPreview");

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{t("banner", { sourceEmail: previewSourceEmail })}</p>
      </div>
    </div>
  );
}
