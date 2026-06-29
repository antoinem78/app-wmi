"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyAdmin } from "@/lib/auth/guard";
import { decideProposal } from "@/lib/proposals";

async function decide(formData: FormData, decision: "approved" | "dismissed") {
  const { email } = await requireAgencyAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing proposal id.");
  const res = await decideProposal(id, decision, email);
  if ("error" in res) throw new Error(res.error);
  revalidatePath("/proposals");
  revalidatePath("/dashboard");
}

export async function approveProposal(formData: FormData): Promise<void> {
  await decide(formData, "approved");
}
export async function dismissProposal(formData: FormData): Promise<void> {
  await decide(formData, "dismissed");
}
