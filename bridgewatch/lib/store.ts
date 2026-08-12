import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class BridgewatchStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS bridgewatch_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS bridgewatch_cache (cache_key TEXT PRIMARY KEY, value_json TEXT NOT NULL, etag TEXT, observed_at TEXT NOT NULL, error_text TEXT)",
    );
  }

  get<T>(key: string): { value: T; etag: string | null; observedAt: string; error: string | null } | null {
    const row = this.db
      .prepare("SELECT value_json, etag, observed_at, error_text FROM bridgewatch_cache WHERE cache_key = ?")
      .get(key) as
      | { value_json: string; etag: string | null; observed_at: string; error_text: string | null }
      | undefined;
    return row
      ? { value: JSON.parse(row.value_json) as T, etag: row.etag, observedAt: row.observed_at, error: row.error_text }
      : null;
  }

  put(key: string, value: unknown, etag: string | null, observedAt = new Date().toISOString()): void {
    const json = JSON.stringify(value);
    if (json.length > 1_000_000) throw new Error("Cache payload exceeds the Bridgewatch limit");
    this.db
      .prepare(
        "INSERT INTO bridgewatch_cache (cache_key, value_json, etag, observed_at, error_text) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(cache_key) DO UPDATE SET value_json=excluded.value_json, etag=excluded.etag, observed_at=excluded.observed_at, error_text=NULL",
      )
      .run(key, json, etag, observedAt);
  }

  close(): void {
    this.db.close();
  }
}
