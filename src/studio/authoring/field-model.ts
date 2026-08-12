import type { InspectorField } from "@/chronicle/types";
import type { RegistryItem } from "@/components/studio/studio-types";
import type { InspectorSectionId } from "@/studio/authoring/adapters";
import { sectionForFieldPath } from "@/studio/authoring/adapters";

export type ContractInspectorField = InspectorField & {
  path: string;
  section: InspectorSectionId;
};

export function contractPathForRegistryField(field: InspectorField): string {
  return field.key === "completionMode" ? "completion.mode" : `configuration.${field.key}`;
}

export function contractFieldsForRegistry(registry: RegistryItem, mode: "GUIDED" | "DETAILED" | "ENGINEERING") {
  const fields = registry.fields.map((field) => {
    const path = contractPathForRegistryField(field);
    return { ...field, path, section: sectionForFieldPath(path) } satisfies ContractInspectorField;
  });
  if (mode === "GUIDED")
    return fields.filter((field) => field.required || field.section === "CONTENT" || field.section === "BEHAVIOR");
  return fields;
}
