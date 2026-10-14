import { draftSchema, type SpatialDraft } from "./authoring";
import { createRoomEnvironment, type PreviewEnvironment } from "./environment-authoring";

/** Pin a previously unsaved reference room through ordinary history/save before
 * inference. Never replace an authored room merely because a comparison is open.
 */
export function prepareAssistantEnvironment(draft: SpatialDraft, preview: PreviewEnvironment): SpatialDraft {
  const room = draft.content.studio?.environment;
  if (room) {
    if (room.id !== preview.id && room.id !== `editable-${preview.id}`)
      throw new Error(
        `Return to ${room.name} before requesting room placement. The current view is a comparison environment.`,
      );
    return draft;
  }
  const next = draftSchema.parse(draft);
  if (!next.content.studio) throw new Error("Open the scene in Spatial Studio before requesting placement.");
  next.content.studio.environment = createRoomEnvironment(preview);
  return next;
}
