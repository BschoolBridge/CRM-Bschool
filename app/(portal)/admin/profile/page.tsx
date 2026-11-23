import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { GENDER_CHOICES, choiceLabel, presentUser } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";

export const metadata = { title: "Admin Profile" };

function profileSrc(pic: unknown): string {
  if (pic && typeof pic === "object" && "url" in pic && typeof pic.url === "string" && pic.url) return pic.url;
  return "/static/dist/img/user4-128x128.jpg";
}

export default async function AdminProfilePage() {
  const user = await requireAdmin();
  const admin = await prisma.admin.findUnique({ where: { admin_id: user.id }, include: { admin: true } });
  if (!admin) notFound();
  presentUser(admin.admin);
  const account = admin.admin;

  return (
    <>
      <PageHeader title="Admin Profile" />
      <section className="content">
        <div className="container-fluid">
          <Card
            title="Admin Profile"
            footer={
              <a href="#" className="btn btn-primary">
                Edit Profile
              </a>
            }
          >
            <div className="row">
              <div className="col-md-3">
                <div className="text-center">
                  <img className="profile-user-img img-fluid img-circle" src={profileSrc(account.profile_pic)} alt="User profile picture" />
                </div>
              </div>
              <div className="col-md-9">
                <div className="form-group">
                  <label>
                    <strong>Name:</strong>
                  </label>
                  <p>
                    {account.first_name} {account.last_name}
                  </p>
                </div>
                <div className="form-group">
                  <label>
                    <strong>Email:</strong>
                  </label>
                  <p>{account.email}</p>
                </div>
                <div className="form-group">
                  <label>
                    <strong>Phone:</strong>
                  </label>
                  <p>{account.phone || "Not provided"}</p>
                </div>
                <div className="form-group">
                  <label>
                    <strong>Gender:</strong>
                  </label>
                  <p>{choiceLabel(GENDER_CHOICES, account.gender)}</p>
                </div>
                <div className="form-group">
                  <label>
                    <strong>Address:</strong>
                  </label>
                  <p>{account.address || "Not provided"}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
