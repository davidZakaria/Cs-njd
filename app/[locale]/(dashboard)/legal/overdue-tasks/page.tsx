import { DepartmentOverdueTasksScreen } from "@/components/unit-cycle/department-overdue-tasks-screen";

export const dynamic = "force-dynamic";

export default async function LegalOverdueTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DepartmentOverdueTasksScreen role="LEGAL" searchParams={await searchParams} />
  );
}
