import type {
  HandoverStatus,
  PendingParty,
  TicketStatus,
  FinishingPhase,
} from "@prisma/client";
import { isDeliveryProtocolSigned } from "@/lib/import/master-cases";
import { normalizeMatchText } from "@/lib/import/fuzzy-match";
import {
  evaluateResolutionGates,
  type ResolutionGateCode,
} from "@/lib/workflow/resolution-gates";

export type ImportChecklistInput = {
  handoverRaw?: unknown;
  handoverStatus: HandoverStatus;
  doorFees?: number | null;
  aluminumFees?: number | null;
  actionLabel?: string;
};

export function deriveHandoverChecklist(input: ImportChecklistInput) {
  const handoverText = String(input.handoverRaw ?? "");
  const hasSignedProtocol =
    isDeliveryProtocolSigned(handoverText) ||
    input.handoverStatus === "DELIVERY_PROTOCOL" ||
    input.handoverStatus === "DELIVERED";

  const textNorm = normalizeMatchText(handoverText);
  const actionNorm = normalizeMatchText(input.actionLabel ?? "");
  const hasSignedExtension =
    input.handoverStatus === "DELIVERY_EXTENSION" ||
    textNorm.includes(normalizeMatchText("تم توقيع ملحق")) ||
    textNorm.includes(normalizeMatchText("توقيع ملحق")) ||
    actionNorm.includes(normalizeMatchText("ملحق"));

  const door = input.doorFees ?? 0;
  const aluminum = input.aluminumFees ?? 0;
  const hasFees = door > 0 || aluminum > 0;
  const combinedText = normalizeMatchText(
    `${handoverText} ${input.actionLabel ?? ""}`
  );
  const feesMarkedPaid = ["تم سداد", "سداد", "paid", "تم الدفع"].some((keyword) =>
    combinedText.includes(normalizeMatchText(keyword))
  );
  const hasPaidFees = !hasFees || feesMarkedPaid;

  const papersMissing = ["لم يتم استلام", "في انتظار اوراق", "dhl", "شحن"].some(
    (keyword) => combinedText.includes(normalizeMatchText(keyword))
  );
  const papersReceived = hasSignedProtocol && !papersMissing;

  return {
    hasSignedProtocol,
    hasSignedExtension,
    hasPaidFees,
    papersReceived,
  };
}

export function inferPendingPartyFromText(
  ...texts: (string | undefined)[]
): PendingParty {
  const combined = normalizeMatchText(texts.filter(Boolean).join(" "));
  if (!combined) return "NONE";

  const rules: Array<[PendingParty, string[]]> = [
    ["LOGISTICS", ["dhl", "شحن", "لوجست", "logistics", "shipping"]],
    ["FINANCE", ["مصاريف", "حساب", "سداد", "finance", "fees"]],
    ["LEGAL", ["قانون", "legal", "انذار", "إنذار", "dispute"]],
    [
      "ENGINEERING",
      ["هندس", "engineering", "تشطيب", "كهرب", "سباك", "snag", "محارة"],
    ],
    ["MANAGEMENT", ["ادارة", "إدارة", "management"]],
    ["CLIENT", ["عميل", "client", "في انتظار", "awaiting", "waiting"]],
  ];

  for (const [party, keywords] of rules) {
    if (keywords.some((keyword) => combined.includes(normalizeMatchText(keyword)))) {
      return party;
    }
  }

  return "NONE";
}

function pendingPartyFromGate(code: ResolutionGateCode): PendingParty {
  switch (code) {
    case "finishing_not_done":
      return "ENGINEERING";
    case "fees_unpaid":
      return "FINANCE";
    case "missing_papers":
      return "LOGISTICS";
    default:
      return "NONE";
  }
}

export type ImportGateContext = {
  finishing: {
    phases: FinishingPhase[];
    doorFees: number | null;
    aluminumFees: number | null;
  } | null;
  contractWorkflow: {
    hasSignedProtocol: boolean;
    hasSignedExtension: boolean;
    hasPaidFees: boolean;
    papersReceived: boolean;
    handoverStatus: HandoverStatus;
  } | null;
};

export function reconcileImportCaseStatus(
  proposedStatus: TicketStatus,
  proposedNotes: string,
  ctx: ImportGateContext,
  existingPendingParty?: PendingParty | null
): { status: TicketStatus; pendingParty: PendingParty } {
  let pendingParty =
    inferPendingPartyFromText(proposedNotes) !== "NONE"
      ? inferPendingPartyFromText(proposedNotes)
      : (existingPendingParty ?? "NONE");

  if (proposedStatus === "LEGAL" && pendingParty === "NONE") {
    pendingParty = "LEGAL";
  }
  if (proposedStatus === "ENGINEERING" && pendingParty === "NONE") {
    pendingParty = "ENGINEERING";
  }

  if (proposedStatus !== "RESOLVED") {
    return { status: proposedStatus, pendingParty };
  }

  const failures = evaluateResolutionGates({
    ticket: { pendingParty },
    finishing: ctx.finishing,
    contractWorkflow: ctx.contractWorkflow,
  });

  if (failures.length === 0) {
    return { status: "RESOLVED", pendingParty: "NONE" };
  }

  for (const failure of failures) {
    const gateParty = pendingPartyFromGate(failure);
    if (gateParty !== "NONE") {
      pendingParty = gateParty;
      break;
    }
  }

  let status: TicketStatus = "PENDING";
  if (pendingParty === "LEGAL" || inferPendingPartyFromText(proposedNotes) === "LEGAL") {
    status = "LEGAL";
  } else if (
    failures.includes("finishing_not_done") ||
    pendingParty === "ENGINEERING"
  ) {
    status = "ENGINEERING";
  }

  return { status, pendingParty };
}
