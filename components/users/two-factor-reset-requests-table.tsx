"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Loader2, ShieldX } from "lucide-react";
import type { Role } from "@prisma/client";

import {
  approveUser2FAResetRequest,
  rejectUser2FAResetRequest,
} from "@/lib/actions/two-factor";
import { twoFactorResetReviewPath } from "@/lib/auth/two-factor-reset-links";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TwoFactorResetRequestRow = {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  requestedAtLabel: string;
};

const roleKeyMap: Record<
  Role,
  "superAdmin" | "management" | "csAgent" | "communityManagement" | "engineer"
> = {
  SUPER_ADMIN: "superAdmin",
  MANAGEMENT: "management",
  CS_AGENT: "csAgent",
  COMMUNITY_MANAGEMENT: "communityManagement",
  ENGINEER: "engineer",
};

export function TwoFactorResetRequestsTable({
  rows,
}: {
  rows: TwoFactorResetRequestRow[];
}) {
  const t = useTranslations("users.twoFactorResetRequests");
  const tReview = useTranslations("users.twoFactorResetReview");
  const tRoles = useTranslations("users.roles");
  const router = useRouter();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(userId: string) {
    setBusyUserId(userId);
    setError(null);
    const result = await approveUser2FAResetRequest(userId);
    setBusyUserId(null);
    if (!result.success) {
      setError(result.error ?? tReview("actionFailed"));
      return;
    }
    router.refresh();
  }

  async function handleReject(userId: string) {
    setBusyUserId(userId);
    setError(null);
    const result = await rejectUser2FAResetRequest(userId);
    setBusyUserId(null);
    if (!result.success) {
      setError(result.error ?? tReview("actionFailed"));
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 px-6 py-12 text-center">
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tReview("fieldName")}</TableHead>
              <TableHead>{tReview("fieldEmail")}</TableHead>
              <TableHead>{tReview("fieldRole")}</TableHead>
              <TableHead>{tReview("fieldRequested")}</TableHead>
              <TableHead className="text-end">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const busy = busyUserId === row.userId;
              return (
                <TableRow key={row.userId}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell>{row.userEmail}</TableCell>
                  <TableCell>{tRoles(roleKeyMap[row.userRole])}</TableCell>
                  <TableCell>{row.requestedAtLabel}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        render={
                          <Link
                            href={twoFactorResetReviewPath(row.userId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-3.5" />
                        {t("openReview")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleApprove(row.userId)}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        {tReview("approveYes")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleReject(row.userId)}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ShieldX className="size-3.5" />
                        )}
                        {tReview("rejectNo")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
