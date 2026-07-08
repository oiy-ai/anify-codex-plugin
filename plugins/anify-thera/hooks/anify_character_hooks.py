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


USER_ID = "userA"
MEMORY_SCHEMA_VERSION = "anify-character-mem0-v1"
MAX_TRANSCRIPT_MESSAGES = 40
MAX_MESSAGE_CHARS = 6000
MEMORY_SEARCH_TOP_K = 5
MEMORY_STARTUP_TOP_K = 8


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["user-prompt", "stop", "post-compact", "session-start"])
    parser.add_argument("--character", required=True, choices=["Lynn", "Thera"])
    args = parser.parse_args()

    payload = read_payload()
    workspace = ensure_workspace(args.character)

    record = record_hook_event(args.character, workspace, payload)

    if args.action == "session-start":
        print(build_session_context(args.character, workspace))
        return 0

    if args.action in {"post-compact", "stop"}:
        persist_transcript_memory(args.character, workspace, payload, record)
        return 0

    if args.action == "user-prompt":
        context = search_prompt_memory(args.character, workspace, payload)
        if context:
            print_hook_context("UserPromptSubmit", context)
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
        memory_dir(workspace),
        memory_dir(workspace) / "events",
        memory_dir(workspace) / "transcripts",
        memory_dir(workspace) / "qdrant",
    ]:
        child.mkdir(parents=True, exist_ok=True)
    return workspace


def character_workspace(character: str) -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return codex_home / "anify" / USER_ID / character


def memory_dir(workspace: Path) -> Path:
    return workspace / "memory"


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

    append_jsonl(memory_dir(workspace) / "hook-events.jsonl", record)
    event_path = memory_dir(workspace) / "events" / f"{timestamp}-{safe_name(event_name)}-{turn_id}.json"
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

    session_dir = memory_dir(workspace) / "transcripts" / session_id
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


def persist_transcript_memory(
    character: str,
    workspace: Path,
    payload: dict[str, Any],
    event_record: dict[str, Any],
) -> None:
    snapshot = event_record.get("transcript_snapshot") or {}
    snapshot_path = snapshot.get("snapshot_path")
    messages = transcript_messages(snapshot_path)
    operation = {
        "timestamp": utc_now(),
        "character": character,
        "event": event_record.get("event"),
        "session_id": payload.get("session_id"),
        "turn_id": payload.get("turn_id"),
        "source_snapshot_path": snapshot_path,
        "message_count": len(messages),
    }

    if not messages:
        operation["status"] = "skipped"
        operation["reason"] = "no user or assistant messages extracted"
        append_jsonl(memory_dir(workspace) / "memory-operations.jsonl", operation)
        return

    try:
        result = character_memory(character, workspace).add(
            messages=messages,
            user_id=USER_ID,
            agent_id=agent_id(character),
            run_id=str(payload.get("session_id") or "unknown-session"),
            metadata={
                "schema_version": MEMORY_SCHEMA_VERSION,
                "character": character,
                "visibility": "private",
                "memory_type": "character_long_term",
                "source_hook_event": event_record.get("event"),
                "source_snapshot_path": snapshot_path,
                "source_transcript_path": snapshot.get("source_path"),
                "source_turn_id": payload.get("turn_id"),
            },
            infer=True,
        )
    except Exception as error:
        operation["status"] = "error"
        operation["error"] = f"{type(error).__name__}: {error}"
        append_jsonl(memory_dir(workspace) / "memory-operations.jsonl", operation)
        return

    operation["status"] = "stored"
    operation["result"] = result
    append_jsonl(memory_dir(workspace) / "memory-operations.jsonl", operation)


def search_prompt_memory(character: str, workspace: Path, payload: dict[str, Any]) -> str:
    query = str(payload.get("prompt") or "").strip()
    if not query:
        return ""
    try:
        result = character_memory(character, workspace).search(
            query=query,
            filters={"user_id": USER_ID, "agent_id": agent_id(character)},
            top_k=MEMORY_SEARCH_TOP_K,
        )
    except Exception as error:
        return (
            f"Anify mem0 memory for {character} is unavailable: {type(error).__name__}: {error}\n"
            "Do not fall back to legacy Markdown memory; install/configure mem0ai for this character workspace."
        )

    memories = normalize_mem0_results(result)
    if not memories:
        return ""
    return format_memories(f"Relevant {character} memories from local mem0", memories)


