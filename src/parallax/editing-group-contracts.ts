import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const editingGroupMemberSchema = z.strictObject({ kind: z.enum(["ASSET", "ROOM_FEATURE"]), id });
export const editingGroupSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(160),
  members: z.array(editingGroupMemberSchema).min(1).max(288),
});
export type EditingGroupMember = z.infer<typeof editingGroupMemberSchema>;
export type EditingGroup = z.infer<typeof editingGroupSchema>;
export const groupMemberKey = (member: EditingGroupMember) => `${member.kind}:${member.id}`;

/** Deleting/replacing scene content trims authoring memberships, never item geometry. */
export function pruneEditingGroups(content: {
  entities: { id: string }[];
  studio?: { editingGroups?: EditingGroup[]; environment?: { features: { id: string }[] } };
}) {
  if (!content.studio?.editingGroups) return;
  const assets = new Set(content.entities.map((item) => item.id));
  const features = new Set(content.studio.environment?.features.map((item) => item.id) ?? []);
  content.studio.editingGroups = content.studio.editingGroups
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => (member.kind === "ASSET" ? assets : features).has(member.id)),
    }))
    .filter((group) => group.members.length);
}
