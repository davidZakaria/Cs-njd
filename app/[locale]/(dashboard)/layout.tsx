import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/app-sidebar";
import { redirect } from "next/navigation";
import DashboardProviders from "./providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/en/login");
  }

  return (
    <DashboardProviders>
      <DashboardShell role={session.user.role}>{children}</DashboardShell>
    </DashboardProviders>
  );
}