def build_session_context(character: str, workspace: Path) -> str:
    memories_status = startup_memories(character, workspace)
    mem_dir = memory_dir(workspace)
    return (
        f"Anify character startup context for {character}.\n"
        f"Workspace: {workspace}\n"
        f"Memory directory: {mem_dir}\n"
        f"Mem0 history DB: {mem_dir / 'history.db'}\n"
        f"Mem0 vector store: {mem_dir / 'qdrant'}\n"
        f"Hook event log: {mem_dir / 'hook-events.jsonl'}\n"
        f"Transcript snapshots: {mem_dir / 'transcripts'}\n\n"
        "Before answering as this character, use the active persona skill. "
        "Use the injected mem0 memories when present. If the user references earlier events, "
        "relationships, promises, or unresolved details, search local mem0 memory for this character "
        "before answering.\n\n"
        f"{memories_status}"
    )


def startup_memories(character: str, workspace: Path) -> str:
    try:
        result = character_memory(character, workspace).get_all(
            filters={"user_id": USER_ID, "agent_id": agent_id(character)},
            top_k=MEMORY_STARTUP_TOP_K,
        )
    except Exception as error:
        return (
            f"Mem0 status: unavailable for {character}: {type(error).__name__}: {error}\n"
            "This character now uses local mem0 storage only; no Markdown memory fallback is loaded."
        )

    memories = normalize_mem0_results(result)
    if not memories:
        return f"Loaded mem0 memories for {character}: none yet."
    return format_memories(f"Loaded mem0 memories for {character}", memories)


def character_memory(character: str, workspace: Path):
    try:
        from mem0 import Memory
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "Python package 'mem0ai' is not installed in the Codex hook environment. "
            "Install it with: python3 -m pip install mem0ai"
        ) from error

    return Memory.from_config(memory_config(character, workspace))


def memory_config(character: str, workspace: Path) -> dict[str, Any]:
    mem_dir = memory_dir(workspace)
    return {
        "history_db_path": str(mem_dir / "history.db"),
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": f"anify_{character.lower()}",
                "path": str(mem_dir / "qdrant"),
                "embedding_model_dims": 1536,
            },
        },
        "llm": {
            "provider": "openai",
            "config": {
                "model": "gpt-4.1-mini",
                "temperature": 0.1,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": "text-embedding-3-small",
                "embedding_dims": 1536,
            },
        },
        "custom_instructions": character_memory_instructions(character),
    }


def character_memory_instructions(character: str) -> str:
    return (
        f"Extract only durable long-term memory for the Anify character {character}. "
        "Keep facts about relationship continuity with the user, explicit preferences, promises, "
        "unresolved story details, emotionally significant events, and stable world facts involving "
        f"{character}. Do not store coding tasks, repository implementation details, generic tool usage, "
        "temporary plans, hook internals, or facts about other characters unless they directly affect "
        f"{character}. Prefer concise memories that remain useful in future in-character replies."
    )


def transcript_messages(snapshot_path: Any) -> list[dict[str, str]]:
    if not snapshot_path:
        return []
    path = Path(str(snapshot_path))
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []

    messages: list[dict[str, str]] = []
    for line in lines:
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        messages.extend(extract_messages(item))

    return messages[-MAX_TRANSCRIPT_MESSAGES:]


def extract_messages(item: dict[str, Any]) -> list[dict[str, str]]:
    payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
    messages: list[dict[str, str]] = []

    if item.get("type") in {"user", "assistant"}:
        role = item["type"]
        content = content_text(item.get("text") or item.get("content"))
        if content:
            messages.append({"role": role, "content": trim_message(content)})

    if payload.get("type") == "user_message" and payload.get("message"):
        messages.append({"role": "user", "content": trim_message(str(payload["message"]))})

    if payload.get("type") == "message" and payload.get("role") in {"user", "assistant"}:
        content = content_text(payload.get("content"))
        if content:
            messages.append({"role": payload["role"], "content": trim_message(content)})

    return messages


def content_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(part.strip() for part in parts if part.strip())
    return ""


def trim_message(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_MESSAGE_CHARS:
        return text
    return text[-MAX_MESSAGE_CHARS:]


def normalize_mem0_results(result: Any) -> list[dict[str, Any]]:
    if isinstance(result, dict):
        values = result.get("results") or []
    elif isinstance(result, list):
        values = result
    else:
        values = []
    return [value for value in values if isinstance(value, dict)]


def format_memories(title: str, memories: list[dict[str, Any]]) -> str:
    lines = [f"{title}:"]
    for item in memories:
        memory = str(item.get("memory") or item.get("data") or "").strip()
        if not memory:
            continue
        score = item.get("score")
        suffix = f" (score={score:.3f})" if isinstance(score, (int, float)) else ""
        lines.append(f"- {memory}{suffix}")
    return "\n".join(lines)


def print_hook_context(event_name: str, context: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "additionalContext": context,
                }
            },
            ensure_ascii=False,
        )
    )


def agent_id(character: str) -> str:
    return f"character:{character}"


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
