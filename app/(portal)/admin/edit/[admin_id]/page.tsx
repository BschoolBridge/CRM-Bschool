import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { isUniqueViolation, prisma } from "@/lib/prisma";
import { fullName } from "@/modules/presenters";
import { UserForm } from "@/modules/users/user.forms";
import { updateAdmin, type AdminPermissionInput } from "@/modules/users/user.service";
import { requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Admin User" };

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

function permissionInput(data: Record<string, unknown>): AdminPermissionInput {
  const on = (name: string) => field(data, name) === "on";
  return {
    is_superadmin: on("is_superadmin"),
    can_delete: on("can_delete"),
    can_view_performance: on("can_view_performance"),
    can_view_counsellor_work: on("can_view_counsellor_work"),
    can_manage_settings: on("can_manage_settings"),
  };
}

function checked(on: boolean): string {
  return on ? " checked" : "";
}

function permissionMarkup(values: AdminPermissionInput): string {
  return `<hr><h5><i class="fas fa-shield-alt"></i> Permissions</h5>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="is_superadmin" name="is_superadmin"${checked(values.is_superadmin)}>
<label class="custom-control-label" for="is_superadmin"><strong>Super Admin</strong> (full access)</label>
</div></div>
<div id="permission-fields"${values.is_superadmin ? ' style="display:none;"' : ""}>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_delete" name="can_delete"${checked(values.can_delete)}>
<label class="custom-control-label" for="can_delete">Can delete records</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_manage_settings" name="can_manage_settings"${checked(values.can_manage_settings)}>
<label class="custom-control-label" for="can_manage_settings">Can manage settings (sources, statuses, etc.)</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_view_performance" name="can_view_performance"${checked(values.can_view_performance)}>
<label class="custom-control-label" for="can_view_performance">Can view counsellor performance</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_view_counsellor_work" name="can_view_counsellor_work"${checked(values.can_view_counsellor_work)}>
<label class="custom-control-label" for="can_view_counsellor_work">Can view counsellor work <small class="text-muted">(superadmin only)</small></label>
</div></div>
</div>`;
}

function mediaUrl(name: string | null | undefined): string {
  if (!name) return "";
  return `/media/${name.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

export async function saveAdminEdit(adminId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requireSuperadmin();
  const row = await prisma.admin.findUnique({ where: { id: adminId }, include: { admin: true } });
  if (!row) notFound();
  const input = await formInput(fd);
  const bound = new UserForm("admin", { ...input, user: row.admin });
  const nextPermissions = permissionInput(input.data);
  const markup = formMarkup(bound) + permissionMarkup(nextPermissions);
  if (!(await bound.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup };
  }
  try {
    await updateAdmin(row.id, row.admin_id, row.admin.profile_pic, bound, nextPermissions);
    await flash("success", "Admin user updated successfully!");
    redirect(reverse("manage_admins"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", `Could not update admin user: ${errorDetail(err)}`);
    return { markup };
  }
}

export default async function EditAdminPage({ params }: { params: Promise<{ admin_id: string }> }) {
  await requireSuperadmin();
  const { admin_id } = await params;
  const id = requiredId(admin_id);
  const adminObj = await prisma.admin.findUnique({ where: { id }, include: { admin: true } });
  if (!adminObj) notFound();
  const form = new UserForm("admin", { user: adminObj.admin });
  const permissions: AdminPermissionInput = {
    is_superadmin: adminObj.is_superadmin,
    can_delete: adminObj.can_delete,
    can_view_performance: adminObj.can_view_performance,
    can_view_counsellor_work: adminObj.can_view_counsellor_work,
    can_manage_settings: adminObj.can_manage_settings,
  };
  const picUrl = mediaUrl(adminObj.admin.profile_pic);

  return (
    <>
      <PageHeader title="Edit Admin User" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Admin User: ${fullName(adminObj.admin)}`}>
            {picUrl ? (
              <div className="mb-3">
                <img src={picUrl} alt="Profile Picture" style={{ maxWidth: 100, maxHeight: 100 }} className="img-thumbnail" />
                <small className="form-text text-muted">Current profile picture</small>
              </div>
            ) : null}
            <ClientForm action={saveAdminEdit.bind(null, id)} markup={formMarkup(form) + permissionMarkup(permissions)} submitLabel="Update Admin User" />
            <Link className="btn btn-secondary mt-3" href={reverse("manage_admins")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}
