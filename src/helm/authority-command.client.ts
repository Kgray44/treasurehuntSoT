const defaultResponseTimeoutMs = 20_000;

type AuthorityCommand = Readonly<{
  url: string;
  csrfToken: string;
  body: Record<string, unknown>;
  responseTimeoutMs?: number;
}>;

class AuthorityResponseTimeoutError extends Error {
  constructor() {
    super("The Voyage did not confirm this command in time.");
    this.name = "AuthorityResponseTimeoutError";
  }
}

async function postOnce(command: AuthorityCommand) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), command.responseTimeoutMs ?? defaultResponseTimeoutMs);
  try {
    return await fetch(command.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": command.csrfToken },
      body: JSON.stringify(command.body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) throw new AuthorityResponseTimeoutError();
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * A2 authority mutations are idempotency-keyed. If a response is lost after a
 * commit, repeat exactly the same command once so the server can reconcile the
 * durable receipt instead of minting another authority or personal Voyage.
 */
export async function postIdempotentAuthorityCommand(command: AuthorityCommand) {
  try {
    return await postOnce(command);
  } catch (cause) {
    if (!(cause instanceof AuthorityResponseTimeoutError || cause instanceof TypeError)) throw cause;
    return postOnce(command);
  }
}
