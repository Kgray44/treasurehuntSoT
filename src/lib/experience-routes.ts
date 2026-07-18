export const experienceSections = ["chapters", "map", "artifacts", "messages"] as const;

export type ExperienceSection = (typeof experienceSections)[number];

export function isExperienceSection(value: string): value is ExperienceSection {
  return experienceSections.includes(value as ExperienceSection);
}

export function experienceSectionFromPath(pathname: string): ExperienceSection {
  const candidate = pathname.split("/").filter(Boolean).at(-1) ?? "chapters";
  return isExperienceSection(candidate) ? candidate : "chapters";
}

export function experienceSectionHref(basePath: string, section: ExperienceSection) {
  return `${basePath.replace(/\/$/, "")}/${section}`;
}
