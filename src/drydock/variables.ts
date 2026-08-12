import { z } from "zod";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";

export const drydockVariableScopes = ["CHRONICLE_DEFINITION", "SESSION"] as const;
export type DrydockVariableScope = (typeof drydockVariableScopes)[number];

export const drydockVariablePrivacyClasses = [
  "PLAYER_SAFE",
  "CAPTAIN_PRIVATE",
  "CREATOR_PRIVATE",
  "SYSTEM_PRIVATE",
] as const;
export type DrydockVariablePrivacyClass = (typeof drydockVariablePrivacyClasses)[number];

export const drydockVariableOperations = [
  "assign",
  "toggle",
  "increment",
  "decrement",
  "min",
  "max",
  "clear",
  "compare",
  "add",
  "remove",
  "contains",
  "count",
] as const;
export type DrydockVariableOperation = (typeof drydockVariableOperations)[number];

export type DrydockVariableType =
  | { kind: "BOOLEAN" }
  | { kind: "INTEGER" }
  | { kind: "NUMBER" }
  | { kind: "STRING" }
  | { kind: "ENUM"; domainId: string; members: readonly string[] }
  | { kind: "STRING_SET" }
  | { kind: "IDENTIFIER_REFERENCE"; entityType: string };

export type DrydockVariableValue = boolean | number | string | readonly string[] | null;

export type DrydockVariableDeclaration = {
  schemaVersion: 1;
  id: string;
  name: string;
  type: DrydockVariableType;
  scope: DrydockVariableScope;
  defaultValue?: DrydockVariableValue;
  description?: string;
  allowedOperations: readonly DrydockVariableOperation[];
  privacy: DrydockVariablePrivacyClass;
};

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const finite = z.number().finite();
const typeSchema: z.ZodType<DrydockVariableType> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("BOOLEAN") }).strict(),
  z.object({ kind: z.literal("INTEGER") }).strict(),
  z.object({ kind: z.literal("NUMBER") }).strict(),
  z.object({ kind: z.literal("STRING") }).strict(),
  z
    .object({
      kind: z.literal("ENUM"),
      domainId: identifier,
      members: z.array(z.string().min(1).max(120)).min(1).max(128),
    })
    .strict()
    .superRefine((value, context) => {
      if (new Set(value.members).size !== value.members.length)
        context.addIssue({ code: "custom", message: "Enum members must be unique.", path: ["members"] });
    }),
  z.object({ kind: z.literal("STRING_SET") }).strict(),
  z.object({ kind: z.literal("IDENTIFIER_REFERENCE"), entityType: identifier }).strict(),
]);

export const drydockVariableDeclarationSchema: z.ZodType<DrydockVariableDeclaration> = z
  .object({
    schemaVersion: z.literal(1),
    id: identifier,
    name: z.string().min(1).max(120),
    type: typeSchema,
    scope: z.enum(drydockVariableScopes),
    defaultValue: z
      .union([z.boolean(), finite, z.string().max(4000), z.array(z.string().max(4000)).max(128), z.null()])
      .optional(),
    description: z.string().max(1000).optional(),
    allowedOperations: z.array(z.enum(drydockVariableOperations)).min(1).max(drydockVariableOperations.length),
    privacy: z.enum(drydockVariablePrivacyClasses),
  })
  .strict()
  .superRefine((declaration, context) => {
    const permitted = permittedOperations(declaration.type);
    for (const operation of declaration.allowedOperations)
      if (!permitted.includes(operation))
        context.addIssue({
          code: "custom",
          message: `${operation} is not permitted for ${declaration.type.kind}.`,
          path: ["allowedOperations"],
        });
    if (
      declaration.defaultValue !== undefined &&
      !isVariableValueCompatible(declaration.type, declaration.defaultValue)
    )
      context.addIssue({
        code: "custom",
        message: "Default value does not match the declared type.",
        path: ["defaultValue"],
      });
  });

export function permittedOperations(type: DrydockVariableType): readonly DrydockVariableOperation[] {
  if (type.kind === "BOOLEAN") return ["assign", "toggle"];
  if (type.kind === "INTEGER" || type.kind === "NUMBER") return ["assign", "increment", "decrement", "min", "max"];
  if (type.kind === "STRING") return ["assign", "clear", "compare"];
  if (type.kind === "ENUM") return ["assign", "compare"];
  if (type.kind === "STRING_SET") return ["add", "remove", "contains", "count"];
  return ["assign", "clear"];
}

export function isVariableValueCompatible(type: DrydockVariableType, value: DrydockVariableValue): boolean {
  if (type.kind === "BOOLEAN") return typeof value === "boolean";
  if (type.kind === "INTEGER") return typeof value === "number" && Number.isSafeInteger(value);
  if (type.kind === "NUMBER") return typeof value === "number" && Number.isFinite(value);
  if (type.kind === "STRING") return typeof value === "string";
  if (type.kind === "ENUM") return typeof value === "string" && type.members.includes(value);
  if (type.kind === "STRING_SET")
    return Array.isArray(value) && value.length <= 128 && value.every((item) => typeof item === "string");
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= 128);
}

export type DrydockVariableRegistry = {
  schemaVersion: 1;
  declarations: readonly DrydockVariableDeclaration[];
  byId: ReadonlyMap<string, DrydockVariableDeclaration>;
  byName: ReadonlyMap<string, DrydockVariableDeclaration>;
  issues: readonly DrydockIssue[];
};

