export const round2Baseline = "004f366a350fe946e0b672839bdb559bbaf6e930";
export const round2Fixture = "homeport-phase7-owner-correction-round2-v1";

export const round2Findings = [
  "Player, Captain, and Creator selection icons still move structurally on hover.",
  "The icons jump to another position, remain there briefly, and move back.",
  "Structural card layout must never change on hover.",
  "The account/Profile dropdown still appears to have no visible animation.",
  "The lantern now swings more, but its swing is offset too far to the left.",
  "The lantern must rotate around the physical hanging point with a balanced left/right arc.",
  "Home-page star twinkles are not perceptible.",
  "Star twinkles must be visible but restrained.",
  "Fog and ambient motion must remain coherent with reduced motion.",
  "“What is a Chronicle” was incorrectly changed to a bright washed-out card.",
  "Other major cards also acquired inconsistent pale surfaces.",
  "Dark mode must be restored as a complete coherent dark theme.",
  "A real global Light Mode should be implemented for the complete product.",
  "Light Mode must apply consistently rather than producing mixed dark/light pages.",
  "Personal Harbor inactive links and ordinary body text became too gray.",
  "Ordinary readable text must remain clearly readable.",
  "Section headings, inactive links, metadata, secondary text, and disabled text require distinct tokens.",
  "A repository-wide contrast and token audit is required.",
  "Sera still receives incorrect permission denial when opening Captain.",
  "Sera still receives incorrect permission denial when opening Creator.",
  "Sera is not currently participating in an active Chronicle.",
  "The final owner-review database did not reflect the intended one-account, three-workspace model.",
  "The capability fix must work in the actual owner-review runtime, not only automated journey clones.",
  "The system must diagnose and repair existing claimed accounts missing Player, Captain, or Creator capability setup.",
  "Creating a review can require a “Community Profile.”",
  "Personal Harbor exposes no obvious Community Profile creation path.",
  "Community identity should be the same public Profile used elsewhere.",
  "The user must not understand Community Profile as a second profile product.",
  "If a handle or public projection is missing, review flow should link directly to Public Profile setup.",
  "After setup, return to the original review composer.",
  "Existing valid public Profile identity should satisfy Community review identity requirements automatically.",
  "Community district navigation immediately shows a Harbor error.",
  "Retry immediately succeeds.",
  "This behavior occurs on Community subpages/districts.",
  "A pending request is being treated as an error.",
  "Fast successful requests must not show loading or error.",
  "Slow successful requests must show loading only after 500 ms.",
  "An error panel must appear only after a real request failure or governed timeout.",
  "Every Community district must be tested through ordinary navigation.",
  "The redundant “Current Area” strip should be removed from ordinary Community pages as well as Personal Harbor.",
  "ProductShell contextual strips must appear only when they communicate real context, permission, session, recovery, or immersive state.",
  "Community cards/details display values such as “12 saves” and “4.8 stars.”",
  "These values must be real authoritative aggregates.",
  "Save count must derive from active authoritative save records.",
  "Average rating must derive from eligible published reviews.",
  "Rating count must be shown.",
  "Decorative fixture counts must not be presented as product truth.",
  "Save/unsave must update counts correctly.",
  "Review create/update/delete/moderation must update rating aggregates.",
  "Duplicate saves and duplicate active ratings must not be counted.",
  "Removed or disallowed reviews must follow accepted aggregation policy.",
  "“About this Chronicle” is improved but still needs richer information.",
  "Chronicle previews should include more practical and experiential metadata.",
  "Chronicle preview should show average rating and review/comment summary.",
  "Chronicle ratings and comments must require verified Chronicle completion.",
  "Completion eligibility must be server-derived.",
  "Rating/review is optional after completion.",
  "The Player may dismiss the prompt.",
  "The Player may submit later.",
  "Later review entry must be available from Chronicle Passport history.",
  "Later review entry must be available from the Chronicle public detail page.",
  "Only a person verified to have completed the exact Chronicle version may review it.",
  "One active Chronicle review per account per Chronicle/version policy.",
  "The review may be edited or removed according to Harborlight policy.",
  "Reviews and comments must preserve spoiler controls.",
  "Client state cannot grant completion eligibility.",
  "The owner asks whether email sending and verification actually work.",
  "Current proof uses a task-owned synthetic email outbox.",
  "Live external email delivery is not proven.",
  "The owner re-review package must make synthetic email testing obvious.",
  "Ordinary product UI must not expose test simulator controls.",
  "Live-provider status must remain truthful.",
  "Capture every user-facing page.",
  "Store captures in a new folder named: `Experience_Images`",
  "The folder must be easy for the owner to browse.",
  "The folder must be easy for later ChatGPT/Codex inspection.",
  "Include desktop images for every ordinary user-facing page.",
  "Include mobile images for every critical and high-priority page.",
  "Include major loading, empty, error, permission, and unavailable states.",
  "Include current exact-source metadata.",
  "Include an index.",
  "Include contact sheets.",
  "Validate that no user-facing page is missing.",
  "Exclude APIs, static assets, and non-human callback routes.",
  "Remove credentials, tokens, private content, and real personal data.",
];

