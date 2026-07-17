#!/usr/bin/env python3
"""Synchronize project conversations and repository-root Development_Docs safely."""

from __future__ import annotations

import argparse
import base64
import contextlib
import dataclasses
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Iterator

VERSION = "1.1.0"
SCHEMA_VERSION = "1.0"
CHAT_COMMIT_MESSAGE = "docs(chats): synchronize project conversations"
DEVELOPMENT_DOCS_COMMIT_MESSAGE = "docs: synchronize Development_Docs"
COMBINED_COMMIT_MESSAGE = "chore(sync): update Codex chats and development docs"
EXIT_SOURCE_ERROR = 3
EXIT_LOCKED = 4
EXIT_INTEGRITY = 5
EXIT_GIT = 6

DEFAULT_DEVELOPMENT_DOCS_WARN_BYTES = 25 * 1024 * 1024
DEFAULT_DEVELOPMENT_DOCS_MAX_GIT_BYTES = 50 * 1024 * 1024
MAX_CONTENT_SCAN_BYTES = 20 * 1024 * 1024
SENSITIVE_NAME_PATTERNS = (
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.crt",
    "*.ppk",
    "credentials.*",
    "secrets.*",
    "*_secret.*",
    "*_credentials.*",
    "*access-token*",
    "*access_token*",
    "*api-token*",
    "*api_token*",
    "*database*credential*",
    "*db*credential*",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    ".npmrc",
    ".pypirc",
    ".netrc",
)
SENSITIVE_DIRECTORY_NAMES = {".ssh", ".aws", ".auth", "auth-cache", "authentication-cache"}
TEXT_DOCUMENT_EXTENSIONS = {
    ".csv",
    ".json",
    ".md",
    ".rst",
    ".svg",
    ".toml",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}
TEXT_DOCUMENT_NAMES = {".gitignore", ".gitattributes"}
OFFICE_DOCUMENT_EXTENSIONS = {".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"}


class SyncError(RuntimeError):
    pass


class SourceError(SyncError):
    pass


class GitSafetyError(SyncError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical_text(value: str) -> str:
    value = unicodedata.normalize("NFC", value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in value.split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + ("\n" if lines else "")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def normalize_path(value: str | Path) -> str:
    text = str(value).replace("\\", "/").rstrip("/")
    return unicodedata.normalize("NFC", text).casefold()


def portable_slug(value: str, limit: int = 64) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(" .-_").lower()
    value = re.sub(r"-+", "-", value) or "untitled"
    reserved = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
    if value in reserved:
        value = f"chat-{value}"
    return value[:limit].rstrip(" .-") or "untitled"


def portable_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(".-_")
    if not cleaned:
        cleaned = sha256_text(value)[:24]
    return cleaned[:80]


def iso_from_epoch(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        return dt.datetime.fromtimestamp(float(value), dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (TypeError, ValueError, OSError):
        return str(value)


def yaml_quote(value: Any) -> str:
    if value is None:
        return '""'
    return json.dumps(str(value), ensure_ascii=False)


@dataclasses.dataclass
class Message:
    role: str
    text: str
    timestamp: str | None = None
    name: str | None = None
    attachments: list[dict[str, str]] = dataclasses.field(default_factory=list)


@dataclasses.dataclass
class Conversation:
    conversation_id: str
    source_type: str
    source_identifier: str
    title: str
    created_at: str | None
    updated_at: str | None
    messages: list[Message]
    metadata: dict[str, Any]
    source_sha256: str
    source_export_timestamp: str | None = None


@dataclasses.dataclass
class Classification:
    result: str
    evidence: list[str]
    reason: str


@dataclasses.dataclass
class SecretScan:
    text: str
    redactions: int
    categories: dict[str, int]
    suspected_categories: list[str]


@dataclasses.dataclass
class GitPathChange:
    kind: str
    path: str
    status: str
    original_path: str | None = None


HIGH_SECRET_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("private_key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----.*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", re.S), "[REDACTED: PRIVATE KEY]"),
    ("github_token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"), "[REDACTED: POSSIBLE GITHUB TOKEN]"),
    ("openai_key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"), "[REDACTED: POSSIBLE API TOKEN]"),
    ("aws_key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"), "[REDACTED: POSSIBLE AWS KEY]"),
    ("bearer_token", re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"), "Bearer [REDACTED: POSSIBLE ACCESS TOKEN]"),
    ("connection_string", re.compile(r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^\s:@/]+):([^\s@/]+)@"), "[REDACTED: DATABASE CONNECTION STRING]@"),
    ("secret_assignment", re.compile(r"(?im)\b(password|passwd|passphrase|api[_-]?key|access[_-]?token|session[_-]?cookie|client[_-]?secret)\s*[:=]\s*([\"'`]?)(?!\[?REDACTED|example|placeholder|changeme|<)[^\s\"'`]{6,}\2"), "[REDACTED: SECRET ASSIGNMENT]"),
    ("login_credential", re.compile(r"(?im)\b(?:admin|gm|user)?\s*login\s*:\s*[^\n/]{1,80}\s*/\s*[`\"']?[^\s`\"']{6,}[`\"']?"), "[REDACTED: LOGIN CREDENTIAL]"),
]

LOW_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # JWT-shaped strings are suspicious, while ordinary SHA-256 hashes are not.
    ("possible_jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b")),
]


def redact_secrets(text: str, enabled: bool = True) -> SecretScan:
    result = text
    categories: dict[str, int] = {}
    if enabled:
        for category, pattern, replacement in HIGH_SECRET_PATTERNS:
            result, count = pattern.subn(replacement, result)
            if count:
                categories[category] = categories.get(category, 0) + count
    suspected: list[str] = []
    scan_target = result
    for category, pattern in LOW_SECRET_PATTERNS:
        for match in pattern.finditer(scan_target):
            if category == "possible_jwt":
                try:
                    header = match.group(0).split(".", 1)[0]
                    decoded = base64.urlsafe_b64decode(header + "=" * (-len(header) % 4))
                    value = json.loads(decoded)
                    if not isinstance(value, dict) or not value.get("alg"):
                        continue
                except (ValueError, UnicodeError, json.JSONDecodeError):
                    continue
            suspected.append(category)
            break
    return SecretScan(result, sum(categories.values()), categories, sorted(set(suspected)))


def detected_secret_categories(text: str) -> list[str]:
    """Return category names only; never return or log a matched value."""
    categories = {category for category, pattern, _ in HIGH_SECRET_PATTERNS if pattern.search(text)}
    categories.update(redact_secrets(text).suspected_categories)
    if re.search(r"(?m)^<<<<<<< .+\n.*?^=======\n.*?^>>>>>>> .+$", text, re.S):
        categories.add("merge_conflict_markers")
    return sorted(categories)


def sensitive_document_name(relative_path: str) -> bool:
    pure = PurePosixPath(relative_path)
    folded_parts = [part.casefold() for part in pure.parts]
    if any(part in SENSITIVE_DIRECTORY_NAMES for part in folded_parts[:-1]):
        return True
    name = folded_parts[-1] if folded_parts else ""
    return any(fnmatch.fnmatchcase(name, pattern.casefold()) for pattern in SENSITIVE_NAME_PATTERNS)


