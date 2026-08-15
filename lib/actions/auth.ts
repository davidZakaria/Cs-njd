"use server";

import { signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/en/login");
}

export async function deleteUserAction(id: string) {
  const { deleteUser } = await import("@/lib/actions/crm");
  await deleteUser(id);
}