export const round2Decisions = [
  [
    "Round 2 owner authority",
    "The 85 verbatim HP-OWCR2 findings are the sole correction authority; adjacent defects must be added before repair and owner acceptance remains external.",
  ],
  [
    "Runtime fixture parity",
    "Tests and the final owner runtime use the same canonical fixture builder and alias definitions for roles, status, email, Profile, Community identity, Chronicle, and provider state.",
  ],
  [
    "Claimed-account capability backfill",
    "An idempotent dry-run/commit reconciliation grants ordinary Player, Captain, and Creator workspace capability without granting Moderator, Admin, resource-specific Captain authority, or private Creator access.",
  ],
  [
    "Owner-review database preparation",
    "Preparation fails closed unless synthetic Sera is claimed, active, verified, publicly configured, unrestricted, expired-session-free, three-workspace capable, and has no active Chronicle.",
  ],
  [
    "Role-card structural versus decorative motion",
    "Static layout CSS owns icon position before and after hydration; decoration may glow, scale, rotate internally, or change material without translating content flow.",
  ],
  [
    "Account-menu motion visibility",
    "The rendered menu opens and closes with perceptible 150–200 ms opacity, 6–10 px vertical, and approximately 0.98 scale motion while preserving focus and reduced-motion equivalence.",
  ],
  [
    "Lantern transform origin",
    "The physical suspension point is the transform origin, with a centered neutral pose and balanced left/right arc without compounded translation.",
  ],
  [
    "Star-twinkle visibility",
    "Staggered twinkles are visibly perceptible but restrained, lifecycle-managed, and static under reduced motion.",
  ],
  [
    "Fog lifecycle",
    "Fog drifts slowly, pauses when hidden, never obscures content, and becomes a coherent static composition under reduced motion.",
  ],
  [
    "Dark theme restoration",
    "Dark is a coherent product-wide theme; pale mixed surfaces such as What is a Chronicle are defects.",
  ],
  [
    "Global Light Mode",
    "Light is a complete product-wide theme covering shell, routes, dialogs, forms, states, Community, and Personal Harbor.",
  ],
  [
    "System theme behavior",
    "System resolves from prefers-color-scheme, follows later operating-system changes unless explicitly overridden, and has a deterministic server-safe fallback.",
  ],
  [
    "Theme persistence",
    "Explicit theme choice persists through canonical preferences and applies before interactive paint.",
  ],
  [
    "Theme cross-tab reconciliation",
    "Preference changes reconcile across tabs without loops, stale surfaces, or wrong-theme flashes.",
  ],
  [
    "Theme token architecture",
    "One semantic token layer owns surfaces, borders, controls, states, focus, shadows, and text across Dark and Light; components do not invent a second framework.",
  ],
  [
    "Text contrast tokens",
    "Headings, body, inactive navigation, metadata, secondary, and disabled text use distinct semantic tokens and governed contrast targets.",
  ],
  [
    "Community identity unification",
    "The existing public Profile is the only user-visible Community identity; Harborlight may consume an allowlisted projection but must not present a second Profile product.",
  ],
  [
    "Review Profile setup return path",
    "Missing public handle/setup links to Public Profile setup with a validated return target that restores the original review composer.",
  ],
  [
    "Community request state machine",
    "Idle, pending, delayed-loading, success, empty, real-error, retry, stale, and aborted requests are distinct states owned by one shared boundary.",
  ],
  [
    "Delayed loading",
    "Fast success shows no loading; unresolved work exposes loading only after 500 ms and cancels timers on settle, abort, or replacement.",
  ],
  [
    "Error transition",
    "Error UI appears only after a real failure or governed timeout and does not reuse pending as failure.",
  ],
  [
    "Retry behavior",
    "Retry starts a new request, clears stale error safely, preserves ordinary navigation context, and renders the resulting state once.",
  ],
  [
    "Save aggregation",
    "Save counts derive from unique active authoritative save records; save/unsave and reconciliation update the projection without fixture literals.",
  ],
  [
    "Rating aggregation",
    "Average and count derive from eligible published reviews; moderation/edit/delete and uniqueness policy reconcile deterministically, and zero ratings are not displayed as zero stars.",
  ],
  [
    "Review eligibility",
    "Only a server-verified account that completed the exact governed Chronicle/version may create the one active review allowed by policy.",
  ],
  [
    "Chronicle completion proof",
    "One Voyage completion truth is the only eligibility source; private completion records stay private and client state cannot manufacture eligibility.",
  ],
  [
    "Chronicle preview expansion",
    "Public-safe preview adds practical requirements, experiential metadata, rating/save summary, reviews/comments, spoiler controls, and explicit Preview versus Start separation.",
  ],
  [
    "Synthetic email outbox presentation",
    "The owner package gives an explicit private task-owned synthetic inbox method; ordinary UI exposes no simulator control and live delivery/provider proof remains unclaimed.",
  ],
  [
    "Experience image capture architecture",
    "After exact implementation/build/journey success, one source-bound generator captures the human route/state census into Experience_Images with desktop/mobile/theme/state coverage, index, checksums, and contact sheets.",
  ],
  [
    "Exact-source evidence policy",
    "Every test, frame, screenshot, manifest, contact sheet, and runtime receipt binds to one 40-character product source; any later source change invalidates affected evidence.",
  ],
  [
    "Sounding Line impact",
    "All new contracts map to focused and release-relevant cases; only exact-source subsystem and mainline RELEASE_GO decisions authorize publication.",
  ],
  [
    "Schema/migration decision",
    "Existing models are preferred; schema changes require a named invariant gap, additive SQLite/MySQL treatment, fresh/upgrade rehearsal, and rebuildable reconciliation for any cache.",
  ],
  [
    "Owner re-review package",
    "The additive package preserves Round 1 history and supplies source, fixture, credential path, routes, synthetic inbox method, Experience Images index, status/reset/stop, limits, and rollback.",
  ],
  [
    "Final status language",
    "The highest automated status is PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 2 READY FOR OWNER RE-REVIEW; owner Round 2 remains PENDING_OWNER_DECISION.",
  ],
  [
    "Rollback",
    "Preserve baseline 004f366…, prior owner artifacts, and migration history; stop only marker-owned processes, invalidate stale evidence, and forward-fix where rollback risks data loss.",
  ],
];

