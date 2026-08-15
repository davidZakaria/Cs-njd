"use server";

import { signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/result";

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/en/login");
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const { deleteUser } = await import("@/lib/actions/crm");
  return deleteUser(id);
}
