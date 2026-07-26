"""Task-owned SQLite restore adapter for synthetic Phase 3 drills only.

It is intentionally not part of the runtime migration path. The production
application continues to use its Prisma/migration architecture; this adapter
only lets a Windows-local rehearsal exercise the independently validated SQL
chain while the Prisma schema engine is unavailable.
"""
import json
import pathlib
import sqlite3
import sys


def apply_migrations(conn, repository):
    migrations = []
    for directory in sorted((repository / "prisma" / "migrations").iterdir()):
        source = directory / "migration.sql"
        if source.exists():
            conn.executescript(source.read_text(encoding="utf8"))
            migrations.append(directory.name)
    return migrations


def insert_rows(conn, table, rows):
    columns = {row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')}
    for row in rows:
        values = {key: value for key, value in row.items() if key in columns}
        if not values:
            continue
        names = list(values)
        quoted = ", ".join(f'"{name}"' for name in names)
        placeholders = ", ".join("?" for _ in names)
        conn.execute(
            f'INSERT OR REPLACE INTO "{table}" ({quoted}) VALUES ({placeholders})',
            [json.dumps(values[name], sort_keys=True) if isinstance(values[name], (dict, list)) else values[name] for name in names],
        )


def main():
    target, records_path, repository = map(pathlib.Path, sys.argv[1:4])
    records = json.loads(records_path.read_text(encoding="utf8"))
    conn = sqlite3.connect(target)
    conn.execute("PRAGMA foreign_keys=ON")
    migrations = apply_migrations(conn, repository)
    # Synthetic fixture roots preserve the optional canonical relations used by
    # private references without creating a session, invitation, or Community record.
    now = "2026-07-25T19:00:00.000Z"
    conn.execute('INSERT OR IGNORE INTO UserAccount(id,status,createdAt,updatedAt) VALUES (?,?,?,?)', ("synthetic-account", "ACTIVE", now, now))
    conn.execute('INSERT OR IGNORE INTO Chronicle(id,slug,title,creatorId,creatorAccountId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', ("synthetic-chronicle", "synthetic-chronicle", "SYNTHETIC CHRONICLE", "synthetic-creator", "synthetic-account", now, now))
    for table, key in [
        ("PrivateContentWrappedKey", "wrappedKeys"),
        ("PrivateContentImport", "imports"),
        ("PrivateContentImportMapping", "mappings"),
        ("PrivateAssetObject", "assetObjects"),
        ("PrivateAssetReference", "assetReferences"),
        ("PrivateContentEncryptedPayload", "encryptedPayloads"),
        ("PrivateContentScan", "scans"),
        ("PrivateContentOperation", "operations"),
        ("PrivateScheduledOperation", "scheduledOperations"),
    ]:
        insert_rows(conn, table, records.get(key, []))
    conn.commit()
    tables = conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    conn.close()
    print(json.dumps({"migrations": len(migrations), "tables": tables}))


if __name__ == "__main__":
    main()
