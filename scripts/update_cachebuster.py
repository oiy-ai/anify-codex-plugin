#!/usr/bin/env python3
"""Update the Anify plugin version with a timestamp cachebuster suffix."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("plugin_path", nargs="?", default=".")
    parser.add_argument("--cachebuster")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.plugin_path).expanduser().resolve() / ".codex-plugin" / "plugin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    version = manifest["version"]
    cachebuster = sanitize(args.cachebuster or datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"))
    next_version = f"{str(version).split('+', 1)[0]}+codex.{cachebuster}"
    manifest["version"] = next_version
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated Anify plugin version: {version} -> {next_version}")


def sanitize(value: str) -> str:
    sanitized = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower())
    sanitized = re.sub(r"-{2,}", "-", sanitized).strip("-")
    if not sanitized:
        raise ValueError("cachebuster cannot be empty")
    return sanitized


if __name__ == "__main__":
    main()
