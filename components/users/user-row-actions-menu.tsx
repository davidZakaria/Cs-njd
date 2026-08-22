"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { deleteUserAction } from "@/lib/actions/auth";
import {
  forcePasswordResetByAdmin,
} from "@/lib/actions/crm";
import { setUserTwoFactorByAdmin } from "@/lib/actions/two-factor";
import {
  canDeleteUser,
  canEditUser,
  canForcePasswordReset,
  canResetUser2FA,
  hasAnyUserAction,
} from "@/lib/users/user-permissions";
import { useCrudToast } from "@/hooks/use-crud-toast";
import type { UserRow } from "@/components/users/types";
import { EditUserSheet } from "@/components/users/edit-user-sheet";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function UserRowActionsMenu({
  user,
  currentUserId,
  currentUserRole,
  isSuperAdmin,
}: {
  user: UserRow;
  currentUserId: string;
  currentUserRole: Role;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("users.toast");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();

  const actor = { id: currentUserId, role: currentUserRole };
  const target = {
    id: user.id,
    role: user.role,
    is2FAEnabled: user.is2FAEnabled,
    hasTwoFactorSecret: user.hasTwoFactorSecret,
  };

  const showEdit = canEditUser(actor, target);
  const showReset2FA = canResetUser2FA(actor, target);
  const showForcePassword = canForcePasswordReset(actor, target);
  const showDelete = canDeleteUser(actor, target);

  const [editOpen, setEditOpen] = useState(false);
  const [reset2faOpen, setReset2faOpen] = useState(false);
  const [forcePasswordOpen, setForcePasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!hasAnyUserAction(actor, target)) {
    return null;
  }

  function handleReset2FA() {
    runAction(
      async () => {
        const result = await setUserTwoFactorByAdmin(user.id, false);
        if (result.success) {
          setReset2faOpen(false);
          router.refresh();
        }
        return result;
      },
      "saved",
      tToast("twoFactorReset")
    );
  }

  function handleForcePasswordReset() {
    runAction(
      async () => {
        const result = await forcePasswordResetByAdmin(user.id);
        if (result.success) {
          setForcePasswordOpen(false);
          router.refresh();
        }
        return result;
      },
      "saved",
      tToast("passwordResetForced")
    );
  }

  function handleDelete() {
    runAction(
      async () => {
        const result = await deleteUserAction(user.id);
        if (result.success) {
          setDeleteOpen(false);
          router.refresh();
        }
        return result;
      },
      "deleted",
      tToast("userDeleted")
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "size-8 text-muted-foreground hover:text-foreground"
          )}
          aria-label={t("openUserActions", { name: user.name })}
          disabled={pending}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="min-w-48">
          {showEdit ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil />
              {t("editDetails")}
            </DropdownMenuItem>
          ) : null}
          {showReset2FA ? (
            <DropdownMenuItem onClick={() => setReset2faOpen(true)}>
              <ShieldOff />
              {t("resetTwoFactor")}
            </DropdownMenuItem>
          ) : null}
          {showForcePassword ? (
            <DropdownMenuItem onClick={() => setForcePasswordOpen(true)}>
              <KeyRound />
              {t("forcePasswordReset")}
            </DropdownMenuItem>
          ) : null}
          {showDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                {tCommon("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {showEdit ? (
        <EditUserSheet
          user={user}
          open={editOpen}
          onOpenChange={setEditOpen}
          isSuperAdmin={isSuperAdmin}
        />
      ) : null}

      <Dialog open={reset2faOpen} onOpenChange={setReset2faOpen}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{t("resetTwoFactorTitle")}</DialogTitle>
            <DialogDescription>
              {t("resetTwoFactorConfirm", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setReset2faOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleReset2FA}
            >
              {pending ? tCommon("loading") : t("resetTwoFactorAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forcePasswordOpen} onOpenChange={setForcePasswordOpen}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{t("forcePasswordResetTitle")}</DialogTitle>
            <DialogDescription>
              {t("forcePasswordResetConfirm", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setForcePasswordOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={handleForcePasswordReset}
            >
              {pending ? tCommon("loading") : t("forcePasswordResetAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{tCommon("confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {tCommon("confirmDelete", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? tCommon("loading") : tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
