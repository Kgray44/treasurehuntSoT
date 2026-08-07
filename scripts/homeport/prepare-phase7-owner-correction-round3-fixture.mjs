process.env.HOMEPORT_PHASE7_CORRECTION_ROUND = "3";
process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION = "homeport-phase7-owner-correction-round3-v1";
process.env.HOMEPORT_PHASE7_OWNER_ALIAS = "SERA";
process.env.HOMEPORT_PHASE7_OWNER_DISPLAY_NAME = "Sera";
process.env.HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT ??= "3768";
await import("./prepare-phase7-owner-correction-round1-fixture.mjs");