def bounded_file_bytes(path: Path, limit: int = MAX_CONTENT_SCAN_BYTES) -> tuple[bytes, bool]:
    with path.open("rb") as stream:
        value = stream.read(limit + 1)
    return value[:limit], len(value) > limit


def decoded_text_candidates(data: bytes) -> list[str]:
    candidates = [data.decode("utf-8", errors="ignore")]
    if data.startswith((b"\xff\xfe", b"\xfe\xff")) or data[:4096].count(b"\0") > 8:
        candidates.append(data.decode("utf-16", errors="ignore"))
    candidates.append(data.decode("latin-1", errors="ignore"))
    return candidates


def extract_office_text(path: Path) -> tuple[str, list[str]]:
    chunks: list[str] = []
    warnings: list[str] = []
    remaining = MAX_CONTENT_SCAN_BYTES
    try:
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                suffix = PurePosixPath(info.filename).suffix.casefold()
                if info.is_dir() or suffix not in {".xml", ".rels", ".txt", ".csv"}:
                    continue
                if info.file_size > MAX_CONTENT_SCAN_BYTES or info.file_size > remaining:
                    warnings.append("embedded office content exceeded the bounded text scan")
                    break
                data = archive.read(info)
                remaining -= len(data)
                chunks.append(data.decode("utf-8", errors="ignore"))
    except (OSError, zipfile.BadZipFile, RuntimeError):
        warnings.append("office document text could not be extracted")
    return "\n".join(chunks), warnings


def extract_pdf_text(path: Path) -> tuple[str, list[str]]:
    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]
    except ImportError:
        return "", ["PDF text extraction unavailable; raw bytes were still scanned"]
    try:
        reader = PdfReader(path)
        if reader.is_encrypted:
            return "", ["encrypted PDF could not be text-scanned"]
        chunks: list[str] = []
        length = 0
        for page in reader.pages:
            value = page.extract_text() or ""
            remaining = MAX_CONTENT_SCAN_BYTES - length
            if remaining <= 0:
                return "\n".join(chunks), ["PDF text exceeded the bounded content scan"]
            chunks.append(value[:remaining])
            length += len(chunks[-1].encode("utf-8", errors="ignore"))
        return "\n".join(chunks), []
    except Exception:
        return "", ["PDF text could not be extracted; raw bytes were still scanned"]


def scan_document_content(path: Path) -> tuple[list[str], list[str]]:
    """Inspect bounded textual content and return only safe category/warning labels."""
    raw, truncated = bounded_file_bytes(path)
    texts = decoded_text_candidates(raw)
    warnings = ["raw content exceeded the bounded content scan"] if truncated else []
    suffix = path.suffix.casefold()
    if suffix in OFFICE_DOCUMENT_EXTENSIONS:
        office_text, office_warnings = extract_office_text(path)
        texts.append(office_text)
        warnings.extend(office_warnings)
    elif suffix == ".pdf":
        pdf_text, pdf_warnings = extract_pdf_text(path)
        texts.append(pdf_text)
        warnings.extend(pdf_warnings)
    elif suffix not in TEXT_DOCUMENT_EXTENSIONS and path.name.casefold() not in TEXT_DOCUMENT_NAMES:
        warnings.append("binary format received filename, metadata, and raw-byte scanning only")
    categories: set[str] = set()
    for text in texts:
        categories.update(detected_secret_categories(text))
    return sorted(categories), sorted(set(warnings))


def find_repo_root(start: Path) -> Path:
    proc = subprocess.run(["git", "-C", str(start), "rev-parse", "--show-toplevel"], text=True, capture_output=True)
    if proc.returncode:
        raise SyncError(f"Not inside a Git repository: {start}")
    return Path(proc.stdout.strip()).resolve()


class FileLock:
    def __init__(self, path: Path):
        self.path = path
        self.fd: int | None = None

    def __enter__(self) -> "FileLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(self.fd, f"pid={os.getpid()} started={utc_now()}\n".encode())
        except FileExistsError as exc:
            raise SyncError(f"Another chat synchronization is running ({self.path})") from exc
        return self

    def __exit__(self, *_: Any) -> None:
        if self.fd is not None:
            os.close(self.fd)
        with contextlib.suppress(FileNotFoundError):
            self.path.unlink()


class AtomicBatch:
    """Prepare all files first, then replace; restore originals if any replacement fails."""

    def __init__(self) -> None:
        self.items: list[tuple[Path, Path]] = []

    def add(self, target: Path, data: bytes) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=target.parent)
        temp = Path(temp_name)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            data.decode("utf-8")
        except Exception:
            temp.unlink(missing_ok=True)
            raise
        self.items.append((target, temp))

    def commit(self) -> None:
        backups: list[tuple[Path, Path | None]] = []
        try:
            for target, temp in self.items:
                backup: Path | None = None
                if target.exists():
                    backup = target.with_name(f".{target.name}.{uuid.uuid4().hex}.bak")
                    shutil.copy2(target, backup)
                backups.append((target, backup))
                os.replace(temp, target)
            for _, backup in backups:
                if backup:
                    backup.unlink(missing_ok=True)
        except Exception:
            for target, backup in reversed(backups):
                if backup and backup.exists():
                    os.replace(backup, target)
                elif backup is None:
                    target.unlink(missing_ok=True)
            raise
        finally:
            for _, temp in self.items:
                temp.unlink(missing_ok=True)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SourceError(f"Cannot read valid JSON from {path}: {exc.__class__.__name__}") from exc


def iter_json_array(path: Path) -> Iterator[Any]:
    """Incrementally decode a top-level JSON array without loading the whole export."""
    decoder = json.JSONDecoder()
    with path.open("r", encoding="utf-8-sig") as stream:
        buffer = ""
        pos = 0
        started = False
        eof = False
        while True:
            if pos >= len(buffer) and not eof:
                chunk = stream.read(1024 * 1024)
                eof = not chunk
                buffer = buffer[pos:] + chunk
                pos = 0
            while pos < len(buffer) and buffer[pos].isspace():
                pos += 1
            if not started:
                if pos >= len(buffer) and not eof:
                    continue
                if pos >= len(buffer) or buffer[pos] != "[":
                    raise SourceError(f"Expected a JSON array in {path}")
                pos += 1
                started = True
            while pos < len(buffer) and (buffer[pos].isspace() or buffer[pos] == ","):
                pos += 1
            if pos < len(buffer) and buffer[pos] == "]":
                return
            try:
                value, end = decoder.raw_decode(buffer, pos)
                yield value
                pos = end
            except json.JSONDecodeError:
                if eof:
                    raise SourceError(f"Malformed or truncated JSON array in {path}")
                chunk = stream.read(1024 * 1024)
                eof = not chunk
                buffer = buffer[pos:] + chunk
                pos = 0


