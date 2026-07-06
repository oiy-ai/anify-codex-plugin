# Anify

Anify is a local Codex plugin for running AI-driven DnD-style TRPG adventures.

It provides:

- A single Firebase Auth path shared with the Anify web app.
- Engine-backed MCP tools for auth status, adventure bootstrap, world context, D20 checks, and deterministic rule advice.
- A GM AI orchestration protocol.
- A configurable character AI template.
- Local Markdown save, turn log, GM memory, and character memory under `CODEX_HOME/anify/users/userA`.
- A stable turn loop: read local state, fetch Engine context, GM narration, three options, user action, D20 check, Engine rule resolution, memory/save update, GM advancement.

Use the `anify-trpg-adventure` skill to start or continue a campaign. The public Codex plugin uses standard MCP OAuth discovery only. The Codex shell runtime passes the caller's Firebase bearer token to Engine MCP through shell-owned runtime config and runs the thread from `CODEX_HOME/anify/users/userA`.

Run `python3 scripts/update_cachebuster.py .` after plugin changes to rewrite `.codex-plugin/plugin.json` as `<base-version>+codex.<UTC timestamp>`.

If an older client cache contains `bearer_token_env_var` in the public Anify MCP config, run `node scripts/repair_client_mcp_config.mjs` from the installed plugin checkout to remove that stale shell-only field.
