#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPO_ROOT / "shared" / "anify-character" / "skills" / "anify-character-chat" / "SKILL.md"
ROLE_PLUGINS = sorted(
    path for path in (REPO_ROOT / "plugins").glob("anify-*")
    if path.name != "anify-installer"
)


def main() -> int:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing shared character skill: {SOURCE}")

    for plugin_root in ROLE_PLUGINS:
        manifest = plugin_root / ".codex-plugin" / "plugin.json"
        if not manifest.exists():
            continue

        target = plugin_root / "skills" / "anify-character-chat" / "SKILL.md"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SOURCE, target)

        redundant_shared_root = plugin_root / "shared"
        if redundant_shared_root.exists():
            shutil.rmtree(redundant_shared_root)

        print(f"synced {SOURCE.relative_to(REPO_ROOT)} -> {target.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
