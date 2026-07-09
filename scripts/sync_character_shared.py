#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPO_ROOT / "shared" / "anify-character"
ROLE_PLUGINS = sorted((REPO_ROOT / "plugins").glob("anify-*"))


def main() -> int:
    if not SOURCE.is_dir():
        raise SystemExit(f"Missing shared character runtime: {SOURCE}")

    for plugin_root in ROLE_PLUGINS:
        manifest = plugin_root / ".codex-plugin" / "plugin.json"
        hooks = plugin_root / "hooks" / "hooks.json"
        if not manifest.exists() or not hooks.exists():
            continue

        target = plugin_root / "shared" / "anify-character"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(SOURCE, target)

        for hook in [
            target / "hooks" / "anify_character_hooks.py",
            target / "hooks" / "anify_memory_runtime.sh",
        ]:
            hook.chmod(hook.stat().st_mode | 0o111)
        print(f"synced {SOURCE.relative_to(REPO_ROOT)} -> {target.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