def visible_content(message: dict[str, Any]) -> tuple[str, list[dict[str, str]]]:
    content = message.get("content") or {}
    parts = content.get("parts") if isinstance(content, dict) else None
    texts: list[str] = []
    attachments: list[dict[str, str]] = []
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, str):
                texts.append(part)
            elif isinstance(part, dict):
                if isinstance(part.get("text"), str):
                    texts.append(part["text"])
                name = part.get("name") or part.get("filename") or part.get("asset_pointer")
                if name:
                    attachments.append({"filename": str(name), "type": str(part.get("mime_type") or part.get("content_type") or "unknown")})
    elif isinstance(content, str):
        texts.append(content)
    metadata = message.get("metadata") or {}
    for item in metadata.get("attachments", []) if isinstance(metadata, dict) else []:
        if isinstance(item, dict):
            attachments.append({"filename": str(item.get("name") or item.get("filename") or "unnamed"), "type": str(item.get("mime_type") or "unknown")})
    return canonical_text("\n\n".join(texts)).rstrip("\n"), attachments


def select_chatgpt_branch(raw: dict[str, Any]) -> list[dict[str, Any]]:
    mapping = raw.get("mapping") or {}
    if not isinstance(mapping, dict):
        return []
    node_id = raw.get("current_node")
    if node_id not in mapping:
        leaves = []
        for key, node in mapping.items():
            children = node.get("children", []) if isinstance(node, dict) else []
            message = node.get("message") if isinstance(node, dict) else None
            stamp = (message or {}).get("create_time") if isinstance(message, dict) else 0
            if not children:
                leaves.append((float(stamp or 0), str(key)))
        node_id = max(leaves, default=(0, ""))[1]
    chain: list[dict[str, Any]] = []
    seen: set[str] = set()
    while node_id and node_id in mapping and node_id not in seen:
        seen.add(node_id)
        node = mapping[node_id]
        if isinstance(node, dict) and isinstance(node.get("message"), dict):
            chain.append(node["message"])
        node_id = node.get("parent") if isinstance(node, dict) else None
    chain.reverse()
    return chain


def parse_chatgpt_conversation(raw: dict[str, Any], source_identifier: str, source_hash: str, export_time: str | None) -> Conversation:
    messages: list[Message] = []
    for item in select_chatgpt_branch(raw):
        author = item.get("author") or {}
        role = str(author.get("role") or "unknown")
        if role not in {"user", "assistant", "tool"}:
            continue
        text, attachments = visible_content(item)
        if not text and not attachments:
            continue
        messages.append(Message(role, text, iso_from_epoch(item.get("create_time")), author.get("name"), attachments))
    created = iso_from_epoch(raw.get("create_time"))
    updated = iso_from_epoch(raw.get("update_time"))
    original_id = raw.get("id") or raw.get("conversation_id")
    if original_id:
        conversation_id = str(original_id)
    else:
        first_user = next((m.text for m in messages if m.role == "user"), "")
        seed = f"chatgpt_export\0{source_identifier}\0{created or ''}\0{sha256_text(first_user)}"
        conversation_id = f"derived-{sha256_text(seed)[:32]}"
    metadata = dict(raw.get("metadata") or {})
    for key in ("project_id", "project_name", "workspace", "repository", "tags"):
        if key in raw:
            metadata[key] = raw[key]
    return Conversation(conversation_id, "chatgpt_export", source_identifier, str(raw.get("title") or "Untitled conversation"), created, updated, messages, metadata, source_hash, export_time)


def iter_chatgpt_path(path: Path) -> Iterator[Conversation]:
    if path.is_dir():
        candidates = sorted(p for p in path.rglob("*.json") if not any(part.startswith(".") for part in p.relative_to(path).parts))
        for candidate in candidates:
            yield from iter_chatgpt_path(candidate)
        for candidate in sorted(path.rglob("*.zip")):
            yield from iter_chatgpt_path(candidate)
        return
    if path.suffix.casefold() == ".zip":
        archive_hash = sha256_file(path)
        export_time = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        try:
            with zipfile.ZipFile(path) as archive:
                for info in sorted(archive.infolist(), key=lambda i: i.filename):
                    pure = PurePosixPath(info.filename)
                    if info.is_dir() or pure.suffix.casefold() != ".json" or info.file_size > 2_000_000_000:
                        continue
                    if pure.name != "conversations.json" and not re.fullmatch(r"(?:conversation[-_]?\d+|\d+)\.json", pure.name, re.I):
                        continue
                    with archive.open(info) as stream:
                        try:
                            value = json.loads(stream.read().decode("utf-8-sig"))
                        except (UnicodeError, json.JSONDecodeError) as exc:
                            raise SourceError(f"Corrupt JSON member {info.filename} in {path.name}") from exc
                    records = value if isinstance(value, list) else [value]
                    for raw in records:
                        if isinstance(raw, dict) and ("mapping" in raw or "conversation_id" in raw):
                            yield parse_chatgpt_conversation(raw, f"{path.name}!/{info.filename}", archive_hash, export_time)
        except zipfile.BadZipFile as exc:
            raise SourceError(f"Unreadable ZIP export: {path}") from exc
        return
    if path.suffix.casefold() != ".json":
        raise SourceError(f"Unsupported transcript source: {path}")
    source_hash = sha256_file(path)
    export_time = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    with path.open("r", encoding="utf-8-sig") as stream:
        first = next((c for c in iter(lambda: stream.read(1), "") if not c.isspace()), "")
    values: Iterable[Any] = iter_json_array(path) if first == "[" else [load_json(path)]
    for value in values:
        records = value if isinstance(value, list) else [value]
        for raw in records:
            if isinstance(raw, dict) and ("mapping" in raw or "conversation_id" in raw):
                yield parse_chatgpt_conversation(raw, path.name, source_hash, export_time)


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or (Path.home() / ".codex"))


