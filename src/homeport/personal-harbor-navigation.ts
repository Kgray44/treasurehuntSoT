export const personalHarborSectionIds = [
  "personal-harbor-overview",
  "public-profile-editor",
  "personal-information",
  "preferences",
  "accessibility",
  "notifications",
  "privacy-safety",
  "linked-identities",
  "passport-home",
  "passport-history",
  "passport-timeline",
  "passport-people",
  "passport-statistics",
  "passport-atlas",
  "passport-memories",
  "passport-artifacts",
  "passport-saved",
  "security",
  "sessions-devices",
  "support-access",
  "data-account",
] as const;

export type PersonalHarborSectionId = (typeof personalHarborSectionIds)[number];

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
    label: "Chronicle Passport",
    items: [
      ["passport-home", "Passport Home", "/passport"],
      ["passport-history", "History", "/passport/history"],
      ["passport-timeline", "Timeline", "/passport/timeline"],
      ["passport-people", "People", "/passport/people"],
      ["passport-statistics", "Statistics", "/passport/statistics"],
      ["passport-atlas", "Voyage Atlas", "/passport/atlas"],
      ["passport-memories", "Memories", "/passport/memories"],
      ["passport-artifacts", "Artifacts", "/passport/artifacts"],
      ["passport-saved", "Saved", "/passport/saved"],
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
