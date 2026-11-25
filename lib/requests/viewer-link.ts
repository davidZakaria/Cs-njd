import type { Role, UnitRequestType } from "@prisma/client";

/** In-app link for opening a unit request from notifications or escalations. */
export function unitRequestViewerLinkForRole(
  role: Role,
  requestId: string,
  type: UnitRequestType
): string {
  if (role === "OPERATIONS") {
    if (type === "ARCHIVE_CHECK") {
      return `/operations/archive-checks/${requestId}`;
    }
    if (type === "ARCHIVE_FILE_REQUEST") {
      return `/operations/requests/${requestId}`;
    }
  }
  return `/requests/${requestId}`;
}