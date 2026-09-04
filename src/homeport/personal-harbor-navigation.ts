export const personalHarborSectionIds = [
  "personal-harbor-overview",
  "public-profile-editor",
  "personal-information",
  "preferences",
  "accessibility",
  "notifications",
  "privacy-safety",
  "linked-identities",
  "security",
  "sessions-devices",
  "support-access",
  "data-account",
] as const;

export const passportSectionIds = [
  "passport-home",
  "passport-history",
  "passport-timeline",
  "passport-people",
  "passport-statistics",
  "passport-atlas",
  "passport-memories",
  "passport-artifacts",
  "passport-saved",
] as const;

export type PersonalHarborSectionId = (typeof personalHarborSectionIds)[number] | (typeof passportSectionIds)[number];

export const personalHarborNavigation = [
  {
    label: "Profile",
    items: [
      ["personal-harbor-overview", "Overview", "/account"],
      ["public-profile-editor", "Public Profile", "/account/profile"],
      ["personal-information", "Personal Information", "/account/personal-information"],
    ],
  },
  {
    label: "Experience",
    items: [
      ["preferences", "Preferences", "/account/preferences"],
      ["accessibility", "Accessibility", "/account/accessibility"],
      ["notifications", "Notifications", "/account/notifications"],
    ],
  },
  {
    label: "Privacy & connections",
    items: [
      ["privacy-safety", "Privacy & Safety", "/account/privacy"],
      ["linked-identities", "Linked Identities", "/account/linked-identities"],
    ],
  },
  {
    label: "Account",
    items: [
      ["security", "Security", "/account/security"],
      ["sessions-devices", "Sessions & Devices", "/account/sessions"],
      ["support-access", "Support Access", "/account/support-access"],
      ["data-account", "Data & Account", "/account/data"],
    ],
  },
] as const;
