import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/app-sidebar";
import { redirect } from "next/navigation";
import DashboardProviders from "./providers";
import { isPrivilegedRole } from "@/lib/auth/abac";
import { getAnnouncementConfig } from "@/lib/system/settings-store";
import { resolveLocale } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const session = await auth();
  if (!session?.user || session.error) {
    redirect(`/${safeLocale}/login?reason=session_expired`);
  }

  const announcement = await getAnnouncementConfig();
  const showAnnouncement = announcement.enabled && announcement.text.length > 0;

  return (
    <DashboardProviders
      userEmail={session.user.email ?? ""}
      securityGuardEnabled={!isPrivilegedRole(session.user.role)}
    >
      <DashboardShell
        role={session.user.role}
        announcementText={showAnnouncement ? announcement.text : null}
      >
        {children}
      </DashboardShell>
    </DashboardProviders>
  );
}
