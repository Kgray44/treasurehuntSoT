import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { fieldTestSubmissionSchema, listLandfallFieldTests, recordLandfallFieldTest } from "@/landfall/field-test";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ taleId: string }> };

export async function GET(_: Request, context: Context) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId)))
    return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
  try {
    return NextResponse.json(await listLandfallFieldTests(taleId), { headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export async function POST(request: Request, context: Context) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 24 * 1024) throw new Error("LANDFALL_FIELD_TEST_TOO_LARGE");
    const input = fieldTestSubmissionSchema.parse(JSON.parse(raw));
    return NextResponse.json(await recordLandfallFieldTest(taleId, input), { headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
