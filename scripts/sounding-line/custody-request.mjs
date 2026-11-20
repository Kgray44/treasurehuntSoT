// Transport recovery for idempotent reads only. A write is never replayed.
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function custodyRequest(repository, token, { fetchImpl = fetch, wait = pause } = {}) {
  if (!token) throw new Error("PRODUCT_EXPERIENCE_EXCEPTION_AUTHENTICATED_CUSTODY_REQUIRED");
  return async (endpoint, method = "GET", body) => {
    const attempts = method === "GET" ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response;
      try {
        response = await fetchImpl(`https://api.github.com/repos/${repository}/${endpoint}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        if (attempt < attempts) {
          await wait(250);
          continue;
        }
        throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_TRANSPORT_${method === "GET" ? "GET" : "WRITE"}_ATTEMPTS_${attempt}`);
      }
      if (method === "GET" && response.status === 404) return null;
      if (!response.ok)
        throw new Error(
          `PRODUCT_EXPERIENCE_EXCEPTION_${
            method === "POST" && [409, 422].includes(response.status)
              ? "SLOT_CONSUMED"
              : `CUSTODY_ACCESS_${response.status}`
          }`,
        );
      return response.json();
    }
  };
}
