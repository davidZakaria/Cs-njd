"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import {
  Ban,
  CheckCircle2,
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
import { adminChangeUserPassword, toggleUserStatus } from "@/lib/actions/users";
import { setUserTwoFactorByAdmin } from "@/lib/actions/two-factor";
import {
  canAdminChangePassword,
  canDeleteUser,
  canEditUser,
  canForcePasswordReset,
  canResetUser2FA,
  canToggleUserStatus,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    isActive: user.isActive,
    is2FAEnabled: user.is2FAEnabled,
    hasTwoFactorSecret: user.hasTwoFactorSecret,
  };

  const showEdit = canEditUser(actor, target);
  const showReset2FA = canResetUser2FA(actor, target);
  const showChangePassword = canAdminChangePassword(actor, target);
  const showForcePassword = canForcePasswordReset(actor, target);
  const showToggleStatus = canToggleUserStatus(actor, target);
  const showDelete = canDeleteUser(actor, target);

  const [editOpen, setEditOpen] = useState(false);
  const [reset2faOpen, setReset2faOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [forcePasswordOpen, setForcePasswordOpen] = useState(false);
  const [toggleStatusOpen, setToggleStatusOpen] = useState(false);
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

  function resetChangePasswordForm() {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  }

  function handleChangePasswordOpenChange(open: boolean) {
    setChangePasswordOpen(open);
    if (!open) {
      resetChangePasswordForm();
    }
  }

  function handleChangePassword() {
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError(t("validation.passwordMin"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }

    runAction(
      async () => {
        const result = await adminChangeUserPassword(user.id, newPassword);
        if (result.success) {
          handleChangePasswordOpenChange(false);
          router.refresh();
        }
        return result;
      },
      "saved",
      t("messages.passwordChanged")
    );
  }

  function handleToggleStatus() {
    const nextActive = !user.isActive;
    runAction(
      async () => {
        const result = await toggleUserStatus(user.id, nextActive);
        if (result.success) {
          setToggleStatusOpen(false);
          router.refresh();
        }
        return result;
      },
      "saved",
      nextActive ? t("messages.accountEnabled") : t("messages.accountDisabled")
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
          {showChangePassword ? (
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound />
              {t("actions.changePassword")}
            </DropdownMenuItem>
          ) : null}
          {showForcePassword ? (
            <DropdownMenuItem onClick={() => setForcePasswordOpen(true)}>
              <KeyRound />
              {t("forcePasswordReset")}
            </DropdownMenuItem>
          ) : null}
          {showToggleStatus ? (
            <DropdownMenuItem onClick={() => setToggleStatusOpen(true)}>
              {user.isActive ? <Ban /> : <CheckCircle2 />}
              {user.isActive
                ? t("actions.disableAccount")
                : t("actions.enableAccount")}
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

      <Dialog open={changePasswordOpen} onOpenChange={handleChangePasswordOpenChange}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{t("changePasswordTitle")}</DialogTitle>
            <DialogDescription>
              {t("changePasswordDescription", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`new-password-${user.id}`}>{t("newPassword")}</Label>
              <Input
                id={`new-password-${user.id}`}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                disabled={pending}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`confirm-password-${user.id}`}>
                {t("confirmPassword")}
              </Label>
              <Input
                id={`confirm-password-${user.id}`}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                disabled={pending}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {passwordError ? (
              <p className="text-sm text-destructive">{passwordError}</p>
            ) : null}
          </div>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleChangePasswordOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={pending} onClick={handleChangePassword}>
              {pending ? tCommon("loading") : t("changePasswordAction")}
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

      <Dialog open={toggleStatusOpen} onOpenChange={setToggleStatusOpen}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>
              {user.isActive ? t("disableAccountTitle") : t("enableAccountTitle")}
            </DialogTitle>
            <DialogDescription>
              {user.isActive
                ? t("disableAccountConfirm", { name: user.name })
                : t("enableAccountConfirm", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setToggleStatusOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant={user.isActive ? "destructive" : "default"}
              disabled={pending}
              onClick={handleToggleStatus}
            >
              {pending
                ? tCommon("loading")
                : user.isActive
                  ? t("disableAccountAction")
                  : t("enableAccountAction")}
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
