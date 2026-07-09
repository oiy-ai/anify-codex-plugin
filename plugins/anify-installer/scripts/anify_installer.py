#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


USER_ID = "userA"
REQUIRED_SAVE_FILES = [
    "profile.md",
    "progress.md",
    "save.md",
    "gm-memory.md",
    "party-memory.md",
    "turn-log.md",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize the local Anify Codex client.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("check-runtime")
    subparsers.add_parser("install-runtime")

    init_save = subparsers.add_parser("init-save")
    init_save.add_argument("--name", required=True)
    init_save.add_argument("--profession", required=True)
    init_save.add_argument("--gender", required=True)
    init_save.add_argument("--other", default="")
    init_save.add_argument("--force", action="store_true")

    args = parser.parse_args()
    if args.command == "check-runtime":
        print(json.dumps(check_runtime(), indent=2))
        return 0
    if args.command == "install-runtime":
        install_runtime()
        print("Anify long-term memory runtime is ready.")
        return 0
    if args.command == "init-save":
        created = init_save_files(
            name=args.name,
            profession=args.profession,
            gender=args.gender,
            other=args.other,
            force=args.force,
        )
        print(json.dumps({"created": created, "workspace": str(gm_workspace())}, indent=2))
        return 0
    raise AssertionError(f"Unhandled command: {args.command}")


def check_runtime() -> dict[str, Any]:
    runtime = runtime_python()
    return {
        "codex_home": str(codex_home()),
        "runtime_path": str(runtime_venv()),
        "runtime_python": str(runtime),
        "python3_available": shutil.which("python3") is not None,
        "runtime_python_available": runtime.is_file() and os.access(runtime, os.X_OK),
        "memory_package_ready": memory_package_ready(runtime),
        "model_access_configured": bool(os.environ.get("OPENAI_API_KEY")),
    }


def install_runtime() -> None:
    python3 = shutil.which("python3")
    if not python3:
        raise SystemExit("Python 3 is required before Anify can deploy local long-term memory.")

    runtime_venv().parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([python3, "-m", "venv", str(runtime_venv())], check=True)
    pip = runtime_venv() / "bin" / "pip"
    subprocess.run([str(pip), "install", "--upgrade", "pip", "setuptools", "wheel"], check=True)
    subprocess.run([str(pip), "install", "mem0ai"], check=True)


def init_save_files(*, name: str, profession: str, gender: str, other: str, force: bool) -> list[str]:
    cleaned = {
        "name": required_value(name, "name"),
        "profession": required_value(profession, "profession"),
        "gender": required_value(gender, "gender"),
        "other": other.strip() or "None provided.",
    }

    workspace = gm_workspace()
    workspace.mkdir(parents=True, exist_ok=True)
    existing = [file_name for file_name in REQUIRED_SAVE_FILES if (workspace / file_name).exists()]
    if existing and not force:
        raise SystemExit(
            "Local GM save already exists. Confirm reinitialization explicitly, then rerun with --force."
        )

    files = save_templates(cleaned)
    for file_name, contents in files.items():
        (workspace / file_name).write_text(contents, encoding="utf-8")
    return list(files)


def save_templates(profile: dict[str, str]) -> dict[str, str]:
    return {
        "profile.md": f"""# UserA Profile

## Player

- Name: {profile["name"]}
- Profession: {profile["profession"]}
- Gender: {profile["gender"]}
- Other settings: {profile["other"]}
- Role: Player character
- Tone preference: Compact, direct, fantasy adventure

## Character Voice

- Speaks with curiosity and caution.
- Avoids taking control away from the player.

## Boundaries

- Keep player-facing output compact.
- Do not reveal hidden GM notes unless explicitly asked to inspect GM state.
""",
        "save.md": f"""# UserA Save

## Current State

- World: anthromyth
- Language: zh
- Adventure session: none
- Engine ready for gameplay: false
- Current area: unknown
- Scene summary: New adventure not started.

## Player

- Name: {profile["name"]}
- Profession: {profile["profession"]}
- Gender: {profile["gender"]}
- Other settings: {profile["other"]}
- Level: 1
- HP: 100/100
- MP: 30/30
- Gold: 0

## Inventory

- None

## Quests

- None

## Flags

- None
""",
        "progress.md": """# UserA Adventure Progress

## Completed Adventures

- None yet.

## Durable Outcomes

- None yet.

## Unresolved Hooks

- None yet.

## Next Adventure Seed

- Start from the active profile and ask Engine MCP for a fresh adventure bootstrap when the user is ready.
""",
        "gm-memory.md": """# UserA GM Memory

## Durable GM Notes

- No durable GM notes yet.

## Hidden Threads

- No hidden threads yet.
""",
        "party-memory.md": """# UserA Party Memory

## Episodic Memory

- No episodic memories yet.

## Relationship Memory

- No relationship memories yet.
""",
        "turn-log.md": """# UserA Turn Log

Append resolved turns below this line.

---
""",
    }


def memory_package_ready(runtime: Path) -> bool:
    if not runtime.is_file():
        return False
    result = subprocess.run(
        [str(runtime), "-c", "from mem0 import Memory"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def required_value(value: str, label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise SystemExit(f"Missing required save field: {label}.")
    return cleaned


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()


def gm_workspace() -> Path:
    return codex_home() / "anify" / "users" / USER_ID / "GM"


def runtime_venv() -> Path:
    return codex_home() / "anify" / "runtime" / "python"


def runtime_python() -> Path:
    return runtime_venv() / "bin" / "python"


if __name__ == "__main__":
    raise SystemExit(main())
