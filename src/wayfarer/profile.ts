import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const visibilityValues = ["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC", "UNLISTED"] as const;
export type Visibility = (typeof visibilityValues)[number];
export const profileSections = ["HEADER", "BIOGRAPHY", "PROVIDERS", "CHRONICLE_SUMMARY", "CREWS", "COMMUNITY"] as const;
export type ProfileSection = (typeof profileSections)[number];

const reservedHandles = new Set([
  "admin",
  "api",
  "assets",
  "auth",
  "passport",
  "profile",
  "profiles",
  "settings",
  "support",
]);
const handlePattern = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export const preferenceV1Schema = z.object({
  version: z.literal(1),
  experience: z.object({
    motion: z.enum(["FULL", "GENTLE", "REDUCED", "SYSTEM"]),
    textScale: z.number().min(0.8).max(2),
    theme: z.enum(["SYSTEM", "LIGHT", "DARK", "HIGH_CONTRAST"]),
    captions: z.boolean(),
    transcripts: z.boolean(),
    audioDescription: z.boolean(),
    autoplay: z.boolean(),
    contrast: z.enum(["SYSTEM", "STANDARD", "HIGH"]),
    textureIntensity: z.number().min(0).max(1),
    lowBandwidthMedia: z.boolean(),
  }),
  discovery: z.object({
    searchable: z.boolean(),
    themes: z.array(z.string().max(40)).max(12),
    contentWarnings: z.array(z.string().max(40)).max(12),
  }),
  social: z.object({
    invitationPolicy: z.enum(["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC"]),
    providerDiscovery: z.boolean(),
  }),
  notifications: z.object({ email: z.boolean(), product: z.boolean(), invitations: z.boolean() }),
  privacy: z.object({ defaultVisibility: z.enum(visibilityValues) }),
});
export type PreferenceV1 = z.infer<typeof preferenceV1Schema>;

export const defaultPreferences: PreferenceV1 = {
  version: 1,
  experience: {
    motion: "SYSTEM",
    textScale: 1,
    theme: "SYSTEM",
    captions: false,
    transcripts: false,
    audioDescription: false,
    autoplay: true,
    contrast: "SYSTEM",
    textureIntensity: 1,
    lowBandwidthMedia: false,
  },
  discovery: { searchable: false, themes: [], contentWarnings: [] },
  social: { invitationPolicy: "CREW_ONLY", providerDiscovery: false },
  notifications: { email: false, product: false, invitations: true },
  privacy: { defaultVisibility: "REGISTERED_USERS" },
};

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "CONFLICT" | "NOT_FOUND" | "FORBIDDEN" = "INVALID",
  ) {
    super(message);
  }
}

export function normalizeHandle(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (!handlePattern.test(normalized) || reservedHandles.has(normalized))
    throw new ProfileError("Choose a handle with 2-32 lowercase letters, numbers, or internal hyphens.");
  return normalized;
}

export function validateDisplayName(value: string) {
  const name = value.trim();
  if (name.length < 1 || name.length > 80 || name.includes("@"))
    throw new ProfileError("Choose a visible display name without an email address.");
  return name;
}

export function validateBiography(value: string | null | undefined) {
  if (value == null) return null;
  const biography = value.trim();
  if (biography.length > 1_000) throw new ProfileError("Biography must be 1,000 characters or fewer.");
  return biography || null;
}

function parseLegacyPreferences(raw: string): PreferenceV1 {
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    return preferenceV1Schema.parse({
      ...defaultPreferences,
      experience: {
        ...defaultPreferences.experience,
        motion:
          legacy.motionMode === "FULL" ||
          legacy.motionMode === "GENTLE" ||
          legacy.motionMode === "REDUCED" ||
          legacy.motionMode === "SYSTEM"
            ? legacy.motionMode
            : "SYSTEM",
        textScale: typeof legacy.textScale === "number" ? legacy.textScale : 1,
        textureIntensity: typeof legacy.textureIntensity === "number" ? legacy.textureIntensity : 1,
      },
    });
  } catch {
    return defaultPreferences;
  }
}

