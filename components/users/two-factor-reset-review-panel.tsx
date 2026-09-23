"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, ShieldX } from "lucide-react";

import {
  approveUser2FAResetRequest,
  rejectUser2FAResetRequest,
} from "@/lib/actions/two-factor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TwoFactorResetReviewPanel({
  userId,
  userName,
  userEmail,
  userRole,
  requestedAtLabel,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  requestedAtLabel: string;
}) {
  const t = useTranslations("users.twoFactorResetReview");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending(true);
    setError(null);
    const result = await approveUser2FAResetRequest(userId);
    setPending(false);
    if (!result.success) {
      setError(
        result.error === "NO_PENDING_REQUEST"
          ? t("noPendingDescription")
          : (result.error ?? t("actionFailed"))
      );
      return;
    }
    setOutcome("approved");
  }

  async function handleReject() {
    setPending(true);
    setError(null);
    const result = await rejectUser2FAResetRequest(userId);
    setPending(false);
    if (!result.success) {
      setError(
        result.error === "NO_PENDING_REQUEST"
          ? t("noPendingDescription")
          : (result.error ?? t("actionFailed"))
      );
      return;
    }
    setOutcome("rejected");
  }

  if (outcome === "approved") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{t("approvedTitle")}</CardTitle>
          <CardDescription>{t("approvedDescription", { name: userName })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => router.push("/users")}>
            {t("backToUsers")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (outcome === "rejected") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{t("rejectedTitle")}</CardTitle>
          <CardDescription>{t("rejectedDescription", { name: userName })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => router.push("/users")}>
            {t("backToUsers")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("fieldName")}</dt>
            <dd className="font-medium">{userName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("fieldEmail")}</dt>
            <dd className="font-medium">{userEmail}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("fieldRole")}</dt>
            <dd className="font-medium">{userRole}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("fieldRequested")}</dt>
            <dd className="font-medium">{requestedAtLabel}</dd>
          </div>
        </dl>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            disabled={pending}
            onClick={() => void handleApprove()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t("approveYes")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => void handleReject()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldX className="size-4" />
            )}
            {t("rejectNo")}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={() => window.close()}
        >
          {tCommon("cancel")}
        </Button>
      </CardContent>
    </Card>
  );
}