export const evidenceIds = [
  "A-ROLE-CARDS-FIRST-PAINT",
  "B-ROLE-CARDS-HOVER",
  "C-ACCOUNT-MENU-OPENING",
  "D-LANTERN-NEUTRAL",
  "E-LANTERN-LEFT",
  "F-LANTERN-RIGHT",
  "G-STAR-TWINKLE",
  "H-FOG-DRIFT",
  "I-DARK-WHAT-IS-A-CHRONICLE",
  "J-LIGHT-GATEWAY",
  "K-LIGHT-COMMUNITY",
  "L-LIGHT-PERSONAL-HARBOR",
  "M-SERA-WORKSPACES",
  "N-COMMUNITY-FAST-READY",
  "O-COMMUNITY-DELAYED-LOADING",
  "P-COMMUNITY-REAL-ERROR",
  "Q-PUBLIC-PROFILE-REVIEW",
  "R-PUBLIC-PROFILE-SETUP",
  "S-SAVE-COUNT",
  "T-RATING-SUMMARY",
  "U-COMPLETION-VERIFIED-REVIEW",
  "V-CHRONICLE-PREVIEW-EXPANDED",
  "W-PASSPORT-REVIEW-ENTRY",
  "X-PERSONAL-HARBOR-CONTRAST",
  "Y-COMMUNITY-CONTRAST",
  "Z-MOBILE-COMMUNITY",
  "AA-MOBILE-PROFILE-SETUP",
  "AB-REDUCED-MOTION",
  "AC-EXPERIENCE-IMAGES-INDEX",
  "AD-EXPERIENCE-IMAGES-CONTACT-SHEET",
  "AE-FULL-ROUND2-REGRESSION",
].map((suffix) => `HP-OWCR2-EV-${suffix}`);