export async function preferencesForProfile(profileId: string) {
  const profile = await db.playerProfile.findUnique({
    where: { id: profileId },
    select: { preferences: true, preferenceSet: true },
  });
  if (!profile) throw new ProfileError("Profile not found.", "NOT_FOUND");
  if (profile.preferenceSet) {
    try {
      return preferenceV1Schema.parse(JSON.parse(profile.preferenceSet.payload));
    } catch {
      // A corrupt compatibility payload never reaches callers. Rebuild with the safe V1 default below.
    }
  }
  const value = parseLegacyPreferences(profile.preferences);
  await db.profilePreferenceSet.upsert({
    where: { playerProfileId: profileId },
    create: { playerProfileId: profileId, schemaVersion: 1, payload: JSON.stringify(value), migratedAt: new Date() },
    update: { schemaVersion: 1, payload: JSON.stringify(value), migratedAt: new Date() },
  });
  return value;
}

export async function updatePreferences(profileId: string, input: unknown) {
  const value = preferenceV1Schema.parse(input);
  await db.$transaction([
    db.profilePreferenceSet.upsert({
      where: { playerProfileId: profileId },
      create: { playerProfileId: profileId, schemaVersion: 1, payload: JSON.stringify(value), migratedAt: new Date() },
      update: { schemaVersion: 1, payload: JSON.stringify(value) },
    }),
    db.playerProfile.update({ where: { id: profileId }, data: { defaultVisibility: value.privacy.defaultVisibility } }),
  ]);
  return value;
}

export function resolvePreferences(input: {
  account: PreferenceV1;
  chronicleOverride?: Partial<PreferenceV1["experience"]>;
  browser?: { reducedMotion?: boolean; forcedColors?: boolean; textScale?: number };
}) {
  return {
    ...input.account,
    experience: {
      ...input.account.experience,
      ...input.chronicleOverride,
      ...(input.browser?.reducedMotion ? { motion: "REDUCED" as const } : {}),
      ...(input.browser?.forcedColors ? { contrast: "HIGH" as const } : {}),
      ...(input.browser?.textScale ? { textScale: Math.min(2, Math.max(0.8, input.browser.textScale)) } : {}),
    },
  };
}

export async function updateProfile(
  accountId: string,
  input: { displayName?: string; handle?: string | null; biography?: string | null; defaultVisibility?: Visibility },
) {
  const profile = await db.playerProfile.findFirst({
    where: { accountId },
    select: { id: true, handle: true, normalizedHandle: true, status: true },
  });
  if (!profile) throw new ProfileError("Profile not found.", "NOT_FOUND");
  if (profile.status !== "ACTIVE")
    throw new ProfileError("This profile cannot be changed while it is restricted.", "FORBIDDEN");
  const data: Prisma.PlayerProfileUpdateInput = {};
  if (input.displayName !== undefined) data.displayName = validateDisplayName(input.displayName);
  if (input.biography !== undefined) data.biography = validateBiography(input.biography);
  if (input.defaultVisibility !== undefined) {
    if (!visibilityValues.includes(input.defaultVisibility))
      throw new ProfileError("Choose a supported visibility level.");
    data.defaultVisibility = input.defaultVisibility;
  }
  const rawHandle = input.handle === undefined ? undefined : input.handle?.trim() || null;
  if (rawHandle !== undefined && rawHandle !== profile.handle) {
    const normalized = rawHandle ? normalizeHandle(rawHandle) : null;
    try {
      await db.$transaction(async (tx) => {
        if (profile.handle && profile.normalizedHandle) {
          await tx.profileHandleHistory.upsert({
            where: { normalizedHandle: profile.normalizedHandle },
            create: { playerProfileId: profile.id, handle: profile.handle, normalizedHandle: profile.normalizedHandle },
            update: { releasedAt: null },
          });
        }
        await tx.playerProfile.update({
          where: { id: profile.id },
          data: { ...data, handle: rawHandle, normalizedHandle: normalized },
        });
      });
    } catch (cause) {
      if ((cause as { code?: string })?.code === "P2002")
        throw new ProfileError("That handle is already reserved.", "CONFLICT");
      throw cause;
    }
  } else if (Object.keys(data).length) {
    await db.playerProfile.update({ where: { id: profile.id }, data });
  }
  return ownerProfile(accountId);
}

