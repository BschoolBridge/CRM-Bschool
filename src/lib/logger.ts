import { pino } from "pino";
import { config } from "../config/env";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.token", "*.secret"],
    remove: true,
  },
  ...(config.isProduction
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } } }),
});
