"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Client-side deterrence only — cannot stop determined users from bypassing
 * DevTools or OS-level screenshots.
 */
export function ClientSecurityGuard({ userEmail }: { userEmail: string }) {
  const t = useTranslations("security");

  useEffect(() => {
    function notifyBlocked() {
      toast.warning(t("actionBlocked"));
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
      notifyBlocked();
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key;
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      const blocked =
        key === "F12" ||
        (ctrl && shift && (key === "I" || key === "J" || key === "C")) ||
        (ctrl && key === "U") ||
        (ctrl && key === "P") ||
        (event.metaKey && alt && key === "i") ||
        key === "PrintScreen";

      if (blocked) {
        event.preventDefault();
        notifyBlocked();
      }
    }

    async function onKeyUp(event: KeyboardEvent) {
      if (event.key !== "PrintScreen") return;
      try {
        await navigator.clipboard.writeText("Screenshots disabled");
      } catch {
        // Clipboard API may be unavailable.
      }
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [t]);

  const watermarkText = userEmail.trim() || "NJD CRM";

  return (
    <>
      <style jsx global>{`
        * {
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        input,
        textarea,
        [contenteditable="true"] {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9999] flex flex-wrap overflow-hidden opacity-[0.03] select-none"
      >
        {Array.from({ length: 48 }).map((_, index) => (
          <span
            key={index}
            className="rotate-[-24deg] px-8 py-6 text-sm font-medium whitespace-nowrap"
          >
            {watermarkText}
          </span>
        ))}
      </div>
    </>
  );
}