export async function setPrivacyRules(profileId: string, rules: Partial<Record<ProfileSection, Visibility>>) {
  const entries = Object.entries(rules) as Array<[ProfileSection, Visibility]>;
  for (const [section, visibility] of entries) {
    if (!profileSections.includes(section) || !visibilityValues.includes(visibility))
      throw new ProfileError("Privacy controls contain an unsupported value.");
  }
  await db.$transaction(
    entries.map(([section, visibility]) =>
      db.profilePrivacyRule.upsert({
        where: { playerProfileId_section: { playerProfileId: profileId, section } },
        create: { playerProfileId: profileId, section, visibility },
        update: { visibility },
      }),
    ),
  );
}

export type ViewerContext = {
  accountId?: string | null;
  registered?: boolean;
  sharedCrew?: boolean;
  ownerPreview?: boolean;
};
function canView(visibility: string | undefined, viewer: ViewerContext, ownerAccountId: string | null) {
  if (viewer.ownerPreview || (viewer.accountId && viewer.accountId === ownerAccountId)) return true;
  if (visibility === "PUBLIC" || visibility === "UNLISTED") return true;
  if (visibility === "REGISTERED_USERS") return Boolean(viewer.registered);
  if (visibility === "CREW_ONLY") return Boolean(viewer.sharedCrew);
  return false;
}

export async function ownerProfile(accountId: string) {
  const profile = await db.playerProfile.findFirst({
    where: { accountId },
    include: { preferenceSet: true, privacyRules: true, avatarMedia: true, bannerMedia: true },
  });
  if (!profile) throw new ProfileError("Profile not found.", "NOT_FOUND");
  return { ...profile, preferences: await preferencesForProfile(profile.id) };
}

export async function publicProfileProjection(handle: string, viewer: ViewerContext = {}) {
  const normalized = normalizeHandle(handle);
  let profile = await db.playerProfile.findFirst({
    where: { normalizedHandle: normalized },
    include: {
      privacyRules: true,
      avatarMedia: true,
      bannerMedia: true,
      account: { select: { id: true, status: true } },
    },
  });
  let redirectedFrom: string | undefined;
  if (!profile) {
    const previous = await db.profileHandleHistory.findUnique({
      where: { normalizedHandle: normalized },
      select: {
        player: {
          include: {
            privacyRules: true,
            avatarMedia: true,
            bannerMedia: true,
            account: { select: { id: true, status: true } },
          },
        },
      },
    });
    profile = previous?.player ?? null;
    redirectedFrom = profile?.handle ? normalized : undefined;
  }
  if (
    !profile ||
    !profile.handle ||
    profile.status !== "ACTIVE" ||
    !profile.account ||
    !["ACTIVE", "PENDING_VERIFICATION"].includes(profile.account.status)
  )
    return null;
  const rules = new Map(profile.privacyRules.map((rule) => [rule.section, rule.visibility]));
  const header = canView(rules.get("HEADER") ?? profile.defaultVisibility, viewer, profile.accountId);
  if (!header) return { handle: profile.handle, private: true, redirectedFrom };
  const biography = canView(rules.get("BIOGRAPHY") ?? "ONLY_ME", viewer, profile.accountId) ? profile.biography : null;
  const providersAllowed = canView(rules.get("PROVIDERS") ?? "ONLY_ME", viewer, profile.accountId);
  const providers = providersAllowed
    ? await db.externalIdentity.findMany({
        where: {
          accountId: profile.accountId!,
          status: "LINKED",
          revokedAt: null,
          visibility: { in: ["PUBLIC", "UNLISTED"] },
        },
        select: { provider: true, providerDisplayName: true, avatarReference: true },
      })
    : [];
  const media = (media: typeof profile.avatarMedia) =>
    media && !media.removedAt ? `/api/profile-media/${media.id}` : null;
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    biography,
    avatarUrl: media(profile.avatarMedia),
    bannerUrl: media(profile.bannerMedia),
    providers,
    private: false,
    redirectedFrom,
  };
}
