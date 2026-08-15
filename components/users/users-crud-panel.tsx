"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { createUser, updateUser } from "@/lib/actions/crm";
import { deleteUserAction } from "@/lib/actions/auth";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  is2FAEnabled: boolean;
};

export function UsersCrudPanel({
  users,
  canCreate,
  isSuperAdmin,
}: {
  users: UserRow[];
  canCreate: boolean;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const { pending, notify } = useCrudToast();
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  async function handleCreate(formData: FormData) {
    notify(await createUser(formData), "created");
  }

  async function handleUpdate(formData: FormData) {
    notify(await updateUser(formData), "saved");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    notify(await deleteUserAction(deleteTarget.id), "deleted");
    setDeleteTarget(null);
  }

  return (
    <>
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>{t("createUser")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={handleCreate}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            >
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required disabled={pending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{tCommon("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{tCommon("password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("role")}</Label>
                <Select name="role" defaultValue="CS_AGENT" disabled={pending}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CS_AGENT">CS_AGENT</SelectItem>
                    {isSuperAdmin && (
                      <>
                        <SelectItem value="MANAGEMENT">MANAGEMENT</SelectItem>
                        <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={pending}>
                  {t("createUser")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{tCommon("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  {user.is2FAEnabled ? tCommon("enabled") : tCommon("disabled")}
                </TableCell>
                <TableCell className="space-x-2">
                  {canCreate && user.role !== "SUPER_ADMIN" && (
                    <>
                      <form action={handleUpdate} className="inline-flex gap-2">
                        <input type="hidden" name="id" value={user.id} />
                        <Input
                          name="name"
                          defaultValue={user.name}
                          className="w-32"
                          disabled={pending}
                        />
                        <Select
                          name="role"
                          defaultValue={user.role}
                          disabled={pending}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CS_AGENT">CS_AGENT</SelectItem>
                            {isSuperAdmin && (
                              <SelectItem value="MANAGEMENT">MANAGEMENT</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                        >
                          {tCommon("save")}
                        </Button>
                      </form>
                      {isSuperAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => setDeleteTarget(user)}
                        >
                          {tCommon("delete")}
                        </Button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon("confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {tCommon("confirmDelete", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={pending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
