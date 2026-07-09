#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean obsolete local Anify Codex client state.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("cleanup-local-state")

    args = parser.parse_args()
    if args.command == "cleanup-local-state":
        print(json.dumps(cleanup_local_state(), indent=2))
        return 0
    raise AssertionError(f"Unhandled command: {args.command}")


def cleanup_local_state() -> dict[str, object]:
    removed: list[str] = []
    for path in obsolete_paths():
        if path.exists():
            shutil.rmtree(path)
            removed.append(str(path))
    return {
        "codex_home": str(codex_home()),
        "removed": removed,
    }


def obsolete_paths() -> list[Path]:
    root = codex_home() / "anify"
    return [
        root / "users",
        root / "runtime",
    ]


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()


if __name__ == "__main__":
    raise SystemExit(main())
