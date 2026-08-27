export const drydockUnexpectedResponseMessage =
  "Sea Trials could not load because the server returned an unexpected response. (DRYDOCK_UNEXPECTED_RESPONSE)";

export class DrydockUnexpectedResponseError extends Error {
  readonly code = "DRYDOCK_UNEXPECTED_RESPONSE";

  constructor() {
    super(drydockUnexpectedResponseMessage);
    this.name = "DrydockUnexpectedResponseError";
  }
}

export type DrydockJsonResponse<T> = Readonly<{
  ok: boolean;
  status: number;
  body: T;
}>;

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
  return contentType.includes("application/json") || contentType.includes("+json");
}

/**
 * Keeps the small, private Sea Trials client surface from ever exposing a
 * framework error document or a raw JSON parser error to a Creator.
 */
export async function fetchDrydockJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<DrydockJsonResponse<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new DrydockUnexpectedResponseError();
  }

  const ok = response.ok;
  if (!isJsonResponse(response)) throw new DrydockUnexpectedResponseError();

  try {
    return { ok, status: response.status, body: JSON.parse(await response.text()) as T };
  } catch {
    throw new DrydockUnexpectedResponseError();
  }
}
