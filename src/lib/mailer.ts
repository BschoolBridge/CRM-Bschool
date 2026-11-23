import nodemailer from "nodemailer";
import { config } from "../config/env";
import { logger } from "./logger";

const transport = config.email.user
  ? nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      requireTLS: config.email.port === 587,
      auth: { user: config.email.user, pass: config.email.password },
    })
  : null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!transport) {
    logger.warn({ to, subject }, "EMAIL_ADDRESS not configured; email not sent");
    if (!config.isProduction) logger.info({ to, subject, text }, "development email");
    return;
  }
  await transport.sendMail({ from: config.email.from, to, subject, text });
}