export function findingArea(index) {
  if (index <= 9)
    return [
      "Home motion",
      "HIGH",
      "lanternwake",
      "Project_Homeport_Home_Ambient_and_Role_Card_Motion_Contract.md",
      "homeport.owner-correction.round2.motion",
      evidenceIds[index <= 3 ? 1 : index === 4 ? 2 : index <= 6 ? 3 : index === 7 || index === 8 ? 6 : 7],
    ];
  if (index <= 18)
    return [
      "Theme and visual tokens",
      "CRITICAL",
      "project-homeport",
      "Project_Homeport_Global_Theme_and_Visual_Token_Contract.md",
      "homeport.owner-correction.round2.theme",
      evidenceIds[index <= 12 ? 8 : index <= 14 ? 9 : index <= 17 ? 23 : 24],
    ];
  if (index <= 24)
    return [
      "Workspace capability parity",
      "CRITICAL",
      "wayfarer",
      "Project_Homeport_Runtime_Fixture_Parity_Contract.md",
      "homeport.owner-correction.round2.sera-capabilities",
      evidenceIds[12],
    ];
  if (index <= 31)
    return [
      "Public Profile and Community identity",
      "CRITICAL",
      "harborlight",
      "Project_Homeport_Public_Profile_and_Community_Identity_Contract.md",
      "homeport.owner-correction.round2.public-profile-community-identity",
      evidenceIds[index <= 28 ? 16 : 17],
    ];
  if (index <= 41)
    return [
      "Community request state",
      "CRITICAL",
      "harborlight",
      "Project_Homeport_Community_Loading_State_Contract.md",
      "homeport.owner-correction.round2.community-loading",
      evidenceIds[index <= 36 ? 13 : index === 37 ? 14 : index === 38 ? 15 : 24],
    ];
  if (index <= 51)
    return [
      "Community aggregates",
      "CRITICAL",
      "harborlight",
      "Project_Homeport_Community_Rating_and_Save_Aggregation_Contract.md",
      "homeport.owner-correction.round2.community-aggregates",
      evidenceIds[index <= 44 || index === 48 || index === 50 ? 18 : 19],
    ];
  if (index <= 54)
    return [
      "Chronicle preview",
      "HIGH",
      "one-voyage",
      "Project_Homeport_Chronicle_Preview_Expansion_Contract.md",
      "homeport.owner-correction.round2.chronicle-preview-expanded",
      evidenceIds[21],
    ];
  if (index <= 66)
    return [
      "Completion-verified reviews",
      "CRITICAL",
      "one-voyage",
      "Project_Homeport_Chronicle_Completion_Review_Contract.md",
      "homeport.owner-correction.round2.review-completion-eligibility",
      evidenceIds[index <= 59 ? 20 : 22],
    ];
  if (index <= 72)
    return [
      "Synthetic email truth",
      "HIGH",
      "wayfarer",
      "Project_Homeport_Account_Identity_Email_and_Claiming_Architecture.md",
      "homeport.owner-correction.round2.synthetic-email-truth",
      evidenceIds[30],
    ];
  return [
    "Experience Images",
    "HIGH",
    "project-homeport",
    "Project_Homeport_Experience_Images_Contract.md",
    "homeport.owner-correction.round2.experience-images",
    evidenceIds[index <= 81 ? 28 : 29],
  ];
}
