import Link from "next/link";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { saveNewAdmin } from "@/modules/users/admin-form-actions";
import { DEFAULT_ADD_ADMIN_PERMISSIONS, permissionMarkup } from "@/modules/users/admin-form-shared";
import { UserForm } from "@/modules/users/user.forms";
import { requireSuperadmin } from "@/server/actor";
import { formMarkup } from "@/server/form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Admin User" };

export default async function AddAdminPage() {
  await requireSuperadmin();
  const form = new UserForm("admin");

  return (
    <>
      <PageHeader title="Add Admin User" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Admin User">
            <ClientForm
              action={saveNewAdmin}
              markup={formMarkup(form) + permissionMarkup(DEFAULT_ADD_ADMIN_PERMISSIONS)}
              submitLabel="Add Admin User"
            />
            <Link className="btn btn-secondary mt-3" href={reverse("manage_admins")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}
