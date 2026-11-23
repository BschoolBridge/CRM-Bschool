import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/modules/presenters";
import { saveAdminEdit } from "@/modules/users/admin-form-actions";
import { permissionMarkup } from "@/modules/users/admin-form-shared";
import { UserForm } from "@/modules/users/user.forms";
import type { AdminPermissionInput } from "@/modules/users/user.service";
import { requireSuperadmin } from "@/server/actor";
import { formMarkup } from "@/server/form";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Admin User" };

function mediaUrl(name: string | null | undefined): string {
  if (!name) return "";
  return `/media/${name.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
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
