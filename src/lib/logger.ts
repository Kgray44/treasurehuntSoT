import pino from "pino";
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["password", "passphrase", "accessCode", "cookie", "authorization", "key", "payload", "packageBase64", "storageRoot", "stagingRoot"],
});
