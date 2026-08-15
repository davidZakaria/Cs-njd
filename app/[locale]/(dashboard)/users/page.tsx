import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { deleteUserAction } from "@/lib/actions/auth";
import { createUser, updateUser } from "@/lib/actions/crm";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UsersPage() {
  const session = await auth();
  const t = await getTranslations("users");

  const users = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: "@imported.njd.local" } } },
    orderBy: { createdAt: "desc" },
  });

  const canCreate = session?.user.role === "SUPER_ADMIN" || session?.user.role === "MANAGEMENT";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>{t("createUser")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("role")}</Label>
                <Select name="role" defaultValue="CS_AGENT">
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CS_AGENT">CS_AGENT</SelectItem>
                    {session?.user.role === "SUPER_ADMIN" && (
                      <>
                        <SelectItem value="MANAGEMENT">MANAGEMENT</SelectItem>
                        <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">{t("createUser")}</Button>
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
              <TableHead>Email</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.is2FAEnabled ? "Enabled" : "Disabled"}</TableCell>
                <TableCell className="space-x-2">
                  {canCreate && user.role !== "SUPER_ADMIN" && (
                    <>
                      <form action={updateUser} className="inline-flex gap-2">
                        <input type="hidden" name="id" value={user.id} />
                        <Input name="name" defaultValue={user.name} className="w-32" />
                        <Select name="role" defaultValue={user.role}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CS_AGENT">CS_AGENT</SelectItem>
                            {session?.user.role === "SUPER_ADMIN" && (
                              <SelectItem value="MANAGEMENT">MANAGEMENT</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" variant="outline">Save</Button>
                      </form>
                      {session?.user.role === "SUPER_ADMIN" && (
                        <form action={deleteUserAction.bind(null, user.id)} className="inline">
                          <Button type="submit" size="sm" variant="destructive">Delete</Button>
                        </form>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
