import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditRequestHostAllowed } from "./host";
import { AuditRuntimeError, auditRuntimeConfig } from "./runtime";

function safeEnvironment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const localAppData = path.resolve("C:/audit-local-appdata");
  const root = path.join(localAppData, "VoyagewrightBrightwork", "stage6-creator-continuation-test");
  return {
    NODE_ENV: "production",
    LOCALAPPDATA: localAppData,
    VOYAGEWRIGHT_AUDIT_MODE: "true",
    VOYAGEWRIGHT_AUDIT_ROOT: root,
    VOYAGEWRIGHT_AUDIT_HOSTNAME: "brightwork-stage6.localhost",
    VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN: "http://localhost:3110",
    VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN: "http://brightwork-stage6.localhost:3110",
    HOMEPORT_PUBLIC_APP_ORIGIN: "http://brightwork-stage6.localhost:3110",
    NEXT_PUBLIC_APP_URL: "http://brightwork-stage6.localhost:3110",
    VOYAGEWRIGHT_BUILD_SHA: "e69f452a69f2a531f6fbf4a3e0cb75d204e4c922",
    DATABASE_URL: `file:${path.join(root, "database", "brightwork-stage6-audit.db").replaceAll("\\", "/")}`,
    PRIVATE_CONTENT_ENABLED: "false",
    PRIVATE_CONTENT_STORAGE_PROVIDER: "local",
    PRIVATE_CONTENT_PROVIDER_ROOT: path.join(root, "storage", "private-content"),
    PRIVATE_CONTENT_SCANNER_PROVIDER: "disabled",
    PRIVATE_CONTENT_KEY_PROVIDER: "local",
    PRIVATE_CONTENT_WORKER_ENABLED: "false",
    OUTBOUND_EMAIL_DISABLED: "true",
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_PHASE7_TASK_ROOT: root,
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(root, "outbox", "synthetic-email.jsonl"),
    PROFILE_MEDIA_ROOT: path.join(root, "storage", "profile-media"),
    VOYAGEWRIGHT_OAUTH_TEST_MODE: "false",
    NEXT_DIST_DIR: ".next-brightwork-stage6-creator-continuation",
    ...overrides,
  };
}

describe("Brightwork Stage 6 audit runtime configuration", () => {
  it("accepts only a task-owned local SQLite runtime", () => {
    const config = auditRuntimeConfig(safeEnvironment());
    expect(config?.hostname).toBe("brightwork-stage6.localhost");
    expect(config?.databasePath).toContain("brightwork-stage6-audit.db");
  });

  it("refuses a non-SQLite database URL", () => {
    expect(() =>
      auditRuntimeConfig(safeEnvironment({ DATABASE_URL: "mysql://production.invalid/voyagewright" })),
    ).toThrow(new AuditRuntimeError("AUDIT_DATABASE_NOT_SQLITE"));
  });

  it("refuses configured external provider credentials", () => {
    expect(() => auditRuntimeConfig(safeEnvironment({ RESEND_API_KEY: "real-provider-key" }))).toThrow(
      new AuditRuntimeError("AUDIT_FORBIDDEN_CONFIGURATION_RESEND_API_KEY"),
    );
  });

  it("allows only the declared audit and loopback hosts", () => {
    const environment = safeEnvironment();
    expect(auditRequestHostAllowed("brightwork-stage6.localhost:3110", environment)).toBe(true);
    expect(auditRequestHostAllowed("localhost:3110", environment)).toBe(true);
    expect(auditRequestHostAllowed("127.0.0.1:3110", environment)).toBe(false);
    expect(auditRequestHostAllowed("unapproved.example.test", environment)).toBe(false);
  });

  it("allows the approved public audit host and localhost only", () => {
    const environment = safeEnvironment({
      VOYAGEWRIGHT_AUDIT_HOSTNAME: "audit.absoluterelativesystems.com",
      VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN: "https://audit.absoluterelativesystems.com",
      HOMEPORT_PUBLIC_APP_ORIGIN: "https://audit.absoluterelativesystems.com",
      NEXT_PUBLIC_APP_URL: "https://audit.absoluterelativesystems.com",
    });
    expect(auditRequestHostAllowed("audit.absoluterelativesystems.com", environment)).toBe(true);
    expect(auditRequestHostAllowed("localhost:3110", environment)).toBe(true);
    expect(auditRequestHostAllowed("unauthorized.example.test", environment)).toBe(false);
  });

  it("leaves ordinary runtimes outside audit restrictions", () => {
    const environment = safeEnvironment({ VOYAGEWRIGHT_AUDIT_MODE: "false" });
    expect(auditRuntimeConfig(environment)).toBeNull();
    expect(auditRequestHostAllowed("unapproved.example.test", environment)).toBe(true);
  });
});
