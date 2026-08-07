process.env.HOMEPORT_PHASE7_CORRECTION_ROUND = "3";
process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION = "homeport-phase7-owner-correction-round3-patch-a-v1";
process.env.HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT ??= "3792";
process.env.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER ??= "SYNTHETIC_OUTBOX";
process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER ??= "TASK_OWNED_TEST";
process.env.NEXT_DIST_DIR ??= ".sealed-build-phase7-owner-correction-round3-patch-a";
await import("./phase7-walkthrough-runtime.mjs");
