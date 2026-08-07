process.env.HOMEPORT_PHASE7_CORRECTION_ROUND = "2";
process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION = "homeport-phase7-owner-correction-round2-v1";
process.env.HOMEPORT_PHASE7_OWNER_ALIAS = "SERA";
process.env.HOMEPORT_PHASE7_OWNER_DISPLAY_NAME = "Sera";
await import("./prepare-phase7-owner-correction-round1-fixture.mjs");
