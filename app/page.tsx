import { redirect } from "next/navigation";
import { BodyClass } from "../src/components/client-form";
import { LoginView } from "../src/components/login-view";
import { getCurrentUser } from "../src/server/actor";
import { homeFor } from "../src/server/auth";
import { peekFlash } from "../src/server/flash";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  const home = user ? homeFor(user.user_type) : null;
  if (home) redirect(home);

  const messages = await peekFlash();
  const errors = messages.filter((m) => m.level === "error").map((m) => m.text);

  return (
    <>
      <BodyClass name="login-custom-body" />
      <link rel="stylesheet" href="/static/assests/css/custom_login.css" />
      <LoginView errors={errors} />
    </>
  );
}
