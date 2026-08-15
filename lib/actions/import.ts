"use server";

import { auth } from "@/lib/auth";
import { ingestWorkbook } from "@/lib/import/ingest";
import { revalidatePath } from "next/cache";

export async function importWorkbookAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ingestWorkbook(buffer);

  revalidatePath("/units");
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/imports");

  return result;
}
