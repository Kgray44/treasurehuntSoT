import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import {
  listProviderAdapters,
  safeLinkedIdentities,
  unlinkExternalIdentity,
  updateExternalIdentity,
} from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";

const providerUpdateSchema = z
  .object({
    id: z.string().min(1).max(191),
    visibility: z.enum(["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC", "UNLISTED"]).optional(),
    useForLogin: z.boolean().optional(),
  })
  .strict();
const providerDeleteSchema = z
  .object({ id: z.string().min(1).max(191), password: z.string().min(1).max(256) })
  .strict();

const ordinaryAdapter = (adapter: ReturnType<typeof listProviderAdapters>[number]) => ({
  provider: adapter.provider,
  name: adapter.name,
  available: adapter.available,
  link: adapter.link,
  status: adapter.status,
  externalApproval: adapter.externalApproval,
});

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json({
    adapters: listProviderAdapters()
      .filter((adapter) => ["DISCORD", "STEAM", "MICROSOFT_ACCOUNT"].includes(adapter.provider))
      .map(ordinaryAdapter),
    identities: await safeLinkedIdentities(session.accountId),
  });
}
export async function PATCH(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = providerUpdateSchema.parse(await request.json());
    return NextResponse.json(await updateExternalIdentity(session.accountId, body.id, body));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function DELETE(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = providerDeleteSchema.parse(await request.json());
    await unlinkExternalIdentity(session.accountId, body.id, body.password);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return profileApiError(cause);
  }
}
