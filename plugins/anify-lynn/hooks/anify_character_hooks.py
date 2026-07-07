#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BEGIN_COMPACT_LOG = "<!-- anify:compact-log:start -->"
END_COMPACT_LOG = "<!-- anify:compact-log:end -->"
MAX_MASTER_CHARS = 12000
MAX_EXCERPT_CHARS = 5000
MAX_COMPACT_ENTRIES = 20


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["record", "post-compact", "session-start"])
    parser.add_argument("--character", required=True, choices=["Lynn", "Thera"])
    args = parser.parse_args()

    payload = read_payload()
    workspace = ensure_workspace(args.character)

    if args.action == "session-start":
        record_hook_event(args.character, workspace, payload)
        print(build_session_context(args.character, workspace))
        return 0

    record = record_hook_event(args.character, workspace, payload)
    if args.action == "post-compact":
        update_master_memory(args.character, workspace, payload, record)
    return 0


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        return {"hook_input_error": str(error), "raw_stdin": raw}
    return value if isinstance(value, dict) else {"hook_input": value}


def ensure_workspace(character: str) -> Path:
    workspace = character_workspace(character)
    for child in [
        workspace / "memory",
        workspace / "history",
        workspace / "history" / "events",
        workspace / "history" / "transcripts",
    ]:
        child.mkdir(parents=True, exist_ok=True)

    master = workspace / "memory" / "master.md"
    if not master.exists():
        master.write_text(initial_master_memory(character), encoding="utf-8")
    return workspace


def character_workspace(character: str) -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return codex_home / "anify" / "userA" / character


def initial_master_memory(character: str) -> str:
    return (
        f"# {character} Master Memory\n\n"
        "This file is maintained by Anify character hooks. Keep durable relationship, preference, and story facts here.\n\n"
        "## Durable Memory\n\n"
        "- No durable memories recorded yet.\n\n"
        "## Open Questions\n\n"
        "- None yet.\n\n"
        "## Compact Updates\n\n"
        f"{BEGIN_COMPACT_LOG}\n"
        f"{END_COMPACT_LOG}\n"
    )


