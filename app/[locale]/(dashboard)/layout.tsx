import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/app-sidebar";
import { redirect } from "next/navigation";
import DashboardProviders from "./providers";
import { getAnnouncementConfig } from "@/lib/system/settings-store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/en/login");
  }

  const announcement = await getAnnouncementConfig();
  const showAnnouncement = announcement.enabled && announcement.text.length > 0;

  return (
    <DashboardProviders>
      <DashboardShell
        role={session.user.role}
        announcementText={showAnnouncement ? announcement.text : null}
      >
        {children}
      </DashboardShell>
    </DashboardProviders>
  );
}
