import { CommunityError } from "./domain";

/**
 * The old generic Exchange accepted caller-provided package bytes, license
 * claims, destination mappings, and an asserted finalization result. It could
 * record an installation without creating private Creator content. Every
 * supported type now needs its own source-derived publication and installer.
 */
function dedicatedFlowRequired(): never {
  throw new CommunityError(
    "COMMUNITY_DEDICATED_FLOW_REQUIRED",
    "Use the source-bound Creator or spatial Community publication and installation flow.",
  );
}

export async function preflightCommunityPublication(...args: [string, string, unknown, unknown]) {
  void args;
  return dedicatedFlowRequired();
}

export async function persistVerifiedCommunityPackage(...args: [string, string, unknown, unknown]) {
  void args;
  return dedicatedFlowRequired();
}

export async function reviewVerifiedCommunityPackage(input: unknown) {
  void input;
  return dedicatedFlowRequired();
}

export async function installVerifiedCommunityPackage(input: unknown) {
  void input;
  return dedicatedFlowRequired();
}
