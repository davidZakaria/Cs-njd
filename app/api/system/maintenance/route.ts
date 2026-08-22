import { getMaintenanceMode } from "@/lib/system/maintenance-mode";

export async function GET() {
  const enabled = await getMaintenanceMode();
  return Response.json({ enabled });
}