def record_hook_event(character: str, workspace: Path, payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = utc_now()
    event_name = str(payload.get("hook_event_name") or "Unknown")
    session_id = safe_name(payload.get("session_id") or "unknown-session")
    turn_id = safe_name(payload.get("turn_id") or "session")

    transcript = read_transcript(payload.get("transcript_path"))
    transcript_meta = snapshot_transcript(
        workspace=workspace,
        timestamp=timestamp,
        event_name=event_name,
        session_id=session_id,
        turn_id=turn_id,
        transcript=transcript,
    )

    record = {
        "timestamp": timestamp,
        "character": character,
        "workspace": str(workspace),
        "event": event_name,
        "session_id": payload.get("session_id"),
        "turn_id": payload.get("turn_id"),
        "cwd": payload.get("cwd"),
        "model": payload.get("model"),
        "trigger": payload.get("trigger"),
        "transcript_path": payload.get("transcript_path"),
        "transcript_snapshot": transcript_meta,
        "hook_input": payload,
    }

    append_jsonl(workspace / "history" / "hook-events.jsonl", record)
    event_path = workspace / "history" / "events" / f"{timestamp}-{safe_name(event_name)}-{turn_id}.json"
    event_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return record


def read_transcript(path_value: Any) -> dict[str, Any]:
    if not path_value:
        return {"available": False, "reason": "missing transcript_path", "text": ""}
    path = Path(str(path_value)).expanduser()
    try:
        text = path.read_text(encoding="utf-8")
        return {"available": True, "source_path": str(path), "text": text}
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")
        return {"available": True, "source_path": str(path), "text": text}
    except OSError as error:
        return {"available": False, "source_path": str(path), "reason": str(error), "text": ""}


def snapshot_transcript(
    *,
    workspace: Path,
    timestamp: str,
    event_name: str,
    session_id: str,
    turn_id: str,
    transcript: dict[str, Any],
) -> dict[str, Any]:
    text = transcript.get("text") or ""
    if not transcript.get("available"):
        return {
            "available": False,
            "source_path": transcript.get("source_path"),
            "reason": transcript.get("reason"),
        }

    session_dir = workspace / "history" / "transcripts" / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = session_dir / f"{timestamp}-{safe_name(event_name)}-{turn_id}.jsonl"
    snapshot_path.write_text(text, encoding="utf-8")
    return {
        "available": True,
        "source_path": transcript.get("source_path"),
        "snapshot_path": str(snapshot_path),
        "bytes": len(text.encode("utf-8")),
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def update_master_memory(
    character: str,
    workspace: Path,
    payload: dict[str, Any],
    event_record: dict[str, Any],
) -> None:
    master_path = workspace / "memory" / "master.md"
    text = master_path.read_text(encoding="utf-8") if master_path.exists() else initial_master_memory(character)

    if BEGIN_COMPACT_LOG not in text or END_COMPACT_LOG not in text:
        text = text.rstrip() + f"\n\n## Compact Updates\n\n{BEGIN_COMPACT_LOG}\n{END_COMPACT_LOG}\n"

    snapshot = event_record.get("transcript_snapshot") or {}
    snapshot_path = snapshot.get("snapshot_path") or "unavailable"
    source_path = snapshot.get("source_path") or "unavailable"
    excerpt = transcript_excerpt(snapshot_path)
    timestamp = event_record["timestamp"]
    trigger = payload.get("trigger") or "unknown"
    session_id = payload.get("session_id") or "unknown"
    turn_id = payload.get("turn_id") or "unknown"

    entry = (
        f"### {timestamp} PostCompact\n\n"
        f"- Trigger: {trigger}\n"
        f"- Session: {session_id}\n"
        f"- Turn: {turn_id}\n"
        f"- Source transcript: `{source_path}`\n"
        f"- Saved snapshot: `{snapshot_path}`\n"
        "- Memory action: review this snapshot for durable relationship, preference, and story facts before future replies.\n\n"
        "<details>\n"
        "<summary>Transcript tail excerpt</summary>\n\n"
        "```text\n"
        f"{excerpt}\n"
        "```\n\n"
        "</details>\n\n"
    )

    updated = insert_compact_entry(text, entry)
    master_path.write_text(updated, encoding="utf-8")


def transcript_excerpt(snapshot_path: str) -> str:
    if not snapshot_path or snapshot_path == "unavailable":
        return "No transcript snapshot was available."
    try:
        text = Path(snapshot_path).read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        return f"Unable to read snapshot: {error}"

    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    tail = "\n".join(lines[-80:])
    if len(tail) > MAX_EXCERPT_CHARS:
        tail = tail[-MAX_EXCERPT_CHARS:]
    return tail.replace("```", "'''") or "Transcript snapshot was empty."


def insert_compact_entry(text: str, entry: str) -> str:
    before, remainder = text.split(BEGIN_COMPACT_LOG, 1)
    current, after = remainder.split(END_COMPACT_LOG, 1)
    entries = split_entries(current)
    entries.insert(0, entry.strip())
    entries = entries[:MAX_COMPACT_ENTRIES]
    body = "\n\n".join(entries)
    if body:
        body = "\n" + body + "\n"
    return before + BEGIN_COMPACT_LOG + body + END_COMPACT_LOG + after


def split_entries(marked_text: str) -> list[str]:
    stripped = marked_text.strip()
    if not stripped:
        return []
    parts = re.split(r"\n(?=### )", stripped)
    return [part.strip() for part in parts if part.strip()]


def build_session_context(character: str, workspace: Path) -> str:
    master_path = workspace / "memory" / "master.md"
    master = master_path.read_text(encoding="utf-8", errors="replace") if master_path.exists() else ""
    if len(master) > MAX_MASTER_CHARS:
        master = master[-MAX_MASTER_CHARS:]

    return (
        f"Anify character startup context for {character}.\n"
        f"Workspace: {workspace}\n"
        f"Master memory: {master_path}\n"
        f"Full history roots: {workspace / 'history' / 'hook-events.jsonl'} and {workspace / 'history' / 'transcripts'}\n\n"
        "Before answering as this character, use the active persona skill. "
        "If the user references earlier events, relationships, promises, or unresolved details, perform targeted agentic search in the history roots with rg/read commands and cite only the relevant facts internally.\n\n"
        "Loaded master memory excerpt:\n"
        f"{master if master.strip() else '(No master memory yet.)'}"
    )


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def safe_name(value: Any) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value)).strip("-")
    return safe[:120] or "unknown"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


if __name__ == "__main__":
    raise SystemExit(main())
