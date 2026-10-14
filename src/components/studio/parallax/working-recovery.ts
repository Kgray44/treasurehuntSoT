import { draftSchema, type SpatialDraft } from "@/parallax/authoring";
import { environmentDraftSchema, type EnvironmentDraft } from "@/parallax/library-lifecycle-contracts";

type WorkingDocument = SpatialDraft | EnvironmentDraft;
type Recovery = { document: WorkingDocument; revision: number; at: string };
const key = (account: string, id: string) => `parallax.working-recovery.1:${account}:${id}`;
/** Account/definition scoped crash journal; photos, credentials and immutable versions never enter it. */
export function journalWorking(account: string, id: string, document: WorkingDocument, revision: number) {
  if (!account) return;
  try {
    localStorage.setItem(key(account, id), JSON.stringify({ document, revision, at: new Date().toISOString() }));
  } catch {
    /* Server autosave remains available when browser storage is full. */
  }
}
export function clearWorkingJournal(account: string, id: string, snapshot: WorkingDocument) {
  try {
    const value = readWorkingJournal(account, id);
    if (value && JSON.stringify(value.document) === JSON.stringify(snapshot)) localStorage.removeItem(key(account, id));
  } catch {}
}
export function readWorkingJournal(account: string, id: string): Recovery | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account, id)) ?? "null");
    if (!raw || !Number.isInteger(raw.revision) || raw.revision < 0) return null;
    const document =
      raw.document?.format === "PARALLAX_ENVIRONMENT_DRAFT_1"
        ? environmentDraftSchema.parse(raw.document)
        : draftSchema.parse(raw.document);
    if (("format" in document ? document.id : document.content.definitionId) !== id) return null;
    return { document, revision: raw.revision, at: raw.at };
  } catch {
    return null;
  }
}
