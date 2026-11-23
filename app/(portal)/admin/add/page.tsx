import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { isUniqueViolation } from "@/lib/prisma";
import { UserForm } from "@/modules/users/user.forms";
import { createAdmin, type AdminPermissionInput } from "@/modules/users/user.service";
import { requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Admin User" };

const ADD_PERMISSIONS: AdminPermissionInput = {
  is_superadmin: true,
  can_delete: false,
  can_view_performance: false,
  can_view_counsellor_work: false,
  can_manage_settings: false,
};

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

export async function saveNewAdmin(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requireSuperadmin();
  const input = await formInput(fd);
  const bound = new UserForm("admin", input);
  const permissions = permissionInput(input.data);
  const markup = formMarkup(bound) + permissionMarkup(permissions);
  if (!(await bound.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup };
  }
  try {
    await createAdmin(bound, permissions);
    await flash("success", "Admin user added successfully!");
    redirect(reverse("manage_admins"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", `Could not add admin user: ${errorDetail(err)}`);
    return { markup };
  }
}

export default async function AddAdminPage() {
  await requireSuperadmin();
  const form = new UserForm("admin");

  return (
    <>
      <PageHeader title="Add Admin User" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Admin User">
            <ClientForm action={saveNewAdmin} markup={formMarkup(form) + permissionMarkup(ADD_PERMISSIONS)} submitLabel="Add Admin User" />
            <Link className="btn btn-secondary mt-3" href={reverse("manage_admins")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}
