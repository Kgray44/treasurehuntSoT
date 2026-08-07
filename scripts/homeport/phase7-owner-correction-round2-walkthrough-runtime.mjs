process.env.HOMEPORT_PHASE7_CORRECTION_ROUND = "2";
process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION = "homeport-phase7-owner-correction-round2-v1";
process.env.HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT ??= "3756";
await import("./phase7-walkthrough-runtime.mjs");
