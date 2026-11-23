import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "../../src/components/shell";
import { BodyClass } from "../../src/components/client-form";
import { getCurrentUser } from "../../src/server/actor";
import { USER_TYPE_COUNSELLOR } from "../../src/server/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <BodyClass name="hold-transition sidebar-mini layout-fixed crm-sidebar-resizable" />
      <Shell user={user}>{children}</Shell>
      <Script src="https://code.jquery.com/jquery-3.6.0.min.js" strategy="afterInteractive" nonce={nonce} />
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" nonce={nonce} />
      <Script src="https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/js/adminlte.min.js" strategy="afterInteractive" nonce={nonce} />
      <Script src="/static/js/sidebar_resize.js" strategy="afterInteractive" nonce={nonce} />
      <Script src="/static/js/admin-permissions.js" strategy="afterInteractive" nonce={nonce} />
      {user.user_type === USER_TYPE_COUNSELLOR ? (
        <Script src="/static/js/counsellor-alerts.js" strategy="afterInteractive" nonce={nonce} />
      ) : null}
    </>
  );
}
