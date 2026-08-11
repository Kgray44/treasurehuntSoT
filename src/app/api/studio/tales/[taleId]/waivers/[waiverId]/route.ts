import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { revokeDrydockWaiver } from "@/drydock/waiver-store";

const privateNoStore = { "Cache-Control": "private, no-store" };

export async function DELETE(request: Request, context: { params: Promise<{ taleId: string; waiverId: string }> }) {
  const { taleId, waiverId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateNoStore },
    );
  if (!authorization.session.account.roles.some((assignment) => assignment.role === "ADMINISTRATOR"))
    return NextResponse.json(
      { error: "Drydock waiver revocation requires Administrator authorization." },
      { status: 403, headers: privateNoStore },
    );
  try {
    if (!(await revokeDrydockWaiver({ taleId, waiverId })))
      return NextResponse.json(
        { error: "The active waiver was not found for this Chronicle." },
        { status: 404, headers: privateNoStore },
      );
    return NextResponse.json({ revoked: true, waiverId }, { headers: privateNoStore });
  } catch (cause) {
    return apiError(cause);
  }
}
