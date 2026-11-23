import { config } from "../../src/config/env";
import { getCurrentUser } from "../../src/server/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("/* unauthorized */", { status: 401, headers: { "content-type": "application/javascript" } });
  if (!config.firebase) {
    return new Response("/* Firebase config not configured */", { status: 404, headers: { "content-type": "application/javascript" } });
  }
  const body = `
importScripts('https://www.gstatic.com/firebasejs/7.22.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/7.22.1/firebase-messaging.js');
firebase.initializeApp(${JSON.stringify(config.firebase)});
const messaging = firebase.messaging();
messaging.setBackgroundMessageHandler(function (payload) {
  const notification = JSON.parse(payload);
  const notificationOption = { body: notification.body, icon: notification.icon };
  return self.registration.showNotification(payload.notification.title, notificationOption);
});
`;
  return new Response(body, { headers: { "content-type": "application/javascript; charset=utf-8" } });
}
