/**
 * Specialist projects contribute to the single Homeport registry. These are
 * ownership boundaries, not a second runtime navigation list.
 */
export const navigationExtensionContracts = [
  { id: "community", owner: "harborlight", status: "integrated" },
  { id: "sealed-hold-private-content", owner: "sealed-hold", status: "integrated" },
  { id: "wayfarer-personal-sections", owner: "wayfarer", status: "integrated" },
  { id: "admiralty-support-consent", owner: "admiralty", status: "integrated" },
] as const;
