import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { flash } from "@/server/flash";
import { counsellorContext } from "./owned";

export async function requireAdmissionCounsellor() {
  const ctx = await counsellorContext();
  if (!ctx.counsellor.can_handle_admission_followup) {
    await flash("error", "You do not have permission for Our Student. Ask an admin to enable After Admission access.");
    redirect(reverse("counsellor_home"));
  }
  return ctx;
}