export function createVariableRegistry(input: readonly unknown[]): DrydockVariableRegistry {
  const declarations: DrydockVariableDeclaration[] = [];
  const issues: DrydockIssue[] = [];
  const byId = new Map<string, DrydockVariableDeclaration>();
  const byName = new Map<string, DrydockVariableDeclaration>();
  input.forEach((candidate, index) => {
    const parsed = drydockVariableDeclarationSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_VARIABLE_DECLARATION_INVALID",
            category: "VARIABLE_DECLARATION",
            severity: "ERROR",
            ruleVersion: 1,
            location: { fieldPath: `variables.${index}.${issue.path.join(".")}` },
            message: issue.message,
            remediation: "Correct the typed variable declaration.",
          }),
        );
      return;
    }
    const declaration = parsed.data;
    if (byId.has(declaration.id) || byName.has(declaration.name)) {
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_VARIABLE_DUPLICATE",
          category: "VARIABLE_DECLARATION",
          severity: "ERROR",
          ruleVersion: 1,
          location: { variableId: declaration.id },
          message: "Variable IDs and Creator-readable names must be unique.",
          remediation: "Choose a unique stable ID and name.",
        }),
      );
      return;
    }
    declarations.push(declaration);
    byId.set(declaration.id, declaration);
    byName.set(declaration.name, declaration);
  });
  return { schemaVersion: 1, declarations, byId, byName, issues };
}

export function applyVariableOperation(
  declaration: DrydockVariableDeclaration,
  current: DrydockVariableValue,
  operation: DrydockVariableOperation,
  operand?: DrydockVariableValue,
): DrydockVariableValue {
  if (!declaration.allowedOperations.includes(operation) || !permittedOperations(declaration.type).includes(operation))
    throw new Error(`DRYDOCK_VARIABLE_OPERATION_NOT_PERMITTED:${operation}`);
  if (operation === "toggle") return !Boolean(current);
  if (["increment", "decrement", "min", "max"].includes(operation)) {
    if (
      typeof current !== "number" ||
      typeof operand !== "number" ||
      !Number.isFinite(current) ||
      !Number.isFinite(operand)
    )
      throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
    const next =
      operation === "increment"
        ? current + operand
        : operation === "decrement"
          ? current - operand
          : operation === "min"
            ? Math.min(current, operand)
            : Math.max(current, operand);
    if (!Number.isFinite(next) || (declaration.type.kind === "INTEGER" && !Number.isSafeInteger(next)))
      throw new Error("DRYDOCK_VARIABLE_RESULT_OUT_OF_RANGE");
    return next;
  }
  if (operation === "clear") return declaration.type.kind === "STRING" ? "" : null;
  if (operation === "add" || operation === "remove") {
    if (!Array.isArray(current) || typeof operand !== "string") throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
    const values = new Set(current);
    if (operation === "add") values.add(operand);
    else values.delete(operand);
    if (values.size > 128) throw new Error("DRYDOCK_VARIABLE_SET_LIMIT");
    return [...values].sort();
  }
  if (operation === "compare") {
    if (operand === undefined || !isVariableValueCompatible(declaration.type, operand))
      throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
    if (Array.isArray(current) && Array.isArray(operand))
      return current.length === operand.length && current.every((value, index) => value === operand[index]);
    return current === operand;
  }
  if (operation === "contains") {
    if (!Array.isArray(current) || typeof operand !== "string") throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
    return current.includes(operand);
  }
  if (operation === "count") {
    if (!Array.isArray(current)) throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
    return current.length;
  }
  if (operand === undefined || !isVariableValueCompatible(declaration.type, operand))
    throw new Error("DRYDOCK_VARIABLE_OPERAND_TYPE");
  return declaration.type.kind === "STRING_SET" && Array.isArray(operand) ? [...new Set(operand)].sort() : operand;
}

export type DrydockVariableUsage = {
  variableId: string;
  legacyName?: string;
  kind: "DECLARATION" | "READ" | "WRITE" | "OPERATION" | "EXPRESSION" | "LABEL" | "SCENARIO";
  blockId?: string;
  fieldPath: string;
  operation?: DrydockVariableOperation;
  privacy: DrydockVariablePrivacyClass;
};

export type DrydockVariableUsageIndex = {
  schemaVersion: 1;
  usages: readonly DrydockVariableUsage[];
  byVariableId: ReadonlyMap<string, readonly DrydockVariableUsage[]>;
};

export function createVariableUsageIndex(usages: readonly DrydockVariableUsage[]): DrydockVariableUsageIndex {
  const ordered = [...usages].sort((left, right) =>
    `${left.variableId}:${left.blockId ?? ""}:${left.fieldPath}:${left.kind}`.localeCompare(
      `${right.variableId}:${right.blockId ?? ""}:${right.fieldPath}:${right.kind}`,
      "en",
    ),
  );
  const byVariableId = new Map<string, DrydockVariableUsage[]>();
  for (const usage of ordered)
    byVariableId.set(usage.variableId, [...(byVariableId.get(usage.variableId) ?? []), usage]);
  return { schemaVersion: 1, usages: ordered, byVariableId };
}

export { renameVariableInDraft, type RenameVariableDraft } from "@/drydock/variable-rename";
