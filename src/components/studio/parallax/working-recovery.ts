import { draftSchema, type SpatialDraft } from "@/parallax/authoring";
import { environmentDraftSchema, type EnvironmentDraft } from "@/parallax/library-lifecycle-contracts";

import {
  legacyEnvironmentWorkingSchema,
  type LegacyEnvironmentWorking,
} from "@/parallax/legacy-environment-working-contracts";

type WorkingDocument = SpatialDraft | EnvironmentDraft;
type JournalDocument = WorkingDocument | LegacyEnvironmentWorking;
type Recovery = { document: WorkingDocument; revision: number; at: string };
const key = (account: string, id: string) => `parallax.working-recovery.1:${account}:${id}`;
/** Account/definition scoped crash journal; photos, credentials and immutable versions never enter it. */
export function journalWorking(account: string, id: string, document: JournalDocument, revision: number) {
  if (!account) return;
  try {
    localStorage.setItem(key(account, id), JSON.stringify({ document, revision, at: new Date().toISOString() }));
  } catch {
    /* Server autosave remains available when browser storage is full. */
  }
}
export function clearWorkingJournal(account: string, id: string, snapshot: JournalDocument) {
  try {
    const value =
      "format" in snapshot && snapshot.format === "PARALLAX_LEGACY_ENVIRONMENT_WORKING_1"
        ? readLegacyWorkingJournal(account, id)
        : readWorkingJournal(account, id);
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

/** A typed view of the same owner-scoped crash journal; never a second authoring authority. */
export function readLegacyWorkingJournal(
  account: string,
  id: string,
): { document: LegacyEnvironmentWorking; revision: number; at: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account, id)) ?? "null");
    if (!raw || !Number.isInteger(raw.revision) || raw.revision < 0) return null;
    const document = legacyEnvironmentWorkingSchema.parse(raw.document);
    if (document.id !== id) return null;
    return { document, revision: raw.revision, at: raw.at };
  } catch {
    return null;
  }
}