def codex_titles(home: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    path = home / "session_index.jsonl"
    if not path.exists():
        return result
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if item.get("id") and item.get("thread_name"):
                result[str(item["id"])] = str(item["thread_name"])
    return result


def attachment_metadata(payload: dict[str, Any]) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for key in ("images", "local_images"):
        for item in payload.get(key, []) or []:
            if isinstance(item, str):
                result.append({"filename": Path(item).name or "image", "type": "image"})
            elif isinstance(item, dict):
                name = item.get("name") or item.get("path") or item.get("url") or "image"
                result.append({"filename": Path(str(name)).name, "type": str(item.get("mime_type") or "image")})
    return result


def parse_codex_jsonl(path: Path, titles: dict[str, str]) -> Conversation:
    metadata: dict[str, Any] = {}
    messages: list[Message] = []
    created: str | None = None
    updated: str | None = None
    session_id: str | None = None
    ignored_call_ids: set[str] = set()
    try:
        with path.open("r", encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, 1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    # An actively appended final line may be incomplete; older corruption is unsafe.
                    if stream.read(1) == "":
                        break
                    raise SourceError(f"Malformed Codex session {path.name} at line {line_number}") from exc
                timestamp = row.get("timestamp")
                created = created or timestamp
                updated = timestamp or updated
                payload = row.get("payload") or {}
                if row.get("type") == "session_meta":
                    session_id = str(payload.get("id") or payload.get("session_id") or "") or None
                    metadata.update({k: payload.get(k) for k in ("cwd", "workspace_roots", "source", "thread_source") if payload.get(k) is not None})
                elif row.get("type") == "turn_context":
                    for key in ("cwd", "workspace_roots"):
                        if payload.get(key) is not None:
                            metadata[key] = payload[key]
                elif row.get("type") == "event_msg" and payload.get("type") in {"user_message", "agent_message"}:
                    role = "user" if payload.get("type") == "user_message" else "assistant"
                    text = str(payload.get("message") or "")
                    messages.append(Message(role, text, timestamp, attachments=attachment_metadata(payload)))
                elif row.get("type") == "response_item" and payload.get("type") in {"function_call", "custom_tool_call"}:
                    name = str(payload.get("name") or payload.get("tool_name") or "tool")
                    arguments = payload.get("arguments") or payload.get("input") or ""
                    if not isinstance(arguments, str):
                        arguments = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
                    call_id = str(payload.get("call_id") or payload.get("id") or "")
                    # A synchronizer must not change its own input merely by running.
                    if name in {"shell_command", "exec_command"} and re.search(r"sync_codex_chats\.(?:py|ps1)\b", arguments, re.I):
                        if call_id:
                            ignored_call_ids.add(call_id)
                        continue
                    messages.append(Message("tool_call", canonical_text(arguments).rstrip(), timestamp, name=name))
                elif row.get("type") == "response_item" and payload.get("type") in {"function_call_output", "custom_tool_call_output"}:
                    call_id = str(payload.get("call_id") or "")
                    if call_id and call_id in ignored_call_ids:
                        continue
                    output = payload.get("output") or ""
                    if not isinstance(output, str):
                        output = json.dumps(output, ensure_ascii=False, sort_keys=True)
                    messages.append(Message("tool_result", canonical_text(output).rstrip(), timestamp, name=call_id or "tool"))
    except (OSError, UnicodeError) as exc:
        raise SourceError(f"Cannot read Codex session {path}: {exc.__class__.__name__}") from exc
    if not session_id:
        match = re.search(r"([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$", path.name, re.I)
        session_id = match.group(1) if match else f"derived-{sha256_text(str(path.resolve()))[:32]}"
    title = titles.get(session_id) or next((m.text.splitlines()[0][:100] for m in messages if m.role == "user" and m.text.strip()), "Codex session")
    return Conversation(session_id, "codex_session", path.name, title, created, updated, messages, metadata, sha256_file(path))


def discover_codex_sessions() -> Iterator[Conversation]:
    home = codex_home()
    titles = codex_titles(home)
    seen: set[Path] = set()
    for directory in (home / "sessions", home / "archived_sessions"):
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*.jsonl")):
            resolved = path.resolve()
            if resolved not in seen:
                seen.add(resolved)
                yield parse_codex_jsonl(path, titles)


def conversation_text(conversation: Conversation) -> str:
    return "\n".join([conversation.title, *[m.text for m in conversation.messages]])


def classify(conversation: Conversation, config: dict[str, Any]) -> Classification:
    cid = conversation.conversation_id
    if cid in set(map(str, config.get("exclude_conversation_ids", []))):
        return Classification("excluded", ["explicit exclude_conversation_ids override"], "Explicitly excluded by configuration")
    if cid in set(map(str, config.get("include_conversation_ids", []))):
        return Classification("included", ["explicit include_conversation_ids override"], "Explicitly included by configuration")
    metadata = conversation.metadata
    flat_meta = json.dumps(metadata, ensure_ascii=False, sort_keys=True)
    flat_norm = flat_meta.casefold()
    evidence: list[str] = []
    for identifier in config.get("project_identifiers", []) + config.get("repository_identifiers", []):
        if str(identifier).casefold() in flat_norm:
            evidence.append(f"metadata contains exact identifier: {identifier}")
    if evidence:
        return Classification("included", evidence, "Exact project or repository metadata association")
    paths: list[str] = []
    cwd = metadata.get("cwd")
    if cwd:
        paths.append(str(cwd))
    roots = metadata.get("workspace_roots") or []
    if isinstance(roots, list):
        paths.extend(map(str, roots))
    configured_paths = [normalize_path(p) for p in config.get("workspace_paths", [])]
    for candidate in paths:
        normalized = normalize_path(candidate)
        for project_path in configured_paths:
            if normalized == project_path or normalized.startswith(project_path + "/") or project_path.startswith(normalized + "/"):
                return Classification("included", [f"workspace path association: {candidate}"], "Codex session workspace matches this project")
    names = [str(x).casefold() for x in config.get("project_names", [])]
    title = conversation.title.strip().casefold()
    if title in names:
        return Classification("included", [f"exact project name in title: {conversation.title}"], "Exact configured project name")
    text = conversation_text(conversation).casefold()
    hits = [str(k) for k in config.get("project_keywords", []) if str(k).casefold() in text]
    if len(hits) >= 2:
        return Classification("included", [f"distinctive project phrase: {h}" for h in hits], "Multiple distinctive project phrases agree")
    if len(hits) == 1:
        return Classification("ambiguous", [f"single project phrase: {hits[0]}"], "Keyword-only evidence is insufficient")
    return Classification("excluded", [], "No project association or distinctive configured evidence")


def filter_messages(conversation: Conversation, config: dict[str, Any]) -> list[Message]:
    result = []
    for message in conversation.messages:
        if message.role in {"tool_call", "tool_result"} and not config.get("include_tool_output", True):
            continue
        result.append(message)
    return result


def render_body(title: str, messages: list[Message]) -> str:
    parts = [f"# {title}"]
    role_labels = {"user": "User", "assistant": "Assistant", "tool_call": "Tool Call", "tool_result": "Tool Result", "tool": "Tool"}
    for message in messages:
        label = role_labels.get(message.role, message.role.title())
        if message.name and message.role in {"tool_call", "tool_result", "tool"}:
            label += f": {message.name}"
        parts.extend(["", f"## {label}"])
        if message.timestamp:
            parts.extend([f"**Timestamp:** {message.timestamp}", ""])
        if message.text:
            parts.append(message.text.replace("\x00", "�"))
        if message.attachments:
            parts.extend(["", "**Attachments:**", ""])
            for item in message.attachments:
                filename = str(item.get("filename", "unnamed")).replace("\n", " ")
                mime = str(item.get("type", "unknown")).replace("\n", " ")
                parts.append(f"- `{filename}` ({mime})")
    return canonical_text("\n".join(parts))


def render_markdown(conversation: Conversation, project_name: str, archived_at: str, enabled_redaction: bool) -> tuple[str, str, SecretScan, int]:
    messages = conversation.messages
    body = render_body(conversation.title, messages)
    scan = redact_secrets(body, enabled_redaction)
    body = canonical_text(scan.text)
    content_hash = sha256_text(body)
    header = [
        "---",
        f"conversation_id: {yaml_quote(conversation.conversation_id)}",
        f"title: {yaml_quote(conversation.title)}",
        f"project: {yaml_quote(project_name)}",
        f"source_type: {yaml_quote(conversation.source_type)}",
        f"created_at: {yaml_quote(conversation.created_at)}",
        f"updated_at: {yaml_quote(conversation.updated_at)}",
        f"message_count: {len(messages)}",
        f"content_sha256: {yaml_quote(content_hash)}",
        f"archived_at: {yaml_quote(archived_at)}",
        "---",
        "",
    ]
    return canonical_text("\n".join(header) + "\n" + body), content_hash, scan, len(messages)


def empty_manifest(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "synchronizer_version": VERSION,
        "project_identity": {
            "name": config["project_names"][0],
            "project_identifiers": config.get("project_identifiers", []),
            "repository_identifiers": config.get("repository_identifiers", []),
        },
        "last_successful_synchronization_at": None,
        "total_conversation_count": 0,
        "total_message_count": 0,
        "source_coverage": {},
        "warnings": [],
        "migration_history": [{"schema_version": SCHEMA_VERSION, "synchronizer_version": VERSION}],
        "conversations": [],
    }


def validate_manifest(manifest: dict[str, Any], repo: Path, check_files: bool = True) -> list[str]:
    errors: list[str] = []
    required_top = {"schema_version", "synchronizer_version", "project_identity", "total_conversation_count", "total_message_count", "conversations"}
    errors.extend(f"missing manifest field: {key}" for key in sorted(required_top - set(manifest)))
    records = manifest.get("conversations", [])
    if not isinstance(records, list):
        return errors + ["conversations must be an array"]
    ids: set[str] = set()
    paths: set[str] = set()
    required_record = {"conversation_id", "source_type", "source_identifier", "project_identifier", "title", "archive_path", "created_at", "updated_at", "first_archived_at", "last_synchronized_at", "message_count", "content_sha256", "source_sha256", "status", "redactions"}
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            errors.append(f"conversation {index} is not an object")
            continue
        errors.extend(f"conversation {index} missing {key}" for key in sorted(required_record - set(record)))
        cid = str(record.get("conversation_id", ""))
        archive_path = str(record.get("archive_path", ""))
        if cid in ids:
            errors.append(f"duplicate conversation id: {cid}")
        if archive_path in paths:
            errors.append(f"duplicate archive path: {archive_path}")
        ids.add(cid); paths.add(archive_path)
        if check_files and archive_path:
            path = repo / archive_path
            if not path.is_file():
                errors.append(f"missing archive file: {archive_path}")
            else:
                text = path.read_text(encoding="utf-8")
                match = re.match(r"\A---\n.*?\n---\n\n(.*)\Z", text, re.S)
                if not match or sha256_text(canonical_text(match.group(1))) != record.get("content_sha256"):
                    errors.append(f"content hash mismatch: {archive_path}")
    if manifest.get("total_conversation_count") != len(records):
        errors.append("total_conversation_count does not match records")
    if manifest.get("total_message_count") != sum(int(r.get("message_count", 0)) for r in records if isinstance(r, dict)):
        errors.append("total_message_count does not match records")
    return errors


def git(repo: Path, *args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True, env=env)
    if check and proc.returncode:
        message = (proc.stderr or proc.stdout).strip().splitlines()
        raise GitSafetyError(message[-1] if message else f"git {' '.join(args)} failed")
    return proc


def configured_relative_directory(config: dict[str, Any], key: str, default: str) -> str:
    value = str(config.get(key, default)).replace("\\", "/").strip("/")
    pure = PurePosixPath(value)
    if not value or pure.is_absolute() or ".." in pure.parts or ":" in value:
        raise SyncError(f"Unsafe repository-relative directory configured for {key}")
    return pure.as_posix()


def parse_porcelain_v2(value: str) -> list[GitPathChange]:
    records = value.split("\0")
    result: list[GitPathChange] = []
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record or record.startswith("# "):
            continue
        if record.startswith("? "):
            result.append(GitPathChange("added", record[2:], "??"))
            continue
        if record.startswith("! "):
            continue
        if record.startswith("1 "):
            fields = record.split(" ", 8)
            if len(fields) != 9:
                raise GitSafetyError("Could not parse ordinary Development_Docs Git status")
            xy, path = fields[1], fields[8]
            if "D" in xy:
                kind = "deleted"
            elif "A" in xy:
                kind = "added"
            else:
                kind = "modified"
            result.append(GitPathChange(kind, path, xy))
            continue
        if record.startswith("2 "):
            fields = record.split(" ", 9)
            if len(fields) != 10 or index >= len(records):
                raise GitSafetyError("Could not parse renamed Development_Docs Git status")
            original_path = records[index]
            index += 1
            result.append(GitPathChange("renamed", fields[9], fields[1], original_path))
            continue
        if record.startswith("u "):
            fields = record.split(" ", 10)
            if len(fields) != 11:
                raise GitSafetyError("Could not parse conflicted Development_Docs Git status")
            result.append(GitPathChange("conflicted", fields[10], fields[1]))
            continue
        raise GitSafetyError("Unrecognized Development_Docs Git status record")
    return result


def coalesce_exact_worktree_renames(repo: Path, changes: list[GitPathChange]) -> list[GitPathChange]:
    """Recognize one-to-one unstaged moves that Git reports as delete plus untracked add."""
    deleted_by_hash: dict[str, list[GitPathChange]] = {}
    added_by_hash: dict[str, list[GitPathChange]] = {}
    for change in changes:
        if change.kind == "deleted":
            proc = git(repo, "rev-parse", f"HEAD:{change.path}", check=False)
            if proc.returncode == 0:
                deleted_by_hash.setdefault(proc.stdout.strip(), []).append(change)
        elif change.kind == "added" and change.status == "??":
            proc = git(repo, "hash-object", "--", change.path, check=False)
            if proc.returncode == 0:
                added_by_hash.setdefault(proc.stdout.strip(), []).append(change)
    replacements: list[GitPathChange] = []
    removed: set[int] = set()
    for blob_hash in sorted(set(deleted_by_hash) & set(added_by_hash)):
        deleted = deleted_by_hash[blob_hash]
        added = added_by_hash[blob_hash]
        if len(deleted) != 1 or len(added) != 1:
            continue
        old, new = deleted[0], added[0]
        removed.update({id(old), id(new)})
        replacements.append(GitPathChange("renamed", new.path, "R100", old.path))
    return [change for change in changes if id(change) not in removed] + replacements


def ignored_untracked_paths(repo: Path, paths: list[str]) -> set[str]:
    if not paths:
        return set()
    payload = "\0".join(paths) + "\0"
    proc = subprocess.run(
        ["git", "-C", str(repo), "check-ignore", "-z", "--stdin"],
        input=payload,
        text=True,
        capture_output=True,
    )
    if proc.returncode not in {0, 1}:
        raise GitSafetyError("git check-ignore failed while auditing Development_Docs")
    return {item for item in proc.stdout.split("\0") if item}


def git_lfs_filter_for_path(repo: Path, path: str) -> bool:
    proc = git(repo, "check-attr", "filter", "--", path, check=False)
    if proc.returncode:
        return False
    return proc.stdout.rstrip().endswith(": lfs")


def repository_lfs_configured(repo: Path) -> bool:
    tracked = git(repo, "ls-files", "-z", "--", "*.gitattributes", "**/.gitattributes", check=False)
    if tracked.returncode:
        return False
    for relative_path in (item for item in tracked.stdout.split("\0") if item):
        try:
            text = (repo / Path(relative_path)).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if re.search(r"(?:^|\s)filter=lfs(?:\s|$)", text, re.M):
            return True
    return False


def empty_development_docs_report(directory: str, exists: bool) -> dict[str, Any]:
    return {
        "directory": directory,
        "exists": exists,
        "git_available": False,
        "changes": {"added": [], "modified": [], "renamed": [], "deleted": [], "conflicted": []},
        "eligible_paths": [],
        "eligible_fingerprints": {},
        "excluded": [],
        "empty_directories": [],
        "large_files": [],
        "scan_warnings": [],
        "lfs_paths_detected": [],
        "lfs_configured": False,
        "commit_included": False,
    }


def audit_development_docs(repo: Path, config: dict[str, Any]) -> dict[str, Any]:
    directory = configured_relative_directory(config, "development_docs_directory", "Development_Docs")
    root = repo / Path(directory)
    report = empty_development_docs_report(directory, root.is_dir())
    if not config.get("sync_development_docs", True):
        report["excluded"].append({"path": directory, "reason": "Development_Docs synchronization disabled"})
        return report
    if not root.exists():
        return report
    if not root.is_dir():
        report["excluded"].append({"path": directory, "reason": "configured path is not a directory"})
        return report
    if git(repo, "rev-parse", "--is-inside-work-tree", check=False).returncode:
        report["scan_warnings"].append({"path": directory, "reason": "Git status unavailable outside a worktree"})
        return report
    report["git_available"] = True
    report["lfs_configured"] = repository_lfs_configured(repo)
    status = git(
        repo,
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
        "--renames",
        "--ignore-submodules=all",
        "--",
        directory,
    ).stdout
    changes = coalesce_exact_worktree_renames(repo, parse_porcelain_v2(status))
    for change in changes:
        item: dict[str, Any] = {"path": change.path, "status": change.status}
        if change.original_path:
            item["original_path"] = change.original_path
        report["changes"][change.kind].append(item)

    physical_paths: list[str] = []
    for path in root.rglob("*"):
        if path.is_file() or path.is_symlink():
            physical_paths.append(path.relative_to(repo).as_posix())
        elif path.is_dir() and not any(path.iterdir()):
            report["empty_directories"].append(path.relative_to(repo).as_posix())
    ignored = ignored_untracked_paths(repo, physical_paths)
    for path in sorted(ignored):
        report["excluded"].append({"path": path, "reason": "ignored by Development_Docs safety rules"})

    warn_size = int(config.get("development_docs_warn_size_bytes", DEFAULT_DEVELOPMENT_DOCS_WARN_BYTES))
    max_git_size = int(config.get("development_docs_max_git_size_bytes", DEFAULT_DEVELOPMENT_DOCS_MAX_GIT_BYTES))
    eligible: set[str] = set()
    excluded_changed: set[str] = set()
    for change in changes:
        if change.kind == "conflicted":
            report["excluded"].append({"path": change.path, "reason": "unresolved Git conflict"})
            excluded_changed.add(change.path)
            continue
        if change.kind == "deleted":
            eligible.add(change.path)
            continue
        relative_path = change.path
        path = repo / Path(relative_path)
        if relative_path in ignored:
            excluded_changed.add(relative_path)
            continue
        if sensitive_document_name(relative_path):
            report["excluded"].append({"path": relative_path, "reason": "sensitive filename pattern"})
            excluded_changed.add(relative_path)
            continue
        if path.is_symlink():
            report["excluded"].append({"path": relative_path, "reason": "symbolic links are not synchronized automatically"})
            excluded_changed.add(relative_path)
            continue
        if not path.is_file():
            report["excluded"].append({"path": relative_path, "reason": "changed path is not a regular file"})
            excluded_changed.add(relative_path)
            continue
        size = path.stat().st_size
        uses_lfs = git_lfs_filter_for_path(repo, relative_path)
        if uses_lfs:
            report["lfs_paths_detected"].append(relative_path)
        if size >= warn_size:
            action = "tracked with existing Git LFS rule" if uses_lfs else "reviewed for ordinary Git history"
            report["large_files"].append({"path": relative_path, "bytes": size, "action": action})
        if size >= max_git_size and not uses_lfs:
            report["excluded"].append({"path": relative_path, "reason": "too large for ordinary Git history without an existing LFS rule"})
            excluded_changed.add(relative_path)
            continue
        categories, warnings = scan_document_content(path)
        for warning in warnings:
            report["scan_warnings"].append({"path": relative_path, "reason": warning})
        if categories:
            report["excluded"].append(
                {"path": relative_path, "reason": f"possible sensitive content ({', '.join(categories)})"}
            )
            excluded_changed.add(relative_path)
            continue
        eligible.add(relative_path)
        if change.original_path:
            eligible.add(change.original_path)

    # Keep both sides of a rename out of the commit when its destination failed a safety gate.
    for change in changes:
        if change.kind == "renamed" and change.path in excluded_changed and change.original_path:
            eligible.discard(change.original_path)
    report["eligible_paths"] = sorted(eligible)
    report["eligible_fingerprints"] = {
        path: sha256_file(repo / Path(path)) if (repo / Path(path)).is_file() else None
        for path in report["eligible_paths"]
    }
    for key in report["changes"]:
        report["changes"][key] = sorted(report["changes"][key], key=lambda item: (item["path"], item.get("original_path", "")))
    report["excluded"] = sorted(report["excluded"], key=lambda item: (item["path"], item["reason"]))
    report["large_files"] = sorted(report["large_files"], key=lambda item: item["path"])
    report["scan_warnings"] = sorted(report["scan_warnings"], key=lambda item: (item["path"], item["reason"]))
    report["lfs_paths_detected"] = sorted(set(report["lfs_paths_detected"]))
    report["empty_directories"] = sorted(set(report["empty_directories"]))
    return report


def ensure_git_safe(repo: Path, remote: str) -> str:
    git_dir = Path(git(repo, "rev-parse", "--git-dir").stdout.strip())
    if not git_dir.is_absolute():
        git_dir = repo / git_dir
    for marker in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
        if (git_dir / marker).exists():
            raise GitSafetyError(f"Git operation in progress ({marker}); synchronization stopped")
    branch = git(repo, "branch", "--show-current").stdout.strip()
    if not branch:
        raise GitSafetyError("Detached HEAD; synchronization requires a branch")
    if git(repo, "remote", "get-url", remote, check=False).returncode:
        raise GitSafetyError(f"Configured remote does not exist: {remote}")
    conflicts = [path for path in git(repo, "diff", "--name-only", "--diff-filter=U", "-z").stdout.split("\0") if path]
    if conflicts:
        raise GitSafetyError("Unresolved Git conflicts prevent synchronization: " + ", ".join(conflicts))
    return branch


def commit_archive(
    repo: Path,
    files: list[str],
    config: dict[str, Any],
    push: bool,
    message: str = CHAT_COMMIT_MESSAGE,
    expected_fingerprints: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    result = {
        "commit_created": False,
        "commit_hash": None,
        "commit_message": None,
        "push_attempted": False,
        "push_result": "not requested",
    }
    if not files:
        return result
    branch = ensure_git_safe(repo, config["remote"])
    for path, expected in (expected_fingerprints or {}).items():
        target = repo / Path(path)
        actual = sha256_file(target) if target.is_file() else None
        if actual != expected:
            raise GitSafetyError(f"Development_Docs changed after its safety scan: {path}")
    existing_staged = set(git(repo, "diff", "--cached", "--name-only", "-z").stdout.split("\0")) - {""}
    unrelated_staged = existing_staged - set(files)
    git(repo, "add", "-A", "--", *files)
    changed = git(repo, "diff", "--cached", "--name-only", "--", *files).stdout.splitlines()
    if not changed:
        return result
    # --only commits explicit synchronization pathspecs while preserving unrelated staged entries.
    git(repo, "commit", "--only", "-m", message, "--", *files)
    commit_hash = git(repo, "rev-parse", "HEAD").stdout.strip()
    result.update(commit_created=True, commit_hash=commit_hash, commit_message=message)
    after_staged = set(git(repo, "diff", "--cached", "--name-only", "-z").stdout.split("\0")) - {""}
    if not unrelated_staged.issubset(after_staged):
        raise GitSafetyError("Unrelated staged changes changed during archive commit")
    if push:
        result["push_attempted"] = True
        remote = config["remote"]
        git(repo, "fetch", "--no-auto-maintenance", "--no-tags", remote, branch)
        remote_ref = f"refs/remotes/{remote}/{branch}"
        if git(repo, "show-ref", "--verify", "--quiet", remote_ref, check=False).returncode == 0:
            if git(repo, "merge-base", "--is-ancestor", remote_ref, "HEAD", check=False).returncode:
                raise GitSafetyError(f"{remote}/{branch} is not an ancestor of local HEAD; pull/reconcile manually")
        git(repo, "push", remote, f"HEAD:refs/heads/{branch}")
        remote_sha = git(repo, "ls-remote", remote, f"refs/heads/{branch}").stdout.split()
        if not remote_sha or remote_sha[0] != commit_hash:
            raise GitSafetyError("Push returned but remote SHA did not match the synchronization commit")
        result["push_result"] = f"verified {remote}/{branch} at {commit_hash}"
    return result


def report_signature(report: dict[str, Any]) -> dict[str, Any]:
    ignored = {"started_at", "finished_at", "commit_created", "commit_hash", "push_attempted", "push_result"}
    return {k: v for k, v in report.items() if k not in ignored}


def reconcile_duplicates(conversations: Iterable[Conversation], warnings: list[str]) -> list[Conversation]:
    chosen: dict[str, Conversation] = {}
    for item in conversations:
        previous = chosen.get(item.conversation_id)
        if previous is None:
            chosen[item.conversation_id] = item
            continue
        rank = (item.updated_at or "", len(item.messages), item.source_sha256)
        old_rank = (previous.updated_at or "", len(previous.messages), previous.source_sha256)
        if rank > old_rank:
            chosen[item.conversation_id] = item
        warnings.append(f"Duplicate source record reconciled for {item.conversation_id}")
    return [chosen[key] for key in sorted(chosen)]


def synchronize(repo: Path, config: dict[str, Any], sources: list[Path] | None, dry_run: bool = False, report_only: bool = False, no_push: bool = False, no_commit: bool = False, verbose: bool = False) -> tuple[dict[str, Any], list[str]]:
    started = utc_now()
    development_docs = audit_development_docs(repo, config)
    archive_rel = Path(config.get("archive_directory", "Codex_Chats"))
    archive = repo / archive_rel
    manifest_path = archive / "manifest.json"
    old_manifest = load_json(manifest_path) if manifest_path.exists() else empty_manifest(config)
    old_records = {str(r["conversation_id"]): r for r in old_manifest.get("conversations", [])}
    warnings: list[str] = []
    errors: list[str] = []
    candidates: list[Conversation] = []
    inspected: list[str] = []
    if sources:
        for source in sources:
            candidates.extend(iter_chatgpt_path(source))
            inspected.append(f"chatgpt_export:{source}")
    else:
        candidates.extend(discover_codex_sessions())
        inspected.append(f"codex_session:{codex_home() / 'sessions'}")
        for raw_directory in config.get("import_directories", []):
            directory = repo / raw_directory
            if directory.exists():
                import_files = [p for p in directory.iterdir() if p.is_file() and p.name not in {"README.md", ".gitkeep"} and p.suffix.casefold() in {".json", ".zip"}]
                for source in sorted(import_files):
                    candidates.extend(iter_chatgpt_path(source))
                    inspected.append(f"chatgpt_export:{source}")
    candidates = reconcile_duplicates(candidates, warnings)
    report: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "synchronizer_version": VERSION,
        "started_at": started,
        "finished_at": None,
        "source_types_inspected": sorted({x.split(":", 1)[0] for x in inspected}),
        "source_coverage": sorted(inspected),
        "conversations_discovered": len(candidates),
        "included": 0, "excluded": 0, "ambiguous": 0,
        "added": 0, "updated": 0, "renamed": 0, "unchanged": 0,
        "unavailable": 0, "redacted": 0, "failed": 0,
        "files_changed": [], "ambiguous_candidates": [],
        "redaction_categories": {}, "suspected_secret_categories": [],
        "development_docs": development_docs,
        "commit_created": False, "commit_hash": None, "commit_message": None,
        "push_attempted": False, "push_result": "not requested",
        "warnings": warnings, "errors": errors,
    }
    records = dict(old_records)
    pending: dict[Path, bytes] = {}
    archive_time = started
    project_name = config["project_names"][0]
    project_identifier = config["project_identifiers"][0]
    for conversation in candidates:
        classification = classify(conversation, config)
        report[classification.result] += 1
        if classification.result == "ambiguous":
            report["ambiguous_candidates"].append({
                "conversation_id": conversation.conversation_id,
                "title": conversation.title,
                "created_at": conversation.created_at,
                "updated_at": conversation.updated_at,
                "classification_evidence": classification.evidence,
                "reason": classification.reason,
            })
            continue
        if classification.result != "included":
            continue
        conversation.messages = filter_messages(conversation, config)
        previous = records.get(conversation.conversation_id)
        markdown, content_hash, scan, message_count = render_markdown(conversation, project_name, previous.get("first_archived_at", archive_time) if previous else archive_time, config.get("redact_secrets", True))
        report["redacted"] += scan.redactions
        for category, count in scan.categories.items():
            report["redaction_categories"][category] = report["redaction_categories"].get(category, 0) + count
        report["suspected_secret_categories"].extend(scan.suspected_categories)
        if previous:
            archive_path = str(previous["archive_path"])
        else:
            filename = f"{portable_id(conversation.conversation_id)}--{portable_slug(conversation.title)}.md"
            archive_path = (archive_rel / "chats" / filename).as_posix()
        changed = previous is None or previous.get("content_sha256") != content_hash
        if previous is None:
            report["added"] += 1
        elif changed:
            report["updated"] += 1
        else:
            report["unchanged"] += 1
            continue
        pending[repo / archive_path] = markdown.encode("utf-8")
        records[conversation.conversation_id] = {
            "conversation_id": conversation.conversation_id,
            "source_type": conversation.source_type,
            "source_identifier": conversation.source_identifier,
            "project_identifier": project_identifier,
            "title": conversation.title,
            "archive_path": archive_path,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
            "first_archived_at": previous.get("first_archived_at", archive_time) if previous else archive_time,
            "last_synchronized_at": archive_time,
            "message_count": message_count,
            "content_sha256": content_hash,
            "source_sha256": conversation.source_sha256,
            "source_export_timestamp": conversation.source_export_timestamp,
            "status": "active",
            "redactions": scan.redactions,
            "redaction_categories": scan.categories,
        }
    report["suspected_secret_categories"] = sorted(set(report["suspected_secret_categories"]))
    substantive = bool(pending)
    new_manifest = dict(old_manifest)
    if substantive:
        ordered_records = [records[key] for key in sorted(records)]
        new_manifest.update({
            "schema_version": SCHEMA_VERSION,
            "synchronizer_version": VERSION,
            "last_successful_synchronization_at": archive_time,
            "total_conversation_count": len(ordered_records),
            "total_message_count": sum(int(r["message_count"]) for r in ordered_records),
            "source_coverage": {"inspected": sorted(inspected), "complete_account_export": False},
            "warnings": warnings,
            "conversations": ordered_records,
        })
        pending[manifest_path] = json_bytes(new_manifest)
    report["files_changed"] = sorted(str(path.relative_to(repo)).replace("\\", "/") for path in pending)
    report["finished_at"] = utc_now()
    tracked_report = archive / "reports" / "latest-sync-report.json"
    # The tracked report changes only with archive content, never for timestamp-only reruns.
    if substantive:
        report_for_file = dict(report)
        pending[tracked_report] = json_bytes(report_for_file)
        report["files_changed"] = sorted(str(path.relative_to(repo)).replace("\\", "/") for path in pending)
        pending[tracked_report] = json_bytes(report)
    local_report = repo / ".codex" / "chat-sync-cache" / "last-run.json"
    if not dry_run and not report_only:
        batch = AtomicBatch()
        for target, data in pending.items():
            batch.add(target, data)
        batch.commit()
        if substantive:
            integrity_errors = validate_manifest(new_manifest, repo, check_files=True)
            if integrity_errors:
                raise SyncError("Post-write manifest validation failed: " + "; ".join(integrity_errors))
        local_report.parent.mkdir(parents=True, exist_ok=True)
        AtomicBatchLocal = AtomicBatch(); AtomicBatchLocal.add(local_report, json_bytes(report)); AtomicBatchLocal.commit()
    elif verbose:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    archive_git_files = list(report["files_changed"])
    development_docs_git_files = list(development_docs["eligible_paths"])
    if report["suspected_secret_categories"]:
        report["warnings"].append("Automatic chat archive commit/push blocked: possible low-confidence secret requires review")
        archive_git_files = []
    git_files = sorted(set(archive_git_files + development_docs_git_files))
    if git_files and not dry_run and not report_only and not no_commit:
        if archive_git_files and development_docs_git_files:
            commit_message = COMBINED_COMMIT_MESSAGE
        elif development_docs_git_files:
            commit_message = DEVELOPMENT_DOCS_COMMIT_MESSAGE
        else:
            commit_message = CHAT_COMMIT_MESSAGE
        git_result = commit_archive(
            repo,
            git_files,
            config,
            push=bool(config.get("automatic_push", True) and not no_push),
            message=commit_message,
            expected_fingerprints=development_docs["eligible_fingerprints"],
        )
        report.update(git_result)
        development_docs["commit_included"] = bool(git_result["commit_created"] and development_docs_git_files)
        AtomicBatchLocal = AtomicBatch(); AtomicBatchLocal.add(local_report, json_bytes(report)); AtomicBatchLocal.commit()
    return report, git_files


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="discover, classify, and inspect Git status without writing")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--no-push", action="store_true", help="allow a local archive commit but do not push")
    parser.add_argument("--no-commit", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--source", action="append", type=Path, help="ChatGPT export JSON, ZIP, or extracted directory")
    parser.add_argument("--report-only", action="store_true", help="inspect and print a report without archive or Git changes")
    parser.add_argument("--validate", action="store_true", help="validate the existing manifest and transcript hashes")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        repo = find_repo_root(args.repo)
        config_path = repo / ".codex" / "chat-sync.json"
        config = load_json(config_path)
        if not config.get("enabled", True):
            print("Chat archive is disabled by .codex/chat-sync.json")
            return 0
        if args.validate:
            manifest = load_json(repo / config.get("archive_directory", "Codex_Chats") / "manifest.json")
            errors = validate_manifest(manifest, repo, check_files=True)
            if errors:
                print("\n".join(errors), file=sys.stderr)
                return EXIT_INTEGRITY
            docs = audit_development_docs(repo, config)
            counts = {key: len(value) for key, value in docs["changes"].items()}
            print(f"Chat archive valid: {manifest['total_conversation_count']} conversations, {manifest['total_message_count']} messages")
            print(
                "Development docs status: "
                f"{counts['added']} added, {counts['modified']} modified, {counts['renamed']} renamed, "
                f"{counts['deleted']} deleted, {counts['conflicted']} conflicted; "
                f"{len(docs['excluded'])} excluded."
            )
            return 0
        lock_path = repo / ".codex" / "chat-sync-cache" / "sync.lock"
        with FileLock(lock_path):
            report, _ = synchronize(repo, config, [p.resolve() for p in args.source] if args.source else None, args.dry_run, args.report_only, args.no_push, args.no_commit, args.verbose)
        print(f"Chat archive: {report['added']} added, {report['updated']} updated, {report['unchanged']} unchanged, {report['excluded']} excluded, {report['ambiguous']} ambiguous.")
        docs = report["development_docs"]
        counts = {key: len(value) for key, value in docs["changes"].items()}
        print(
            "Development docs: "
            f"{counts['added']} added, {counts['modified']} modified, {counts['renamed']} renamed, "
            f"{counts['deleted']} deleted, {counts['conflicted']} conflicted; "
            f"{len(docs['eligible_paths'])} eligible paths, {len(docs['excluded'])} excluded."
        )
        if args.dry_run or args.report_only:
            print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        elif report["commit_created"]:
            print(f"Commit: {report['commit_hash']}; push: {report['push_result']}")
        elif not report["files_changed"] and not docs["eligible_paths"]:
            print("No transcript or Development_Docs changes detected; no synchronization commit created.")
        elif report["suspected_secret_categories"]:
            print("Archive written locally; commit/push blocked pending possible-secret review.")
        return 0
    except SourceError as exc:
        print(f"Source error: {exc}", file=sys.stderr)
        return EXIT_SOURCE_ERROR
    except GitSafetyError as exc:
        print(f"Git safety stop: {exc}", file=sys.stderr)
        return EXIT_GIT
    except SyncError as exc:
        code = EXIT_LOCKED if "synchronization is running" in str(exc) else EXIT_INTEGRITY
        print(f"Synchronization failed: {exc}", file=sys.stderr)
        return code
    except Exception as exc:
        print(f"Unexpected synchronization failure ({exc.__class__.__name__}); rerun with local diagnostics and inspect .codex/chat-sync-cache.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
