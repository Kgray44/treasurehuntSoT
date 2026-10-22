import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

const fullSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const publicPath = (value) =>
  typeof value === "string" &&
  !value.includes("\\") &&
  !value.includes("\0") &&
  !path.posix.isAbsolute(value) &&
  value.split("/").every((p) => p && p !== "." && p !== "..") &&
  (/^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|native|\.github|\.agents|Development_Docs)(?:\/|$)/u.test(
    value,
  ) ||
    /^(?:package(?:-lock)?\.json|tsconfig\.json|\.nvmrc|\.prettierrc\.json|\.prettierignore|\.gitignore|\.gitattributes|[\w.-]+\.config\.[\w]+)$/u.test(
      value,
    ));
function immutableSelector(value) {
  const m = typeof value === "string" && /^([a-f0-9]{40}):(.+)$/u.exec(value);
  return Boolean(m && publicPath(m[2]));
}
function keyFor(args, options) {
  try {
    if (
      !Array.isArray(args) ||
      Object.getPrototypeOf(args) !== Array.prototype ||
      !options ||
      Object.getPrototypeOf(options) !== Object.prototype
    )
      return null;
    const ad = Object.getOwnPropertyDescriptors(args);
    if (Reflect.ownKeys(ad).length !== args.length + 1 || Object.values(ad).some((d) => !Object.hasOwn(d, "value")))
      return null;
    if (!args.every((x) => typeof x === "string")) return null;
    const operation = args[0];
    const immutable =
      (operation === "show" && args.length === 2 && immutableSelector(args[1])) ||
      (operation === "rev-parse" && args.length === 2 && immutableSelector(args[1])) ||
      (operation === "ls-tree" && args.length === 3 && args[1] === "-rz" && fullSha(args[2])) ||
      (operation === "ls-tree" && args.length === 4 && fullSha(args[1]) && args[2] === "--" && publicPath(args[3])) ||
      (operation === "merge-base" && args.length === 4 && args[1] === "--is-ancestor" && args.slice(2).every(fullSha));
    if (!immutable) return null;
    const descriptors = Object.getOwnPropertyDescriptors(options),
      values = [];
    if (!Object.hasOwn(descriptors, "stdio")) return null;
    const allowed = new Set([
      "cwd",
      "encoding",
      "stdio",
      "maxBuffer",
      "timeout",
      "windowsHide",
      "killSignal",
      "env",
      "shell",
    ]);
    for (const name of Reflect.ownKeys(descriptors).sort()) {
      const d = descriptors[name];
      if (typeof name !== "string" || !allowed.has(name) || !d.enumerable || !Object.hasOwn(d, "value")) return null;
      const value = d.value;
      if (name === "env" && value !== undefined) return null;
      if (name === "shell" && value !== undefined && value !== false) return null;
      if (name === "stdio") {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        const sd = Object.getOwnPropertyDescriptors(value);
        if (
          Reflect.ownKeys(sd).length !== value.length + 1 ||
          Object.values(sd).some((x) => !Object.hasOwn(x, "value"))
        )
          return null;
        if (value.some((x) => !["ignore", "pipe", "inherit"].includes(x))) return null;
        if (JSON.stringify(value) !== '["ignore","pipe","ignore"]') return null;
        values.push([name, "array", [...value]]);
        continue;
      }
      if (!["string", "number", "boolean", "undefined"].includes(typeof value) && value !== null) return null;
      if (typeof value === "number" && !Number.isFinite(value)) return null;
      values.push([name, value === undefined ? "undefined" : typeof value, value === undefined ? null : value]);
    }
    if (typeof descriptors.cwd?.value !== "string" || !path.isAbsolute(descriptors.cwd.value)) return null;
    return JSON.stringify([args, values]);
  } catch {
    return null;
  }
}

// One recognition invocation owns the reader. Only complete successful raw
// values are retained; errors and derived ancestry results are never cached.
// Fixed entry/raw-payload limits fall back to the original read when exhausted.
export function createImmutableSuccessReuse({ maxEntries = 4096, maxBytes = 64 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 0)
    throw new TypeError("INVALID_IMMUTABLE_READ_CACHE_LIMIT");
  let cachedBytes = 0;
  const cache = new Map();
  const stats = { requests: 0, delegates: 0, hits: 0, uncacheable: 0, entries: 0 };
  return {
    stats,
    executeGitRead(exec, args, options) {
      stats.requests++;
      const key = keyFor(args, options);
      if (key !== null && cache.has(key)) {
        stats.hits++;
        const value = cache.get(key);
        return Buffer.isBuffer(value) ? Buffer.from(value) : value;
      }
      if (key === null) stats.uncacheable++;
      stats.delegates++;
      const value = exec("git", args, options); // Preserve original args/options/error identity.
      if (
        key !== null &&
        (typeof value === "string" || Buffer.isBuffer(value)) &&
        cache.size < maxEntries &&
        cachedBytes + Buffer.byteLength(value) <= maxBytes
      ) {
        cachedBytes += Buffer.byteLength(value);
        cache.set(key, Buffer.isBuffer(value) ? Buffer.from(value) : value);
        stats.entries = cache.size;
      }
      return value;
    },
  };
}

const recognitionReads = new AsyncLocalStorage();

// The recognizer is synchronous. Clear the reader on every return/throw so an
// inherited async context cannot retain or extend this invocation's cache.
export function withImmutableRecognitionReads(operation) {
  const context = { active: true, reader: createImmutableSuccessReuse(), exec: null };
  return recognitionReads.run(context, () => {
    try {
      return operation();
    } finally {
      context.active = false;
      context.reader = null;
    }
  });
}

export function recognitionGitRead(exec, args, options) {
  const context = recognitionReads.getStore();
  if (!context?.active) return exec("git", args, options);
  if (context.exec === null) context.exec = exec;
  if (context.exec !== exec) return exec("git", args, options);
  return context.reader.executeGitRead(exec, args, options);
}
