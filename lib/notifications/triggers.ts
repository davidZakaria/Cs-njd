import {
  getActiveEngineerUserId,
  notifyRoles,
  notifyUser,
} from "@/lib/services/notifications";

export async function notifyInboundCall({
  agentUserId,
  unitCode,
  unitId,
  callerName,
}: {
  agentUserId: string;
  unitCode: string;
  unitId: string;
  callerName: string;
}) {
  await notifyUser(
    agentUserId,
    "Inbound Call",
    "مكالمة واردة",
    `${callerName} logged a call for your client on Unit ${unitCode}.`,
    `قام ${callerName} بتسجيل مكالمة لعميلك في الوحدة ${unitCode}.`,
    `/units/${unitId}`
  );
}

export async function notifyUnitAssigned({
  agentUserId,
  unitCode,
  unitId,
}: {
  agentUserId: string;
  unitCode: string;
  unitId: string;
}) {
  await notifyUser(
    agentUserId,
    "New Unit Assigned",
    "إسناد وحدة جديدة",
    `You have been assigned to Unit ${unitCode}.`,
    `تم إسناد الوحدة ${unitCode} إليك.`,
    `/units/${unitId}`
  );
}

export async function notifyEngineeringTask({
  unitCode,
  unitId,
  engineerUserId,
}: {
  unitCode: string;
  unitId: string;
  engineerUserId?: string | null;
}) {
  const targetId = engineerUserId ?? (await getActiveEngineerUserId());
  if (!targetId) return;

  await notifyUser(
    targetId,
    "Engineering Task",
    "مهمة هندسية",
    `Unit ${unitCode} has been assigned to you for finishes.`,
    `تم إسناد الوحدة ${unitCode} إليك لتحديث التشطيبات.`,
    `/engineering/units/${unitId}`
  );
}

export async function notifySiteUpdate({
  agentUserId,
  unitCode,
  unitId,
  engineerName,
}: {
  agentUserId: string;
  unitCode: string;
  unitId: string;
  engineerName: string;
}) {
  await notifyUser(
    agentUserId,
    "Site Update",
    "تحديث من الموقع",
    `Eng. ${engineerName} updated finishes for Unit ${unitCode}.`,
    `قام م. ${engineerName} بتحديث تشطيبات الوحدة ${unitCode}.`,
    `/units/${unitId}?tab=timeline`
  );
}

export async function notifyLegalEscalation({
  unitCode,
  actorName,
}: {
  unitCode: string;
  actorName: string;
}) {
  await notifyRoles(
    ["MANAGEMENT", "SUPER_ADMIN"],
    "Legal Escalation ⚖️",
    "تصعيد قانوني ⚖️",
    `Unit ${unitCode} moved to Legal by ${actorName}.`,
    `تم تحويل الوحدة ${unitCode} إلى الشؤون القانونية.`,
    `/cases?status=LEGAL`
  );
}

export async function notifyUnitResolved({
  unitCode,
  actorName,
}: {
  unitCode: string;
  actorName: string;
}) {
  await notifyRoles(
    ["MANAGEMENT", "SUPER_ADMIN"],
    "Unit Resolved 🎉",
    "تم تسليم الوحدة 🎉",
    `Unit ${unitCode} has been successfully resolved by ${actorName}.`,
    `تم تسليم الوحدة ${unitCode} بنجاح.`,
    `/cases?status=RESOLVED`
  );
}

export async function notifyManagerOverride({
  agentUserId,
  unitCode,
  unitId,
}: {
  agentUserId: string;
  unitCode: string;
  unitId: string;
}) {
  await notifyUser(
    agentUserId,
    "Manager Override 👑",
    "إغلاق إداري 👑",
    `Management force-resolved your unit ${unitCode}.`,
    `قامت الإدارة بإغلاق تذكرة الوحدة ${unitCode} بصلاحيات استثنائية.`,
    `/units/${unitId}`
  );
}

export async function notifyFinishingUpdatedByAgent({
  unitCode,
  unitId,
  agentName,
  changesSummary,
}: {
  unitCode: string;
  unitId: string;
  agentName: string;
  changesSummary: string;
}) {
  await notifyRoles(
    ["MANAGEMENT", "SUPER_ADMIN"],
    "Finishing notes updated",
    "تحديث ملاحظات التشطيب",
    `${agentName} added finishing notes for Unit ${unitCode}: ${changesSummary}`,
    `قام ${agentName} بإضافة ملاحظات تشطيب للوحدة ${unitCode}: ${changesSummary}`,
    `/units/${unitId}?tab=financials`
  );
}

export async function notifyHandoverChecklistUpdatedByAgent({
  unitCode,
  unitId,
  agentName,
  changesSummary,
}: {
  unitCode: string;
  unitId: string;
  agentName: string;
  changesSummary: string;
}) {
  await notifyRoles(
    ["MANAGEMENT", "SUPER_ADMIN"],
    "Handover checklist updated",
    "تحديث قائمة الاستلام",
    `${agentName} updated handover checklist for Unit ${unitCode}: ${changesSummary}`,
    `قام ${agentName} بتحديث قائمة الاستلام للوحدة ${unitCode}: ${changesSummary}`,
    `/units/${unitId}?tab=legal`
  );
}

/** @deprecated Use lib/services/notifications.ts directly */
export {
  notifyInboundCall as notifyCallLogged,
  notifyUnitAssigned as notifyCaseAssigned,
  notifySiteUpdate as notifyEngineeringReturned,
};

export async function notifyCaseStatusUpdated({
  unitCode,
  status,
  agentName,
}: {
  unitCode: string;
  unitId: string;
  status: "LEGAL" | "RESOLVED";
  agentName: string;
}) {
  if (status === "LEGAL") {
    await notifyLegalEscalation({ unitCode, actorName: agentName });
    return;
  }
  await notifyUnitResolved({ unitCode, actorName: agentName });
}
